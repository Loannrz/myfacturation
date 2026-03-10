import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type') ?? undefined
  const where: { userId: string; type?: string; OR?: { firstName?: { contains: string }; lastName?: { contains: string }; email?: { contains: string }; companyName?: { contains: string } }[] } = { userId: session.id }
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

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const body = await req.json()
    const client = await prisma.client.create({
      data: {
        userId: session.id,
        type: body.type ?? 'particulier',
        firstName: body.firstName ?? '',
        lastName: body.lastName ?? '',
        email: body.email ?? '',
        phone: body.phone ?? undefined,
        address: body.address ?? undefined,
        postalCode: body.postalCode ?? undefined,
        city: body.city ?? undefined,
        country: body.country ?? undefined,
        language: body.language ?? 'fr',
        notes: body.notes ?? undefined,
        companyName: body.companyName ?? undefined,
        companyAddress: body.companyAddress ?? undefined,
        siret: body.siret ?? undefined,
        vatNumber: body.vatNumber ?? undefined,
        legalForm: body.legalForm ?? undefined,
      },
    })
    await logBillingActivity(session.id, 'client created', 'client', client.id, { name: `${client.firstName} ${client.lastName}` })
    return NextResponse.json(client)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
