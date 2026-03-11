import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, planFromPriceId, mappingFromPlanKey } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { planTypeFromSubscription } from '@/lib/subscription'
import { sendTrialStartEmail, sendPaymentSuccessEmail, sendCancellationEmail } from '@/lib/send-transactional-email'
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
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (!userId) return
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
  const planKeyFromMeta = (sub as unknown as { metadata?: { planKey?: string } }).metadata?.planKey
  let mapping = planFromPriceId(priceId)
  if (!mapping) mapping = mappingFromPlanKey(planKeyFromMeta)
  if (!mapping) return

  const planType = planTypeFromSubscription(mapping.plan)
  const subscriptionStatus = subData.status === 'trialing' ? 'trialing' : 'active'
  const hadTrial = subData.status === 'trialing' || (subData.trial_end != null && subData.trial_end > 0)
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
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
      stripeSubscriptionId: subscriptionId,
      ...(subscriptionStart != null ? { subscriptionStart } : {}),
      ...(subscriptionEnd != null ? { subscriptionEnd } : {}),
      ...(hadTrial ? { hasUsedTrial: true } : {}),
    },
  })

  if (subData.status === 'trialing') {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (u?.email) {
      const trialEnd = subscriptionEnd ? subscriptionEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
      const planLabel = mapping.plan === 'business' ? 'Business' : 'Pro'
      const priceAfter = mapping.plan === 'business' ? '12 €/mois' : '5 €/mois'
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
      sendTrialStartEmail(u.email, {
        recipientName: u.name,
        trialEndDate: trialEnd,
        planLabel,
        priceAfterTrial: priceAfter,
        manageUrl: `${baseUrl.replace(/\/$/, '')}/parametres`,
      }).catch((err) => console.error('[webhook] trial start email', err))
    }
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const inv = invoice as unknown as { subscription?: string | { id?: string } }
  const subscriptionId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id
  if (!subscriptionId) return

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true, email: true, name: true, subscriptionPlan: true },
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

  if (user.email) {
    const amountPaid = invoice.amount_paid != null ? (invoice.amount_paid / 100).toFixed(2).replace('.', ',') + ' €' : '—'
    const billingDate = invoice.created != null
      ? new Date(invoice.created * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    const planLabel = user.subscriptionPlan === 'business' ? 'Business' : user.subscriptionPlan === 'pro' ? 'Pro' : 'Starter'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    sendPaymentSuccessEmail(user.email, {
      recipientName: user.name,
      amount: amountPaid,
      billingDate,
      planLabel,
      dashboardUrl: `${baseUrl.replace(/\/$/, '')}/dashboard`,
    }).catch((err) => console.error('[webhook] payment success email', err))
  }
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
  const planKeyFromMeta = (sub as unknown as { metadata?: { planKey?: string } }).metadata?.planKey
  let mapping = planFromPriceId(priceId)
  if (!mapping) mapping = mappingFromPlanKey(planKeyFromMeta)

  const startTs = subData.current_period_start
  const endTs = subData.current_period_end
  const subscriptionStart =
    typeof startTs === 'number' && Number.isFinite(startTs) ? new Date(startTs * 1000) : null
  const subscriptionEnd =
    typeof endTs === 'number' && Number.isFinite(endTs) ? new Date(endTs * 1000) : null
  const data: {
    subscriptionStatus: string
    subscriptionPlan?: string
    billingCycle?: string
    planType?: string
    hasUsedTrial?: boolean
    subscriptionStart?: Date | null
    subscriptionEnd?: Date | null
  } = {
    subscriptionStatus: status,
    ...(subscriptionStart != null ? { subscriptionStart } : {}),
    ...(subscriptionEnd != null ? { subscriptionEnd } : {}),
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

  const subStripe = sub as unknown as { cancel_at_period_end?: boolean; current_period_end?: number }
  if (subStripe.cancel_at_period_end) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (u?.email) {
      const endTs = subStripe.current_period_end
      const accessEndDate = typeof endTs === 'number' && Number.isFinite(endTs)
        ? new Date(endTs * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
      sendCancellationEmail(u.email, {
        recipientName: u.name,
        accessEndDate,
        dashboardUrl: `${baseUrl.replace(/\/$/, '')}/dashboard`,
      }).catch((err) => console.error('[webhook] cancellation (cancel_at_period_end) email', err))
    }
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  let userId = sub.metadata?.userId as string | undefined
  let userEmail: string | null = null
  let userName: string | null = null
  if (!userId) {
    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: sub.id },
      select: { id: true, email: true, name: true },
    })
    userId = user?.id ?? undefined
    userEmail = user?.email ?? null
    userName = user?.name ?? null
  } else {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    userEmail = u?.email ?? null
    userName = u?.name ?? null
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

  if (userEmail) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const accessEndDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    sendCancellationEmail(userEmail, {
      recipientName: userName,
      accessEndDate,
      dashboardUrl: `${baseUrl.replace(/\/$/, '')}/dashboard`,
    }).catch((err) => console.error('[webhook] cancellation email', err))
  }
}
