import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : new Date().getFullYear()
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined

  const whereUserId = { userId: session.id }
  const dateFilter = (): { issueDate?: { startsWith: string }; paidAt?: { gte?: Date; lte?: Date } } => {
    if (from && to) {
      return {
        paidAt: {
          gte: new Date(from),
          lte: new Date(to + 'T23:59:59.999Z'),
        },
      }
    }
    if (month != null) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      return { issueDate: { startsWith: prefix } }
    }
    return { issueDate: { startsWith: String(year) } }
  }

  const whereIssue = dateFilter()
  const [invoices, quoteCounts, invoiceCounts, allPaid] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...whereUserId, status: { not: 'cancelled' }, ...whereIssue },
    }),
    prisma.quote.groupBy({
      by: ['status'],
      _count: { id: true },
      where: whereUserId,
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { ...whereUserId, status: { in: ['paid', 'pending'] } },
    }),
    prisma.invoice.findMany({
      where: { ...whereUserId, status: 'paid' },
      select: { paidAt: true, totalTTC: true },
    }),
  ])

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalTTC, 0)
  const totalInvoices = invoices.length
  const totalQuotes = quoteCounts.reduce((s, r) => s + r._count.id, 0)
  const paidInvoices = invoiceCounts.find((r) => r.status === 'paid')?._count.id ?? 0
  const pendingInvoices = invoiceCounts.find((r) => r.status === 'pending')?._count.id ?? 0

  const revenueByMonth: Record<string, number> = {}
  for (let m = 1; m <= 12; m++) {
    const prefix = `${year}-${String(m).padStart(2, '0')}`
    revenueByMonth[prefix] = 0
  }
  invoices.filter((i) => i.status === 'paid').forEach((i) => {
    const key = i.issueDate.slice(0, 7)
    if (revenueByMonth[key] != null) revenueByMonth[key] += i.totalTTC
  })

  return NextResponse.json({
    totalRevenue,
    totalInvoices,
    totalQuotes,
    paidInvoices,
    pendingInvoices,
    revenueByMonth,
    year,
    month,
    from,
    to,
  })
}
