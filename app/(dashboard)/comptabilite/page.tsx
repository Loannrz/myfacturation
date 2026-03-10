'use client'

import { useEffect, useState } from 'react'
import { Wallet, Download, Lock } from 'lucide-react'

type Expense = {
  id: string
  date: string
  amount: number
  category: string
  description: string | null
}

export default function ComptabilitePage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    fetch('/api/expenses')
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.ok ? r.json() : []
      })
      .then(setExpenses)
      .finally(() => setLoading(false))
  }, [])

  const handleExport = () => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    window.open(`/api/export/accounting?${params}`, '_blank')
  }

  if (forbidden) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--border)]/30 text-[var(--muted)] mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Fonctionnalité Premium</h2>
        <p className="text-[var(--muted)] text-sm mb-6">
          La comptabilité, les dépenses et l'export sont réservés au plan Premium. Passez à Premium pour y accéder.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comptabilité</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Dépenses et export</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)]"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)]"
          />
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">Aucune dépense enregistrée.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/20">
                <th className="text-left py-3 px-4 text-sm font-medium">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Catégorie</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Montant</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/10">
                  <td className="py-3 px-4 text-sm">{e.date}</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{e.category}</td>
                  <td className="py-3 px-4 text-sm">{e.amount.toFixed(2)} €</td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">{e.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
