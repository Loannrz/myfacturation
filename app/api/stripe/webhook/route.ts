import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, planFromPriceId } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { planTypeFromSubscription } from '@/lib/subscription'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

/** Ne pas parser le body en JSON pour garder le corps brut (signature Stripe). */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET manquant' }, { status: 500 })
  }

  const rawBody = await req.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown'
    console.error('[Stripe webhook] Signature verification failed:', message)
    return NextResponse.json({ error: `Webhook signature failed: ${message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice)
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(sub)
        break
      }
      default:
        // Unhandled event type
        break
    }
  } catch (e) {
    console.error('[Stripe webhook]', event.type, e)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  if (!userId) return

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (!subscriptionId) return

  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] })
  const subData = sub as unknown as {
    status: string
    current_period_start: number
    current_period_end: number
    trial_end?: number
    items: { data: Array<{ price?: { id?: string } }> }
  }
  const priceId = subData.items.data[0]?.price?.id ?? ''
  const mapping = planFromPriceId(priceId)
  if (!mapping) return

  const planType = planTypeFromSubscription(mapping.plan)
  const subscriptionStatus = subData.status === 'trialing' ? 'trialing' : 'active'
  const hadTrial = subData.status === 'trialing' || (subData.trial_end != null && subData.trial_end > 0)
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionPlan: mapping.plan,
      billingCycle: mapping.cycle,
      planType,
      subscriptionStatus,
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscriptionId,
      subscriptionStart: new Date(subData.current_period_start * 1000),
      subscriptionEnd: new Date(subData.current_period_end * 1000),
      ...(hadTrial ? { hasUsedTrial: true } : {}),
    },
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const inv = invoice as unknown as { subscription?: string | { id?: string } }
  const subscriptionId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id
  if (!subscriptionId) return

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true },
  })
  if (!user) return

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'active',
      ...(invoice.billing_reason === 'subscription_cycle'
        ? {}
        : {}),
    },
  })
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  let userId = sub.metadata?.userId as string | undefined
  if (!userId) {
    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: sub.id },
      select: { id: true },
    })
    userId = user?.id ?? undefined
  }
  if (!userId) return

  const subData = sub as unknown as { status: string; current_period_start: number; current_period_end: number; items: { data: Array<{ price?: { id?: string } }> } }
  const status =
    subData.status === 'active'
      ? 'active'
      : subData.status === 'trialing'
        ? 'trialing'
        : subData.status === 'past_due'
          ? 'past_due'
          : 'cancelled'
  const priceId = subData.items.data[0]?.price?.id ?? ''
  const mapping = planFromPriceId(priceId)

  const data: {
    subscriptionStatus: string
    subscriptionStart: Date
    subscriptionEnd: Date
    subscriptionPlan?: string
    billingCycle?: string
    planType?: string
    hasUsedTrial?: boolean
  } = {
    subscriptionStatus: status,
    subscriptionStart: new Date(subData.current_period_start * 1000),
    subscriptionEnd: new Date(subData.current_period_end * 1000),
  }
  if (mapping && (status === 'active' || status === 'trialing')) {
    data.subscriptionPlan = mapping.plan
    data.billingCycle = mapping.cycle
    data.planType = planTypeFromSubscription(mapping.plan)
  }
  if (status === 'trialing') data.hasUsedTrial = true

  await prisma.user.update({
    where: { id: userId },
    data,
  })
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  let userId = sub.metadata?.userId as string | undefined
  if (!userId) {
    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: sub.id },
      select: { id: true },
    })
    userId = user?.id ?? undefined
  }
  if (!userId) return

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionPlan: 'starter',
      billingCycle: null,
      planType: 'free',
      subscriptionStatus: 'cancelled',
      stripeSubscriptionId: null,
      subscriptionEnd: new Date(),
    },
  })
}
