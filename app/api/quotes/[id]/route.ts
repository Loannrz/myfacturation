import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const quote = await prisma.quote.findFirst({
    where: { id, userId: session.id },
    include: { client: true, company: true, lines: true },
  })
  if (!quote) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(quote)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.quote.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
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
  await prisma.quoteLine.deleteMany({ where: { quoteId: id } })
  const quote = await prisma.quote.update({
    where: { id },
    data: {
      status: body.status,
      clientId: body.clientId ?? undefined,
      companyId: body.companyId ?? undefined,
      issueDate: body.issueDate,
      dueDate: body.dueDate ?? undefined,
      currency: body.currency ?? 'EUR',
      paymentTerms: body.paymentTerms ?? undefined,
      paymentMethod: body.paymentMethod ?? undefined,
      totalHT: Math.round(totalHT * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalTTC: Math.round((totalHT + vatAmount) * 100) / 100,
      tvaNonApplicable: body.tvaNonApplicable === true,
      lines: { create: lineData },
    },
    include: { client: true, company: true, lines: true },
  })
  await logBillingActivity(session.id, 'quote updated', 'quote', quote.id)
  return NextResponse.json(quote)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.quote.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const newStatus = body.status as string
  const allowed = ['draft', 'sent', 'signed', 'expired']
  if (!newStatus || !allowed.includes(newStatus)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }
  const quote = await prisma.quote.update({
    where: { id },
    data: { status: newStatus },
    include: { client: true, company: true, lines: true },
  })
  await logBillingActivity(session.id, 'quote status updated', 'quote', quote.id, { status: newStatus })
  return NextResponse.json(quote)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.quote.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.quote.delete({ where: { id } })
  await logBillingActivity(session.id, 'quote deleted', 'quote', id)
  return NextResponse.json({ ok: true })
}
