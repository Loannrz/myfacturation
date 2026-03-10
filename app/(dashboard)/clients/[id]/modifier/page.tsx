'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const CLIENT_TYPES = [
  { value: 'particulier', label: 'Particulier' },
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'association', label: 'Association' },
  { value: 'entreprise', label: 'Entreprise' },
] as const
type ClientType = (typeof CLIENT_TYPES)[number]['value']

const isProOrLegal = (t: string) => t === 'professionnel' || t === 'association' || t === 'entreprise'

type ClientData = {
  id: string
  type: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  companyName: string | null
  siret: string | null
  vatNumber: string | null
  address: string | null
  postalCode: string | null
  city: string | null
}

export default function ModifierClientPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [loading, setLoading] = useState(false)
  const [loadingClient, setLoadingClient] = useState(true)
  const [error, setError] = useState('')
  const [type, setType] = useState<ClientType>('particulier')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [siret, setSiret] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/clients/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Client introuvable')
        return r.json()
      })
      .then((c: ClientData) => {
        setType((c.type as ClientType) || 'particulier')
        setFirstName(c.firstName ?? '')
        setLastName(c.lastName ?? '')
        setEmail(c.email ?? '')
        setPhone(c.phone ?? '')
        setCompanyName(c.companyName ?? '')
        setSiret(c.siret ?? '')
        setVatNumber(c.vatNumber ?? '')
        setAddress(c.address ?? '')
        setPostalCode(c.postalCode ?? '')
        setCity(c.city ?? '')
      })
      .catch(() => setError('Client introuvable'))
      .finally(() => setLoadingClient(false))
  }, [id])

  const requireLegal = isProOrLegal(type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (requireLegal) {
      const missing: string[] = []
      if (!companyName.trim()) missing.push('Raison sociale')
      if (!siret.trim()) missing.push('SIRET')
      if (!firstName.trim()) missing.push('Prénom')
      if (!lastName.trim()) missing.push('Nom')
      if (!email.trim()) missing.push('Email')
      if (!address.trim()) missing.push('Adresse')
      if (!postalCode.trim()) missing.push('Code postal')
      if (!city.trim()) missing.push('Ville')
      if (missing.length) {
        setError(`Champs obligatoires pour un client ${type} : ${missing.join(', ')}`)
        return
      }
    } else {
      if (!email.trim()) {
        setError('L’email est obligatoire.')
        return
      }
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          companyName: companyName.trim() || undefined,
          siret: siret.trim() || undefined,
          vatNumber: vatNumber.trim() || undefined,
          address: address.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          city: city.trim() || undefined,
        }),
      })
      if (res.ok) {
        router.push('/clients?updated=' + id)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erreur lors de la mise à jour')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]'

  if (loadingClient) {
    return (
      <div className="max-w-xl mx-auto">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux clients
        </Link>
        <p className="text-[var(--muted)]">Chargement du client…</p>
      </div>
    )
  }

  if (error && !firstName && !email) {
    return (
      <div className="max-w-xl mx-auto">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux clients
        </Link>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/clients"
        className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux clients
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-6">Modifier le client</h1>

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
          <label className="block text-sm text-[var(--muted)] mb-1">Type de client</label>
          <select value={type} onChange={(e) => setType(e.target.value as ClientType)} className={inputClass}>
            {CLIENT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {requireLegal && (
            <p className="text-xs text-[var(--muted)] mt-1">
              Pour les devis et factures, toutes les informations légales (raison sociale, SIRET, adresse complète)
              sont obligatoires.
            </p>
          )}
        </div>

        {requireLegal && (
          <>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Raison sociale *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={inputClass}
                placeholder="Nom de l'entreprise, association ou structure"
              />
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
              <label className="block text-sm text-[var(--muted)] mb-1">N° TVA intracommunautaire (optionnel)</label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className={inputClass}
                placeholder="FR XX XXXXXXXXX"
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Prénom {requireLegal && '*'}</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Nom {requireLegal && '*'}</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Téléphone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Adresse {requireLegal && '*'}</label>
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
            <label className="block text-sm text-[var(--muted)] mb-1">Code postal {requireLegal && '*'}</label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className={inputClass}
              placeholder="75001"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Ville {requireLegal && '*'}</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="Paris" />
          </div>
        </div>
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <Link
            href="/clients"
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium hover:bg-[var(--border)]/20"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
