import nodemailer from 'nodemailer'

export type EmailStatus = 'sent' | 'failed' | 'skipped_config_missing'

export interface SendMailResult {
  ok: boolean
  status: EmailStatus
  error?: string
  messageId?: string
}

export interface MailAttachment {
  filename: string
  content: Buffer
  mimeType?: string
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim()
  if (!host || !user || !pass || !from) return null
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendMail(options: {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  from?: string
  action?: string
  attachments?: MailAttachment[]
}): Promise<SendMailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    return {
      ok: false,
      status: 'skipped_config_missing',
      error: 'SMTP non configuré : définissez SMTP_HOST, SMTP_USER, SMTP_PASS ou SMTP_PASSWORD (SMTP_FROM optionnel, défaut = SMTP_USER)',
    }
  }
  const toList = Array.isArray(options.to) ? options.to : [options.to]
  const fromAddr = options.from || process.env.SMTP_FROM?.trim() || process.env.SMTP_USER!
  try {
    const info = await transporter.sendMail({
      from: fromAddr,
      to: toList.join(', '),
      cc: options.cc,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.mimeType,
      })),
    })
    return { ok: true, status: 'sent', messageId: info.messageId }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    return { ok: false, status: 'failed', error: err }
  }
}
