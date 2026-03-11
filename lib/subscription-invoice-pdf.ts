/**
 * Génération de la facture de paiement d'abonnement (myfacturation360 By Myeventoo).
 * Utilisée en pièce jointe de l'email "Paiement reçu" après un paiement Stripe.
 */

import type { PdfLibModule } from '@/lib/billing-pdf'

const MARGIN = 56
const PAGE_W = 595
const PAGE_H = 842
const CONTENT_W = PAGE_W - MARGIN * 2

/** Informations légales MYEVENTOO / myfacturation360 */
const EMITTER = {
  companyName: 'myfacturation360 By Myeventoo',
  legalName: 'MYEVENTOO',
  legalForm: 'Association déclarée',
  address: 'MAISON 2158 CHEMIN DEPARTEMENTAL 145',
  postalCode: '34820',
  city: 'ASSAS',
  country: 'France',
  siren: '929 287 738',
  siret: '929 287 738 00017',
  apeCode: '82.30Z',
  vatNumber: 'FR00 929 287 738',
  ess: 'ESS - Économie Sociale et Solidaire',
}

function sanitize(text: string): string {
  return String(text)
    .replace(/\u202F/g, ' ')
    .replace(/\u00A0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u024F\u20AC]/g, ' ')
    .trim() || ' '
}

export interface SubscriptionInvoiceData {
  /** Numéro de facture (ex. Stripe invoice number ou FAC-ABO-2024-001) */
  invoiceNumber: string
  /** Date d'émission (YYYY-MM-DD ou Date) */
  issueDate: string | Date
  /** Nom du client (abonné) */
  customerName: string
  /** Email du client */
  customerEmail: string
  /** Désignation de la ligne (ex. "Abonnement Pro - Mars 2024") */
  description: string
  /** Montant TTC en centimes */
  amountCents: number
  /** Devise (ex. EUR) */
  currency: string
}

export async function generateSubscriptionInvoicePDF(
  data: SubscriptionInvoiceData,
  pdfLib: PdfLibModule
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = pdfLib
  const amountFormatted = (data.amountCents / 100).toFixed(2).replace('.', ',') + ' ' + (data.currency === 'eur' ? '€' : data.currency.toUpperCase())
  const issueDate = typeof data.issueDate === 'string'
    ? data.issueDate
    : data.issueDate.toISOString().slice(0, 10)
  const issueDateFR = issueDate.split('-').reverse().join('/')

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const primary = rgb(0.12, 0.12, 0.12)
  const secondary = rgb(0.45, 0.45, 0.45)
  const border = rgb(0.9, 0.9, 0.9)
  const paid = rgb(0.15, 0.55, 0.35)

  const page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  // Titre FACTURE
  page.drawText('FACTURE', { x: PAGE_W - MARGIN - 120, y, size: 22, font: fontBold, color: primary })
  y -= 24
  page.drawText(sanitize(data.invoiceNumber), { x: PAGE_W - MARGIN - 120, y, size: 12, font: fontBold, color: primary })
  y -= 14
  page.drawText(`Date d'émission : ${issueDateFR}`, { x: PAGE_W - MARGIN - 120, y, size: 9, font, color: secondary })
  y -= 14
  page.drawRectangle({
    x: PAGE_W - MARGIN - 120,
    y: y - 4,
    width: 60,
    height: 18,
    color: rgb(0.95, 0.98, 0.95),
    borderColor: paid,
    borderWidth: 1,
  })
  page.drawText('PAYÉE', { x: PAGE_W - MARGIN - 110, y, size: 9, font: fontBold, color: paid })
  y -= 28

  // Ligne horizontale
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: border })
  y -= 32

  // Bloc Émetteur (myfacturation360 By Myeventoo)
  page.drawText('Émetteur', { x: MARGIN, y, size: 8, font: fontBold, color: secondary })
  y -= 14
  page.drawText(sanitize(EMITTER.companyName), { x: MARGIN, y, size: 11, font: fontBold, color: primary })
  y -= 12
  page.drawText(sanitize(EMITTER.legalForm), { x: MARGIN, y, size: 9, font, color: secondary })
  y -= 11
  page.drawText(sanitize(EMITTER.address), { x: MARGIN, y, size: 9, font, color: secondary })
  y -= 11
  page.drawText(sanitize(`${EMITTER.postalCode} ${EMITTER.city}`), { x: MARGIN, y, size: 9, font, color: secondary })
  y -= 11
  page.drawText(`SIREN : ${EMITTER.siren}`, { x: MARGIN, y, size: 9, font, color: secondary })
  y -= 11
  page.drawText(`SIRET : ${EMITTER.siret}`, { x: MARGIN, y, size: 9, font, color: secondary })
  y -= 11
  page.drawText(`Code APE : ${EMITTER.apeCode}`, { x: MARGIN, y, size: 9, font, color: secondary })
  y -= 11
  page.drawText(sanitize(EMITTER.ess), { x: MARGIN, y, size: 9, font, color: secondary })
  y -= 24

  // Bloc Client
  const clientY = y
  page.drawText('Client', { x: MARGIN + CONTENT_W / 2 + 12, y: clientY, size: 8, font: fontBold, color: secondary })
  let yClient = clientY - 14
  if (data.customerName) {
    page.drawText(sanitize(data.customerName), { x: MARGIN + CONTENT_W / 2 + 12, y: yClient, size: 10, font: fontBold, color: primary })
    yClient -= 12
  }
  page.drawText(sanitize(data.customerEmail), { x: MARGIN + CONTENT_W / 2 + 12, y: yClient, size: 9, font, color: secondary })
  y = Math.min(y, yClient - 24)

  // Ligne horizontale
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: border })
  y -= 28

  // Tableau : Désignation / Montant
  const tableY = y
  page.drawText('Désignation', { x: MARGIN, y: tableY, size: 9, font: fontBold, color: primary })
  page.drawText('Montant TTC', { x: PAGE_W - MARGIN - 90, y: tableY, size: 9, font: fontBold, color: primary })
  y -= 14
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: border })
  y -= 18
  page.drawText(sanitize(data.description), { x: MARGIN, y, size: 10, font, color: primary })
  page.drawText(sanitize(amountFormatted), { x: PAGE_W - MARGIN - 90, y, size: 10, font: fontBold, color: primary })
  y -= 24
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: border })
  y -= 20
  page.drawText('Total TTC', { x: MARGIN, y, size: 10, font: fontBold, color: primary })
  page.drawText(sanitize(amountFormatted), { x: PAGE_W - MARGIN - 90, y, size: 10, font: fontBold, color: primary })
  y -= 40

  // Pied de page
  page.drawText('Paiement reçu par carte bancaire (Stripe).', { x: MARGIN, y, size: 8, font, color: secondary })
  y -= 14
  page.drawText('myfacturation360 By Myeventoo – ' + EMITTER.address + ', ' + EMITTER.postalCode + ' ' + EMITTER.city, {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: secondary,
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
