import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

/**
 * Financial overview for Comptabilité dashboard.
 * Revenue = paid invoices only. Net revenue = paid - credit notes.
 * Query: from, to (YYYY-MM-DD), or year (number).
 */
export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const yearParam = searchParams.get('year')
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const now = new Date()
  const currentYear = yearParam ? parseInt(yearParam, 10) || now.getFullYear() : now.getFullYear()
  const currentMonth = now.getMonth() + 1

  let from: string
  let to: string
  if (fromParam && toParam) {
    from = fromParam.slice(0, 10)
    to = toParam.slice(0, 10)
  } else if (yearParam) {
    const y = parseInt(yearParam, 10) || currentYear
    from = `${y}-01-01`
    to = `${y}-12-31`
  } else {
    from = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    to = now.toISOString().slice(0, 10)
  }

  const userId = session.id

  // Previous period for evolution (same length as [from, to])
  const fromDate = new Date(from)
  const toDate = new Date(to)
  const periodDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const prevToDate = new Date(fromDate)
  prevToDate.setDate(prevToDate.getDate() - 1)
  const prevFromDate = new Date(prevToDate)
  prevFromDate.setDate(prevFromDate.getDate() - periodDays + 1)
  const prevFrom = prevFromDate.toISOString().slice(0, 10)
  const prevTo = prevToDate.toISOString().slice(0, 10)

  const [
    paidInvoices,
    paidInvoicesPrev,
    unpaidInvoices,
    creditNotes,
    creditNotesPrev,
    expenses,
    expensesPrev,
    allInvoicesForCharts,
    allExpensesForCharts,
    allCreditNotesForCharts,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        status: 'paid',
        paidAt: { gte: new Date(from + 'T00:00:00.000Z'), lte: new Date(to + 'T23:59:59.999Z') },
      },
      select: { totalTTC: true },
    }),
    prisma.invoice.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        status: 'paid',
        paidAt: { gte: new Date(prevFrom + 'T00:00:00.000Z'), lte: new Date(prevTo + 'T23:59:59.999Z') },
      },
      select: { totalTTC: true },
    }),
    prisma.invoice.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        status: { in: ['draft', 'sent', 'pending', 'late'] },
      },
      select: { totalTTC: true },
    }),
    prisma.creditNote.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        issueDate: { gte: from, lte: to },
      },
      select: { totalTTC: true },
    }),
    prisma.creditNote.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        issueDate: { gte: prevFrom, lte: prevTo },
      },
      select: { totalTTC: true },
    }),
    prisma.expense.findMany({
      where: { userId, ...whereNotDeleted, date: { gte: from, lte: to } },
      select: { amount: true },
    }),
    prisma.expense.findMany({
      where: { userId, ...whereNotDeleted, date: { gte: prevFrom, lte: prevTo } },
      select: { amount: true },
    }),
    prisma.invoice.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        status: 'paid',
        paidAt: { not: null },
      },
      select: { paidAt: true, totalTTC: true },
    }),
    prisma.expense.findMany({
      where: { userId, ...whereNotDeleted },
      select: { date: true, amount: true, category: true },
    }),
    prisma.creditNote.findMany({
      where: { userId, ...whereNotDeleted },
      select: { issueDate: true, totalTTC: true },
    }),
  ])

  const totalPaidAmount = paidInvoices.reduce((s, i) => s + i.totalTTC, 0)
  const totalPaidAmountPrev = paidInvoicesPrev.reduce((s, i) => s + i.totalTTC, 0)
  const totalCreditNotes = creditNotes.reduce((s, c) => s + c.totalTTC, 0)
  const totalCreditNotesPrev = creditNotesPrev.reduce((s, c) => s + c.totalTTC, 0)
  const totalRevenue = totalPaidAmount - totalCreditNotes
  const totalRevenuePrev = totalPaidAmountPrev - totalCreditNotesPrev
  const totalUnpaidAmount = unpaidInvoices.reduce((s, i) => s + i.totalTTC, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalExpensesPrev = expensesPrev.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalRevenue - totalExpenses
  const netProfitPrev = totalRevenuePrev - totalExpensesPrev

  /** Évolution en % : signe cohérent (baisse = négatif, hausse = positif). Utilise |previous| pour que -100 → -2300 donne un % négatif. */
  function evolution(current: number, previous: number): number | null {
    if (previous === 0) return current !== 0 ? (current > 0 ? 100 : -100) : null
    return Math.round(((current - previous) / Math.abs(previous)) * 100)
  }

  // Plage des mois à afficher dans les graphiques (alignée sur la période from/to)
  const fromMonthKey = from.slice(0, 7)
  const toMonthKey = to.slice(0, 7)
  const monthInRange = (key: string) => key >= fromMonthKey && key <= toMonthKey

  const [fromY, fromM] = fromMonthKey.split('-').map(Number)
  const [toY, toM] = toMonthKey.split('-').map(Number)
  const start = fromY * 12 + (fromM - 1)
  const end = toY * 12 + (toM - 1)

  // Factures payées par mois (brut, sans déduction avoirs)
  const paidInvoicesByMonth: Record<string, number> = {}
  for (let i = start; i <= end; i++) {
    const y = Math.floor(i / 12)
    const m = (i % 12) + 1
    paidInvoicesByMonth[`${y}-${String(m).padStart(2, '0')}`] = 0
  }
  allInvoicesForCharts.forEach((inv) => {
    if (!inv.paidAt) return
    const key = inv.paidAt.toISOString().slice(0, 7)
    if (!monthInRange(key)) return
    paidInvoicesByMonth[key] += inv.totalTTC
  })
  const paidInvoicesByMonthArray = Object.entries(paidInvoicesByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({
      month,
      label: MONTH_LABELS[parseInt(month.slice(5), 10) - 1],
      amount,
    }))

  // Revenue by month (revenus nets = factures payées - avoirs)
  const revenueByMonth: Record<string, number> = {}
  for (let i = start; i <= end; i++) {
    const y = Math.floor(i / 12)
    const m = (i % 12) + 1
    revenueByMonth[`${y}-${String(m).padStart(2, '0')}`] = paidInvoicesByMonth[`${y}-${String(m).padStart(2, '0')}`] ?? 0
  }
  allCreditNotesForCharts.forEach((cn) => {
    const key = cn.issueDate.slice(0, 7)
    if (!monthInRange(key)) return
    if (!revenueByMonth[key]) revenueByMonth[key] = 0
    revenueByMonth[key] -= cn.totalTTC
  })
  const revenueByMonthArray = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({
      month,
      label: MONTH_LABELS[parseInt(month.slice(5), 10) - 1],
      revenue: amount,
    }))

  // Revenue by year
  const revenueByYear: Record<number, number> = {}
  allInvoicesForCharts.forEach((inv) => {
    if (!inv.paidAt) return
    const y = inv.paidAt.getFullYear()
    revenueByYear[y] = (revenueByYear[y] ?? 0) + inv.totalTTC
  })
  allCreditNotesForCharts.forEach((cn) => {
    const y = parseInt(cn.issueDate.slice(0, 4), 10)
    revenueByYear[y] = (revenueByYear[y] ?? 0) - cn.totalTTC
  })
  const revenueByYearArray = Object.entries(revenueByYear)
    .map(([year, revenue]) => ({ year: parseInt(year, 10), revenue }))
    .sort((a, b) => a.year - b.year)

  // Expenses by month, limitée à la période
  const expensesByMonth: Record<string, number> = {}
  for (let i = start; i <= end; i++) {
    const y = Math.floor(i / 12)
    const m = (i % 12) + 1
    expensesByMonth[`${y}-${String(m).padStart(2, '0')}`] = 0
  }
  allExpensesForCharts.forEach((e) => {
    const key = e.date.slice(0, 7)
    if (!monthInRange(key)) return
    if (!expensesByMonth[key]) expensesByMonth[key] = 0
    expensesByMonth[key] += e.amount
  })
  const expensesByMonthArray = Object.entries(expensesByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({
      month,
      label: MONTH_LABELS[parseInt(month.slice(5), 10) - 1],
      amount,
    }))

  // Avoirs (credit notes) par mois pour le tooltip
  const creditNotesByMonth: Record<string, number> = {}
  for (let i = start; i <= end; i++) {
    const y = Math.floor(i / 12)
    const m = (i % 12) + 1
    creditNotesByMonth[`${y}-${String(m).padStart(2, '0')}`] = 0
  }
  allCreditNotesForCharts.forEach((cn) => {
    const key = cn.issueDate.slice(0, 7)
    if (!monthInRange(key)) return
    if (!creditNotesByMonth[key]) creditNotesByMonth[key] = 0
    creditNotesByMonth[key] += cn.totalTTC
  })
  const creditNotesByMonthArray = Object.entries(creditNotesByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }))

  // Dépenses par catégorie par mois (pour graphique en lignes)
  type CategoryMonth = { month: string; label: string; [category: string]: string | number }
  const expensesByCategoryByMonth: CategoryMonth[] = []
  const categoryKeys = new Set<string>()
  allExpensesForCharts.forEach((e) => categoryKeys.add(e.category))
  for (let i = start; i <= end; i++) {
    const y = Math.floor(i / 12)
    const m = (i % 12) + 1
    const month = `${y}-${String(m).padStart(2, '0')}`
    if (!monthInRange(month)) continue
    const row: CategoryMonth = { month, label: MONTH_LABELS[m - 1] }
    categoryKeys.forEach((cat) => { row[cat] = 0 })
    allExpensesForCharts.forEach((e) => {
      if (e.date.slice(0, 7) === month) {
        row[e.category] = (row[e.category] as number) + e.amount
      }
    })
    expensesByCategoryByMonth.push(row)
  }
  expensesByCategoryByMonth.sort((a, b) => a.month.localeCompare(b.month))

  return NextResponse.json({
    from,
    to,
    summary: {
      totalRevenue,
      totalPaidInvoices: totalPaidAmount,
      totalPaidInvoicesCount: paidInvoices.length,
      totalUnpaidInvoices: totalUnpaidAmount,
      totalExpenses,
      totalCreditNotesAmount: totalCreditNotes,
      netProfit,
      revenueEvolution: evolution(totalRevenue, totalRevenuePrev),
      expensesEvolution: evolution(totalExpenses, totalExpensesPrev),
      netProfitEvolution: netProfitPrev !== 0 ? evolution(netProfit, netProfitPrev) : (netProfit !== 0 ? 100 : null),
    },
    revenueByMonth: revenueByMonthArray,
    paidInvoicesByMonth: paidInvoicesByMonthArray,
    revenueByYear: revenueByYearArray,
    expensesByMonth: expensesByMonthArray,
    creditNotesByMonth: creditNotesByMonthArray,
    expensesByCategoryByMonth: expensesByCategoryByMonth,
  })
}
