import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.creditNote.findFirst({
    where: { id, userId: session.id, deletedAt: { not: null } },
  })
  if (!existing) return NextResponse.json({ error: 'Introuvable ou déjà récupéré' }, { status: 404 })
  await prisma.creditNote.update({ where: { id }, data: { deletedAt: null } })
  await logBillingActivity(session.id, 'credit_note restored', 'credit_note', id, { number: existing.number })
  return NextResponse.json({ ok: true })
}
