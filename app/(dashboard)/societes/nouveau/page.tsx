'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const COMPANY_TYPES = [
  { value: 'societe', label: 'Société' },
  { value: 'association', label: 'Association' },
] as const

export default function NouvelleSocietePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState<'societe' | 'association'>('societe')
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [siret, setSiret] = useState('')
  const [vatExempt, setVatExempt] = useState(false)
  const [vatNumber, setVatNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const missing: string[] = []
    if (!name.trim()) missing.push('Nom')
    if (!legalName.trim()) missing.push('Raison sociale')
    if (!email.trim()) missing.push('Email')
    if (!address.trim()) missing.push('Adresse')
    if (!postalCode.trim()) missing.push('Code postal')
    if (!city.trim()) missing.push('Ville')
    if (!country.trim()) missing.push('Pays')
    if (!siret.trim()) missing.push('SIRET')
    if (!vatExempt && !vatNumber.trim()) missing.push('N° TVA ou cocher « Non assujetti à la TVA »')
    if (missing.length) {
      setError(`Champs obligatoires manquants : ${missing.join(', ')}.`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: name.trim(),
          legalName: legalName.trim() || undefined,
          address: address.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          siret: siret.trim() || undefined,
          vatExempt,
          vatNumber: vatExempt ? undefined : (vatNumber.trim() || undefined),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
        }),
      })
      if (res.ok) {
        const company = await res.json()
        router.push(`/societes?created=${company.id}`)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erreur lors de la création')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]'

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/societes"
        className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux sociétés
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-6">Nouvelle société</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]"
      >
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'societe' | 'association')}
            className={inputClass}
          >
            {COMPANY_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Nom d'affichage"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Raison sociale *</label>
          <input
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className={inputClass}
            placeholder="Raison sociale officielle"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Téléphone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Adresse *</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
            placeholder="Numéro et nom de rue"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Code postal *</label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className={inputClass}
              placeholder="75001"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Ville *</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="Paris" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Pays *</label>
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} placeholder="France" />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">SIRET *</label>
          <input
            type="text"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            className={inputClass}
            placeholder="123 456 789 00012"
          />
        </div>
        <div>
          <button
            type="button"
            onClick={() => setVatExempt((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              vatExempt
                ? 'border-[var(--muted)] bg-[var(--border)]/30 text-[var(--foreground)]'
                : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--muted)]'
            }`}
          >
            Non assujetti à la TVA
          </button>
          {vatExempt && (
            <p className="text-xs text-[var(--muted)] mt-1">
              La mention « Non assujetti à la TVA » sera affichée sur les devis, factures et avoirs.
            </p>
          )}
        </div>
        {!vatExempt && (
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">N° TVA intracommunautaire *</label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className={inputClass}
              placeholder="FR XX XXXXXXXXX"
            />
          </div>
        )}
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Site web</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Création…' : 'Créer la société'}
          </button>
          <Link
            href="/societes"
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium hover:bg-[var(--border)]/20"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
