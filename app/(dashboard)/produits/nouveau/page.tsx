'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'

export default function NouveauProduitPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const [atLimit, setAtLimit] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (plan !== 'pro' && plan !== 'business') return
    fetch('/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const limit = data.productsLimit ?? null
        const count = data.productsCount ?? 0
        setAtLimit(limit != null && count >= limit)
      })
  }, [plan])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('service')
  const [unitPrice, setUnitPrice] = useState('')
  const [vatRate, setVatRate] = useState('20')
  const [discount, setDiscount] = useState('0')

  const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]'

  const totalTTCForOne = () => {
    const pu = parseFloat(unitPrice) || 0
    const vat = parseFloat(vatRate) ?? 20
    const rem = parseFloat(discount) ?? 0
    return Math.round(pu * (1 - rem / 100) * (1 + vat / 100) * 100) / 100
  }
  const setUnitPriceFromTotalTTC = (totalTTC: number) => {
    const vat = parseFloat(vatRate) ?? 20
    const rem = parseFloat(discount) ?? 0
    const denom = (1 - rem / 100) * (1 + vat / 100)
    const pu = denom ? roundDownTo2Decimals(totalTTC / denom) : 0
    setUnitPrice(String(pu))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          type,
          unitPrice: roundDownTo2Decimals(parseFloat(unitPrice) || 0),
          vatRate: parseFloat(vatRate) ?? 20,
          discount: parseFloat(discount) ?? 0,
        }),
      })
      if (res.ok) {
        const product = await res.json()
        router.push(`/produits?created=${product.id}`)
      } else {
        const data = await res.json().catch(() => ({}))
        if (res.status === 403) {
          setError(data.error || 'Limite de produits atteinte. Passez à Business pour des produits illimités.')
        } else {
          setError(data.error || 'Erreur lors de la création')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  if (plan === 'starter') {
    return (
      <div className="max-w-xl mx-auto">
        <Link href="/produits" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour aux produits
        </Link>
        <p className="text-[var(--muted)]">Les produits sont disponibles à partir de la formule Pro.</p>
        <Link href="/formules" className="inline-block mt-4 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">Voir les formules</Link>
      </div>
    )
  }

  if (atLimit === true) {
    return (
      <div className="max-w-xl mx-auto">
        <Link href="/produits" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour aux produits
        </Link>
        <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200">
          <p className="font-medium">Limite de 5 produits atteinte</p>
          <p className="text-sm mt-1">Passez à la formule Business pour créer des produits illimités.</p>
          <Link href="/formules" className="inline-block mt-3 text-sm font-medium underline">Voir les formules</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link href="/produits" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour aux produits
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-6">Nouveau produit</h1>

      <form onSubmit={handleSubmit} className="space-y-4 border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Nom *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            rows={2}
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            <option value="service">Service</option>
            <option value="product">Produit</option>
          </select>
        </div>
        <div className="flex flex-nowrap gap-3 items-end">
          <div className="min-w-0 flex-1">
            <label className="block text-sm text-[var(--muted)] mb-1">Prix unitaire HT (€) *</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="block text-sm text-[var(--muted)] mb-1">TVA %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="block text-sm text-[var(--muted)] mb-1">Remise %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="block text-sm text-[var(--muted)] mb-1">Total TTC (1 unité)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={totalTTCForOne() || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!Number.isNaN(v)) setUnitPriceFromTotalTTC(v)
              }}
              placeholder="0"
              className={inputClass}
              title="Saisir le prix unitaire ou le total TTC : le PU se calcule à partir du total si vous modifiez cette case"
            />
          </div>
        </div>
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Création…' : 'Créer le produit'}
          </button>
          <Link href="/produits" className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium hover:bg-[var(--border)]/20">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
