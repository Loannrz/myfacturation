import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateQuotePDF } from '@/lib/billing-pdf'
import { loadPdfLib } from '@/lib/load-pdf-lib'

export const dynamic = 'force-dynamic'

export async function GET(
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
  const settings = await getBillingSettings(session.id)
  const pdfLib = await loadPdfLib()
  const pdf = await generateQuotePDF(quote, settings, pdfLib)
  const filename = `devis-${quote.number}.pdf`.replace(/[^\w.\-]/g, '_')
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
