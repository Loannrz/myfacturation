'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { InvoiceQuotePreview } from '../../../_components/InvoiceQuotePreview'

type Product = { id: string; name: string; description: string; unitPrice: number; vatRate: number; discount: number }
type InvoiceLine = { description: string; quantity: number; unitPrice: number; vatRate: number; discount: number }

export default function ModifierFacturePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [clients, setClients] = useState<{ id: string; firstName: string; lastName: string; companyName: string | null }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingInvoice, setLoadingInvoice] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lines, setLines] = useState<InvoiceLine[]>([{ description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const [recipientType, setRecipientType] = useState<'client' | 'company'>('client')
  const [clientId, setClientId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const PAYMENT_TERM_DAYS = [15, 30, 60, 90] as const
  const [paymentTermDays, setPaymentTermDays] = useState<15 | 30 | 60 | 90>(30)
  const [dueDate, setDueDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }[]>([])
  const [emitterProfiles, setEmitterProfiles] = useState<{ id: string; name: string; companyName: string }[]>([])
  const [emitterProfileId, setEmitterProfileId] = useState('')
  const [status, setStatus] = useState('draft')
  const [paidAt, setPaidAt] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/invoices/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/clients').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/companies').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/products').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
    ]).then(([invoice, clientsList, companiesList, productsList, settings]) => {
      if (!invoice) {
        setNotFound(true)
        setLoadingInvoice(false)
        return
      }
      setClients(clientsList)
      setCompanies(companiesList)
      setProducts(productsList)
      setBankAccounts(Array.isArray(settings?.bankAccounts) ? settings.bankAccounts : [])
      const profiles = Array.isArray(settings?.emitterProfiles) ? settings.emitterProfiles : []
      setEmitterProfiles(profiles)
      setEmitterProfileId(invoice.emitterProfileId ?? (profiles[0]?.id ?? ''))
      setClientId(invoice.clientId ?? '')
      setCompanyId(invoice.companyId ?? '')
      setRecipientType(invoice.clientId ? 'client' : invoice.companyId ? 'company' : 'client')
      setIssueDate(invoice.issueDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
      const issue = invoice.issueDate?.slice(0, 10)
      const due = invoice.dueDate?.slice(0, 10)
      if (issue && due) {
        const diff = Math.round((new Date(due).getTime() - new Date(issue).getTime()) / (24 * 60 * 60 * 1000))
        const closest = ([15, 30, 60, 90] as const).reduce((a, b) => (Math.abs(a - diff) < Math.abs(b - diff) ? a : b))
        setPaymentTermDays(closest)
      } else setPaymentTermDays(30)
      setPaymentMethod(invoice.paymentMethod ?? '')
      setBankAccountId(invoice.bankAccountId ?? '')
      setStatus(invoice.status ?? 'draft')
      setPaidAt(invoice.paidAt ? new Date(invoice.paidAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
      if (Array.isArray(invoice.lines) && invoice.lines.length > 0) {
        setLines(invoice.lines.map((l: { description?: string; quantity?: number; unitPrice?: number; vatRate?: number; discount?: number }) => ({
          description: l.description ?? '',
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
          vatRate: Number(l.vatRate) ?? 20,
          discount: Number(l.discount) ?? 0,
        })))
      }
      setLoadingInvoice(false)
    })
  }, [id])

  const addLine = () => setLines((l) => [...l, { description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const addProductAsLine = (product: Product) => {
    setLines((l) => [...l, { description: product.name, quantity: 1, unitPrice: product.unitPrice, vatRate: product.vatRate, discount: product.discount }])
  }
  useEffect(() => {
    if (!issueDate) return
    const d = new Date(issueDate)
    d.setDate(d.getDate() + paymentTermDays)
    setDueDate(d.toISOString().slice(0, 10))
  }, [issueDate, paymentTermDays])

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
    const pu = denom ? roundDownTo2Decimals(totalTTC / denom) : 0
    updateLine(i, 'unitPrice', pu)
  }

  const recipientName = clientId
    ? (clients.find((c) => c.id === clientId) ? [clients.find((c) => c.id === clientId)!.firstName, clients.find((c) => c.id === clientId)!.lastName].filter(Boolean).join(' ') || clients.find((c) => c.id === clientId)!.companyName || '' : '')
    : companyId ? (companies.find((c) => c.id === companyId)?.name ?? '') : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          clientId: clientId || null,
          companyId: companyId || null,
          issueDate,
          dueDate: dueDate || null,
          paidAt: status === 'paid' && paidAt ? paidAt : undefined,
          currency: 'EUR',
          paymentTerms: paymentTermDays ? `${paymentTermDays} jours net` : null,
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
      if (res.ok) router.push(`/factures?updated=${id}`)
    } finally {
      setLoading(false)
    }
  }

  if (loadingInvoice) {
    return (
      <div className="max-w-6xl mx-auto">
        <Link href="/factures" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour aux factures
        </Link>
        <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-6xl mx-auto">
        <Link href="/factures" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour aux factures
        </Link>
        <div className="p-8 text-center text-[var(--muted)]">Facture introuvable.</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Link href="/factures" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour aux factures
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">Modifier la facture</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Consultez l&apos;aperçu en bas.</p>

      <div className="space-y-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {emitterProfiles.length > 1 && (
            <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
              <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Émetteur</h2>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Facturer au nom de</label>
                <select value={emitterProfileId} onChange={(e) => setEmitterProfileId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]">
                  {emitterProfiles.map((ep) => (
                    <option key={ep.id} value={ep.id}>{ep.name || ep.companyName || ep.id}</option>
                  ))}
                </select>
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
                    <input type="radio" name="recipientType" checked={recipientType === 'client'} onChange={() => { setRecipientType('client'); setCompanyId(''); setClientId('') }} className="rounded-full border-[var(--border)]" />
                    <span className="text-sm">Client</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="recipientType" checked={recipientType === 'company'} onChange={() => { setRecipientType('company'); setClientId(''); setCompanyId('') }} className="rounded-full border-[var(--border)]" />
                    <span className="text-sm">Société</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">{recipientType === 'client' ? 'Client' : 'Société'}</label>
                <select value={recipientType === 'client' ? clientId : companyId} onChange={(e) => { const v = e.target.value; if (recipientType === 'client') { setClientId(v); setCompanyId('') } else { setCompanyId(v); setClientId('') } }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]">
                  <option value="">— Sélectionner {recipientType === 'client' ? 'un client' : 'une société'} —</option>
                  {recipientType === 'client' ? clients.map((c) => (<option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}</option>)) : companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            </div>
          </div>

          <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
            <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Dates et paiement</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Date d&apos;émission</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" required />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Délai de paiement</label>
                <select value={paymentTermDays} onChange={(e) => setPaymentTermDays(Number(e.target.value) as 15 | 30 | 60 | 90)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]">
                  {PAYMENT_TERM_DAYS.map((days) => (<option key={days} value={days}>{days} jours</option>))}
                </select>
                {dueDate && <p className="text-xs text-[var(--muted)] mt-1">Échéance : {new Date(dueDate + 'T12:00:00').toLocaleDateString('fr-FR')}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Mode de paiement</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]">
                  <option value="">— Sélectionner —</option>
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Carte bancaire">Carte bancaire</option>
                  <option value="Espèces">Espèces</option>
                  <option value="Prélèvement">Prélèvement</option>
                  <option value="Virement SEPA">Virement SEPA</option>
                  <option value="Autre">Autre</option>
                  {paymentMethod && !['', 'Virement bancaire', 'Chèque', 'Carte bancaire', 'Espèces', 'Prélèvement', 'Virement SEPA', 'Autre'].includes(paymentMethod) && (
                    <option value={paymentMethod}>{paymentMethod}</option>
                  )}
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
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Statut</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]">
                  <option value="draft">Brouillon</option>
                  <option value="sent">Envoyée</option>
                  <option value="paid">Payée</option>
                  <option value="pending">En attente</option>
                  <option value="late">En retard</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>
              {status === 'paid' && (
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Date de paiement</label>
                  <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" />
                </div>
              )}
            </div>
          </div>

          <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h2 className="text-sm font-medium text-[var(--foreground)]">Lignes</h2>
              <div className="flex items-center gap-2">
                {products.length > 0 && (
                  <select className="text-sm px-2 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)]" value="" onChange={(e) => { const pid = e.target.value; if (pid) { const p = products.find((x) => x.id === pid); if (p) addProductAsLine(p); e.target.value = '' } }}>
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
                    <input type="text" value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Description" className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min={0} step={1} value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min={0} step={0.01} value={line.unitPrice || ''} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v >= 0) updateLine(i, 'unitPrice', roundDownTo2Decimals(v)) }} placeholder="0" className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min={0} max={100} value={line.vatRate} onChange={(e) => updateLine(i, 'vatRate', e.target.value)} className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min={0} max={100} value={line.discount} onChange={(e) => updateLine(i, 'discount', e.target.value)} className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min={0} step={0.01} value={lineTotalTTC(line) || ''} onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) setLineUnitPriceFromTotal(i, v) }} placeholder="0" className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" title="Saisir le PU ou le total : le PU se calcule à partir du total si vous modifiez cette case" />
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
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <Link href="/factures" className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium hover:bg-[var(--border)]/20">
              Annuler
            </Link>
          </div>
        </form>

        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--border)]/10">
          <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Aperçu</h2>
          <InvoiceQuotePreview type="invoice" recipientName={recipientName} issueDate={issueDate} dueDate={dueDate} paymentMethod={paymentMethod} lines={lines} />
        </div>
      </div>
    </div>
  )
}
