import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, getPriceIdForPlan, STRIPE_PRICE_ENV_KEYS, type StripePlanKey } from '@/lib/stripe'
import { planTypeFromSubscription } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

const PLAN_KEYS: StripePlanKey[] = ['pro_monthly', 'pro_yearly', 'business_monthly', 'business_yearly']

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession()
    if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if (!stripe) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

    let body: { plan?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 })
    }
    const planKey = (body.plan as string)?.trim() as StripePlanKey | undefined
    if (!planKey || !PLAN_KEYS.includes(planKey)) {
      return NextResponse.json({ error: 'Plan invalide. Utilisez: pro_monthly, pro_yearly, business_monthly, business_yearly' }, { status: 400 })
    }

    const envKey = STRIPE_PRICE_ENV_KEYS[planKey]
    const rawPrice = process.env[envKey]?.trim()
    if (rawPrice?.startsWith('prod_')) {
      return NextResponse.json({
        error: 'Stripe attend un Price ID (commençant par price_), pas un Product ID (prod_). Dans le tableau de bord Stripe : Produits → votre produit → section Tarifs → copier l’ID du prix (price_...).',
      }, { status: 400 })
    }
    const priceId = getPriceIdForPlan(planKey)
    if (!priceId) {
      return NextResponse.json({ error: 'Price ID non configuré pour ce plan (PRICE_PRO_MONTHLY, PRICE_PRO_YEARLY, etc.)' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true, stripeCustomerId: true, hasUsedTrial: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    const hasUsedTrial = (user as { hasUsedTrial?: boolean }).hasUsedTrial ?? false

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.URL_AUTH_SUIVANTE ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '').split('/')[0]}` : null) ||
      'http://localhost:3000'
    const baseUrlClean = baseUrl.replace(/\/$/, '')

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
      success_url: `${baseUrlClean}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrlClean}/billing/cancel`,
      metadata: { userId: session.id, planKey },
      subscription_data: {
        metadata: { userId: session.id, planKey },
        ...(hasUsedTrial ? {} : { trial_period_days: 7 }),
      },
    })

    if (!checkoutSession.url) {
      return NextResponse.json({ error: 'Impossible de créer la session Stripe' }, { status: 500 })
    }

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('[create-checkout-session]', err)
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
