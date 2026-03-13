/**
 * Post-traitement PDF/A-3B : File Identifier (trailer ID) et OutputIntent sRGB.
 * À appeler après embedFacturXInPdf pour renforcer la conformité PDF/A.
 */
import * as fs from 'fs'
import * as path from 'path'
import { randomBytes } from 'crypto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfLibModule = any

const ICC_DIR = path.join(process.cwd(), 'lib', 'icc')
const ICC_CANDIDATES = ['sRGB.icc', 'sRGB2014.icc']

function getSrgbIccBuffer(): Buffer | null {
  try {
    for (const name of ICC_CANDIDATES) {
      const p = path.join(ICC_DIR, name)
      if (fs.existsSync(p)) return fs.readFileSync(p)
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Ajoute les éléments PDF/A-3B manquants au PDF (File ID + OutputIntent sRGB si disponible).
 * Utilise le même pdf-lib que le reste de l'app (charge le buffer, modifie, sauvegarde).
 */
export async function addPdfAEnhancements(
  pdfLib: PdfLibModule,
  pdfBuffer: Buffer
): Promise<Buffer> {
  const { PDFDocument, PDFHexString, PDFName, PDFString } = pdfLib
  const doc = await PDFDocument.load(new Uint8Array(pdfBuffer), { updateMetadata: false })

  // 1. File Identifier (trailer) — requis PDF/A
  const documentId = randomBytes(16).toString('hex')
  const id = PDFHexString.of(documentId)
  const idArray = doc.context.obj([id, id])
  doc.context.trailerInfo.ID = idArray

  // 2. OutputIntent sRGB (profil ICC) — requis PDF/A-3B
  const iccBuffer = getSrgbIccBuffer()
  if (iccBuffer && iccBuffer.length > 0) {
    const iccStream = doc.context.stream(new Uint8Array(iccBuffer), {
      Length: iccBuffer.length,
      N: 3,
    })
    const outputIntent = doc.context.obj({
      Type: PDFName.of('OutputIntent'),
      S: PDFName.of('GTS_PDFA1'),
      OutputConditionIdentifier: PDFString.of('sRGB'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
      DestOutputProfile: doc.context.register(iccStream),
    })
    const outputIntentRef = doc.context.register(outputIntent)
    doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([outputIntentRef]))
  }

  const result = await doc.save()
  return Buffer.from(result)
}
