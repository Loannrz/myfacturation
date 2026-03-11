import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [
    totalUsers,
    usersActiveToday,
    newUsersThisMonth,
    trialUsers,
    activeSubscriptions,
    planCounts,
    plans,
    usersByDay,
    usersByMonth,
    systemEvents,
    activityLogs,
    productStats,
    emailLogs,
    failedPaymentsCount,
    recentPaymentEvents,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'user' } }),
    prisma.user.count({
      where: { role: 'user', updatedAt: { gte: todayStart } },
    }),
    prisma.user.count({
      where: { role: 'user', createdAt: { gte: thisMonthStart } },
    }),
    prisma.user.count({
      where: { role: 'user', subscriptionStatus: 'trialing' },
    }),
    prisma.user.count({
      where: {
        role: 'user',
        subscriptionPlan: { in: ['pro', 'business'] },
        subscriptionStatus: { in: ['active', 'trialing'] },
      },
    }),
    prisma.user.groupBy({
      by: ['subscriptionPlan'],
      where: { role: 'user' },
      _count: true,
    }),
    prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.user
      .findMany({
        where: { role: 'user', createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        select: { createdAt: true },
      })
      .then((users) => {
        const byDay: Record<string, number> = {}
        for (let i = 0; i < 30; i++) {
          const d = new Date(now)
          d.setDate(d.getDate() - (29 - i))
          byDay[d.toISOString().slice(0, 10)] = 0
        }
        users.forEach((u) => {
          const day = u.createdAt.toISOString().slice(0, 10)
          if (byDay[day] !== undefined) byDay[day]++
        })
        return Object.entries(byDay)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([day, count]) => ({ day, count }))
      }),
    prisma.user
      .findMany({ where: { role: 'user' }, select: { createdAt: true } })
      .then((users) => {
        const byMonth: Record<string, number> = {}
        users.forEach((u) => {
          const month = u.createdAt.toISOString().slice(0, 7)
          byMonth[month] = (byMonth[month] ?? 0) + 1
        })
        return Object.entries(byMonth)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, count]) => ({ month, count }))
      }),
    prisma.systemEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: { user: { select: { email: true, name: true } } },
    }),
    (async () => {
      const [invoicesTotal, quotesTotal, clientsTotal, invoicesSentToday, invoicesThisMonth] = await Promise.all([
        prisma.invoice.count(),
        prisma.quote.count(),
        prisma.client.count(),
        prisma.invoice.count({
          where: { status: { in: ['sent', 'paid'] }, updatedAt: { gte: todayStart } },
        }),
        prisma.invoice.count({
          where: { createdAt: { gte: thisMonthStart } },
        }),
      ])
      const quotesThisMonth = await prisma.quote.count({
        where: { createdAt: { gte: thisMonthStart } },
      })
      return {
        invoicesTotal,
        quotesTotal,
        clientsTotal,
        invoicesSentToday,
        documentsThisMonth: invoicesThisMonth + quotesThisMonth,
      }
    })(),
    prisma.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.systemEvent.count({
      where: { eventType: 'payment_failed' },
    }),
    prisma.systemEvent.findMany({
      where: { eventType: { in: ['payment_success', 'payment_failed'] } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const revenueByPlan: Record<string, { monthly: number; yearly: number }> = {}
  plans.forEach((p) => {
    revenueByPlan[p.key] = { monthly: p.priceMonthly, yearly: p.priceYearly }
  })
  const proCount = planCounts.find((c) => c.subscriptionPlan === 'pro')?._count ?? 0
  const businessCount = planCounts.find((c) => c.subscriptionPlan === 'business')?._count ?? 0
  const starterCount = planCounts.find((c) => c.subscriptionPlan === 'starter')?._count ?? 0
  const mrr =
    proCount * (revenueByPlan.pro?.monthly ?? 0) + businessCount * (revenueByPlan.business?.monthly ?? 0)
  const cancellationsCount = await prisma.user.count({
    where: { role: 'user', subscriptionStatus: 'cancelled' },
  })
  const paymentSuccessCount = await prisma.systemEvent.count({
    where: { eventType: 'payment_success' },
  })
  const hasUsedTrialCount = await prisma.user.count({
    where: { role: 'user', hasUsedTrial: true },
  })
  const trialConversionRate =
    hasUsedTrialCount > 0
      ? Math.round((activeSubscriptions / Math.max(hasUsedTrialCount, 1)) * 100)
      : 0

  const newUsersLastMonth = await prisma.user.count({
    where: { role: 'user', createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
  })
  const userGrowth =
    newUsersLastMonth > 0
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : newUsersThisMonth > 0 ? 100 : 0
  const churnRate =
    totalUsers > 0 ? Math.round((cancellationsCount / totalUsers) * 100) : 0

  const recentActivity = [
    ...systemEvents.map((e) => ({
      date: e.createdAt.toISOString(),
      type: 'system',
      eventType: e.eventType,
      userId: e.userId,
      metadata: e.metadata,
      userEmail: null as string | null,
      userName: null as string | null,
    })),
    ...activityLogs.map((l) => ({
      date: l.createdAt.toISOString(),
      type: 'activity',
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      userEmail: l.user?.email ?? null,
      userName: l.user?.name ?? null,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50)

  const planDistribution = [
    { name: 'Starter', value: starterCount, color: '#94a3b8' },
    { name: 'Pro', value: proCount, color: '#8b5cf6' },
    { name: 'Business', value: businessCount, color: '#f59e0b' },
  ]

  const alerts: { type: string; message: string; count?: number }[] = []
  if (failedPaymentsCount > 0) alerts.push({ type: 'payment_failed', message: 'Paiements échoués', count: failedPaymentsCount })
  if (churnRate >= 10) alerts.push({ type: 'churn', message: 'Churn élevé', count: churnRate })
  if (newUsersThisMonth > 20 && newUsersLastMonth < 10) alerts.push({ type: 'signup_spike', message: 'Pic d\'inscriptions' })

  const paymentEventsWithUser = await Promise.all(
    recentPaymentEvents.map(async (e) => {
      let userEmail: string | null = null
      let userName: string | null = null
      if (e.userId) {
        const u = await prisma.user.findUnique({
          where: { id: e.userId },
          select: { email: true, name: true },
        })
        userEmail = u?.email ?? null
        userName = u?.name ?? null
      }
      let amount: number | null = null
      try {
        if (e.metadata) {
          const m = JSON.parse(e.metadata) as { amount?: number }
          amount = m.amount ?? null
        }
      } catch {}
      return {
        id: e.id,
        eventType: e.eventType,
        userId: e.userId,
        userEmail,
        userName,
        amount: amount != null ? amount / 100 : null,
        createdAt: e.createdAt.toISOString(),
      }
    })
  )

  return NextResponse.json({
    mainStats: {
      totalUsers,
      activeUsersToday: usersActiveToday,
      newUsersThisMonth,
      trialUsers,
      activeSubscriptions,
      mrr,
      totalRevenue: mrr,
      successfulPayments: paymentSuccessCount,
      cancellations: cancellationsCount,
      trialConversionRate,
    },
    charts: {
      signupsByDay: usersByDay,
      usersByMonth,
      planDistribution,
      paymentSuccessCount,
      paymentFailedCount: failedPaymentsCount,
    },
    recentActivity,
    productStats,
    emailLogs: emailLogs.map((e) => ({
      id: e.id,
      emailType: e.emailType,
      recipient: e.recipient,
      subject: e.subject,
      bodyPreview: e.bodyPreview ?? undefined,
      bodyFull: e.bodyFull ?? undefined,
      userId: e.userId ?? undefined,
      createdAt: e.createdAt.toISOString(),
    })),
    alerts,
    report: {
      mrr,
      userGrowth,
      churnRate,
      revenueGrowth: userGrowth,
    },
    recentPayments: paymentEventsWithUser,
  })
}
