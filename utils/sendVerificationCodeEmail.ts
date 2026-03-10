import { sendEmail } from '@/services/emailService/sendEmail'
import { loadEmailTemplate } from '@/utils/loadEmailTemplate'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myfacturation360.fr'

/**
 * Envoie un email de vérification avec le code à 6 chiffres (template dédié).
 * Lien vers la page de vérification : .../verify-email?email=...
 *
 * @param userEmail - Email du destinataire
 * @param code - Code à 6 chiffres
 * @param expiryMinutes - Durée de validité en minutes (pour l’affichage dans l’email)
 */
export async function sendVerificationCodeEmail(
  userEmail: string,
  code: string,
  expiryMinutes: number = 15
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const verificationLink = `${baseUrl.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(userEmail)}`
  const html = await loadEmailTemplate('verificationCodeEmail.html', {
    verification_code: code,
    verification_link: verificationLink,
    expiry_minutes: String(expiryMinutes),
  })
  return sendEmail({
    to: userEmail,
    subject: 'Votre code de vérification – MyFacturation360',
    html,
  })
}
