import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const where = q
    ? { userId: session.id, ...whereNotDeleted, OR: [{ name: { contains: q } }, { legalName: { contains: q } }, { email: { contains: q } }] }
    : { userId: session.id, ...whereNotDeleted }
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
    const name = (body.name ?? '').toString().trim()
    const legalName = (body.legalName ?? '').toString().trim()
    const email = (body.email ?? '').toString().trim()
    const address = (body.address ?? '').toString().trim()
    const postalCode = (body.postalCode ?? '').toString().trim()
    const city = (body.city ?? '').toString().trim()
    const country = (body.country ?? '').toString().trim()
    const siret = (body.siret ?? '').toString().trim()
    const vatExempt = !!body.vatExempt
    const vatNumber = (body.vatNumber ?? '').toString().trim()

    const missing: string[] = []
    if (!name) missing.push('Nom')
    if (!legalName) missing.push('Raison sociale')
    if (!email) missing.push('Email')
    if (!address) missing.push('Adresse')
    if (!postalCode) missing.push('Code postal')
    if (!city) missing.push('Ville')
    if (!country) missing.push('Pays')
    if (!siret) missing.push('SIRET')
    if (!vatExempt && !vatNumber) missing.push('N° TVA ou cocher « Non assujetti à la TVA »')
    if (missing.length) {
      return NextResponse.json(
        { error: `Champs obligatoires manquants : ${missing.join(', ')}.` },
        { status: 400 }
      )
    }

    const company = await prisma.company.create({
      data: {
        userId: session.id,
        type: body.type === 'association' ? 'association' : 'societe',
        name,
        legalName,
        address,
        postalCode,
        city,
        country,
        siret,
        vatNumber: vatExempt ? undefined : vatNumber || undefined,
        vatExempt,
        email,
        phone: (body.phone ?? '').toString().trim() || undefined,
        website: (body.website ?? '').toString().trim() || undefined,
      },
    })
    await logBillingActivity(session.id, 'company created', 'company', company.id, { name: company.name })
    return NextResponse.json(company)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
