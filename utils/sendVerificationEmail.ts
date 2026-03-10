import { sendEmail } from '@/services/emailService/sendEmail'
import { loadEmailTemplate } from '@/utils/loadEmailTemplate'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myfacturation360.fr'

/**
 * Sends a verification email with a link containing the token.
 * Verification link format: https://myfacturation360.fr/verify-email?token=TOKEN
 *
 * @param userEmail - Recipient email
 * @param verificationToken - Token generated elsewhere (e.g. stored in DB for the user)
 * @returns Promise with { ok, messageId?, error? }
 *
 * @example
 * await sendVerificationEmail(user.email, token)
 */
export async function sendVerificationEmail(
  userEmail: string,
  verificationToken: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const verificationLink = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(verificationToken)}`
  const html = await loadEmailTemplate('verificationEmail.html', {
    verification_link: verificationLink,
  })
  return sendEmail({
    to: userEmail,
    subject: 'Vérifiez votre email – MyFacturation360',
    html,
  })
}
