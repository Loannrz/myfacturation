import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

function requireBusiness(session: { subscriptionPlan?: string }) {
  if (session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité réservée au plan Business' }, { status: 403 })
  }
  return null
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const err = requireBusiness(session)
  if (err) return err
  const { id } = await params
  const existing = await prisma.employee.findFirst({
    where: { id, userId: session.id, deletedAt: { not: null } },
  })
  if (!existing) return NextResponse.json({ error: 'Introuvable ou déjà récupéré' }, { status: 404 })
  await prisma.employee.update({ where: { id }, data: { deletedAt: null } })
  await logBillingActivity(session.id, 'employee restored', 'employee', id, { name: `${existing.firstName} ${existing.lastName}` })
  return NextResponse.json({ ok: true })
}
