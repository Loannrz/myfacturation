'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Search, Calendar } from 'lucide-react'

type InvoiceRow = {
  stripeInvoiceId: string
  invoiceNumber: string
  amountFormatted: string
  dateFormatted: string
  userEmail: string | null
  userName: string | null
  planLabel: string
}

export default function AdminInvoicesPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [search, setSearch] = useState('')
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [zipLoading, setZipLoading] = useState(false)

  const fetchInvoices = () => {
    setLoading(true)
    const params = new URLSearchParams({ month })
    if (search.trim()) params.set('search', search.trim())
    fetch(`/api/admin/subscription-invoices?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setInvoices(data.invoices ?? [])
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchInvoices()
  }, [month])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchInvoices()
  }

  const downloadPdf = (invoiceId: string) => {
    window.open(`/api/admin/subscription-invoices/pdf?invoiceId=${encodeURIComponent(invoiceId)}`, '_blank', 'noopener,noreferrer')
  }

  const downloadZip = () => {
    setZipLoading(true)
    const params = new URLSearchParams({ month })
    if (search.trim()) params.set('search', search.trim())
    fetch(`/api/admin/subscription-invoices/zip?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Aucune facture pour ce mois' : 'Erreur')
        return r.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `factures-abonnements-${month}.zip`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch((err) => alert(err.message || 'Erreur lors du téléchargement'))
      .finally(() => setZipLoading(false))
  }

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  })()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Factures d&apos;abonnements</h2>
        <p className="text-sm text-[var(--muted)] mt-1">
          Consulter et télécharger les factures des abonnements Stripe (myfacturation360 By Myeventoo) par mois.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--muted)]" />
          <label htmlFor="month" className="text-sm font-medium">Mois</label>
          <input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          />
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 items-center">
          <Search className="w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par utilisateur (email, nom)"
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm w-56 md:w-72"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium"
          >
            Filtrer
          </button>
        </form>
        <button
          type="button"
          onClick={downloadZip}
          disabled={zipLoading || invoices.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium text-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {zipLoading ? 'Génération…' : `Télécharger tout ${monthLabel} (ZIP)`}
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Aucune facture payée pour ce mois{search.trim() ? ' (ou aucun résultat pour la recherche)' : ''}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
                  <th className="text-left p-4 font-medium">Utilisateur</th>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Formule</th>
                  <th className="text-left p-4 font-medium">N° facture</th>
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-right p-4 font-medium">Montant</th>
                  <th className="text-right p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((row) => (
                  <tr key={row.stripeInvoiceId} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/5">
                    <td className="p-4">{row.userName ?? '—'}</td>
                    <td className="p-4">{row.userEmail ?? '—'}</td>
                    <td className="p-4">{row.planLabel}</td>
                    <td className="p-4 font-mono text-xs">{row.invoiceNumber}</td>
                    <td className="p-4">{row.dateFormatted}</td>
                    <td className="p-4 text-right font-medium">{row.amountFormatted}</td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => downloadPdf(row.stripeInvoiceId)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--border)]/20"
                      >
                        <FileText className="w-3 h-3" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
