import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { syncUserFromStripeCheckout } from '@/lib/sync-stripe-checkout'

export const dynamic = 'force-dynamic'

/**
 * Synchronise le plan utilisateur depuis une session Checkout Stripe (appel client optionnel).
 * La page /billing/success fait déjà la sync côté serveur au chargement.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const sessionId = req.nextUrl.searchParams.get('session_id') ?? ''
  const result = await syncUserFromStripeCheckout(session.id, sessionId)
  if (result.ok) {
    return NextResponse.json({ ok: true, subscriptionPlan: result.plan, billingCycle: result.cycle, subscriptionStatus: result.status })
  }
  if (result.reason === 'Session non autorisée') return NextResponse.json({ error: result.reason }, { status: 403 })
  if (result.reason === 'Checkout pas encore finalisé') return NextResponse.json({ error: result.reason }, { status: 409 })
  if (result.reason === 'Abonnement pas encore créé') return NextResponse.json({ error: result.reason }, { status: 404 })
  if (result.reason === 'Formule non reconnue') return NextResponse.json({ error: result.reason }, { status: 400 })
  return NextResponse.json({ error: result.reason || 'Impossible de synchroniser' }, { status: 500 })
}
