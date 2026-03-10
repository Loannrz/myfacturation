import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

const host = process.env.SMTP_HOST ?? 'smtp.hostinger.com'
const port = parseInt(process.env.SMTP_PORT ?? '465', 10)
const secure = process.env.SMTP_SECURE !== 'false' && port === 465
const user = process.env.SMTP_USER ?? 'noreply@myfacturation360.fr'
const pass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? ''

function createTransporter(): Transporter {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })
}

let transporterInstance: Transporter | null = null

/**
 * Returns a reusable nodemailer transporter.
 * Uses Hostinger SMTP by default when env vars are set.
 */
export function getSmtpTransporter(): Transporter {
  if (!transporterInstance) {
    transporterInstance = createTransporter()
  }
  return transporterInstance
}

/**
 * Check if SMTP is configured (user + password present).
 * Uses SMTP_PASSWORD or SMTP_PASS.
 */
export function isSmtpConfigured(): boolean {
  const pass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS
  return Boolean(process.env.SMTP_USER && pass)
}
