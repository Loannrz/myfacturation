'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { ThemeToggle } from '@/app/theme-toggle'
import { Eye, EyeOff } from 'lucide-react'

const EMAIL_NOT_VERIFIED_MSG = 'Veuillez vérifier votre email avant de vous connecter. Si vous venez de créer un compte, entrez le code reçu par email sur la page de vérification (lien ci-dessous).'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const registered = searchParams.get('registered') === '1'

  // Afficher l'erreur venant de l'URL (ex. redirection NextAuth après échec)
  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'CredentialsSignin' || err === 'EMAIL_NOT_VERIFIED') {
      setError(err === 'EMAIL_NOT_VERIFIED' ? EMAIL_NOT_VERIFIED_MSG : 'Email ou mot de passe incorrect. Si vous venez de créer un compte, vérifiez d\'abord votre email.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })
      const err = res?.error ?? ''
      if (err === 'EMAIL_NOT_VERIFIED' || String(err).includes('EMAIL_NOT_VERIFIED')) {
        setError(EMAIL_NOT_VERIFIED_MSG)
        setLoading(false)
        return
      }
      if (res?.error || !res?.ok) {
        setError('Email ou mot de passe incorrect.')
        setLoading(false)
        return
      }
      window.location.href = callbackUrl
    } catch {
      setError('Une erreur est survenue. Vérifiez votre connexion.')
      setLoading(false)
    }
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
        <h1 className="text-2xl font-semibold mb-2">Se connecter</h1>
        <p className="text-[var(--muted)] text-sm mb-6">
          Accédez à votre espace facturation.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {registered && (
            <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
              Compte créé. Connectez-vous avec votre email et mot de passe.
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
              <p>{error}</p>
              {(error.includes('vérifier') || error.includes('vérification')) && email && (
                <Link
                  href={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                  className="mt-2 inline-block font-medium underline"
                >
                  Renvoyer le code de vérification
                </Link>
              )}
            </div>
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
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)] rounded"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-[var(--muted)] hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="font-medium hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><span className="text-gray-500">Chargement…</span></div>}>
      <LoginForm />
    </Suspense>
  )
}
