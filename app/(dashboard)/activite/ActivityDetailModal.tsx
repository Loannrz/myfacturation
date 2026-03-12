'use client'

import { useEffect, useState } from 'react'
import { X, RotateCcw } from 'lucide-react'

type LogItem = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  label: string
  metadata: Record<string, unknown>
  createdAt: string
}

type ChangeItem = { field: string; oldValue: string | number; newValue: string | number }

/** API qui inclut les entités supprimées (pour afficher les détails et permettre la récupération). */
const ENTITY_DETAILS_API = '/api/activity/entity-details'

const RESTORE_API_SEGMENT: Record<string, string> = {
  company: 'companies',
  quote: 'quotes',
  invoice: 'invoices',
  credit_note: 'credit-notes',
  employee: 'employees',
  expense: 'expenses',
  client: 'clients',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé(e)',
  paid: 'Payé(e)',
  pending: 'En attente',
  late: 'En retard',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
  expired: 'Expiré',
  completed: 'Effectué',
}

const FIELD_LABELS: Record<string, string> = {
  number: 'Numéro',
  status: 'Statut',
  issueDate: 'Date d\'émission',
  dueDate: 'Date d\'échéance',
  totalHT: 'Total HT',
  totalTTC: 'Total TTC',
  vatAmount: 'Montant TVA',
  amount: 'Montant',
  date: 'Date',
  category: 'Catégorie',
  description: 'Description',
  supplier: 'Fournisseur',
  paymentMethod: 'Mode de paiement',
  paymentTerms: 'Conditions de paiement',
  currency: 'Devise',
  reason: 'Motif',
  firstName: 'Prénom',
  lastName: 'Nom',
  email: 'Email',
  companyName: 'Raison sociale',
  name: 'Nom',
  legalName: 'Nom juridique',
  address: 'Adresse',
  city: 'Ville',
  postalCode: 'Code postal',
  siret: 'SIRET',
  vatNumber: 'N° TVA',
}

const AMOUNT_KEYS = ['totalHT', 'totalTTC', 'vatAmount', 'amount', 'unitPrice', 'total']

function formatValue(val: unknown, key?: string): string {
  if (val == null) return '—'
  if (typeof val === 'boolean') return val ? 'Oui' : 'Non'
  if (key === 'status' && typeof val === 'string') return STATUS_LABELS[val] ?? val
  if (typeof val === 'object') return JSON.stringify(val)
  if (key && AMOUNT_KEYS.includes(key) && typeof val === 'number') {
    return `${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
  }
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(val).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return String(val)
}

function renderEntitySection(entity: Record<string, unknown>, title: string, skipKeys: string[] = []) {
  const entries = Object.entries(entity).filter(([k]) => !skipKeys.includes(k) && entity[k] !== undefined && entity[k] !== null && typeof entity[k] !== 'object')
  if (entries.length === 0) return null
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">{title}</h4>
      <dl className="space-y-1.5 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">{FIELD_LABELS[key] || key}</dt>
            <dd className="text-[var(--foreground)] text-right font-medium">{formatValue(value, key)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

type Props = {
  log: LogItem | null
  onClose: () => void
  onRestore?: () => void
}

export function ActivityDetailModal({ log, onClose, onRestore }: Props) {
  const [entity, setEntity] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (!log?.entityId || !log.entityType) {
      setEntity(null)
      return
    }
    const url = `${ENTITY_DETAILS_API}?entityType=${encodeURIComponent(log.entityType)}&entityId=${encodeURIComponent(log.entityId)}`
    setLoading(true)
    setError(null)
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('Introuvable')
        return r.json()
      })
      .then((data) => setEntity(data))
      .catch(() => setError('Impossible de charger les détails'))
      .finally(() => setLoading(false))
  }, [log?.id, log?.entityId, log?.entityType])

  const canRestore = log?.entityId && RESTORE_API_SEGMENT[log.entityType] && (log.action === 'deleted' || String(log.action).endsWith(' deleted'))
  const handleRestore = async () => {
    if (!log?.entityId || !onRestore) return
    const segment = RESTORE_API_SEGMENT[log.entityType]
    if (!segment) return
    setRestoring(true)
    try {
      const res = await fetch(`/api/${segment}/${log.entityId}/restore`, { method: 'POST' })
      if (res.ok) {
        onRestore()
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Impossible de récupérer')
      }
    } catch {
      setError('Impossible de récupérer')
    } finally {
      setRestoring(false)
    }
  }

  if (!log) return null

  const changes = (log.metadata?.changes as ChangeItem[] | undefined) ?? []
  const isUpdate = /updated|modifié|status updated/i.test(log.action)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold">Détails de l&apos;activité</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-[var(--muted)] mb-3">{log.label}</p>
          <p className="text-xs text-[var(--muted)] mb-4">
            {new Date(log.createdAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          {loading && <p className="text-sm text-[var(--muted)]">Chargement des informations…</p>}
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {canRestore && onRestore && !loading && (
            <div className="mb-4">
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 text-sm font-medium disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {restoring ? 'Récupération…' : 'Récupérer cet élément'}
              </button>
            </div>
          )}
          {!loading && !error && entity && (
            <>
              {renderEntitySection(entity, 'Informations', ['client', 'company', 'invoice', 'lines', 'user', 'userId', 'createdAt', 'updatedAt', 'deletedAt'])}
              {(() => {
                const client = entity.client as { firstName?: string; lastName?: string; companyName?: string } | null
                if (!client || typeof client !== 'object') return null
                const name = [client.firstName, client.lastName].filter(Boolean).join(' ') || client.companyName || '—'
                return (
                  <div className="mb-4" key="client">
                    <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Client / Destinataire</h4>
                    <p className="text-sm text-[var(--foreground)]">{name}</p>
                  </div>
                )
              })()}
              {(() => {
                const company = entity.company as { name?: string } | null
                if (!company || typeof company !== 'object') return null
                return (
                  <div className="mb-4" key="company">
                    <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Société</h4>
                    <p className="text-sm text-[var(--foreground)]">{company.name ?? '—'}</p>
                  </div>
                )
              })()}
              {Array.isArray(entity.lines) && (entity.lines as unknown[]).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Lignes ({(entity.lines as unknown[]).length})</h4>
                  <ul className="text-sm space-y-1">
                    {(entity.lines as { description?: string; quantity?: number; unitPrice?: number; total?: number }[]).slice(0, 10).map((line, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="text-[var(--muted)] truncate max-w-[200px]">{line.description || '—'}</span>
                        <span className="font-medium">{line.quantity} × {formatValue(line.unitPrice, 'unitPrice')} = {formatValue(line.total, 'total')}</span>
                      </li>
                    ))}
                    {(entity.lines as unknown[]).length > 10 && <li className="text-[var(--muted)]">… et {(entity.lines as unknown[]).length - 10} autres</li>}
                  </ul>
                </div>
              )}
            </>
          )}

          {isUpdate && changes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Qu&apos;est-ce qui a été modifié</h4>
              <ul className="space-y-2 text-sm">
                {changes.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[var(--muted)] shrink-0">{c.field} :</span>
                    <span className="line-through bg-rose-500/20 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded">
                      {formatValue(c.oldValue)}
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                      {formatValue(c.newValue)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!log.entityId && Object.keys(log.metadata).length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Métadonnées</h4>
              <pre className="p-2 rounded bg-[var(--border)]/20 text-xs overflow-auto max-h-32">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
