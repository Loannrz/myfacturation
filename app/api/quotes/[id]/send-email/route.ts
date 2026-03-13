import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateQuotePDF } from '@/lib/billing-pdf'
import { loadPdfBillingResources } from '@/lib/load-pdf-billing'
import { sendMail } from '@/lib/smtp'
import { logBillingActivity } from '@/lib/billing-activity'
import { buildBillingEmailHtml } from '@/lib/billing-email-template'

export const dynamic = 'force-dynamic'

function formatDateFR(s: string | null | undefined): string {
  if (!s || typeof s !== 'string') return '—'
  const parts = s.trim().split(/[-/]/)
  if (parts.length >= 3) {
    const [y, m, d] = parts
    return `${d!.padStart(2, '0')}/${m!.padStart(2, '0')}/${y}`
  }
  return s
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
  _req: NextRequest,
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
  const to = quote.client?.email ?? quote.company?.email
  if (!to) {
    return NextResponse.json({ error: 'Aucune adresse email pour ce client/société' }, { status: 400 })
  }
  const settings = await getBillingSettings(session.id)
  const { pdfLib, resources } = loadPdfBillingResources()
  const pdf = await generateQuotePDF(quote, settings, pdfLib, resources)
  const companyName = settings.companyName || 'Myfacturation'
  const amountStr = `${quote.totalTTC.toFixed(2)} ${quote.currency}`
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const logoUrl = settings.logoUrl?.startsWith('http') ? settings.logoUrl : (baseUrl && settings.logoUrl ? `${baseUrl}${settings.logoUrl}` : undefined)
  const html = buildBillingEmailHtml({
    documentType: 'quote',
    clientName: getRecipientName(quote),
    documentNumber: quote.number,
    amount: amountStr,
    issueDate: formatDateFR(quote.issueDate),
    dueDate: formatDateFR(quote.dueDate) || '—',
    companyName,
    logoUrl: logoUrl || undefined,
    signatureEmail: settings.email,
    signaturePhone: settings.phone,
    signatureWebsite: settings.website,
    footerAddress: settings.address,
    footerSiret: settings.siret,
  })
  const result = await sendMail({
    to,
    subject: `Devis ${quote.number} – ${companyName}`,
    html,
    action: 'billing-quote-email',
    attachments: [{ filename: `devis-${quote.number}.pdf`, content: pdf, mimeType: 'application/pdf' }],
  })
  if (result.ok) {
    await prisma.quote.update({ where: { id }, data: { status: 'sent' } })
    await logBillingActivity(session.id, 'quote sent', 'quote', id, { to })
  }
  return NextResponse.json({ ok: result.ok, status: result.status, error: result.error })
}
