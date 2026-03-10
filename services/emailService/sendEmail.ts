import { getSmtpTransporter, isSmtpConfigured } from '@/config/smtp/smtpClient'

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

export interface SendEmailResult {
  ok: boolean
  messageId?: string
  error?: string
}

const defaultFrom = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@myfacturation360.fr'

/**
 * Sends an email using the configured SMTP transporter.
 * Logs success or error. Returns a promise with result.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, from = defaultFrom, replyTo } = params

  if (!isSmtpConfigured()) {
    const error = 'SMTP non configuré (SMTP_USER, SMTP_PASSWORD)'
    console.error('[sendEmail]', error)
    return { ok: false, error }
  }

  const toList = Array.isArray(to) ? to : [to]
  const toAddresses = toList.join(', ')

  try {
    const transporter = getSmtpTransporter()
    const info = await transporter.sendMail({
      from: from.trim(),
      to: toAddresses,
      replyTo: replyTo?.trim(),
      subject,
      html,
    })

    console.info('[sendEmail] Sent successfully', { to: toAddresses, subject, messageId: info.messageId })
    return { ok: true, messageId: info.messageId }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[sendEmail] Failed', { to: toAddresses, subject, error })
    return { ok: false, error }
  }
}
