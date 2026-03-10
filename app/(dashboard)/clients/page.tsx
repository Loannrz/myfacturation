'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Plus, Search } from 'lucide-react'

type Client = {
  id: string
  type: string
  firstName: string
  lastName: string
  email: string
  companyName: string | null
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    fetch(`/api/clients?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setClients)
      .finally(() => setLoading(false))
  }, [q])

  const displayName = (c: Client) => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
    return name || c.companyName || c.email || '—'
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Vos clients et sociétés</p>
        </div>
        <Link
          href="/clients/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nouveau client
        </Link>
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
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/10">
                  <td className="py-3 px-4 text-sm font-medium">{displayName(c)}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{c.email}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">
                    {c.type === 'professionnel' ? 'Professionnel' : 'Particulier'}
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