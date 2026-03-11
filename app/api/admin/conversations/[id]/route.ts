import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Détail d'une discussion (admin). Marque les messages user comme lus. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!conversation) return NextResponse.json({ error: 'Discussion introuvable' }, { status: 404 })

  await prisma.$transaction([
    prisma.message.updateMany({
      where: { conversationId: id, senderRole: 'user', isRead: false },
      data: { isRead: true },
    }),
    prisma.conversation.update({
      where: { id },
      data: { adminLastOpenedAt: new Date() },
    }),
  ])

  const updated = await prisma.conversation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  return NextResponse.json(updated)
}

/** Admin : répondre ou mettre à jour le statut */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation) return NextResponse.json({ error: 'Discussion introuvable' }, { status: 404 })

  const body = await req.json()
  const message = (body.message as string)?.trim()
  if (message) {
    await prisma.message.updateMany({
      where: { conversationId: id, senderRole: 'user', isRead: false },
      data: { isRead: true },
    })
    const created = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: admin.id,
        senderRole: 'admin',
        message,
        isRead: false,
      },
    })
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    })
    return NextResponse.json(created)
  }
  return NextResponse.json({ error: 'Message requis' }, { status: 400 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const status = body.status === 'resolved' || body.status === 'open' ? body.status : undefined
  if (!status) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })

  const conversation = await prisma.conversation.update({
    where: { id },
    data: { status },
  })
  return NextResponse.json(conversation)
}
