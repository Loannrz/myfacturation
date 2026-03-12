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
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { id } = await params
  const existing = await prisma.expense.findFirst({
    where: { id, userId: session.id, deletedAt: { not: null } },
  })
  if (!existing) return NextResponse.json({ error: 'Introuvable ou déjà récupéré' }, { status: 404 })
  await prisma.expense.update({ where: { id }, data: { deletedAt: null } })
  await logBillingActivity(session.id, 'expense restored', 'expense', id, { amount: existing.amount, category: existing.category })
  return NextResponse.json({ ok: true })
}
