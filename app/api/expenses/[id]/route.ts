import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { id } = await params
  const expense = await prisma.expense.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
    include: {
      company: { select: { id: true, name: true } },
      client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
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
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { id } = await params
  const existing = await prisma.expense.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const isSalaires = (body.category ?? existing.category) === 'Salaires'
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      companyId: body.companyId !== undefined ? (isSalaires ? null : (body.companyId || null)) : undefined,
      clientId: body.clientId !== undefined ? (isSalaires ? null : (body.clientId || null)) : undefined,
      employeeId: body.employeeId !== undefined ? (body.employeeId || null) : undefined,
      bankAccountId: body.bankAccountId !== undefined ? (body.bankAccountId || null) : undefined,
      date: body.date ?? existing.date,
      amount: Number(body.amount) ?? existing.amount,
      category: body.category ?? existing.category,
      description: body.description ?? undefined,
      supplier: body.supplier ?? undefined,
      invoiceFile: body.invoiceFile ?? undefined,
    },
  })
  await logBillingActivity(session.id, 'expense updated', 'expense', expense.id, { amount: expense.amount, category: expense.category })
  return NextResponse.json(expense)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const { id } = await params
  const existing = await prisma.expense.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } })
  await logBillingActivity(session.id, 'expense deleted', 'expense', id, { amount: existing.amount, category: existing.category })
  return NextResponse.json({ ok: true })
}
