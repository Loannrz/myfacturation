'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

const EMAIL_TYPES = [
  { id: 'welcome', label: 'Email bienvenue' },
  { id: 'trial_start', label: 'Email début essai' },
  { id: 'trial_ending', label: 'Email fin essai (24h avant)' },
  { id: 'payment_success', label: 'Email paiement réussi' },
  { id: 'cancellation', label: 'Email annulation' },
  { id: 'weekly', label: 'Email hebdomadaire' },
] as const

export default function AdminEmailsPage() {
  const [sending, setSending] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: string; ok: boolean; text: string } | null>(null)

  const sendTest = async (type: string) => {
    setSending(type)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/send-transactional-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, test: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setMessage({ type, ok: true, text: `Envoyé à ${data.to ?? 'loannpicard@gmail.com'}` })
      } else {
        setMessage({ type, ok: false, text: data.error || 'Erreur' })
      }
    } catch {
      setMessage({ type, ok: false, text: 'Erreur réseau' })
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Emails transactionnels</h2>
        <p className="text-sm text-[var(--muted)] mt-1">
          Envoyer chaque email en mode test à loannpicard@gmail.com
        </p>
      </div>
      <div className="grid gap-3 max-w-xl">
        {EMAIL_TYPES.map(({ id, label }) => (
          <div
            key={id}
            className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]"
          >
            <span className="font-medium text-[var(--foreground)]">{label}</span>
            <button
              type="button"
              onClick={() => sendTest(id)}
              disabled={!!sending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium text-sm disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {sending === id ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        ))}
      </div>
      {message && (
        <p className={`text-sm ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
