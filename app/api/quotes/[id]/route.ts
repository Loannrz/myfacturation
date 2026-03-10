import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { logBillingActivity } from '@/lib/billing-activity'
import { getBillingSettings, getNextInvoiceNumber, parseBankAccounts } from '@/lib/billing-settings'

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
  const settings = await getBillingSettings(session.id)
  const bankAccounts = parseBankAccounts(typeof settings.bankAccounts === 'string' ? settings.bankAccounts : null)
  if (bankAccounts.length > 0 && !(body.bankAccountId && String(body.bankAccountId).trim())) {
    return NextResponse.json({ error: 'Veuillez sélectionner un compte bancaire pour ce devis.' }, { status: 400 })
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
  await prisma.quoteLine.deleteMany({ where: { quoteId: id } })
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
      bankAccountId: body.bankAccountId ?? undefined,
      emitterProfileId: body.emitterProfileId !== undefined ? (body.emitterProfileId || null) : undefined,
      totalHT: newTotalHT,
      vatAmount: newVatAmount,
      totalTTC: newTotalTTC,
      tvaNonApplicable: body.tvaNonApplicable === true,
      lines: { create: lineData },
    },
    include: { client: true, company: true, lines: true },
  })
  await logBillingActivity(session.id, 'quote updated', 'quote', quote.id, { number: quote.number, changes: changes.length ? changes : undefined })
  return NextResponse.json(quote)
}

function formatDateFR(iso: string): string {
  const parts = iso.trim().split(/[-T]/)
  if (parts.length >= 3) {
    const [y, m, d] = parts
    return `${d!.padStart(2, '0')}/${m!.padStart(2, '0')}/${y}`
  }
  return iso
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.quote.findFirst({
    where: { id, userId: session.id },
    include: { client: true, company: true, lines: true },
  })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const newStatus = body.status as string
  const allowed = ['draft', 'sent', 'signed', 'expired']
  if (!newStatus || !allowed.includes(newStatus)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }
  const data: { status: string; signedAt?: Date | null } = { status: newStatus }
  let createdInvoice: { id: string; number: string } | null = null
  if (newStatus === 'signed') {
    data.signedAt = body.signedDate ? new Date(body.signedDate) : existing.signedAt ?? new Date()
    const signedDateStr = data.signedAt.toISOString().slice(0, 10)
    const existingInvoice = await prisma.invoice.findFirst({
      where: { quoteId: id, userId: session.id },
    })
    if (!existingInvoice) {
      const refLine = `Facture venant du devis ${existing.number} émis le ${formatDateFR(existing.issueDate)} signé le ${formatDateFR(signedDateStr)}`
      const number = await getNextInvoiceNumber(session.id)
      const invoice = await prisma.invoice.create({
        data: {
          userId: session.id,
          number,
          status: 'draft',
          clientId: existing.clientId,
          companyId: existing.companyId,
          quoteId: existing.id,
          issueDate: existing.issueDate,
          dueDate: existing.dueDate,
          currency: existing.currency,
          paymentTerms: existing.paymentTerms,
          paymentMethod: existing.paymentMethod,
          bankAccountId: existing.bankAccountId,
          emitterProfileId: existing.emitterProfileId,
          totalHT: existing.totalHT,
          vatAmount: existing.vatAmount,
          totalTTC: existing.totalTTC,
          tvaNonApplicable: existing.tvaNonApplicable,
          lines: {
            create: [
              {
                type: 'service',
                description: refLine,
                quantity: 1,
                unitPrice: 0,
                vatRate: 0,
                discount: 0,
                total: 0,
              },
              ...existing.lines.map((l) => ({
                type: l.type,
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                vatRate: l.vatRate,
                discount: l.discount,
                total: l.total,
              })),
            ],
          },
        },
      })
      createdInvoice = { id: invoice.id, number: invoice.number }
      await logBillingActivity(session.id, 'invoice created', 'invoice', invoice.id, { number: invoice.number, fromQuote: true })
    }
  } else {
    data.signedAt = null
  }
  const quote = await prisma.quote.update({
    where: { id },
    data,
    include: { client: true, company: true, lines: true },
  })
  await logBillingActivity(session.id, 'quote status updated', 'quote', quote.id, { status: newStatus })
  return NextResponse.json({ ...quote, createdInvoice: createdInvoice ?? undefined })
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
