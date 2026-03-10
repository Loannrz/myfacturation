import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/** Annule l’abonnement Stripe à la fin de la période (cancel_at_period_end). */
export async function POST() {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { stripeSubscriptionId: true },
  })
  const subId = (user as { stripeSubscriptionId?: string | null })?.stripeSubscriptionId
  if (!subId) {
    return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 400 })
  }

  try {
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
    await prisma.user.update({
      where: { id: session.id },
      data: { subscriptionStatus: 'cancelled' },
    })
    return NextResponse.json({ ok: true, message: 'Abonnement annulé à la fin de la période.' })
  } catch (e) {
    console.error('[Stripe cancel]', e)
    return NextResponse.json({ error: 'Impossible d’annuler l’abonnement' }, { status: 500 })
  }
}
