'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Package, Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { UpgradeGate } from '../components/UpgradeGate'

type Product = {
  id: string
  name: string
  description: string
  type: string
  unitPrice: number
  vatRate: number
  discount: number
}

export default function ProduitsPage() {
  const { data: session } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [usage, setUsage] = useState<{ productsCount: number; productsLimit: number | null } | null>(null)
  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (typeFilter) params.set('type', typeFilter)
    setLoading(true)
    fetch(`/api/products?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [q, typeFilter])

  useEffect(() => {
    if (plan !== 'pro' && plan !== 'business') return
    fetch('/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUsage({ productsCount: data.productsCount ?? 0, productsLimit: data.productsLimit ?? null }))
  }, [plan])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer le produit « ${name} » ?`)) return
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (res.ok) setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <UpgradeGate plan={plan as 'starter' | 'pro' | 'business'} requiredPlan="pro" title="Produits / Services">
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Préparez des produits à réutiliser dans vos devis et factures
            {usage && usage.productsLimit != null && (
              <span className="ml-1">
                — <strong className="text-[var(--foreground)]">{usage.productsCount}</strong> / {usage.productsLimit} max
              </span>
            )}
          </p>
        </div>
        {usage && usage.productsLimit != null && usage.productsCount >= usage.productsLimit ? (
          <Link
            href="/formules"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium"
          >
            Limite atteinte — Passer à Business
          </Link>
        ) : (
          <Link
            href="/produits/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Nouveau produit
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="search"
            placeholder="Rechercher (nom, description)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
        >
          <option value="">Tous</option>
          <option value="service">Service</option>
          <option value="product">Produit</option>
        </select>
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Aucun produit. Créez-en un pour les ajouter rapidement à vos devis et factures.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
                  <th className="text-left p-3 font-medium">Nom</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-right p-3 font-medium">Prix unitaire</th>
                  <th className="text-right p-3 font-medium">TVA %</th>
                  <th className="w-24 p-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/5">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-[var(--muted)] max-w-xs truncate">{p.description || '—'}</td>
                    <td className="p-3 capitalize">{p.type}</td>
                    <td className="p-3 text-right">{p.unitPrice.toFixed(2)} €</td>
                    <td className="p-3 text-right">{p.vatRate} %</td>
                    <td className="p-3 flex items-center gap-1">
                      <Link
                        href={`/produits/${p.id}/modifier`}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-red-500/10 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </UpgradeGate>
  )
}
