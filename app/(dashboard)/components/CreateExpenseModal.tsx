'use client'

import { useEffect, useState } from 'react'
import { EXPENSE_CATEGORIES, SALAIRES_CATEGORY_VALUE } from '@/lib/expense-categories'
import { parseEmitterProfiles } from '@/lib/billing-settings'

type BankAccountEntry = { id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }

type EmployeeOption = { id: string; firstName: string; lastName: string }
type ClientOption = { id: string; firstName: string; lastName: string; companyName: string | null }

export type ExpenseForEdit = {
  id: string
  date: string
  amount: number
  category: string
  description: string | null
  supplier: string | null
  invoiceFile: string | null
  companyId: string | null
  clientId?: string | null
  employeeId: string | null
  bankAccountId: string | null
  company?: { id: string; name: string } | null
  client?: { id: string; firstName: string; lastName: string; companyName: string | null } | null
  employee?: { id: string; firstName: string; lastName: string } | null
}

type BeneficiaryType = 'company' | 'client' | 'employee' | 'own_company'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  editExpense?: ExpenseForEdit | null
}

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  category: 'Autres dépenses' as string,
  description: '',
  supplier: '',
  invoiceFile: '',
  companyId: '',
  clientId: '',
  bankAccountId: '',
  employeeId: '',
  beneficiaryType: 'own_company' as BeneficiaryType,
}

