import Stripe from 'stripe'

const secret = process.env.STRIPE_SECRET_KEY
if (!secret && process.env.NODE_ENV === 'production') {
  console.warn('[Stripe] STRIPE_SECRET_KEY is not set')
}

export const stripe =
  secret ?
    new Stripe(secret, { typescript: true })
    : (null as unknown as Stripe)

/** Plan + cycle → Price ID (env: PRICE_PRO_MONTHLY, etc.) */
export type StripePlanKey = 'pro_monthly' | 'pro_yearly' | 'business_monthly' | 'business_yearly'

export const STRIPE_PRICE_ENV_KEYS: Record<StripePlanKey, string> = {
  pro_monthly: 'PRICE_PRO_MONTHLY',
  pro_yearly: 'PRICE_PRO_YEARLY',
  business_monthly: 'PRICE_BUSINESS_MONTHLY',
  business_yearly: 'PRICE_BUSINESS_YEARLY',
}

const ENV_KEYS = STRIPE_PRICE_ENV_KEYS

/** Stripe attend un Price ID (commence par price_), pas un Product ID (prod_). */
export function getPriceIdForPlan(planKey: StripePlanKey): string | null {
  const key = ENV_KEYS[planKey]
  const value = process.env[key]?.trim()
  if (!value) return null
  if (value.startsWith('prod_')) return null
  return value
}

/** Stripe Price ID → plan + cycle pour mise à jour user */
export function planFromPriceId(priceId: string): { plan: 'pro' | 'business'; cycle: 'monthly' | 'yearly' } | null {
  const proMonthly = process.env.PRICE_PRO_MONTHLY?.trim()
  const proYearly = process.env.PRICE_PRO_YEARLY?.trim()
  const businessMonthly = process.env.PRICE_BUSINESS_MONTHLY?.trim()
  const businessYearly = process.env.PRICE_BUSINESS_YEARLY?.trim()
  if (priceId === proMonthly) return { plan: 'pro', cycle: 'monthly' }
  if (priceId === proYearly) return { plan: 'pro', cycle: 'yearly' }
  if (priceId === businessMonthly) return { plan: 'business', cycle: 'monthly' }
  if (priceId === businessYearly) return { plan: 'business', cycle: 'yearly' }
  return null
}

/** planKey (ex: business_monthly) → plan + cycle. Fallback quand planFromPriceId échoue (env différents). */
export function mappingFromPlanKey(planKey: string | undefined): { plan: 'pro' | 'business'; cycle: 'monthly' | 'yearly' } | null {
  if (!planKey || typeof planKey !== 'string') return null
  const key = planKey.trim().toLowerCase()
  if (key === 'pro_monthly') return { plan: 'pro', cycle: 'monthly' }
  if (key === 'pro_yearly') return { plan: 'pro', cycle: 'yearly' }
  if (key === 'business_monthly') return { plan: 'business', cycle: 'monthly' }
  if (key === 'business_yearly') return { plan: 'business', cycle: 'yearly' }
  return null
}
