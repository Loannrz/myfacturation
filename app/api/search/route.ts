import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

/**
 * Recherche globale : client (nom), numéro de facture, numéro de devis, montant.
 * Query: q (texte), type (invoice|quote|client|all)
 */
export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim().slice(0, 100)
  const type = searchParams.get('type') ?? 'all'

  if (!q) {
    return NextResponse.json({ invoices: [], quotes: [], clients: [] })
  }

  const userId = session.id
  const num = parseFloat(q)
  const amountFilter = !Number.isNaN(num) && num >= 0
    ? [{ totalTTC: { gte: num - 0.01, lte: num + 0.01 } }]
    : []

  const [invoices, quotes, clients] = await Promise.all([
    type === 'client' ? [] : prisma.invoice.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        OR: [
          { number: { contains: q, mode: 'insensitive' } },
          ...amountFilter,
        ],
      },
      select: { id: true, number: true, status: true, totalTTC: true, issueDate: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
    type === 'client' ? [] : prisma.quote.findMany({
      where: { userId, ...whereNotDeleted, number: { contains: q, mode: 'insensitive' } },
      select: { id: true, number: true, status: true, totalTTC: true, issueDate: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
    type === 'invoice' || type === 'quote' ? [] : prisma.client.findMany({
      where: {
        userId,
        ...whereNotDeleted,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
      take: 20,
    }),
  ])

  return NextResponse.json({
    invoices: type === 'client' ? [] : invoices,
    quotes: type === 'client' ? [] : quotes,
    clients: type === 'invoice' || type === 'quote' ? [] : clients,
  })
}
