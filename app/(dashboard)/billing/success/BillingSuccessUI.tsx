'use client'

import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import type { SyncResult } from '@/lib/sync-stripe-checkout'

export function BillingSuccessUI({ syncResult, sessionId }: { syncResult: SyncResult; sessionId: string | null }) {
  const { update: updateSession } = useSession()
  const didUpdate = useRef(false)
  const [retryDone, setRetryDone] = useState(false)
  const plan = syncResult.ok ? syncResult.plan : undefined
  const cycle = syncResult.ok ? syncResult.cycle : undefined

  useEffect(() => {
    if (didUpdate.current || !syncResult.ok || plan == null) return
    didUpdate.current = true
    updateSession?.({ subscriptionPlan: plan, billingCycle: cycle ?? null }).catch(() => {})
  }, [syncResult.ok, plan, cycle, updateSession])

  useEffect(() => {
    if (syncResult.ok || !sessionId || retryDone) return
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
    const trySync = (attempt: number): Promise<boolean> =>
      fetch(`/api/stripe/sync-after-checkout?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.ok)
        .then((ok) => {
          if (ok) return true
          if (attempt >= 4) return false
          return delay(3000).then(() => trySync(attempt + 1))
        })
    delay(2000)
      .then(() => trySync(0))
      .then((ok) => {
        setRetryDone(true)
        if (ok) return fetch('/api/me').then((r) => r.json())
        return null
      })
      .then((user) => {
        if (user?.subscriptionPlan) {
          const planVal = user.subscriptionPlan === 'pro' || user.subscriptionPlan === 'business' ? user.subscriptionPlan : 'starter'
          updateSession?.({ subscriptionPlan: planVal, billingCycle: user.billingCycle ?? null }).catch(() => {})
        }
      })
      .catch(() => setRetryDone(true))
  }, [syncResult.ok, sessionId, retryDone, updateSession])

  return (
    <div className="max-w-lg mx-auto text-center py-16 px-4">
      <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
        Votre abonnement est actif
      </h1>
      <p className="text-[var(--muted)] mb-8">
        Merci pour votre confiance. Les fonctionnalités de votre formule sont désormais disponibles.
      </p>
      {!syncResult.ok && syncResult.reason && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
          {syncResult.reason}. Rechargez la page ou déconnectez-vous puis reconnectez-vous pour actualiser.
        </p>
      )}
      <p className="text-xs text-[var(--muted)] mb-6">
        Si votre formule ne s&apos;affiche pas à jour dans le menu, rechargez la page une fois.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex justify-center items-center px-6 py-3 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
      >
        Aller au tableau de bord
      </Link>
    </div>
  )
}
