import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'
import { getBillingSettings } from '@/lib/billing-settings'
import { generateQuotePDF } from '@/lib/billing-pdf'
import { loadPdfBillingResources } from '@/lib/load-pdf-billing'

export const dynamic = 'force-dynamic'

const today = new Date().toISOString().slice(0, 10)

function isPastDue(dueDate: string | null): boolean {
  if (!dueDate || typeof dueDate !== 'string') return false
  const d = dueDate.trim().slice(0, 10)
  return d.length === 10 && d < today
}

/** GET : renvoie le PDF du devis (sans signature) pour affichage sur la page de signature. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token?.trim()) return new NextResponse('Token manquant', { status: 400 })

  const quote = await prisma.quote.findFirst({
    where: { signToken: token.trim(), ...whereNotDeleted },
    include: { client: true, company: true, lines: true },
  })
  if (!quote) return new NextResponse('Devis introuvable', { status: 404 })
  if (quote.status === 'signed') return new NextResponse('Ce devis a déjà été signé.', { status: 410 })
  if (isPastDue(quote.dueDate)) return new NextResponse('Ce devis a expiré.', { status: 410 })

  const settings = await getBillingSettings(quote.userId)
  const { pdfLib, resources } = loadPdfBillingResources()
  const pdf = await generateQuotePDF(quote, settings, pdfLib, resources)

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="devis-${quote.number}.pdf"`,
    },
  })
}
