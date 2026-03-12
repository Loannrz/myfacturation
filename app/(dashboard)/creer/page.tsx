'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { FileText, Receipt, RotateCcw, Wallet, UserCircle, User, Package } from 'lucide-react'
import { CreateEmployeeModal } from '../components/CreateEmployeeModal'
import { CreateExpenseModal } from '../components/CreateExpenseModal'

export default function CreerPage() {
  const { data: session } = useSession()
  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const canEmployees = plan === 'business'
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Créer</h1>
      <p className="text-[var(--muted)] text-sm mb-8">Devis, facture, avoir, dépense, client ou produit.</p>

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
        <button
          type="button"
          onClick={() => setExpenseModalOpen(true)}
          className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)] hover:bg-[var(--border)]/10 transition-colors text-left"
        >
          <div className="p-4 rounded-full bg-[var(--border)]/30">
            <Wallet className="w-10 h-10 text-[var(--foreground)]" />
          </div>
          <span className="text-lg font-medium">Créer une dépense</span>
          <span className="text-sm text-[var(--muted)] text-center">Dépenses et comptabilité</span>
        </button>
        <Link
          href="/clients/nouveau"
          className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)] hover:bg-[var(--border)]/10 transition-colors"
        >
          <div className="p-4 rounded-full bg-[var(--border)]/30">
            <User className="w-10 h-10 text-[var(--foreground)]" />
          </div>
          <span className="text-lg font-medium">Nouveau client</span>
          <span className="text-sm text-[var(--muted)] text-center">Particulier, entreprise ou société</span>
        </Link>
        <Link
          href="/produits/nouveau"
          className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)] hover:bg-[var(--border)]/10 transition-colors"
        >
          <div className="p-4 rounded-full bg-[var(--border)]/30">
            <Package className="w-10 h-10 text-[var(--foreground)]" />
          </div>
          <span className="text-lg font-medium">Nouveau produit</span>
          <span className="text-sm text-[var(--muted)] text-center">Produit ou service à réutiliser</span>
        </Link>
        {canEmployees && (
          <button
            type="button"
            onClick={() => setEmployeeModalOpen(true)}
            className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)] hover:bg-[var(--border)]/10 transition-colors text-left"
          >
            <div className="p-4 rounded-full bg-[var(--border)]/30">
              <UserCircle className="w-10 h-10 text-[var(--foreground)]" />
            </div>
            <span className="text-lg font-medium">Créer un salarié</span>
            <span className="text-sm text-[var(--muted)] text-center">Ajouter un salarié à l&apos;entreprise (Business)</span>
          </button>
        )}
      </div>

      <CreateEmployeeModal open={employeeModalOpen} onClose={() => setEmployeeModalOpen(false)} onSuccess={() => setEmployeeModalOpen(false)} />
      <CreateExpenseModal open={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} onSuccess={() => setExpenseModalOpen(false)} />
    </div>
  )
}
