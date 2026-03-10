import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAccessFeature } from '@/lib/features'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAccessFeature(session.planType as 'free' | 'premium', 'accounting')) {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const category = req.nextUrl.searchParams.get('category') ?? undefined
  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined
  const where: { userId: string; category?: string; date?: { gte?: string; lte?: string } } = { userId: session.id }
  if (category) where.category = category
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = from
    if (to) where.date.lte = to
  }
  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAccessFeature(session.planType as 'free' | 'premium', 'accounting')) {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const expense = await prisma.expense.create({
      data: {
        userId: session.id,
        date: body.date ?? new Date().toISOString().slice(0, 10),
        amount: Number(body.amount) ?? 0,
        category: body.category ?? 'Autre',
        description: body.description ?? undefined,
        supplier: body.supplier ?? undefined,
        invoiceFile: body.invoiceFile ?? undefined,
      },
    })
    await logBillingActivity(session.id, 'expense added', 'expense', expense.id, { amount: expense.amount, category: expense.category })
    return NextResponse.json(expense)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
