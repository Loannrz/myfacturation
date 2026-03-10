'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Receipt, Euro, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    totalRevenue?: number
    totalInvoices?: number
    totalQuotes?: number
    paidInvoices?: number
    pendingInvoices?: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  const cards = [
    { label: "Chiffre d'affaires", value: stats?.totalRevenue ?? 0, format: (v: number) => `${v.toFixed(2)} €`, icon: Euro },
    { label: 'Total factures', value: stats?.totalInvoices ?? 0, format: (v: number) => String(v), icon: Receipt },
    { label: 'Total devis', value: stats?.totalQuotes ?? 0, format: (v: number) => String(v), icon: FileText },
    { label: 'Factures payées', value: stats?.paidInvoices ?? 0, format: (v: number) => String(v), icon: TrendingUp },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Vue d'ensemble de votre activité</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map(({ label, value, format, icon: Icon }) => (
          <div
            key={label}
            className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--muted)]">{label}</span>
              <Icon className="w-5 h-5 text-[var(--muted)]" />
            </div>
            <p className="mt-2 text-xl font-semibold">{format(value)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/factures"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20 transition-colors"
        >
          <Receipt className="w-4 h-4" />
          Voir les factures
        </Link>
        <Link
          href="/devis"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Voir les devis
        </Link>
      </div>
    </div>
  )
}
