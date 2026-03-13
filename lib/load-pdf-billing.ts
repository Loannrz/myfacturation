/**
 * Charge pdf-lib, fontkit, polices DejaVu (embarquées) et profil ICC sRGB
 * pour génération PDF/A-3B (factures / avoirs / devis).
 */
import { createRequire } from 'module'
import * as fs from 'fs'
import * as path from 'path'
import type { PdfBillingResources, PdfLibModule } from '@/lib/billing-pdf'

const requireMod = createRequire(import.meta.url)

const ICC_DIR = path.join(process.cwd(), 'lib', 'icc')
const ICC_CANDIDATES = ['sRGB.icc', 'sRGB2014.icc']

function readFileSafe(filePath: string): Buffer | null {
  try {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath)
  } catch {
    // ignore
  }
  return null
}

function getSrgbIccBuffer(): Buffer | null {
  for (const name of ICC_CANDIDATES) {
    const buf = readFileSafe(path.join(ICC_DIR, name))
    if (buf && buf.length > 0) return buf
  }
  return null
}

export interface LoadPdfBillingResult {
  pdfLib: PdfLibModule
  resources: PdfBillingResources
}

/**
 * Charge les ressources nécessaires pour générer des PDF facture/avoir/devis
 * conformes PDF/A-3B (polices embarquées + profil sRGB).
 * Si polices ou ICC manquants, resources contient des null (génération en StandardFonts sans OutputIntent).
 */
export function loadPdfBillingResources(): LoadPdfBillingResult {
  const pdfLib = requireMod('pdf-lib') as PdfLibModule
  let fontkit: unknown = null
  let fontRegular: Buffer | null = null
  let fontBold: Buffer | null = null
  try {
    fontkit = requireMod('@pdf-lib/fontkit')
    const dejavuBase = path.join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf')
    fontRegular = readFileSafe(path.join(dejavuBase, 'DejaVuSans.ttf'))
    fontBold = readFileSafe(path.join(dejavuBase, 'DejaVuSans-Bold.ttf'))
  } catch {
    // fontkit ou polices non disponibles
  }
  const iccBuffer = getSrgbIccBuffer()
  return {
    pdfLib,
    resources: { fontkit, fontRegular, fontBold, iccBuffer },
  }
}
