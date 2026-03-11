import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { generateSubscriptionInvoicePDF } from '@/lib/subscription-invoice-pdf'
import { loadPdfLib } from '@/lib/load-pdf-lib'

export const dynamic = 'force-dynamic'

/**
 * Génère et retourne la facture PDF (myfacturation360 By Myeventoo) pour une facture Stripe donnée.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get('invoiceId')?.trim()
  if (!invoiceId || !invoiceId.startsWith('in_')) {
    return NextResponse.json({ error: 'Paramètre invoiceId requis (ex. in_xxx)' }, { status: 400 })
  }

  let invoice: Awaited<ReturnType<typeof stripe.invoices.retrieve>>
  try {
    invoice = await stripe.invoices.retrieve(invoiceId)
  } catch {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  }

  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!subscriptionId) {
    return NextResponse.json({ error: 'Facture sans abonnement' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true, email: true, name: true, subscriptionPlan: true },
  })
  if (!user?.email) {
    return NextResponse.json({ error: 'Utilisateur introuvable pour cette facture' }, { status: 404 })
  }

  const planLabel = user.subscriptionPlan === 'business' ? 'Business' : user.subscriptionPlan === 'pro' ? 'Pro' : 'Starter'
  const issueDate = invoice.created != null ? new Date(invoice.created * 1000) : new Date()
  const periodLabel = issueDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const invoiceNumber = invoice.number || `FAC-ABO-${invoice.id.replace('in_', '').slice(0, 12)}`

  const pdfLib = await loadPdfLib()
  const pdf = await generateSubscriptionInvoicePDF(
    {
      invoiceNumber,
      issueDate,
      customerName: user.name || 'Client',
      customerEmail: user.email,
      description: `Abonnement ${planLabel} – ${periodLabel}`,
      amountCents: invoice.amount_paid ?? 0,
      currency: (invoice.currency ?? 'eur').toLowerCase(),
    },
    pdfLib
  )

  const filename = `facture-${invoiceNumber.replace(/[^\w.-]/g, '_')}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
    },
  })
}
