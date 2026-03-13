'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Receipt, Download, Search, AlertCircle, Pencil, Trash2, Send } from 'lucide-react'
import { canCreateDocument, CANNOT_CREATE_MESSAGE } from '@/lib/can-create-document'

type Invoice = {
  id: string
  number: string
  status: string
  totalTTC: number
  currency: string
  issueDate: string
  dueDate: string | null
  paidAt: string | null
  overdueDays?: number
  client: { firstName: string; lastName: string; companyName: string | null; email?: string | null } | null
  company: { name: string; email?: string | null } | null
}

function formatDateFR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  pending: 'En attente',
  late: 'En retard',
  cancelled: 'Annulée',
}

const statusBadgeClass: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-600 dark:text-slate-400',
  sent: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  paid: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  late: 'bg-red-500/20 text-red-600 dark:text-red-400',
  cancelled: 'bg-slate-500/15 text-slate-500 dark:text-slate-500',
}

const statusFilterOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyée' },
  { value: 'paid', label: 'Payée' },
  { value: 'pending', label: 'En attente' },
  { value: 'late', label: 'En retard' },
]

const filterOptions = [
  { value: '', label: 'Toutes' },
  { value: 'paid', label: 'Payées' },
  { value: 'unpaid', label: 'Impayées' },
  { value: 'overdue', label: 'En retard' },
]

