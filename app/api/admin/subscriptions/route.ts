import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'user' },
      select: {
        id: true,
        name: true,
        email: true,
        subscriptionPlan: true,
        billingCycle: true,
        subscriptionStatus: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        createdAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: { role: 'user' } }),
  ])

  return NextResponse.json({
    subscriptions: users.map((u) => ({
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      plan: u.subscriptionPlan,
      cycle: u.billingCycle ?? 'monthly',
      status: u.subscriptionStatus ?? 'active',
      startDate: u.subscriptionStart,
      endDate: u.subscriptionEnd,
      createdAt: u.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const userId = body.userId as string
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  const user = await prisma.user.findFirst({ where: { id: userId, role: 'user' } })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const data: { subscriptionPlan?: string; billingCycle?: string; subscriptionStatus?: string; planType?: string } = {}
  if (body.plan && ['starter', 'pro', 'business'].includes(body.plan)) {
    data.subscriptionPlan = body.plan
    data.planType = body.plan === 'starter' ? 'free' : 'premium'
  }
  if (body.cycle && ['monthly', 'yearly'].includes(body.cycle)) data.billingCycle = body.cycle
  if (body.status !== undefined) data.subscriptionStatus = body.status

  await prisma.user.update({
    where: { id: userId },
    data,
  })

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionPlan: true, billingCycle: true, subscriptionStatus: true },
  })
  return NextResponse.json(updated)
}
