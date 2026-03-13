import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAccessFeatureByPlan, maxEstablishments, maxBankAccounts } from '@/lib/subscription'
import { getBillingSettings, updateBillingSettings, parseExpenseCategories, parseBankAccounts, parseEmitterProfiles } from '@/lib/billing-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
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
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'Session invalide ou compte supprimé. Reconnectez-vous.' }, { status: 401 })
    }
    throw err
  }
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
    const missing: string[] = []
    emitterList.forEach((ep: { name?: string; companyName?: string; legalStatus?: string; siret?: string; address?: string; postalCode?: string; city?: string; country?: string; vatNumber?: string; email?: string; vatExempt?: boolean; vatExemptionReason?: string }, i: number) => {
      const label = emitterList.length > 1 ? `Établissement ${i + 1}` : 'Établissement'
      if (!(ep.name ?? '').toString().trim()) missing.push(`${label} : Nom de l'établissement`)
      if (!(ep.companyName ?? '').toString().trim()) missing.push(`${label} : Raison sociale`)
      if (!(ep.legalStatus ?? '').toString().trim()) missing.push(`${label} : Forme juridique`)
      if (!(ep.siret ?? '').toString().trim()) missing.push(`${label} : SIRET`)
      if (!(ep.address ?? '').toString().trim()) missing.push(`${label} : Adresse`)
      if (!(ep.postalCode ?? '').toString().trim()) missing.push(`${label} : Code postal`)
      if (!(ep.city ?? '').toString().trim()) missing.push(`${label} : Ville`)
      if (!(ep.country ?? '').toString().trim()) missing.push(`${label} : Pays`)
      if (!(ep.email ?? '').toString().trim()) missing.push(`${label} : Email`)
      const vatExempt = !!ep.vatExempt
      if (!vatExempt && !(ep.vatNumber ?? '').toString().trim()) missing.push(`${label} : N° TVA (obligatoire si assujetti)`)
      if (vatExempt && !(ep.vatExemptionReason ?? '').toString().trim()) missing.push(`${label} : Motif d'exonération (obligatoire si non assujetti)`)
    })
    let hasCompleteBank = false
    bankList.forEach((a: { name?: string; accountHolder?: string; bankName?: string; iban?: string; bic?: string }, i: number) => {
      const hasAny = (a?.name ?? '').toString().trim() || (a?.accountHolder ?? '').toString().trim() || (a?.bankName ?? '').toString().trim() || (a?.iban ?? '').toString().trim() || (a?.bic ?? '').toString().trim()
      if (!hasAny) return
      const label = bankList.length > 1 ? `Compte ${i + 1}` : 'Compte bancaire'
      const accountMissing: string[] = []
      if (!(a?.name ?? '').toString().trim()) accountMissing.push('Nom du compte')
      if (!(a?.accountHolder ?? '').toString().trim()) accountMissing.push('Titulaire')
      if (!(a?.bankName ?? '').toString().trim()) accountMissing.push('Banque')
      if (!(a?.iban ?? '').toString().trim()) accountMissing.push('IBAN')
      if (!(a?.bic ?? '').toString().trim()) accountMissing.push('BIC')
      if (accountMissing.length) missing.push(`${label} : ${accountMissing.join(', ')}`)
      else hasCompleteBank = true
    })
    if (!hasCompleteBank) missing.push('Au moins un compte bancaire complet (Nom, Titulaire, Banque, IBAN, BIC)')
    if (missing.length) {
      return NextResponse.json(
        { error: 'Champs obligatoires Factur-X manquants : ' + missing.join(', ') },
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
      vatApplicable: body.vatApplicable !== undefined ? !!body.vatApplicable : undefined,
      vatExemptionReason: body.vatExemptionReason !== undefined ? (body.vatExemptionReason || null) : undefined,
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
