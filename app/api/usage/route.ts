import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getInvoicesLimit, getQuotesLimit } from '@/lib/plan-features-db'

export const dynamic = 'force-dynamic'

/** GET: retourne l'usage du mois (factures, devis) et les limites du plan (plan_features) */
export async function GET() {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const prefix = startOfMonth.toISOString().slice(0, 7) // YYYY-MM

  const [invoicesCount, quotesCount, invoicesLimit, quotesLimit] = await Promise.all([
    prisma.invoice.count({
      where: { userId: session.id, issueDate: { startsWith: prefix } },
    }),
    prisma.quote.count({
      where: { userId: session.id, issueDate: { startsWith: prefix } },
    }),
    getInvoicesLimit(session.subscriptionPlan),
    getQuotesLimit(session.subscriptionPlan),
  ])

  return NextResponse.json({
    invoicesThisMonth: invoicesCount,
    quotesThisMonth: quotesCount,
    invoicesLimit: invoicesLimit ?? null,
    quotesLimit: quotesLimit ?? null,
  })
}
