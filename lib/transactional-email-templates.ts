/**
 * Templates HTML réutilisables pour les emails transactionnels (bienvenue, essai, paiement, annulation, hebdo).
 * Chaque template inclut : bloc logo, design simple, bouton d'action, lien dashboard, support email.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Myfacturation360'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? process.env.SMTP_FROM ?? 'support@myfacturation360.fr'

function baseLayout(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 32px 40px 24px 40px; text-align: center; border-bottom: 1px solid #eeeeee;">
              <span style="font-size: 24px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.02em;">${escapeHtml(APP_NAME)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px 40px; background-color: #fafafa; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #737373; text-align: center;">
                <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color: #404040; text-decoration: none;">${escapeHtml(SUPPORT_EMAIL)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
    <tr>
      <td align="center">
        <a href="${escapeHtml(url)}" style="display: inline-block; padding: 14px 28px; background-color: #1a1a1a; color: #ffffff !important; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">${escapeHtml(text)}</a>
      </td>
    </tr>
  </table>`
}

export interface WelcomeEmailData {
  recipientName?: string | null
  loginUrl: string
}

export function buildWelcomeEmailHtml(data: WelcomeEmailData): string {
  const name = data.recipientName?.trim() || 'Bonjour'
  const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">${escapeHtml(name)},</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Bienvenue sur ${escapeHtml(APP_NAME)}. Votre compte a été créé avec succès.</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Vous pouvez créer des devis et factures, gérer vos clients et suivre votre activité. N'oubliez pas : les formules Pro et Business offrent un essai gratuit de 7 jours.</p>
    ${ctaButton('Se connecter', data.loginUrl)}
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #737373;">À bientôt sur la plateforme.</p>
  `
  return baseLayout(content, `Bienvenue sur ${APP_NAME}`)
}

export interface TrialStartEmailData {
  recipientName?: string | null
  trialEndDate: string
  planLabel: string
  priceAfterTrial: string
  manageUrl: string
}

export function buildTrialStartEmailHtml(data: TrialStartEmailData): string {
  const name = data.recipientName?.trim() || 'Bonjour'
  const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">${escapeHtml(name)},</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Votre essai gratuit de la formule <strong>${escapeHtml(data.planLabel)}</strong> a bien commencé.</p>
    <p style="margin: 0 0 12px 0; font-size: 15px; color: #404040;">Date de fin d'essai : <strong>${escapeHtml(data.trialEndDate)}</strong>.</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Après cette date, vous serez facturé ${escapeHtml(data.priceAfterTrial)}.</p>
    ${ctaButton('Gérer mon abonnement', data.manageUrl)}
  `
  return baseLayout(content, 'Essai gratuit démarré')
}

export interface TrialEndingEmailData {
  recipientName?: string | null
  trialEndDate: string
  amountToCharge: string
  planLabel: string
  continueUrl: string
  cancelUrl: string
}

export function buildTrialEndingEmailHtml(data: TrialEndingEmailData): string {
  const name = data.recipientName?.trim() || 'Bonjour'
  const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">${escapeHtml(name)},</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Votre essai gratuit de la formule <strong>${escapeHtml(data.planLabel)}</strong> se termine bientôt (${escapeHtml(data.trialEndDate)}).</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Le montant de <strong>${escapeHtml(data.amountToCharge)}</strong> sera prélevé à cette date si vous ne résiliez pas.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(data.continueUrl)}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; margin-right: 8px;">Continuer</a>
          <a href="${escapeHtml(data.cancelUrl)}" style="display: inline-block; padding: 12px 24px; border: 2px solid #737373; color: #404040; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">Annuler</a>
        </td>
      </tr>
    </table>
  `
  return baseLayout(content, 'Fin de votre essai gratuit')
}

export interface PaymentSuccessEmailData {
  recipientName?: string | null
  amount: string
  billingDate: string
  planLabel: string
  dashboardUrl: string
  /** Pièce jointe : facture PDF (buffer). Si fourni, le mail inclut la facture en PJ. */
  invoicePdfBuffer?: Buffer
  /** Nom du fichier pour la PJ (ex. facture-ABO-2024-001.pdf) */
  invoicePdfFilename?: string
}

export function buildPaymentSuccessEmailHtml(data: PaymentSuccessEmailData): string {
  const name = data.recipientName?.trim() || 'Bonjour'
  const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">${escapeHtml(name)},</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Votre paiement a bien été enregistré.</p>
    ${data.invoicePdfBuffer && data.invoicePdfFilename ? `<p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Votre facture est jointe à cet email (PDF).</p>` : ''}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0; background-color: #fafafa; border-radius: 6px; border: 1px solid #eeeeee;">
      <tr>
        <td style="padding: 20px 24px;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #737373;">Montant payé</p>
          <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a1a;">${escapeHtml(data.amount)}</p>
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #737373;">Date de facturation</p>
          <p style="margin: 0 0 4px 0; font-size: 15px; color: #404040;">${escapeHtml(data.billingDate)}</p>
          <p style="margin: 12px 0 0 0; font-size: 13px; color: #737373;">Formule</p>
          <p style="margin: 0; font-size: 15px; color: #404040;">${escapeHtml(data.planLabel)}</p>
        </td>
      </tr>
    </table>
    ${ctaButton('Accéder au tableau de bord', data.dashboardUrl)}
  `
  return baseLayout(content, 'Paiement reçu')
}

export interface CancellationEmailData {
  recipientName?: string | null
  accessEndDate: string
  dashboardUrl: string
}

export function buildCancellationEmailHtml(data: CancellationEmailData): string {
  const name = data.recipientName?.trim() || 'Bonjour'
  const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">${escapeHtml(name)},</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Votre annulation d'abonnement a bien été prise en compte.</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Vous conservez l'accès à votre formule jusqu'au <strong>${escapeHtml(data.accessEndDate)}</strong>.</p>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Nous serons ravis de vous retrouver plus tard. N'hésitez pas à vous réabonner depuis votre tableau de bord.</p>
    ${ctaButton('Tableau de bord', data.dashboardUrl)}
  `
  return baseLayout(content, 'Annulation enregistrée')
}

export type WeeklyEmailPlan = 'starter' | 'pro' | 'business'

export interface WeeklyEmailData {
  recipientName?: string | null
  plan: WeeklyEmailPlan
  ctaUrl: string
  ctaLabel: string
  bodyHtml: string
}

export function buildWeeklyEmailHtml(data: WeeklyEmailData): string {
  const name = data.recipientName?.trim() || 'Bonjour'
  const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">${escapeHtml(name)},</p>
    ${data.bodyHtml}
    ${ctaButton(data.ctaLabel, data.ctaUrl)}
  `
  return baseLayout(content, `${APP_NAME} – Votre récap hebdo`)
}
