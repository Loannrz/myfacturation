'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Mail, UserX, Trash2, ArrowLeft } from 'lucide-react'

type UserDetail = {
  id: string
  name: string | null
  email: string | null
  role?: string
  phone: string | null
  subscriptionPlan: string
  billingCycle: string | null
  suspended: boolean
  createdAt: string
  invoicesCount: number
  quotesCount: number
  clientsCount: number
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [newPlan, setNewPlan] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setUser(data)
        setNewPlan(data.subscriptionPlan)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [id])

  const updatePlan = () => {
    if (!user || !newPlan) return
    fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionPlan: newPlan }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else { setUser((u) => (u ? { ...u, subscriptionPlan: data.subscriptionPlan } : null)); setMessage('Plan mis à jour.') }
      })
      .catch(() => setMessage('Erreur'))
  }

  const resetPassword = () => {
    if (!newPassword || newPassword.length < 8) {
      setMessage('Mot de passe : 8 caractères minimum.')
      return
    }
    fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else { setMessage('Mot de passe réinitialisé.'); setNewPassword('') }
      })
      .catch(() => setMessage('Erreur'))
  }

  const toggleSuspend = () => {
    if (!user) return
    const next = !user.suspended
    fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended: next }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else { setUser((u) => (u ? { ...u, suspended: next } : null)); setMessage(next ? 'Compte suspendu.' : 'Compte réactivé.') }
      })
      .catch(() => setMessage('Erreur'))
  }

  const deleteUser = () => {
    if (!confirm('Supprimer définitivement ce compte et toutes ses données ?')) return
    fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else router.push('/admin/users')
      })
      .catch(() => setMessage('Erreur'))
  }

  const sendResetEmail = () => {
    fetch('/api/admin/send-reset-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setMessage('Email de réinitialisation envoyé.')
        else setMessage(data.error || 'Erreur')
      })
      .catch(() => setMessage('Erreur'))
  }

  if (loading) return <div className="text-[var(--muted)]">Chargement…</div>
  if (!user) return <div className="text-red-500">Utilisateur introuvable. <Link href="/admin/users" className="underline">Retour</Link></div>

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      {message && <p className="p-3 rounded-lg bg-[var(--border)]/30 text-sm">{message}</p>}

      <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)] space-y-4">
        <h2 className="font-semibold text-lg">Profil</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <dt className="text-[var(--muted)]">Nom</dt>
          <dd>{user.name ?? '—'}</dd>
          <dt className="text-[var(--muted)]">Email</dt>
          <dd>{user.email ?? '—'}</dd>
          <dt className="text-[var(--muted)]">Rôle</dt>
          <dd>{user.role === 'admin' ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">Admin</span> : 'Utilisateur'}</dd>
          <dt className="text-[var(--muted)]">Plan</dt>
          <dd>{user.subscriptionPlan}</dd>
          <dt className="text-[var(--muted)]">Cycle</dt>
          <dd>{user.billingCycle ?? 'monthly'}</dd>
          <dt className="text-[var(--muted)]">Inscription</dt>
          <dd>{formatDate(user.createdAt)}</dd>
          <dt className="text-[var(--muted)]">Factures / Devis / Clients</dt>
          <dd>{user.invoicesCount} / {user.quotesCount} / {user.clientsCount}</dd>
          <dt className="text-[var(--muted)]">Statut</dt>
          <dd>{user.suspended ? <span className="text-red-600">Suspendu</span> : 'Actif'}</dd>
        </dl>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)] space-y-4">
        <h2 className="font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
            <button type="button" onClick={updatePlan} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium">
              Changer plan
            </button>
          </div>
          <button type="button" onClick={sendResetEmail} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm">
            <Mail className="w-4 h-4" />
            Envoyer email reset
          </button>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm w-40"
            />
            <button type="button" onClick={resetPassword} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm">
              <Lock className="w-4 h-4" />
              Reset password
            </button>
          </div>
          <button type="button" onClick={toggleSuspend} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${user.suspended ? 'bg-emerald-600 text-white' : 'border border-amber-500 text-amber-600'}`}>
            <UserX className="w-4 h-4" />
            {user.suspended ? 'Réactiver compte' : 'Suspendre compte'}
          </button>
          <button type="button" onClick={deleteUser} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm">
            <Trash2 className="w-4 h-4" />
            Supprimer compte
          </button>
        </div>
      </div>
    </div>
  )
}
