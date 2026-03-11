'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Inbox } from 'lucide-react'

type ConversationItem = {
  id: string
  subject: string
  status: string
  adminLastOpenedAt: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string | null; email: string | null }
  lastMessage: { body: string; senderRole: string; createdAt: string } | null
  unreadCount: number
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/conversations')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data)
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const formatOpenedAt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-[var(--foreground)] flex items-center gap-2 mb-6">
        <Inbox className="w-5 h-5" />
        Support ({totalUnread} non lu{totalUnread !== 1 ? 's' : ''})
      </h1>

      {loading ? (
        <p className="text-[var(--muted)]">Chargement…</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--border)]/20">
              <tr>
                <th className="text-left p-3 font-medium text-[var(--foreground)]">Utilisateur</th>
                <th className="text-left p-3 font-medium text-[var(--foreground)]">Objet</th>
                <th className="text-left p-3 font-medium text-[var(--foreground)]">Statut</th>
                <th className="text-left p-3 font-medium text-[var(--foreground)]">Dernier message</th>
                <th className="text-left p-3 font-medium text-[var(--foreground)]">Date</th>
                <th className="text-center p-3 font-medium text-[var(--foreground)]">Non lus</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {conversations.map((c) => (
                <tr
                  key={c.id}
                  className={`border-t border-[var(--border)] hover:bg-[var(--border)]/10 ${
                    c.unreadCount > 0
                      ? 'bg-amber-500/25 ring-1 ring-amber-500/50 ring-inset'
                      : ''
                  }`}
                >
                  <td className={`p-3 ${c.unreadCount > 0 ? 'border-l-4 border-l-amber-500 font-medium' : ''}`}>
                    <p className="font-medium text-[var(--foreground)]">{c.user.name || c.user.email || '—'}</p>
                    <p className="text-xs text-[var(--muted)]">{c.user.email}</p>
                  </td>
                  <td className="p-3 text-[var(--foreground)]">{c.subject}</td>
                  <td className="p-3">
                    {c.status === 'resolved' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                        Résolu
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-700 dark:text-amber-400">
                        Ouvert
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-[var(--muted)] max-w-[200px] truncate">
                    {c.lastMessage ? (c.lastMessage.body.slice(0, 60) + (c.lastMessage.body.length > 60 ? '…' : '')) : '—'}
                  </td>
                  <td className="p-3 text-[var(--muted)]">{formatDate(c.updatedAt)}</td>
                  <td className="p-3 text-center text-[var(--muted)] text-xs">
                    {c.unreadCount > 0 ? (
                      <>—</>
                    ) : c.adminLastOpenedAt ? (
                      <>Ouvert le {formatOpenedAt(c.adminLastOpenedAt)}</>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">
                    {c.status === 'resolved' ? (
                      <Link
                        href={`/admin/messages/${c.id}`}
                        className="inline-flex px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium text-sm hover:bg-emerald-500/30"
                      >
                        Résolu
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/messages/${c.id}`}
                        className="inline-flex px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-sm hover:bg-amber-500/30"
                      >
                        Ouvrir
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {conversations.length === 0 && (
            <p className="p-8 text-center text-[var(--muted)]">Aucune discussion.</p>
          )}
        </div>
      )}
    </div>
  )
}
