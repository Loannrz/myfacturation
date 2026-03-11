import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { generateSubscriptionInvoicePDF } from '@/lib/subscription-invoice-pdf'
import { loadPdfLib } from '@/lib/load-pdf-lib'
import archiver from 'archiver'

export const dynamic = 'force-dynamic'

/**
 * Télécharge toutes les factures d'abonnement du mois au format ZIP.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')?.trim()
  const search = searchParams.get('search')?.trim().toLowerCase()

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Paramètre month requis (format YYYY-MM)' }, { status: 400 })
  }

  const [y, m] = month.split('-').map(Number)
  const start = Math.floor(new Date(y, m - 1, 1).getTime() / 1000)
  const end = Math.floor(new Date(y, m, 0, 23, 59, 59).getTime() / 1000)

  const invoices = await stripe.invoices.list({
    status: 'paid',
    created: { gte: start, lte: end },
    limit: 100,
  })

  type InvWithSub = (typeof invoices.data)[number] & { subscription?: string | { id?: string } | null }
  const subscriptionIds = Array.from(
    new Set(
      invoices.data
        .map((i: InvWithSub) => (typeof i.subscription === 'string' ? i.subscription : i.subscription?.id))
        .filter(Boolean)
    )
  ) as string[]
  if (subscriptionIds.length === 0) {
    return NextResponse.json({ error: 'Aucune facture pour ce mois' }, { status: 404 })
  }

  const users = await prisma.user.findMany({
    where: { stripeSubscriptionId: { in: subscriptionIds } },
    select: { id: true, email: true, name: true, stripeSubscriptionId: true, subscriptionPlan: true },
  })
  const userBySubId: Record<string, (typeof users)[0]> = {}
  for (const u of users) {
    if (u.stripeSubscriptionId) userBySubId[u.stripeSubscriptionId] = u
  }

  const items = invoices.data
    .map((inv: InvWithSub) => {
      const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id
      const user = subId ? userBySubId[subId] : null
      return user ? { invoice: inv, user } : null
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  let filtered = items
  if (search) {
    filtered = items.filter(
      (row) =>
        row.user.email?.toLowerCase().includes(search) ||
        row.user.name?.toLowerCase().includes(search)
    )
  }

  if (filtered.length === 0) {
    return NextResponse.json({ error: 'Aucune facture pour ce mois (après filtre)' }, { status: 404 })
  }

  const pdfLib = await loadPdfLib()
  const files: { filename: string; buffer: Buffer }[] = []
  for (const { invoice: inv, user } of filtered) {
    const planLabel = user.subscriptionPlan === 'business' ? 'Business' : user.subscriptionPlan === 'pro' ? 'Pro' : 'Starter'
    const issueDate = inv.created != null ? new Date(inv.created * 1000) : new Date()
    const periodLabel = issueDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const invoiceNumber = inv.number || `FAC-ABO-${inv.id.replace('in_', '').slice(0, 12)}`
    const safeName = (user.email || user.name || user.id).replace(/[^\w.-]/g, '_').slice(0, 40)
    const filename = `facture-${invoiceNumber.replace(/[^\w.-]/g, '_')}-${safeName}.pdf`
    try {
      const pdf = await generateSubscriptionInvoicePDF(
        {
          invoiceNumber,
          issueDate,
          customerName: user.name || 'Client',
          customerEmail: user.email || '',
          description: `Abonnement ${planLabel} – ${periodLabel}`,
          amountCents: inv.amount_paid ?? 0,
          currency: (inv.currency ?? 'eur').toLowerCase(),
        },
        pdfLib
      )
      files.push({ filename, buffer: Buffer.from(pdf) })
    } catch (err) {
      console.error('[admin subscription-invoices zip]', inv.id, err)
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucune facture générée' }, { status: 500 })
  }

  const archive = archiver('zip', { zlib: { level: 6 } })
  const chunks: Uint8Array[] = []
  archive.on('data', (chunk: Uint8Array) => chunks.push(chunk))
  for (const { filename, buffer } of files) {
    archive.append(buffer, { name: filename })
  }
  archive.finalize()
  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
  })

  const zipFilename = `factures-abonnements-${month}.zip`
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename}"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}
