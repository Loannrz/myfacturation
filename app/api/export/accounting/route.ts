import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAccessFeature } from '@/lib/features'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAccessFeature(session.planType as 'free' | 'premium', 'accounting')) {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? new Date().toISOString().slice(0, 7) + '-01'
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)

  const paidInvoices = await prisma.invoice.findMany({
    where: {
      userId: session.id,
      status: 'paid',
      paidAt: { gte: new Date(from), lte: new Date(to + 'T23:59:59.999Z') },
    },
  })
  const expenses = await prisma.expense.findMany({
    where: { userId: session.id, date: { gte: from.slice(0, 10), lte: to } },
  })

  const revenue = paidInvoices.reduce((s, i) => s + i.totalTTC, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const profit = revenue - totalExpenses

  const lines = [
    ['Type', 'Label', 'Date', 'Amount'],
    ['Revenue', 'Total factures payées', `${from} - ${to}`, revenue.toFixed(2)],
    ['Expenses', 'Total dépenses', `${from} - ${to}`, (-totalExpenses).toFixed(2)],
    ['Profit', 'Bénéfice', '', profit.toFixed(2)],
  ]
  const csv = lines.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
  const bom = '\uFEFF'
  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="comptabilite-${from}-${to}.csv"`,
    },
  })
}
