'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { useSession } from 'next-auth/react'

type PlanChoice = 'pro' | 'business'
type StripePlanKey = 'pro_monthly' | 'pro_yearly' | 'business_monthly' | 'business_yearly'

const PRICING = {
  starter: { monthly: 0, yearly: 0 },
  pro: { monthly: 5, yearly: 50 },
  business: { monthly: 12, yearly: 120 },
} as const

const COMPARISON = [
  { feature: 'Essai gratuit', starter: false, pro: '7 jours', business: '7 jours' },
  { feature: 'Factures par mois', starter: '5', pro: 'Illimité', business: 'Illimité' },
  { feature: 'Devis par mois', starter: '5', pro: 'Illimité', business: 'Illimité' },
  { feature: 'Produits / Services', starter: false, pro: '5 max', business: 'Illimité' },
  { feature: 'Gestion clients', starter: true, pro: true, business: true },
  { feature: 'Avoirs', starter: false, pro: true, business: true },
  { feature: 'Gestion des dépenses', starter: false, pro: true, business: true },
  { feature: 'Gestion des salariés', starter: false, pro: false, business: true },
  { feature: 'Dashboard', starter: true, pro: true, business: true },
  { feature: 'Numérotation + Paiement + Mentions légales', starter: false, pro: true, business: true },
  { feature: 'Comptabilité avancée', starter: false, pro: true, business: true },
  { feature: 'Exports CSV / Excel', starter: false, pro: false, business: true },
  { feature: 'Établissements (max)', starter: '1', pro: '2', business: '10' },
  { feature: 'Comptes bancaires (max)', starter: '1', pro: '2', business: '10' },
  { feature: 'Historique d\'activité', starter: false, pro: false, business: true },
  { feature: 'Support prioritaire', starter: false, pro: false, business: true },
] as const

