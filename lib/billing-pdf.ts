/**
 * Génération des PDF facture / devis – design premium type SaaS (pdf-lib).
 * Réutilisé depuis MyEventoo, logique inchangée.
 */
import { PDFDocument, StandardFonts, rgb, RGB } from 'pdf-lib'
import type { BillingSettings, Client, Company, Invoice, InvoiceLine, Quote, QuoteLine } from '@prisma/client'

type BillingSettingsWithBank = BillingSettings & {
  bankAccountHolder?: string | null
  bankName?: string | null
  bankIban?: string | null
  bankBic?: string | null
}

type DocType = 'invoice' | 'quote'

interface Recipient {
  name?: string
  email?: string
  address?: string
  postalCode?: string
  city?: string
  country?: string
  companyName?: string
  siret?: string
  vatNumber?: string
}

const MARGIN = 56
const PAGE_W = 595
const PAGE_H = 842
const CONTENT_W = PAGE_W - MARGIN * 2
const MIN_Y_CONTINUE = 120

const COLORS = {
  primary: rgb(0.12, 0.12, 0.12) as RGB,
  secondary: rgb(0.45, 0.45, 0.45) as RGB,
  light: rgb(0.65, 0.65, 0.65) as RGB,
  border: rgb(0.9, 0.9, 0.9) as RGB,
  tableHeaderBg: rgb(0.97, 0.97, 0.98) as RGB,
  footer: rgb(0.55, 0.55, 0.55) as RGB,
  accent: rgb(0.2, 0.45, 0.7) as RGB,
  paid: rgb(0.15, 0.55, 0.35) as RGB,
  pending: rgb(0.75, 0.5, 0.1) as RGB,
  late: rgb(0.7, 0.25, 0.2) as RGB,
}

function sanitize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u024F]/g, ' ')
    .trim() || ' '
}

function getRecipient(client: Client | null, company: Company | null): Recipient {
  if (company) {
    return {
      companyName: company.legalName || company.name,
      address: company.address ?? undefined,
      postalCode: company.postalCode ?? undefined,
      city: company.city ?? undefined,
      country: company.country ?? undefined,
      email: company.email ?? undefined,
      siret: company.siret ?? undefined,
      vatNumber: company.vatNumber ?? undefined,
    }
  }
  if (client) {
    const name = [client.firstName, client.lastName].filter(Boolean).join(' ')
    return {
      name: name || undefined,
      companyName: client.companyName ?? undefined,
      address: client.address ?? client.companyAddress ?? undefined,
      postalCode: client.postalCode ?? undefined,
      city: client.city ?? undefined,
      country: client.country ?? undefined,
      email: client.email ?? undefined,
      siret: client.siret ?? undefined,
      vatNumber: client.vatNumber ?? undefined,
    }
  }
  return {}
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(amount)
}

function formatDateFR(s: string | null | undefined): string {
  if (!s || typeof s !== 'string') return ''
  const parts = s.trim().split(/[-/]/)
  if (parts.length >= 3) {
    const [y, m, d] = parts
    return `${d!.padStart(2, '0')}/${m!.padStart(2, '0')}/${y}`
  }
  return s
}

function drawLine(
  page: ReturnType<PDFDocument['addPage']>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: RGB = COLORS.border,
  thickness = 0.5
) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })
}

type InvoiceWithQuote = Invoice & {
  lines: InvoiceLine[]
  client: Client | null
  company: Company | null
  quote?: { number: string } | null
}

export async function generateInvoicePDF(
  invoice: InvoiceWithQuote,
  settings: BillingSettings
): Promise<Buffer> {
  return generateDocumentPDF(
    'invoice',
    invoice,
    invoice.lines,
    settings,
    getRecipient(invoice.client, invoice.company),
    (invoice as Invoice).status,
    invoice.paidAt ?? undefined,
    invoice.quote?.number
  )
}

export async function generateQuotePDF(
  quote: Quote & { lines: QuoteLine[]; client: Client | null; company: Company | null },
  settings: BillingSettings
): Promise<Buffer> {
  return generateDocumentPDF('quote', quote, quote.lines, settings, getRecipient(quote.client, quote.company), undefined, undefined, undefined)
}

