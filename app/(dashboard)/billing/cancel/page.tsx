'use client'

import Link from 'next/link'
import { XCircle } from 'lucide-react'

export default function BillingCancelPage() {
  return (
    <div className="max-w-lg mx-auto text-center py-16 px-4">
      <XCircle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
        Paiement annulé
      </h1>
      <p className="text-[var(--muted)] mb-8">
        Vous avez annulé le paiement. Aucun prélèvement n’a été effectué.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/formules"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-[var(--border)] font-medium text-[var(--foreground)] hover:bg-[var(--border)]/20 transition-colors"
        >
          Choisir une formule
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
        >
          Tableau de bord
        </Link>
      </div>
    </div>
  )
}
