/**
 * Génération des PDF facture / devis – design premium type SaaS (pdf-lib).
 * Réutilisé depuis MyEventoo, logique inchangée.
 * pdf-lib est chargé dynamiquement par les routes API pour éviter les erreurs de build Next.js.
 */
import type { BillingSettings, Client, Company, CreditNote, CreditNoteLine, Invoice, InvoiceLine, Quote, QuoteLine } from '@prisma/client'
import { parseBankAccounts, parseEmitterProfiles } from '@/lib/billing-settings'

/** Module pdf-lib passé par l’appelant (import dynamique dans la route API). */
type PdfPage = {
  drawText: (text: string, opts: { x: number; y: number; size: number; font: unknown; color: unknown }) => void
  drawLine: (opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color: unknown }) => void
  drawRectangle: (opts: { x: number; y: number; width: number; height: number; color?: unknown; borderColor?: unknown; borderWidth?: number }) => void
}

type PdfFont = { widthOfTextAtSize: (text: string, size: number) => number }

export type PdfLibModule = {
  PDFDocument: {
    create(): Promise<{
      addPage: (size: [number, number]) => PdfPage
      embedFont: (font: unknown) => Promise<PdfFont>
      save(): Promise<Uint8Array>
      registerFontkit?: (fontkit: unknown) => void
      context?: { obj: (o: unknown) => unknown; stream: (buf: Uint8Array, opts?: { Length?: number; N?: number }) => unknown; register: (o: unknown) => unknown }
      catalog?: { set: (name: unknown, ref: unknown) => void }
    }>
  }
  StandardFonts: { Helvetica: unknown; HelveticaBold: unknown }
  rgb: (r: number, g: number, b: number) => unknown
  PDFName?: { of: (name: string) => unknown }
  PDFString?: { of: (s: string) => unknown }
}

/** Ressources optionnelles pour PDF/A-3B : polices embarquées + profil ICC sRGB. */
export interface PdfBillingResources {
  fontkit: unknown
  fontRegular: Buffer | null
  fontBold: Buffer | null
  iccBuffer: Buffer | null
}

type BillingSettingsWithBank = BillingSettings & {
  bankAccountHolder?: string | null
  bankName?: string | null
  bankIban?: string | null
  bankBic?: string | null
  bankAccounts?: string | null
  legalPenaltiesText?: string | null
  legalRecoveryFeeText?: string | null
}

const DEFAULT_LEGAL_PENALTIES = "Pénalités de retard exigibles en cas de non-paiement à la date d'échéance. Taux appliqué : taux légal en vigueur."
const DEFAULT_LEGAL_RECOVERY = 'Indemnité forfaitaire pour frais de recouvrement : 40 € (article L. 441-10 du Code de commerce).'

type ResolvedBank = { accountHolder: string; bankName: string; iban: string; bic: string } | null

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
  vatExempt?: boolean // true = non assujetti à la TVA (mention légale sur documents)
}

const MARGIN = 56
const PAGE_W = 595
const PAGE_H = 842
const CONTENT_W = PAGE_W - MARGIN * 2
const MIN_Y_CONTINUE = 120

function buildColors(rgb: PdfLibModule['rgb']) {
  return {
    primary: rgb(0.12, 0.12, 0.12),
    secondary: rgb(0.45, 0.45, 0.45),
    light: rgb(0.65, 0.65, 0.65),
    border: rgb(0.9, 0.9, 0.9),
    tableHeaderBg: rgb(0.97, 0.97, 0.98),
    footer: rgb(0.55, 0.55, 0.55),
    accent: rgb(0.2, 0.45, 0.7),
    paid: rgb(0.15, 0.55, 0.35),
    pending: rgb(0.75, 0.5, 0.1),
    late: rgb(0.7, 0.25, 0.2),
  }
}

/** Remet tout texte dans un form acceptable pour WinAnsi (pdf-lib). */
function sanitize(text: string): string {
  return String(text)
    .replace(/\u202F/g, ' ')   // espace fine insécable (U+202F) → espace
    .replace(/\u00A0/g, ' ')   // espace insécable (U+00A0) → espace
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u024F\u20AC]/g, ' ')  // € (U+20AC) conservé pour les montants
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
      vatExempt: company.vatExempt ?? false,
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
  const formatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(amount)
  return sanitize(formatted)
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

type InvoiceWithQuote = Invoice & {
  lines: InvoiceLine[]
  client: Client | null
  company: Company | null
  quote?: { number: string; issueDate?: string } | null
}

