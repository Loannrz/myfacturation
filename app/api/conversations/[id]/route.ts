import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Détail d'une discussion + messages. Marque les messages admin comme lus. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!conversation) return NextResponse.json({ error: 'Discussion introuvable' }, { status: 404 })

  await prisma.message.updateMany({
    where: { conversationId: id, senderRole: 'admin', isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({
    ...conversation,
    messages: conversation.messages,
  })
}
