/**
 * Enregistre l'envoi d'un email en BDD pour le dashboard admin (EmailLog).
 * Appelé après envoi réussi depuis send-transactional-email.
 */
import { prisma } from '@/lib/prisma'

export async function logEmailSent(params: {
  emailType: string
  recipient: string
  subject: string
  bodyPreview?: string
  bodyFull?: string
  userId?: string
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        emailType: params.emailType,
        recipient: params.recipient,
        subject: params.subject,
        bodyPreview: params.bodyPreview ?? null,
        bodyFull: params.bodyFull ?? null,
        userId: params.userId ?? null,
      },
    })
  } catch {
    // Ne pas faire échouer l'envoi si le log échoue
  }
}
