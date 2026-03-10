'use client'

import Link from 'next/link'
import { FileText, Receipt, RotateCcw, Wallet } from 'lucide-react'

export default function CreerPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Créer un document</h1>
      <p className="text-[var(--muted)] text-sm mb-8">Choisissez un devis, une facture, un avoir ou une dépense.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/devis/nouveau"
          className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)] hover:bg-[var(--border)]/10 transition-colors"
        >
          <div className="p-4 rounded-full bg-[var(--border)]/30">
            <FileText className="w-10 h-10 text-[var(--foreground)]" />
          </div>
          <span className="text-lg font-medium">Créer un devis</span>
          <span className="text-sm text-[var(--muted)] text-center">Devis pour vos clients</span>
        </Link>
        <Link
          href="/factures/nouvelle"
          className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)] hover:bg-[var(--border)]/10 transition-colors"
        >
          <div className="p-4 rounded-full bg-[var(--border)]/30">
            <Receipt className="w-10 h-10 text-[var(--foreground)]" />
          </div>
          <span className="text-lg font-medium">Créer une facture</span>
          <span className="text-sm text-[var(--muted)] text-center">Facture à envoyer ou à faire payer</span>
        </Link>
        <Link
          href="/avoirs/nouveau"
          className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)] hover:bg-[var(--border)]/10 transition-colors"
        >
          <div className="p-4 rounded-full bg-[var(--border)]/30">
            <RotateCcw className="w-10 h-10 text-[var(--foreground)]" />
          </div>
          <span className="text-lg font-medium">Créer un avoir</span>
          <span className="text-sm text-[var(--muted)] text-center">Avoir (remboursement, annulation partielle)</span>
        </Link>
        <Link
          href="/depenses"
          className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)] hover:bg-[var(--border)]/10 transition-colors"
        >
          <div className="p-4 rounded-full bg-[var(--border)]/30">
            <Wallet className="w-10 h-10 text-[var(--foreground)]" />
          </div>
          <span className="text-lg font-medium">Créer une dépense</span>
          <span className="text-sm text-[var(--muted)] text-center">Dépenses et comptabilité</span>
        </Link>
      </div>
    </div>
  )
}
