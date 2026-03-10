import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const where = q
    ? { userId: session.id, OR: [{ name: { contains: q } }, { legalName: { contains: q } }, { email: { contains: q } }] }
    : { userId: session.id }
  const companies = await prisma.company.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const body = await req.json()
    const company = await prisma.company.create({
      data: {
        userId: session.id,
        name: body.name ?? '',
        legalName: body.legalName ?? undefined,
        address: body.address ?? undefined,
        postalCode: body.postalCode ?? undefined,
        city: body.city ?? undefined,
        country: body.country ?? undefined,
        siret: body.siret ?? undefined,
        vatNumber: body.vatNumber ?? undefined,
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        website: body.website ?? undefined,
      },
    })
    await logBillingActivity(session.id, 'company created', 'company', company.id, { name: company.name })
    return NextResponse.json(company)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
