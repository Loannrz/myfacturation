import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateInvoicePDF } from '@/lib/billing-pdf'
import { loadPdfBillingResources } from '@/lib/load-pdf-billing'
import { whereNotDeleted } from '@/lib/soft-delete'
import { buildDocumentDataFromInvoice } from '@/lib/en16931-xml'
import { embedFacturXInPdf } from '@/lib/factur-x-embed'
import { addPdfAEnhancements } from '@/lib/pdfa-postprocess'
import { signPdfIfConfigured } from '@/lib/pdf-sign'

export const dynamic = 'force-dynamic'

export async function GET(
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
  const settings = await getBillingSettings(session.id)
  const documentData = buildDocumentDataFromInvoice(invoice, settings)
  const sellerSiren = (documentData.seller.companyId ?? '').replace(/\D/g, '').slice(0, 9)
  if (!sellerSiren && !documentData.seller.vatId) {
    return NextResponse.json(
      { error: 'Pour générer un PDF Factur-X, renseignez le SIRET (ou N° TVA) dans Paramètres > Facturation ou dans le profil émetteur.' },
      { status: 400 }
    )
  }
  const { pdfLib, resources } = loadPdfBillingResources()
  const pdfBuffer = await generateInvoicePDF(invoice, settings, pdfLib, resources)
  let pdfWithXml: Buffer
  try {
    pdfWithXml = await embedFacturXInPdf(pdfBuffer, documentData)
  } catch (err) {
    console.error('[invoice pdf] embedFacturXInPdf failed:', err)
    return NextResponse.json(
      { error: 'Échec de la génération du PDF Factur-X', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
  let pdfFinal: Buffer
  try {
    pdfFinal = await addPdfAEnhancements(pdfLib, pdfWithXml)
  } catch (err) {
    console.error('[invoice pdf] addPdfAEnhancements failed:', err)
    pdfFinal = pdfWithXml
  }
  pdfFinal = await signPdfIfConfigured(pdfFinal)
  const filename = `facture-${invoice.number}.pdf`.replace(/[^\w.\-]/g, '_')
  return new NextResponse(new Uint8Array(pdfFinal), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfFinal.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
