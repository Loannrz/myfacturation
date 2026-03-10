/**
 * Token signé pour téléchargement PDF facture/devis (lien public).
 * Validité 90 jours.
 */
import * as crypto from 'crypto'

const ALG = 'sha256'
const EXPIRY_DAYS = 90

function getSecret(): string {
  return (
    process.env.BILLING_DOWNLOAD_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    'billing-download-fallback-dev'
  )
}

export function createBillingDownloadToken(type: 'invoice' | 'quote', id: string): string {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 24 * 3600
  const payload = `${type}:${id}:${exp}`
  const secret = getSecret()
  const sig = crypto.createHmac(ALG, secret).update(payload).digest('hex')
  const b64 = Buffer.from(payload, 'utf8').toString('base64url')
  return `${b64}.${sig}`
}

export function verifyBillingDownloadToken(token: string): { type: 'invoice' | 'quote'; id: string } | null {
  try {
    const [b64, sig] = token.split('.')
    if (!b64 || !sig) return null
    const payload = Buffer.from(b64, 'base64url').toString('utf8')
    const [type, id, expStr] = payload.split(':')
    if ((type !== 'invoice' && type !== 'quote') || !id) return null
    const exp = parseInt(expStr || '0', 10)
    if (Date.now() / 1000 > exp) return null
    const secret = getSecret()
    const expectedSig = crypto.createHmac(ALG, secret).update(payload).digest('hex')
    if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return { type: type as 'invoice' | 'quote', id }
    }
  } catch {
    // ignore
  }
  return null
}
