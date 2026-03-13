import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const messages = await prisma.dashboardMessage.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const icon = typeof body.icon === 'string' ? body.icon.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const bodyText = typeof body.body === 'string' ? body.body.trim() : ''

  if (!icon || !title || !bodyText) {
    return NextResponse.json(
      { error: 'Icone, titre et texte sont requis.' },
      { status: 400 }
    )
  }

  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 0

  const message = await prisma.dashboardMessage.create({
    data: { icon, title, body: bodyText, sortOrder },
  })
  return NextResponse.json(message)
}
