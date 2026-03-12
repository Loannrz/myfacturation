'use client'

import { useState, useEffect } from 'react'
import { CONTRACT_TYPES } from '@/lib/expense-categories'

type Employee = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  position: string | null
  contractType: string | null
  hireDate: string | null
  status: string
  socialSecurityNumber: string | null
  internalNotes: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  /** Pour édition, passer l'employé à modifier */
  editEmployee?: Employee | null
}

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  country: '',
  position: '',
  contractType: '',
  hireDate: '',
  status: 'active' as 'active' | 'inactive',
  socialSecurityNumber: '',
  internalNotes: '',
}

export function CreateEmployeeModal({ open, onClose, onSuccess, editEmployee }: Props) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editEmployee) {
      setForm({
        firstName: editEmployee.firstName ?? '',
        lastName: editEmployee.lastName ?? '',
        email: editEmployee.email ?? '',
        phone: editEmployee.phone ?? '',
        address: editEmployee.address ?? '',
        city: editEmployee.city ?? '',
        postalCode: editEmployee.postalCode ?? '',
        country: editEmployee.country ?? '',
        position: editEmployee.position ?? '',
        contractType: editEmployee.contractType ?? '',
        hireDate: editEmployee.hireDate ?? '',
        status: (editEmployee.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
        socialSecurityNumber: editEmployee.socialSecurityNumber ?? '',
        internalNotes: editEmployee.internalNotes ?? '',
      })
    } else {
      setForm(initialForm)
    }
    setError('')
  }, [open, editEmployee])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const email = form.email.trim().toLowerCase()
    if (!firstName || !lastName || !email) {
      setError('Nom, prénom et email sont obligatoires.')
      return
    }
    setSaving(true)
    try {
      const url = editEmployee ? `/api/employees/${editEmployee.id}` : '/api/employees'
      const method = editEmployee ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          postalCode: form.postalCode.trim() || null,
          country: form.country.trim() || null,
          position: form.position.trim() || null,
          contractType: form.contractType.trim() || null,
          hireDate: form.hireDate.trim().slice(0, 10) || null,
          status: form.status,
          socialSecurityNumber: form.socialSecurityNumber.trim() || null,
          internalNotes: form.internalNotes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'enregistrement')
        return
      }
      onSuccess?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">{editEmployee ? 'Modifier le salarié' : 'Créer un salarié'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Nom</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Prénom</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Téléphone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Adresse</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Ville</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Code postal</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Pays</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Poste dans l&apos;entreprise</label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
              placeholder="Ex. Développeur, Comptable"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Type de contrat</label>
            <select
              value={form.contractType}
              onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
            >
              <option value="">— Choisir —</option>
              {CONTRACT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Date d&apos;embauche</label>
            <input
              type="date"
              value={form.hireDate}
              onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
            />
          </div>
          {editEmployee && (
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Numéro de sécurité sociale (optionnel)</label>
            <input
              type="text"
              value={form.socialSecurityNumber}
              onChange={(e) => setForm((f) => ({ ...f, socialSecurityNumber: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Notes internes</label>
            <textarea
              value={form.internalNotes}
              onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium disabled:opacity-50">
              {saving ? 'Enregistrement…' : editEmployee ? 'Enregistrer' : 'Créer'}
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
