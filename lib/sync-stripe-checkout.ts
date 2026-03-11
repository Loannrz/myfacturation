import { prisma } from '@/lib/prisma'
import { stripe, planFromPriceId, mappingFromPlanKey } from '@/lib/stripe'
import { planTypeFromSubscription } from '@/lib/subscription'

export type SyncResult = { ok: true; plan: string; cycle: string; status: string } | { ok: false; reason: string }

/**
 * Met à jour l’utilisateur en base à partir d’une session Checkout Stripe.
 * Utilisable côté serveur (page success, API) pour appliquer la formule tout de suite.
 */
export async function syncUserFromStripeCheckout(userId: string, sessionId: string): Promise<SyncResult> {
  // #region agent log
  fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42c834'},body:JSON.stringify({sessionId:'42c834',location:'sync-stripe-checkout.ts:entry',message:'sync entry',data:{userIdLen:userId?.length,sessionIdPrefix:sessionId?.slice(0,9)},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion
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

    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42c834'},body:JSON.stringify({sessionId:'42c834',location:'sync-stripe-checkout.ts:afterRetrieve',message:'checkout retrieved',data:{status:checkoutSession.status,metaUserIdLen:metaUserId.length,hasSubId:!!subId},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42c834'},body:JSON.stringify({sessionId:'42c834',location:'sync-stripe-checkout.ts:afterMapping',message:'mapping',data:{hasMapping:!!mapping,plan:mapping?.plan,priceIdPrefix:priceId?.slice(0,12),planKeyFromMeta:!!planKeyFromMeta},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!mapping) return { ok: false, reason: 'Formule non reconnue' }

    const planType = planTypeFromSubscription(mapping.plan)
    const subscriptionStatus = subData.status === 'trialing' ? 'trialing' : 'active'
    const customerId =
      typeof checkoutSession.customer === 'string'
        ? checkoutSession.customer
        : (checkoutSession.customer as { id?: string } | null)?.id ?? null
    const hadTrial = subData.status === 'trialing' || (subData.trial_end != null && subData.trial_end > 0)

    await prisma.user.update({
      where: { id: userId },
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
      } as Parameters<typeof prisma.user.update>[0]['data'],
    })

    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42c834'},body:JSON.stringify({sessionId:'42c834',location:'sync-stripe-checkout.ts:success',message:'sync ok',data:{plan:mapping.plan,cycle:mapping.cycle},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return { ok: true, plan: mapping.plan, cycle: mapping.cycle, status: subscriptionStatus }
  } catch (e) {
    console.error('[sync-stripe-checkout]', e)
    const reason = e instanceof Error ? e.message : 'Erreur sync'
    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42c834'},body:JSON.stringify({sessionId:'42c834',location:'sync-stripe-checkout.ts:catch',message:'sync error',data:{reason},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return { ok: false, reason }
  }
}
