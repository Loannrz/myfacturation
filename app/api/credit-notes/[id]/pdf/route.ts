import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateCreditNotePDF } from '@/lib/billing-pdf'
import { loadPdfLib } from '@/lib/load-pdf-lib'
import { buildDocumentDataFromCreditNote } from '@/lib/en16931-xml'
import { embedFacturXInPdf } from '@/lib/factur-x-embed'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const creditNote = await prisma.creditNote.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
    include: { client: true, company: true, invoice: { select: { number: true } }, lines: true },
  })
  if (!creditNote) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const settings = await getBillingSettings(session.id)
  const documentData = buildDocumentDataFromCreditNote(creditNote, settings)
  const sellerSiren = (documentData.seller.companyId ?? '').replace(/\D/g, '').slice(0, 9)
  if (!sellerSiren && !documentData.seller.vatId) {
    return NextResponse.json(
      { error: 'Pour générer un PDF Factur-X, renseignez le SIRET (ou N° TVA) dans Paramètres > Facturation ou dans le profil émetteur.' },
      { status: 400 }
    )
  }
  const pdfLib = await loadPdfLib()
  const pdfBuffer = await generateCreditNotePDF(creditNote, settings, pdfLib)
  let pdfWithXml: Buffer
  try {
    pdfWithXml = await embedFacturXInPdf(pdfBuffer, documentData)
  } catch (err) {
    console.error('[credit-note pdf] embedFacturXInPdf failed:', err)
    return NextResponse.json(
      { error: 'Échec de la génération du PDF Factur-X', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
  const filename = `avoir-${creditNote.number}.pdf`.replace(/[^\w.\-]/g, '_')
  return new NextResponse(new Uint8Array(pdfWithXml), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfWithXml.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
