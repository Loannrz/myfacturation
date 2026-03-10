import { prisma } from '@/lib/prisma'

/** Récupère la limite pour un plan + feature (ex: factures → 5 pour starter). null = illimité. */
export async function getPlanFeatureLimit(planKey: string, feature: string): Promise<number | null> {
  const row = await prisma.planFeature.findUnique({
    where: { planKey_feature: { planKey, feature } },
  })
  if (!row || !row.enabled) return null
  return row.limit_
}

/** Indique si la fonctionnalité est activée pour le plan. */
export async function getPlanFeatureEnabled(planKey: string, feature: string): Promise<boolean> {
  const row = await prisma.planFeature.findUnique({
    where: { planKey_feature: { planKey, feature } },
  })
  return row?.enabled ?? false
}

/** Limite de factures ce mois pour le plan (depuis plan_features ou défaut). */
export async function getInvoicesLimit(planKey: string): Promise<number | null> {
  const limit = await getPlanFeatureLimit(planKey, 'factures')
  if (limit != null) return limit
  return planKey === 'starter' ? 5 : null
}

/** Limite de devis ce mois pour le plan. */
export async function getQuotesLimit(planKey: string): Promise<number | null> {
  const limit = await getPlanFeatureLimit(planKey, 'devis')
  if (limit != null) return limit
  return planKey === 'starter' ? 5 : null
}
