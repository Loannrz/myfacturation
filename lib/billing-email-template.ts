/**
 * Template HTML pour les emails facture / devis (Myfacturation).
 */

export interface BillingEmailData {
  documentType: 'quote' | 'invoice'
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
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildBillingEmailHtml(data: BillingEmailData): string {
  const docLabel = data.documentType === 'quote' ? 'DEVIS' : 'FACTURE'
  const docTypeFr = data.documentType === 'quote' ? 'devis' : 'facture'
  const company = data.companyName || 'Myfacturation'
  const sigEmail = data.signatureEmail || ''
  const sigPhone = data.signaturePhone || ''
  const sigWebsite = data.signatureWebsite || ''
  const footerAddr = data.footerAddress || ''
  const footerSiret = data.footerSiret || ''

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
            <td style="padding: 40px 40px 24px 40px; text-align: center; border-bottom: 1px solid #eeeeee;">
              ${logoBlock}
              <div style="margin-top: 24px;">
                <span style="font-size: 14px; font-weight: 600; color: #525252; letter-spacing: 0.05em;">${escapeHtml(docLabel)}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">Bonjour ${escapeHtml(data.clientName)},</p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #404040;">Veuillez trouver ci-joint votre ${escapeHtml(docTypeFr)} n° <strong>${escapeHtml(data.documentNumber)}</strong> émis le ${escapeHtml(data.issueDate)}.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0; background-color: #fafafa; border-radius: 6px; border: 1px solid #eeeeee;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #737373;">Montant total</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 600; color: #1a1a1a;">${escapeHtml(data.amount)}</p>
                    <p style="margin: 16px 0 0 0; font-size: 13px; color: #737373;">Date d'échéance</p>
                    <p style="margin: 4px 0 0 0; font-size: 15px; color: #404040;">${escapeHtml(data.dueDate)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 28px 0; font-size: 15px; color: #404040;">Le document est en pièce jointe à cet email (PDF).</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eeeeee;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 14px; color: #737373;">Si vous avez la moindre question concernant ce document, nous restons à votre disposition.</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #404040;">Cordialement,</p>
                    <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${escapeHtml(company)}</p>
                    ${sigEmail ? `<p style="margin: 0 0 2px 0; font-size: 14px; color: #525252;"><a href="mailto:${escapeHtml(sigEmail)}" style="color: #404040; text-decoration: none;">${escapeHtml(sigEmail)}</a></p>` : ''}
                    ${sigPhone ? `<p style="margin: 0 0 2px 0; font-size: 14px; color: #525252;">${escapeHtml(sigPhone)}</p>` : ''}
                    ${sigWebsite ? `<p style="margin: 0; font-size: 14px; color: #525252;"><a href="${escapeHtml(sigWebsite)}" style="color: #404040; text-decoration: none;">${escapeHtml(sigWebsite)}</a></p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px 40px; background-color: #fafafa; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #737373; text-align: center;">
                ${escapeHtml(company)}<br />
                ${footerAddr ? `${escapeHtml(footerAddr)}<br />` : ''}
                ${footerSiret ? `SIRET : ${escapeHtml(footerSiret)}` : ''}
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
