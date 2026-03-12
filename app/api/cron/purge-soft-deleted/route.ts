import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deletedBeforeRetention } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${CRON_SECRET}`
}

/** Supprime définitivement les enregistrements soft-deleted depuis plus de 7 jours. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const before = deletedBeforeRetention()
  const result: Record<string, number> = {}
  try {
    const [clients, companies, quotes, invoices, creditNotes, employees, expenses] = await Promise.all([
      prisma.client.deleteMany({ where: { deletedAt: { lt: before } } }),
      prisma.company.deleteMany({ where: { deletedAt: { lt: before } } }),
      prisma.quote.deleteMany({ where: { deletedAt: { lt: before } } }),
      prisma.invoice.deleteMany({ where: { deletedAt: { lt: before } } }),
      prisma.creditNote.deleteMany({ where: { deletedAt: { lt: before } } }),
      prisma.employee.deleteMany({ where: { deletedAt: { lt: before } } }),
      prisma.expense.deleteMany({ where: { deletedAt: { lt: before } } }),
    ])
    result.client = clients.count
    result.company = companies.count
    result.quote = quotes.count
    result.invoice = invoices.count
    result.credit_note = creditNotes.count
    result.employee = employees.count
    result.expense = expenses.count
  } catch (e) {
    console.error('purge-soft-deleted:', e)
    return NextResponse.json({ error: 'Erreur lors de la purge', details: String(e) }, { status: 500 })
  }
  return NextResponse.json({ purged: result, before: before.toISOString() })
}
