'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ThemeToggle } from '@/app/theme-toggle'

function VerifyEmailForm() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email') ?? ''
  const [email, setEmail] = useState(emailParam)

  useEffect(() => {
    setEmail(emailParam)
  }, [emailParam])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Indiquez votre email.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.replace(/\s/g, '') }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Code invalide ou expiré')
        setLoading(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Une erreur est survenue.')
    }
    setLoading(false)
  }

  async function handleResend() {
    if (!email) return
    setError('')
    setResendLoading(true)
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Impossible d\'envoyer un nouveau code')
      } else {
        setError('')
        alert(data.message || 'Nouveau code envoyé. Vérifiez votre boîte mail (et les spams).')
      }
    } catch {
      setError('Erreur réseau')
    }
    setResendLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold mb-4">Email vérifié</h1>
          <p className="text-[var(--muted)] mb-6">
            Vous pouvez maintenant vous connecter à votre compte.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
          >
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-xl font-semibold">
            Myfacturation
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Vérification de l'email</h1>
        <p className="text-[var(--muted)] text-sm mb-6">
          Entrez le code à 6 chiffres envoyé à votre adresse email.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
              placeholder="vous@exemple.fr"
            />
          </div>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
              placeholder="000000"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Vérification…' : 'Vérifier'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || !email}
            className="w-full py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            {resendLoading ? 'Envoi…' : 'Renvoyer le code de vérification par email'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/login" className="text-[var(--foreground)] font-medium hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)] flex items-center justify-center"><span className="text-gray-500">Chargement…</span></div>}>
      <VerifyEmailForm />
    </Suspense>
  )
}
