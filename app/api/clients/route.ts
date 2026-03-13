import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type') ?? undefined
  const where: { userId: string; type?: string; deletedAt?: null; OR?: { firstName?: { contains: string }; lastName?: { contains: string }; email?: { contains: string }; companyName?: { contains: string } }[] } = { userId: session.id, ...whereNotDeleted }
  if (type) where.type = type
  if (q.trim()) {
    where.OR = [
      { firstName: { contains: q.trim() } },
      { lastName: { contains: q.trim() } },
      { email: { contains: q.trim() } },
      { companyName: { contains: q.trim() } },
    ]
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(clients)
}

const LEGAL_TYPES = ['professionnel', 'association', 'entreprise']

function isLegalType(t: string): boolean {
  return LEGAL_TYPES.includes(t)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const body = await req.json()
    const type = (body.type ?? 'particulier') as string

    if (isLegalType(type)) {
      const required: Record<string, string> = {
        companyName: 'Raison sociale',
        siret: 'SIRET',
        firstName: 'Prénom',
        lastName: 'Nom',
        email: 'Email',
        address: 'Adresse',
        postalCode: 'Code postal',
        city: 'Ville',
      }
      const missing = Object.entries(required).filter(([key]) => !(body[key] ?? '').toString().trim())
      if (missing.length) {
        return NextResponse.json(
          { error: `Champs obligatoires pour un client ${type} : ${missing.map(([, label]) => label).join(', ')}` },
          { status: 400 }
        )
      }
    } else {
      const requiredParticulier: Record<string, string> = {
        firstName: 'Prénom',
        lastName: 'Nom',
        email: 'Email',
        address: 'Adresse',
        postalCode: 'Code postal',
        city: 'Ville',
        country: 'Pays',
      }
      const missing = Object.entries(requiredParticulier).filter(([key]) => !(body[key] ?? '').toString().trim())
      if (missing.length) {
        return NextResponse.json(
          { error: 'Champs obligatoires Factur-X pour le client : ' + missing.map(([, label]) => label).join(', ') },
          { status: 400 }
        )
      }
    }

    const client = await prisma.client.create({
      data: {
        userId: session.id,
        type: type || 'particulier',
        firstName: (body.firstName ?? '').toString().trim(),
        lastName: (body.lastName ?? '').toString().trim(),
        email: (body.email ?? '').toString().trim(),
        phone: body.phone ? String(body.phone).trim() : undefined,
        address: body.address ? String(body.address).trim() : undefined,
        postalCode: body.postalCode ? String(body.postalCode).trim() : undefined,
        city: body.city ? String(body.city).trim() : undefined,
        country: body.country ?? undefined,
        language: body.language ?? 'fr',
        notes: body.notes ?? undefined,
        companyName: body.companyName ? String(body.companyName).trim() : undefined,
        companyAddress: body.companyAddress ?? undefined,
        siret: body.siret ? String(body.siret).trim() : undefined,
        vatNumber: body.vatNumber ? String(body.vatNumber).trim() : undefined,
        legalForm: body.legalForm ? String(body.legalForm).trim() : undefined,
      },
    })
    await logBillingActivity(session.id, 'client created', 'client', client.id, { name: `${client.firstName} ${client.lastName}` })
    return NextResponse.json(client)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
