import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

type Transaction = {
  id: string
  date: string
  type: 'invoice' | 'expense' | 'credit_note'
  reference: string
  clientOrSupplier: string | null
  amount: number
  status: string
  raw?: unknown
}

/**
 * Unified transactions list (invoices, expenses, credit notes) for accounting table.
 * Query: from, to, type (invoice|expense|credit_note), status, clientId.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined
  const typeFilter = searchParams.get('type') ?? undefined // invoice | expense | credit_note
  const statusFilter = searchParams.get('status') ?? undefined
  const clientId = searchParams.get('clientId') ?? undefined
  const bankAccountId = searchParams.get('bankAccountId') ?? undefined

  const userId = session.id
  const transactions: Transaction[] = []

  if (!typeFilter || typeFilter === 'invoice') {
    const where: { userId: string; status?: string; clientId?: string; bankAccountId?: string | null; issueDate?: { gte?: string; lte?: string } } = { userId }
    if (statusFilter) where.status = statusFilter
    if (clientId) where.clientId = clientId
    if (bankAccountId) where.bankAccountId = bankAccountId
    if (from || to) {
      where.issueDate = {}
      if (from) where.issueDate.gte = from.slice(0, 10)
      if (to) where.issueDate.lte = to.slice(0, 10)
    }
    const invoices = await prisma.invoice.findMany({
      where: { ...where, ...whereNotDeleted, status: { not: 'cancelled' } },
      include: { client: true, company: true },
      orderBy: { issueDate: 'desc' },
    })
    invoices.forEach((inv) => {
      const clientOrSupplier = inv.company?.name ?? (inv.client ? [inv.client.firstName, inv.client.lastName].filter(Boolean).join(' ') || inv.client.companyName : null)
      transactions.push({
        id: inv.id,
        date: inv.issueDate,
        type: 'invoice',
        reference: `Facture ${inv.number}`,
        clientOrSupplier,
        amount: inv.totalTTC,
        status: inv.status,
        raw: inv,
      })
    })
  }

  if (!typeFilter || typeFilter === 'expense') {
    const where: { userId: string; bankAccountId?: string | null; date?: { gte?: string; lte?: string } } = { userId }
    if (bankAccountId) where.bankAccountId = bankAccountId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = from.slice(0, 10)
      if (to) where.date.lte = to.slice(0, 10)
    }
    const expenses = await prisma.expense.findMany({
      where: { ...where, ...whereNotDeleted },
      orderBy: { date: 'desc' },
    })
    expenses.forEach((e) => {
      transactions.push({
        id: e.id,
        date: e.date,
        type: 'expense',
        reference: `Dépense ${e.category}${e.description ? ` – ${e.description.slice(0, 30)}` : ''}`,
        clientOrSupplier: e.supplier,
        amount: -e.amount,
        status: 'completed',
        raw: e,
      })
    })
  }

  if (!typeFilter || typeFilter === 'credit_note') {
    const where: { userId: string; status?: string; clientId?: string; bankAccountId?: string | null; issueDate?: { gte?: string; lte?: string } } = { userId }
    if (statusFilter) where.status = statusFilter
    if (clientId) where.clientId = clientId
    if (bankAccountId) where.bankAccountId = bankAccountId
    if (from || to) {
      where.issueDate = {}
      if (from) where.issueDate.gte = from.slice(0, 10)
      if (to) where.issueDate.lte = to.slice(0, 10)
    }
    const creditNotes = await prisma.creditNote.findMany({
      where: { ...where, ...whereNotDeleted },
      include: { client: true, company: true },
      orderBy: { issueDate: 'desc' },
    })
    creditNotes.forEach((cn) => {
      const clientOrSupplier = cn.company?.name ?? (cn.client ? [cn.client.firstName, cn.client.lastName].filter(Boolean).join(' ') || cn.client.companyName : null)
      transactions.push({
        id: cn.id,
        date: cn.issueDate,
        type: 'credit_note',
        reference: `Avoir ${cn.number}`,
        clientOrSupplier,
        amount: -cn.totalTTC,
        status: cn.status,
        raw: cn,
      })
    })
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json(transactions)
}
