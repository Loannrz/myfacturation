'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { canCreateDocument, CANNOT_CREATE_MESSAGE } from '@/lib/can-create-document'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { InvoiceQuotePreview } from '../../_components/InvoiceQuotePreview'

type Product = { id: string; name: string; description: string; unitPrice: number; vatRate: number; discount: number }
type BankAccount = { id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }
type EmitterProfile = { id: string; name: string; companyName: string; legalStatus: string; siret: string }

export default function NouveauDevisPage() {
  const router = useRouter()
  const [canCreate, setCanCreate] = useState<boolean | null>(null)
  const [clients, setClients] = useState<{ id: string; firstName: string; lastName: string; companyName: string | null }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [emitterProfiles, setEmitterProfiles] = useState<EmitterProfile[]>([])
  const [emitterProfileId, setEmitterProfileId] = useState('')
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState([{ description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const [recipientType, setRecipientType] = useState<'client' | 'company'>('client')
  const [clientId, setClientId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const PAYMENT_TERM_DAYS = [15, 30, 60, 90] as const
  const [paymentTermDays, setPaymentTermDays] = useState<15 | 30 | 60 | 90>(30)
  const [dueDate, setDueDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [formError, setFormError] = useState('')
  const [limitReached, setLimitReached] = useState(false)
  /** Saisie libre du total TTC : index de la ligne en cours d’édition, et valeur affichée (string). */
  const [editingTotalAt, setEditingTotalAt] = useState<number | null>(null)
  const [editingTotalValue, setEditingTotalValue] = useState('')

  useEffect(() => {
    Promise.all([fetch('/api/me').then((r) => r.ok ? r.json() : null), fetch('/api/settings').then((r) => r.ok ? r.json() : null)])
      .then(([me, settings]) => {
        if (me && settings) {
          setCanCreate(canCreateDocument({ name: me.name, ...settings }))
          const accounts = Array.isArray(settings.bankAccounts) ? settings.bankAccounts : []
          setBankAccounts(accounts)
          if (accounts.length === 1) setBankAccountId(accounts[0].id)
          const profiles = Array.isArray(settings.emitterProfiles) ? settings.emitterProfiles : []
          setEmitterProfiles(profiles)
          if (profiles.length > 0) setEmitterProfileId((prev) => prev || profiles[0].id)
        } else setCanCreate(false)
      })
      .catch(() => setCanCreate(false))
  }, [])

  useEffect(() => {
    if (canCreate !== true) return
    fetch('/api/clients').then((r) => { if (r.ok) return r.json().then(setClients) })
    fetch('/api/companies').then((r) => { if (r.ok) return r.json().then(setCompanies) })
    fetch('/api/products').then((r) => { if (r.ok) return r.json().then(setProducts) })
  }, [canCreate])

  useEffect(() => {
    if (!issueDate) return
    const d = new Date(issueDate)
    d.setDate(d.getDate() + paymentTermDays)
    setDueDate(d.toISOString().slice(0, 10))
  }, [issueDate, paymentTermDays])

  const addLine = () => setLines((l) => [...l, { description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const addProductAsLine = (product: Product) => {
    setLines((l) => [...l, {
      description: product.name,
      quantity: 1,
      unitPrice: product.unitPrice,
      vatRate: product.vatRate,
      discount: product.discount,
    }])
  }
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: string, value: string | number) => {
    setLines((l) => l.map((line, idx) => (idx === i ? { ...line, [field]: value } : line)))
  }
  /** Arrondit à 2 décimales par excès si plus de 2 décimales (ex. 83,3333 → 83,34). */
  const lineTotalTTC = (line: { quantity: number; unitPrice: number; vatRate: number; discount: number }) => {
    const q = Number(line.quantity) || 0
    const pu = Number(line.unitPrice) || 0
    const vat = Number(line.vatRate) ?? 20
    const rem = Number(line.discount) ?? 0
    return Math.round(q * pu * (1 - rem / 100) * (1 + vat / 100) * 100) / 100
  }
  const setLineUnitPriceFromTotal = (i: number, totalTTC: number) => {
    const line = lines[i]
    const q = Math.max(Number(line.quantity) || 1, 1)
    const vat = Number(line.vatRate) ?? 20
    const rem = Number(line.discount) ?? 0
    const denom = q * (1 - rem / 100) * (1 + vat / 100)
    const puRaw = denom ? totalTTC / denom : 0
    const pu = roundDownTo2Decimals(puRaw)
    updateLine(i, 'unitPrice', pu)
  }

  const recipientName = clientId
    ? (clients.find((c) => c.id === clientId)
        ? [clients.find((c) => c.id === clientId)!.firstName, clients.find((c) => c.id === clientId)!.lastName].filter(Boolean).join(' ') || clients.find((c) => c.id === clientId)!.companyName || ''
        : '')
    : companyId
      ? (companies.find((c) => c.id === companyId)?.name ?? '')
      : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!canCreate) return
    if (emitterProfiles.length >= 1 && !emitterProfileId.trim()) {
      setFormError('Veuillez sélectionner un émetteur (facturer au nom de).')
      return
    }
    const hasRecipient = (recipientType === 'client' && clientId.trim()) || (recipientType === 'company' && companyId.trim())
    if (!hasRecipient) {
      setFormError('Veuillez sélectionner un destinataire (client ou société).')
      return
    }
    if (!paymentMethod.trim()) {
      setFormError('Veuillez sélectionner un mode de paiement.')
      return
    }
    if (bankAccounts.length > 0 && !bankAccountId.trim()) {
      setFormError('Veuillez sélectionner un compte bancaire de référence.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId || null,
          companyId: companyId || null,
          issueDate,
          dueDate: dueDate || null,
          paymentMethod: paymentMethod || null,
          bankAccountId: bankAccountId || null,
          emitterProfileId: emitterProfileId || null,
          lines: lines.map((line) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            vatRate: Number(line.vatRate),
            discount: Number(line.discount),
          })),
        }),
      })
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}))
        setFormError(data.message || 'Limite gratuite atteinte.')
        setLimitReached(true)
        return
      }
      if (res.ok) {
        const quote = await res.json()
        router.push(`/devis?created=${quote.id}`)
      } else {
        const data = await res.json().catch(() => ({}))
        setFormError(data.error || 'Erreur lors de la création')
      }
    } finally {
      setLoading(false)
    }
  }

  if (canCreate === false) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/devis" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour aux devis
        </Link>
        <div className="border border-amber-500/50 rounded-xl p-6 bg-amber-500/10 flex gap-4">
          <AlertCircle className="w-10 h-10 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-amber-800 dark:text-amber-200">Impossible de créer un devis</h1>
            <p className="text-[var(--foreground)] mt-2">{CANNOT_CREATE_MESSAGE}</p>
            <p className="text-sm text-[var(--muted)] mt-2">Renseignez votre nom et toutes les informations sur vos factures (forme juridique, raison sociale, SIRET, adresse, code postal, ville) dans Paramètres.</p>
            <Link href="/parametres" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90">
              Remplir les informations →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (canCreate === null) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/devis" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour aux devis
        </Link>
        <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Link href="/devis" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour aux devis
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">Nouveau devis</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Remplissez les champs et consultez l&apos;aperçu en bas.</p>

      <div className="space-y-8">
        <form onSubmit={handleSubmit} className="space-y-6">
        {emitterProfiles.length >= 1 && (
          <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
            <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Émetteur</h2>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Facturer au nom de (obligatoire)</label>
              <select value={emitterProfileId} onChange={(e) => { setEmitterProfileId(e.target.value); setFormError('') }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" required>
                <option value="">— Sélectionner un émetteur —</option>
                {emitterProfiles.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.name || ep.companyName || ep.id}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {formError && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{formError}</p>}
        {limitReached && (
          <div className="p-4 rounded-xl border border-violet-500/50 bg-violet-500/10 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-violet-800 dark:text-violet-200">Passez à Pro pour créer des devis illimités.</p>
            <div className="flex gap-2">
              <Link href="/formules" className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm">Passer à Pro</Link>
              <button type="button" onClick={() => setLimitReached(false)} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm">Plus tard</button>
            </div>
          </div>
        )}
        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
          <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Destinataire</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-2">Type de destinataire</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    checked={recipientType === 'client'}
                    onChange={() => { setRecipientType('client'); setCompanyId(''); setClientId('') }}
                    className="rounded-full border-[var(--border)]"
                  />
                  <span className="text-sm">Client</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    checked={recipientType === 'company'}
                    onChange={() => { setRecipientType('company'); setClientId(''); setCompanyId('') }}
                    className="rounded-full border-[var(--border)]"
                  />
                  <span className="text-sm">Société</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                {recipientType === 'client' ? 'Client' : 'Société'} (obligatoire)
              </label>
              <select
                value={recipientType === 'client' ? clientId : companyId}
                onChange={(e) => {
                  const v = e.target.value
                  if (recipientType === 'client') { setClientId(v); setCompanyId(''); setFormError('') }
                  else { setCompanyId(v); setClientId(''); setFormError('') }
                }}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                required
              >
                <option value="">— Sélectionner {recipientType === 'client' ? 'un client' : 'une société'} —</option>
                {recipientType === 'client'
                  ? clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}
                      </option>
                    ))
                  : companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
          <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Dates et paiement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Date d'émission</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" required />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Délai de paiement</label>
              <select value={paymentTermDays} onChange={(e) => setPaymentTermDays(Number(e.target.value) as 15 | 30 | 60 | 90)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]">
                {PAYMENT_TERM_DAYS.map((days) => (
                  <option key={days} value={days}>{days} jours</option>
                ))}
              </select>
              {dueDate && <p className="text-xs text-[var(--muted)] mt-1">Échéance : {new Date(dueDate + 'T12:00:00').toLocaleDateString('fr-FR')}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-[var(--muted)] mb-1">Mode de paiement (obligatoire)</label>
              <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setFormError('') }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" required>
                <option value="">— Sélectionner —</option>
                <option value="Virement bancaire">Virement bancaire</option>
                <option value="Chèque">Chèque</option>
                <option value="Carte bancaire">Carte bancaire</option>
                <option value="Espèces">Espèces</option>
                <option value="Prélèvement">Prélèvement</option>
                <option value="Virement SEPA">Virement SEPA</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            {bankAccounts.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Compte bancaire de référence (obligatoire)</label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" required={bankAccounts.length > 0}>
                  <option value="">— Sélectionner un compte —</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name || acc.iban || 'Compte sans nom'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-sm font-medium text-[var(--foreground)]">Lignes</h2>
            <div className="flex items-center gap-2">
              {products.length > 0 && (
                <select
                  className="text-sm px-2 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (id) {
                      const p = products.find((x) => x.id === id)
                      if (p) addProductAsLine(p)
                      e.target.value = ''
                    }
                  }}
                >
                  <option value="">+ Ajouter un produit</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.unitPrice.toFixed(2)} €</option>
                  ))}
                </select>
              )}
              <button type="button" onClick={addLine} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">+ Ligne</button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-[var(--muted)] pb-1">
              <div className="col-span-4">Description</div>
              <div className="col-span-1">Qté</div>
              <div className="col-span-2">P.U.</div>
              <div className="col-span-1">TVA %</div>
              <div className="col-span-1">Remise %</div>
              <div className="col-span-2">Total TTC</div>
              <div className="col-span-1" />
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                    className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.unitPrice || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (!Number.isNaN(v)) updateLine(i, 'unitPrice', v)
                      else updateLine(i, 'unitPrice', e.target.value)
                    }}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value)
                      if (!Number.isNaN(v) && v >= 0) updateLine(i, 'unitPrice', roundDownTo2Decimals(v))
                    }}
                    placeholder="0"
                    className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={line.vatRate}
                    onChange={(e) => updateLine(i, 'vatRate', e.target.value)}
                    className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={line.discount}
                    onChange={(e) => updateLine(i, 'discount', e.target.value)}
                    className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editingTotalAt === i ? editingTotalValue : (lineTotalTTC(line) ?? '')}
                    onFocus={() => {
                      setEditingTotalAt(i)
                      const t = lineTotalTTC(line)
                      setEditingTotalValue(t ? String(t) : '')
                    }}
                    onChange={(e) => setEditingTotalValue(e.target.value)}
                    onBlur={() => {
                      if (editingTotalAt !== i) return
                      const v = parseFloat(editingTotalValue)
                      if (!Number.isNaN(v) && v >= 0) setLineUnitPriceFromTotal(i, v)
                      setEditingTotalAt(null)
                      setEditingTotalValue('')
                    }}
                    placeholder="0"
                    className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                    title="Saisir le PU ou le total : le PU se calcule à partir du total quand vous quittez le champ"
                  />
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeLine(i)} className="text-[var(--muted)] hover:text-red-600 text-sm" title="Supprimer la ligne">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? 'Création…' : 'Créer le devis'}
          </button>
          <Link href="/devis" className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium hover:bg-[var(--border)]/20">
            Annuler
          </Link>
        </div>
      </form>

        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--border)]/10">
          <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Aperçu</h2>
          <InvoiceQuotePreview
            type="quote"
            recipientName={recipientName}
            issueDate={issueDate}
            dueDate={dueDate}
            paymentMethod={paymentMethod}
            lines={lines}
          />
        </div>
      </div>
    </div>
  )
}
