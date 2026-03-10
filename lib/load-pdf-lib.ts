/**
 * Charge pdf-lib au runtime. Le package est externalisé dans next.config.js (webpack)
 * pour que Node le charge depuis node_modules au lieu du bundle.
 */
import { createRequire } from 'module'

const requireMod = createRequire(import.meta.url)

export function loadPdfLib(): Promise<import('@/lib/billing-pdf').PdfLibModule> {
  return Promise.resolve(requireMod('pdf-lib'))
}
