'use client'

import { useEffect, useState } from 'react'

const EXPENSE_CATEGORIES = [
  { value: 'Transport', label: 'Transport' },
  { value: 'Matériel', label: 'Matériel' },
  { value: 'Logiciel', label: 'Logiciel' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Autre', label: 'Autre' },
] as const

type BankAccountEntry = { id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CreateExpenseModal({ open, onClose, onSuccess }: Props) {
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountEntry[]>([])
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: 'Autre' as string,
    description: '',
    supplier: '',
    invoiceFile: '',
    companyId: '',
    bankAccountId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/companies').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
    ]).then(([companiesList, settings]) => {
      setCompanies(companiesList ?? [])
      setBankAccounts(Array.isArray(settings?.bankAccounts) ? settings.bankAccounts : [])
    })
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (bankAccounts.length > 0 && !form.bankAccountId.trim()) {
      setError('Veuillez sélectionner un compte bancaire pour enregistrer la dépense.')
      return
    }
    setSaving(true)
    const body = {
      date: form.date,
      amount: Number(form.amount) || 0,
      category: form.category,
      description: form.description.trim() || null,
      supplier: form.supplier.trim() || null,
      invoiceFile: form.invoiceFile.trim() || null,
      companyId: form.companyId.trim() || null,
      bankAccountId: form.bankAccountId.trim() || null,
    }
    try {
      const res = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'enregistrement')
        return
      }
      onSuccess?.()
      onClose()
      setForm({ date: new Date().toISOString().slice(0, 10), amount: '', category: 'Autre', description: '', supplier: '', invoiceFile: '', companyId: '', bankAccountId: '' })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Créer une dépense</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Titre / Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]" placeholder="Ex. Abonnement Slack" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]" required />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Montant (€)</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]" required />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Catégorie</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]">
              {EXPENSE_CATEGORIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {companies.length > 1 && (
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Société</label>
              <select value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]">
                <option value="">— Aucune —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {bankAccounts.length > 0 && (
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Compte en banque (obligatoire)</label>
              <select
                value={form.bankAccountId}
                onChange={(e) => { setForm((f) => ({ ...f, bankAccountId: e.target.value })); setError('') }}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                required
              >
                <option value="">— Sélectionner un compte —</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name || acc.iban || 'Compte'}</option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Fournisseur (optionnel)</label>
            <input type="text" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]" placeholder="Nom du fournisseur" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Lien ou emplacement de la facture</label>
            <input type="text" value={form.invoiceFile} onChange={(e) => setForm((f) => ({ ...f, invoiceFile: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]" placeholder="URL ou chemin (ex: C:\Docs\facture.pdf)" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--border)]/20">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
