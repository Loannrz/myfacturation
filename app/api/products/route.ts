import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const type = req.nextUrl.searchParams.get('type') ?? undefined
  const where: { userId: string; type?: string; OR?: { name?: { contains: string }; description?: { contains: string } }[] } = { userId: session.id }
  if (type) where.type = type
  if (q) where.OR = [{ name: { contains: q } }, { description: { contains: q } }]
  const products = await prisma.billingProduct.findMany({
    where: Object.keys(where).length ? where : { userId: session.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const body = await req.json()
    const product = await prisma.billingProduct.create({
      data: {
        userId: session.id,
        name: body.name ?? '',
        description: body.description ?? '',
        type: body.type ?? 'service',
        unitPrice: roundDownTo2Decimals(Number(body.unitPrice) ?? 0),
        vatRate: Number(body.vatRate) ?? 20,
        discount: Number(body.discount) ?? 0,
      },
    })
    return NextResponse.json(product)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
