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
  const { id } = await params
  const original = await prisma.invoice.findFirst({
    where: { id, userId: session.id },
    include: { lines: true },
  })
  if (!original) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const nextNum = await getNextInvoiceNumber(session.id)
  const number = formatInvoiceNumber(nextNum)
  const invoice = await prisma.invoice.create({
    data: {
      userId: session.id,
      number,
      status: 'draft',
      clientId: original.clientId,
      companyId: original.companyId,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: original.dueDate,
      currency: original.currency,
      paymentTerms: original.paymentTerms,
      paymentMethod: original.paymentMethod,
      totalHT: original.totalHT,
      vatAmount: original.vatAmount,
      totalTTC: original.totalTTC,
      tvaNonApplicable: original.tvaNonApplicable,
      lines: {
        create: original.lines.map((l) => ({
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
  await logBillingActivity(session.id, 'invoice duplicated', 'invoice', invoice.id, { number: invoice.number, fromId: id })
  return NextResponse.json(invoice)
}
