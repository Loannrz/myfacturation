/**
 * Envoi des emails transactionnels (bienvenue, essai, paiement, annulation, hebdo).
 * Utilise lib/smtp (sendMail). Les templates sont dans lib/transactional-email-templates.
 */

import { sendMail } from '@/lib/smtp'
import { logEmailSent } from '@/lib/email-log'
import {
  buildWelcomeEmailHtml,
  buildTrialStartEmailHtml,
  buildTrialEndingEmailHtml,
  buildPaymentSuccessEmailHtml,
  buildCancellationEmailHtml,
  buildWeeklyEmailHtml,
  type WelcomeEmailData,
  type TrialStartEmailData,
  type TrialEndingEmailData,
  type PaymentSuccessEmailData,
  type CancellationEmailData,
  type WeeklyEmailData,
  type WeeklyEmailPlan,
} from '@/lib/transactional-email-templates'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
const base = BASE_URL.replace(/\/$/, '')

export type SendResult = { ok: boolean; error?: string }

export async function sendWelcomeEmail(to: string, data: WelcomeEmailData): Promise<SendResult> {
  const loginUrl = data.loginUrl.startsWith('http') ? data.loginUrl : `${base}/login`
  const html = buildWelcomeEmailHtml({ ...data, loginUrl })
  const subject = `Bienvenue sur ${process.env.NEXT_PUBLIC_APP_NAME ?? 'Myfacturation360'}`
  const res = await sendMail({ to, subject, html, action: 'transactional-welcome' })
  if (res.ok) logEmailSent({ emailType: 'welcome', recipient: to, subject, bodyPreview: html.slice(0, 200), bodyFull: html }).catch(() => {})
  return { ok: res.ok, error: res.error }
}

export async function sendTrialStartEmail(to: string, data: TrialStartEmailData): Promise<SendResult> {
  const manageUrl = data.manageUrl.startsWith('http') ? data.manageUrl : `${base}/settings/billing`
  const html = buildTrialStartEmailHtml({ ...data, manageUrl })
  const subject = 'Votre essai gratuit a commencé'
  const res = await sendMail({ to, subject, html, action: 'transactional-trial-start' })
  if (res.ok) logEmailSent({ emailType: 'trial_start', recipient: to, subject, bodyPreview: html.slice(0, 200), bodyFull: html }).catch(() => {})
  return { ok: res.ok, error: res.error }
}

export async function sendTrialEndingEmail(to: string, data: TrialEndingEmailData): Promise<SendResult> {
  const continueUrl = data.continueUrl.startsWith('http') ? data.continueUrl : `${base}/formules`
  const cancelUrl = data.cancelUrl.startsWith('http') ? data.cancelUrl : `${base}/parametres`
  const html = buildTrialEndingEmailHtml({ ...data, continueUrl, cancelUrl })
  const subject = 'Votre essai gratuit se termine bientôt'
  const res = await sendMail({ to, subject, html, action: 'transactional-trial-ending' })
  if (res.ok) logEmailSent({ emailType: 'trial_ending', recipient: to, subject, bodyPreview: html.slice(0, 200), bodyFull: html }).catch(() => {})
  return { ok: res.ok, error: res.error }
}

export async function sendPaymentSuccessEmail(to: string, data: PaymentSuccessEmailData): Promise<SendResult> {
  const dashboardUrl = data.dashboardUrl.startsWith('http') ? data.dashboardUrl : `${base}/dashboard`
  const html = buildPaymentSuccessEmailHtml({ ...data, dashboardUrl })
  const attachments =
    data.invoicePdfBuffer && data.invoicePdfFilename
      ? [{ filename: data.invoicePdfFilename, content: data.invoicePdfBuffer, mimeType: 'application/pdf' as const }]
      : undefined
  const subject = 'Paiement reçu – Facturation'
  const res = await sendMail({ to, subject, html, action: 'transactional-payment-success', attachments })
  if (res.ok) logEmailSent({ emailType: 'payment_success', recipient: to, subject, bodyPreview: html.slice(0, 200), bodyFull: html }).catch(() => {})
  return { ok: res.ok, error: res.error }
}

export async function sendCancellationEmail(to: string, data: CancellationEmailData): Promise<SendResult> {
  const dashboardUrl = data.dashboardUrl.startsWith('http') ? data.dashboardUrl : `${base}/dashboard`
  const html = buildCancellationEmailHtml({ ...data, dashboardUrl })
  const subject = 'Annulation de votre abonnement'
  const res = await sendMail({ to, subject, html, action: 'transactional-cancellation' })
  if (res.ok) logEmailSent({ emailType: 'cancellation', recipient: to, subject, bodyPreview: html.slice(0, 200), bodyFull: html }).catch(() => {})
  return { ok: res.ok, error: res.error }
}

function getWeeklyBodyAndCta(plan: WeeklyEmailPlan): { bodyHtml: string; ctaLabel: string } {
  switch (plan) {
    case 'starter':
      return {
        bodyHtml: `
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #404040;">Cette semaine, découvrez les formules Pro et Business : factures et devis illimités, gestion des dépenses, avoirs, et bien plus.</p>
          <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Profitez de 7 jours d'essai gratuit pour tester sans engagement.</p>
        `,
        ctaLabel: 'Voir les formules',
      }
    case 'pro':
      return {
        bodyHtml: `
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #404040;">Passez à la formule Business pour débloquer : exports comptables avancés, jusqu'à 10 établissements et comptes bancaires, historique d'activité et support prioritaire.</p>
          <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Un seul clic pour mettre à niveau votre compte.</p>
        `,
        ctaLabel: 'Passer à Business',
      }
    case 'business':
      return {
        bodyHtml: `
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #404040;">Quelques astuces pour tirer le meilleur parti de la plateforme : utilisez les modèles de factures, exportez vos écritures comptables et consultez l'historique d'activité pour suivre les actions de votre équipe.</p>
          <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Des nouvelles fonctionnalités arrivent bientôt. Restez connecté.</p>
        `,
        ctaLabel: 'Tableau de bord',
      }
  }
}

export async function sendWeeklyEmail(to: string, data: Omit<WeeklyEmailData, 'bodyHtml' | 'ctaLabel'>): Promise<SendResult> {
  const { bodyHtml, ctaLabel } = getWeeklyBodyAndCta(data.plan)
  const ctaUrl = data.ctaUrl.startsWith('http') ? data.ctaUrl : (data.plan === 'starter' ? `${base}/formules` : `${base}/dashboard`)
  const html = buildWeeklyEmailHtml({
    ...data,
    bodyHtml,
    ctaLabel,
    ctaUrl,
  })
  const subject = `${process.env.NEXT_PUBLIC_APP_NAME ?? 'Myfacturation360'} – Récap de la semaine`
  const res = await sendMail({ to, subject, html, action: 'transactional-weekly' })
  if (res.ok) logEmailSent({ emailType: 'weekly', recipient: to, subject, bodyPreview: html.slice(0, 200), bodyFull: html }).catch(() => {})
  return { ok: res.ok, error: res.error }
}

export const TRANSACTIONAL_EMAIL_TYPES = [
  'welcome',
  'trial_start',
  'trial_ending',
  'payment_success',
  'cancellation',
  'weekly',
] as const

export type TransactionalEmailType = (typeof TRANSACTIONAL_EMAIL_TYPES)[number]
