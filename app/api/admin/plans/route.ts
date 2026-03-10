import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json(plans)
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const key = body.key as string
  if (!key || !['starter', 'pro', 'business'].includes(key)) {
    return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
  }

  const data: { name?: string; priceMonthly?: number; priceYearly?: number; description?: string; enabled?: boolean } = {}
  if (body.name !== undefined) data.name = String(body.name)
  if (typeof body.priceMonthly === 'number') data.priceMonthly = body.priceMonthly
  if (typeof body.priceYearly === 'number') data.priceYearly = body.priceYearly
  if (body.description !== undefined) data.description = body.description
  if (typeof body.enabled === 'boolean') data.enabled = body.enabled

  const plan = await prisma.plan.update({
    where: { key },
    data,
  })
  return NextResponse.json(plan)
}
