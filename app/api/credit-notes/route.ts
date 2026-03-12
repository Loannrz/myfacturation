import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings, getNextCreditNoteNumber, parseBankAccounts } from '@/lib/billing-settings'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { canCreateDocument, CANNOT_CREATE_MESSAGE } from '@/lib/can-create-document'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const where: { userId: string; deletedAt?: null; number?: { contains: string }; status?: string; OR?: Array<Record<string, unknown>> } = { userId: session.id, ...whereNotDeleted }
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

  const creditNotes = await prisma.creditNote.findMany({
    where,
    include: { client: true, company: true, invoice: true, lines: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(creditNotes)
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

  try {
    const body = await req.json()
    const bankAccounts = parseBankAccounts(typeof settings.bankAccounts === 'string' ? settings.bankAccounts : null)
    if (bankAccounts.length > 0 && !(body.bankAccountId && String(body.bankAccountId).trim())) {
      return NextResponse.json({ error: 'Veuillez sélectionner un compte bancaire pour cet avoir.' }, { status: 400 })
    }
    if (body.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: body.invoiceId, userId: session.id, ...whereNotDeleted },
      })
      if (!invoice) {
        return NextResponse.json({ error: 'Facture introuvable ou non autorisée' }, { status: 400 })
      }
    }

    const number = body.number ?? (await getNextCreditNoteNumber(session.id))

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

    const creditNote = await prisma.creditNote.create({
      data: {
        userId: session.id,
        number,
        status: body.status ?? 'draft',
        invoiceId: body.invoiceId || null,
        clientId: body.clientId || null,
        companyId: body.companyId || null,
        issueDate: body.issueDate ?? new Date().toISOString().slice(0, 10),
        currency: body.currency ?? 'EUR',
        totalHT: Math.round(totalHT * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalTTC: Math.round((totalHT + vatAmount) * 100) / 100,
        tvaNonApplicable: body.tvaNonApplicable === true,
        reason: body.reason ?? null,
        refundedAt: body.refundedAt ? new Date(body.refundedAt) : null,
        emitterProfileId: typeof body.emitterProfileId === 'string' ? body.emitterProfileId : null,
        bankAccountId: body.bankAccountId ?? null,
        paymentMethod: body.paymentMethod ?? null,
        lines: { create: lineData },
      },
      include: { client: true, company: true, invoice: true, lines: true },
    })
    await logBillingActivity(session.id, 'credit_note created', 'credit_note', creditNote.id, { number: creditNote.number })
    return NextResponse.json(creditNote)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
