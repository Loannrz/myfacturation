import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'
import { getNextInvoiceNumber } from '@/lib/billing-settings'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

function formatDateFR(iso: string): string {
  const parts = iso.trim().split(/[-T]/)
  if (parts.length >= 3) {
    const [y, m, d] = parts
    return `${d!.padStart(2, '0')}/${m!.padStart(2, '0')}/${y}`
  }
  return iso
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: quoteId } = await params
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId: session.id, ...whereNotDeleted },
    include: { client: true, company: true, lines: true },
  })
  if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const signedDateStr = (body.signedDate as string) || new Date().toISOString().slice(0, 10)
  const signedAt = new Date(signedDateStr)

  const refLine = `Facture venant du devis ${quote.number} émis le ${formatDateFR(quote.issueDate)} signé le ${formatDateFR(signedDateStr)}`

  const number = await getNextInvoiceNumber(session.id)
  const invoice = await prisma.invoice.create({
    data: {
      userId: session.id,
      number,
      status: 'draft',
      clientId: quote.clientId,
      companyId: quote.companyId,
      quoteId: quote.id,
      issueDate: quote.issueDate,
      dueDate: quote.dueDate,
      currency: quote.currency,
      paymentTerms: quote.paymentTerms,
      paymentMethod: quote.paymentMethod,
      bankAccountId: quote.bankAccountId,
      emitterProfileId: quote.emitterProfileId,
      totalHT: quote.totalHT,
      vatAmount: quote.vatAmount,
      totalTTC: quote.totalTTC,
      tvaNonApplicable: quote.tvaNonApplicable,
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
          ...quote.lines.map((l) => ({
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
    include: { client: true, company: true, lines: true },
  })
  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'signed', signedAt },
  })
  await logBillingActivity(session.id, 'quote converted to invoice', 'quote', quoteId, { invoiceId: invoice.id, invoiceNumber: invoice.number })
  await logBillingActivity(session.id, 'invoice created', 'invoice', invoice.id, { number: invoice.number, fromQuote: true })
  return NextResponse.json(invoice)
}
