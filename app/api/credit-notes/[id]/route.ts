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
  const creditNote = await prisma.creditNote.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
    include: { client: true, company: true, invoice: true, lines: true },
  })
  if (!creditNote) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(creditNote)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.creditNote.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const body = await req.json()
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
    return NextResponse.json({ error: 'Veuillez sélectionner un compte bancaire pour cet avoir.' }, { status: 400 })
  }
  if (!(body.reason && String(body.reason).trim())) {
    return NextResponse.json({ error: 'Le motif de l\'avoir est obligatoire (Factur-X / EN16931).' }, { status: 400 })
  }
  const hasRecipient = (body.clientId && String(body.clientId).trim()) || (body.companyId && String(body.companyId).trim())
  if (!hasRecipient) {
    return NextResponse.json({ error: 'Un client ou une société destinataire est obligatoire (Factur-X / EN16931).' }, { status: 400 })
  }
  if (emitterProfiles.length > 0 && (!body.emitterProfileId || !String(body.emitterProfileId).trim())) {
    return NextResponse.json({ error: 'Veuillez sélectionner un émetteur (établissement) pour l\'avoir.' }, { status: 400 })
  }
  const lines = Array.isArray(body.lines) ? body.lines : []
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Au moins une ligne est obligatoire pour l\'avoir (Factur-X / EN16931).' }, { status: 400 })
  }
  const lineWithEmptyDescCn = lines.find((l: { description?: string }) => !(l.description != null && String(l.description).trim() !== ''))
  if (lineWithEmptyDescCn) {
    return NextResponse.json({ error: 'Impossible d\'enregistrer l\'avoir : supprimez les lignes vides (seules les lignes avec une description sont autorisées).' }, { status: 400 })
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

  await prisma.creditNoteLine.deleteMany({ where: { creditNoteId: id } })

  const updateData: Record<string, unknown> = {
      clientId: body.clientId ?? undefined,
      companyId: body.companyId ?? undefined,
      invoiceId: body.invoiceId ?? undefined,
      issueDate: body.issueDate ?? existing.issueDate,
      currency: body.currency ?? existing.currency,
      totalHT: Math.round(totalHT * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalTTC: Math.round((totalHT + vatAmount) * 100) / 100,
      tvaNonApplicable: !vatApplicable,
      reason: body.reason?.trim() ?? undefined,
      dueDate: body.dueDate !== undefined ? (body.dueDate && String(body.dueDate).trim() ? body.dueDate.trim() : null) : undefined,
      paymentTerms: body.paymentTerms !== undefined ? (body.paymentTerms && String(body.paymentTerms).trim() ? body.paymentTerms.trim() : null) : undefined,
      emitterProfileId: body.emitterProfileId !== undefined ? (body.emitterProfileId || null) : undefined,
      bankAccountId: body.bankAccountId ?? undefined,
      paymentMethod: body.paymentMethod ?? undefined,
      lines: { create: lineData },
    }
  if (body.status !== undefined) {
    updateData.status = body.status
    updateData.refundedAt = body.status === 'refunded'
      ? (body.refundedAt ? new Date(body.refundedAt) : new Date())
      : null
  }
  const newTotalHT = Math.round(totalHT * 100) / 100
  const newVatAmount = Math.round(vatAmount * 100) / 100
  const newTotalTTC = Math.round((totalHT + vatAmount) * 100) / 100
  const changes: { field: string; oldValue: string | number; newValue: string | number }[] = []
  if (existing.issueDate !== (body.issueDate ?? existing.issueDate)) changes.push({ field: 'Date d\'émission', oldValue: existing.issueDate, newValue: body.issueDate ?? existing.issueDate })
  if (Number(existing.totalHT) !== newTotalHT) changes.push({ field: 'Total HT', oldValue: Number(existing.totalHT), newValue: newTotalHT })
  if (Number(existing.totalTTC) !== newTotalTTC) changes.push({ field: 'Total TTC', oldValue: Number(existing.totalTTC), newValue: newTotalTTC })
  if (body.status !== undefined && existing.status !== body.status) changes.push({ field: 'Statut', oldValue: existing.status, newValue: body.status })
  if ((body.reason ?? existing.reason) !== existing.reason) changes.push({ field: 'Motif', oldValue: existing.reason ?? '—', newValue: body.reason ?? '—' })
  if ((body.paymentMethod ?? existing.paymentMethod) !== existing.paymentMethod) changes.push({ field: 'Mode de paiement', oldValue: existing.paymentMethod ?? '—', newValue: body.paymentMethod ?? '—' })

  const creditNote = await prisma.creditNote.update({
    where: { id },
    data: updateData,
    include: { client: true, company: true, invoice: true, lines: true },
  })
  await logBillingActivity(session.id, 'credit_note updated', 'credit_note', creditNote.id, { number: creditNote.number, changes: changes.length ? changes : undefined })
  return NextResponse.json(creditNote)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.creditNote.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.creditNote.update({ where: { id }, data: { deletedAt: new Date() } })
  await logBillingActivity(session.id, 'credit_note deleted', 'credit_note', id, { number: existing.number })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.creditNote.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const newStatus = body.status as string
  const allowed = ['draft', 'sent', 'refunded', 'cancelled']
  if (!newStatus || !allowed.includes(newStatus)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }
  const data: { status: string; refundedAt?: Date | null } = { status: newStatus }
  if (newStatus === 'refunded') {
    data.refundedAt = body.refundedAt ? new Date(body.refundedAt) : new Date()
  } else {
    data.refundedAt = null
  }
  const creditNote = await prisma.creditNote.update({
    where: { id },
    data,
    include: { client: true, company: true, invoice: true, lines: true },
  })
  await logBillingActivity(session.id, 'credit_note status updated', 'credit_note', creditNote.id, { status: newStatus })
  return NextResponse.json(creditNote)
}
