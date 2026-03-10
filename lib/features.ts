/**
 * Système de permissions par plan (free / premium).
 * Préparation pour Stripe et fonctionnalités payantes.
 */

export type PlanType = 'free' | 'premium'

export const FEATURES = {
  invoices: { free: true, premium: true },
  quotes: { free: true, premium: true },
  dashboard: { free: true, premium: true },
  clients: { free: true, premium: true },
  accounting: { free: false, premium: true },   // Comptabilité, export, rapports
  advancedReports: { free: false, premium: true },
  automation: { free: false, premium: true },
  emailReminders: { free: false, premium: true },
} as const

export function canAccessFeature(planType: PlanType, feature: keyof typeof FEATURES): boolean {
  const f = FEATURES[feature]
  if (!f) return false
  return planType === 'premium' ? f.premium : f.free
}
