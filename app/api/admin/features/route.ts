import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const FEATURE_KEYS = [
  'factures',
  'devis',
  'produits',
  'clients',
  'avoirs',
  'depenses',
  'exports',
  'multi_comptes_bancaires',
  'multi_etablissements',
  'historique_activite',
  'comptabilite_avancee',
  'parametres_avances',
] as const

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const features = await prisma.planFeature.findMany({
    include: { plan: true },
    orderBy: [{ planKey: 'asc' }, { feature: 'asc' }],
  })

  const matrix: Record<string, Record<string, { enabled: boolean; limit: number | null }>> = {}
  for (const f of features) {
    if (!matrix[f.feature]) matrix[f.feature] = {}
    matrix[f.feature][f.planKey] = { enabled: f.enabled, limit: f.limit_ }
  }

  return NextResponse.json({
    features: FEATURE_KEYS,
    matrix,
    rows: FEATURE_KEYS.map((feature) => ({
      feature,
      starter: matrix[feature]?.starter ?? { enabled: false, limit: null },
      pro: matrix[feature]?.pro ?? { enabled: false, limit: null },
      business: matrix[feature]?.business ?? { enabled: false, limit: null },
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const { planKey, feature, enabled, limit } = body as { planKey: string; feature: string; enabled?: boolean; limit?: number | null }
  if (!planKey || !feature || !['starter', 'pro', 'business'].includes(planKey)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const pf = await prisma.planFeature.upsert({
    where: { planKey_feature: { planKey, feature } },
    update: {
      ...(enabled !== undefined && { enabled }),
      ...(limit !== undefined && { limit_: limit === null || limit === '' ? null : Number(limit) }),
    },
    create: {
      planKey,
      feature,
      enabled: enabled ?? true,
      limit_: limit == null || limit === '' ? null : Number(limit),
    },
  })
  return NextResponse.json(pf)
}
