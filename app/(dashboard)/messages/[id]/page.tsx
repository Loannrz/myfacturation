'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'

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
  messages: Message[]
}

export default function MessageThreadPage() {
  const params = useParams()
  const id = params.id as string
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchConversation = () => {
    fetch(`/api/conversations/${id}`)
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
    fetch(`/api/conversations/${id}/messages`, {
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

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (loading) return <div className="max-w-3xl mx-auto py-8 px-4 text-[var(--muted)]">Chargement…</div>
  if (!conversation) return <div className="max-w-3xl mx-auto py-8 px-4 text-[var(--muted)]">Discussion introuvable. <Link href="/messages" className="underline">Retour</Link></div>

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)] px-4">
      <div className="flex items-center gap-3 py-4 border-b border-[var(--border)]">
        <Link href="/messages" className="p-2 rounded-lg hover:bg-[var(--border)]/20">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-[var(--foreground)]">{conversation.subject}</h1>
          {conversation.status === 'resolved' && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Résolu</span>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                m.senderRole === 'user'
                  ? 'bg-violet-600 text-white rounded-br-md'
                  : 'bg-[var(--border)]/30 text-[var(--foreground)] rounded-bl-md'
              }`}
            >
              <p className="text-xs opacity-80 mb-0.5">{m.senderRole === 'admin' ? 'Support' : 'Vous'}</p>
              <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
              <p className="text-xs opacity-70 mt-1">{formatDate(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {conversation.status === 'resolved' ? (
        <div className="py-4 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Le ticket a été résolu.</p>
          <p className="text-xs text-[var(--muted)] mt-1">L&apos;historique de la conversation reste visible ci-dessus.</p>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex gap-2 py-4 border-t border-[var(--border)]">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Votre message..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
            title="Envoyer"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      )}
    </div>
  )
}
