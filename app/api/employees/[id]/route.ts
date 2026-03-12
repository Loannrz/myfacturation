import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillingActivity } from '@/lib/billing-activity'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

function requireBusiness(session: { id: string; subscriptionPlan?: string }) {
  if (session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité réservée au plan Business' }, { status: 403 })
  }
  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const err = requireBusiness(session)
  if (err) return err
  const { id } = await params
  const employee = await prisma.employee.findFirst({
    where: { id, userId: session.id, ...whereNotDeleted },
    include: {
      expenses: { select: { id: true, date: true, amount: true, category: true, description: true }, orderBy: { date: 'desc' }, take: 50 },
    },
  })
  if (!employee) return NextResponse.json({ error: 'Salarié introuvable' }, { status: 404 })
  return NextResponse.json(employee)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const err = requireBusiness(session)
  if (err) return err
  const { id } = await params
  const existing = await prisma.employee.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Salarié introuvable' }, { status: 404 })
  const body = await req.json()
  const firstName = body.firstName !== undefined ? String(body.firstName).trim() : existing.firstName
  const lastName = body.lastName !== undefined ? String(body.lastName).trim() : existing.lastName
  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : existing.email
  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: 'Nom, prénom et email sont obligatoires.' }, { status: 400 })
  }
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone: body.phone !== undefined ? (body.phone ? String(body.phone).trim() : null) : undefined,
      address: body.address !== undefined ? (body.address ? String(body.address).trim() : null) : undefined,
      city: body.city !== undefined ? (body.city ? String(body.city).trim() : null) : undefined,
      postalCode: body.postalCode !== undefined ? (body.postalCode ? String(body.postalCode).trim() : null) : undefined,
      country: body.country !== undefined ? (body.country ? String(body.country).trim() : null) : undefined,
      position: body.position !== undefined ? (body.position ? String(body.position).trim() : null) : undefined,
      contractType: body.contractType !== undefined ? (body.contractType ? String(body.contractType).trim() : null) : undefined,
      hireDate: body.hireDate !== undefined ? (body.hireDate ? String(body.hireDate).trim().slice(0, 10) : null) : undefined,
      status: body.status === 'inactive' ? 'inactive' : body.status === 'active' ? 'active' : undefined,
      socialSecurityNumber: body.socialSecurityNumber !== undefined ? (body.socialSecurityNumber ? String(body.socialSecurityNumber).trim() : null) : undefined,
      internalNotes: body.internalNotes !== undefined ? (body.internalNotes ? String(body.internalNotes).trim() : null) : undefined,
    },
  })
  await logBillingActivity(session.id, 'employee updated', 'employee', employee.id, { name: `${employee.firstName} ${employee.lastName}` })
  return NextResponse.json(employee)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const err = requireBusiness(session)
  if (err) return err
  const { id } = await params
  const existing = await prisma.employee.findFirst({ where: { id, userId: session.id, ...whereNotDeleted } })
  if (!existing) return NextResponse.json({ error: 'Salarié introuvable' }, { status: 404 })
  await prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } })
  await logBillingActivity(session.id, 'employee deleted', 'employee', id, { name: `${existing.firstName} ${existing.lastName}` })
  return NextResponse.json({ ok: true })
}
