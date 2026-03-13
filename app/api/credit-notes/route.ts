import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings, getNextCreditNoteNumber, parseBankAccounts, parseEmitterProfiles } from '@/lib/billing-settings'
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
  const clientIdParam = req.nextUrl.searchParams.get('clientId')?.trim() || undefined
  const companyIdParam = req.nextUrl.searchParams.get('companyId')?.trim() || undefined
  const where: { userId: string; deletedAt?: null; clientId?: string; companyId?: string; number?: { contains: string }; status?: string; OR?: Array<Record<string, unknown>> } = { userId: session.id, ...whereNotDeleted }
  if (clientIdParam) where.clientId = clientIdParam
  if (companyIdParam) where.companyId = companyIdParam
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
    if (!(body.invoiceId && String(body.invoiceId).trim())) {
      return NextResponse.json({ error: 'Veuillez sélectionner une facture d\'origine.' }, { status: 400 })
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
    const lineWithEmptyDesc = lines.find((l: { description?: string }) => !(l.description != null && String(l.description).trim() !== ''))
    if (lineWithEmptyDesc) {
      return NextResponse.json({ error: 'Impossible de créer l\'avoir : supprimez les lignes vides (seules les lignes avec une description sont autorisées).' }, { status: 400 })
    }
    const invoice = await prisma.invoice.findFirst({
      where: { id: body.invoiceId.trim(), userId: session.id, ...whereNotDeleted },
    })
    if (!invoice) {
      return NextResponse.json({ error: 'Facture introuvable ou non autorisée' }, { status: 400 })
    }

    const number = body.number ?? (await getNextCreditNoteNumber(session.id))
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

    const creditNote = await prisma.creditNote.create({
      data: {
        userId: session.id,
        number,
        status: body.status ?? 'draft',
        invoiceId: body.invoiceId.trim(),
        clientId: body.clientId || null,
        companyId: body.companyId || null,
        issueDate: body.issueDate ?? new Date().toISOString().slice(0, 10),
        currency: body.currency ?? 'EUR',
        totalHT: Math.round(totalHT * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalTTC: Math.round((totalHT + vatAmount) * 100) / 100,
        tvaNonApplicable: !vatApplicable,
        reason: body.reason?.trim() ?? null,
        dueDate: body.dueDate && String(body.dueDate).trim() ? body.dueDate.trim() : null,
        paymentTerms: body.paymentTerms && String(body.paymentTerms).trim() ? body.paymentTerms.trim() : null,
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
