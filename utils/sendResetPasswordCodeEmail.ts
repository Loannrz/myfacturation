import { sendEmail } from '@/services/emailService/sendEmail'
import { loadEmailTemplate } from '@/utils/loadEmailTemplate'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myfacturation360.fr'
const fromAddress = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@myfacturation360.fr'

/**
 * Envoie un email de réinitialisation mot de passe avec le code à 6 chiffres (template dédié).
 * From: noreply (SMTP_USER / SMTP_FROM).
 */
export async function sendResetPasswordCodeEmail(
  userEmail: string,
  code: string,
  expiryMinutes: number = 15
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const resetLink = `${baseUrl.replace(/\/$/, '')}/forgot-password?email=${encodeURIComponent(userEmail)}&step=2`
  const html = await loadEmailTemplate('resetPasswordCodeEmail.html', {
    reset_code: code,
    reset_link: resetLink,
    expiry_minutes: String(expiryMinutes),
  })
  return sendEmail({
    to: userEmail,
    subject: 'Réinitialisation du mot de passe – MyFacturation360',
    html,
    from: fromAddress,
  })
}