async function generateDocumentPDF(
  type: DocType,
  doc: Invoice | Quote,
  lines: InvoiceLine[] | QuoteLine[],
  settings: BillingSettings,
  recipient: Recipient,
  invoiceStatus?: string,
  paidAt?: Date,
  quoteNumber?: string
): Promise<Buffer> {
  const isInvoice = type === 'invoice'
  const title = isInvoice ? 'FACTURE' : 'DEVIS'
  const docNumber = doc.number
  const issueDate = doc.issueDate
  const dueDate = doc.dueDate ?? undefined
  const currency = doc.currency || 'EUR'
  const totalHT = doc.totalHT
  const vatAmount = doc.vatAmount
  const totalTTC = doc.totalTTC
  const tvaNonApplicable = doc.tvaNonApplicable
  const paymentTerms = doc.paymentTerms ?? undefined
  const paymentMethod = doc.paymentMethod ?? undefined

  const issueDateFR = formatDateFR(issueDate)
  const dueDateFR = dueDate ? formatDateFR(dueDate) : ''
  const paidAtFR = paidAt ? formatDateFR(paidAt.toISOString().slice(0, 10)) : ''

  const docPdf = await PDFDocument.create()
  const font = await docPdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await docPdf.embedFont(StandardFonts.HelveticaBold)

  const contentStartY = PAGE_H - MARGIN
  let page = docPdf.addPage([PAGE_W, PAGE_H])
  let y = contentStartY

  const companyName = sanitize(settings.companyName || 'Myfacturation')
  page.drawText(companyName, { x: MARGIN, y, size: 14, font: fontBold, color: COLORS.primary })
  let yLeft = y - 16
  const leftLines: string[] = []
  if (settings.address) leftLines.push(sanitize(settings.address))
  if (settings.phone) leftLines.push(sanitize(settings.phone))
  if (settings.email) leftLines.push(sanitize(settings.email ?? ''))
  if (settings.website) leftLines.push(sanitize(settings.website ?? ''))
  if (settings.siret) leftLines.push(`SIRET : ${settings.siret}`)
  if (settings.vatNumber) leftLines.push(`TVA : ${settings.vatNumber}`)
  for (const line of leftLines) {
    page.drawText(line, { x: MARGIN, y: yLeft, size: 9, font, color: COLORS.secondary })
    yLeft -= 13
  }

  const rightX = PAGE_W - MARGIN - 180
  page.drawText(title, { x: rightX, y, size: 24, font: fontBold, color: COLORS.primary })
  let yRight = y - 22
  page.drawText(docNumber, { x: rightX, y: yRight, size: 12, font: fontBold, color: COLORS.primary })
  yRight -= 16
  if (issueDateFR) page.drawText(`Date d'émission : ${issueDateFR}`, { x: rightX, y: yRight, size: 9, font, color: COLORS.secondary })
  yRight -= 13
  if (dueDateFR) {
    page.drawText(`Échéance : ${dueDateFR}`, { x: rightX, y: yRight, size: 9, font, color: COLORS.secondary })
    yRight -= 13
  }
  if (isInvoice && invoiceStatus) {
    const statusLabels: Record<string, string> = { paid: 'PAYÉE', pending: 'EN ATTENTE', late: 'EN RETARD', sent: 'ENVOYÉE', draft: 'BROUILLON', cancelled: 'ANNULÉE' }
    const statusLabel = statusLabels[invoiceStatus] || String(invoiceStatus).toUpperCase()
    const statusColor = invoiceStatus === 'paid' ? COLORS.paid : invoiceStatus === 'late' ? COLORS.late : COLORS.pending
    const statusW = fontBold.widthOfTextAtSize(statusLabel, 9)
    page.drawRectangle({
      x: rightX,
      y: yRight - 4,
      width: statusW + 12,
      height: 18,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: statusColor,
      borderWidth: 1,
    })
    page.drawText(statusLabel, { x: rightX + 6, y: yRight, size: 9, font: fontBold, color: statusColor })
    yRight -= 24
    if (invoiceStatus === 'paid' && paidAtFR) {
      page.drawText(`Date de paiement : ${paidAtFR}`, { x: rightX, y: yRight, size: 9, font, color: COLORS.secondary })
      yRight -= 13
    }
  }
  if (isInvoice && quoteNumber) {
    page.drawText(`Devis de référence : ${sanitize(quoteNumber)}`, { x: rightX, y: yRight, size: 9, font, color: COLORS.secondary })
    yRight -= 13
  }

  y = Math.min(yLeft - 10, yRight - 10)
  drawLine(page, MARGIN, y, PAGE_W - MARGIN, y)
  y -= 28

  const blockW = (CONTENT_W - 24) / 2
  const leftBlockX = MARGIN
  const rightBlockX = MARGIN + blockW + 24

  page.drawText('Émetteur', { x: leftBlockX, y, size: 8, font: fontBold, color: COLORS.light })
  let yE = y - 14
  page.drawText(companyName, { x: leftBlockX, y: yE, size: 10, font: fontBold, color: COLORS.primary })
  yE -= 12
  if (settings.legalStatus) {
    page.drawText(sanitize(settings.legalStatus), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (settings.address) {
    page.drawText(sanitize(settings.address), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (settings.siret) {
    page.drawText(`SIRET : ${settings.siret}`, { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (settings.vatNumber) {
    page.drawText(`TVA : ${settings.vatNumber}`, { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (settings.email) {
    page.drawText(sanitize(settings.email), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (settings.phone) {
    page.drawText(sanitize(settings.phone), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }

  page.drawText('Destinataire', { x: rightBlockX, y, size: 8, font: fontBold, color: COLORS.light })
  let yD = y - 14
  const destLines: { text: string; bold?: boolean }[] = [
    { text: recipient.companyName ? sanitize(recipient.companyName) : '—', bold: true },
    { text: recipient.name ? sanitize(recipient.name) : '—' },
    { text: recipient.address ? sanitize(recipient.address) : '—' },
    { text: [recipient.postalCode, recipient.city].filter(Boolean).join(' ') || '—' },
    { text: recipient.country ? sanitize(recipient.country) : '—' },
    { text: recipient.siret ? `SIRET : ${recipient.siret}` : '—' },
    { text: recipient.email ? sanitize(recipient.email) : '—' },
  ]
  for (const line of destLines) {
    page.drawText(line.text, {
      x: rightBlockX,
      y: yD,
      size: line.bold ? 10 : 9,
      font: line.bold ? fontBold : font,
      color: COLORS.primary,
    })
    yD -= line.bold ? 12 : 11
  }

  y = Math.min(yE, yD) - 24
  drawLine(page, MARGIN, y, PAGE_W - MARGIN, y)
  y -= 20

  const colW = { desc: CONTENT_W - 220, qty: 28, unit: 48, discount: 38, vat: 32, total: 74 }
  const rowH = 20
  const tableLeft = MARGIN
  const tableRight = PAGE_W - MARGIN
  const colXs = [
    tableLeft,
    tableLeft + colW.desc,
    tableLeft + colW.desc + colW.qty,
    tableLeft + colW.desc + colW.qty + colW.unit,
    tableLeft + colW.desc + colW.qty + colW.unit + colW.discount,
    tableLeft + colW.desc + colW.qty + colW.unit + colW.discount + colW.vat,
    tableRight,
  ]

  function drawTableHeader(p: ReturnType<PDFDocument['addPage']>, headerY: number) {
    p.drawRectangle({
      x: MARGIN,
      y: headerY - rowH + 4,
      width: CONTENT_W,
      height: rowH,
      color: COLORS.tableHeaderBg,
    })
    drawLine(p, MARGIN, headerY, PAGE_W - MARGIN, headerY)
    drawLine(p, MARGIN, headerY - rowH, PAGE_W - MARGIN, headerY - rowH)
    const headers = [
      { label: 'Description', x: MARGIN + 6 },
      { label: 'Qté', x: MARGIN + colW.desc + 4 },
      { label: 'P.U. HT', x: MARGIN + colW.desc + colW.qty },
      { label: 'Remise', x: MARGIN + colW.desc + colW.qty + colW.unit },
      { label: 'TVA %', x: MARGIN + colW.desc + colW.qty + colW.unit + colW.discount },
      { label: 'Total', x: MARGIN + colW.desc + colW.qty + colW.unit + colW.discount + colW.vat },
    ]
    const headerTextY = headerY - 14
    for (const h of headers) {
      p.drawText(h.label, { x: h.x, y: headerTextY, size: 8, font: fontBold, color: COLORS.secondary })
    }
  }

  const headerY = y
  drawTableHeader(page, headerY)
  y -= rowH

  let yRow = y
  for (const line of lines) {
    if (yRow - rowH < MIN_Y_CONTINUE) {
      page = docPdf.addPage([PAGE_W, PAGE_H])
      yRow = PAGE_H - MARGIN - 40
      drawTableHeader(page, yRow + rowH)
      yRow -= rowH
    }
    drawLine(page, tableLeft, yRow, tableRight, yRow)
    const desc = sanitize((line as InvoiceLine).description || (line as QuoteLine).description || '').slice(0, 50)
    const qty = (line as InvoiceLine).quantity ?? (line as QuoteLine).quantity
    const unit = (line as InvoiceLine).unitPrice ?? (line as QuoteLine).unitPrice
    const vatRate = (line as InvoiceLine).vatRate ?? (line as QuoteLine).vatRate
    const discount = (line as InvoiceLine).discount ?? (line as QuoteLine).discount ?? 0
    const total = (line as InvoiceLine).total ?? (line as QuoteLine).total
    const hasVat = typeof vatRate === 'number' && vatRate > 0
    const hasDiscount = typeof discount === 'number' && discount > 0
    const textY = yRow - 13
    page.drawText(desc, { x: MARGIN + 6, y: textY, size: 9, font, color: COLORS.primary })
    page.drawText(String(qty), { x: MARGIN + colW.desc + 4, y: textY, size: 9, font, color: COLORS.secondary })
    page.drawText(formatCurrency(unit, currency), { x: MARGIN + colW.desc + colW.qty, y: textY, size: 9, font, color: COLORS.secondary })
    page.drawText(hasDiscount ? `${discount} %` : '—', { x: MARGIN + colW.desc + colW.qty + colW.unit, y: textY, size: 9, font, color: COLORS.secondary })
    page.drawText(hasVat ? `${vatRate} %` : '—', { x: MARGIN + colW.desc + colW.qty + colW.unit + colW.discount, y: textY, size: 9, font, color: COLORS.secondary })
    const totalStr = formatCurrency(total, currency)
    page.drawText(totalStr, { x: tableRight - 6 - font.widthOfTextAtSize(totalStr, 9), y: textY, size: 9, font, color: COLORS.primary })
    for (const cx of colXs) drawLine(page, cx, yRow, cx, yRow - rowH)
    yRow -= rowH
  }
  drawLine(page, tableLeft, yRow, tableRight, yRow)
  for (const cx of colXs) drawLine(page, cx, y, cx, yRow)
  y = yRow - 22

  const totalsBoxW = 160
  const totalsBoxX = PAGE_W - MARGIN - totalsBoxW
  const totalHTStr = formatCurrency(totalHT, currency)
  const vatStr = formatCurrency(vatAmount, currency)
  const totalTTCStr = formatCurrency(totalTTC, currency)
  let yTot = y
  page.drawText('Total HT', { x: totalsBoxX, y: yTot, size: 9, font, color: COLORS.secondary })
  page.drawText(totalHTStr, { x: totalsBoxX + totalsBoxW - font.widthOfTextAtSize(totalHTStr, 9), y: yTot, size: 9, font, color: COLORS.primary })
  yTot -= 18
  if (!tvaNonApplicable) {
    page.drawText('TVA', { x: totalsBoxX, y: yTot, size: 9, font, color: COLORS.secondary })
    page.drawText(vatStr, { x: totalsBoxX + totalsBoxW - font.widthOfTextAtSize(vatStr, 9), y: yTot, size: 9, font, color: COLORS.primary })
    yTot -= 18
  }
  const ttcValW = fontBold.widthOfTextAtSize(totalTTCStr, 12)
  page.drawRectangle({
    x: totalsBoxX - 4,
    y: yTot - 6,
    width: totalsBoxW + 8,
    height: 22,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: COLORS.border,
    borderWidth: 0.5,
  })
  page.drawText('Total TTC', { x: totalsBoxX, y: yTot, size: 12, font: fontBold, color: COLORS.primary })
  page.drawText(totalTTCStr, { x: totalsBoxX + totalsBoxW - ttcValW, y: yTot, size: 12, font: fontBold, color: COLORS.primary })
  y = yTot - 28

  drawLine(page, MARGIN, y, PAGE_W - MARGIN, y)
  y -= 20

  const colMid = MARGIN + CONTENT_W / 2
  const sectionStartY = y

  page.drawText('Conditions de règlement', { x: MARGIN, y, size: 10, font: fontBold, color: COLORS.primary })
  let yLeftCol = y - 16
  page.drawText(`Mode de paiement : ${paymentMethod ? sanitize(paymentMethod) : '—'}`, { x: MARGIN, y: yLeftCol, size: 9, font, color: COLORS.secondary })
  yLeftCol -= 13
  page.drawText(`Date d'échéance : ${dueDateFR || '—'}`, { x: MARGIN, y: yLeftCol, size: 9, font, color: COLORS.secondary })
  yLeftCol -= 13
  if (paymentTerms) {
    page.drawText(sanitize(paymentTerms), { x: MARGIN, y: yLeftCol, size: 9, font, color: COLORS.secondary })
    yLeftCol -= 13
  }
  if (tvaNonApplicable) {
    page.drawText('TVA non applicable, art. 293 B du CGI', { x: MARGIN, y: yLeftCol, size: 8, font, color: COLORS.light })
    yLeftCol -= 14
  }

  const s = settings as BillingSettingsWithBank
  if (isInvoice && (s.bankIban || s.bankBic || s.bankName || s.bankAccountHolder)) {
    page.drawText('Coordonnées bancaires', { x: colMid + 12, y: sectionStartY, size: 10, font: fontBold, color: COLORS.primary })
    let yRightCol = sectionStartY - 16
    if (s.bankAccountHolder) {
      page.drawText(`Titulaire : ${sanitize(s.bankAccountHolder)}`, { x: colMid + 12, y: yRightCol, size: 9, font, color: COLORS.secondary })
      yRightCol -= 12
    }
    if (s.bankName) {
      page.drawText(`Banque : ${sanitize(s.bankName)}`, { x: colMid + 12, y: yRightCol, size: 9, font, color: COLORS.secondary })
      yRightCol -= 12
    }
    if (s.bankIban) {
      page.drawText(`IBAN : ${sanitize(s.bankIban)}`, { x: colMid + 12, y: yRightCol, size: 9, font, color: COLORS.secondary })
      yRightCol -= 12
    }
    if (s.bankBic) {
      page.drawText(`BIC : ${sanitize(s.bankBic)}`, { x: colMid + 12, y: yRightCol, size: 9, font, color: COLORS.secondary })
      yRightCol -= 12
    }
    y = Math.min(yLeftCol, yRightCol) - 12
  } else {
    y = yLeftCol - 8
  }

  const footerY = 56
  drawLine(page, MARGIN, footerY + 2, PAGE_W - MARGIN, footerY + 2)
  const footerParts: string[] = []
  if (settings.companyName) footerParts.push(sanitize(settings.companyName))
  if (settings.siret) footerParts.push(`SIRET ${settings.siret}`)
  if (settings.address) footerParts.push(sanitize(settings.address ?? ''))
  if (settings.email) footerParts.push(sanitize(settings.email ?? ''))
  if (settings.phone) footerParts.push(sanitize(settings.phone ?? ''))
  if (settings.website) footerParts.push(sanitize(settings.website ?? ''))
  const footerText = footerParts.join('  ·  ')
  const fw = font.widthOfTextAtSize(footerText, 7)
  page.drawText(footerText, { x: (PAGE_W - fw) / 2, y: footerY - 10, size: 7, font, color: COLORS.footer })

  let legalY = footerY - 24
  if (tvaNonApplicable) {
    page.drawText('TVA non applicable, article 293 B du CGI', { x: MARGIN, y: legalY, size: 6, font, color: COLORS.footer })
    legalY -= 10
  }
  page.drawText('Pénalités de retard exigibles en cas de non-paiement à la date d\'échéance. Taux appliqué : taux légal en vigueur.', { x: MARGIN, y: legalY, size: 6, font, color: COLORS.footer })
  legalY -= 10
  page.drawText('Indemnité forfaitaire pour frais de recouvrement : 40 € (article L. 441-10 du Code de commerce).', { x: MARGIN, y: legalY, size: 6, font, color: COLORS.footer })

  const pdfBytes = await docPdf.save()
  return Buffer.from(pdfBytes)
}
