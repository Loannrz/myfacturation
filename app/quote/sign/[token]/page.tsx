'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type QuoteLine = { description: string; quantity: number; unitPrice: number; vatRate: number; discount: number; total: number }
type QuoteData = {
  id: string
  number: string
  status: string
  issueDate: string
  dueDate: string | null
  currency: string
  totalHT: number
  vatAmount: number
  totalTTC: number
  client: { firstName: string; lastName: string; companyName: string | null; email: string } | null
  company: { name: string; legalName: string | null; email: string | null } | null
  lines: QuoteLine[]
}

export default function QuoteSignPage() {
  const params = useParams()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [signerName, setSignerName] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Lien invalide')
      setLoading(false)
      return
    }
    fetch(`/api/quote/sign/${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 410) return r.json().then((d) => { throw new Error(d.error || 'Déjà signé') })
          if (r.status === 404) throw new Error('Devis introuvable')
          throw new Error('Erreur de chargement')
        }
        return r.json()
      })
      .then(setQuote)
      .catch((e) => setError(e.message || 'Devis introuvable'))
      .finally(() => setLoading(false))
  }, [token])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [])

  useEffect(() => {
    if (!quote || quote.status === 'signed') return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [quote])

  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return t ? { x: t.clientX - rect.left, y: t.clientY - rect.top } : null
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const pos = getCoords(e)
    if (pos) {
      drawingRef.current = true
      lastPosRef.current = pos
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
      }
    }
  }, [getCoords])

  const moveDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!drawingRef.current) return
    const pos = getCoords(e)
    if (!pos) return
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
    lastPosRef.current = pos
  }, [getCoords])

  const endDraw = useCallback(() => {
    drawingRef.current = false
    lastPosRef.current = null
  }, [])

  const submitSignature = useCallback(() => {
    if (!token || !quote || quote.status === 'signed') return
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const blank = document.createElement('canvas')
    blank.width = canvas.width
    blank.height = canvas.height
    const blankCtx = blank.getContext('2d')
    if (blankCtx) {
      blankCtx.fillStyle = '#ffffff'
      blankCtx.fillRect(0, 0, blank.width, blank.height)
    }
    if (dataUrl === blank.toDataURL('image/png')) {
      alert('Veuillez signer dans la zone ci-dessous avant de valider.')
      return
    }
    const name = signerName.trim()
    if (!name) {
      alert('Veuillez indiquer votre nom, prénom ou raison sociale.')
      return
    }
    setSigning(true)
    fetch(`/api/quote/sign/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureDataUrl: dataUrl, signerName: name }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Erreur') })
        return r.json()
      })
      .then(() => setSigned(true))
      .catch((e) => alert(e.message || 'Erreur lors de l\'enregistrement de la signature'))
      .finally(() => setSigning(false))
  }, [token, quote, signerName])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <p className="text-[var(--muted)]">Chargement du devis…</p>
      </div>
    )
  }
  if (error || !quote) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">{error || 'Devis introuvable'}</p>
          <p className="text-sm text-[var(--muted)] mt-2">Ce lien est invalide ou ce devis a déjà été signé.</p>
        </div>
      </div>
    )
  }
  if (signed) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg">Devis signé avec succès</p>
          <p className="text-[var(--muted)] mt-2">L&apos;émetteur a été notifié et recevra le devis signé par email.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Consulter et signer le devis</h1>

        <section className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
          <p className="text-sm text-[var(--muted)] px-4 py-2 border-b border-[var(--border)]">Devis n° {quote.number}</p>
          <iframe
            title="PDF du devis"
            src={`/api/quote/sign/${encodeURIComponent(token)}/pdf`}
            className="w-full min-h-[70vh] border-0"
            style={{ minHeight: '600px' }}
          />
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6">
          <h2 className="text-sm font-medium text-[var(--foreground)] mb-3">Signature</h2>
          <div className="mb-4">
            <label htmlFor="signer-name" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Nom, prénom ou raison sociale <span className="text-red-500">*</span>
            </label>
            <input
              id="signer-name"
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Ex. Jean Dupont ou SARL Ma Société"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
              maxLength={200}
            />
          </div>
          <p className="text-sm text-[var(--muted)] mb-4">Signez dans la zone ci-dessous (doigt, stylet ou souris).</p>
          <div
            className="border-2 border-dashed border-[var(--border)] rounded-lg bg-white overflow-hidden touch-none"
            style={{ minHeight: 120 }}
          >
            <canvas
              ref={canvasRef}
              className="block w-full h-[120px] cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={moveDraw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={moveDraw}
              onTouchEnd={endDraw}
              style={{ touchAction: 'none' }}
            />
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              type="button"
              onClick={clearCanvas}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)]/20"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={submitSignature}
              disabled={signing}
              className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50"
            >
              {signing ? 'Enregistrement…' : 'Signer le devis'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
