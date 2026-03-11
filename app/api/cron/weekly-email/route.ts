import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWeeklyEmail } from '@/lib/send-transactional-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${CRON_SECRET}`
}

/** Envoie l'email hebdomadaire à tous les utilisateurs ayant un email. Contenu selon plan (starter / pro / business). */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const users = await prisma.user.findMany({
    where: { email: { not: null }, role: 'user' },
    select: { id: true, email: true, name: true, subscriptionPlan: true },
  })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const base = baseUrl.replace(/\/$/, '')
  let sent = 0
  for (const u of users) {
    if (!u.email) continue
    const plan = (u.subscriptionPlan === 'pro' || u.subscriptionPlan === 'business' ? u.subscriptionPlan : 'starter') as 'starter' | 'pro' | 'business'
    const res = await sendWeeklyEmail(u.email, {
      recipientName: u.name,
      plan,
      ctaUrl: plan === 'starter' ? `${base}/formules` : `${base}/dashboard`,
    })
    if (res.ok) sent++
  }
  return NextResponse.json({ ok: true, sent, total: users.length })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
