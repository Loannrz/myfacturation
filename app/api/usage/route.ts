import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getInvoicesLimit, getQuotesLimit, getProductsLimit } from '@/lib/plan-features-db'

export const dynamic = 'force-dynamic'

/** GET: retourne l'usage du mois (factures, devis), l'usage produits et les limites du plan */
export async function GET() {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const prefix = startOfMonth.toISOString().slice(0, 7) // YYYY-MM

  const [invoicesCount, quotesCount, productsCount, invoicesLimit, quotesLimit, productsLimit] = await Promise.all([
    prisma.invoice.count({
      where: { userId: session.id, issueDate: { startsWith: prefix } },
    }),
    prisma.quote.count({
      where: { userId: session.id, issueDate: { startsWith: prefix } },
    }),
    prisma.billingProduct.count({ where: { userId: session.id } }),
    getInvoicesLimit(session.subscriptionPlan),
    getQuotesLimit(session.subscriptionPlan),
    getProductsLimit(session.subscriptionPlan),
  ])

  return NextResponse.json({
    invoicesThisMonth: invoicesCount,
    quotesThisMonth: quotesCount,
    productsCount,
    invoicesLimit: invoicesLimit ?? null,
    quotesLimit: quotesLimit ?? null,
    productsLimit: productsLimit ?? null,
  })
}
