'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Activity, FileText, FileMinus, Receipt, User, UserCircle, Building2, Wallet, Info, RotateCcw } from 'lucide-react'
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
  { value: 'employee', label: 'Salariés' },
  { value: 'expense', label: 'Dépenses' },
]

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice: Receipt,
  quote: FileText,
  credit_note: FileMinus,
  client: User,
  company: Building2,
  employee: UserCircle,
  expense: Wallet,
}

/** Segment API pour restore : entityType -> /api/<segment>/[id]/restore */
const RESTORE_API_SEGMENT: Record<string, string> = {
  client: 'clients',
  company: 'companies',
  quote: 'quotes',
  invoice: 'invoices',
  credit_note: 'credit-notes',
  employee: 'employees',
  expense: 'expenses',
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

  const fetchLogs = useCallback(() => {
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

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const canRestore = (log: LogItem) =>
    log.entityId &&
    RESTORE_API_SEGMENT[log.entityType] &&
    (log.action === 'deleted' || String(log.action).endsWith(' deleted'))

  const [restoringId, setRestoringId] = useState<string | null>(null)
  const handleRestore = async (log: LogItem) => {
    if (!log.entityId || !RESTORE_API_SEGMENT[log.entityType]) return
    setRestoringId(log.id)
    try {
      const segment = RESTORE_API_SEGMENT[log.entityType]
      const res = await fetch(`/api/${segment}/${log.entityId}/restore`, { method: 'POST' })
      if (res.ok) fetchLogs()
    } finally {
      setRestoringId(null)
    }
  }

  const typeLabel = (entityType: string, action: string) => {
    const entityLabels: Record<string, string> = {
      invoice: 'Facture',
      quote: 'Devis',
      credit_note: 'Avoir',
      client: 'Client',
      company: 'Société',
      employee: 'Salarié',
      expense: 'Dépense',
    }
    const actionLabels: Record<string, string> = {
      created: 'Création',
      updated: 'Modification',
      deleted: 'Suppression',
      restored: 'Récupération',
      paid: 'Payée',
      sent: 'Envoyé',
      added: 'Ajout',
      'status updated': 'Statut mis à jour',
      'converted to invoice': 'Converti en facture',
    }
    const e = entityLabels[entityType] || entityType
    // L'API renvoie parfois des actions composées (ex. "invoice deleted") : on utilise la dernière partie pour le libellé
    const actionKey = action.includes(' ') ? action.split(' ').pop()! : action
    const a = actionLabels[action] || actionLabels[actionKey] || action
    return `${e} – ${a}`
  }

  return (
    <UpgradeGate plan={plan as 'starter' | 'pro' | 'business'} requiredPlan="business" title="Historique d'activité">
    <div className="max-w-5xl mx-auto">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted)]">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted)]">Type d&apos;action</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted)]">Élément</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted)]">Détails</th>
                  <th className="w-[120px] py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const Icon = ICONS[log.entityType] || Activity
                  const showRestore = canRestore(log)
                  const isRestoring = restoringId === log.id
                  return (
                    <tr key={log.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/5">
                      <td className="py-3 px-4 text-[var(--muted)] whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon className="w-4 h-4 text-[var(--muted)]" />
                          {typeLabel(log.entityType, log.action)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--foreground)]">
                        {(log.metadata?.name as string) || log.entityId || '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--muted)] max-w-[200px] truncate" title={log.label}>
                        {log.label}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {showRestore && (
                            <button
                              type="button"
                              onClick={() => handleRestore(log)}
                              disabled={isRestoring}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 text-xs font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Récupérer
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDetailLog(log)}
                            className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]"
                            title="Détails"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ActivityDetailModal log={detailLog} onClose={() => setDetailLog(null)} onRestore={fetchLogs} />
    </div>
    </UpgradeGate>
  )
}
