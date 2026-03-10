import { sendEmail } from '@/services/emailService/sendEmail'
import { loadEmailTemplate } from '@/utils/loadEmailTemplate'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myfacturation360.fr'

/**
 * Sends a password reset email with a link containing the token.
 * Reset link format: https://myfacturation360.fr/reset-password?token=TOKEN
 *
 * @param userEmail - Recipient email
 * @param resetToken - Token generated elsewhere (e.g. stored in DB with expiry)
 * @returns Promise with { ok, messageId?, error? }
 *
 * @example
 * await sendResetPasswordEmail(user.email, resetToken)
 */
export async function sendResetPasswordEmail(
  userEmail: string,
  resetToken: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`
  const html = await loadEmailTemplate('resetPasswordEmail.html', {
    reset_link: resetLink,
  })
  return sendEmail({
    to: userEmail,
    subject: 'Réinitialisation du mot de passe – MyFacturation360',
    html,
  })
}
