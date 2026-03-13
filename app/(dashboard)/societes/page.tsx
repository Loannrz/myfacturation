'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Pencil, Trash2 } from 'lucide-react'

type Company = {
  id: string
  type?: string
  name: string
  legalName: string | null
  email: string | null
  phone: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  siret: string | null
  vatNumber: string | null
  website: string | null
}

export default function SocietesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadCompanies = () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    fetch(`/api/companies?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCompanies)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    loadCompanies()
  }, [q])

  const displayName = (c: Company) => c.legalName?.trim() || c.name?.trim() || '—'
  const displayCity = (c: Company) => [c.postalCode, c.city].filter(Boolean).join(' ') || '—'
  const TYPE_LABELS: Record<string, string> = { societe: 'Société', association: 'Association' }

  const handleDelete = async (c: Company) => {
    if (!confirm(`Supprimer la société « ${displayName(c)} » ?`)) return
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/companies/${c.id}`, { method: 'DELETE' })
      if (res.ok) setCompanies((prev) => prev.filter((x) => x.id !== c.id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sociétés</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Liste des sociétés créées (destinataires factures / devis / avoirs). Pour en ajouter une, utilisez{' '}
          <Link href="/creer" className="text-[var(--foreground)] font-medium hover:underline">Créer → Nouvelle société</Link>.
        </p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="search"
            placeholder="Rechercher une société (nom, raison sociale, email)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
          />
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : companies.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Aucune société. <Link href="/creer" className="text-[var(--foreground)] font-medium hover:underline">Nouvelle société</Link>.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/20">
                <th className="text-left py-3 px-4 text-sm font-medium">Raison sociale / Nom</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Ville</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Email</th>
                <th className="text-left py-3 px-4 text-sm font-medium">SIRET</th>
                <th className="text-right py-3 px-4 text-sm font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/10">
                  <td className="py-3 px-4 text-sm font-medium">{displayName(c)}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{TYPE_LABELS[c.type ?? 'societe'] ?? c.type}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{displayCity(c)}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{c.email || '—'}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{c.siret || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/societes/${c.id}/modifier`}
                        className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)]/30"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        disabled={deletingId === c.id}
                        className="p-2 rounded-lg text-[var(--muted)] hover:text-red-600 hover:bg-red-500/10 disabled:opacity-50"
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
