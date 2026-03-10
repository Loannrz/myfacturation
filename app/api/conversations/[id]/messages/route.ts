import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Envoyer un message (utilisateur) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session.id },
  })
  if (!conversation) return NextResponse.json({ error: 'Discussion introuvable' }, { status: 404 })
  if (conversation.status === 'resolved') {
    return NextResponse.json({ error: 'Cette discussion est résolue' }, { status: 400 })
  }

  const body = await req.json()
  const message = (body.message as string)?.trim()
  if (!message) return NextResponse.json({ error: 'Message requis' }, { status: 400 })

  const created = await prisma.message.create({
    data: {
      conversationId: id,
      senderId: session.id,
      senderRole: 'user',
      message,
      isRead: true,
    },
  })
  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  })
  return NextResponse.json(created)
}
