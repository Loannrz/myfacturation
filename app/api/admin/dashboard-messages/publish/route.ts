import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_ACTIVE = 10

/** Met en ligne les messages sélectionnés (0 à 10). activeIds = ids des messages à afficher sur le dashboard. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const raw = body.activeIds
  const activeIds = Array.isArray(raw)
    ? (raw as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, MAX_ACTIVE)
    : []

  if (activeIds.length > MAX_ACTIVE) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ACTIVE} messages actifs.` },
      { status: 400 }
    )
  }

  await prisma.$transaction([
    prisma.dashboardMessage.updateMany({
      where: { id: { in: activeIds } },
      data: { isActive: true },
    }),
    prisma.dashboardMessage.updateMany({
      where: { id: { notIn: activeIds } },
      data: { isActive: false },
    }),
  ])

  const messages = await prisma.dashboardMessage.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(messages)
}
