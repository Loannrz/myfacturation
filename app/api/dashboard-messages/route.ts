import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Retourne les messages actifs à afficher sur le dashboard utilisateur (pas d’auth requise pour cette route). */
export async function GET() {
  const messages = await prisma.dashboardMessage.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, icon: true, title: true, body: true },
  })
  return NextResponse.json(messages)
}
