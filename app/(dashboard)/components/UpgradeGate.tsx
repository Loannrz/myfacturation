'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { SubscriptionPlan } from '@/lib/subscription'

type Props = {
  plan: SubscriptionPlan
  requiredPlan: 'pro' | 'business'
  children: React.ReactNode
  title?: string
}

export function UpgradeGate({ plan, requiredPlan, children, title }: Props) {
  const hasAccess = requiredPlan === 'pro' ? (plan === 'pro' || plan === 'business') : plan === 'business'
  if (hasAccess) return <>{children}</>

  const message =
    requiredPlan === 'business'
      ? 'Disponible dans la formule Business.'
      : 'Disponible dans la formule Pro ou Business.'

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-60">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--border)]/30 text-[var(--muted)] mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            {title ?? 'Fonctionnalité premium'}
          </h2>
          <p className="text-sm text-[var(--muted)] mb-6">{message}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {requiredPlan === 'business' ? (
              <Link
                href="/formules"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium"
              >
                Passer à Business
              </Link>
            ) : (
              <>
                <Link
                  href="/formules"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium"
                >
                  Passer à Pro
                </Link>
                <Link
                  href="/formules"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium"
                >
                  Passer à Business
                </Link>
              </>
            )}
            <Link href="/dashboard" className="inline-flex px-5 py-2.5 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--border)]/20">
              Retour au dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
