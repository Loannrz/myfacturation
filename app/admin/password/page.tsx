'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'

export default function AdminPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (newPassword.length < 8) {
      setMessage('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('Les deux nouveaux mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else {
          setMessage('Mot de passe mis à jour.')
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        }
      })
      .catch(() => setMessage('Erreur réseau'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-2">
        <Lock className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Modifier mon mot de passe</h2>
      </div>
      <p className="text-sm text-[var(--muted)]">
        Changez le mot de passe de votre compte administrateur. Vous devrez vous reconnecter après modification.
      </p>
      <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] p-6 space-y-4">
        {message && (
          <p className={`text-sm ${message.includes('incorrect') || message.includes('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Mot de passe actuel</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Nouveau mot de passe (min. 8 car.)</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium text-sm disabled:opacity-50"
        >
          {loading ? 'Modification…' : 'Modifier le mot de passe'}
        </button>
      </form>
    </div>
  )
}
