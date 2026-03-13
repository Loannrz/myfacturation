import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'
import {
  Check,
  FileText,
  FileCheck,
  Download,
  Users,
  BarChart3,
  History,
  Sparkles,
  Zap,
  Shield,
  FolderOpen,
  LayoutGrid,
  UserPlus,
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">Myfacturation</span>
          <nav className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Section 1 — Hero */}
        <section className="max-w-6xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 leading-tight">
              La facturation simple et professionnelle pour les indépendants
            </h1>
            <p className="text-lg md:text-xl text-[var(--muted)] mb-10 leading-relaxed">
              Créez devis, factures et suivez vos revenus en quelques secondes.
              <br className="hidden sm:block" />
              Gagnez du temps et gardez une vision claire de votre activité.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-semibold hover:opacity-90 transition-opacity text-base"
              >
                Créer un compte gratuitement
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                Facturez dès maintenant gratuitement
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                Factures électroniques conformes (Factur-X / EN16931)
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                Gratuit pour commencer
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                TPE, auto-entrepreneurs, associations, particuliers
              </span>
            </div>
          </div>
          {/* Dashboard mockup — données illustratives (non réelles) */}
          <div className="mt-16 md:mt-24 rounded-2xl border border-[var(--border)] bg-[var(--border)]/10 overflow-hidden shadow-2xl max-w-5xl mx-auto">
            <div className="h-10 flex items-center gap-2 px-4 border-b border-[var(--border)] bg-[var(--background)]/80">
              <span className="w-3 h-3 rounded-full bg-[var(--muted)]/50" />
              <span className="w-3 h-3 rounded-full bg-[var(--muted)]/50" />
              <span className="w-3 h-3 rounded-full bg-[var(--muted)]/50" />
            </div>
            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4">
                <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Factures récentes</h3>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 divide-y divide-[var(--border)]">
                  {[
                    { number: 'FAC-2024-187', label: 'Prestation conseil', amount: '3 550 €' },
                    { number: 'FAC-2023-042', label: 'Formation & support', amount: '10 720 €' },
                    { number: 'FAC-2024-521', label: 'Ajustement acompte', amount: '5 €' },
                  ].map((inv) => (
                    <div key={inv.number} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <span className="font-mono text-sm block">{inv.number}</span>
                        <span className="text-xs text-[var(--muted)]">{inv.label}</span>
                      </div>
                      <span className="text-sm font-medium text-[var(--muted)]">{inv.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-4 space-y-4">
                <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Avec Myfacturation360</h3>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4 space-y-4">
                  <div>
                    <p className="text-2xl font-semibold">+ 1 762 893 €</p>
                    <p className="text-xs text-[var(--muted)]">facturés par nos utilisateurs</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">+ 20 000</p>
                    <p className="text-xs text-[var(--muted)]">clients satisfaits</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2 — Problème utilisateur */}
        <section className="border-y border-[var(--border)] bg-[var(--border)]/5 py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
              La facturation ne devrait pas être compliquée
            </h2>
            <p className="text-[var(--muted)] mb-10 text-lg">
              Les indépendants passent souvent trop de temps à :
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-2xl mx-auto mb-10">
              {[
                'Créer leurs devis manuellement',
                'Gérer leurs clients dans plusieurs outils',
                'Suivre leurs paiements',
                'Organiser leurs factures',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-[var(--muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-lg font-medium">
              Myfacturation centralise tout dans un seul outil simple.
            </p>
          </div>
        </section>

        {/* Section 3 — Fonctionnalités */}
        <section className="py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-12">
              Fonctionnalités principales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { icon: FileText, title: 'Création de devis et factures', desc: 'Créez des documents professionnels en quelques secondes.' },
                { icon: FileCheck, title: 'Factures électroniques conformes', desc: 'Factur-X / EN16931 : factures et avoirs conformes, reconnus électroniquement. Inclus gratuit ou payant.' },
                { icon: Download, title: 'Génération PDF automatique', desc: 'Téléchargez et envoyez vos factures instantanément.' },
                { icon: Users, title: 'Gestion des clients', desc: 'Centralisez toutes les informations de vos clients.' },
                { icon: BarChart3, title: 'Tableau de bord clair', desc: 'Suivez votre chiffre d\'affaires et votre activité.' },
                { icon: History, title: 'Historique des documents', desc: 'Retrouvez tous vos devis et factures.' },
                { icon: Sparkles, title: 'Interface simple', desc: 'Aucune compétence comptable nécessaire.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--background)] hover:border-[var(--foreground)]/20 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--border)]/30 flex items-center justify-center mb-4 text-[var(--foreground)]">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{title}</h3>
                  <p className="text-[var(--muted)] text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4 — Comment ça marche */}
        <section className="border-y border-[var(--border)] bg-[var(--border)]/5 py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-14">
              Comment ça marche
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { step: '1', icon: UserPlus, title: 'Créez votre compte', desc: 'Inscription rapide.' },
                { step: '2', icon: Users, title: 'Ajoutez vos clients', desc: 'Enregistrez leurs informations.' },
                { step: '3', icon: FileCheck, title: 'Générez vos factures', desc: 'Créez et envoyez vos documents en quelques secondes.' },
              ].map(({ step, icon: Icon, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                    {step}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[var(--border)]/30 flex items-center justify-center mx-auto mb-3 text-[var(--foreground)]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{title}</h3>
                  <p className="text-[var(--muted)] text-sm">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5 — Pour qui */}
        <section className="py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
              Pour qui est cet outil
            </h2>
            <p className="text-lg text-[var(--muted)] mb-10">
              Myfacturation est conçu pour les professionnels qui veulent gérer leur facturation rapidement sans complexité.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Auto-entrepreneurs', 'TPE', 'Associations', 'Particuliers', 'Freelances', 'Consultants', 'Agences'].map((label) => (
                <span
                  key={label}
                  className="px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm font-medium"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Section 6 — Avantages */}
        <section className="border-y border-[var(--border)] bg-[var(--border)]/5 py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-12">
              Vos avantages
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Zap, text: 'Gagnez du temps' },
                { icon: Shield, text: 'Évitez les erreurs' },
                { icon: BarChart3, text: 'Suivez votre activité' },
                { icon: FolderOpen, text: 'Centralisez vos documents' },
                { icon: LayoutGrid, text: 'Améliorez votre organisation' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                  <Icon className="w-5 h-5 text-[var(--foreground)] shrink-0" />
                  <span className="font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 7 — Prix */}
        <section className="py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-12">
              Tarifs simples
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <div className="p-8 rounded-2xl border-2 border-[var(--border)] bg-[var(--background)]">
                <h3 className="text-xl font-semibold mb-2">Plan Pro</h3>
                <p className="text-[var(--muted)] text-sm mb-6">Pour les indépendants</p>
                <ul className="space-y-2 text-sm text-[var(--muted)] mb-8">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Essai gratuit 7 jours</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Paiement mensuel</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Annulable à tout moment</li>
                </ul>
                <Link
                  href="/formules"
                  className="block w-full text-center py-3 rounded-xl border-2 border-[var(--foreground)] font-medium hover:bg-[var(--foreground)]/10 transition-colors"
                >
                  Voir les formules
                </Link>
              </div>
              <div className="p-8 rounded-2xl border-2 border-[var(--foreground)] bg-[var(--background)]">
                <h3 className="text-xl font-semibold mb-2">Plan Business</h3>
                <p className="text-[var(--muted)] text-sm mb-6">Pour les entreprises avec plus de besoins</p>
                <ul className="space-y-2 text-sm text-[var(--muted)] mb-8">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Essai gratuit 7 jours</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Paiement mensuel</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Annulable à tout moment</li>
                </ul>
                <Link
                  href="/formules"
                  className="block w-full text-center py-3 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
                >
                  Voir les formules
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8 — CTA final */}
        <section className="border-y border-[var(--border)] bg-[var(--border)]/5 py-20 md:py-28">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
              Prêt à simplifier votre facturation ?
            </h2>
            <p className="text-[var(--muted)] mb-10 text-lg">
              Rejoignez les professionnels qui font confiance à Myfacturation.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-10 py-4 rounded-xl bg-[var(--foreground)] text-[var(--background)] font-semibold hover:opacity-90 transition-opacity text-lg"
            >
              Créer un compte gratuitement
            </Link>
          </div>
        </section>

        {/* Section 9 — Footer */}
        <footer className="py-12 md:py-16 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div>
                <span className="text-lg font-semibold tracking-tight">Myfacturation</span>
                <p className="text-sm text-[var(--muted)] mt-1">La facturation simple pour les indépendants.</p>
              </div>
              <nav className="flex flex-wrap gap-6 text-sm">
                <Link href="/contact" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Contact
                </Link>
                <Link href="/support" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Support
                </Link>
                <Link href="/confidentialite" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Politique de confidentialité
                </Link>
                <Link href="/conditions" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Conditions d&apos;utilisation
                </Link>
              </nav>
            </div>
            <div className="mt-10 pt-8 border-t border-[var(--border)] text-center text-sm text-[var(--muted)]">
              © {new Date().getFullYear()} Myfacturation. Tous droits réservés.
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
