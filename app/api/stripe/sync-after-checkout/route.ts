import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, planFromPriceId } from '@/lib/stripe'
import { planTypeFromSubscription } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

/**
 * Synchronise le plan utilisateur depuis une session Checkout Stripe.
 * À appeler depuis la page billing/success pour appliquer la formule immédiatement
 * sans attendre le webhook checkout.session.completed.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId?.startsWith('cs_')) {
    return NextResponse.json({ error: 'session_id invalide' }, { status: 400 })
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })
    if (checkoutSession.metadata?.userId !== session.id) {
      return NextResponse.json({ error: 'Session non autorisée' }, { status: 403 })
    }
    const subId =
      typeof checkoutSession.subscription === 'object' && checkoutSession.subscription?.id
        ? checkoutSession.subscription.id
        : typeof checkoutSession.subscription === 'string'
          ? checkoutSession.subscription
          : null
    if (!subId) return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 })

    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
    const subData = sub as unknown as {
      status: string
      current_period_start: number
      current_period_end: number
      trial_end?: number
      items: { data: Array<{ price?: { id?: string } }> }
    }
    const priceId = subData.items.data[0]?.price?.id ?? ''
    const mapping = planFromPriceId(priceId)
    if (!mapping) return NextResponse.json({ error: 'Formule non reconnue' }, { status: 400 })

    const planType = planTypeFromSubscription(mapping.plan)
    const subscriptionStatus = subData.status === 'trialing' ? 'trialing' : 'active'
    const customerId =
      typeof checkoutSession.customer === 'string'
        ? checkoutSession.customer
        : checkoutSession.customer?.id ?? null
    const hadTrial = subData.status === 'trialing' || (subData.trial_end != null && subData.trial_end > 0)

    await prisma.user.update({
      where: { id: session.id },
      data: {
        subscriptionPlan: mapping.plan,
        billingCycle: mapping.cycle,
        planType,
        subscriptionStatus,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subId,
        subscriptionStart: new Date(subData.current_period_start * 1000),
        subscriptionEnd: new Date(subData.current_period_end * 1000),
        ...(hadTrial ? { hasUsedTrial: true } : {}),
      },
    })

    return NextResponse.json({
      ok: true,
      subscriptionPlan: mapping.plan,
      billingCycle: mapping.cycle,
      subscriptionStatus,
    })
  } catch (e) {
    console.error('[sync-after-checkout]', e)
    return NextResponse.json({ error: 'Impossible de synchroniser l’abonnement' }, { status: 500 })
  }
}