export default function FormulesPage() {
  const { data: session, status } = useSession()
  const [yearly, setYearly] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [existingSubscriptionChoice, setExistingSubscriptionChoice] = useState<{
    plan: PlanChoice
    planKey: StripePlanKey
    label: string
  } | null>(null)
  const [changePlanLoading, setChangePlanLoading] = useState(false)
  const currentPlan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const isPaidPlan = currentPlan === 'pro' || currentPlan === 'business'
  const [hasUsedTrial, setHasUsedTrial] = useState(false)
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/me')
      .then((r) => r.json())
      .then((u) => setHasUsedTrial(!!u.hasUsedTrial))
      .catch(() => {})
  }, [status])

  const handleChoosePlan = async (plan: PlanChoice) => {
    setLoading(plan)
    setExistingSubscriptionChoice(null)
    try {
      const planKey = `${plan}_${yearly ? 'yearly' : 'monthly'}` as StripePlanKey
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      let data: { url?: string; error?: string; hasExistingSubscription?: boolean; currentPlan?: string; currentCycle?: string; message?: string }
      try {
        const text = await res.text()
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { error: res.status === 500 ? 'Erreur serveur. Vérifiez les logs ou la configuration Stripe.' : 'Réponse invalide' }
      }
      if (data.hasExistingSubscription) {
        const cycleLabel = yearly ? 'annuel' : 'mensuel'
        const planLabel = plan === 'business' ? 'Business' : 'Pro'
        setExistingSubscriptionChoice({ plan, planKey, label: `${planLabel} (${cycleLabel})` })
        setLoading(null)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      if (res.status === 503) {
        const isLocalhost = typeof window !== 'undefined' && /^localhost$|^127\.0\.0\.1$/.test(window.location.hostname)
        if (isLocalhost) {
          const fallback = await fetch('/api/subscription', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionPlan: plan, billingCycle: yearly ? 'yearly' : 'monthly' }),
          })
          if (fallback.ok) window.location.href = '/parametres?upgraded=' + plan
        } else {
          alert('Le paiement en ligne n\'est pas configuré. Vérifiez STRIPE_SECRET_KEY et les Price IDs (PRICE_PRO_MONTHLY, etc.) dans les variables d\'environnement.')
        }
        setLoading(null)
        return
      }
      if (!res.ok) {
        alert(data.error || 'Erreur')
      }
    } finally {
      setLoading(null)
    }
  }

  const handleChangePlanConfirm = async () => {
    if (!existingSubscriptionChoice) return
    setChangePlanLoading(true)
    try {
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: existingSubscriptionChoice.planKey }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setExistingSubscriptionChoice(null)
        window.location.href = '/parametres?upgraded=' + (data.subscriptionPlan || existingSubscriptionChoice.plan)
        return
      }
      alert(data.error || 'Impossible de changer de formule.')
    } finally {
      setChangePlanLoading(false)
    }
  }

  const handleOpenPortal = async () => {
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (data.url) {
        window.location.href = data.url
        return
      }
      alert(data.error || 'Impossible d\'ouvrir le portail de facturation.')
    } catch {
      alert('Erreur lors de l\'ouverture du portail.')
    }
  }

  const price = (plan: keyof typeof PRICING) => {
    const p = PRICING[plan]
    const amount = yearly ? p.yearly : p.monthly
    if (amount === 0) return '0 €'
    if (yearly) return `${amount} €/an`
    return `${amount} €/mois`
  }

  const priceSub = (plan: 'pro' | 'business') => {
    if (!yearly) return null
    const p = PRICING[plan]
    const perMonth = p.yearly / 12
    return `soit ${perMonth.toFixed(2).replace('.', ',')} €/mois`
  }

  if (status === 'loading') {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center min-h-[40vh]">
        <div className="text-[var(--muted)]">Chargement…</div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--foreground)] mb-2">
          Choisissez la formule adaptée à votre activité
        </h1>
        <p className="text-[var(--muted)] text-lg">
          Commencez gratuitement puis évoluez selon vos besoins.
        </p>
      </div>

      {/* Modal : abonnement existant — changer de formule ou gérer */}
      {existingSubscriptionChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="existing-subscription-title">
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 id="existing-subscription-title" className="text-lg font-semibold text-[var(--foreground)] mb-2">
              Abonnement déjà actif
            </h2>
            <p className="text-[var(--muted)] mb-6">
              Vous avez déjà un abonnement actif. Souhaitez-vous passer à la formule {existingSubscriptionChoice.label} ou gérer votre abonnement dans le portail Stripe ?
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleChangePlanConfirm}
                disabled={changePlanLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {changePlanLoading ? 'Changement…' : `Changer pour ${existingSubscriptionChoice.label}`}
              </button>
              <button
                type="button"
                onClick={handleOpenPortal}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-[var(--border)] font-medium text-[var(--foreground)] hover:bg-[var(--border)]/20 transition-colors"
              >
                Gérer mon abonnement
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExistingSubscriptionChoice(null)}
              className="mt-4 w-full py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Toggle Mensuel / Annuel */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-[var(--border)]/30 border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              !yearly ? 'bg-[var(--foreground)] text-[var(--background)] shadow' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              yearly ? 'bg-[var(--foreground)] text-[var(--background)] shadow' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Annuel
            <span className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">-20%</span>
          </button>
        </div>
      </div>

      {/* Cartes */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {/* Starter */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Starter</h3>
            <div className="mt-2">
              <span className="text-3xl font-bold text-[var(--foreground)]">0 €</span>
              <span className="text-[var(--muted)]">/mois</span>
            </div>
            <p className="text-sm text-[var(--muted)] mt-2">Pour les activités occasionnelles</p>
          </div>
          {isPaidPlan ? (
            <button
              type="button"
              onClick={async () => {
                const planLabel = currentPlan === 'business' ? 'Business' : 'Pro'
                if (!confirm(`Résilier votre abonnement ${planLabel} ? Vous repasserez sur la formule Starter (à la fin de la période déjà payée ou immédiatement en cas d’essai gratuit).`)) return
                setCancelLoading(true)
                try {
                  const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' })
                  const data = await res.json().catch(() => ({}))
                  if (data.ok) {
                    window.location.href = '/parametres?resilie=1'
                    return
                  }
                  alert(data.error || 'Impossible de résilier.')
                } catch {
                  alert('Erreur lors de la résiliation.')
                } finally {
                  setCancelLoading(false)
                }
              }}
              disabled={cancelLoading}
              className="mt-auto inline-flex justify-center items-center px-4 py-3 rounded-xl border-2 border-[var(--border)] font-medium text-[var(--foreground)] hover:bg-[var(--border)]/20 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? 'Résiliation…' : 'Commencer gratuitement'}
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="mt-auto inline-flex justify-center items-center px-4 py-3 rounded-xl border-2 border-[var(--border)] font-medium text-[var(--foreground)] hover:bg-[var(--border)]/20 transition-colors"
            >
              Commencer gratuitement
            </Link>
          )}
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] p-6 flex flex-col shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-violet-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
            Populaire
          </div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Pro</h3>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              {hasUsedTrial ? 'Paiement dès maintenant (essai déjà utilisé)' : "7 jours d'essai gratuit"}
            </p>
            <div className="mt-2">
              <span className="text-3xl font-bold text-[var(--foreground)]">
                {yearly ? (PRICING.pro.yearly / 12).toFixed(2).replace('.', ',') : PRICING.pro.monthly} €
              </span>
              <span className="text-[var(--muted)]">/mois</span>
            </div>
            {yearly && <p className="text-sm text-[var(--muted)]">{PRICING.pro.yearly} €/an</p>}
            <p className="text-sm text-[var(--muted)] mt-2">Pour les freelances et indépendants</p>
          </div>
          {currentPlan === 'pro' ? (
            <span className="mt-auto inline-flex justify-center items-center px-4 py-3 rounded-xl bg-[var(--border)]/30 text-[var(--muted)] font-medium">
              Formule actuelle
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleChoosePlan('pro')}
              disabled={!!loading}
              className="mt-auto inline-flex justify-center items-center px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading === 'pro' ? 'Chargement…' : 'Choisir Pro'}
            </button>
          )}
        </div>

        {/* Business */}
        <div className="rounded-2xl border-2 border-amber-500/50 bg-[var(--background)] p-6 flex flex-col shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-amber-500 text-amber-950 text-xs font-bold px-3 py-1 rounded-bl-lg animate-pulse">
            ⭐ MEILLEURE OFFRE
          </div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Business</h3>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              {hasUsedTrial ? 'Paiement dès maintenant (essai déjà utilisé)' : "7 jours d'essai gratuit"}
            </p>
            <div className="mt-2">
              <span className="text-3xl font-bold text-[var(--foreground)]">
                {yearly ? (PRICING.business.yearly / 12).toFixed(2).replace('.', ',') : PRICING.business.monthly} €
              </span>
              <span className="text-[var(--muted)]">/mois</span>
            </div>
            {yearly && <p className="text-sm text-[var(--muted)]">{PRICING.business.yearly} €/an</p>}
            <p className="text-sm text-[var(--muted)] mt-2">Pour les entreprises et utilisateurs intensifs</p>
          </div>
          {currentPlan === 'business' ? (
            <span className="mt-auto inline-flex justify-center items-center px-4 py-3 rounded-xl bg-[var(--border)]/30 text-[var(--muted)] font-medium">
              Formule actuelle
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleChoosePlan('business')}
              disabled={!!loading}
              className="mt-auto inline-flex justify-center items-center px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold transition-colors disabled:opacity-50"
            >
              {loading === 'business' ? 'Chargement…' : 'Choisir Business'}
            </button>
          )}
        </div>
      </div>

      {/* Tableau comparatif */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--foreground)] p-4 border-b border-[var(--border)]">
          Comparatif des formules
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
                <th className="text-left p-4 font-medium text-[var(--foreground)]">Fonctionnalités</th>
                <th className="p-4 font-medium text-[var(--foreground)] text-center">Starter</th>
                <th className="p-4 font-medium text-[var(--foreground)] text-center">Pro</th>
                <th className="p-4 font-medium text-[var(--foreground)] text-center">Business</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/5">
                  <td className="p-4 text-[var(--foreground)]">{row.feature}</td>
                  <td className="p-4 text-center">
                    {typeof row.starter === 'boolean' ? (
                      row.starter ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-[var(--muted)] mx-auto" />
                    ) : (
                      <span className="text-[var(--muted)]">{row.starter}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {typeof row.pro === 'boolean' ? (
                      row.pro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-[var(--muted)] mx-auto" />
                    ) : (
                      <span className="text-[var(--muted)]">{row.pro}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {typeof row.business === 'boolean' ? (
                      row.business ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-[var(--muted)] mx-auto" />
                    ) : (
                      <span className="text-[var(--muted)]">{row.business}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-sm text-[var(--muted)] mt-8">
        <Link href="/parametres" className="underline hover:no-underline">Voir ma formule actuelle dans Paramètres</Link>
      </p>
    </div>
  )
}
