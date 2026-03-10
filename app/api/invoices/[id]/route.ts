import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { logBillingActivity } from '@/lib/billing-activity'
import { getBillingSettings, parseBankAccounts } from '@/lib/billing-settings'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  // Échéance dépassée → passer en "En retard", sauf si payée ou annulée
  const today = new Date().toISOString().slice(0, 10)
  await prisma.invoice.updateMany({
    where: {
      userId: session.id,
      status: { in: ['sent', 'pending'] },
      dueDate: { lt: today },
    },
    data: { status: 'late' },
  })
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

  const settings = await getBillingSettings(session.id)
  const bankAccounts = parseBankAccounts(typeof settings.bankAccounts === 'string' ? settings.bankAccounts : null)
  if (bankAccounts.length > 0 && !(body.bankAccountId && String(body.bankAccountId).trim())) {
    return NextResponse.json({ error: 'Veuillez sélectionner un compte bancaire pour cette facture.' }, { status: 400 })
  }

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
    bankAccountId: body.bankAccountId ?? undefined,
    emitterProfileId: body.emitterProfileId !== undefined ? (body.emitterProfileId || null) : undefined,
    totalHT: Math.round(totalHT * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalTTC: Math.round((totalHT + vatAmount) * 100) / 100,
    tvaNonApplicable: body.tvaNonApplicable === true,
    lines: { create: lineData },
  }
  if (body.status === 'paid') {
    (updateData as { paidAt: Date }).paidAt = body.paidAt ? new Date(body.paidAt) : new Date()
  } else {
    (updateData as { paidAt: null }).paidAt = null
  }

  const newTotalHT = Math.round(totalHT * 100) / 100
  const newVatAmount = Math.round(vatAmount * 100) / 100
  const newTotalTTC = Math.round((totalHT + vatAmount) * 100) / 100

  const changes: { field: string; oldValue: string | number; newValue: string | number }[] = []
  if (existing.status !== body.status) changes.push({ field: 'Statut', oldValue: existing.status, newValue: body.status ?? '' })
  if (existing.issueDate !== body.issueDate) changes.push({ field: 'Date d\'émission', oldValue: existing.issueDate, newValue: body.issueDate ?? '' })
  if ((existing.dueDate?.toISOString().slice(0, 10) ?? null) !== (body.dueDate ?? null)) changes.push({ field: 'Date d\'échéance', oldValue: existing.dueDate?.toISOString().slice(0, 10) ?? '—', newValue: body.dueDate ?? '—' })
  if (existing.paymentMethod !== (body.paymentMethod ?? null)) changes.push({ field: 'Mode de paiement', oldValue: existing.paymentMethod ?? '—', newValue: body.paymentMethod ?? '—' })
  if (existing.paymentTerms !== (body.paymentTerms ?? null)) changes.push({ field: 'Conditions de paiement', oldValue: existing.paymentTerms ?? '—', newValue: body.paymentTerms ?? '—' })
  if (Number(existing.totalHT) !== newTotalHT) changes.push({ field: 'Total HT', oldValue: Number(existing.totalHT), newValue: newTotalHT })
  if (Number(existing.totalTTC) !== newTotalTTC) changes.push({ field: 'Total TTC', oldValue: Number(existing.totalTTC), newValue: newTotalTTC })
  if (Number(existing.vatAmount) !== newVatAmount) changes.push({ field: 'Montant TVA', oldValue: Number(existing.vatAmount), newValue: newVatAmount })

  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData as Parameters<typeof prisma.invoice.update>[0]['data'],
    include: { client: true, company: true, lines: true },
  })
  if (body.status === 'paid') {
    await logBillingActivity(session.id, 'invoice paid', 'invoice', invoice.id, { number: invoice.number })
  } else {
    await logBillingActivity(session.id, 'invoice updated', 'invoice', invoice.id, { number: invoice.number, changes: changes.length ? changes : undefined })
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
