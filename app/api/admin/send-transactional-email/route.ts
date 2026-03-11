import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  sendWelcomeEmail,
  sendTrialStartEmail,
  sendTrialEndingEmail,
  sendPaymentSuccessEmail,
  sendCancellationEmail,
  sendWeeklyEmail,
  TRANSACTIONAL_EMAIL_TYPES,
  type TransactionalEmailType,
} from '@/lib/send-transactional-email'

export const dynamic = 'force-dynamic'

const TEST_EMAIL = 'loannpicard@gmail.com'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
const base = BASE_URL.replace(/\/$/, '')

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let body: { type?: string; userId?: string; test?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }
  const type = (body.type as string)?.trim() as TransactionalEmailType | undefined
  if (!type || !TRANSACTIONAL_EMAIL_TYPES.includes(type)) {
    return NextResponse.json({
      error: `Type invalide. Utilisez: ${TRANSACTIONAL_EMAIL_TYPES.join(', ')}`,
    }, { status: 400 })
  }

  const useTestEmail = body.test !== false && !body.userId
  const targetEmail = useTestEmail ? TEST_EMAIL : null
  let to = targetEmail
  let recipientName: string | null = null
  let plan: 'starter' | 'pro' | 'business' = 'starter'

  if (body.userId) {
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { email: true, name: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionEnd: true },
    })
    if (!user?.email) {
      return NextResponse.json({ error: 'Utilisateur introuvable ou sans email' }, { status: 404 })
    }
    to = user.email
    recipientName = user.name ?? null
    plan = (user.subscriptionPlan === 'pro' || user.subscriptionPlan === 'business' ? user.subscriptionPlan : 'starter') as 'starter' | 'pro' | 'business'
  } else if (!useTestEmail) {
    return NextResponse.json({ error: 'Indiquez userId ou test: true pour envoyer à l\'email de test' }, { status: 400 })
  }

  if (!to) {
    return NextResponse.json({ error: 'Aucune adresse de destination' }, { status: 400 })
  }

  const name = recipientName ?? 'Test'
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  try {
    switch (type) {
      case 'welcome': {
        const res = await sendWelcomeEmail(to, {
          recipientName: name,
          loginUrl: `${base}/login`,
        })
        return res.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: res.error }, { status: 500 })
      }
      case 'trial_start': {
        const res = await sendTrialStartEmail(to, {
          recipientName: name,
          trialEndDate: tomorrowStr,
          planLabel: plan === 'business' ? 'Business' : 'Pro',
          priceAfterTrial: plan === 'business' ? '12 €/mois' : '5 €/mois',
          manageUrl: `${base}/parametres`,
        })
        return res.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: res.error }, { status: 500 })
      }
      case 'trial_ending': {
        const res = await sendTrialEndingEmail(to, {
          recipientName: name,
          trialEndDate: tomorrowStr,
          amountToCharge: plan === 'business' ? '12 €' : '5 €',
          planLabel: plan === 'business' ? 'Business' : 'Pro',
          continueUrl: `${base}/formules`,
          cancelUrl: `${base}/parametres`,
        })
        return res.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: res.error }, { status: 500 })
      }
      case 'payment_success': {
        const res = await sendPaymentSuccessEmail(to, {
          recipientName: name,
          amount: '5,00 €',
          billingDate: dateStr,
          planLabel: plan === 'business' ? 'Business' : 'Pro',
          dashboardUrl: `${base}/dashboard`,
        })
        return res.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: res.error }, { status: 500 })
      }
      case 'cancellation': {
        const res = await sendCancellationEmail(to, {
          recipientName: name,
          accessEndDate: dateStr,
          dashboardUrl: `${base}/dashboard`,
        })
        return res.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: res.error }, { status: 500 })
      }
      case 'weekly': {
        const res = await sendWeeklyEmail(to, {
          recipientName: name,
          plan,
          ctaUrl: plan === 'starter' ? `${base}/formules` : `${base}/dashboard`,
        })
        return res.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: res.error }, { status: 500 })
      }
      default:
        return NextResponse.json({ error: 'Type non géré' }, { status: 400 })
    }
  } catch (e) {
    console.error('[admin/send-transactional-email]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
