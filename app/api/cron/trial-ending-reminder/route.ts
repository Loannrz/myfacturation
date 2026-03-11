import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTrialEndingEmail } from '@/lib/send-transactional-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${CRON_SECRET}`
}

/** Envoie l'email "24h avant fin d'essai" aux utilisateurs dont subscriptionEnd est dans les 24 prochaines heures. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const users = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'trialing',
      subscriptionEnd: { gte: now, lte: in24h },
      email: { not: null },
    },
    select: { id: true, email: true, name: true, subscriptionPlan: true, subscriptionEnd: true },
  })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const base = baseUrl.replace(/\/$/, '')
  let sent = 0
  for (const u of users) {
    if (!u.email) continue
    const trialEndStr = u.subscriptionEnd
      ? u.subscriptionEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    const planLabel = u.subscriptionPlan === 'business' ? 'Business' : 'Pro'
    const amount = u.subscriptionPlan === 'business' ? '12 €' : '5 €'
    const res = await sendTrialEndingEmail(u.email, {
      recipientName: u.name,
      trialEndDate: trialEndStr,
      amountToCharge: amount,
      planLabel,
      continueUrl: `${base}/formules`,
      cancelUrl: `${base}/parametres`,
    })
    if (res.ok) sent++
  }
  return NextResponse.json({ ok: true, sent, total: users.length })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
