'use client'

type Line = { description: string; quantity: number; unitPrice: number; vatRate: number; discount: number }

function computeLineTotal(line: Line, tvaNonApplicable: boolean) {
  const q = Number(line.quantity) || 0
  const pu = Number(line.unitPrice) || 0
  const vat = tvaNonApplicable ? 0 : (Number(line.vatRate) ?? 0)
  const rem = Number(line.discount) ?? 0
  const ht = q * pu * (1 - rem / 100)
  return ht * (1 + vat / 100)
}

function computeTotals(lines: Line[], tvaNonApplicable: boolean) {
  let totalHT = 0
  let totalTVA = 0
  lines.forEach((line) => {
    const q = Number(line.quantity) || 0
    const pu = Number(line.unitPrice) || 0
    const vat = tvaNonApplicable ? 0 : (Number(line.vatRate) ?? 0)
    const rem = Number(line.discount) ?? 0
    const ht = q * pu * (1 - rem / 100)
    totalHT += ht
    totalTVA += tvaNonApplicable ? 0 : ht * (vat / 100)
  })
  return { totalHT, totalTVA, totalTTC: totalHT + totalTVA }
}

const MENTION_TVA_293B = 'TVA non applicable – article 293 B du CGI'

type Props = {
  type: 'invoice' | 'quote' | 'credit_note'
  recipientName: string
  issueDate: string
  dueDate?: string
  paymentMethod?: string
  lines: Line[]
  /** Si true, pas de calcul TVA, affichage "TVA : —" et mention légale */
  tvaNonApplicable?: boolean
}

export function InvoiceQuotePreview({ type, recipientName, issueDate, dueDate, paymentMethod, lines, tvaNonApplicable = false }: Props) {
  const { totalHT, totalTVA, totalTTC } = computeTotals(lines, tvaNonApplicable)
  const title = type === 'invoice' ? 'Aperçu facture' : type === 'quote' ? 'Aperçu devis' : 'Aperçu avoir'

  const formatDate = (d: string) => {
    if (!d) return '—'
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 w-full max-w-2xl">
      <h3 className="font-semibold text-[var(--foreground)] mb-4 text-base uppercase tracking-wide">{title}</h3>
      <div className="space-y-2 text-[var(--muted)] mb-5 text-sm">
        <p><span className="text-[var(--foreground)]">Destinataire :</span> {recipientName || '—'}</p>
        <p>Date : {formatDate(issueDate)}</p>
        {dueDate != null && dueDate !== '' && <p>Échéance : {formatDate(dueDate)}</p>}
        {paymentMethod && <p>Paiement : {paymentMethod}</p>}
      </div>
      <div className="border-t border-[var(--border)] pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="text-left py-2 font-medium">Description</th>
              <th className="text-right py-2 font-medium">Qté</th>
              <th className="text-right py-2 font-medium">P.U.</th>
              <th className="text-right py-2 font-medium">Remise %</th>
              {!tvaNonApplicable && <th className="text-right py-2 font-medium">TVA %</th>}
              <th className="text-right py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-[var(--border)]/50">
                <td className="py-2 pr-2 max-w-[280px] whitespace-pre-line align-top" title={line.description}>{line.description || '—'}</td>
                <td className="py-2 text-right">{line.quantity}</td>
                <td className="py-2 text-right">{(Number(line.unitPrice) || 0).toFixed(2)} €</td>
                <td className="py-2 text-right">{(Number(line.discount) || 0) > 0 ? `${line.discount} %` : '—'}</td>
                {!tvaNonApplicable && <td className="py-2 text-right">{line.vatRate} %</td>}
                <td className="py-2 text-right font-medium">{computeLineTotal(line, tvaNonApplicable).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-1 text-right text-sm">
          <p>Total HT : {totalHT.toFixed(2)} €</p>
          {tvaNonApplicable ? (
            <>
              <p>TVA : —</p>
              <p className="text-xs text-[var(--muted)] italic">{MENTION_TVA_293B}</p>
            </>
          ) : (
            <p>TVA : {totalTVA.toFixed(2)} €</p>
          )}
          <p className="font-semibold text-[var(--foreground)]">Total TTC : {totalTTC.toFixed(2)} €</p>
        </div>
      </div>
    </div>
  )
}
