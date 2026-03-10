import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, getPriceIdForPlan, type StripePlanKey } from '@/lib/stripe'
import { planTypeFromSubscription } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

const PLAN_KEYS: StripePlanKey[] = ['pro_monthly', 'pro_yearly', 'business_monthly', 'business_yearly']

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

  const body = await req.json()
  const planKey = (body.plan as string)?.trim() as StripePlanKey | undefined
  if (!planKey || !PLAN_KEYS.includes(planKey)) {
    return NextResponse.json({ error: 'Plan invalide. Utilisez: pro_monthly, pro_yearly, business_monthly, business_yearly' }, { status: 400 })
  }

  const priceId = getPriceIdForPlan(planKey)
  if (!priceId) {
    return NextResponse.json({ error: 'Price ID non configuré pour ce plan' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, stripeCustomerId: true },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  let customerId = (user as { stripeCustomerId?: string }).stripeCustomerId ?? null
  if (!customerId && user.email) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: session.id },
    })
    customerId = customer.id
    await prisma.user.update({
      where: { id: session.id },
      data: { stripeCustomerId: customerId },
    })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: customerId || undefined,
    customer_email: !customerId ? (user.email ?? undefined) : undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/billing/cancel`,
    metadata: { userId: session.id, planKey },
    subscription_data: {
      metadata: { userId: session.id, planKey },
      trial_period_days: undefined,
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: 'Impossible de créer la session Stripe' }, { status: 500 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}
