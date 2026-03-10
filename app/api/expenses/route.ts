import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings, parseBankAccounts } from '@/lib/billing-settings'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  const category = req.nextUrl.searchParams.get('category') ?? undefined
  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined
  const bankAccountId = req.nextUrl.searchParams.get('bankAccountId') ?? undefined
  const where: { userId: string; category?: string; bankAccountId?: string | null; date?: { gte?: string; lte?: string } } = { userId: session.id }
  if (category) where.category = category
  if (bankAccountId) where.bankAccountId = bankAccountId
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
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const settings = await getBillingSettings(session.id)
    const bankAccounts = parseBankAccounts(typeof settings.bankAccounts === 'string' ? settings.bankAccounts : null)
    if (bankAccounts.length > 0 && !(body.bankAccountId && String(body.bankAccountId).trim())) {
      return NextResponse.json({ error: 'Veuillez sélectionner un compte bancaire pour enregistrer la dépense.' }, { status: 400 })
    }
    const expense = await prisma.expense.create({
      data: {
        userId: session.id,
        companyId: body.companyId || null,
        bankAccountId: body.bankAccountId || null,
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
