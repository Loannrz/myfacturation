'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NouveauDevisPage() {
  const router = useRouter()
  const [clients, setClients] = useState<{ id: string; firstName: string; lastName: string; companyName: string | null }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState([{ description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const [clientId, setClientId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  useEffect(() => {
    fetch('/api/clients').then((r) => { if (r.ok) return r.json().then(setClients) })
    fetch('/api/companies').then((r) => { if (r.ok) return r.json().then(setCompanies) })
  }, [])

  const addLine = () => setLines((l) => [...l, { description: '', quantity: 1, unitPrice: 0, vatRate: 20, discount: 0 }])
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: string, value: string | number) => {
    setLines((l) => l.map((line, idx) => (idx === i ? { ...line, [field]: value } : line)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        const quote = await res.json()
        router.push(`/devis?created=${quote.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/devis" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour aux devis
      </Link>
      <h1 className="text-2xl font-semibold text-black mb-6">Nouveau devis</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <h2 className="text-sm font-medium text-black mb-4">Destinataire</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Client</label>
              <select
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setCompanyId('') }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-black"
              >
                <option value="">— Sélectionner —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Société</label>
              <select
                value={companyId}
                onChange={(e) => { setCompanyId(e.target.value); setClientId('') }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-black"
              >
                <option value="">— Sélectionner —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <h2 className="text-sm font-medium text-black mb-4">Dates et paiement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date d'émission</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date d'échéance</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Mode de paiement</label>
              <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Virement, chèque…" />
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-black">Lignes</h2>
            <button type="button" onClick={addLine} className="text-sm text-gray-600 hover:text-black">+ Ligne</button>
          </div>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.unitPrice || ''}
                    onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                    placeholder="P.U."
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={line.vatRate}
                    onChange={(e) => updateLine(i, 'vatRate', e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={line.discount}
                    onChange={(e) => updateLine(i, 'discount', e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-600 text-sm">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50">
            {loading ? 'Création…' : 'Créer le devis'}
          </button>
          <Link href="/devis" className="px-4 py-2 rounded-lg border border-gray-300 text-black font-medium hover:bg-gray-50">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
