import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function buildEmptyMonths(year: number): { month: string; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const monthKey = `${year}-${String(m).padStart(2, '0')}`
    return { month: monthKey, label: MONTH_LABELS[i] }
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }

  const { id } = await params
  const yearParam = req.nextUrl.searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) || new Date().getFullYear() : new Date().getFullYear()
  const userId = session.id

  const client = await prisma.client.findFirst({
    where: { id, userId, ...whereNotDeleted },
    select: { id: true },
  })
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [
    paidInvoices,
    quotes,
    creditNotesRefunded,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        clientId: id,
        status: 'paid',
        paidAt: {
          not: null,
          gte: new Date(yearStart + 'T00:00:00.000Z'),
          lte: new Date(yearEnd + 'T23:59:59.999Z'),
        },
      },
      select: { totalTTC: true, paidAt: true },
    }),
    prisma.quote.findMany({
      where: { userId, ...whereNotDeleted, clientId: id, issueDate: { gte: yearStart, lte: yearEnd } },
      select: { issueDate: true, status: true },
    }),
    prisma.creditNote.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        clientId: id,
        status: 'refunded',
        refundedAt: {
          not: null,
          gte: new Date(yearStart + 'T00:00:00.000Z'),
          lte: new Date(yearEnd + 'T23:59:59.999Z'),
        },
      },
      select: { totalTTC: true, refundedAt: true },
    }),
  ])

  const base = buildEmptyMonths(year)
  const paidByMonth = new Map<string, number>()
  const quotesSentByMonth = new Map<string, number>()
  const quotesSignedByMonth = new Map<string, number>()
  const refundedByMonth = new Map<string, number>()
  base.forEach((b) => {
    paidByMonth.set(b.month, 0)
    quotesSentByMonth.set(b.month, 0)
    quotesSignedByMonth.set(b.month, 0)
    refundedByMonth.set(b.month, 0)
  })

  paidInvoices.forEach((inv) => {
    if (inv.paidAt) {
      const key = inv.paidAt.toISOString().slice(0, 7)
      paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + inv.totalTTC)
    }
  })
  quotes.forEach((q) => {
    const key = q.issueDate.slice(0, 7)
    quotesSentByMonth.set(key, (quotesSentByMonth.get(key) ?? 0) + 1)
    if (q.status === 'signed') quotesSignedByMonth.set(key, (quotesSignedByMonth.get(key) ?? 0) + 1)
  })
  creditNotesRefunded.forEach((cn) => {
    if (cn.refundedAt) {
      const key = cn.refundedAt.toISOString().slice(0, 7)
      refundedByMonth.set(key, (refundedByMonth.get(key) ?? 0) + cn.totalTTC)
    }
  })

  const paidInvoicesByMonth = base.map((b) => ({ ...b, amount: paidByMonth.get(b.month) ?? 0 }))
  const quotesSentByMonthData = base.map((b) => ({ ...b, count: quotesSentByMonth.get(b.month) ?? 0 }))
  const quotesSignedByMonthData = base.map((b) => ({ ...b, count: quotesSignedByMonth.get(b.month) ?? 0 }))
  const creditNotesRefundedByMonth = base.map((b) => ({ ...b, amount: refundedByMonth.get(b.month) ?? 0 }))
  const revenueByMonth = paidInvoicesByMonth.map((b) => ({ ...b, amount: b.amount }))

  return NextResponse.json({
    paidInvoicesByMonth,
    quotesSentByMonth: quotesSentByMonthData,
    quotesSignedByMonth: quotesSignedByMonthData,
    creditNotesRefundedByMonth,
    revenueByMonth,
  })
}
