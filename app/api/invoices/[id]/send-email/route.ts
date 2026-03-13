import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateInvoicePDF } from '@/lib/billing-pdf'
import { loadPdfBillingResources } from '@/lib/load-pdf-billing'
import { sendMail } from '@/lib/smtp'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'
import { buildBillingEmailHtml } from '@/lib/billing-email-template'
import { buildDocumentDataFromInvoice } from '@/lib/en16931-xml'
import { embedFacturXInPdf } from '@/lib/factur-x-embed'
import { addPdfAEnhancements } from '@/lib/pdfa-postprocess'
import { signPdfIfConfigured } from '@/lib/pdf-sign'

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

function getRecipientName(invoice: { client: { firstName: string; lastName: string; companyName: string | null } | null; company: { name: string; legalName: string | null } | null }): string {
  if (invoice.company) return invoice.company.legalName || invoice.company.name
  if (invoice.client) {
    const name = [invoice.client.firstName, invoice.client.lastName].filter(Boolean).join(' ')
    return name || invoice.client.companyName || 'Client'
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
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
    include: { client: true, company: true, lines: true, quote: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const to = invoice.client?.email ?? invoice.company?.email
  if (!to) {
    return NextResponse.json({ error: 'Aucune adresse email pour ce client/société' }, { status: 400 })
  }
  const settings = await getBillingSettings(session.id)
  const documentData = buildDocumentDataFromInvoice(invoice, settings)
  const sellerSiren = (documentData.seller.companyId ?? '').replace(/\D/g, '').slice(0, 9)
  if (!sellerSiren && !documentData.seller.vatId) {
    return NextResponse.json(
      { error: 'Pour envoyer un PDF Factur-X, renseignez le SIRET (ou N° TVA) dans Paramètres > Facturation ou dans le profil émetteur.' },
      { status: 400 }
    )
  }
  const { pdfLib, resources } = loadPdfBillingResources()
  const pdfBuffer = await generateInvoicePDF(invoice, settings, pdfLib, resources)
  let pdfWithXml: Buffer
  try {
    pdfWithXml = await embedFacturXInPdf(pdfBuffer, documentData)
  } catch (err) {
    console.error('[invoice send-email] embedFacturXInPdf failed:', err)
    return NextResponse.json(
      { error: 'Échec de la génération du PDF Factur-X', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
  let pdf: Buffer
  try {
    pdf = await addPdfAEnhancements(pdfLib, pdfWithXml)
  } catch (err) {
    console.error('[invoice send-email] addPdfAEnhancements failed:', err)
    pdf = pdfWithXml
  }
  pdf = await signPdfIfConfigured(pdf)
  const companyName = settings.companyName || 'Myfacturation'
  const amountStr = `${invoice.totalTTC.toFixed(2)} ${invoice.currency}`
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const logoUrl = settings.logoUrl?.startsWith('http') ? settings.logoUrl : (baseUrl && settings.logoUrl ? `${baseUrl}${settings.logoUrl}` : undefined)
  const html = buildBillingEmailHtml({
    documentType: 'invoice',
    clientName: getRecipientName(invoice),
    documentNumber: invoice.number,
    amount: amountStr,
    issueDate: formatDateFR(invoice.issueDate),
    dueDate: formatDateFR(invoice.dueDate) || '—',
    companyName,
    logoUrl: logoUrl || undefined,
    signatureEmail: settings.email,
    signaturePhone: settings.phone,
    signatureWebsite: settings.website,
    footerAddress: settings.address,
    footerSiret: settings.siret,
    tvaNonApplicable: invoice.tvaNonApplicable,
  })
  const result = await sendMail({
    to,
    subject: `Facture ${invoice.number} – ${companyName}`,
    html,
    action: 'billing-invoice-email',
    attachments: [{ filename: `facture-${invoice.number}.pdf`, content: pdf, mimeType: 'application/pdf' }],
  })
  if (result.ok) {
    await prisma.invoice.update({ where: { id }, data: { status: 'sent' } })
    await logBillingActivity(session.id, 'invoice sent', 'invoice', id, { to })
  }
  return NextResponse.json({ ok: result.ok, status: result.status, error: result.error })
}
