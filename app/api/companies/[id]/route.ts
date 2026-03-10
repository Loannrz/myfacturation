import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const company = await prisma.company.findFirst({
    where: { id, userId: session.id },
  })
  if (!company) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(company)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.company.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json()
  const company = await prisma.company.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
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
  await logBillingActivity(session.id, 'company updated', 'company', company.id)
  return NextResponse.json(company)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.company.findFirst({ where: { id, userId: session.id } })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.company.delete({ where: { id } })
  await logBillingActivity(session.id, 'company deleted', 'company', id)
  return NextResponse.json({ ok: true })
}
