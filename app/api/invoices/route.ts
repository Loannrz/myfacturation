import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getNextInvoiceNumber } from '@/lib/billing-settings'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

function formatInvoiceNumber(n: number) {
  const y = new Date().getFullYear()
  return `F-${y}-${String(n).padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined
  const q = searchParams.get('q') ?? ''
  const where: { userId: string; status?: string; number?: { contains: string } } = { userId: session.id }
  if (status) where.status = status
  if (q.trim()) where.number = { contains: q.trim() }

  const today = new Date().toISOString().slice(0, 10)
  await prisma.invoice.updateMany({
    where: { userId: session.id, status: { in: ['sent', 'pending'] }, dueDate: { lt: today } },
    data: { status: 'late' },
  })

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true, company: true, lines: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const body = await req.json()
    const nextNum = await getNextInvoiceNumber(session.id)
    const number = body.number ?? formatInvoiceNumber(nextNum)

    const lines = Array.isArray(body.lines) ? body.lines : []
    let totalHT = 0
    let vatAmount = 0
    const lineData = lines.map((line: { type?: string; description?: string; quantity?: number; unitPrice?: number; vatRate?: number; discount?: number }) => {
      const qty = Number(line.quantity) || 1
      const unit = Number(line.unitPrice) || 0
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

    const invoice = await prisma.invoice.create({
      data: {
        userId: session.id,
        number,
        status: body.status ?? 'draft',
        clientId: body.clientId || null,
        companyId: body.companyId || null,
        quoteId: body.quoteId || null,
        issueDate: body.issueDate ?? new Date().toISOString().slice(0, 10),
        dueDate: body.dueDate ?? null,
        currency: body.currency ?? 'EUR',
        paymentTerms: body.paymentTerms ?? null,
        paymentMethod: body.paymentMethod ?? null,
        totalHT: Math.round(totalHT * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalTTC: Math.round((totalHT + vatAmount) * 100) / 100,
        tvaNonApplicable: body.tvaNonApplicable === true,
        lines: { create: lineData },
      },
      include: { client: true, company: true, lines: true },
    })
    await logBillingActivity(session.id, 'invoice created', 'invoice', invoice.id, { number: invoice.number })
    return NextResponse.json(invoice)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
