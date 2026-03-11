'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Eye, Mail, UserPlus, Send, ChevronDown, Trash2 } from 'lucide-react'

type UserRow = {
  id: string
  name: string | null
  email: string | null
  plan: string
  billingCycle: string | null
  suspended: boolean
  createdAt: string
  invoicesCount: number
  quotesCount: number
  clientsCount: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingReset, setSendingReset] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createName, setCreateName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createMessage, setCreateMessage] = useState('')
  const [emailMenuOpen, setEmailMenuOpen] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const EMAIL_OPTIONS = [
    { id: 'welcome', label: 'Email bienvenue' },
    { id: 'trial_start', label: 'Email début essai' },
    { id: 'trial_ending', label: 'Email fin essai' },
    { id: 'payment_success', label: 'Email paiement réussi' },
    { id: 'cancellation', label: 'Email annulation' },
    { id: 'weekly', label: 'Email hebdomadaire' },
  ] as const

  const sendTransactionalEmail = (userId: string, type: string) => {
    setEmailMenuOpen(null)
    setSendingEmail(`${userId}-${type}`)
    fetch('/api/admin/send-transactional-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, userId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) alert(`Email envoyé à l'utilisateur.`)
        else alert(data.error || 'Erreur')
      })
      .catch(() => alert('Erreur'))
      .finally(() => setSendingEmail(null))
  }

  const fetchUsers = (p = page, q?: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (q?.trim()) params.set('search', q.trim())
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setUsers(data.users)
        setTotal(data.total)
        setTotalPages(data.totalPages ?? 1)
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers(page, search)
  }, [page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchUsers(1, search)
  }

  const sendResetEmail = (userId: string) => {
    setSendingReset(userId)
    fetch('/api/admin/send-reset-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) alert('Email envoyé.')
        else alert(data.error || 'Erreur')
      })
      .catch(() => alert('Erreur'))
      .finally(() => setSendingReset(null))
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

  const deleteUser = (userId: string, userName: string | null) => {
    if (!confirm(`Supprimer définitivement le compte ${userName || userId} et toutes ses données ?`)) return
    setDeletingId(userId)
    fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) alert(data.error)
        else setUsers((prev) => prev.filter((u) => u.id !== userId))
      })
      .catch(() => alert('Erreur'))
      .finally(() => setDeletingId(null))
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    setCreateMessage('')
    if (!createEmail.trim() || !createPassword) {
      setCreateMessage('Email et mot de passe requis.')
      return
    }
    if (!createName.trim()) {
      setCreateMessage('Le nom est obligatoire.')
      return
    }
    if (createPassword.length < 8) {
      setCreateMessage('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setCreateLoading(true)
    fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        email: createEmail.trim().toLowerCase(),
        password: createPassword,
        name: createName.trim(),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setCreateMessage(data.error)
          return
        }
        setCreateEmail('')
        setCreatePassword('')
        setCreateName('')
        setShowCreateForm(false)
        setCreateMessage('Compte créé. L\'utilisateur peut se connecter avec cet email et ce mot de passe.')
        fetchUsers(page, search)
      })
      .catch(() => setCreateMessage('Erreur réseau'))
      .finally(() => setCreateLoading(false))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Utilisateurs</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowCreateForm((v) => !v); setCreateMessage(''); }}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Créer un compte
          </button>
          <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (email, nom)"
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm w-48 md:w-64"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4" />
            Rechercher
          </button>
        </form>
        </div>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
          <h3 className="font-medium mb-4">Nouveau compte</h3>
          {createMessage && (
            <p className={`text-sm mb-4 ${createMessage.startsWith('Compte créé') ? 'text-green-600' : 'text-red-600'}`}>{createMessage}</p>
          )}
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Email *</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="utilisateur@exemple.com"
                required
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Mot de passe * (min. 8 car.)</label>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Nom *</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Jean Dupont"
                required
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={createLoading}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {createLoading ? 'Création…' : 'Créer le compte'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setCreateMessage(''); setCreateEmail(''); setCreatePassword(''); setCreateName(''); }}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
                  <th className="text-left p-4 font-medium">ID</th>
                  <th className="text-left p-4 font-medium">Nom</th>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Plan</th>
                  <th className="text-left p-4 font-medium">Inscription</th>
                  <th className="text-left p-4 font-medium">Statut</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/5">
                    <td className="p-4 font-mono text-xs text-[var(--muted)]">{u.id.slice(0, 8)}…</td>
                    <td className="p-4">{u.name ?? '—'}</td>
                    <td className="p-4">{u.email ?? '—'}</td>
                    <td className="p-4">{u.plan}</td>
                    <td className="p-4">{formatDate(u.createdAt)}</td>
                    <td className="p-4">
                      {u.suspended ? <span className="text-red-600 font-medium">Suspendu</span> : <span className="text-emerald-600">Actif</span>}
                    </td>
                    <td className="p-4 text-right flex flex-wrap justify-end gap-1">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--border)]/20"
                      >
                        <Eye className="w-3 h-3" />
                        Voir
                      </Link>
                      <button
                        type="button"
                        onClick={() => sendResetEmail(u.id)}
                        disabled={!!sendingReset}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--border)]/20 disabled:opacity-50"
                        title="Envoyer email reset password"
                      >
                        <Mail className="w-3 h-3" />
                        {sendingReset === u.id ? '…' : 'Reset email'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser(u.id, u.name ?? u.email)}
                        disabled={!!deletingId}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50"
                        title="Supprimer le compte"
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingId === u.id ? '…' : 'Supprimer'}
                      </button>
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setEmailMenuOpen(emailMenuOpen === u.id ? null : u.id)}
                          disabled={!!sendingEmail}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--border)]/20 disabled:opacity-50"
                          title="Envoyer un email"
                        >
                          <Send className="w-3 h-3" />
                          Envoyer email
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {emailMenuOpen === u.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setEmailMenuOpen(null)} aria-hidden />
                            <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg">
                              {EMAIL_OPTIONS.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => sendTransactionalEmail(u.id, opt.id)}
                                  disabled={!!sendingEmail}
                                  className="block w-full text-left px-3 py-2 text-xs hover:bg-[var(--border)]/20 disabled:opacity-50"
                                >
                                  {sendingEmail === `${u.id}-${opt.id}` ? 'Envoi…' : opt.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">{total} utilisateur(s)</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-[var(--border)] text-sm disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-[var(--border)] text-sm disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
