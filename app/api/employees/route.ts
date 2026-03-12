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

export async function GET(_req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const err = requireBusiness(session)
  if (err) return err
  const employees = await prisma.employee.findMany({
    where: { userId: session.id, ...whereNotDeleted },
    orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  })
  return NextResponse.json(employees)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const err = requireBusiness(session)
  if (err) return err
  try {
    const body = await req.json()
    const firstName = String(body.firstName ?? '').trim()
    const lastName = String(body.lastName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Nom, prénom et email sont obligatoires.' }, { status: 400 })
    }
    const employee = await prisma.employee.create({
      data: {
        userId: session.id,
        firstName,
        lastName,
        email,
        phone: body.phone ? String(body.phone).trim() : null,
        address: body.address ? String(body.address).trim() : null,
        city: body.city ? String(body.city).trim() : null,
        postalCode: body.postalCode ? String(body.postalCode).trim() : null,
        country: body.country ? String(body.country).trim() : null,
        position: body.position ? String(body.position).trim() : null,
        contractType: body.contractType ? String(body.contractType).trim() : null,
        hireDate: body.hireDate ? String(body.hireDate).trim().slice(0, 10) : null,
        status: body.status === 'inactive' ? 'inactive' : 'active',
        socialSecurityNumber: body.socialSecurityNumber ? String(body.socialSecurityNumber).trim() : null,
        internalNotes: body.internalNotes ? String(body.internalNotes).trim() : null,
      },
    })
    await logBillingActivity(session.id, 'employee created', 'employee', employee.id, { name: `${employee.firstName} ${employee.lastName}` })
    return NextResponse.json(employee)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
