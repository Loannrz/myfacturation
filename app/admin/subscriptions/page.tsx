'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CreditCard } from 'lucide-react'

type Sub = {
  userId: string
  userName: string | null
  userEmail: string | null
  plan: string
  cycle: string
  status: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
}

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, { plan: string; cycle: string }>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/subscriptions?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setSubs(data.subscriptions ?? [])
        setTotal(data.total ?? 0)
        setTotalPages(data.totalPages ?? 1)
        setEditing({})
      })
      .catch(() => setSubs([]))
      .finally(() => setLoading(false))
  }, [page])

  const saveSubscription = (userId: string) => {
    const e = editing[userId]
    if (!e) return
    fetch('/api/admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, plan: e.plan, cycle: e.cycle }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else { setMessage('Abonnement mis à jour.'); setEditing((prev) => { const n = { ...prev }; delete n[userId]; return n }); setSubs((prev) => prev.map((s) => s.userId === userId ? { ...s, plan: e.plan, cycle: e.cycle } : s)) }
      })
      .catch(() => setMessage('Erreur'))
  }

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Abonnements</h2>
      </div>
      {message && <p className="p-3 rounded-lg bg-[var(--border)]/30 text-sm">{message}</p>}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
                  <th className="text-left p-4 font-medium">Utilisateur</th>
                  <th className="text-left p-4 font-medium">Plan</th>
                  <th className="text-left p-4 font-medium">Cycle</th>
                  <th className="text-left p-4 font-medium">Début</th>
                  <th className="text-left p-4 font-medium">Statut</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const e = editing[s.userId] ?? { plan: s.plan, cycle: s.cycle }
                  return (
                    <tr key={s.userId} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/5">
                      <td className="p-4">
                        <Link href={`/admin/users/${s.userId}`} className="hover:underline font-medium">{s.userName ?? s.userEmail ?? s.userId}</Link>
                        <p className="text-xs text-[var(--muted)]">{s.userEmail}</p>
                      </td>
                      <td className="p-4">
                        <select
                          value={e.plan}
                          onChange={(ev) => setEditing((prev) => ({ ...prev, [s.userId]: { ...prev[s.userId], plan: ev.target.value } }))}
                          className="px-2 py-1 border border-[var(--border)] rounded bg-[var(--background)] text-sm"
                        >
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                          <option value="business">Business</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <select
                          value={e.cycle}
                          onChange={(ev) => setEditing((prev) => ({ ...prev, [s.userId]: { ...prev[s.userId], cycle: ev.target.value } }))}
                          className="px-2 py-1 border border-[var(--border)] rounded bg-[var(--background)] text-sm"
                        >
                          <option value="monthly">Mensuel</option>
                          <option value="yearly">Annuel</option>
                        </select>
                      </td>
                      <td className="p-4">{formatDate(s.startDate ?? s.createdAt)}</td>
                      <td className="p-4">{s.status ?? 'active'}</td>
                      <td className="p-4 text-right">
                        {(editing[s.userId] && (editing[s.userId].plan !== s.plan || editing[s.userId].cycle !== s.cycle)) && (
                          <button type="button" onClick={() => saveSubscription(s.userId)} className="px-3 py-1 rounded bg-violet-600 text-white text-xs">
                            Enregistrer
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">{total} abonnement(s)</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded border border-[var(--border)] text-sm disabled:opacity-50">Précédent</button>
              <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded border border-[var(--border)] text-sm disabled:opacity-50">Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