export async function generateInvoicePDF(
  invoice: InvoiceWithQuote,
  settings: BillingSettings,
  pdfLib: PdfLibModule,
  resources?: PdfBillingResources | null
): Promise<Buffer> {
  return generateDocumentPDF(
    'invoice',
    invoice,
    invoice.lines,
    settings,
    getRecipient(invoice.client, invoice.company),
    pdfLib,
    (invoice as Invoice).status,
    invoice.paidAt ?? undefined,
    invoice.quote?.number,
    invoice.quote?.issueDate,
    undefined,
    undefined,
    resources
  )
}

export async function generateQuotePDF(
  quote: Quote & { lines: QuoteLine[]; client: Client | null; company: Company | null },
  settings: BillingSettings,
  pdfLib: PdfLibModule,
  resources?: PdfBillingResources | null
): Promise<Buffer> {
  return generateDocumentPDF(
    'quote',
    quote,
    quote.lines,
    settings,
    getRecipient(quote.client, quote.company),
    pdfLib,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    resources
  )
}

async function generateDocumentPDF(
  type: DocType,
  doc: Invoice | Quote,
  lines: InvoiceLine[] | QuoteLine[],
  settings: BillingSettings,
  recipient: Recipient,
  pdfLib: PdfLibModule,
  invoiceStatus?: string,
  paidAt?: Date,
  quoteNumber?: string,
  quoteIssueDate?: string,
  titleOverride?: string,
  invoiceReference?: string,
  resources?: PdfBillingResources | null
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = pdfLib
  const COLORS = buildColors(rgb)

  const drawLine = (
    page: { drawLine: (opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color: unknown }) => void },
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: unknown = COLORS.border,
    thickness = 0.5
  ) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })
  }

  const isInvoice = type === 'invoice'
  const title = titleOverride ?? (isInvoice ? 'FACTURE' : 'DEVIS')
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
  const bankAccountId = (doc as { bankAccountId?: string | null }).bankAccountId ?? undefined
  const emitterProfileId = (doc as { emitterProfileId?: string | null }).emitterProfileId ?? undefined

  const s = settings as BillingSettingsWithBank & { emitterProfiles?: string | unknown[]; vatApplicable?: boolean; vatExemptionReason?: string | null }
  const vatApplicable = s.vatApplicable !== false
  const vatExemptionReasonText = (s.vatExemptionReason && String(s.vatExemptionReason).trim()) || 'TVA non applicable – article 293 B du CGI'
  const bankAccountsList = parseBankAccounts(typeof s.bankAccounts === 'string' ? s.bankAccounts : null)
  const profilesList = Array.isArray(s.emitterProfiles) ? s.emitterProfiles : parseEmitterProfiles(typeof s.emitterProfiles === 'string' ? s.emitterProfiles : null)
  const emitterProfile = emitterProfileId && profilesList.length > 0 ? profilesList.find((p: unknown) => (p as { id: string }).id === emitterProfileId) : null
  const emitterRaw = emitterProfile
    ? {
        companyName: (emitterProfile as { companyName?: string }).companyName ?? '',
        legalStatus: (emitterProfile as { legalStatus?: string }).legalStatus ?? '',
        address: (emitterProfile as { address?: string }).address ?? '',
        postalCode: (emitterProfile as { postalCode?: string }).postalCode ?? '',
        city: (emitterProfile as { city?: string }).city ?? '',
        country: (emitterProfile as { country?: string }).country ?? '',
        siret: (emitterProfile as { siret?: string }).siret ?? '',
        vatNumber: (emitterProfile as { vatNumber?: string }).vatNumber ?? '',
        apeCode: (emitterProfile as { apeCode?: string }).apeCode ?? '',
        email: (emitterProfile as { email?: string }).email ?? '',
        phone: (emitterProfile as { phone?: string }).phone ?? '',
        website: (emitterProfile as { website?: string }).website ?? '',
      }
    : {
        companyName: settings.companyName ?? '',
        legalStatus: settings.legalStatus ?? '',
        address: settings.address ?? '',
        postalCode: settings.postalCode ?? '',
        city: settings.city ?? '',
        country: (settings as { country?: string }).country ?? '',
        siret: settings.siret ?? '',
        vatNumber: settings.vatNumber ?? '',
        apeCode: (settings as { apeCode?: string }).apeCode ?? '',
        email: settings.email ?? '',
        phone: settings.phone ?? '',
        website: settings.website ?? '',
      }
  const emitter = { ...emitterRaw, vatNumber: (vatApplicable && !tvaNonApplicable) ? emitterRaw.vatNumber : '' }
  const selectedBank: ResolvedBank = bankAccountId && bankAccountsList.length > 0
    ? (() => {
        const found = bankAccountsList.find((a) => a.id === bankAccountId)
        return found ? { accountHolder: found.accountHolder, bankName: found.bankName, iban: found.iban, bic: found.bic } : null
      })()
    : (s.bankAccountHolder || s.bankIban || s.bankName || s.bankBic)
      ? { accountHolder: s.bankAccountHolder ?? '', bankName: s.bankName ?? '', iban: s.bankIban ?? '', bic: s.bankBic ?? '' }
      : null
  const showBankSection = selectedBank && (isInvoice || paymentMethod === 'Virement bancaire' || paymentMethod === 'Virement SEPA')

  const issueDateFR = formatDateFR(issueDate)
  const dueDateFR = dueDate ? formatDateFR(dueDate) : ''
  const paidAtFR = paidAt ? formatDateFR(paidAt.toISOString().slice(0, 10)) : ''

  const docPdf = await PDFDocument.create()
  const usePdfA = resources?.fontkit && resources?.fontRegular && resources?.fontBold

  let font: PdfFont
  let fontBold: PdfFont
  if (usePdfA) {
    docPdf.registerFontkit?.(resources!.fontkit)
    font = await docPdf.embedFont(new Uint8Array(resources!.fontRegular!))
    fontBold = await docPdf.embedFont(new Uint8Array(resources!.fontBold!))
  } else {
    font = await docPdf.embedFont(StandardFonts.Helvetica)
    fontBold = await docPdf.embedFont(StandardFonts.HelveticaBold)
  }
  // OutputIntent sRGB (PDF/A-3B) — appliqué à toutes les factures/avoirs dès que le profil ICC est disponible
  if (resources?.iccBuffer && resources.iccBuffer.length > 0 && docPdf.context && docPdf.catalog && pdfLib.PDFName && pdfLib.PDFString) {
    const PDFName = pdfLib.PDFName
    const PDFString = pdfLib.PDFString
    const iccStream = docPdf.context.stream(new Uint8Array(resources.iccBuffer), { Length: resources.iccBuffer.length, N: 3 })
    const outputIntent = docPdf.context.obj({
      Type: PDFName.of('OutputIntent'),
      S: PDFName.of('GTS_PDFA1'),
      OutputConditionIdentifier: PDFString.of('sRGB'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
      DestOutputProfile: docPdf.context.register(iccStream),
    })
    const outputIntentRef = docPdf.context.register(outputIntent)
    docPdf.catalog.set(PDFName.of('OutputIntents'), docPdf.context.obj([outputIntentRef]))
  }

  const contentStartY = PAGE_H - MARGIN
  let page = docPdf.addPage([PAGE_W, PAGE_H])
  let y = contentStartY

  const companyName = sanitize(emitter.companyName || '')
  if (companyName) page.drawText(companyName, { x: MARGIN, y, size: 14, font: fontBold, color: COLORS.primary })
  let yLeft = y - 16
  const leftLines: string[] = []
  if (emitter.address) leftLines.push(sanitize(emitter.address))
  const pcCity = [emitter.postalCode, emitter.city].filter(Boolean).join(' ').trim()
  if (pcCity) leftLines.push(sanitize(pcCity))
  if (emitter.country) leftLines.push(sanitize(emitter.country))
  if (emitter.phone) leftLines.push(sanitize(emitter.phone))
  if (emitter.email) leftLines.push(sanitize(emitter.email ?? ''))
  if (emitter.website) leftLines.push(sanitize(emitter.website ?? ''))
  if (emitter.siret) leftLines.push(`SIRET : ${emitter.siret}`)
  if (emitter.apeCode) leftLines.push(`APE : ${emitter.apeCode}`)
  if (emitter.vatNumber) leftLines.push(`TVA : ${emitter.vatNumber}`)
  for (const line of leftLines) {
    page.drawText(line, { x: MARGIN, y: yLeft, size: 9, font, color: COLORS.secondary })
    yLeft -= 13
  }

  const rightX = PAGE_W - MARGIN - 180
  page.drawText(title, { x: rightX, y, size: 24, font: fontBold, color: COLORS.primary })
  let yRight = y - 22
  page.drawText(sanitize(docNumber), { x: rightX, y: yRight, size: 12, font: fontBold, color: COLORS.primary })
  yRight -= 16
  if (issueDateFR) page.drawText(`Date d'émission : ${issueDateFR}`, { x: rightX, y: yRight, size: 9, font, color: COLORS.secondary })
  yRight -= 13
  if (dueDateFR) {
    page.drawText(`Échéance : ${dueDateFR}`, { x: rightX, y: yRight, size: 9, font, color: COLORS.secondary })
    yRight -= 13
  }
  if (isInvoice && invoiceStatus && invoiceStatus !== 'draft') {
    const statusLabels: Record<string, string> = { paid: 'PAYÉE', pending: 'EN ATTENTE', late: 'EN RETARD', sent: 'ENVOYÉE', cancelled: 'ANNULÉE' }
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
  y = Math.min(yLeft - 10, yRight - 10)
  drawLine(page, MARGIN, y, PAGE_W - MARGIN, y)
  y -= 28

  const blockW = (CONTENT_W - 24) / 2
  const leftBlockX = MARGIN
  const rightBlockX = MARGIN + blockW + 24

  page.drawText('Émetteur', { x: leftBlockX, y, size: 8, font: fontBold, color: COLORS.light })
  let yE = y - 14
  if (companyName) {
    page.drawText(companyName, { x: leftBlockX, y: yE, size: 10, font: fontBold, color: COLORS.primary })
    yE -= 12
  }
  if (emitter.legalStatus) {
    page.drawText(sanitize(emitter.legalStatus), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (emitter.address) {
    page.drawText(sanitize(emitter.address), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (emitter.postalCode || emitter.city) {
    page.drawText(sanitize([emitter.postalCode, emitter.city].filter(Boolean).join(' ')), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (emitter.country) {
    page.drawText(sanitize(emitter.country), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (emitter.siret) {
    page.drawText(`SIRET : ${emitter.siret}`, { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (emitter.apeCode) {
    page.drawText(`APE : ${emitter.apeCode}`, { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (emitter.vatNumber) {
    page.drawText(`TVA : ${emitter.vatNumber}`, { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (emitter.email) {
    page.drawText(sanitize(emitter.email), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
    yE -= 11
  }
  if (emitter.phone) {
    page.drawText(sanitize(emitter.phone), { x: leftBlockX, y: yE, size: 9, font, color: COLORS.secondary })
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
    ...(recipient.vatExempt
      ? [
          { text: 'Non assujetti à la TVA', bold: false },
          { text: 'TVA non applicable, article 293 B du CGI', bold: false },
        ]
      : recipient.vatNumber
        ? [{ text: `TVA : ${recipient.vatNumber}`, bold: false }]
        : []),
    { text: recipient.email ? sanitize(recipient.email) : '—' },
  ]
  for (const line of destLines) {
    page.drawText(sanitize(line.text), {
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

  if (isInvoice && quoteNumber) {
    const quoteRef = `Réf. devis : ${sanitize(quoteNumber)}${quoteIssueDate ? ` du ${formatDateFR(quoteIssueDate)}` : ''}`
    page.drawText(quoteRef, { x: MARGIN, y, size: 9, font, color: COLORS.secondary })
    y -= 16
  }
  if (invoiceReference) {
    page.drawText(sanitize(invoiceReference), { x: MARGIN, y, size: 9, font, color: COLORS.secondary })
    y -= 16
  }
  const docNote = (doc as { note?: string | null }).note
  if (isInvoice && docNote && String(docNote).trim()) {
    page.drawText(sanitize(String(docNote).trim().slice(0, 200)), { x: MARGIN, y, size: 9, font, color: COLORS.secondary })
    y -= 16
  }

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

  function drawTableHeader(p: PdfPage, headerY: number) {
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
    page.drawText(sanitize(vatExemptionReasonText), { x: MARGIN, y: yLeftCol, size: 8, font, color: COLORS.light })
    yLeftCol -= 14
  }

  if (showBankSection && selectedBank) {
    page.drawText('Coordonnées bancaires', { x: colMid + 12, y: sectionStartY, size: 10, font: fontBold, color: COLORS.primary })
    let yRightCol = sectionStartY - 16
    const accountHolderLabel = selectedBank.accountHolder?.trim() || 'myfacturation360 by myeventoo'
    if (accountHolderLabel) {
      page.drawText(`Titulaire : ${sanitize(accountHolderLabel)}`, { x: colMid + 12, y: yRightCol, size: 9, font, color: COLORS.secondary })
      yRightCol -= 12
    }
    if (selectedBank.bankName) {
      page.drawText(`Banque : ${sanitize(selectedBank.bankName)}`, { x: colMid + 12, y: yRightCol, size: 9, font, color: COLORS.secondary })
      yRightCol -= 12
    }
    if (selectedBank.iban) {
      page.drawText(`IBAN : ${sanitize(selectedBank.iban)}`, { x: colMid + 12, y: yRightCol, size: 9, font, color: COLORS.secondary })
      yRightCol -= 12
    }
    if (selectedBank.bic) {
      page.drawText(`BIC : ${sanitize(selectedBank.bic)}`, { x: colMid + 12, y: yRightCol, size: 9, font, color: COLORS.secondary })
      yRightCol -= 12
    }
    y = Math.min(yLeftCol, yRightCol) - 12
  } else {
    y = yLeftCol - 8
  }

  const footerY = 56
  drawLine(page, MARGIN, footerY + 2, PAGE_W - MARGIN, footerY + 2)
  const footerParts: string[] = []
  if (emitter.companyName) footerParts.push(sanitize(emitter.companyName))
  if (emitter.siret) footerParts.push(`SIRET ${emitter.siret}`)
  if (emitter.address) footerParts.push(sanitize(emitter.address ?? ''))
  const footerPcCity = [emitter.postalCode, emitter.city].filter(Boolean).join(' ').trim()
  if (footerPcCity) footerParts.push(sanitize(footerPcCity))
  if (emitter.email) footerParts.push(sanitize(emitter.email ?? ''))
  if (emitter.phone) footerParts.push(sanitize(emitter.phone ?? ''))
  if (emitter.website) footerParts.push(sanitize(emitter.website ?? ''))
  const footerText = sanitize(footerParts.join('  ·  '))
  const fw = font.widthOfTextAtSize(footerText, 7)
  page.drawText(footerText, { x: (PAGE_W - fw) / 2, y: footerY - 10, size: 7, font, color: COLORS.footer })

  const legalPenalties = (s as BillingSettingsWithBank).legalPenaltiesText?.trim() || DEFAULT_LEGAL_PENALTIES
  const legalRecovery = (s as BillingSettingsWithBank).legalRecoveryFeeText?.trim() || DEFAULT_LEGAL_RECOVERY
  let legalY = footerY - 24
  if (tvaNonApplicable) {
    page.drawText('TVA non applicable, article 293 B du CGI', { x: MARGIN, y: legalY, size: 6, font, color: COLORS.footer })
    legalY -= 10
  }
  page.drawText(sanitize(legalPenalties), { x: MARGIN, y: legalY, size: 6, font, color: COLORS.footer })
  legalY -= 10
  page.drawText(sanitize(legalRecovery), { x: MARGIN, y: legalY, size: 6, font, color: COLORS.footer })

  const pdfBytes = await docPdf.save()
  return Buffer.from(pdfBytes)
}

export type CreditNoteWithRelations = CreditNote & {
  client: Client | null
  company: Company | null
  invoice: { number: string } | null
  lines: CreditNoteLine[]
}

export async function generateCreditNotePDF(
  creditNote: CreditNoteWithRelations,
  settings: BillingSettings,
  pdfLib: PdfLibModule,
  resources?: PdfBillingResources | null
): Promise<Buffer> {
  const doc = {
    number: creditNote.number,
    issueDate: creditNote.issueDate,
    dueDate: (creditNote as { dueDate?: string | null }).dueDate ?? null,
    currency: creditNote.currency,
    totalHT: creditNote.totalHT,
    vatAmount: creditNote.vatAmount,
    totalTTC: creditNote.totalTTC,
    tvaNonApplicable: creditNote.tvaNonApplicable,
    paymentTerms: (creditNote as { paymentTerms?: string | null }).paymentTerms ?? null,
    paymentMethod: creditNote.paymentMethod ?? null,
    bankAccountId: creditNote.bankAccountId ?? null,
    emitterProfileId: creditNote.emitterProfileId ?? null,
  } as Invoice
  const lines = creditNote.lines as unknown as InvoiceLine[]
  const recipient = getRecipient(creditNote.client, creditNote.company)
  const invoiceRef = creditNote.invoice ? `Facture d'origine : ${creditNote.invoice.number}` : undefined
  return generateDocumentPDF(
    'invoice',
    doc,
    lines,
    settings,
    recipient,
    pdfLib,
    undefined,
    undefined,
    undefined,
    undefined,
    'AVOIR',
    invoiceRef,
    resources
  )
}
