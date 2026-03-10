import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/**
 * Crée une session du portail client Stripe (gérer abonnement, résilier, moyen de paiement, factures).
 */
export async function POST() {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { stripeCustomerId: true },
  })
  const customerId = (user as { stripeCustomerId?: string | null })?.stripeCustomerId
  if (!customerId) {
    return NextResponse.json({ error: 'Aucun compte de facturation Stripe associé' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings/billing`,
    })
    if (!portalSession.url) {
      return NextResponse.json({ error: 'Impossible de créer la session du portail' }, { status: 500 })
    }
    return NextResponse.json({ url: portalSession.url })
  } catch (e) {
    console.error('[Stripe portal]', e)
    return NextResponse.json({ error: 'Impossible d\'ouvrir le portail de facturation' }, { status: 500 })
  }
}
