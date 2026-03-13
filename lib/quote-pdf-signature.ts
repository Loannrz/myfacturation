/**
 * Ajoute l'image de signature du client en bas de la dernière page du PDF devis.
 * Utilise pdf-lib (chargé dynamiquement).
 */
import { createRequire } from 'module'

const requireMod = createRequire(import.meta.url)

const MARGIN = 56
const SIGNATURE_MAX_WIDTH = 180
const SIGNATURE_HEIGHT = 50
const SIGNATURE_Y = 70

interface PdfDoc {
  getPages(): Array<{ drawImage(image: unknown, opts: { x: number; y: number; width: number; height: number }): void }>
  embedPng(pngBytes: Uint8Array): Promise<{ scale(n: number): { width: number; height: number } }>
  save(): Promise<Uint8Array>
}

export async function addSignatureToQuotePdf(
  pdfBuffer: Buffer,
  signaturePngBuffer: Buffer
): Promise<Buffer> {
  const pdfLib = requireMod('pdf-lib') as { PDFDocument: { load(bytes: Uint8Array): Promise<PdfDoc> } }
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
  const y = SIGNATURE_Y

  lastPage.drawImage(pngImage, { x, y, width, height })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
