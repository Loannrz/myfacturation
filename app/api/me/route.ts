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
      image: true,
      planType: true,
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
    siret: settings?.siret ?? undefined,
    address: settings?.address ?? undefined,
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
    const data: { name?: string; image?: string } = {}
    if (typeof body.name === 'string') data.name = body.name.trim() || null
    if (typeof body.image === 'string') data.image = body.image
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
    })
    return NextResponse.json({ id: user.id, name: user.name, email: user.email, image: user.image })
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
