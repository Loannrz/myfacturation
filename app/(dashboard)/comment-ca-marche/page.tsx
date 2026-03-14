'use client'

import Link from 'next/link'
import {
  LayoutDashboard,
  FileText,
  Receipt,
  RotateCcw,
  FilePlus2,
  ChevronRight,
  BarChart3,
  Settings,
  Users,
  Building2,
  Package,
  Activity,
  Wallet,
  Banknote,
  UserCircle,
  MessageCircle,
  Sparkles,
  BookOpen,
  LogOut,
} from 'lucide-react'

const CHAPTERS = [
  { id: 'navigation', label: 'La navigation', icon: LayoutDashboard },
  { id: 'dashboard', label: 'Le tableau de bord', icon: LayoutDashboard },
  { id: 'creer-facture', label: 'Créer une facture', icon: Receipt },
  { id: 'devis', label: 'Les devis', icon: FileText },
  { id: 'avoirs', label: 'Les avoirs', icon: RotateCcw },
  { id: 'graphiques', label: 'Les graphiques', icon: BarChart3 },
  { id: 'parametres', label: 'Paramètres (essentiel)', icon: Settings },
  { id: 'creer-client', label: 'Créer un client', icon: Users },
  { id: 'creer-societe', label: 'Créer une société', icon: Building2 },
  { id: 'creer-produit', label: 'Créer un produit', icon: Package },
] as const

