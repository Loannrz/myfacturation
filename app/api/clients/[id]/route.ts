import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const client = await prisma.client.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
  })
  if (!client) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(client)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.client.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const type = body.type ?? existing.type
  const isLegal = ['professionnel', 'association', 'entreprise'].includes(type)
  if (isLegal) {
    const required: Record<string, string> = {
      companyName: 'Raison sociale',
      siret: 'SIRET',
      firstName: 'Prénom',
      lastName: 'Nom',
      email: 'Email',
      address: 'Adresse',
      postalCode: 'Code postal',
      city: 'Ville',
      country: 'Pays',
    }
    const missing = Object.entries(required).filter(([key]) => !(body[key] ?? existing[key as keyof typeof existing] ?? '').toString().trim())
    if (missing.length) {
      return NextResponse.json(
        { error: 'Champs obligatoires Factur-X : ' + missing.map(([, label]) => label).join(', ') },
        { status: 400 }
      )
    }
  } else {
    const required: (keyof typeof existing)[] = ['email', 'address', 'postalCode', 'city', 'country']
    const missing = required.filter((key) => !(body[key] ?? existing[key] ?? '').toString().trim())
    if (missing.length) {
      const labels: Record<string, string> = { email: 'Email', address: 'Adresse', postalCode: 'Code postal', city: 'Ville', country: 'Pays' }
      return NextResponse.json(
        { error: 'Champs obligatoires Factur-X : ' + missing.map((k) => labels[k as string]).join(', ') },
        { status: 400 }
      )
    }
  }
  const client = await prisma.client.update({
    where: { id },
    data: {
      type: body.type ?? existing.type,
      firstName: body.firstName ?? existing.firstName,
      lastName: body.lastName ?? existing.lastName,
      email: body.email ?? existing.email,
      phone: body.phone ?? undefined,
      address: body.address ?? undefined,
      postalCode: body.postalCode ?? undefined,
      city: body.city ?? undefined,
      country: body.country ?? undefined,
      language: body.language ?? existing.language,
      notes: body.notes ?? undefined,
      companyName: body.companyName ?? undefined,
      companyAddress: body.companyAddress ?? undefined,
      siret: body.siret ?? undefined,
      vatNumber: body.vatNumber ?? undefined,
      legalForm: body.legalForm ?? undefined,
    },
  })
  await logBillingActivity(session.id, 'client updated', 'client', client.id)
  return NextResponse.json(client)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.client.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } })
  await logBillingActivity(session.id, 'client deleted', 'client', id, { name: `${existing.firstName} ${existing.lastName}` })
  return NextResponse.json({ ok: true })
}
