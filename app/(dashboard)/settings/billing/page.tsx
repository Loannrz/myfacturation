'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { CreditCard, Calendar, RefreshCw, XCircle, ExternalLink } from 'lucide-react'
import { planLabel } from '@/lib/subscription'

type BillingData = {
  subscriptionPlan: string
  billingCycle: string | null
  subscriptionStatus: string | null
  subscriptionEnd: string | null
  stripeSubscriptionId: string | null
}

export default function SettingsBillingPage() {
  const { data: session, status } = useSession()
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingPlan, setChangingPlan] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/me')
      .then((r) => r.json())
      .then((user) => {
        setBilling({
          subscriptionPlan: user.subscriptionPlan ?? 'starter',
          billingCycle: user.billingCycle ?? null,
          subscriptionStatus: user.subscriptionStatus ?? null,
          subscriptionEnd: user.subscriptionEnd ?? null,
          stripeSubscriptionId: user.stripeSubscriptionId ?? null,
        })
      })
      .catch(() => setBilling(null))
      .finally(() => setLoading(false))
  }, [status])

  const handleChangePlan = () => {
    setChangingPlan(true)
    window.location.href = '/formules'
  }

  const handleOpenStripePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
      alert(data.error || 'Impossible d\'ouvrir le portail de facturation')
    } catch {
      alert('Erreur')
    } finally {
      setPortalLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!confirm('Résilier l’abonnement ? Vous repasserez sur Starter (fin de période si abonnement Stripe, sinon immédiat). Si vous n’avez pas d’abonnement, aucun changement.')) return
    setCancelling(true)
    try {
      const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        if (data.message) alert(data.message)
        window.location.href = '/parametres?resilie=1'
        return
      }
      alert(data.error || 'Erreur')
    } catch {
      alert('Erreur')
    } finally {
      setCancelling(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="text-[var(--muted)]">Chargement…</div>
      </div>
    )
  }

  const plan = billing?.subscriptionPlan ?? 'starter'
  const isPaidPlan = plan === 'pro' || plan === 'business'
  const hasActiveStripeSubscription =
    (billing?.subscriptionStatus === 'active' && billing?.stripeSubscriptionId) ?? false

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="w-6 h-6 text-[var(--foreground)]" />
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Facturation & abonnement</h1>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 space-y-6">
        <div>
          <p className="text-sm text-[var(--muted)] mb-1">Plan actuel</p>
          <p className="text-lg font-semibold text-[var(--foreground)]">{planLabel(plan as 'starter' | 'pro' | 'business')}</p>
        </div>

        {billing?.billingCycle && (
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[var(--muted)]" />
            <div>
              <p className="text-sm text-[var(--muted)]">Cycle de facturation</p>
              <p className="text-[var(--foreground)]">
                {billing.billingCycle === 'yearly' ? 'Annuel' : 'Mensuel'}
              </p>
            </div>
          </div>
        )}

        {billing?.subscriptionEnd && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--muted)]" />
            <div>
              <p className="text-sm text-[var(--muted)]">
                {billing.subscriptionStatus === 'cancelled' ? 'Fin d’accès le' : 'Prochaine facturation le'}
              </p>
              <p className="text-[var(--foreground)]">
                {new Date(billing.subscriptionEnd).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleChangePlan}
            disabled={!!changingPlan}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm disabled:opacity-50"
          >
            {changingPlan ? 'Redirection…' : 'Changer de plan'}
          </button>
          {hasActiveStripeSubscription && (
            <button
              type="button"
              onClick={handleOpenStripePortal}
              disabled={!!portalLoading}
              className="inline-flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)]/20 font-medium text-sm disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              {portalLoading ? 'Ouverture…' : 'Gérer mon abonnement (Stripe)'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCancelSubscription}
            disabled={!!cancelling}
            className="inline-flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)]/20 font-medium text-sm disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            {cancelling ? 'Annulation…' : 'Résilier l’abonnement'}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-3">
          Sur le portail Stripe vous pouvez résilier, changer de moyen de paiement ou consulter vos factures.
        </p>
      </div>

      <p className="mt-6 text-sm text-[var(--muted)]">
        <Link href="/parametres" className="underline hover:no-underline">Retour aux paramètres</Link>
      </p>
    </div>
  )
}
