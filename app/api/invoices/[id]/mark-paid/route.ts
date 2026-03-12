import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.invoice.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  let paymentDate: Date = new Date()
  let paymentMethod: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    if (body.paymentDate && typeof body.paymentDate === 'string') {
      const d = new Date(body.paymentDate)
      if (!Number.isNaN(d.getTime())) paymentDate = d
    }
    if (body.paymentMethod != null && typeof body.paymentMethod === 'string') paymentMethod = body.paymentMethod.trim() || null
  } catch {
    // keep defaults
  }
  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status: 'paid', paidAt: paymentDate, paymentMethod: paymentMethod ?? undefined },
    include: { client: true, company: true, lines: true },
  })
  await logBillingActivity(session.id, 'invoice paid', 'invoice', invoice.id, { number: invoice.number })
  return NextResponse.json(invoice)
}
