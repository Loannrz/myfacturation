import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings, getNextQuoteNumber, parseBankAccounts } from '@/lib/billing-settings'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { canCreateDocument, CANNOT_CREATE_MESSAGE } from '@/lib/can-create-document'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined
  const q = (searchParams.get('q') ?? '').trim()
  const where: { userId: string; deletedAt?: null; status?: string; OR?: Array<Record<string, unknown>> } = { userId: session.id, ...whereNotDeleted }
  if (status) where.status = status
  if (q) {
    const orConditions: Array<Record<string, unknown>> = [
      { number: { contains: q, mode: 'insensitive' } },
      { client: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { companyName: { contains: q, mode: 'insensitive' } }] } },
      { lines: { some: { description: { contains: q, mode: 'insensitive' } } } },
    ]
    const amount = parseFloat(q.replace(',', '.'))
    if (!Number.isNaN(amount) && isFinite(amount)) {
      orConditions.push({ totalHT: { gte: amount - 0.01, lte: amount + 0.01 } }, { totalTTC: { gte: amount - 0.01, lte: amount + 0.01 } })
    }
    where.OR = orConditions
  }

  const today = new Date().toISOString().slice(0, 10)
  await prisma.quote.updateMany({
    where: { userId: session.id, ...whereNotDeleted, status: { in: ['draft', 'sent'] }, dueDate: { lt: today } },
    data: { status: 'expired' },
  })

  const quotes = await prisma.quote.findMany({
    where,
    include: { client: true, company: true, lines: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id }, select: { name: true } }),
    getBillingSettings(session.id),
  ])
  if (!user || !canCreateDocument({ name: user.name, ...settings })) {
    return NextResponse.json({ error: CANNOT_CREATE_MESSAGE }, { status: 400 })
  }

  const { getQuotesLimit } = await import('@/lib/plan-features-db')
  const quotesLimit = await getQuotesLimit(session.subscriptionPlan)
  if (quotesLimit != null) {
    const prefix = new Date().toISOString().slice(0, 7)
    const count = await prisma.quote.count({
      where: { userId: session.id, ...whereNotDeleted, issueDate: { startsWith: prefix } },
    })
    if (count >= quotesLimit) {
      return NextResponse.json(
        { error: 'LIMIT_REACHED', message: `Vous avez atteint la limite (${quotesLimit} devis par mois). Passez à Pro pour des devis illimités.` },
        { status: 402 }
      )
    }
  }

  try {
    const body = await req.json()
    const bankAccounts = parseBankAccounts(typeof settings.bankAccounts === 'string' ? settings.bankAccounts : null)
    if (bankAccounts.length > 0 && !(body.bankAccountId && String(body.bankAccountId).trim())) {
      return NextResponse.json({ error: 'Veuillez sélectionner un compte bancaire pour ce devis.' }, { status: 400 })
    }
    const number = body.number ?? (await getNextQuoteNumber(session.id))

    const lines = Array.isArray(body.lines) ? body.lines : []
    let totalHT = 0
    let vatAmount = 0
    const lineData = lines.map((line: { type?: string; description?: string; quantity?: number; unitPrice?: number; vatRate?: number; discount?: number }) => {
      const qty = Number(line.quantity) || 1
      const unit = roundDownTo2Decimals(Number(line.unitPrice) || 0)
      const vatRate = Number(line.vatRate) ?? 20
      const discount = Number(line.discount) ?? 0
      const total = (qty * unit * (1 - discount / 100)) * (1 + vatRate / 100)
      const ht = qty * unit * (1 - discount / 100)
      totalHT += ht
      vatAmount += total - ht
      return {
        type: line.type ?? 'service',
        description: line.description ?? '',
        quantity: qty,
        unitPrice: unit,
        vatRate,
        discount,
        total: Math.round(total * 100) / 100,
      }
    })

    const quote = await prisma.quote.create({
      data: {
        userId: session.id,
        number,
        status: body.status ?? 'draft',
        clientId: body.clientId || null,
        companyId: body.companyId || null,
        issueDate: body.issueDate ?? new Date().toISOString().slice(0, 10),
        dueDate: body.dueDate ?? null,
        currency: body.currency ?? 'EUR',
        paymentTerms: body.paymentTerms ?? null,
        paymentMethod: body.paymentMethod ?? null,
        bankAccountId: body.bankAccountId ?? null,
        emitterProfileId: typeof body.emitterProfileId === 'string' ? body.emitterProfileId : null,
        totalHT: Math.round(totalHT * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalTTC: Math.round((totalHT + vatAmount) * 100) / 100,
        tvaNonApplicable: body.tvaNonApplicable === true,
        lines: { create: lineData },
      },
      include: { client: true, company: true, lines: true },
    })
    await logBillingActivity(session.id, 'quote created', 'quote', quote.id, { number: quote.number })
    return NextResponse.json(quote)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
