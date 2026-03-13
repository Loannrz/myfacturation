import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

/** Devis signés dans les 7 derniers jours (pour la notification dashboard). */
export async function GET() {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const quotes = await prisma.quote.findMany({
    where: {
      userId: session.id,
      ...whereNotDeleted,
      status: 'signed',
      signedAt: { gte: since },
    },
    select: { id: true, number: true, signedAt: true },
    orderBy: { signedAt: 'desc' },
  })

  return NextResponse.json(
    quotes.map((q) => ({
      id: q.id,
      number: q.number,
      signedAt: q.signedAt?.toISOString() ?? null,
    }))
  )
}
