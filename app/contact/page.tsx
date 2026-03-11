import Link from 'next/link'
import { ThemeToggle } from '../theme-toggle'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight hover:opacity-90">
            Myfacturation
          </Link>
          <nav className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Se connecter</Link>
            <Link href="/signup" className="text-sm bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg font-medium">Créer un compte</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-semibold mb-4">Contact</h1>
        <p className="text-[var(--muted)] mb-8">
          Pour toute question ou demande, vous pouvez nous contacter par email à l&apos;adresse indiquée dans le pied de page des emails (support).
        </p>
        <Link href="/" className="text-[var(--foreground)] underline hover:no-underline">Retour à l&apos;accueil</Link>
      </main>
    </div>
  )
}