export function CreateExpenseModal({ open, onClose, onSuccess, editExpense }: Props) {
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountEntry[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [ownCompanyName, setOwnCompanyName] = useState<string>('')
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/companies').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/clients').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/employees').then((r) => (r.status === 403 ? [] : r.ok ? r.json() : [])),
    ]).then(([companiesList, clientsList, settings, employeesList]) => {
      setCompanies(companiesList ?? [])
      setClients(clientsList ?? [])
      setBankAccounts(Array.isArray(settings?.bankAccounts) ? settings.bankAccounts : [])
      setEmployees(Array.isArray(employeesList) ? employeesList : [])
      const profiles = parseEmitterProfiles(typeof (settings as { emitterProfiles?: string } | null)?.emitterProfiles === 'string' ? (settings as { emitterProfiles: string }).emitterProfiles : null)
      const name = (settings as { companyName?: string } | null)?.companyName || profiles[0]?.companyName || 'Ma société'
      setOwnCompanyName(name)
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    if (editExpense) {
      const isSalaires = editExpense.category === SALAIRES_CATEGORY_VALUE
      let beneficiaryType: BeneficiaryType = 'own_company'
      if (isSalaires && editExpense.employeeId) beneficiaryType = 'employee'
      else if (editExpense.companyId) beneficiaryType = 'company'
      else if (editExpense.clientId) beneficiaryType = 'client'
      else if (editExpense.employeeId) beneficiaryType = 'employee'
      setForm({
        date: editExpense.date.slice(0, 10),
        amount: String(editExpense.amount),
        category: editExpense.category,
        description: editExpense.description ?? '',
        supplier: editExpense.supplier ?? '',
        invoiceFile: editExpense.invoiceFile ?? '',
        companyId: editExpense.companyId ?? '',
        clientId: editExpense.clientId ?? '',
        bankAccountId: editExpense.bankAccountId ?? '',
        employeeId: editExpense.employeeId ?? '',
        beneficiaryType,
      })
    } else {
      setForm({ ...initialForm, date: new Date().toISOString().slice(0, 10) })
    }
    setError('')
  }, [open, editExpense])

  const isSalaires = form.category === SALAIRES_CATEGORY_VALUE
  const effectiveBeneficiaryType: BeneficiaryType = isSalaires ? 'employee' : form.beneficiaryType

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (bankAccounts.length > 0 && !form.bankAccountId.trim()) {
      setError('Veuillez sélectionner un compte bancaire pour enregistrer la dépense.')
      return
    }
    setSaving(true)
    let companyId: string | null = null
    let clientId: string | null = null
    let employeeId: string | null = null
    if (isSalaires) {
      employeeId = form.employeeId.trim() || null
    } else {
      switch (form.beneficiaryType) {
        case 'company':
          companyId = form.companyId.trim() || null
          break
        case 'client':
          clientId = form.clientId.trim() || null
          break
        case 'employee':
          employeeId = form.employeeId.trim() || null
          break
        case 'own_company':
          break
      }
    }
    const body = {
      date: form.date,
      amount: Number(form.amount) || 0,
      category: form.category,
      description: form.description.trim() || null,
      supplier: form.supplier.trim() || null,
      invoiceFile: form.invoiceFile.trim() || null,
      companyId,
      clientId,
      employeeId,
      bankAccountId: form.bankAccountId.trim() || null,
    }
    try {
      const url = editExpense ? `/api/expenses/${editExpense.id}` : '/api/expenses'
      const method = editExpense ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'enregistrement')
        return
      }
      onSuccess?.()
      onClose()
      setForm({ ...initialForm, date: new Date().toISOString().slice(0, 10) })
    } finally {
      setSaving(false)
    }
  }

  const handleCategoryChange = (category: string) => {
    setForm((f) => ({
      ...f,
      category,
      employeeId: category === SALAIRES_CATEGORY_VALUE ? f.employeeId : '',
      companyId: category === SALAIRES_CATEGORY_VALUE ? '' : f.companyId,
      clientId: category === SALAIRES_CATEGORY_VALUE ? '' : f.clientId,
      beneficiaryType: category === SALAIRES_CATEGORY_VALUE ? 'employee' : f.beneficiaryType,
    }))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{editExpense ? 'Modifier la dépense' : 'Créer une dépense'}</h3>
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
            <select value={form.category} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]">
              {EXPENSE_CATEGORIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {isSalaires ? (
            employees.length > 0 && (
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Salarié concerné</label>
                <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]">
                  <option value="">— Choisir un salarié —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Pour qui ?</label>
                <div className="flex flex-wrap gap-3">
                  {companies.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="beneficiary" checked={effectiveBeneficiaryType === 'company'} onChange={() => setForm((f) => ({ ...f, beneficiaryType: 'company', clientId: '', employeeId: '' }))} className="rounded-full" />
                      <span className="text-sm">Société</span>
                    </label>
                  )}
                  {clients.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="beneficiary" checked={effectiveBeneficiaryType === 'client'} onChange={() => setForm((f) => ({ ...f, beneficiaryType: 'client', companyId: '', employeeId: '' }))} className="rounded-full" />
                      <span className="text-sm">Particulier</span>
                    </label>
                  )}
                  {employees.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="beneficiary" checked={effectiveBeneficiaryType === 'employee'} onChange={() => setForm((f) => ({ ...f, beneficiaryType: 'employee', companyId: '', clientId: '' }))} className="rounded-full" />
                      <span className="text-sm">Salarié</span>
                    </label>
                  )}
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="beneficiary" checked={effectiveBeneficiaryType === 'own_company'} onChange={() => setForm((f) => ({ ...f, beneficiaryType: 'own_company', companyId: '', clientId: '', employeeId: '' }))} className="rounded-full" />
                    <span className="text-sm">La boîte</span>
                  </label>
                </div>
              </div>
              {effectiveBeneficiaryType === 'company' && companies.length > 0 && (
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Choisir la société</label>
                  <select value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]">
                    <option value="">— Choisir —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {effectiveBeneficiaryType === 'client' && clients.length > 0 && (
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Choisir le particulier</label>
                  <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]">
                    <option value="">— Choisir —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {effectiveBeneficiaryType === 'employee' && employees.length > 0 && (
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Choisir le salarié</label>
                  <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]">
                    <option value="">— Choisir —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                    ))}
                  </select>
                </div>
              )}
              {effectiveBeneficiaryType === 'own_company' && (
                <p className="text-sm text-[var(--muted)] py-2 px-3 rounded-lg bg-[var(--border)]/20">
                  Pour <strong className="text-[var(--foreground)]">{ownCompanyName}</strong>
                </p>
              )}
            </>
          )}

          {bankAccounts.length > 0 && (
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Compte en banque{bankAccounts.length > 1 ? ' (obligatoire)' : ''}</label>
              <select
                value={form.bankAccountId}
                onChange={(e) => { setForm((f) => ({ ...f, bankAccountId: e.target.value })); setError('') }}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                required={bankAccounts.length > 0}
              >
                <option value="">— Sélectionner un compte —</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name || acc.iban || 'Compte'}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Fournisseur (optionnel)</label>
            <input type="text" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]" placeholder="Nom du fournisseur" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Lien ou emplacement de la facture</label>
            <input type="text" value={form.invoiceFile} onChange={(e) => setForm((f) => ({ ...f, invoiceFile: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]" placeholder="URL ou chemin" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium disabled:opacity-50">
              {saving ? 'Enregistrement…' : editExpense ? 'Enregistrer' : 'Créer'}
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
