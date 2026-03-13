import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'
import { getBillingSettings, parseEmitterProfiles } from '@/lib/billing-settings'
import { generateQuotePDF } from '@/lib/billing-pdf'
import { loadPdfBillingResources } from '@/lib/load-pdf-billing'
import { addSignatureToQuotePdf } from '@/lib/quote-pdf-signature'
import { sendMail } from '@/lib/smtp'
import { buildQuoteSignedNotificationHtml } from '@/lib/billing-email-template'

export const dynamic = 'force-dynamic'

function getRecipientName(quote: { client: { firstName: string; lastName: string; companyName: string | null } | null; company: { name: string; legalName: string | null } | null }): string {
  if (quote.company) return quote.company.legalName || quote.company.name
  if (quote.client) {
    const name = [quote.client.firstName, quote.client.lastName].filter(Boolean).join(' ')
    return name || quote.client.companyName || 'Client'
  }
  return 'Client'
}

const today = new Date().toISOString().slice(0, 10)

function isPastDue(dueDate: string | null): boolean {
  if (!dueDate || typeof dueDate !== 'string') return false
  const d = dueDate.trim().slice(0, 10)
  return d.length === 10 && d < today
}

/** GET : consultation publique du devis par token (pour affichage + zone signature). Le lien est valide jusqu'à la date d'échéance. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token?.trim()) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

  const quote = await prisma.quote.findFirst({
    where: { signToken: token.trim(), ...whereNotDeleted },
    include: { client: true, company: true, lines: true },
  })
  if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
  if (quote.status === 'signed') {
    return NextResponse.json({ error: 'Ce devis a déjà été signé.' }, { status: 410 })
  }
  if (isPastDue(quote.dueDate)) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'expired' },
    })
    return NextResponse.json({ error: 'Ce devis a expiré (date d\'échéance dépassée).' }, { status: 410 })
  }

  const payload = {
    id: quote.id,
    number: quote.number,
    status: quote.status,
    issueDate: quote.issueDate,
    dueDate: quote.dueDate,
    currency: quote.currency,
    totalHT: quote.totalHT,
    vatAmount: quote.vatAmount,
    totalTTC: quote.totalTTC,
    client: quote.client ? { firstName: quote.client.firstName, lastName: quote.client.lastName, companyName: quote.client.companyName, email: quote.client.email } : null,
    company: quote.company ? { name: quote.company.name, legalName: quote.company.legalName, email: quote.company.email } : null,
    lines: quote.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate, discount: l.discount, total: l.total })),
  }
  return NextResponse.json(payload)
}

/** POST : enregistrement de la signature (image PNG base64), mise à jour du devis et envoi email à l'émetteur. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token?.trim()) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

  const quote = await prisma.quote.findFirst({
    where: { signToken: token.trim(), ...whereNotDeleted },
    include: { client: true, company: true, lines: true, user: { select: { email: true } } },
  })
  if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
  if (quote.status === 'signed') {
    return NextResponse.json({ error: 'Ce devis a déjà été signé.' }, { status: 410 })
  }
  if (isPastDue(quote.dueDate)) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'expired' },
    })
    return NextResponse.json({ error: 'Ce devis a expiré (date d\'échéance dépassée).' }, { status: 410 })
  }

  let body: { signatureDataUrl?: string; signatureBase64?: string; signerName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }
  const rawSignature = body.signatureDataUrl ?? body.signatureBase64
  if (!rawSignature || typeof rawSignature !== 'string') {
    return NextResponse.json({ error: 'Signature (image) manquante' }, { status: 400 })
  }
  const signerName = typeof body.signerName === 'string' ? body.signerName.trim().slice(0, 200) : null
  if (!signerName || signerName.length === 0) {
    return NextResponse.json({ error: 'Veuillez indiquer votre nom, prénom ou raison sociale.' }, { status: 400 })
  }

  let pngBuffer: Buffer
  if (rawSignature.startsWith('data:image/png;base64,')) {
    pngBuffer = Buffer.from(rawSignature.replace(/^data:image\/png;base64,/, ''), 'base64')
  } else {
    pngBuffer = Buffer.from(rawSignature, 'base64')
  }
  if (pngBuffer.length === 0) return NextResponse.json({ error: 'Image de signature invalide' }, { status: 400 })

  const signedAt = new Date()
  const signatureBase64 = pngBuffer.toString('base64')

  const settings = await getBillingSettings(quote.userId)
  const { pdfLib, resources } = loadPdfBillingResources()
  const pdfWithoutSignature = await generateQuotePDF(quote, settings, pdfLib, resources)
  const pdfWithSignature = await addSignatureToQuotePdf(pdfWithoutSignature, pngBuffer, signerName)

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: 'signed',
      signedAt,
      signatureImageBase64: signatureBase64,
      signerName,
    },
  })

  const companyName = settings.companyName || 'Myfacturation'
  const clientName = getRecipientName(quote)
  const signedAtStr = signedAt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

  const profilesList = parseEmitterProfiles(settings.emitterProfiles ?? null)
  const emitterProfile = quote.emitterProfileId && profilesList.length > 0
    ? profilesList.find((p) => p.id === quote.emitterProfileId)
    : null
  const establishmentEmail = (emitterProfile?.email ?? '').trim()
  const userAccountEmail = (quote.user?.email ?? '').trim()
  const signerEmail = (quote.client?.email ?? quote.company?.email ?? '').trim()

  const isNoreply = (e: string) => !e || e.toLowerCase().includes('noreply')
  const recipients: string[] = []
  if (establishmentEmail && !isNoreply(establishmentEmail)) recipients.push(establishmentEmail)
  if (userAccountEmail && !isNoreply(userAccountEmail) && !recipients.includes(userAccountEmail)) recipients.push(userAccountEmail)
  if (signerEmail && !isNoreply(signerEmail) && !recipients.includes(signerEmail)) recipients.push(signerEmail)
  const toEmail = recipients[0]
  const ccList = recipients.length > 1 ? recipients.slice(1) : []

  if (toEmail) {
    const signupBase = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    const signupUrl = signupBase ? `${signupBase}/signup` : ''
    const html = buildQuoteSignedNotificationHtml({
      clientName,
      signedAt: signedAtStr,
      quoteNumber: quote.number,
      companyName,
      signupUrl: signupUrl || undefined,
    })
    await sendMail({
      from: process.env.QUOTE_SIGNED_EMAIL_FROM || 'noreply@myfacturation360.fr',
      to: toEmail,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: `Votre devis a été signé – ${companyName}`,
      html,
      action: 'quote-signed-notification',
      attachments: [{ filename: `devis-${quote.number}-signe.pdf`, content: pdfWithSignature, mimeType: 'application/pdf' }],
    })
  }

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString() })
}
