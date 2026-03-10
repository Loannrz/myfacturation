/**
 * Plans: starter | pro | business
 * Limites et déblocage des fonctionnalités par formule.
 */

export type SubscriptionPlan = 'starter' | 'pro' | 'business'
export type BillingCycle = 'monthly' | 'yearly'

export const INVOICES_LIMIT_STARTER = 5
export const QUOTES_LIMIT_STARTER = 5
/** Pro = 5 produits max, Business = illimité */
export const PRODUCTS_LIMIT_PRO = 5

/** Fonctionnalités débloquées par plan (true = accessible) */
export const PLAN_FEATURES = {
  products: { starter: false, pro: true, business: true },
  creditNotes: { starter: false, pro: true, business: true },
  expenses: { starter: false, pro: true, business: true },
  accounting: { starter: false, pro: true, business: true },
  /** Numérotation factures/devis/avoirs, paiement par défaut, mentions légales */
  advancedSettings: { starter: false, pro: true, business: true },
  exportsCsvExcel: { starter: false, pro: false, business: true },
  multiBankAccounts: { starter: false, pro: false, business: true },
  multiEstablishments: { starter: false, pro: false, business: true },
  activityHistory: { starter: false, pro: false, business: true },
  supportPriority: { starter: false, pro: false, business: true },
} as const

export function canAccessFeatureByPlan(plan: SubscriptionPlan, feature: keyof typeof PLAN_FEATURES): boolean {
  const f = PLAN_FEATURES[feature]
  return f ? f[plan] : false
}

/** Nombre max d'établissements (profils émetteur) par plan */
export const MAX_ESTABLISHMENTS = { starter: 1, pro: 2, business: 10 } as const

/** Nombre max de comptes bancaires par plan */
export const MAX_BANK_ACCOUNTS = { starter: 1, pro: 2, business: 10 } as const

export function maxEstablishments(plan: SubscriptionPlan): number {
  return MAX_ESTABLISHMENTS[plan] ?? 1
}

export function maxBankAccounts(plan: SubscriptionPlan): number {
  return MAX_BANK_ACCOUNTS[plan] ?? 1
}

/** Limite de factures ce mois (undefined = illimité) */
export function invoicesLimit(plan: SubscriptionPlan): number | undefined {
  return plan === 'starter' ? INVOICES_LIMIT_STARTER : undefined
}

/** Limite de devis ce mois (undefined = illimité) */
export function quotesLimit(plan: SubscriptionPlan): number | undefined {
  return plan === 'starter' ? QUOTES_LIMIT_STARTER : undefined
}

/** Limite de produits / services (undefined = illimité). Pro = 5, Business = illimité. */
export function productsLimit(plan: SubscriptionPlan): number | undefined {
  if (plan === 'starter') return 0
  if (plan === 'pro') return PRODUCTS_LIMIT_PRO
  return undefined
}

/** Pour compatibilité planType (free/premium) : starter = free, pro/business = premium */
export function planTypeFromSubscription(plan: SubscriptionPlan): 'free' | 'premium' {
  return plan === 'starter' ? 'free' : 'premium'
}

/** Libellé affiché du plan */
export function planLabel(plan: SubscriptionPlan): string {
  const labels: Record<SubscriptionPlan, string> = {
    starter: 'Starter',
    pro: 'Pro',
    business: 'Business',
  }
  return labels[plan] ?? plan
}

/** Pour l'admin : considérer comme Business (toutes fonctionnalités débloquées). */
export function effectiveSubscriptionPlan(plan: SubscriptionPlan, role?: string): SubscriptionPlan {
  return role === 'admin' ? 'business' : plan
}
