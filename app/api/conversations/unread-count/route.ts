import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Nombre de messages non lus pour l'utilisateur (messages envoyés par le support) */
export async function GET() {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const count = await prisma.message.count({
    where: {
      conversation: { userId: session.id },
      senderRole: 'admin',
      isRead: false,
    },
  })
  return NextResponse.json({ count })
}
