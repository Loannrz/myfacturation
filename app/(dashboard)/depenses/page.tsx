'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, ExternalLink, Wallet } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { CreateExpenseModal } from '../components/CreateExpenseModal'
import { UpgradeGate } from '../components/UpgradeGate'

const EXPENSE_CATEGORIES = [
  { value: 'Transport', label: 'Transport' },
  { value: 'Matériel', label: 'Matériel' },
  { value: 'Logiciel', label: 'Logiciel' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Autre', label: 'Autre' },
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

export default function DepensesPage() {
  const { data: session, status } = useSession()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const canAccounting = plan === 'pro' || plan === 'business'

  const fetchExpenses = () => {
    const year = new Date().getFullYear()
    fetch(`/api/expenses?from=${year}-01-01&to=${year}-12-31`)
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.ok ? r.json() : []
      })
      .then(setExpenses)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!canAccounting) {
      setForbidden(true)
      setLoading(false)
      return
    }
    fetchExpenses()
  }, [status, canAccounting])

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dépenses</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Toutes vos dépenses (année en cours)</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90"
        >
          <Wallet className="w-4 h-4" />
          Créer une dépense
        </button>
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
                  <th className="p-3 font-medium">Société</th>
                  <th className="p-3 font-medium text-right">Montant</th>
                  <th className="p-3 font-medium">Fournisseur</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[var(--muted)]">Aucune dépense. Créez-en une ou consultez la <Link href="/comptabilite" className="text-[var(--foreground)] hover:underline">Comptabilité</Link>.</td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/10">
                      <td className="p-3">{formatDateFR(e.date)}</td>
                      <td className="p-3 max-w-[200px] truncate" title={e.description ?? ''}>{e.description || '—'}</td>
                      <td className="p-3">{e.category}</td>
                      <td className="p-3 text-[var(--muted)]">{e.company?.name ?? '—'}</td>
                      <td className="p-3 text-right font-medium text-rose-600 dark:text-rose-400">{formatEuro(e.amount)}</td>
                      <td className="p-3">{e.supplier || '—'}</td>
                      <td className="p-3 text-right">
                        {e.invoiceFile && (
                          <a href={e.invoiceFile} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 text-[var(--muted)] hover:text-[var(--foreground)]" title="Voir le reçu">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <Link href={`/comptabilite?edit=${e.id}`} className="inline-flex p-2 text-[var(--muted)] hover:text-[var(--foreground)]" title="Modifier (Comptabilité)">
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button type="button" onClick={() => deleteExpense(e.id)} disabled={deletingId === e.id} className="inline-flex p-2 text-[var(--muted)] hover:text-rose-500 disabled:opacity-50" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--muted)]">
        Pour modifier une dépense ou voir les graphiques, allez sur la page <Link href="/comptabilite" className="text-[var(--foreground)] hover:underline">Comptabilité</Link>.
      </p>

      <CreateExpenseModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onSuccess={fetchExpenses} />
    </div>
  )
}
