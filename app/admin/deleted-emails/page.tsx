'use client'

import { useEffect, useState } from 'react'
import { Mail, RefreshCw } from 'lucide-react'

type DeletedEmailRow = {
  id: string
  email: string
  deletedAt: string
}

export default function AdminDeletedEmailsPage() {
  const [list, setList] = useState<DeletedEmailRow[]>([])
  const [loading, setLoading] = useState(true)
  const [allowing, setAllowing] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const fetchList = () => {
    setLoading(true)
    fetch('/api/admin/deleted-emails')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setList(data.emails ?? [])
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchList()
  }, [])

  const allowReuse = (email: string) => {
    setMessage('')
    setAllowing(email)
    fetch('/api/admin/deleted-emails', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else {
          setList((prev) => prev.filter((e) => e.email !== email))
          setMessage(`« ${email} » peut à nouveau être utilisé pour créer un compte.`)
        }
      })
      .catch(() => setMessage('Erreur réseau'))
      .finally(() => setAllowing(null))
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Emails supprimés</h2>
        <p className="text-sm text-[var(--muted)] mt-1">
          Emails de comptes supprimés par l’admin. L’inscription avec ces adresses est bloquée. Autoriser la réutilisation pour permettre à quelqu’un de recréer un compte avec cet email.
        </p>
      </div>

      {message && (
        <p className="p-3 rounded-lg bg-[var(--border)]/30 text-sm text-[var(--foreground)]">{message}</p>
      )}

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)] flex flex-col items-center gap-2">
            <Mail className="w-10 h-10 opacity-50" />
            <span>Aucun email bloqué.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Supprimé le</th>
                  <th className="text-right p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/5">
                    <td className="p-4 font-medium">{row.email}</td>
                    <td className="p-4 text-[var(--muted)]">{formatDate(row.deletedAt)}</td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => allowReuse(row.email)}
                        disabled={!!allowing}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-50 disabled:opacity-50"
                        title="Autoriser la réutilisation de cet email pour une nouvelle inscription"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${allowing === row.email ? 'animate-spin' : ''}`} />
                        {allowing === row.email ? '…' : 'Autoriser réutilisation'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
