import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

async function getAdmin() {
  const a = await requireAdmin()
  if (!a) return null
  return a
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const user = await prisma.user.findFirst({
    where: { id, role: 'user' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      subscriptionPlan: true,
      billingCycle: true,
      suspended: true,
      createdAt: true,
      _count: { select: { invoices: true, quotes: true, clients: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const { _count, ...rest } = user
  return NextResponse.json({
    ...rest,
    invoicesCount: _count.invoices,
    quotesCount: _count.quotes,
    clientsCount: _count.clients,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const user = await prisma.user.findFirst({ where: { id, role: 'user' } })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const body = await req.json()

  if (body.subscriptionPlan !== undefined) {
    const plan = ['starter', 'pro', 'business'].includes(body.subscriptionPlan) ? body.subscriptionPlan : undefined
    if (plan) {
      await prisma.user.update({
        where: { id },
        data: {
          subscriptionPlan: plan,
          planType: plan === 'starter' ? 'free' : 'premium',
          ...(body.billingCycle && { billingCycle: body.billingCycle }),
        },
      })
    }
  }
  if (body.suspended !== undefined && typeof body.suspended === 'boolean') {
    await prisma.user.update({
      where: { id },
      data: { suspended: body.suspended },
    })
  }
  if (body.email !== undefined && typeof body.email === 'string' && body.email.trim()) {
    const email = body.email.trim().toLowerCase()
    const existing = await prisma.user.findFirst({ where: { email, id: { not: id } } })
    if (existing) return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 400 })
    await prisma.user.update({
      where: { id },
      data: { email },
    })
  }
  if (body.newPassword !== undefined && typeof body.newPassword === 'string' && body.newPassword.length >= 8) {
    const hash = await bcrypt.hash(body.newPassword, 10)
    await prisma.user.update({
      where: { id },
      data: { passwordHash: hash, resetPasswordCode: null, resetPasswordCodeExp: null },
    })
  }

  const updated = await prisma.user.findFirst({
    where: { id },
    select: { id: true, name: true, email: true, subscriptionPlan: true, billingCycle: true, suspended: true },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const user = await prisma.user.findFirst({ where: { id, role: 'user' }, select: { email: true } })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const email = user.email?.trim().toLowerCase()
  if (email) {
    await prisma.deletedEmail.upsert({
      where: { email },
      create: { email },
      update: { deletedAt: new Date() },
    })
  }
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
