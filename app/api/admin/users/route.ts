import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

/** POST: créer un compte utilisateur (admin) */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  try {
    const body = await req.json()
    const email = (body.email as string)?.toLowerCase()?.trim()
    const password = body.password as string
    const name = (body.name as string)?.trim() || ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hash,
        emailVerified: new Date(),
        role: 'user',
        subscriptionPlan: 'starter',
        planType: 'free',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    })
    return NextResponse.json(user)
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  const where = {
    ...(search.trim()
      ? {
          OR: [
            { email: { contains: search.trim(), mode: 'insensitive' as const } },
            { name: { contains: search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionPlan: true,
        billingCycle: true,
        suspended: true,
        createdAt: true,
        _count: { select: { invoices: true, quotes: true, clients: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      plan: u.subscriptionPlan,
      billingCycle: u.billingCycle,
      suspended: u.suspended,
      createdAt: u.createdAt,
      invoicesCount: u._count.invoices,
      quotesCount: u._count.quotes,
      clientsCount: u._count.clients,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
