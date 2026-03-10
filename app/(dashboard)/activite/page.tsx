'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Activity, FileText, FileMinus, Receipt, User, Building2, Wallet, Info } from 'lucide-react'
import { ActivityDetailModal } from './ActivityDetailModal'
import { UpgradeGate } from '../components/UpgradeGate'

type LogItem = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  label: string
  metadata: Record<string, unknown>
  createdAt: string
}

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'invoice', label: 'Factures' },
  { value: 'quote', label: 'Devis' },
  { value: 'credit_note', label: 'Avoirs' },
  { value: 'client', label: 'Clients' },
  { value: 'company', label: 'Sociétés' },
  { value: 'expense', label: 'Dépenses' },
]

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice: Receipt,
  quote: FileText,
  credit_note: FileMinus,
  client: User,
  company: Building2,
  expense: Wallet,
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function ActivitePage() {
  const { data: session } = useSession()
  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detailLog, setDetailLog] = useState<LogItem | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    setLoading(true)
    fetch(`/api/activity?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [type, from, to])

  return (
    <UpgradeGate plan={plan as 'starter' | 'pro' | 'business'} requiredPlan="business" title="Historique d'activité">
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Historique d&apos;activité</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Toutes les actions effectuées dans la facturation</p>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Du</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Au</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          />
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--background)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">Aucune activité sur cette période.</div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {logs.map((log) => {
              const Icon = ICONS[log.entityType] || Activity
              return (
                <li key={log.id} className="flex items-start gap-3 p-4 hover:bg-[var(--border)]/10">
                  <div className="mt-0.5 rounded-full bg-[var(--border)]/30 p-2">
                    <Icon className="w-4 h-4 text-[var(--muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">{log.label}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{formatDate(log.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailLog(log)}
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]"
                    title="Détails"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ActivityDetailModal log={detailLog} onClose={() => setDetailLog(null)} />
    </div>
    </UpgradeGate>
  )
}
