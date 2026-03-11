'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { canCreateDocument, CANNOT_CREATE_MESSAGE } from '@/lib/can-create-document'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { InvoiceQuotePreview } from '../../_components/InvoiceQuotePreview'

type BankAccount = { id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }
type EmitterProfile = { id: string; name: string; companyName: string; legalStatus: string; siret: string }
type InvoiceOption = { id: string; number: string }
type Product = { id: string; name: string; description: string; unitPrice: number; vatRate: number; discount: number }

export default function NouvelAvoirPage() {
  const router = useRouter()
  const [canCreate, setCanCreate] = useState<boolean | null>(null)
  const [clients, setClients] = useState<{ id: string; firstName: string; lastName: string; companyName: string | null }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [invoices, setInvoices] = useState<InvoiceOption[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [emitterProfiles, setEmitterProfiles] = useState<EmitterProfile[]>([])
  const [emitterProfileId, setEmitterProfileId] = useState('')
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState([{ description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const [recipientType, setRecipientType] = useState<'client' | 'company'>('client')
  const [clientId, setClientId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [formError, setFormError] = useState('')
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
    fetch('/api/invoices').then((r) => {
      if (r.ok) return r.json().then((list: { id: string; number: string }[]) => setInvoices(list.map((i) => ({ id: i.id, number: i.number }))))
    })
    fetch('/api/products').then((r) => { if (r.ok) return r.json().then(setProducts) })
  }, [canCreate])

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
    ? (clients.find((c) => c.id === clientId) ? [clients.find((c) => c.id === clientId)!.firstName, clients.find((c) => c.id === clientId)!.lastName].filter(Boolean).join(' ') || clients.find((c) => c.id === clientId)!.companyName || '' : '')
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
      const res = await fetch('/api/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId || null,
          companyId: companyId || null,
          invoiceId: invoiceId || null,
          issueDate,
          reason: reason.trim() || null,
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
      if (res.ok) {
        const cn = await res.json()
        router.push(`/avoirs?created=${cn.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (canCreate === false) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/avoirs" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour aux avoirs
        </Link>
        <div className="border border-amber-500/50 rounded-xl p-6 bg-amber-500/10 flex gap-4">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Informations requises</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{CANNOT_CREATE_MESSAGE}</p>
            <Link href="/parametres" className="inline-block mt-2 text-sm font-medium text-amber-700 dark:text-amber-200 underline">Paramètres →</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/avoirs" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour aux avoirs
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Créer un avoir</h1>
      <p className="text-[var(--muted)] text-sm mb-8">Remboursement ou annulation partielle. Le CA (chiffre d&apos;affaires) du dashboard sera diminué du montant des avoirs.</p>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).getAttribute('type') !== 'submit') e.preventDefault()
        }}
        className="space-y-6"
      >
        {emitterProfiles.length >= 1 && (
          <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
            <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Émetteur</h2>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Facturer au nom de (obligatoire)</label>
              <select value={emitterProfileId} onChange={(e) => { setEmitterProfileId(e.target.value); setFormError('') }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" required>
                <option value="">— Sélectionner un émetteur —</option>
                {emitterProfiles.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.name || ep.companyName || ep.id}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {formError && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{formError}</p>}
        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
          <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Destinataire et facture d&apos;origine</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Type de destinataire</label>
              <select value={recipientType} onChange={(e) => { setRecipientType(e.target.value as 'client' | 'company'); setClientId(''); setCompanyId(''); setFormError('') }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
                <option value="client">Client</option>
                <option value="company">Société</option>
              </select>
            </div>
            {recipientType === 'client' && (
              <div className="sm:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Client (obligatoire)</label>
                <select value={clientId} onChange={(e) => { setClientId(e.target.value); setFormError('') }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" required>
                  <option value="">— Sélectionner un client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}</option>
                  ))}
                </select>
              </div>
            )}
            {recipientType === 'company' && (
              <div className="sm:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Société (obligatoire)</label>
                <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setFormError('') }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" required>
                  <option value="">— Sélectionner une société —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-sm text-[var(--muted)] mb-1">Facture d&apos;origine (optionnel)</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
                <option value="">— Aucune —</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Date d&apos;émission</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-[var(--muted)] mb-1">Motif (optionnel)</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. Remboursement, annulation partielle" className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-[var(--muted)] mb-1">Mode de paiement (obligatoire)</label>
              <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setFormError('') }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" required>
                <option value="">— Sélectionner —</option>
                <option value="Virement bancaire">Virement bancaire</option>
                <option value="Chèque">Chèque</option>
                <option value="Carte bancaire">Carte bancaire</option>
                <option value="Espèces">Espèces</option>
                <option value="Virement SEPA">Virement SEPA</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            {bankAccounts.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Compte bancaire de référence (obligatoire)</label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" required={bankAccounts.length > 0}>
                  <option value="">— Sélectionner un compte —</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name || acc.iban || 'Compte'}</option>
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
                    const productId = e.target.value
                    if (productId) {
                      const p = products.find((x) => x.id === productId)
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
                  <textarea value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Description" rows={1} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] resize-y min-h-[2.5rem]" />
                </div>
                <div className="col-span-1">
                  <input type="number" min={0} step={1} value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm" />
                </div>
                <div className="col-span-2">
                  <input type="number" min={0} step={0.01} value={line.unitPrice || ''} onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) updateLine(i, 'unitPrice', v); else updateLine(i, 'unitPrice', e.target.value) }} onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v >= 0) updateLine(i, 'unitPrice', roundDownTo2Decimals(v)) }} placeholder="0" className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm" />
                </div>
                <div className="col-span-1">
                  <input type="number" min={0} max={100} value={line.vatRate} onChange={(e) => updateLine(i, 'vatRate', e.target.value)} className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm" />
                </div>
                <div className="col-span-1">
                  <input type="number" min={0} max={100} value={line.discount} onChange={(e) => updateLine(i, 'discount', e.target.value)} className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm" />
                </div>
                <div className="col-span-2">
                  <input type="number" min={0} step={0.01} value={editingTotalAt === i ? editingTotalValue : (lineTotalTTC(line) ?? '')} onFocus={() => { setEditingTotalAt(i); const t = lineTotalTTC(line); setEditingTotalValue(t ? String(t) : '') }} onChange={(e) => setEditingTotalValue(e.target.value)} onBlur={() => { if (editingTotalAt !== i) return; const v = parseFloat(editingTotalValue); if (!Number.isNaN(v) && v >= 0) setLineUnitPriceFromTotal(i, v); setEditingTotalAt(null); setEditingTotalValue('') }} placeholder="0" className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm" title="Saisir le total TTC" />
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeLine(i)} className="text-[var(--muted)] hover:text-red-600 text-sm" title="Supprimer">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? 'Création…' : 'Créer l\'avoir'}
          </button>
          <Link href="/avoirs" className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium hover:bg-[var(--border)]/20">
            Annuler
          </Link>
        </div>
      </form>

      <div className="mt-8 border border-[var(--border)] rounded-xl p-6 bg-[var(--border)]/10">
        <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Aperçu en temps réel</h2>
        <InvoiceQuotePreview
          type="credit_note"
          recipientName={recipientName}
          issueDate={issueDate}
          paymentMethod={paymentMethod || undefined}
          lines={lines}
        />
      </div>
    </div>
  )
}
