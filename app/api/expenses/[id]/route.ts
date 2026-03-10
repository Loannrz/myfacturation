import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAccessFeature } from '@/lib/features'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAccessFeature(session.planType as 'free' | 'premium', 'accounting')) {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { id } = await params
  const expense = await prisma.expense.findFirst({
    where: { id, userId: session.id },
  })
  if (!expense) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(expense)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAccessFeature(session.planType as 'free' | 'premium', 'accounting')) {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { id } = await params
  const existing = await prisma.expense.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      date: body.date ?? existing.date,
      amount: Number(body.amount) ?? existing.amount,
      category: body.category ?? existing.category,
      description: body.description ?? undefined,
      supplier: body.supplier ?? undefined,
      invoiceFile: body.invoiceFile ?? undefined,
    },
  })
  return NextResponse.json(expense)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAccessFeature(session.planType as 'free' | 'premium', 'accounting')) {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { id } = await params
  const existing = await prisma.expense.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.expense.delete({ where: { id } })
  await logBillingActivity(session.id, 'expense deleted', 'expense', id)
  return NextResponse.json({ ok: true })
}
