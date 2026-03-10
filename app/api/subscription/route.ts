import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { planTypeFromSubscription } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

type SubscriptionPlan = 'starter' | 'pro' | 'business'
type BillingCycle = 'monthly' | 'yearly'

/** GET: retourne la formule et le cycle de facturation de l'utilisateur */
export async function GET() {
  const session = await requireSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionPlan: true, billingCycle: true },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  return NextResponse.json({
    subscriptionPlan: user.subscriptionPlan ?? 'starter',
    billingCycle: user.billingCycle ?? 'monthly',
  })
}

/** PATCH: met à jour la formule (pour démo / upgrade manuel) */
export async function PATCH(req: NextRequest) {
  const session = await requireSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const body = await req.json()
    const plan = (body.subscriptionPlan as SubscriptionPlan) || undefined
    const cycle = (body.billingCycle as BillingCycle) || undefined
    if (!plan || !['starter', 'pro', 'business'].includes(plan)) {
      return NextResponse.json({ error: 'Formule invalide' }, { status: 400 })
    }
    const planType = planTypeFromSubscription(plan)
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        subscriptionPlan: plan,
        ...(cycle && ['monthly', 'yearly'].includes(cycle) ? { billingCycle: cycle } : {}),
        planType: planType === 'premium' ? 'premium' : 'free',
      },
    })
    return NextResponse.json({ subscriptionPlan: plan, billingCycle: cycle ?? 'monthly' })
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
