/**
 * Ajoute l'image de signature du client et le nom du signataire en bas de la dernière page du PDF devis.
 * Utilise pdf-lib (chargé dynamiquement).
 */
import { createRequire } from 'module'

const requireMod = createRequire(import.meta.url)

const MARGIN = 56
const SIGNATURE_MAX_WIDTH = 340
const SIGNATURE_HEIGHT = 115
const SIGNER_NAME_BASELINE_Y = 62
const SIGNATURE_Y = 78
const SIGNER_NAME_FONT_SIZE = 10

function sanitizeForPdf(text: string): string {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim()
    .slice(0, 120) || ' '
}

interface PdfPage {
  drawImage(image: unknown, opts: { x: number; y: number; width: number; height: number }): void
  drawText(text: string, opts: { x: number; y: number; size: number; font: unknown; color: unknown }): void
}
interface PdfDoc {
  getPages(): Array<PdfPage>
  embedPng(pngBytes: Uint8Array): Promise<{ scale(n: number): { width: number; height: number } }>
  embedFont(font: unknown): Promise<unknown>
  save(): Promise<Uint8Array>
}

export async function addSignatureToQuotePdf(
  pdfBuffer: Buffer,
  signaturePngBuffer: Buffer,
  signerName?: string | null
): Promise<Buffer> {
  const pdfLib = requireMod('pdf-lib') as {
    PDFDocument: { load(bytes: Uint8Array): Promise<PdfDoc> }
    StandardFonts: { Helvetica: unknown }
    rgb: (r: number, g: number, b: number) => unknown
  }
  const doc = await pdfLib.PDFDocument.load(new Uint8Array(pdfBuffer))
  const pages = doc.getPages()
  if (pages.length === 0) return pdfBuffer
  const lastPage = pages[pages.length - 1]

  const pngImage = await doc.embedPng(new Uint8Array(signaturePngBuffer))
  const pngDims = pngImage.scale(1)
  let width = pngDims.width
  let height = pngDims.height
  if (width > SIGNATURE_MAX_WIDTH) {
    const ratio = SIGNATURE_MAX_WIDTH / width
    width = SIGNATURE_MAX_WIDTH
    height = height * ratio
  }
  if (height > SIGNATURE_HEIGHT) {
    const ratio = SIGNATURE_HEIGHT / height
    height = SIGNATURE_HEIGHT
    width = width * ratio
  }
  const x = MARGIN

  lastPage.drawImage(pngImage, { x, y: SIGNATURE_Y, width, height })

  const nameToDraw = signerName ? sanitizeForPdf(signerName) : null
  if (nameToDraw) {
    const font = await doc.embedFont(pdfLib.StandardFonts.Helvetica)
    const color = pdfLib.rgb(0.15, 0.15, 0.15)
    lastPage.drawText(nameToDraw, {
      x: MARGIN,
      y: SIGNER_NAME_BASELINE_Y,
      size: SIGNER_NAME_FONT_SIZE,
      font,
      color,
    })
  }

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
