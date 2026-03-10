'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquarePlus, Inbox } from 'lucide-react'

type ConversationItem = {
  id: string
  subject: string
  status: string
  createdAt: string
  updatedAt: string
  lastMessage: { body: string; senderRole: string; createdAt: string } | null
  unreadCount: number
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const fetchList = () => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data)
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchList()
  }, [])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setModalOpen(false)
          setSubject('')
          setMessage('')
          fetchList()
          window.location.href = `/messages/${data.id}`
        }
      })
      .finally(() => setSending(false))
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] flex items-center gap-2">
          <Inbox className="w-5 h-5" />
          Support
        </h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm"
        >
          <MessageSquarePlus className="w-4 h-4" />
          Créer une discussion
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--muted)]">Chargement…</p>
      ) : conversations.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-8 text-center">
          <p className="text-[var(--muted)] mb-4">Vous n&apos;avez encore aucune discussion avec le support.</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Créer une discussion
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 hover:bg-[var(--border)]/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--foreground)] truncate">{c.subject}</p>
                    <p className="text-sm text-[var(--muted)] mt-0.5">
                      Dernier message : {c.lastMessage?.senderRole === 'admin' ? 'Support' : 'Vous'}
                      {c.lastMessage?.body && ` — ${c.lastMessage.body.slice(0, 60)}${c.lastMessage.body.length > 60 ? '…' : ''}`}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">{formatDate(c.updatedAt)}</p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-violet-500 text-white text-xs font-medium">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Nouvelle discussion</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Objet</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="Ex. Problème facture"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm resize-none"
                  placeholder="Décrivez votre demande..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium">
                  Annuler
                </button>
                <button type="submit" disabled={sending} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50">
                  {sending ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
