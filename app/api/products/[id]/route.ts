import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const product = await prisma.billingProduct.findFirst({
    where: { id, userId: session.id },
  })
  if (!product) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.billingProduct.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const product = await prisma.billingProduct.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      type: body.type ?? existing.type,
      unitPrice: body.unitPrice !== undefined ? roundDownTo2Decimals(Number(body.unitPrice) ?? 0) : existing.unitPrice,
      vatRate: Number(body.vatRate) ?? existing.vatRate,
      discount: Number(body.discount) ?? existing.discount,
    },
  })
  return NextResponse.json(product)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.billingProduct.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.billingProduct.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
