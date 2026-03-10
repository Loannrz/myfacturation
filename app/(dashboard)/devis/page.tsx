'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Plus, Download, Search } from 'lucide-react'

type Quote = {
  id: string
  number: string
  status: string
  totalTTC: number
  currency: string
  issueDate: string
  dueDate: string | null
  client: { firstName: string; lastName: string; companyName: string | null } | null
  company: { name: string } | null
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  signed: 'Signé',
  expired: 'Expiré',
}

export default function DevisPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    fetch(`/api/quotes?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setQuotes)
      .finally(() => setLoading(false))
  }, [q])

  const clientName = (quote: Quote) => {
    if (quote.company) return quote.company.name
    if (quote.client) return [quote.client.firstName, quote.client.lastName].filter(Boolean).join(' ') || quote.client.companyName || '—'
    return '—'
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devis</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Gérez vos devis</p>
        </div>
        <Link
          href="/devis/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nouveau devis
        </Link>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Rechercher par numéro…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
          />
        </div>
      </div>

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
                <th className="w-20" />
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
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-[var(--border)]/30 text-[var(--muted)]">
                      {statusLabels[quote.status] ?? quote.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{quote.dueDate || '—'}</td>
                  <td className="py-3 px-4">
                    <a
                      href={`/api/quotes/${quote.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </a>
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
