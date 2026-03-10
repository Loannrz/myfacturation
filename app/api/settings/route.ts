import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAccessFeatureByPlan, maxEstablishments, maxBankAccounts } from '@/lib/subscription'
import { getBillingSettings, updateBillingSettings, parseExpenseCategories, parseBankAccounts, parseEmitterProfiles } from '@/lib/billing-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const settings = await getBillingSettings(session.id)
  const { expenseCategories: raw, bankAccounts: rawBank, emitterProfiles: rawEmitter, ...rest } = settings
  const bankAccounts = parseBankAccounts(typeof rawBank === 'string' ? rawBank : null)
  const emitterProfiles = parseEmitterProfiles(typeof rawEmitter === 'string' ? rawEmitter : null)
  return NextResponse.json({
    ...rest,
    expenseCategories: parseExpenseCategories(raw),
    bankAccounts,
    emitterProfiles,
  })
}

export async function PUT(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const body = await req.json()
    const plan = (session as { user?: { subscriptionPlan?: 'starter' | 'pro' | 'business' } })?.user?.subscriptionPlan ?? 'starter'
    const canEditAdvanced = canAccessFeatureByPlan(plan, 'advancedSettings')
    const maxEst = maxEstablishments(plan)
    const maxBank = maxBankAccounts(plan)
    const emitterList = Array.isArray(body.emitterProfiles) ? body.emitterProfiles : []
    const bankList = Array.isArray(body.bankAccounts) ? body.bankAccounts : []
    const bankCount = bankList.filter((a: { name?: string; iban?: string }) => (a?.name ?? '').trim() || (a?.iban ?? '').trim()).length
    if (emitterList.length > maxEst) {
      return NextResponse.json(
        { error: `Limite de ${maxEst} établissement(s) pour votre formule. Passez à Pro (2) ou Business (10).` },
        { status: 400 }
      )
    }
    if (bankCount > maxBank) {
      return NextResponse.json(
        { error: `Limite de ${maxBank} compte(s) bancaire(s) pour votre formule. Passez à Pro (2) ou Business (10).` },
        { status: 400 }
      )
    }
    await updateBillingSettings(session.id, {
      companyName: body.companyName,
      legalStatus: body.legalStatus,
      siret: body.siret,
      vatNumber: body.vatNumber,
      apeCode: body.apeCode,
      address: body.address,
      postalCode: body.postalCode,
      city: body.city,
      country: body.country,
      phone: body.phone,
      email: body.email,
      website: body.website,
      logoUrl: body.logoUrl,
      bankAccountHolder: body.bankAccountHolder,
      bankName: body.bankName,
      bankIban: body.bankIban,
      bankBic: body.bankBic,
      bankAccounts: Array.isArray(body.bankAccounts) ? body.bankAccounts : undefined,
      emitterProfiles: Array.isArray(body.emitterProfiles) ? body.emitterProfiles : undefined,
      expenseCategories: Array.isArray(body.expenseCategories) ? body.expenseCategories : undefined,
      invoiceNumberMiddle: canEditAdvanced ? body.invoiceNumberMiddle : undefined,
      invoiceNumberFormat: canEditAdvanced ? body.invoiceNumberFormat : undefined,
      invoicePrefix: canEditAdvanced ? body.invoicePrefix : undefined,
      quoteNumberMiddle: canEditAdvanced ? body.quoteNumberMiddle : undefined,
      quoteNumberFormat: canEditAdvanced ? body.quoteNumberFormat : undefined,
      quotePrefix: canEditAdvanced ? body.quotePrefix : undefined,
      creditNumberMiddle: canEditAdvanced ? body.creditNumberMiddle : undefined,
      creditNumberFormat: canEditAdvanced ? body.creditNumberFormat : undefined,
      creditNotePrefix: canEditAdvanced ? body.creditNotePrefix : undefined,
      defaultPaymentMethod: canEditAdvanced ? body.defaultPaymentMethod : undefined,
      defaultPaymentTerms: canEditAdvanced ? body.defaultPaymentTerms : undefined,
      legalPenaltiesText: canEditAdvanced ? body.legalPenaltiesText : undefined,
      legalRecoveryFeeText: canEditAdvanced ? body.legalRecoveryFeeText : undefined,
    })
    const settings = await getBillingSettings(session.id)
    const { expenseCategories: raw, bankAccounts: rawBank, emitterProfiles: rawEmitter, ...rest } = settings
    const bankAccounts = parseBankAccounts(typeof rawBank === 'string' ? rawBank : null)
    const emitterProfiles = parseEmitterProfiles(typeof rawEmitter === 'string' ? rawEmitter : null)
    return NextResponse.json({
      ...rest,
      expenseCategories: parseExpenseCategories(raw),
      bankAccounts,
      emitterProfiles,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
