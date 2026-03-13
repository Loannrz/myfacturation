import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'
import { getBillingSettings, parseBankAccounts, parseEmitterProfiles } from '@/lib/billing-settings'

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
      ...whereNotDeleted,
      status: { in: ['sent', 'pending'] },
      dueDate: { lt: today },
    },
    data: { status: 'late' },
  })
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
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

  const existing = await prisma.invoice.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const settings = await getBillingSettings(session.id)
  const bankAccounts = parseBankAccounts(typeof settings.bankAccounts === 'string' ? settings.bankAccounts : null)
  const emitterProfiles = parseEmitterProfiles(typeof settings.emitterProfiles === 'string' ? settings.emitterProfiles : null)
  const vatApplicable = (() => {
    if (body.emitterProfileId && emitterProfiles.length > 0) {
      const profile = emitterProfiles.find((p) => p.id === body.emitterProfileId)
      return profile ? !profile.vatExempt : (settings as { vatApplicable?: boolean }).vatApplicable !== false
    }
    return (settings as { vatApplicable?: boolean }).vatApplicable !== false
  })()

  if (bankAccounts.length > 0 && !(body.bankAccountId && String(body.bankAccountId).trim())) {
    return NextResponse.json({ error: 'Veuillez sélectionner un compte bancaire pour cette facture.' }, { status: 400 })
  }
  if (!body.issueDate || typeof body.issueDate !== 'string' || !body.issueDate.trim()) {
    return NextResponse.json({ error: 'La date d\'émission est obligatoire (Factur-X / EN16931).' }, { status: 400 })
  }
  if (!body.dueDate || typeof body.dueDate !== 'string' || !body.dueDate.trim()) {
    return NextResponse.json({ error: 'La date d\'échéance est obligatoire (Factur-X / EN16931).' }, { status: 400 })
  }
  if (!body.paymentMethod || typeof body.paymentMethod !== 'string' || !body.paymentMethod.trim()) {
    return NextResponse.json({ error: 'Le mode de paiement est obligatoire (Factur-X / EN16931).' }, { status: 400 })
  }
  const hasRecipient = (body.clientId && String(body.clientId).trim()) || (body.companyId && String(body.companyId).trim())
  if (!hasRecipient) {
    return NextResponse.json({ error: 'Un client ou une société destinataire est obligatoire (Factur-X / EN16931).' }, { status: 400 })
  }
  if (emitterProfiles.length > 0 && (!body.emitterProfileId || !String(body.emitterProfileId).trim())) {
    return NextResponse.json({ error: 'Veuillez sélectionner un émetteur (établissement) pour la facture.' }, { status: 400 })
  }
  const lines = Array.isArray(body.lines) ? body.lines : []
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Au moins une ligne de facture est obligatoire (Factur-X / EN16931).' }, { status: 400 })
  }

  let totalHT = 0
  let vatAmount = 0
  const lineData = lines.map((line: { type?: string; description?: string; quantity?: number; unitPrice?: number; vatRate?: number; discount?: number }) => {
    const qty = Number(line.quantity) || 1
    const unit = roundDownTo2Decimals(Number(line.unitPrice) || 0)
    const vatRate = vatApplicable ? (Number(line.vatRate) ?? 20) : 0
    const discount = Number(line.discount) ?? 0
    const ht = qty * unit * (1 - discount / 100)
    const total = vatApplicable ? ht * (1 + vatRate / 100) : ht
    totalHT += ht
    vatAmount += vatApplicable ? total - ht : 0
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
    tvaNonApplicable: !vatApplicable,
    note: typeof body.note === 'string' ? (body.note.trim() || null) : undefined,
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

  const dueDateStr = (d: Date | string | null | undefined) =>
    d == null ? null : typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)
  const changes: { field: string; oldValue: string | number; newValue: string | number }[] = []
  if (existing.status !== body.status) changes.push({ field: 'Statut', oldValue: existing.status, newValue: body.status ?? '' })
  if (existing.issueDate !== body.issueDate) changes.push({ field: 'Date d\'émission', oldValue: existing.issueDate, newValue: body.issueDate ?? '' })
  if ((dueDateStr(existing.dueDate) ?? null) !== (body.dueDate ?? null)) changes.push({ field: 'Date d\'échéance', oldValue: dueDateStr(existing.dueDate) ?? '—', newValue: body.dueDate ?? '—' })
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
  const existing = await prisma.invoice.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
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
  const existing = await prisma.invoice.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } })
  await logBillingActivity(session.id, 'invoice deleted', 'invoice', id, { number: existing.number })
  return NextResponse.json({ ok: true })
}
