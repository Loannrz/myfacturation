import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateCreditNotePDF } from '@/lib/billing-pdf'
import { loadPdfLib } from '@/lib/load-pdf-lib'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const creditNote = await prisma.creditNote.findFirst({
    where: { id, userId: session.id },
    include: { client: true, company: true, invoice: { select: { number: true } }, lines: true },
  })
  if (!creditNote) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const settings = await getBillingSettings(session.id)
  const pdfLib = await loadPdfLib()
  const pdf = await generateCreditNotePDF(creditNote, settings, pdfLib)
  const filename = `avoir-${creditNote.number}.pdf`.replace(/[^\w.\-]/g, '_')
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
