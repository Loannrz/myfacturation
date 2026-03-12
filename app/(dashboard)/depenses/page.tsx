'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, ExternalLink, Search } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { UpgradeGate } from '../components/UpgradeGate'
import { CreateExpenseModal, type ExpenseForEdit } from '../components/CreateExpenseModal'
import { EXPENSE_CATEGORIES } from '@/lib/expense-categories'

const MONTHS = [
  { value: '', label: 'Tous les mois' },
  { value: '01', label: 'Janvier' },
  { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },
  { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' },
] as const

type Expense = {
  id: string
  date: string
  amount: number
  category: string
  description: string | null
  supplier: string | null
  invoiceFile: string | null
  companyId: string | null
  company: { id: string; name: string } | null
  clientId: string | null
  client: { id: string; firstName: string; lastName: string; companyName: string | null } | null
  employeeId: string | null
  employee: { id: string; firstName: string; lastName: string } | null
  bankAccountId: string | null
}

function formatEuro(v: number) {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatDateFR(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DepensesPage() {
  const { data: session, status } = useSession()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const currentYear = new Date().getFullYear()
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseForEdit | null>(null)

  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const canAccounting = plan === 'pro' || plan === 'business'

  const fetchExpenses = useCallback(() => {
    setLoading(true)
    const from = filterMonth
      ? `${filterYear}-${filterMonth}-01`
      : `${filterYear}-01-01`
    const to = filterMonth
      ? lastDayOfMonth(filterYear, parseInt(filterMonth, 10))
      : `${filterYear}-12-31`
    const params = new URLSearchParams({ from, to })
    if (filterCategory) params.set('category', filterCategory)
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    fetch(`/api/expenses?${params}`)
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.ok ? r.json() : []
      })
      .then(setExpenses)
      .finally(() => setLoading(false))
  }, [filterYear, filterMonth, filterCategory, searchQuery])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!canAccounting) {
      setForbidden(true)
      setLoading(false)
      return
    }
    fetchExpenses()
  }, [status, canAccounting, fetchExpenses])

  const deleteExpense = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) setExpenses((prev) => prev.filter((x) => x.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-[var(--muted)]">
        Chargement…
      </div>
    )
  }

  if (forbidden || !canAccounting) {
    return (
      <UpgradeGate plan={plan as 'starter' | 'pro' | 'business'} requiredPlan="pro" title="Dépenses">
        <div className="max-w-4xl mx-auto" />
      </UpgradeGate>
    )
  }

  const applySearch = () => setSearchQuery(searchInput)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dépenses</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Liste de vos dépenses.
          {' '}
          <button type="button" onClick={() => { setEditingExpense(null); setExpenseModalOpen(true) }} className="text-[var(--foreground)] font-medium hover:underline">Créer une dépense</button>
          {' '}
          ou <Link href="/creer" className="text-[var(--foreground)] font-medium hover:underline">Créer →</Link> (menu)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--muted)]">Année</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          >
            {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--muted)]">Mois</label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          >
            {MONTHS.map((m) => (
              <option key={m.value || 'all'} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--muted)]">Catégorie</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          >
            <option value="">Toutes</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[var(--muted)] shrink-0" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applySearch())}
            placeholder="Rechercher (description, fournisseur)"
            className="flex-1 min-w-0 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          />
          <button
            type="button"
            onClick={applySearch}
            className="px-4 py-2 rounded-lg bg-[var(--border)]/30 hover:bg-[var(--border)]/50 text-sm font-medium"
          >
            Rechercher
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/20 text-left text-[var(--muted)]">
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Description</th>
                  <th className="p-3 font-medium">Catégorie</th>
                  <th className="p-3 font-medium">Pour qui</th>
                  <th className="p-3 font-medium text-right">Montant</th>
                  <th className="p-3 font-medium">Fournisseur</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[var(--muted)]">Aucune dépense. <button type="button" onClick={() => { setEditingExpense(null); setExpenseModalOpen(true) }} className="text-[var(--foreground)] hover:underline">Créer une dépense</button> ou consultez la <Link href="/comptabilite" className="text-[var(--foreground)] hover:underline">Comptabilité</Link>.</td>
                  </tr>
                ) : (
                  expenses.map((e) => {
                    const pourQui = e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : e.company?.name ?? (e.client ? [e.client.firstName, e.client.lastName].filter(Boolean).join(' ') || e.client.companyName : null) ?? 'La boîte'
                    return (
                      <tr key={e.id} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/10">
                        <td className="p-3">{formatDateFR(e.date)}</td>
                        <td className="p-3 max-w-[200px] truncate" title={e.description ?? ''}>{e.description || '—'}</td>
                        <td className="p-3">{e.category}</td>
                        <td className="p-3 text-[var(--muted)]">{pourQui}</td>
                        <td className="p-3 text-right font-medium text-rose-600 dark:text-rose-400">{formatEuro(e.amount)}</td>
                        <td className="p-3">{e.supplier || '—'}</td>
                        <td className="p-3 text-right">
                          {e.invoiceFile && (
                            <a href={e.invoiceFile} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 text-[var(--muted)] hover:text-[var(--foreground)]" title="Voir le reçu">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button type="button" onClick={() => { setEditingExpense(e); setExpenseModalOpen(true) }} className="inline-flex p-2 text-[var(--muted)] hover:text-[var(--foreground)]" title="Modifier">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => deleteExpense(e.id)} disabled={deletingId === e.id} className="inline-flex p-2 text-[var(--muted)] hover:text-rose-500 disabled:opacity-50" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--muted)]">
        Cliquez sur le crayon pour modifier une dépense. Voir les graphiques sur la page <Link href="/comptabilite" className="text-[var(--foreground)] hover:underline">Comptabilité</Link>.
      </p>

      <CreateExpenseModal
        open={expenseModalOpen}
        onClose={() => { setExpenseModalOpen(false); setEditingExpense(null) }}
        onSuccess={() => { fetchExpenses(); setExpenseModalOpen(false); setEditingExpense(null) }}
        editExpense={editingExpense}
      />
    </div>
  )
}
