import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings, getNextInvoiceNumber, parseBankAccounts, parseEmitterProfiles } from '@/lib/billing-settings'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { canCreateDocument, CANNOT_CREATE_MESSAGE } from '@/lib/can-create-document'

export const dynamic = 'force-dynamic'


/** Retourne le nombre de jours de retard (0+ si échéance dépassée), ou null si pas en retard. */
function getOverdueDays(dueDate: string | null, today: string): number | null {
  if (!dueDate || dueDate >= today) return null
  const due = new Date(dueDate)
  const t = new Date(today)
  const diffMs = t.getTime() - due.getTime()
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  return days >= 0 ? days : null
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined
  const filter = searchParams.get('filter') ?? undefined // all | paid | unpaid | overdue
  const q = (searchParams.get('q') ?? '').trim()
  const clientIdParam = searchParams.get('clientId')?.trim() || undefined
  const companyIdParam = searchParams.get('companyId')?.trim() || undefined
  const where: {
    userId: string
    clientId?: string
    companyId?: string
    status?: string | { not?: string; in?: string[] }
    dueDate?: { lt: string; not: null }
    OR?: Array<Record<string, unknown>>
  } = { userId: session.id, ...whereNotDeleted }
  if (clientIdParam) where.clientId = clientIdParam
  if (companyIdParam) where.companyId = companyIdParam
  if (status) where.status = status
  else if (filter === 'paid') where.status = 'paid'
  else if (filter === 'unpaid') where.status = { in: ['draft', 'sent', 'pending', 'late'] }
  else if (filter === 'overdue') {
    const todayStr = new Date().toISOString().slice(0, 10)
    where.status = { not: 'paid' }
    where.dueDate = { lt: todayStr, not: null }
  }
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

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true, company: true, lines: true },
    orderBy: { createdAt: 'desc' },
  })

  const withOverdue = invoices.map((inv) => {
    const overdueDays = getOverdueDays(inv.dueDate, today)
    return { ...inv, overdueDays: overdueDays ?? undefined }
  })
  return NextResponse.json(withOverdue)
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

  const { getInvoicesLimit } = await import('@/lib/plan-features-db')
  const invoicesLimit = await getInvoicesLimit(session.subscriptionPlan)
  if (invoicesLimit != null) {
    const prefix = new Date().toISOString().slice(0, 7)
    const count = await prisma.invoice.count({
      where: { userId: session.id, issueDate: { startsWith: prefix } },
    })
    if (count >= invoicesLimit) {
      return NextResponse.json(
        { error: 'LIMIT_REACHED', message: `Vous avez atteint la limite (${invoicesLimit} factures par mois). Passez à Pro pour des factures illimitées.` },
        { status: 402 }
      )
    }
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
    const lineWithEmptyDesc = lines.find((l: { description?: string }) => !(l.description != null && String(l.description).trim() !== ''))
    if (lineWithEmptyDesc) {
      return NextResponse.json({ error: 'Impossible de créer la facture : supprimez les lignes vides (seules les lignes avec une description sont autorisées).' }, { status: 400 })
    }

    const number = body.number ?? (await getNextInvoiceNumber(session.id))
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
        bankAccountId: body.bankAccountId ?? null,
        emitterProfileId: typeof body.emitterProfileId === 'string' ? body.emitterProfileId : null,
        totalHT: Math.round(totalHT * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalTTC: Math.round((totalHT + vatAmount) * 100) / 100,
        tvaNonApplicable: !vatApplicable,
        note: typeof body.note === 'string' ? (body.note.trim() || null) : null,
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
