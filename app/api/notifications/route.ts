import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Notifications internes : factures en retard, devis bientôt expirés, dernière dépense.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const inSevenDays = new Date()
  inSevenDays.setDate(inSevenDays.getDate() + 7)
  const dueInSeven = inSevenDays.toISOString().slice(0, 10)

  const [overdueInvoices, expiringQuotes, recentExpenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId: session.id,
        status: { in: ['sent', 'pending', 'late'] },
        dueDate: { lt: today },
      },
      select: { id: true, number: true, totalTTC: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.quote.findMany({
      where: {
        userId: session.id,
        status: { in: ['draft', 'sent'] },
        dueDate: { gte: today, lte: dueInSeven },
      },
      select: { id: true, number: true, totalTTC: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.expense.findMany({
      where: { userId: session.id },
      select: { id: true, amount: true, category: true, date: true, description: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return NextResponse.json({
    overdueInvoices,
    expiringQuotes,
    recentExpenses,
    count: overdueInvoices.length + expiringQuotes.length,
  })
}