export default function FacturesPage() {
  const searchParams = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const urlFilter = useMemo(() => searchParams?.get('filter') ?? '', [searchParams])
  const [filter, setFilter] = useState(urlFilter) // Toutes | Payées | Impayées | En retard
  const [loading, setLoading] = useState(true)
  const [canCreate, setCanCreate] = useState<boolean | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showPaidDateFor, setShowPaidDateFor] = useState<string | null>(null)
  const [paidDateValue, setPaidDateValue] = useState(() => new Date().toISOString().slice(0, 10))
  const [clients, setClients] = useState<{ id: string; firstName: string; lastName: string; companyName: string | null }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [confirmSendInvoice, setConfirmSendInvoice] = useState<Invoice | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const clientEmail = (inv: Invoice): string => {
    const e = inv.client?.email ?? inv.company?.email
    return (typeof e === 'string' ? e.trim() : '') || ''
  }

  const sendInvoiceEmail = (inv: Invoice) => {
    if (!clientEmail(inv)) {
      setSendError('Veuillez renseigner l\'email du client pour envoyer la facture.')
      return
    }
    setConfirmSendInvoice(inv)
  }

  const confirmSendInvoiceEmail = async () => {
    const inv = confirmSendInvoice
    if (!inv) return
    setConfirmSendInvoice(null)
    const email = clientEmail(inv)
    if (!email) return
    setSendError(null)
    setSendingId(inv.id)
    try {
      const res = await fetch(`/api/invoices/${inv.id}/send-email`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSendError(data.error || 'L\'email n\'a pas pu être envoyé.')
        return
      }
      setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, status: 'sent' } : i)))
    } finally {
      setSendingId(null)
    }
  }

  const cancelSendInvoice = () => setConfirmSendInvoice(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter) params.set('status', statusFilter)
    if (filter) params.set('filter', filter)
    if (clientFilter) params.set('clientId', clientFilter)
    if (companyFilter) params.set('companyId', companyFilter)
    fetch(`/api/invoices?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setInvoices)
      .finally(() => setLoading(false))
  }, [q, statusFilter, filter, clientFilter, companyFilter])

  useEffect(() => {
    setFilter(urlFilter)
  }, [urlFilter])

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/clients').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/companies').then((r) => (r.ok ? r.json() : [])),
    ]).then(([me, settings, clientsList, companiesList]) => {
      if (me && settings) setCanCreate(canCreateDocument({ name: me.name, ...settings }))
      else setCanCreate(false)
      setClients(Array.isArray(clientsList) ? clientsList : [])
      setCompanies(Array.isArray(companiesList) ? companiesList : [])
    }).catch(() => setCanCreate(false))
  }, [])

  const clientName = (inv: Invoice) => {
    if (inv.company) return inv.company.name
    if (inv.client) return [inv.client.firstName, inv.client.lastName].filter(Boolean).join(' ') || inv.client.companyName || '—'
    return '—'
  }

  const updateInvoiceStatus = async (id: string, status: string, paymentDate?: string) => {
    setUpdatingId(id)
    setShowPaidDateFor(null)
    try {
      const body: { status: string; paymentDate?: string } = { status }
      if (status === 'paid' && paymentDate) body.paymentDate = paymentDate
      const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        const updated = await res.json()
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: updated.status, paidAt: updated.paidAt ?? null } : inv)))
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const openPaidDatePicker = (id: string) => {
    setPaidDateValue(new Date().toISOString().slice(0, 10))
    setShowPaidDateFor(id)
  }

  const deleteInvoice = async (id: string) => {
    if (!confirm('Supprimer cette facture ?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (res.ok) setInvoices((prev) => prev.filter((inv) => inv.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {confirmSendInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="confirm-send-invoice-title">
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl max-w-sm w-full p-5">
            <p id="confirm-send-invoice-title" className="text-sm text-[var(--foreground)]">
              Vous êtes sûr d&apos;envoyer la facture à cette adresse email&nbsp;:
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)] break-all">{clientEmail(confirmSendInvoice)}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">La facture sera jointe au mail (PDF).</p>
            <div className="mt-5 flex gap-3 justify-end">
              <button type="button" onClick={cancelSendInvoice} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors">Non</button>
              <button type="button" onClick={() => confirmSendInvoiceEmail()} className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">Oui</button>
            </div>
          </div>
        </div>
      )}

      {sendError && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {sendError}
        </div>
      )}

      {canCreate === false && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Informations requises</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{CANNOT_CREATE_MESSAGE}</p>
            <Link href="/parametres#etablissements" className="inline-block mt-2 text-sm font-medium text-amber-700 dark:text-amber-200 underline hover:no-underline">
              Remplir dans Paramètres →
            </Link>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Factures</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Gérez vos factures. Pour en créer une, utilisez la catégorie &laquo;&nbsp;Créer&nbsp;&raquo; dans le menu.</p>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="search"
            placeholder="Rechercher (numéro, client, description, montant)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] min-w-[140px]"
          title="Filtre rapide"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] min-w-[180px]"
        >
          {statusFilterOptions.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] min-w-[180px]"
          title="Filtrer par société"
        >
          <option value="">Toutes les sociétés</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] min-w-[180px]"
          title="Filtrer par client"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setQ(''); setFilter(''); setStatusFilter(''); setCompanyFilter(''); setClientFilter('') }}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
        >
          Réinitialiser
        </button>
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">Aucune facture. Créez-en une pour commencer.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/20">
                <th className="text-left py-3 px-4 text-sm font-medium">Numéro</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Client</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Montant</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Échéance</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Retard</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/10">
                  <td className="py-3 px-4 text-sm font-medium">{inv.number}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{clientName(inv)}</td>
                  <td className="py-3 px-4 text-sm">
                    {inv.totalTTC.toFixed(2)} {inv.currency}
                  </td>
                  <td className="py-3 px-4">
                    {showPaidDateFor === inv.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={paidDateValue}
                          onChange={(e) => setPaidDateValue(e.target.value)}
                          className="text-xs py-1.5 px-2 border border-[var(--border)] rounded bg-[var(--background)]"
                        />
                        <button
                          type="button"
                          onClick={() => updateInvoiceStatus(inv.id, 'paid', paidDateValue)}
                          disabled={!!updatingId}
                          className="text-xs py-1 px-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Valider
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPaidDateFor(null)}
                          className="text-xs py-1 px-2 rounded border border-[var(--border)] hover:bg-[var(--border)]/20"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass[inv.status] ?? 'bg-[var(--border)]/30 text-[var(--muted)]'}`}
                        >
                          {statusLabels[inv.status] ?? inv.status}
                          {inv.status === 'paid' && inv.paidAt && (
                            <span className="ml-1.5 font-normal opacity-90">le {formatDateFR(inv.paidAt)}</span>
                          )}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{inv.dueDate || '—'}</td>
                  <td className="py-3 px-4">
                    {inv.overdueDays != null && inv.overdueDays >= 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {inv.overdueDays} jour{inv.overdueDays !== 1 ? 's' : ''} de retard
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => sendInvoiceEmail(inv)}
                        disabled={!!sendingId || !clientEmail(inv)}
                        title={!clientEmail(inv) ? 'Veuillez renseigner l\'email du client.' : 'Envoyer la facture par email (PDF en pièce jointe)'}
                        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Envoyer</span>
                      </button>
                      <Link
                        href={`/factures/${inv.id}/modifier`}
                        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                        title="Télécharger PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <div className="inline-flex items-center gap-2 shrink-0">
                        <select
                          title="Changer le statut"
                          value=""
                          onChange={(e) => {
                            const v = e.target.value
                            e.target.value = ''
                            if (!v) return
                            if (v === 'paid') openPaidDatePicker(inv.id)
                            else updateInvoiceStatus(inv.id, v)
                          }}
                          disabled={!!updatingId || showPaidDateFor === inv.id}
                          className="text-xs py-1 px-2 border border-[var(--border)] rounded bg-[var(--background)]"
                        >
                          <option value="">Statut</option>
                          <option value="draft">Brouillon</option>
                          <option value="sent">Envoyée</option>
                          <option value="paid">Payée</option>
                          <option value="pending">En attente</option>
                          <option value="late">En retard</option>
                          <option value="cancelled">Annulée</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => deleteInvoice(inv.id)}
                          disabled={!!deletingId}
                          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
