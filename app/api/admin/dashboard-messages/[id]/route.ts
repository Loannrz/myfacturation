import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const message = await prisma.dashboardMessage.findUnique({ where: { id } })
  if (!message) return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })
  return NextResponse.json(message)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const existing = await prisma.dashboardMessage.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })

  const body = await req.json()
  const data: { icon?: string; title?: string; body?: string; sortOrder?: number } = {}
  if (typeof body.icon === 'string') data.icon = body.icon.trim()
  if (typeof body.title === 'string') data.title = body.title.trim()
  if (typeof body.body === 'string') data.body = body.body.trim()
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder

  const message = await prisma.dashboardMessage.update({
    where: { id },
    data,
  })
  return NextResponse.json(message)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  await prisma.dashboardMessage.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
