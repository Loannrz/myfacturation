/**
 * Système de permissions par plan (free / premium).
 * Pour l'instant toutes les fonctionnalités sont gratuites (free: true partout).
 * Préparation pour Stripe et fonctionnalités payantes ultérieures.
 */

export type PlanType = 'free' | 'premium'

export const FEATURES = {
  invoices: { free: true, premium: true },
  quotes: { free: true, premium: true },
  dashboard: { free: true, premium: true },
  clients: { free: true, premium: true },
  accounting: { free: true, premium: true },   // Comptabilité, export, rapports
  advancedReports: { free: true, premium: true },
  automation: { free: true, premium: true },
  emailReminders: { free: true, premium: true },
} as const

export function canAccessFeature(planType: PlanType, feature: keyof typeof FEATURES): boolean {
  const f = FEATURES[feature]
  if (!f) return false
  return planType === 'premium' ? f.premium : f.free
}
