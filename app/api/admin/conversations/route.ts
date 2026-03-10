import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Liste toutes les discussions (admin) */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          messages: {
            where: { senderRole: 'user', isRead: false },
          },
        },
      },
    },
  })

  const list = conversations.map((c) => ({
    id: c.id,
    subject: c.subject,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    user: c.user,
    lastMessage: c.messages[0]
      ? { body: c.messages[0].message, senderRole: c.messages[0].senderRole, createdAt: c.messages[0].createdAt }
      : null,
    unreadCount: c._count.messages,
  }))
  return NextResponse.json(list)
}
