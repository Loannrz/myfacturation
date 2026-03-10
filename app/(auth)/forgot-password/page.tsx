'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { ThemeToggle } from '@/app/theme-toggle'
import { Eye, EyeOff } from 'lucide-react'

const CODE_LENGTH = 6

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email') ?? ''
  const stepParam = searchParams.get('step')

  const [step, setStep] = useState(stepParam === '2' ? 2 : 1)
  const [email, setEmail] = useState(emailParam)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur')
        setLoading(false)
        return
      }
      setVerificationCode(data.verificationCode ?? null)
      setStep(2)
    } catch {
      setError('Erreur réseau')
    }
    setLoading(false)
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.replace(/\D/g, '').slice(0, CODE_LENGTH),
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Code invalide ou expiré')
        setLoading(false)
        return
      }
      const signInRes = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password: newPassword,
        redirect: false,
      })
      if (signInRes?.ok) {
        window.location.href = '/dashboard'
        return
      }
      setError('Mot de passe mis à jour. Vous pouvez vous connecter.')
      setTimeout(() => (window.location.href = '/login'), 2000)
    } catch {
      setError('Erreur réseau')
    }
    setLoading(false)
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

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-semibold mb-2">Mot de passe oublié</h1>
            <p className="text-[var(--muted)] text-sm mb-6">
              Entrez votre email. Nous vous enverrons un code pour réinitialiser votre mot de passe.
            </p>
            <form onSubmit={handleSendCode} className="space-y-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 p-3 rounded-lg">
                  {error}
                </p>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  placeholder="vous@exemple.fr"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Envoi…' : 'Envoyer le code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-2">Nouveau mot de passe</h1>
            <p className="text-[var(--muted)] text-sm mb-6">
              Entrez le code reçu par email et choisissez un nouveau mot de passe.
            </p>
            {verificationCode && (
              <p className="text-sm mb-4 p-3 rounded-lg bg-[var(--border)]/30">
                Votre code : <strong className="font-mono text-lg">{verificationCode}</strong>
              </p>
            )}
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 p-3 rounded-lg">
                  {error}
                </p>
              )}
              <div>
                <label htmlFor="email-step2" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email-step2"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                />
              </div>
              <div>
                <label htmlFor="code" className="block text-sm font-medium mb-1">
                  Code à 6 chiffres
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                  required
                  maxLength={CODE_LENGTH}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  placeholder="000000"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 pr-10 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)] rounded"
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 pr-10 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)] rounded"
                    aria-label={showConfirmPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Mise à jour…' : 'Changer le mot de passe et se connecter'}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/login" className="font-medium hover:underline text-[var(--foreground)]">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
          <span className="text-[var(--muted)]">Chargement…</span>
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  )
}
