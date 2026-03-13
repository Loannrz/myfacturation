import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateCreditNotePDF } from '@/lib/billing-pdf'
import { loadPdfBillingResources } from '@/lib/load-pdf-billing'
import { sendMail } from '@/lib/smtp'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'
import { buildBillingEmailHtml } from '@/lib/billing-email-template'
import { buildDocumentDataFromCreditNote } from '@/lib/en16931-xml'
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

function getRecipientName(creditNote: { client: { firstName: string; lastName: string; companyName: string | null } | null; company: { name: string; legalName?: string | null } | null }): string {
  if (creditNote.company) return creditNote.company.legalName || creditNote.company.name
  if (creditNote.client) {
    const name = [creditNote.client.firstName, creditNote.client.lastName].filter(Boolean).join(' ')
    return name || creditNote.client.companyName || 'Client'
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
  const creditNote = await prisma.creditNote.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
    include: { client: true, company: true, invoice: { select: { number: true, issueDate: true } }, lines: true },
  })
  if (!creditNote) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const to = creditNote.client?.email ?? creditNote.company?.email
  if (!to) {
    return NextResponse.json({ error: 'Aucune adresse email pour ce client/société' }, { status: 400 })
  }
  const settings = await getBillingSettings(session.id)
  const documentData = buildDocumentDataFromCreditNote(creditNote, settings)
  const sellerSiren = (documentData.seller.companyId ?? '').replace(/\D/g, '').slice(0, 9)
  if (!sellerSiren && !documentData.seller.vatId) {
    return NextResponse.json(
      { error: 'Pour envoyer un PDF Factur-X, renseignez le SIRET (ou N° TVA) dans Paramètres > Facturation ou dans le profil émetteur.' },
      { status: 400 }
    )
  }
  const { pdfLib, resources } = loadPdfBillingResources()
  const pdfBuffer = await generateCreditNotePDF(creditNote, settings, pdfLib, resources)
  let pdfWithXml: Buffer
  try {
    pdfWithXml = await embedFacturXInPdf(pdfBuffer, documentData)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[credit-note send-email] embedFacturXInPdf failed:', err)
    const isValidation = message.includes('BR-CO-25') || message.includes('BR-FR-CO-05')
    return NextResponse.json(
      { error: isValidation ? message : 'Échec de la génération du PDF Factur-X', details: message },
      { status: isValidation ? 400 : 500 }
    )
  }
  let pdf: Buffer
  try {
    pdf = await addPdfAEnhancements(pdfLib, pdfWithXml)
  } catch (err) {
    console.error('[credit-note send-email] addPdfAEnhancements failed:', err)
    pdf = pdfWithXml
  }
  pdf = await signPdfIfConfigured(pdf)
  const companyName = (documentData.seller.name || settings.companyName || 'Myfacturation').trim() || 'Myfacturation'
  const amountStr = `${creditNote.totalTTC.toFixed(2)} ${creditNote.currency}`
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const logoUrl = settings.logoUrl?.startsWith('http') ? settings.logoUrl : (baseUrl && settings.logoUrl ? `${baseUrl}${settings.logoUrl}` : undefined)
  const signupUrl = baseUrl ? `${baseUrl}/signup` : ''
  const html = buildBillingEmailHtml({
    documentType: 'credit_note',
    clientName: getRecipientName(creditNote),
    documentNumber: creditNote.number,
    amount: amountStr,
    issueDate: formatDateFR(creditNote.issueDate),
    dueDate: '—',
    companyName,
    logoUrl: logoUrl || undefined,
    signatureEmail: settings.email,
    signaturePhone: settings.phone,
    signatureWebsite: settings.website,
    footerAddress: settings.address,
    footerSiret: settings.siret,
    tvaNonApplicable: creditNote.tvaNonApplicable ?? undefined,
    signupUrl: signupUrl || undefined,
  })
  const result = await sendMail({
    to,
    subject: `Avoir ${creditNote.number} – ${companyName} (via MyFacturation360)`,
    html,
    action: 'billing-credit-note-email',
    attachments: [{ filename: `avoir-${creditNote.number}.pdf`, content: pdf, mimeType: 'application/pdf' }],
  })
  if (result.ok) {
    await prisma.creditNote.update({ where: { id }, data: { status: 'sent' } })
    await logBillingActivity(session.id, 'credit_note sent', 'credit_note', id, { to })
  }
  return NextResponse.json({ ok: result.ok, status: result.status, error: result.error })
}
