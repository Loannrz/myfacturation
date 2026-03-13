/**
 * Template HTML pour les emails facture / devis (Myfacturation).
 */

export interface BillingEmailData {
  documentType: 'quote' | 'invoice' | 'credit_note'
  clientName: string
  documentNumber: string
  amount: string
  issueDate: string
  dueDate: string
  companyName: string
  logoUrl?: string | null
  signatureEmail?: string | null
  signaturePhone?: string | null
  signatureWebsite?: string | null
  footerAddress?: string | null
  footerSiret?: string | null
  /** Si true, afficher la mention « TVA non applicable – article 293 B du CGI » */
  tvaNonApplicable?: boolean
  /** URL d'inscription pour le bloc MyFacturation360 en fin d'email */
  signupUrl?: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildBillingEmailHtml(data: BillingEmailData): string {
  const docLabel = data.documentType === 'quote' ? 'DEVIS' : data.documentType === 'credit_note' ? 'AVOIR' : 'FACTURE'
  const company = data.companyName || 'Myfacturation'
  const footerAddr = data.footerAddress || ''
  const footerSiret = data.footerSiret || ''
  const signupUrl = (data.signupUrl || '').trim()
  const promoHtml = signupUrl ? promoBlock(signupUrl) : ''

  const logoBlock = data.logoUrl
    ? `<img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(company)}" width="140" height="40" style="display: block; max-width: 140px; height: auto;" />`
    : `<span style="font-size: 24px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.02em;">${escapeHtml(company)}</span>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(docLabel)} ${escapeHtml(data.documentNumber)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 40px 40px 16px 40px; text-align: center; border-bottom: 1px solid #eeeeee;">
              ${logoBlock}
              <div style="margin-top: 20px;">
                <span style="font-size: 14px; font-weight: 600; color: #525252; letter-spacing: 0.05em;">${escapeHtml(docLabel)}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1a1a;">Bonjour ${escapeHtml(data.clientName)},</p>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #404040; line-height: 1.6;">Vous recevez ce message car <strong>${escapeHtml(company)}</strong> vous a transmis ce document via la plateforme sécurisée <strong>MyFacturation360</strong>.</p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Veuillez trouver ci-joint votre document&nbsp;:</p>
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #404040;"><strong>Numéro&nbsp;:</strong> ${escapeHtml(data.documentNumber)}</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #404040;"><strong>Date d&apos;émission&nbsp;:</strong> ${escapeHtml(data.issueDate)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; background-color: #fafafa; border-radius: 6px; border: 1px solid #eeeeee;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #737373;">Montant total</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 600; color: #1a1a1a;">${escapeHtml(data.amount)}</p>
                    <p style="margin: 16px 0 0 0; font-size: 13px; color: #737373;">Date d&apos;échéance</p>
                    <p style="margin: 4px 0 0 0; font-size: 15px; color: #404040;">${escapeHtml(data.dueDate)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Le document est en pièce jointe à cet email (PDF).</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #404040; line-height: 1.5;">Ce document a été envoyé via la plateforme sécurisée <strong>MyFacturation360</strong>. Si vous avez la moindre question concernant ce document, vous pouvez contacter directement <strong>${escapeHtml(company)}</strong>.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #eeeeee;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #404040;">Cordialement,</p>
                    <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${escapeHtml(company)}</p>
                    <p style="margin: 16px 0 0 0; font-size: 12px; color: #737373;">Envoyé via MyFacturation360</p>
                  </td>
                </tr>
              </table>
              ${promoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px 40px; background-color: #fafafa; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #737373; text-align: center;">
                ${escapeHtml(company)}<br />
                ${footerAddr ? `${escapeHtml(footerAddr)}<br />` : ''}
                ${footerSiret ? `SIRET : ${escapeHtml(footerSiret)}` : ''}
                ${data.tvaNonApplicable ? '<br /><em>TVA non applicable – article 293 B du CGI</em>' : ''}
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

/** Bloc promotionnel MyFacturation360 (inscription, 7 jours offerts). À insérer en fin d’email si signupUrl fourni. */
function promoBlock(signupUrl: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #eeeeee;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #737373;">—</p>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #404040; line-height: 1.6;">Vous souhaitez découvrir <strong>MyFacturation360</strong>, la solution de facturation pensée pour les auto-entrepreneurs, associations, indépendants et petites entreprises&nbsp;?</p>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #404040; line-height: 1.6;">Créez vos devis, factures et avoirs simplement, envoyez-les en quelques secondes et gérez votre activité sans complexité.</p>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #404040; line-height: 1.6;">Simple, rapide et accessible dès <strong>moins de 5&nbsp;€&nbsp;/&nbsp;mois</strong>.</p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #404040;">👉 Créez votre compte en quelques minutes&nbsp;:</p>
                    <p style="margin: 0 0 16px 0; font-size: 14px;"><a href="${escapeHtml(signupUrl)}" style="color: #1a1a1a; font-weight: 600; text-decoration: underline;">Commencer gratuitement avec MyFacturation360</a></p>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #525252; line-height: 1.5;">En utilisant ce lien, vous bénéficiez également de <strong>7 jours offerts sur n&apos;importe quel abonnement</strong>.</p>
                    <p style="margin: 0 0 4px 0; font-size: 14px; color: #737373;">—</p>
                    <p style="margin: 0; font-size: 12px; color: #737373; font-weight: 600;">MyFacturation360 – La facturation simple et professionnelle.</p>
                  </td>
                </tr>
              </table>`
}

/** Données pour l’email devis avec lien de signature (consultation + signature client). */
export interface QuoteSignLinkEmailData {
  companyName: string
  clientName: string
  amount: string
  signUrl: string
  signatureEmail?: string | null
  signaturePhone?: string | null
  footerAddress?: string | null
  footerSiret?: string | null
  /** URL d’inscription pour le bloc promo (ex. https://example.com/signup) */
  signupUrl?: string | null
  tvaNonApplicable?: boolean
}

export function buildQuoteSignLinkEmailHtml(data: QuoteSignLinkEmailData): string {
  const company = data.companyName || 'Myfacturation'
  const footerAddr = data.footerAddress || ''
  const footerSiret = data.footerSiret || ''
  const signupUrl = (data.signupUrl || '').trim()
  const promoHtml = signupUrl ? promoBlock(signupUrl) : ''
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Devis – ${escapeHtml(company)} (via MyFacturation360)</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 40px 40px 16px 40px; text-align: center; border-bottom: 1px solid #eeeeee;">
              <span style="font-size: 24px; font-weight: 700; color: #1a1a1a;">${escapeHtml(company)}</span>
              <div style="margin-top: 20px;">
                <span style="font-size: 14px; font-weight: 600; color: #525252; letter-spacing: 0.05em;">DEVIS</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1a1a;">Bonjour ${escapeHtml(data.clientName)},</p>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #404040; line-height: 1.6;">Vous recevez ce message car <strong>${escapeHtml(company)}</strong> vous a transmis ce document via la plateforme sécurisée <strong>MyFacturation360</strong>.</p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Ce devis contient le détail de la prestation ou des services proposés.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; background-color: #fafafa; border-radius: 6px; border: 1px solid #eeeeee;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #737373;">Montant total</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 600; color: #1a1a1a;">${escapeHtml(data.amount)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Pour consulter et signer votre devis en ligne, cliquez sur le bouton ci-dessous&nbsp;:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${escapeHtml(data.signUrl)}" style="display: inline-block; padding: 14px 28px; background-color: #1a1a1a; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px;">Voir et signer le devis</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0 0; font-size: 14px; color: #404040;">La signature se fait directement en ligne et ne prend que quelques secondes.</p>
              <p style="margin: 20px 0 0 0; font-size: 14px; color: #404040; line-height: 1.5;">Ce document a été envoyé via la plateforme sécurisée <strong>MyFacturation360</strong>. Si vous avez la moindre question concernant ce devis, vous pouvez contacter directement <strong>${escapeHtml(company)}</strong>.</p>
              <p style="margin: 20px 0 0 0; font-size: 13px; color: #737373;">Ou copiez ce lien dans votre navigateur&nbsp;:</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #404040; word-break: break-all;">${escapeHtml(data.signUrl)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #eeeeee;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #404040;">Cordialement,</p>
                    <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${escapeHtml(company)}</p>
                    <p style="margin: 16px 0 0 0; font-size: 12px; color: #737373;">Envoyé via MyFacturation360</p>
                  </td>
                </tr>
              </table>
              ${promoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px 40px; background-color: #fafafa; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #737373; text-align: center;">
                ${escapeHtml(company)}<br />
                ${footerAddr ? `${escapeHtml(footerAddr)}<br />` : ''}
                ${footerSiret ? `SIRET : ${escapeHtml(footerSiret)}` : ''}
                ${data.tvaNonApplicable ? '<br /><em>TVA non applicable – article 293 B du CGI</em>' : ''}
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

/** Données pour l’email « devis signé » envoyé à l’émetteur. */
export interface QuoteSignedNotificationData {
  clientName: string
  signedAt: string
  quoteNumber: string
  companyName: string
  /** URL d’inscription pour le bloc promo */
  signupUrl?: string | null
}

export function buildQuoteSignedNotificationHtml(data: QuoteSignedNotificationData): string {
  const company = data.companyName || 'Myfacturation'
  const signupUrl = (data.signupUrl || '').trim()
  const promoHtml = signupUrl ? promoBlock(signupUrl) : ''
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Votre devis a été signé – ${escapeHtml(company)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 32px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #737373; text-transform: uppercase; letter-spacing: 0.05em;">Notification</p>
              <h1 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 600; color: #1a1a1a;">Votre devis a été signé</h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Bonjour,</p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Nous vous informons que votre devis <strong>${escapeHtml(data.quoteNumber)}</strong> (${escapeHtml(company)}) a été signé par votre client.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0; background-color: #fafafa; border-radius: 6px; border: 1px solid #eeeeee;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 13px; color: #737373;">Signataire</p>
                    <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${escapeHtml(data.clientName)}</p>
                    <p style="margin: 0 0 4px 0; font-size: 13px; color: #737373;">Date de signature</p>
                    <p style="margin: 0; font-size: 15px; color: #404040;">${escapeHtml(data.signedAt)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #404040;">Le devis signé est joint à cet email en pièce jointe (PDF). Vous pouvez le conserver pour vos archives.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #eeeeee;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #404040;">Cordialement,</p>
                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${escapeHtml(company)}</p>
                    <p style="margin: 16px 0 0 0; font-size: 12px; color: #737373;">Envoyé via MyFacturation360</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 28px 0 0 0; font-size: 12px; color: #737373; line-height: 1.5;">Ce message a été envoyé automatiquement par la plateforme sécurisée MyFacturation360. Si vous pensez avoir reçu cet email par erreur, vous pouvez simplement l&apos;ignorer.</p>
              ${promoHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export interface BillingConfirmationData {
  documentType: 'quote' | 'invoice'
  documentNumber: string
  sentToEmail: string
  clientName: string
  amount: string
  issueDate: string
  dueDate: string
  sentAt: string
}

export function buildBillingConfirmationEmailHtml(data: BillingConfirmationData): string {
  const docLabel = data.documentType === 'quote' ? 'Devis' : 'Facture'
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Confirmation d'envoi</title></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 32px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #737373; text-transform: uppercase; letter-spacing: 0.05em;">Confirmation d'envoi</p>
              <h1 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 600; color: #1a1a1a;">${escapeHtml(docLabel)} envoyé(e) avec succès</h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Ce message confirme que le document suivant a bien été envoyé au client par email.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border: 1px solid #eeeeee; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr><td style="padding: 6px 0; font-size: 13px; color: #737373;">Type</td><td style="padding: 6px 0; font-size: 14px; color: #1a1a1a; font-weight: 500;">${escapeHtml(docLabel)}</td></tr>
                      <tr><td style="padding: 6px 0; font-size: 13px; color: #737373;">Numéro</td><td style="padding: 6px 0; font-size: 14px; color: #1a1a1a;">${escapeHtml(data.documentNumber)}</td></tr>
                      <tr><td style="padding: 6px 0; font-size: 13px; color: #737373;">Envoyé à</td><td style="padding: 6px 0; font-size: 14px; color: #1a1a1a;">${escapeHtml(data.sentToEmail)}</td></tr>
                      <tr><td style="padding: 6px 0; font-size: 13px; color: #737373;">Client</td><td style="padding: 6px 0; font-size: 14px; color: #1a1a1a;">${escapeHtml(data.clientName)}</td></tr>
                      <tr><td style="padding: 6px 0; font-size: 13px; color: #737373;">Montant</td><td style="padding: 6px 0; font-size: 14px; color: #1a1a1a;">${escapeHtml(data.amount)}</td></tr>
                      <tr><td style="padding: 6px 0; font-size: 13px; color: #737373;">Date d'envoi</td><td style="padding: 6px 0; font-size: 14px; color: #1a1a1a;">${escapeHtml(data.sentAt)}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
