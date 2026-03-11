'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function BillingSuccessPage() {
  const searchParams = useSearchParams()
  const { status, update: updateSession } = useSession()
  const [refreshed, setRefreshed] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (status !== 'authenticated' || !sessionId || refreshed) return
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
    const doSync = (): Promise<boolean> =>
      fetch(`/api/stripe/sync-after-checkout?session_id=${encodeURIComponent(sessionId)}`)
        .then(async (r) => {
          if (r.ok) return true
          await r.json().catch(() => ({}))
          if (r.status === 404 || r.status === 409) return false
          setSyncFailed(true)
          return false
        })
    const refreshFromMe = () =>
      fetch('/api/me')
        .then((r) => r.json())
        .then((user) => {
          const plan = user.subscriptionPlan ?? 'starter'
          const planVal = plan === 'pro' || plan === 'business' ? plan : 'starter'
          return updateSession?.({ subscriptionPlan: planVal, billingCycle: user.billingCycle ?? null })
        })
    const trySync = (attempt: number): Promise<boolean> =>
      doSync().then((ok) => {
        if (ok) return true
        if (attempt >= 4) return false
        return delay(3000).then(() => trySync(attempt + 1))
      })
    delay(1500)
      .then(() => trySync(0))
      .then((ok) => {
        if (!ok) setSyncFailed(true)
      })
      .then(() => refreshFromMe())
      .then(() => setRefreshed(true))
      .catch(() => refreshFromMe().then(() => setRefreshed(true)))
  }, [status, sessionId, refreshed, updateSession])

  return (
    <div className="max-w-lg mx-auto text-center py-16 px-4">
      <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
        Votre abonnement est actif
      </h1>
      <p className="text-[var(--muted)] mb-8">
        Merci pour votre confiance. Les fonctionnalités de votre formule sont désormais disponibles.
      </p>
      {syncFailed && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
          Si la formule ne s’affiche pas, déconnectez-vous puis reconnectez-vous pour actualiser.
        </p>
      )}
      <p className="text-xs text-[var(--muted)] mb-6">
        Si votre formule ne s’affiche pas à jour dans le menu, rechargez la page ou déconnectez-vous puis reconnectez-vous.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
      >
        Aller au tableau de bord
      </Link>
    </div>
  )
}
