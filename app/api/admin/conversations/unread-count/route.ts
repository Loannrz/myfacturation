import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Nombre de messages non lus pour l'admin (messages envoyés par les utilisateurs) */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const count = await prisma.message.count({
    where: {
      senderRole: 'user',
      isRead: false,
    },
  })
  return NextResponse.json({ count })
}
