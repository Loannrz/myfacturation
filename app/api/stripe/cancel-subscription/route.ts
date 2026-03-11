import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/** Annule l’abonnement : Stripe (cancel_at_period_end) ou downgrade direct en base si pas de Stripe. */
export async function POST() {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { stripeSubscriptionId: true, subscriptionPlan: true, subscriptionStatus: true },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const subId = (user as { stripeSubscriptionId?: string | null }).stripeSubscriptionId
  const plan = (user as { subscriptionPlan?: string }).subscriptionPlan ?? 'starter'
  const status = (user as { subscriptionStatus?: string | null }).subscriptionStatus ?? null
  const hasPaidPlan = plan === 'pro' || plan === 'business'
  const hasStripeSubscription = !!subId
  const hasActiveOrTrialingStatus = status === 'active' || status === 'trialing'

  if (subId && stripe) {
    try {
      await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
      // Ne pas modifier subscriptionPlan ni subscriptionStatus : l'utilisateur garde ses avantages jusqu'à subscriptionEnd.
      // Le webhook customer.subscription.deleted mettra à jour la BDD quand la période sera terminée.
      return NextResponse.json({ ok: true, message: 'Abonnement annulé à la fin de la période.' })
    } catch (e) {
      console.error('[Stripe cancel]', e)
      return NextResponse.json({ error: 'Impossible d’annuler l’abonnement' }, { status: 500 })
    }
  }

  if (hasPaidPlan || hasStripeSubscription || hasActiveOrTrialingStatus) {
    await prisma.user.update({
      where: { id: session.id },
      data: {
        subscriptionPlan: 'starter',
        subscriptionStatus: null,
        stripeSubscriptionId: null,
        subscriptionEnd: null,
        planType: 'free',
      },
    })
    return NextResponse.json({ ok: true, message: 'Abonnement résilié. Vous êtes repassé sur la formule Starter.' })
  }

  return NextResponse.json({ ok: true, message: 'Vous n’avez pas d’abonnement actif. Vous êtes bien en formule Starter, aucun prélèvement.' })
}
