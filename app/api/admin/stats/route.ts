import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const [allUsers, starterCount, proCount, businessCount, planCounts] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'user' },
      select: { createdAt: true },
    }),
    prisma.user.count({ where: { subscriptionPlan: 'starter', role: 'user' } }),
    prisma.user.count({ where: { subscriptionPlan: 'pro', role: 'user' } }),
    prisma.user.count({ where: { subscriptionPlan: 'business', role: 'user' } }),
    prisma.user.groupBy({
      by: ['subscriptionPlan'],
      where: { role: 'user' },
      _count: true,
    }),
  ])

  const totalUsers = allUsers.length
  const monthMap = new Map<string, number>()
  for (const u of allUsers) {
    const month = u.createdAt.toISOString().slice(0, 7)
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1)
  }
  const usersByMonth = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }))

  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } })
  const revenueByPlan = plans.reduce((acc, p) => {
    acc[p.key] = { monthly: p.priceMonthly, yearly: p.priceYearly }
    return acc
  }, {} as Record<string, { monthly: number; yearly: number }>)

  const proRevenue = (planCounts.find((c) => c.subscriptionPlan === 'pro')?._count ?? 0) * (revenueByPlan.pro?.monthly ?? 5)
  const businessRevenue = (planCounts.find((c) => c.subscriptionPlan === 'business')?._count ?? 0) * (revenueByPlan.business?.monthly ?? 12)
  const revenueMonthly = proRevenue + businessRevenue

  return NextResponse.json({
    totalUsers,
    activeUsers: totalUsers,
    starterCount,
    proCount,
    businessCount,
    revenueMonthly,
    usersByMonth,
    planCounts: planCounts.map((c) => ({ plan: c.subscriptionPlan, count: c._count })),
  })
}
