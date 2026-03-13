'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Download, Search, AlertCircle, Pencil, Trash2, Send } from 'lucide-react'
import { canCreateDocument, CANNOT_CREATE_MESSAGE } from '@/lib/can-create-document'

type Quote = {
  id: string
  number: string
  status: string
  totalTTC: number
  currency: string
  issueDate: string
  dueDate: string | null
  signedAt: string | null
  client: { firstName: string; lastName: string; companyName: string | null; email?: string } | null
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
  sent: 'Envoyé',
  signed: 'Signé',
  expired: 'Expiré',
  delivery_failed: 'Non délivré',
}

const statusBadgeClass: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-600 dark:text-slate-400',
  sent: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  signed: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  expired: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  delivery_failed: 'bg-red-500/20 text-red-600 dark:text-red-400',
}

const statusFilterOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyé' },
  { value: 'signed', label: 'Signé' },
  { value: 'expired', label: 'Expiré' },
  { value: 'delivery_failed', label: 'Non délivré' },
]

export default function DevisPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [canCreate, setCanCreate] = useState<boolean | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showSignedDateFor, setShowSignedDateFor] = useState<string | null>(null)
  const [signedDateValue, setSignedDateValue] = useState(() => new Date().toISOString().slice(0, 10))
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [confirmSendQuote, setConfirmSendQuote] = useState<Quote | null>(null)
  const [creatingInvoiceId, setCreatingInvoiceId] = useState<string | null>(null)
  const [clients, setClients] = useState<{ id: string; firstName: string; lastName: string; companyName: string | null }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter) params.set('status', statusFilter)
    if (clientFilter) params.set('clientId', clientFilter)
    if (companyFilter) params.set('companyId', companyFilter)
    fetch(`/api/quotes?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setQuotes)
      .finally(() => setLoading(false))
  }, [q, statusFilter, clientFilter, companyFilter])

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

  const clientName = (quote: Quote) => {
    if (quote.company) return quote.company.name
    if (quote.client) return [quote.client.firstName, quote.client.lastName].filter(Boolean).join(' ') || quote.client.companyName || '—'
    return '—'
  }

  const clientEmail = (quote: Quote): string => {
    const e = quote.client?.email ?? quote.company?.email
    return (typeof e === 'string' ? e.trim() : '') || ''
  }

  const sendQuoteEmail = (quote: Quote) => {
    if (quote.status === 'signed') return
    const email = clientEmail(quote)
    if (!email) {
      setSendError('Veuillez renseigner l\'email du client pour envoyer le devis.')
      return
    }
    setConfirmSendQuote(quote)
  }

  const confirmSendQuoteEmail = async () => {
    const quote = confirmSendQuote
    if (!quote) return
    setConfirmSendQuote(null)
    const email = clientEmail(quote)
    if (!email) return
    setSendError(null)
    setSendingId(quote.id)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send-email`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSendError(data.error || 'L\'email n\'a pas pu être distribué. Vérifiez que l\'adresse du client est valide.')
        setQuotes((prev) => prev.map((qu) => (qu.id === quote.id ? { ...qu, status: 'delivery_failed' } : qu)))
        return
      }
      setQuotes((prev) => prev.map((qu) => (qu.id === quote.id ? { ...qu, status: 'sent' } : qu)))
    } finally {
      setSendingId(null)
    }
  }

  const cancelSendQuote = () => {
    setConfirmSendQuote(null)
  }

  const updateQuoteStatus = async (id: string, status: string, signedDate?: string) => {
    setUpdatingId(id)
    setShowSignedDateFor(null)
    try {
      const body: { status: string; signedDate?: string } = { status }
      if (status === 'signed' && signedDate) body.signedDate = signedDate
      const res = await fetch(`/api/quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        const updated = await res.json()
        setQuotes((prev) => prev.map((qu) => (qu.id === id ? { ...qu, status: updated.status, signedAt: updated.signedAt } : qu)))
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const convertToInvoice = async (quoteId: string, signedDate: string) => {
    setUpdatingId(quoteId)
    setShowSignedDateFor(null)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert-to-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedDate }),
      })
      if (res.ok) {
        const invoice = await res.json()
        setQuotes((prev) => prev.map((qu) => (qu.id === quoteId ? { ...qu, status: 'signed', signedAt: signedDate } : qu)))
        router.push(`/factures?created=${invoice.id}`)
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const createInvoiceFromSignedQuote = async (quote: Quote) => {
    if (quote.status !== 'signed') return
    setCreatingInvoiceId(quote.id)
    try {
      const signedDate = quote.signedAt ? quote.signedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
      const res = await fetch(`/api/quotes/${quote.id}/convert-to-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedDate }),
      })
      if (res.ok) {
        const invoice = await res.json()
        router.push(`/factures/${invoice.id}/modifier`)
      } else {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error || 'Erreur lors de la création de la facture.')
      }
    } finally {
      setCreatingInvoiceId(null)
    }
  }

  const openSignedDatePicker = (id: string) => {
    setSignedDateValue(new Date().toISOString().slice(0, 10))
    setShowSignedDateFor(id)
  }

  const deleteQuote = async (id: string) => {
    if (!confirm('Supprimer ce devis ?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
      if (res.ok) setQuotes((prev) => prev.filter((qu) => qu.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {confirmSendQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="confirm-send-title">
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl max-w-sm w-full p-5">
            <p id="confirm-send-title" className="text-sm text-[var(--foreground)]">
              Vous êtes sûr d&apos;envoyer le devis à cette adresse email&nbsp;:
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)] break-all">{clientEmail(confirmSendQuote)}</p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelSendQuote}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Non
              </button>
              <button
                type="button"
                onClick={() => confirmSendQuoteEmail()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Oui
              </button>
            </div>
          </div>
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
        <h1 className="text-2xl font-semibold tracking-tight">Devis</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Gérez vos devis. Pour en créer un, utilisez la catégorie &laquo;&nbsp;Créer&nbsp;&raquo; dans le menu.</p>
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
          onClick={() => { setQ(''); setStatusFilter(''); setCompanyFilter(''); setClientFilter('') }}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
        >
          Réinitialiser
        </button>
      </div>

      {sendError && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {sendError}
        </div>
      )}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : quotes.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">Aucun devis. Créez-en un pour commencer.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/20">
                <th className="text-left py-3 px-4 text-sm font-medium">Numéro</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Client</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Montant</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Échéance</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/10">
                  <td className="py-3 px-4 text-sm font-medium">{quote.number}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{clientName(quote)}</td>
                  <td className="py-3 px-4 text-sm">
                    {quote.totalTTC.toFixed(2)} {quote.currency}
                  </td>
                  <td className="py-3 px-4">
                    {showSignedDateFor === quote.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={signedDateValue}
                          onChange={(e) => setSignedDateValue(e.target.value)}
                          className="text-xs py-1.5 px-2 border border-[var(--border)] rounded bg-[var(--background)]"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuoteStatus(quote.id, 'signed', signedDateValue)}
                          disabled={!!updatingId}
                          className="text-xs py-1 px-2 rounded bg-[var(--border)]/50 text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-50"
                        >
                          Marquer signé
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSignedDateFor(null)}
                          className="text-xs py-1 px-2 rounded border border-[var(--border)] hover:bg-[var(--border)]/20"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass[quote.status] ?? 'bg-[var(--border)]/30 text-[var(--muted)]'}`}>
                          {statusLabels[quote.status] ?? quote.status}
                          {quote.status === 'signed' && quote.signedAt && (
                            <span className="ml-1.5 font-normal opacity-90">le {formatDateFR(quote.signedAt)}</span>
                          )}
                        </span>
                        {quote.status === 'signed' && (
                          <button
                            type="button"
                            onClick={() => createInvoiceFromSignedQuote(quote)}
                            disabled={!!creatingInvoiceId}
                            className="text-xs py-1 px-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {creatingInvoiceId === quote.id ? 'Création…' : 'Créer la facture'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{quote.dueDate || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => sendQuoteEmail(quote)}
                        disabled={!!sendingId || !clientEmail(quote) || quote.status === 'signed'}
                        title={quote.status === 'signed' ? 'Devis déjà signé, envoi impossible.' : !clientEmail(quote) ? 'Veuillez renseigner l\'email du client pour envoyer le devis.' : 'Envoyer le devis par email'}
                        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Envoyer</span>
                      </button>
                      <Link
                        href={`/devis/${quote.id}/modifier`}
                        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <a
                        href={`/api/quotes/${quote.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                        title="Télécharger PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <select
                        title="Changer le statut"
                        value=""
                        onChange={(e) => {
                          const v = e.target.value
                          e.target.value = ''
                          if (!v) return
                          if (v === 'signed') openSignedDatePicker(quote.id)
                          else updateQuoteStatus(quote.id, v)
                        }}
                        disabled={!!updatingId || showSignedDateFor === quote.id}
                        className="text-xs py-1 px-2 border border-[var(--border)] rounded bg-[var(--background)]"
                      >
                        <option value="">Statut</option>
                        <option value="draft">Brouillon</option>
                        <option value="sent">Envoyé</option>
                        <option value="signed">Signé</option>
                        <option value="expired">Expiré</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => deleteQuote(quote.id)}
                        disabled={!!deletingId}
                        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
