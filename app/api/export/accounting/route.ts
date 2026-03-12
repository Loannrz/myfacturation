import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

function escapeCsv(s: string): string {
  if (/[",\n\r;]/.test(s)) return `"${String(s).replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? new Date().toISOString().slice(0, 7) + '-01'
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)
  const format = searchParams.get('format') ?? 'csv' // csv | excel | report

  const [paidInvoices, creditNotes, expenses, allInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId: session.id,
        ...whereNotDeleted,
        status: 'paid',
        paidAt: { gte: new Date(from + 'T00:00:00.000Z'), lte: new Date(to + 'T23:59:59.999Z') },
      },
      include: { client: true, company: true },
    }),
    prisma.creditNote.findMany({
      where: { userId: session.id, ...whereNotDeleted, issueDate: { gte: from.slice(0, 10), lte: to } },
    }),
    prisma.expense.findMany({
      where: { userId: session.id, ...whereNotDeleted, date: { gte: from.slice(0, 10), lte: to } },
    }),
    prisma.invoice.findMany({
      where: {
        userId: session.id,
        ...whereNotDeleted,
        issueDate: { gte: from.slice(0, 10), lte: to.slice(0, 10) },
        status: { not: 'cancelled' },
      },
      include: { client: true, company: true },
    }),
  ])

  const revenue = paidInvoices.reduce((s, i) => s + i.totalTTC, 0)
  const creditNotesAmount = creditNotes.reduce((s, c) => s + c.totalTTC, 0)
  const netRevenue = Math.max(0, revenue - creditNotesAmount)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const profit = netRevenue - totalExpenses

  const sep = format === 'excel' ? ';' : ','
  const bom = '\uFEFF'

  if (format === 'report') {
    const rows: string[][] = [
      ['Rapport comptable', `${from} → ${to}`],
      [],
      ['Synthèse', '', ''],
      ['CA (factures payées)', '', revenue.toFixed(2)],
      ['Avoirs', '', (-creditNotesAmount).toFixed(2)],
      ['CA net', '', netRevenue.toFixed(2)],
      ['Dépenses', '', (-totalExpenses).toFixed(2)],
      ['Résultat net', '', profit.toFixed(2)],
      [],
      ['Factures', 'Numéro', 'Date', 'Client/Société', 'Montant TTC', 'Statut'],
      ...allInvoices.map((i) => [
        'Facture',
        i.number,
        i.issueDate,
        i.company?.name ?? (i.client ? (([i.client.firstName, i.client.lastName].filter(Boolean).join(' ') || i.client.companyName) ?? '') : ''),
        i.totalTTC.toFixed(2),
        i.status,
      ]),
      [],
      ['Dépenses', 'Date', 'Catégorie', 'Description', 'Fournisseur', 'Montant'],
      ...expenses.map((e) => ['Dépense', e.date, e.category, e.description ?? '', e.supplier ?? '', e.amount.toFixed(2)]),
    ]
    const csv = rows.map((row) => row.map(escapeCsv).join(sep)).join('\r\n')
    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rapport-comptable-${from}-${to}.csv"`,
      },
    })
  }

  const lines = [
    ['Type', 'Label', 'Date', 'Amount'],
    ['Revenue', 'Total factures payées', `${from} - ${to}`, revenue.toFixed(2)],
    ['Avoirs', 'Total avoirs', `${from} - ${to}`, (-creditNotesAmount).toFixed(2)],
    ['Revenue net', 'CA net', `${from} - ${to}`, netRevenue.toFixed(2)],
    ['Expenses', 'Total dépenses', `${from} - ${to}`, (-totalExpenses).toFixed(2)],
    ['Profit', 'Résultat net', '', profit.toFixed(2)],
  ]
  const csv = lines.map((row) => row.map(escapeCsv).join(sep)).join('\r\n')
  const filename = format === 'excel' ? `comptabilite-${from}-${to}.csv` : `comptabilite-${from}-${to}.csv`
  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': format === 'excel' ? 'application/vnd.ms-excel; charset=utf-8' : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
