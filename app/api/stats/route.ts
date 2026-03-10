import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : new Date().getFullYear()
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined
  const from = searchParams.get('from') ?? undefined // YYYY-MM-DD
  const to = searchParams.get('to') ?? undefined
  const bankAccountId = searchParams.get('bankAccountId') ?? undefined

  const whereUserId = { userId: session.id }
  const whereBank = bankAccountId ? { ...whereUserId, bankAccountId } : whereUserId

  // Mois à inclure dans les séries : un seul mois, plage [from, to], ou toute l'année
  let monthsInRange: string[] = []
  if (month != null) {
    monthsInRange = [`${year}-${String(month).padStart(2, '0')}`]
  } else if (from && to) {
    const [y1, m1] = from.split('-').map(Number)
    const [y2, m2] = to.split('-').map(Number)
    const start = y1 * 12 + (m1 - 1)
    const end = y2 * 12 + (m2 - 1)
    for (let i = start; i <= end; i++) {
      const y = Math.floor(i / 12)
      const m = (i % 12) + 1
      monthsInRange.push(`${y}-${String(m).padStart(2, '0')}`)
    }
  } else {
    for (let m = 1; m <= 12; m++) {
      monthsInRange.push(`${year}-${String(m).padStart(2, '0')}`)
    }
  }

  const series = monthsInRange.map((monthKey) => {
    const [, m] = monthKey.split('-').map(Number)
    return {
      month: monthKey,
      label: MONTH_LABELS[m - 1],
      ca: 0,
      invoiceAmount: 0,
      invoiceCount: 0,
      collectedCount: 0,
      collectedAmount: 0,
      quoteCount: 0,
      signedQuoteCount: 0,
      creditNoteCount: 0,
      creditNoteAmount: 0,
    }
  })

  // Filtre période pour les totaux (optionnel: un seul mois)
  const periodWhere =
    month != null
      ? { issueDate: { startsWith: `${year}-${String(month).padStart(2, '0')}` } }
      : from && to
        ? { issueDate: { gte: from.slice(0, 10), lte: to.slice(0, 10) } }
        : { issueDate: { startsWith: String(year) } }

  const seriesWhere =
    from && to
      ? { issueDate: { gte: from.slice(0, 10), lte: to.slice(0, 10) } }
      : { issueDate: { startsWith: String(year) } }

  let databaseError = false
  let allInvoices: { issueDate: string; status: string; totalTTC: number; paidAt: Date | null }[] = []
  let invoicesPeriod: { issueDate: string; status: string; totalTTC: number; paidAt: Date | null }[] = []
  let quotes: { issueDate: string; status: string }[] = []
  let lateInvoices: { totalTTC: number; dueDate: string | null }[] = []
  let allCreditNotes: { issueDate: string; totalTTC: number }[] = []
  let creditNotesPeriod: { totalTTC: number }[] = []

  try {
    const result = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ...whereBank,
        status: { not: 'cancelled' },
        ...seriesWhere,
      },
      select: {
        issueDate: true,
        status: true,
        totalTTC: true,
        paidAt: true,
      },
    }),
    prisma.invoice.findMany({
      where: {
        ...whereBank,
        status: { not: 'cancelled' },
        ...periodWhere,
      },
      select: {
        issueDate: true,
        status: true,
        totalTTC: true,
        paidAt: true,
      },
    }),
    prisma.quote.findMany({
      where: { ...whereBank, ...(from && to ? { issueDate: { gte: from.slice(0, 10), lte: to.slice(0, 10) } } : { issueDate: { startsWith: String(year) } }) },
      select: { issueDate: true, status: true },
    }),
    prisma.invoice.findMany({
      where: {
        ...whereBank,
        status: { in: ['pending', 'sent', 'late'] },
        dueDate: { not: null },
      },
      select: { totalTTC: true, dueDate: true },
    }),
    prisma.creditNote.findMany({
      where: { ...whereBank, ...seriesWhere },
      select: { issueDate: true, totalTTC: true },
    }),
    prisma.creditNote.findMany({
      where: { ...whereBank, ...periodWhere },
      select: { totalTTC: true },
    }),
  ])
    allInvoices = result[0]
    invoicesPeriod = result[1]
    quotes = result[2]
    lateInvoices = result[3]
    allCreditNotes = result[4]
    creditNotesPeriod = result[5]
  } catch {
    databaseError = true
  }

  const today = new Date().toISOString().slice(0, 10)
  const paymentDelayAmount = lateInvoices
    .filter((i) => i.dueDate && i.dueDate < today)
    .reduce((s, i) => s + i.totalTTC, 0)
  const paymentDelayCount = lateInvoices.filter((i) => i.dueDate && i.dueDate < today).length

  // Remplir les séries par mois
  const seriesByMonth: Record<string, (typeof series)[0]> = {}
  series.forEach((s) => {
    seriesByMonth[s.month] = s
  })

  allInvoices.forEach((inv) => {
    const key = inv.issueDate.slice(0, 7)
    const row = seriesByMonth[key]
    if (!row) return
    row.invoiceCount += 1
    row.invoiceAmount += inv.totalTTC
    if (inv.status === 'paid') {
      row.ca += inv.totalTTC
    }
    if (inv.paidAt) {
      const paidKey = inv.paidAt.toISOString().slice(0, 7)
      const paidRow = seriesByMonth[paidKey]
      if (paidRow) {
        paidRow.collectedCount += 1
        paidRow.collectedAmount += inv.totalTTC
      }
    }
  })
  allCreditNotes.forEach((cn) => {
    const key = cn.issueDate.slice(0, 7)
    const row = seriesByMonth[key]
    if (!row) return
    row.ca -= cn.totalTTC
    row.creditNoteCount += 1
    row.creditNoteAmount += cn.totalTTC
  })

  quotes.forEach((q) => {
    const key = q.issueDate.slice(0, 7)
    const row = seriesByMonth[key]
    if (!row) return
    row.quoteCount += 1
    if (q.status === 'signed') row.signedQuoteCount += 1
  })

  const paidInPeriod = invoicesPeriod.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalTTC, 0)
  const totalCreditNotesAmount = creditNotesPeriod.reduce((s, c) => s + c.totalTTC, 0)
  const totalCreditNotes = creditNotesPeriod.length
  const totalRevenue = Math.max(0, paidInPeriod - totalCreditNotesAmount) // CA = factures payées - avoirs
  const totalInvoicesAmount = invoicesPeriod.reduce((s, i) => s + i.totalTTC, 0)
  const totalInvoices = invoicesPeriod.length
  const paidInvoices = invoicesPeriod.filter((i) => i.status === 'paid').length
  const totalQuotes = quotes.length
  const signedQuotes = quotes.filter((q) => q.status === 'signed').length

  return NextResponse.json({
    year,
    month: month ?? null,
    from: from ?? null,
    to: to ?? null,
    totalRevenue,
    totalCreditNotes,
    totalCreditNotesAmount,
    totalInvoicesAmount,
    totalInvoices,
    paidInvoices,
    totalQuotes,
    signedQuotes,
    paymentDelayAmount,
    paymentDelayCount,
    series,
    databaseError,
  })
}
