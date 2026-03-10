import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getBillingSettings, updateBillingSettings, parseExpenseCategories } from '@/lib/billing-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const settings = await getBillingSettings(session.id)
  const { expenseCategories: raw, ...rest } = settings
  return NextResponse.json({
    ...rest,
    expenseCategories: parseExpenseCategories(raw),
  })
}

export async function PUT(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const body = await req.json()
    await updateBillingSettings(session.id, {
      companyName: body.companyName,
      legalStatus: body.legalStatus,
      siret: body.siret,
      vatNumber: body.vatNumber,
      address: body.address,
      phone: body.phone,
      email: body.email,
      website: body.website,
      logoUrl: body.logoUrl,
      bankAccountHolder: body.bankAccountHolder,
      bankName: body.bankName,
      bankIban: body.bankIban,
      bankBic: body.bankBic,
      expenseCategories: Array.isArray(body.expenseCategories) ? body.expenseCategories : undefined,
    })
    const settings = await getBillingSettings(session.id)
    const { expenseCategories: raw, ...rest } = settings
    return NextResponse.json({
      ...rest,
      expenseCategories: parseExpenseCategories(raw),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
