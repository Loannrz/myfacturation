/**
 * Signature électronique PAdES du PDF après génération Factur-X.
 * Appliquée en dernière étape pour ne pas casser la conformité XML / PDF/A.
 */
import { createRequire } from 'module'
import * as fs from 'fs'
import * as path from 'path'

const requireMod = createRequire(import.meta.url)

const SIGNATURE_REASON = 'Facture électronique'
const SIGNATURE_LOCATION = 'MyFacturation360'
const SIGNATURE_CONTACT = 'support@myfacturation360.com'
const SIGNER_NAME = 'MyFacturation360'

function getP12Buffer(): { buffer: Buffer; passphrase: string } | null {
  const base64 = process.env.PDF_SIGNING_P12_BASE64
  if (base64 && base64.trim()) {
    try {
      const buffer = Buffer.from(base64.trim(), 'base64')
      if (buffer.length > 0) {
        return { buffer, passphrase: process.env.PDF_SIGNING_P12_PASSWORD || '' }
      }
    } catch {
      // ignore
    }
  }
  const filePath = process.env.PDF_SIGNING_P12_PATH || path.join(process.cwd(), 'lib', 'signing', 'myfacturation360.p12')
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath)
      if (buffer.length > 0) {
        return { buffer, passphrase: process.env.PDF_SIGNING_P12_PASSWORD || '' }
      }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Signe le PDF avec un certificat X.509 (P12) si configuré.
 * Signature invisible (champ signature PDF, pas de rendu visuel).
 * Si aucun certificat n'est configuré (PDF_SIGNING_P12_PATH ou PDF_SIGNING_P12_BASE64), retourne le buffer inchangé.
 */
export async function signPdfIfConfigured(pdfBuffer: Buffer): Promise<Buffer> {
  const p12 = getP12Buffer()
  if (!p12) return pdfBuffer

  try {
    const SignPdf = requireMod('node-signpdf').default
    const { plainAddPlaceholder } = requireMod('node-signpdf/dist/helpers')
    const { DEFAULT_SIGNATURE_LENGTH, SUBFILTER_ETSI_CADES_DETACHED } = requireMod('node-signpdf/dist/helpers/const')

    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer,
      reason: SIGNATURE_REASON,
      location: SIGNATURE_LOCATION,
      contactInfo: SIGNATURE_CONTACT,
      name: SIGNER_NAME,
      signatureLength: DEFAULT_SIGNATURE_LENGTH,
      subFilter: SUBFILTER_ETSI_CADES_DETACHED,
    })

    const signer = new SignPdf()
    const signed = signer.sign(pdfWithPlaceholder, p12.buffer, { passphrase: p12.passphrase })
    return Buffer.from(signed)
  } catch (err) {
    console.error('[pdf-sign] signPdfIfConfigured failed:', err)
    return pdfBuffer
  }
}
