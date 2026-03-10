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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: session.id },
    include: { client: true, company: true, lines: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const existing = await prisma.invoice.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

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

  await prisma.invoiceLine.deleteMany({ where: { invoiceId: id } })

  const updateData: Record<string, unknown> = {
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
  }
  if (body.status === 'paid') (updateData as { paidAt: Date }).paidAt = new Date()

  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData as Parameters<typeof prisma.invoice.update>[0]['data'],
    include: { client: true, company: true, lines: true },
  })
  if (body.status === 'paid') {
    await logBillingActivity(session.id, 'invoice paid', 'invoice', invoice.id, { number: invoice.number })
  } else {
    await logBillingActivity(session.id, 'invoice updated', 'invoice', invoice.id)
  }
  return NextResponse.json(invoice)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.invoice.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const newStatus = body.status as string
  const allowed = ['draft', 'sent', 'paid', 'pending', 'late', 'cancelled']
  if (!newStatus || !allowed.includes(newStatus)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }
  const updateData: { status: string; paidAt?: Date | null; paymentMethod?: string | null } = { status: newStatus }
  if (newStatus === 'paid') {
    updateData.paidAt = body.paymentDate ? new Date(body.paymentDate) : new Date()
    if (body.paymentMethod != null) updateData.paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() || null : null
  } else {
    updateData.paidAt = null
  }
  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData,
    include: { client: true, company: true, lines: true },
  })
  if (newStatus === 'paid') {
    await logBillingActivity(session.id, 'invoice paid', 'invoice', invoice.id, { number: invoice.number })
  } else {
    await logBillingActivity(session.id, 'invoice status updated', 'invoice', invoice.id, { status: newStatus })
  }
  return NextResponse.json(invoice)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.invoice.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.invoice.delete({ where: { id } })
  await logBillingActivity(session.id, 'invoice deleted', 'invoice', id)
  return NextResponse.json({ ok: true })
}
