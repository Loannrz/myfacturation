'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { roundDownTo2Decimals } from '@/lib/billing-utils'
import { InvoiceQuotePreview } from '../../../_components/InvoiceQuotePreview'

type BankAccount = { id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }
type EmitterProfile = { id: string; name: string; companyName: string }
type InvoiceOption = { id: string; number: string }
type LineState = { description: string; quantity: number; unitPrice: number; vatRate: number; discount: number }

export default function ModifierAvoirPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [clients, setClients] = useState<{ id: string; firstName: string; lastName: string; companyName: string | null }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [invoices, setInvoices] = useState<InvoiceOption[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [emitterProfiles, setEmitterProfiles] = useState<EmitterProfile[]>([])
  const [emitterProfileId, setEmitterProfileId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCn, setLoadingCn] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [number, setNumber] = useState('')
  const [lines, setLines] = useState<LineState[]>([{ description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const [recipientType, setRecipientType] = useState<'client' | 'company'>('client')
  const [clientId, setClientId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('draft')
  const [refundedAt, setRefundedAt] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [editingTotalAt, setEditingTotalAt] = useState<number | null>(null)
  const [editingTotalValue, setEditingTotalValue] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/credit-notes/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/clients').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/companies').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/invoices').then((r) => (r.ok ? r.json() : [])).then((list: { id: string; number: string }[]) => list.map((i) => ({ id: i.id, number: i.number }))),
      fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
    ]).then(([cn, clientsList, companiesList, invoicesList, settings]) => {
      if (!cn) {
        setNotFound(true)
        setLoadingCn(false)
        return
      }
      setNumber(cn.number)
      setClients(clientsList)
      setCompanies(companiesList)
      setInvoices(invoicesList)
      setBankAccounts(Array.isArray(settings?.bankAccounts) ? settings.bankAccounts : [])
      const profiles = Array.isArray(settings?.emitterProfiles) ? settings.emitterProfiles : []
      setEmitterProfiles(profiles)
      setEmitterProfileId(cn.emitterProfileId ?? profiles[0]?.id ?? '')
      setClientId(cn.clientId ?? '')
      setCompanyId(cn.companyId ?? '')
      setRecipientType(cn.clientId ? 'client' : 'company')
      setInvoiceId(cn.invoiceId ?? '')
      setIssueDate(cn.issueDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
      setReason(cn.reason ?? '')
      setStatus(cn.status ?? 'draft')
      setRefundedAt(cn.refundedAt ? String(cn.refundedAt).slice(0, 10) : '')
      setPaymentMethod(cn.paymentMethod ?? '')
      setBankAccountId(cn.bankAccountId ?? '')
      if (Array.isArray(cn.lines) && cn.lines.length > 0) {
        setLines(cn.lines.map((l: { description?: string; quantity?: number; unitPrice?: number; vatRate?: number; discount?: number }) => ({
          description: l.description ?? '',
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
          vatRate: Number(l.vatRate) ?? 20,
          discount: Number(l.discount) ?? 0,
        })))
      }
      setLoadingCn(false)
    })
  }, [id])

  const addLine = () => setLines((l) => [...l, { description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: string, value: string | number) => {
    setLines((l) => l.map((line, idx) => (idx === i ? { ...line, [field]: value } : line)))
  }
  const lineTotalTTC = (line: LineState) => {
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
    : companyId ? (companies.find((c) => c.id === companyId)?.name ?? '') : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/credit-notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId || null,
          companyId: companyId || null,
          invoiceId: invoiceId || null,
          issueDate,
          reason: reason.trim() || null,
          status,
          refundedAt: status === 'refunded' ? (refundedAt || new Date().toISOString().slice(0, 10)) : null,
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
      if (res.ok) router.push(`/avoirs?updated=${id}`)
    } finally {
      setLoading(false)
    }
  }

  if (loadingCn) {
    return (
      <div className="max-w-5xl mx-auto">
        <Link href="/avoirs" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6"><ArrowLeft className="w-4 h-4" /> Retour aux avoirs</Link>
        <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
      </div>
    )
  }
  if (notFound) {
    return (
      <div className="max-w-5xl mx-auto">
        <Link href="/avoirs" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6"><ArrowLeft className="w-4 h-4" /> Retour aux avoirs</Link>
        <div className="p-8 text-center text-[var(--muted)]">Avoir introuvable.</div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/avoirs" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6"><ArrowLeft className="w-4 h-4" /> Retour aux avoirs</Link>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Modifier l&apos;avoir {number}</h1>
      <p className="text-[var(--muted)] text-sm mb-8">Modifiez les informations puis enregistrez.</p>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).getAttribute('type') !== 'submit') e.preventDefault()
        }}
        className="space-y-6"
      >
        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
          <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Destinataire et facture d&apos;origine</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Type de destinataire</label>
              <select value={recipientType} onChange={(e) => { setRecipientType(e.target.value as 'client' | 'company'); setClientId(''); setCompanyId('') }} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
                <option value="client">Client</option>
                <option value="company">Société</option>
              </select>
            </div>
            {recipientType === 'client' && (
              <div className="sm:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Client</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
                  <option value="">— Sélectionner —</option>
                  {clients.map((c) => (<option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}</option>))}
                </select>
              </div>
            )}
            {recipientType === 'company' && (
              <div className="sm:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Société</label>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
                  <option value="">— Sélectionner —</option>
                  {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-sm text-[var(--muted)] mb-1">Facture d&apos;origine (optionnel)</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
                <option value="">— Aucune —</option>
                {invoices.map((inv) => (<option key={inv.id} value={inv.id}>{inv.number}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Date d&apos;émission</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-[var(--muted)] mb-1">Motif (optionnel)</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. Remboursement" className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyé</option>
                <option value="refunded">Remboursé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            {status === 'refunded' && (
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Date du remboursement</label>
                <input type="date" value={refundedAt} onChange={(e) => setRefundedAt(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]" />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-sm text-[var(--muted)] mb-1">Mode de paiement</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
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
                  {bankAccounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.name || acc.iban || 'Compte'}</option>))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--background)]">
          <div className="flex justify-between items-center gap-2 mb-4">
            <h2 className="text-sm font-medium text-[var(--foreground)]">Lignes</h2>
            <button type="button" onClick={addLine} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">+ Ligne</button>
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
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50">{loading ? 'Enregistrement…' : 'Enregistrer'}</button>
          <Link href="/avoirs" className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium hover:bg-[var(--border)]/20">Annuler</Link>
        </div>
      </form>

      <div className="mt-8 border border-[var(--border)] rounded-xl p-6 bg-[var(--border)]/10">
        <h2 className="text-sm font-medium text-[var(--foreground)] mb-4">Aperçu en temps réel</h2>
        <InvoiceQuotePreview type="credit_note" recipientName={recipientName} issueDate={issueDate} paymentMethod={paymentMethod || undefined} lines={lines} />
      </div>
    </div>
  )
}
