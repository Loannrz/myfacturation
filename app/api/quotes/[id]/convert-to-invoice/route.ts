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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: quoteId } = await params
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId: session.id },
    include: { client: true, company: true, lines: true },
  })
  if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
  const nextNum = await getNextInvoiceNumber(session.id)
  const number = formatInvoiceNumber(nextNum)
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
      totalHT: quote.totalHT,
      vatAmount: quote.vatAmount,
      totalTTC: quote.totalTTC,
      tvaNonApplicable: quote.tvaNonApplicable,
      lines: {
        create: quote.lines.map((l) => ({
          type: l.type,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
          discount: l.discount,
          total: l.total,
        })),
      },
    },
    include: { client: true, company: true, lines: true },
  })
  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'signed' },
  })
  await logBillingActivity(session.id, 'quote converted to invoice', 'quote', quoteId, { invoiceId: invoice.id, invoiceNumber: invoice.number })
  await logBillingActivity(session.id, 'invoice created', 'invoice', invoice.id, { number: invoice.number, fromQuote: true })
  return NextResponse.json(invoice)
}
