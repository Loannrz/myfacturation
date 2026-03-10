import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Liste des discussions de l'utilisateur avec dernier message et nombre de non lus */
export async function GET() {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          messages: {
            where: { senderRole: 'admin', isRead: false },
          },
        },
      },
    },
  })

  const list = conversations.map((c) => {
    const last = c.messages[0]
    return {
      id: c.id,
      subject: c.subject,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastMessage: last ? { body: last.message, senderRole: last.senderRole, createdAt: last.createdAt } : null,
      unreadCount: c._count.messages,
    }
  })
  return NextResponse.json(list)
}

/** Créer une discussion avec le premier message */
export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const subject = (body.subject as string)?.trim()
  const message = (body.message as string)?.trim()
  if (!subject || !message) {
    return NextResponse.json({ error: 'Objet et message requis' }, { status: 400 })
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId: session.id,
      subject,
      status: 'open',
      messages: {
        create: {
          senderId: session.id,
          senderRole: 'user',
          message,
          isRead: true,
        },
      },
    },
    include: {
      messages: true,
    },
  })
  return NextResponse.json(conversation)
}
