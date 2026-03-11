import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/**
 * Liste les factures d'abonnement Stripe (payées) pour un mois donné.
 * Option : search = filtre par email ou nom utilisateur.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')?.trim() // YYYY-MM
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

  const subscriptionIds = [...new Set(invoices.data.map((i) => (typeof i.subscription === 'string' ? i.subscription : i.subscription?.id)).filter(Boolean))] as string[]
  if (subscriptionIds.length === 0) {
    return NextResponse.json({ invoices: [], month })
  }

  const users = await prisma.user.findMany({
    where: { stripeSubscriptionId: { in: subscriptionIds } },
    select: { id: true, email: true, name: true, stripeSubscriptionId: true, subscriptionPlan: true },
  })
  const userBySubId: Record<string, (typeof users)[0]> = {}
  for (const u of users) {
    if (u.stripeSubscriptionId) userBySubId[u.stripeSubscriptionId] = u
  }

  let list = invoices.data
    .map((inv) => {
      const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id
      const user = subId ? userBySubId[subId] : null
      return {
        stripeInvoiceId: inv.id,
        invoiceNumber: inv.number || inv.id,
        amountCents: inv.amount_paid ?? 0,
        amountFormatted: inv.amount_paid != null ? `${(inv.amount_paid / 100).toFixed(2)} €` : '—',
        created: inv.created,
        dateFormatted: inv.created ? new Date(inv.created * 1000).toLocaleDateString('fr-FR') : '—',
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
        planLabel: user?.subscriptionPlan === 'business' ? 'Business' : user?.subscriptionPlan === 'pro' ? 'Pro' : 'Starter',
      }
    })
    .filter((row) => row.userId != null)

  if (search) {
    list = list.filter(
      (row) =>
        (row.userEmail?.toLowerCase().includes(search)) ||
        (row.userName?.toLowerCase().includes(search))
    )
  }

  return NextResponse.json({ invoices: list, month })
}
