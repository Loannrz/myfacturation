import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateQuotePDF } from '@/lib/billing-pdf'
import { loadPdfBillingResources } from '@/lib/load-pdf-billing'
import { sendMail } from '@/lib/smtp'
import { logBillingActivity } from '@/lib/billing-activity'
import { buildQuoteSignLinkEmailHtml } from '@/lib/billing-email-template'

export const dynamic = 'force-dynamic'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string | null | undefined): boolean {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 && EMAIL_REGEX.test(trimmed)
}

function getRecipientName(quote: { client: { firstName: string; lastName: string; companyName: string | null } | null; company: { name: string; legalName: string | null } | null }): string {
  if (quote.company) return quote.company.legalName || quote.company.name
  if (quote.client) {
    const name = [quote.client.firstName, quote.client.lastName].filter(Boolean).join(' ')
    return name || quote.client.companyName || 'Client'
  }
  return 'Client'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const quote = await prisma.quote.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
    include: { client: true, company: true, lines: true },
  })
  if (!quote) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (quote.status === 'signed') {
    return NextResponse.json(
      { error: 'Ce devis est déjà signé. L\'envoi par email n\'est plus possible.' },
      { status: 400 }
    )
  }

  const to = (quote.client?.email ?? quote.company?.email ?? '').trim()
  if (!to) {
    return NextResponse.json(
      { error: 'Veuillez renseigner l\'email du client pour envoyer le devis.' },
      { status: 400 }
    )
  }
  if (!isValidEmail(to)) {
    return NextResponse.json(
      { error: 'L\'adresse email du client est invalide ou non renseignée. L\'email n\'a pas pu être distribué.' },
      { status: 400 }
    )
  }

  const settings = await getBillingSettings(session.id)
  const { parseEmitterProfiles } = await import('@/lib/billing-settings')
  const profilesList = parseEmitterProfiles(settings.emitterProfiles ?? null)
  const emitterProfile = quote.emitterProfileId && profilesList.length > 0
    ? profilesList.find((p) => p.id === quote.emitterProfileId)
    : null
  const companyName = (emitterProfile?.companyName?.trim() || (settings.companyName ?? '').trim() || 'Mon entreprise').trim() || 'Mon entreprise'
  const amountStr = `${quote.totalTTC.toFixed(2)} ${quote.currency}`

  // Nouveau token à chaque envoi : si le devis avait déjà été envoyé, l'ancien lien de signature devient invalide
  const signToken = randomBytes(32).toString('hex')
  const envBase = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const host = req.headers.get('host') || ''
  const proto = req.headers.get('x-forwarded-proto') || (req.headers.get('x-forwarded-ssl') === 'on' ? 'https' : 'http')
  const baseUrl = envBase || (host ? `${proto}://${host}` : '')
  const signUrl = baseUrl ? `${baseUrl}/quote/sign/${signToken}` : ''
  if (!signUrl) {
    return NextResponse.json(
      { error: 'Impossible de générer le lien de signature. Configurez NEXT_PUBLIC_APP_URL (ex: https://votredomaine.com).' },
      { status: 500 }
    )
  }

  const { pdfLib, resources } = loadPdfBillingResources()
  const pdf = await generateQuotePDF(quote, settings, pdfLib, resources)

  const signupUrl = baseUrl ? `${baseUrl}/signup` : ''

  const html = buildQuoteSignLinkEmailHtml({
    companyName,
    clientName: getRecipientName(quote),
    amount: amountStr,
    signUrl,
    signatureEmail: settings.email,
    signaturePhone: settings.phone,
    footerAddress: settings.address,
    footerSiret: settings.siret,
    signupUrl: signupUrl || undefined,
    tvaNonApplicable: quote.tvaNonApplicable,
  })

  const result = await sendMail({
    to,
    subject: `Devis ${quote.number} – ${companyName} (via MyFacturation360)`,
    html,
    action: 'billing-quote-sign-link',
    attachments: [{ filename: `devis-${quote.number}.pdf`, content: pdf, mimeType: 'application/pdf' }],
  })

  if (!result.ok) {
    await prisma.quote.update({
      where: { id },
      data: { status: 'delivery_failed' },
    })
    return NextResponse.json(
      { ok: false, status: result.status, error: result.error || 'L\'email n\'a pas pu être distribué. Vérifiez que l\'adresse du client est valide.' },
      { status: 400 }
    )
  }

  await prisma.quote.update({
    where: { id },
    data: {
      status: 'sent',
      sentAt: new Date(),
      signToken, // remplace l'ancien token : les anciens liens (emails précédents) ne fonctionnent plus
    },
  })
  await logBillingActivity(session.id, 'quote sent', 'quote', id, { to, signToken: true })

  return NextResponse.json({ ok: true, status: result.status })
}
