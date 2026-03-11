import { prisma } from '@/lib/prisma'
import { stripe, planFromPriceId, mappingFromPlanKey } from '@/lib/stripe'
import { planTypeFromSubscription } from '@/lib/subscription'

export type SyncResult = { ok: true; plan: string; cycle: string; status: string } | { ok: false; reason: string }

/**
 * Met à jour l’utilisateur en base à partir d’une session Checkout Stripe.
 * Utilisable côté serveur (page success, API) pour appliquer la formule tout de suite.
 */
export async function syncUserFromStripeCheckout(userId: string, sessionId: string): Promise<SyncResult> {
  if (!stripe) return { ok: false, reason: 'Stripe non configuré' }
  if (!sessionId?.startsWith('cs_')) return { ok: false, reason: 'session_id invalide' }

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
    const metaUserId = checkoutSession.metadata?.userId != null ? String(checkoutSession.metadata.userId) : ''
    if (metaUserId !== userId) return { ok: false, reason: 'Session non autorisée' }
    if (checkoutSession.status !== 'complete') return { ok: false, reason: 'Checkout pas encore finalisé' }

    let subId: string | null =
      typeof checkoutSession.subscription === 'object' && checkoutSession.subscription != null && 'id' in checkoutSession.subscription
        ? (checkoutSession.subscription as { id: string }).id
        : typeof checkoutSession.subscription === 'string'
          ? checkoutSession.subscription
          : null
    if (!subId) return { ok: false, reason: 'Abonnement pas encore créé' }

    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
    const subData = sub as unknown as {
      status: string
      current_period_start: number
      current_period_end: number
      trial_end?: number
      items: { data: Array<{ price?: { id?: string } }> }
    }
    const priceId = subData.items.data[0]?.price?.id ?? ''
    const planKeyFromMeta = checkoutSession.metadata?.planKey as string | undefined
    let mapping = planFromPriceId(priceId)
    if (!mapping) mapping = mappingFromPlanKey(planKeyFromMeta)
    if (!mapping) return { ok: false, reason: 'Formule non reconnue' }

    const planType = planTypeFromSubscription(mapping.plan)
    const subscriptionStatus = subData.status === 'trialing' ? 'trialing' : 'active'
    const customerId =
      typeof checkoutSession.customer === 'string'
        ? checkoutSession.customer
        : (checkoutSession.customer as { id?: string } | null)?.id ?? null
    const hadTrial = subData.status === 'trialing' || (subData.trial_end != null && subData.trial_end > 0)
    const startTs = subData.current_period_start
    const endTs = subData.current_period_end
    const subscriptionStart =
      typeof startTs === 'number' && Number.isFinite(startTs) ? new Date(startTs * 1000) : null
    const subscriptionEnd =
      typeof endTs === 'number' && Number.isFinite(endTs) ? new Date(endTs * 1000) : null

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: mapping.plan,
        billingCycle: mapping.cycle,
        planType,
        subscriptionStatus,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subId,
        ...(subscriptionStart != null ? { subscriptionStart } : {}),
        ...(subscriptionEnd != null ? { subscriptionEnd } : {}),
        ...(hadTrial ? { hasUsedTrial: true } : {}),
      } as Parameters<typeof prisma.user.update>[0]['data'],
    })

    return { ok: true, plan: mapping.plan, cycle: mapping.cycle, status: subscriptionStatus }
  } catch (e) {
    console.error('[sync-stripe-checkout]', e)
    const reason = e instanceof Error ? e.message : 'Erreur sync'
    return { ok: false, reason }
  }
}
