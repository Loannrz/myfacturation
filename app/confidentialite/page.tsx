import Link from 'next/link'
import { ThemeToggle } from '../theme-toggle'

export default function ConfidentialitePage() {
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
        <h1 className="text-3xl font-semibold mb-6">Politique de confidentialité</h1>
        <div className="prose prose-invert max-w-none text-[var(--muted)] space-y-4 text-sm">
          <p>
            Myfacturation s&apos;engage à protéger vos données personnelles. Les informations collectées (email, nom, données de facturation) sont utilisées uniquement pour fournir le service et améliorer votre expérience.
          </p>
          <p>
            Nous ne vendons pas vos données. Les données sont hébergées de manière sécurisée et peuvent être supprimées sur demande.
          </p>
          <p>
            Pour toute question relative à vos données personnelles, contactez-nous via la page Contact ou le support depuis votre compte.
          </p>
        </div>
        <Link href="/" className="inline-block mt-8 text-[var(--foreground)] underline hover:no-underline">Retour à l&apos;accueil</Link>
      </main>
    </div>
  )
}
