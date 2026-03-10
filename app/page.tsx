import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">Myfacturation</span>
          <nav className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <section className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
            La facturation simple pour les indépendants et entreprises
          </h1>
          <p className="text-lg text-[var(--muted)] mb-10">
            Créez devis et factures en quelques secondes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
            >
              Créer un compte
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20 transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--border)]/30 flex items-center justify-center mx-auto mb-4 text-[var(--muted)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L14 7" />
              </svg>
            </div>
            <h3 className="font-medium mb-2">Devis & factures</h3>
            <p className="text-sm text-[var(--muted)]">Générez des documents PDF professionnels en quelques clics.</p>
          </div>
          <div className="p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--border)]/30 flex items-center justify-center mx-auto mb-4 text-[var(--muted)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-medium mb-2">Clients</h3>
            <p className="text-sm text-[var(--muted)]">Centralisez vos clients et sociétés.</p>
          </div>
          <div className="p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--border)]/30 flex items-center justify-center mx-auto mb-4 text-[var(--muted)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-medium mb-2">Tableau de bord</h3>
            <p className="text-sm text-[var(--muted)]">Suivez votre activité et vos revenus.</p>
          </div>
        </section>

        <footer className="mt-24 py-8 border-t border-[var(--border)] w-full">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-[var(--muted)]">
            © {new Date().getFullYear()} Myfacturation. Tous droits réservés.
          </div>
        </footer>
      </main>
    </div>
  )
}
