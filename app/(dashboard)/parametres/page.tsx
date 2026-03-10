'use client'

import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'

export default function ParametresPage() {
  const [profile, setProfile] = useState<{
    name?: string
    email?: string
    companyName?: string
    siret?: string
    address?: string
    logoUrl?: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([fetch('/api/me').then((r) => r.json()), fetch('/api/settings').then((r) => r.json())])
      .then(([user, settings]) => {
        setProfile({
          name: user.name ?? '',
          email: user.email ?? '',
          companyName: settings.companyName ?? '',
          siret: settings.siret ?? '',
          address: settings.address ?? '',
          logoUrl: settings.logoUrl ?? '',
        })
      })
      .catch(() => setProfile({}))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setMessage('')
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name }),
      })
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: profile.companyName,
          siret: profile.siret,
          address: profile.address,
          logoUrl: profile.logoUrl,
        }),
      })
      setMessage('Paramètres enregistrés.')
    } catch {
      setMessage('Erreur lors de l\'enregistrement.')
    }
    setSaving(false)
  }

  if (!profile) {
    return (
    <div className="max-w-xl mx-auto">
      <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
    </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Profil et informations pour vos factures</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <p className={`text-sm ${message.startsWith('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}

        <div className="border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-medium mb-4">Profil</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm text-[var(--muted)] mb-1">
                Nom
              </label>
              <input
                id="name"
                type="text"
                value={profile.name ?? ''}
                onChange={(e) => setProfile((p) => (p ? { ...p, name: e.target.value } : p))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm text-gray-600 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={profile.email ?? ''}
                readOnly
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--border)]/20 text-[var(--muted)]"
              />
              <p className="text-xs text-[var(--muted)] mt-1">L'email ne peut pas être modifié ici.</p>
            </div>
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-medium mb-4">Informations sur vos factures</h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            Ces informations apparaissent sur vos factures et devis (émetteur).
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm text-[var(--muted)] mb-1">
                Nom de l'entreprise / Raison sociale
              </label>
              <input
                id="companyName"
                type="text"
                value={profile.companyName ?? ''}
                onChange={(e) => setProfile((p) => (p ? { ...p, companyName: e.target.value } : p))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                placeholder="Votre entreprise"
              />
            </div>
            <div>
              <label htmlFor="siret" className="block text-sm text-[var(--muted)] mb-1">
                SIRET
              </label>
              <input
                id="siret"
                type="text"
                value={profile.siret ?? ''}
                onChange={(e) => setProfile((p) => (p ? { ...p, siret: e.target.value } : p))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                placeholder="123 456 789 00012"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm text-[var(--muted)] mb-1">
                Adresse
              </label>
              <textarea
                id="address"
                rows={2}
                value={profile.address ?? ''}
                onChange={(e) => setProfile((p) => (p ? { ...p, address: e.target.value } : p))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                placeholder="Adresse postale"
              />
            </div>
            <div>
              <label htmlFor="logoUrl" className="block text-sm text-[var(--muted)] mb-1">
                URL du logo (optionnel)
              </label>
              <input
                id="logoUrl"
                type="url"
                value={profile.logoUrl ?? ''}
                onChange={(e) => setProfile((p) => (p ? { ...p, logoUrl: e.target.value } : p))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
