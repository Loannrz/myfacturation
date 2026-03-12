'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { RotateCcw, Download, Search, Pencil, Trash2 } from 'lucide-react'
import { UpgradeGate } from '../components/UpgradeGate'

type CreditNote = {
  id: string
  number: string
  status: string
  totalTTC: number
  currency: string
  issueDate: string
  reason: string | null
  refundedAt: string | null
  invoice: { number: string } | null
  client: { firstName: string; lastName: string; companyName: string | null } | null
  company: { name: string } | null
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  refunded: 'Remboursé',
  cancelled: 'Annulé',
}

const statusBadgeClass: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-600 dark:text-slate-400',
  sent: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  refunded: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  cancelled: 'bg-slate-500/15 text-slate-500 dark:text-slate-500',
}

const statusFilterOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyé' },
  { value: 'refunded', label: 'Remboursé' },
  { value: 'cancelled', label: 'Annulé' },
]

function formatDateFR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export default function AvoirsPage() {
  const { data: session } = useSession()
  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showRefundedDateFor, setShowRefundedDateFor] = useState<string | null>(null)
  const [refundedDateValue, setRefundedDateValue] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/credit-notes?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCreditNotes)
      .finally(() => setLoading(false))
  }, [q, statusFilter])

  const updateCreditNoteStatus = async (id: string, status: string, refundedAt?: string) => {
    setUpdatingId(id)
    setShowRefundedDateFor(null)
    try {
      const res = await fetch(`/api/credit-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(refundedAt && { refundedAt }) }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCreditNotes((prev) => prev.map((cn) => (cn.id === id ? { ...cn, status: updated.status, refundedAt: updated.refundedAt } : cn)))
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const openRefundedDatePicker = (id: string) => {
    setRefundedDateValue(new Date().toISOString().slice(0, 10))
    setShowRefundedDateFor(id)
  }

  const recipientName = (cn: CreditNote) => {
    if (cn.company) return cn.company.name
    if (cn.client) return [cn.client.firstName, cn.client.lastName].filter(Boolean).join(' ') || cn.client.companyName || '—'
    return '—'
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet avoir ?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/credit-notes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCreditNotes((prev) => prev.filter((c) => c.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <UpgradeGate plan={plan as 'starter' | 'pro' | 'business'} requiredPlan="pro" title="Avoirs">
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Avoirs</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Les avoirs réduisent le chiffre d&apos;affaires (factures payées − avoirs). Pour en créer un, utilisez la catégorie &laquo;&nbsp;Créer&nbsp;&raquo; dans le menu.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (numéro, client, description, montant)…" className="w-full pl-9 pr-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] min-w-[180px]"
        >
          {statusFilterOptions.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-[var(--muted)] text-sm">Chargement…</p>
      ) : creditNotes.length === 0 ? (
        <div className="border border-[var(--border)] rounded-xl p-8 text-center text-[var(--muted)]">
          <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Aucun avoir.</p>
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--background)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/20 text-left text-[var(--muted)]">
                  <th className="p-3 font-medium">Numéro</th>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Statut</th>
                  <th className="p-3 font-medium">Destinataire</th>
                  <th className="p-3 font-medium">Facture d&apos;origine</th>
                  <th className="p-3 font-medium text-right">Total TTC</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((cn) => (
                  <tr key={cn.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/10">
                    <td className="p-3 font-medium">{cn.number}</td>
                    <td className="p-3">{formatDateFR(cn.issueDate)}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass[cn.status ?? 'draft'] ?? 'bg-[var(--border)]/30 text-[var(--muted)]'}`}>
                        {statusLabels[cn.status ?? 'draft'] ?? cn.status ?? 'Brouillon'}
                        {cn.status === 'refunded' && cn.refundedAt && (
                          <span className="ml-1.5 font-normal opacity-90">le {formatDateFR(cn.refundedAt)}</span>
                        )}
                      </span>
                      {showRefundedDateFor === cn.id ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <input
                            type="date"
                            value={refundedDateValue}
                            onChange={(e) => setRefundedDateValue(e.target.value)}
                            className="text-xs px-2 py-1 border border-[var(--border)] rounded bg-[var(--background)]"
                          />
                          <button type="button" onClick={() => updateCreditNoteStatus(cn.id, 'refunded', refundedDateValue)} disabled={!!updatingId} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">OK</button>
                          <button type="button" onClick={() => setShowRefundedDateFor(null)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Annuler</button>
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3">{recipientName(cn)}</td>
                    <td className="p-3">{cn.invoice ? cn.invoice.number : '—'}</td>
                    <td className="p-3 text-right">{cn.totalTTC.toFixed(2)} {cn.currency}</td>
                    <td className="p-2 text-right">
                      <Link href={`/avoirs/${cn.id}/modifier`} className="inline-flex items-center gap-1 p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/30 hover:text-[var(--foreground)]" title="Modifier">
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <a href={`/api/credit-notes/${cn.id}/pdf`} download className="inline-flex items-center gap-1 p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/30 hover:text-[var(--foreground)]" title="Télécharger le PDF">
                        <Download className="w-4 h-4" />
                      </a>
                      <select
                        title="Changer le statut"
                        value=""
                        onChange={(e) => {
                          const v = e.target.value
                          e.target.value = ''
                          if (!v) return
                          if (v === 'refunded') openRefundedDatePicker(cn.id)
                          else updateCreditNoteStatus(cn.id, v)
                        }}
                        disabled={!!updatingId || showRefundedDateFor === cn.id}
                        className="text-xs py-1 px-2 border border-[var(--border)] rounded bg-[var(--background)] ml-1"
                      >
                        <option value="">Statut</option>
                        <option value="draft">Brouillon</option>
                        <option value="sent">Envoyé</option>
                        <option value="refunded">Remboursé</option>
                        <option value="cancelled">Annulé</option>
                      </select>
                      <button type="button" onClick={() => handleDelete(cn.id)} disabled={deletingId === cn.id} className="inline-flex items-center gap-1 p-2 rounded-lg text-[var(--muted)] hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </UpgradeGate>
  )
}
