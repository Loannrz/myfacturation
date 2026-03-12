'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Pencil, Trash2 } from 'lucide-react'

type Client = {
  id: string
  type: string
  firstName: string
  lastName: string
  email: string
  companyName: string | null
}

const TYPE_LABELS: Record<string, string> = {
  particulier: 'Particulier',
  professionnel: 'Professionnel',
  association: 'Association',
  entreprise: 'Entreprise',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadClients = () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    fetch(`/api/clients?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setClients)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    loadClients()
  }, [q])

  const displayName = (c: Client) => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
    return name || c.companyName || c.email || '—'
  }

  const handleDelete = async (c: Client) => {
    if (!confirm(`Supprimer le client « ${displayName(c)} » ?`)) return
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/clients/${c.id}`, { method: 'DELETE' })
      if (res.ok) setClients((prev) => prev.filter((x) => x.id !== c.id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Liste de vos clients et sociétés. Pour en ajouter un, utilisez la catégorie &laquo;&nbsp;Créer&nbsp;&raquo; dans le menu.
          {' '}
          <Link href="/creer" className="text-[var(--foreground)] font-medium hover:underline">Créer →</Link>
        </p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Rechercher un client…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
          />
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">Aucun client. Ajoutez-en un pour commencer.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/20">
                <th className="text-left py-3 px-4 text-sm font-medium">Nom</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Email</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Type</th>
                <th className="text-right py-3 px-4 text-sm font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/10">
                  <td className="py-3 px-4 text-sm font-medium">{displayName(c)}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{c.email}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">
                    {TYPE_LABELS[c.type] ?? c.type}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/clients/${c.id}/modifier`}
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