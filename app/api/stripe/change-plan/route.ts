import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, getPriceIdForPlan, mappingFromPlanKey, type StripePlanKey } from '@/lib/stripe'
import { planTypeFromSubscription } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

const PLAN_KEYS: StripePlanKey[] = ['pro_monthly', 'pro_yearly', 'business_monthly', 'business_yearly']
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

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
      return NextResponse.json({
        error: 'Plan invalide. Utilisez: pro_monthly, pro_yearly, business_monthly, business_yearly',
      }, { status: 400 })
    }

    const newPriceId = getPriceIdForPlan(planKey)
    if (!newPriceId) {
      return NextResponse.json({ error: 'Price ID non configuré pour ce plan' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const subId = (user as { stripeSubscriptionId?: string | null }).stripeSubscriptionId
    const status = (user as { subscriptionStatus?: string | null }).subscriptionStatus
    if (!subId || !status || !ACTIVE_STATUSES.includes(status)) {
      return NextResponse.json({
        error: 'Aucun abonnement actif à modifier. Souscrivez d\'abord à une formule payante.',
      }, { status: 400 })
    }

    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
    if (!ACTIVE_STATUSES.includes(sub.status)) {
      return NextResponse.json({ error: 'Cet abonnement n\'est plus actif ou en essai' }, { status: 400 })
    }

    const item = sub.items.data[0]
    if (!item?.id) {
      return NextResponse.json({ error: 'Abonnement Stripe invalide (aucun item)' }, { status: 500 })
    }
    const currentPriceId = typeof item.price === 'object' && item.price?.id ? item.price.id : null
    if (currentPriceId === newPriceId) {
      const mapping = mappingFromPlanKey(planKey)
      return NextResponse.json({
        ok: true,
        subscriptionPlan: mapping?.plan ?? 'pro',
        billingCycle: mapping?.cycle ?? 'monthly',
        message: 'Vous avez déjà cette formule.',
      })
    }

    await stripe.subscriptions.update(subId, {
      items: [{ id: item.id, price: newPriceId }],
      proration_behavior: 'create_prorations',
      metadata: { userId: session.id, planKey },
    })

    const mapping = mappingFromPlanKey(planKey)
    if (mapping) {
      const planType = planTypeFromSubscription(mapping.plan)
      await prisma.user.update({
        where: { id: session.id },
        data: {
          subscriptionPlan: mapping.plan,
          billingCycle: mapping.cycle,
          planType,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      subscriptionPlan: mapping?.plan ?? (planKey.startsWith('business') ? 'business' : 'pro'),
      billingCycle: mapping?.cycle ?? (planKey.endsWith('yearly') ? 'yearly' : 'monthly'),
    })
  } catch (err) {
    console.error('[stripe/change-plan]', err)
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
