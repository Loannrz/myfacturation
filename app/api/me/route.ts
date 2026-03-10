import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      planType: true,
      subscriptionPlan: true,
      billingCycle: true,
      emailVerified: true,
    },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  const settings = await prisma.billingSettings.findUnique({
    where: { userId: user.id },
  })
  return NextResponse.json({
    ...user,
    companyName: settings?.companyName ?? undefined,
    legalStatus: settings?.legalStatus ?? undefined,
    siret: settings?.siret ?? undefined,
    address: settings?.address ?? undefined,
    postalCode: settings?.postalCode ?? undefined,
    city: settings?.city ?? undefined,
    logoUrl: settings?.logoUrl ?? undefined,
  })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const data: { name?: string | null; image?: string | null; phone?: string | null } = {}
    if (typeof body.name === 'string') data.name = body.name.trim() || null
    if (typeof body.image === 'string') data.image = body.image
    if (typeof body.phone === 'string') data.phone = body.phone.trim() || null
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
    })
    return NextResponse.json({ id: user.id, name: user.name, email: user.email, phone: user.phone ?? undefined, image: user.image })
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
