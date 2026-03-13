'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Send, CheckCircle } from 'lucide-react'

type Message = {
  id: string
  senderRole: string
  message: string
  createdAt: string
}

type Conversation = {
  id: string
  subject: string
  status: string
  user: { id: string; name: string | null; email: string | null }
  messages: Message[]
}

export default function AdminMessageThreadPage() {
  const params = useParams()
  const id = params?.id as string
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchConversation = () => {
    fetch(`/api/admin/conversations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setConversation(data)
      })
      .catch(() => setConversation(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchConversation()
  }, [id])

  useEffect(() => {
    if (conversation?.messages?.length && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation?.messages?.length])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const msg = newMessage.trim()
    if (!msg || sending) return
    setSending(true)
    fetch(`/api/admin/conversations/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setNewMessage('')
          fetchConversation()
        }
      })
      .finally(() => setSending(false))
  }

  const toggleResolved = () => {
    if (!conversation) return
    const next = conversation.status === 'resolved' ? 'open' : 'resolved'
    setResolving(true)
    fetch(`/api/admin/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setConversation((c) => (c ? { ...c, status: data.status } : null))
      })
      .finally(() => setResolving(false))
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (loading) return <div className="p-6 text-[var(--muted)]">Chargement…</div>
  if (!conversation) return <div className="p-6 text-[var(--muted)]">Discussion introuvable. <Link href="/admin/messages" className="underline">Retour</Link></div>

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin/messages" className="p-2 rounded-lg hover:bg-[var(--border)]/20 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">{conversation.subject}</h1>
            <p className="text-sm text-[var(--muted)]">{conversation.user.name || conversation.user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {conversation.status === 'resolved' && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded bg-emerald-500/20">Résolu</span>
          )}
          <button
            type="button"
            onClick={toggleResolved}
            disabled={resolving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--border)]/20 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {conversation.status === 'resolved' ? 'Rouvrir' : 'Marquer résolu'}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                m.senderRole === 'admin'
                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 rounded-br-md border border-amber-500/30'
                  : 'bg-[var(--border)]/30 text-[var(--foreground)] rounded-bl-md'
              }`}
            >
              <p className="text-xs opacity-80 mb-0.5">{m.senderRole === 'admin' ? 'Support' : 'Utilisateur'}</p>
              <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
              <p className="text-xs opacity-70 mt-1">{formatDate(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 py-4 border-t border-[var(--border)]">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Répondre..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium text-sm disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  )
}