export default function CommentCaMarchePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-gradient-to-b from-[var(--background)] to-[var(--border)]/10">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
          <p className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Guide</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Comment ça marche</h1>
          <p className="mt-3 text-lg text-[var(--muted)] max-w-2xl">
            Chaque écran expliqué : navigation, factures, devis, avoirs, graphiques, paramètres obligatoires, clients, sociétés et produits.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <nav className="mb-12 p-4 rounded-xl bg-[var(--border)]/10 border border-[var(--border)]/50">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Sommaire</p>
          <div className="flex flex-wrap gap-2">
            {CHAPTERS.map((ch) => (
              <a
                key={ch.id}
                href={`#${ch.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--border)]/20 transition-colors"
              >
                <ch.icon className="w-4 h-4 text-[var(--muted)]" />
                {ch.label}
                <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)]" />
              </a>
            ))}
          </div>
        </nav>

        {/* ========== 1. NAVIGATION ========== */}
        <section id="navigation" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">La barre de navigation</h2>
          {/* Grille : une ligne = un item nav (gauche) + explication (droite), alignés. 3 blocs séparés comme la nav. */}
          <div className="max-w-3xl grid gap-0 rounded-xl overflow-hidden shadow-lg" style={{ gridTemplateColumns: '16rem 1fr' }}>
            {/* —— Bloc 1 : en-tête + vue d’ensemble —— */}
            <div className="min-h-[4.5rem] flex items-center border-l-2 border-r-2 border-t-2 border-[var(--border)] rounded-t-xl bg-[var(--background)] p-4 pl-6">
              <span className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Myfacturation</span>
            </div>
            <div className="min-h-[4.5rem] flex items-center pl-4 text-sm text-[var(--muted)] border-t-2 border-[var(--border)]">→ retour à l’accueil</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--border)]/30 text-sm font-medium">
              <LayoutDashboard className="w-4 h-4 shrink-0 text-[var(--foreground)]" />
              Dashboard
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ vue d’ensemble CA, factures, dépenses</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Activity className="w-4 h-4 shrink-0" />
              Activité
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ historique des actions (Pro/Business)</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Wallet className="w-4 h-4 shrink-0" />
              Comptabilité
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ graphiques revenus et dépenses</div>

            {/* —— Séparateur 1 —— */}
            <div className="min-h-[0.75rem] border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)]" aria-hidden />
            <div className="min-h-[0.75rem]" aria-hidden />

            {/* —— Bloc 2 : documents (Créer → Produits) —— */}
            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <FilePlus2 className="w-4 h-4 shrink-0" />
              Créer
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ créer facture, devis ou avoir</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Receipt className="w-4 h-4 shrink-0" />
              Factures
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ liste des factures, nouvelle facture</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <RotateCcw className="w-4 h-4 shrink-0" />
              Avoirs
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ remboursements, avoirs liés aux factures</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <FileText className="w-4 h-4 shrink-0" />
              Devis
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ liste des devis, envoyer, faire signer</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Banknote className="w-4 h-4 shrink-0" />
              Dépenses
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ enregistrer les dépenses (Pro/Business)</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <UserCircle className="w-4 h-4 shrink-0" />
              Salariés
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ gérer les salariés (Business)</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Users className="w-4 h-4 shrink-0" />
              Clients
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ liste des clients, créer un client</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Building2 className="w-4 h-4 shrink-0" />
              Sociétés
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ liste des sociétés, créer une société</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Package className="w-4 h-4 shrink-0" />
              Produits
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ produits et services pour les lignes de facture</div>

            {/* —— Séparateur 2 —— */}
            <div className="min-h-[0.75rem] border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)]" aria-hidden />
            <div className="min-h-[0.75rem]" aria-hidden />

            {/* —— Bloc 3 : compte (Support → Paramètres) + Thème, Déconnexion —— */}
            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <MessageCircle className="w-4 h-4 shrink-0" />
              Support
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ messagerie, aide</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Sparkles className="w-4 h-4 shrink-0" />
              Formules
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ abonnement, formules Pro / Business</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--border)]/30 text-sm font-medium">
              <BookOpen className="w-4 h-4 shrink-0 text-[var(--foreground)]" />
              Comment ça marche
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ ce guide</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <Settings className="w-4 h-4 shrink-0" />
              Paramètres
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ entreprise, SIRET, comptes bancaires</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
              <div className="h-8 w-8 rounded-lg border border-[var(--border)]/50 bg-[var(--border)]/10 flex items-center justify-center shrink-0" aria-hidden><span className="text-xs">☀</span></div>
              Thème
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ choix du thème clair / sombre</div>

            <div className="min-h-[2.5rem] flex items-center gap-3 px-3 py-2.5 border-l-2 border-r-2 border-b-2 border-[var(--border)] rounded-b-xl bg-[var(--background)] text-sm text-[var(--muted)]">
              <LogOut className="w-4 h-4 shrink-0" />
              Déconnexion
            </div>
            <div className="min-h-[2.5rem] flex items-center pl-4 text-sm text-[var(--muted)]">→ quitter le compte</div>
          </div>
          {/* Règles : important à remplir pour facturer — juste sous la nav, encadré orange */}
          <div className="mt-10 w-full max-w-full rounded-xl border-2 border-amber-500 bg-amber-500/10 p-4">
            <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">Important à remplir pour facturer</p>
            <p className="text-sm text-[var(--muted)]">
              Avant de créer une facture ou un devis, allez dans <strong className="text-[var(--foreground)]">Paramètres</strong> : renseignez au moins un <strong className="text-[var(--foreground)]">établissement</strong> (raison sociale + SIRET + adresse) et un <strong className="text-[var(--foreground)]">compte bancaire</strong>. Sans cela, les documents ne pourront pas être générés correctement.
            </p>
          </div>
        </section>

        {/* ========== 2. DASHBOARD ========== */}
        <section id="dashboard" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Le tableau de bord</h2>
          <div className="flex flex-col lg:flex-row-reverse gap-8">
            <div className="lg:w-[420px] shrink-0">
              <div className="rounded-xl border-2 border-[var(--border)] bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-4 border-b border-[var(--border)]">
                  <h3 className="font-semibold text-[var(--foreground)]">Dashboard</h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Vue d’ensemble de votre activité</p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-xs text-[var(--muted)]">CA net</p>
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">12 450,00 €</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-xs text-[var(--muted)]">Factures payées</p>
                    <p className="text-lg font-semibold">14 200,00 €</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-xs text-[var(--muted)]">Factures en attente</p>
                    <p className="text-lg font-semibold text-amber-600">1 750,00 €</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-xs text-[var(--muted)]">Dépenses</p>
                    <p className="text-lg font-semibold text-rose-600">2 100,00 €</p>
                  </div>
                </div>
                <div className="p-4 border-t border-[var(--border)] bg-[var(--border)]/5">
                  <p className="text-xs font-medium text-[var(--muted)] mb-2">Revenus et dépenses</p>
                  <div className="h-28 flex items-end gap-0.5">
                    {[35, 52, 48, 70, 55, 82, 65, 78, 58, 88, 72, 85].map((h, i) => (
                      <div key={i} className="flex-1 min-w-0 rounded-t bg-emerald-500/50" style={{ height: `${h}%` }} title={`Mois ${i + 1}`} />
                    ))}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1 flex justify-between">
                    <span>Jan</span>
                    <span>Déc</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Le <strong className="text-[var(--foreground)]">Dashboard</strong> affiche le <strong className="text-[var(--foreground)]">CA net</strong> (chiffre d’affaires après avoirs), les <strong className="text-[var(--foreground)]">factures payées</strong>, les <strong className="text-[var(--foreground)]">factures en attente</strong>, les <strong className="text-[var(--foreground)]">dépenses</strong> et le <strong className="text-[var(--foreground)]">résultat net</strong>. Vous y voyez aussi les devis récemment signés et les factures en retard.
              </p>
              <p className="text-[var(--muted)] leading-relaxed">
                Le graphique montre l’évolution des revenus (ou revenus vs dépenses en Comptabilité). Utilisez ces indicateurs pour suivre votre trésorerie sans ouvrir chaque section.
              </p>
            </div>
          </div>
        </section>

        {/* ========== 3. CRÉER UNE FACTURE ========== */}
        <section id="creer-facture" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Créer une facture</h2>
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:max-w-[480px] shrink-0 space-y-4">
              <div className="rounded-xl border-2 border-emerald-500/30 bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-3 border-b border-[var(--border)] bg-emerald-500/5">
                  <h3 className="font-semibold text-[var(--foreground)]">Modifier la facture</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Émetteur (si plusieurs établissements)</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">Facturer au nom de — Mon entreprise</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Destinataire</p>
                    <p className="text-xs text-[var(--muted)] mb-1">Type : Client ○ Société ○</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]">— Sélectionner un client —</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-[var(--muted)] mb-1">Date d’émission</p>
                      <p className="px-3 py-2 rounded-lg border border-[var(--border)]">13/03/2026</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)] mb-1">Délai de paiement</p>
                      <p className="px-3 py-2 rounded-lg border border-[var(--border)]">30 jours</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Mode de paiement</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">Virement bancaire</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Compte bancaire</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">— Compte principal —</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--foreground)] mb-2">Lignes</p>
                    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                      <div className="grid grid-cols-12 gap-1 px-2 py-1.5 text-xs text-[var(--muted)] border-b border-[var(--border)]">
                        <span className="col-span-5">Description</span>
                        <span className="col-span-1">Qté</span>
                        <span className="col-span-2">P.U.</span>
                        <span className="col-span-1">TVA</span>
                        <span className="col-span-2">Total TTC</span>
                      </div>
                      <div className="px-2 py-2 grid grid-cols-12 gap-1 text-xs">
                        <span className="col-span-5">Prestation conseil</span>
                        <span className="col-span-1">1</span>
                        <span className="col-span-2">1 200,00</span>
                        <span className="col-span-1">20 %</span>
                        <span className="col-span-2">1 440,00 €</span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1">+ Ligne · + Ajouter un produit</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm">Annuler</button>
                    <button type="button" className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium">Enregistrer</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                <strong className="text-[var(--foreground)]">À remplir obligatoirement :</strong> choisir le <strong className="text-[var(--foreground)]">client</strong> ou la <strong className="text-[var(--foreground)]">société</strong> (à créer avant dans Clients/Sociétés), la <strong className="text-[var(--foreground)]">date d’émission</strong>, le <strong className="text-[var(--foreground)]">délai de paiement</strong> (15/30/60/90 jours — l’échéance se calcule automatiquement), un <strong className="text-[var(--foreground)]">compte bancaire</strong> (à configurer dans Paramètres), et au moins une <strong className="text-[var(--foreground)]">ligne</strong> avec description, quantité, prix unitaire et TVA.
              </p>
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                <strong className="text-[var(--foreground)]">Pourquoi :</strong> le client/société détermine à qui envoyer la facture ; le compte bancaire et les infos entreprise (Paramètres) sont requis pour le PDF et Factur-X. Le mode de paiement et la note sont optionnels mais utiles pour le client.
              </p>
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                <strong className="text-[var(--foreground)]">Astuce :</strong> vous pouvez ajouter une ligne en un clic depuis un <strong className="text-[var(--foreground)]">produit</strong> (voir « Créer un produit »). Une fois enregistrée, vous pourrez envoyer la facture par e-mail ou télécharger le PDF depuis la liste des factures.
              </p>
              <Link href="/factures/nouvelle" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                <FilePlus2 className="w-4 h-4" />
                Créer une facture
              </Link>
            </div>
          </div>
        </section>

        {/* ========== 4. DEVIS ========== */}
        <section id="devis" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Les devis</h2>
          <div className="flex flex-col lg:flex-row-reverse gap-8">
            <div className="lg:w-[500px] shrink-0">
              <div className="rounded-xl border-2 border-blue-500/30 bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-3 border-b border-[var(--border)] bg-blue-500/5 flex justify-between items-center">
                  <h3 className="font-semibold text-[var(--foreground)]">Devis</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300">Nouveau devis</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                        <th className="px-3 py-2 font-medium">Numéro</th>
                        <th className="px-3 py-2 font-medium">Client</th>
                        <th className="px-3 py-2 font-medium">Montant</th>
                        <th className="px-3 py-2 font-medium">Statut</th>
                        <th className="px-3 py-2 font-medium">Échéance</th>
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[var(--border)]/50">
                        <td className="px-3 py-2 font-medium">D-2026-0001</td>
                        <td className="px-3 py-2 text-[var(--muted)]">Jean Dupont</td>
                        <td className="px-3 py-2">1 200,00 €</td>
                        <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300">Envoyé</span></td>
                        <td className="px-3 py-2 text-[var(--muted)]">15/04/2026</td>
                        <td className="px-3 py-2 text-right text-[var(--muted)]">Envoyer · Modifier · PDF</td>
                      </tr>
                      <tr className="border-b border-[var(--border)]/50">
                        <td className="px-3 py-2 font-medium">D-2026-0002</td>
                        <td className="px-3 py-2 text-[var(--muted)]">SARL Martin</td>
                        <td className="px-3 py-2">2 400,00 €</td>
                        <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">Signé</span> le 10/03/2026</td>
                        <td className="px-3 py-2 text-[var(--muted)]">10/04/2026</td>
                        <td className="px-3 py-2 text-right"><span className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">Créer la facture</span> · Modifier · PDF</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Les <strong className="text-[var(--foreground)]">devis</strong> se créent comme les factures : même formulaire (destinataire, dates, lignes). En plus, vous choisissez le <strong className="text-[var(--foreground)]">statut</strong> : Brouillon, Envoyé, Signé, Expiré. Une fois le devis prêt, cliquez sur <strong className="text-[var(--foreground)]">Envoyer</strong> : le client reçoit un e-mail avec un lien pour consulter et <strong className="text-[var(--foreground)]">signer en ligne</strong>.
              </p>
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Quand le devis est <strong className="text-[var(--foreground)]">signé</strong> (par le client ou en le marquant « Signé » à la main avec une date), le bouton <strong className="text-[var(--foreground)]">Créer la facture</strong> apparaît : il génère une facture à partir du devis en un clic, sans ressaisir les lignes.
              </p>
              <p className="text-[var(--muted)] leading-relaxed">
                Tous les champs à remplir sont les mêmes que pour une facture (client, date d’émission, échéance, lignes). L’e-mail du client doit être renseigné pour pouvoir envoyer le lien de signature.
              </p>
            </div>
          </div>
        </section>

        {/* ========== 5. AVOIRS ========== */}
        <section id="avoirs" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Les avoirs</h2>
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-[420px] shrink-0">
              <div className="rounded-xl border-2 border-rose-500/30 bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-3 border-b border-[var(--border)] bg-rose-500/5 flex justify-between items-center">
                  <h3 className="font-semibold text-[var(--foreground)]">Avoirs</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300">Nouvel avoir</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border)]/50">
                    <div>
                      <p className="font-medium">A-2026-0003</p>
                      <p className="text-xs text-[var(--muted)]">Facture F-2026-0012 · Motif : Retour marchandise</p>
                    </div>
                    <p className="font-semibold text-rose-600 dark:text-rose-400">− 350,00 €</p>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border)]/50">
                    <div>
                      <p className="font-medium">A-2026-0002</p>
                      <p className="text-xs text-[var(--muted)]">Facture F-2026-0008 · Remise accordée</p>
                    </div>
                    <p className="font-semibold text-rose-600 dark:text-rose-400">− 120,00 €</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted)] px-4 pb-3">Statuts : Brouillon · Envoyé · Remboursé · Annulé</p>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Un <strong className="text-[var(--foreground)]">avoir</strong> sert à annuler tout ou partie d’une facture déjà émise (remboursement, remise, erreur). Vous devez choisir la <strong className="text-[var(--foreground)]">facture d’origine</strong>, indiquer le <strong className="text-[var(--foreground)]">motif</strong> (obligatoire pour la comptabilité) et les <strong className="text-[var(--foreground)]">lignes ou le montant</strong> à rembourser.
              </p>
              <p className="text-[var(--muted)] leading-relaxed">
                Les avoirs sont pris en compte dans le CA net et dans les exports (Factur-X). Le statut « Remboursé » indique que le remboursement a été effectué.
              </p>
            </div>
          </div>
        </section>

        {/* ========== 6. GRAPHIQUES ========== */}
        <section id="graphiques" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Les graphiques (Comptabilité)</h2>
          <div className="flex flex-col lg:flex-row-reverse gap-8">
            <div className="lg:w-[440px] shrink-0">
              <div className="rounded-xl border-2 border-[var(--border)] bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-3 border-b border-[var(--border)] flex justify-between items-center">
                  <h3 className="font-semibold text-[var(--foreground)]">Revenus et dépenses</h3>
                  <span className="text-xs text-[var(--muted)]">Toute l’année · Toutes les courbes</span>
                </div>
                <div className="p-4">
                  <div className="h-40 flex items-end gap-1">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                      <div key={i} className="flex-1 min-w-0 rounded-t bg-emerald-500/40" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-[var(--muted)] mt-2">
                    <span>Jan</span>
                    <span>Mar</span>
                    <span>Juin</span>
                    <span>Sep</span>
                    <span>Déc</span>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500/60" /> Revenus (factures payées)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500/60" /> Dépenses + avoirs</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Dans <strong className="text-[var(--foreground)]">Comptabilité</strong> (formule Pro/Business), les graphiques montrent l’évolution des <strong className="text-[var(--foreground)]">revenus</strong> (factures payées) en vert et des <strong className="text-[var(--foreground)]">dépenses + avoirs</strong> en rouge. Vous pouvez filtrer par <strong className="text-[var(--foreground)]">période</strong> (toute l’année ou un mois) et par <strong className="text-[var(--foreground)]">compte bancaire</strong>.
              </p>
              <p className="text-[var(--muted)] leading-relaxed">
                La courbe reste lisible même pour un seul mois grâce à un prolongement visuel des lignes. Une section « Dépenses par catégorie » permet d’analyser les postes de dépenses.
              </p>
            </div>
          </div>
        </section>

        {/* ========== 7. PARAMÈTRES (ESSENTIEL) ========== */}
        <section id="parametres" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Paramètres : à remplir avant de facturer</h2>
          <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 border-l-4 border-l-amber-500 p-4 mb-6">
            <p className="font-semibold text-[var(--foreground)] mb-1">Les 2 infos indispensables</p>
            <p className="text-sm text-[var(--muted)]">
              <strong className="text-[var(--foreground)]">1. Établissements / Profils émetteur</strong> : au moins un établissement avec <strong className="text-[var(--foreground)]">Raison sociale</strong> et <strong className="text-[var(--foreground)]">SIRET</strong> (et adresse). C’est ce qui figure sur vos factures et devis. Sans SIRET, l’envoi PDF Factur-X et certains envois d’e-mails sont bloqués.<br />
              <strong className="text-[var(--foreground)]">2. Coordonnées bancaires</strong> : au moins un <strong className="text-[var(--foreground)]">compte bancaire</strong> (titulaire, IBAN, BIC, banque) pour afficher les coordonnées de paiement sur les documents.
            </p>
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-[320px] shrink-0">
              <div className="rounded-xl border-2 border-[var(--border)] bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-4 border-b border-[var(--border)]">
                  <h3 className="font-semibold text-[var(--foreground)]">Paramètres</h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Profil et infos pour vos factures</p>
                </div>
                <div className="p-3 space-y-0">
                  <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[var(--border)]/10">
                    <span className="text-[var(--foreground)]">Profil</span>
                    <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                  </div>
                  <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[var(--border)]/10">
                    <span className="text-[var(--foreground)] font-medium">Établissements / Profils émetteur</span>
                    <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                  </div>
                  <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[var(--border)]/10">
                    <span className="text-[var(--foreground)] font-medium">Coordonnées bancaires</span>
                    <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                  </div>
                  <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[var(--border)]/10">
                    <span className="text-[var(--foreground)]">Numérotation factures, devis, avoirs</span>
                    <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                  </div>
                  <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[var(--border)]/10">
                    <span className="text-[var(--foreground)]">Paiement par défaut</span>
                    <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                  </div>
                  <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[var(--border)]/10">
                    <span className="text-[var(--foreground)]">Mentions légales</span>
                    <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Dans <strong className="text-[var(--foreground)]">Paramètres</strong>, configurez d’abord les <strong className="text-[var(--foreground)]">établissements</strong> (raison sociale, SIRET, adresse, forme juridique, TVA si applicable) et les <strong className="text-[var(--foreground)]">comptes bancaires</strong>. Ensuite : numérotation (préfixe, format), mode et délai de paiement par défaut, mentions légales (pénalités, indémnités forfaitaires).
              </p>
              <p className="text-[var(--muted)] leading-relaxed">
                Si vous avez plusieurs sociétés ou établissements (formule Pro/Business), ajoutez un profil par établissement : vous pourrez choisir « Facturer au nom de » sur chaque facture ou devis.
              </p>
              <Link href="/parametres" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)] hover:text-[var(--muted)] transition-colors mt-2">
                <Settings className="w-4 h-4" />
                Ouvrir les paramètres
              </Link>
            </div>
          </div>
        </section>

        {/* ========== 8. CRÉER UN CLIENT ========== */}
        <section id="creer-client" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Créer un client</h2>
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-[360px] shrink-0">
              <div className="rounded-xl border-2 border-violet-500/30 bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-3 border-b border-[var(--border)] bg-violet-500/5">
                  <h3 className="font-semibold text-[var(--foreground)]">Nouveau client</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Prénom · Nom</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">Jean Dupont</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Raison sociale (optionnel)</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/5 text-[var(--muted)]">—</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">E-mail *</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">jean.dupont@exemple.fr</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Adresse · Code postal · Ville</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">12 rue Example, 75001 Paris</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">SIRET · N° TVA (optionnel)</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/5 text-[var(--muted)]">—</p>
                  </div>
                  <button type="button" className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium">Enregistrer</button>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Allez dans <strong className="text-[var(--foreground)]">Clients</strong> → <strong className="text-[var(--foreground)]">Nouveau client</strong>. Renseignez au minimum le <strong className="text-[var(--foreground)]">nom</strong> (ou raison sociale) et l’<strong className="text-[var(--foreground)]">e-mail</strong> (nécessaire pour envoyer factures et devis par e-mail). L’adresse et le SIRET/N° TVA sont optionnels mais utiles pour les documents et la comptabilité.
              </p>
              <p className="text-[var(--muted)] leading-relaxed">
                Une fois le client créé, il apparaît dans la liste et dans le sélecteur « Destinataire » lors de la création d’une facture ou d’un devis.
              </p>
              <Link href="/clients/nouveau" className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline transition-colors">
                <Users className="w-4 h-4" />
                Créer un client
              </Link>
            </div>
          </div>
        </section>

        {/* ========== 9. CRÉER UNE SOCIÉTÉ ========== */}
        <section id="creer-societe" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Créer une société</h2>
          <div className="flex flex-col lg:flex-row-reverse gap-8">
            <div className="lg:w-[360px] shrink-0">
              <div className="rounded-xl border-2 border-amber-500/30 bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-3 border-b border-[var(--border)] bg-amber-500/5">
                  <h3 className="font-semibold text-[var(--foreground)]">Nouvelle société</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Nom de la société *</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">SARL Martin</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Raison sociale (optionnel)</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">Martin & Cie</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">E-mail *</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">contact@sarl-martin.fr</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Adresse · Code postal · Ville</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">5 av. des Champs, 69001 Lyon</p>
                  </div>
                  <button type="button" className="w-full py-2 rounded-lg bg-amber-600 text-white text-sm font-medium">Enregistrer</button>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Les <strong className="text-[var(--foreground)]">sociétés</strong> sont des destinataires « morale » (entreprise, association). Allez dans <strong className="text-[var(--foreground)]">Sociétés</strong> → <strong className="text-[var(--foreground)]">Nouvelle société</strong>. Renseignez le <strong className="text-[var(--foreground)]">nom</strong> et l’<strong className="text-[var(--foreground)]">e-mail</strong>. Vous pouvez préciser la raison sociale et l’adresse pour les documents.
              </p>
              <p className="text-[var(--muted)] leading-relaxed">
                Lors de la création d’une facture ou d’un devis, choisissez « Société » comme type de destinataire puis sélectionnez la société dans la liste.
              </p>
              <Link href="/societes/nouveau" className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline transition-colors">
                <Building2 className="w-4 h-4" />
                Créer une société
              </Link>
            </div>
          </div>
        </section>

        {/* ========== 10. CRÉER UN PRODUIT ========== */}
        <section id="creer-produit" className="scroll-mt-24 mb-20">
          <h2 className="text-2xl font-bold mb-6">Créer un produit</h2>
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-[360px] shrink-0">
              <div className="rounded-xl border-2 border-teal-500/30 bg-[var(--background)] overflow-hidden shadow-lg text-sm">
                <div className="p-3 border-b border-[var(--border)] bg-teal-500/5">
                  <h3 className="font-semibold text-[var(--foreground)]">Nouveau produit / service</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Nom *</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">Prestation conseil</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Description (optionnel)</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/5 text-[var(--muted)]">—</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Prix unitaire HT *</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">1 200,00 €</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Taux TVA %</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">20</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Remise % (optionnel)</p>
                    <p className="px-3 py-2 rounded-lg border border-[var(--border)]">0</p>
                  </div>
                  <button type="button" className="w-full py-2 rounded-lg bg-teal-600 text-white text-sm font-medium">Enregistrer</button>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[var(--muted)] leading-relaxed mb-4">
                Les <strong className="text-[var(--foreground)]">produits</strong> (ou services) permettent de remplir une ligne de facture ou de devis en un clic. Allez dans <strong className="text-[var(--foreground)]">Produits</strong> → <strong className="text-[var(--foreground)]">Nouveau produit</strong>. Renseignez le <strong className="text-[var(--foreground)]">nom</strong>, le <strong className="text-[var(--foreground)]">prix unitaire HT</strong> et le <strong className="text-[var(--foreground)]">taux de TVA</strong>. La description et la remise sont optionnelles.
              </p>
              <p className="text-[var(--muted)] leading-relaxed">
                Lors de la saisie d’une facture ou d’un devis, utilisez « + Ajouter un produit » dans le bloc Lignes pour insérer une ligne préremplie avec ce produit. Vous gagnez du temps sur les factures récurrentes.
              </p>
              <Link href="/produits/nouveau" className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline transition-colors">
                <Package className="w-4 h-4" />
                Créer un produit
              </Link>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <div className="mt-16 p-6 md:p-8 rounded-2xl border border-[var(--border)] bg-[var(--border)]/10 text-center">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Prêt à commencer ?</h2>
          <p className="text-[var(--muted)] mb-4 max-w-md mx-auto">
            Configurez vos paramètres (établissement + compte bancaire), créez un client ou une société, puis votre première facture ou devis.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/parametres" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium text-sm hover:bg-amber-500/20 transition-colors">
              <Settings className="w-4 h-4" />
              Paramètres (à faire en premier)
            </Link>
            <Link href="/creer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium text-sm hover:opacity-90 transition-opacity">
              <FilePlus2 className="w-4 h-4" />
              Créer un document
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] font-medium text-sm hover:bg-[var(--border)]/20 transition-colors">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
