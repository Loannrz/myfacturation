'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, Sparkles, Lock, AlertCircle } from 'lucide-react'
import { planLabel, canAccessFeatureByPlan, maxEstablishments, maxBankAccounts } from '@/lib/subscription'

type BankAccountEntry = { id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }
type EmitterProfileEntry = { id: string; name: string; companyName: string; legalStatus: string; siret: string; vatNumber?: string; vatExempt?: boolean; vatExemptionReason?: string; apeCode?: string; address: string; postalCode: string; city: string; country?: string; phone?: string; email?: string; website?: string }

const PLACEHOLDER_ACCOUNT_HOLDER = 'Dupont Michel'

function newBankAccount(): BankAccountEntry {
  return { id: crypto.randomUUID(), name: '', accountHolder: '', bankName: '', iban: '', bic: '' }
}

function newEmitterProfile(): EmitterProfileEntry {
  return { id: crypto.randomUUID(), name: '', companyName: '', legalStatus: '', siret: '', address: '', postalCode: '', city: '', vatExempt: false }
}

const LEGAL_FORMS = [
  'Auto-entreprise / Micro-entreprise',
  'Association',
  'SARL',
  'SAS',
  'SASU',
  'SA',
  'EURL',
  'EI',
  'EIRL',
  'SCI',
  'SEL',
  'SCOP',
  'Autre',
]

// Un seul chargement initial par onglet : évite la boucle même si le composant remonte (Strict Mode, layout, etc.)
let parametresInitialFetchDone = false
let parametresResetTimeoutId: ReturnType<typeof setTimeout> | null = null
let parametresCachedResult: { user: Record<string, unknown>; settings: Record<string, unknown> } | null = null

export default function ParametresPage() {
  const [profile, setProfile] = useState<{
    name?: string
    email?: string
    phone?: string
  } | null>(null)
  const [emitterProfiles, setEmitterProfiles] = useState<EmitterProfileEntry[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountEntry[]>([])
  const [invoiceNumberMiddle, setInvoiceNumberMiddle] = useState('')
  const [invoiceNumberFormat, setInvoiceNumberFormat] = useState<string>('sequential')
  const [quoteNumberMiddle, setQuoteNumberMiddle] = useState('')
  const [quoteNumberFormat, setQuoteNumberFormat] = useState<string>('sequential')
  const [creditNumberMiddle, setCreditNumberMiddle] = useState('')
  const [creditNumberFormat, setCreditNumberFormat] = useState<string>('sequential')
  const [invoicePrefix, setInvoicePrefix] = useState('F')
  const [quotePrefix, setQuotePrefix] = useState('D')
  const [creditNotePrefix, setCreditNotePrefix] = useState('A')
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('')
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('')
  const [legalPenaltiesText, setLegalPenaltiesText] = useState('')
  const [legalRecoveryFeeText, setLegalRecoveryFeeText] = useState('')
  const [vatExemptionReasonDefault, setVatExemptionReasonDefault] = useState('TVA non applicable – article 293 B du CGI')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  /** Email du compte (affiché par défaut, mis à jour après changement d'email) */
  const [accountEmail, setAccountEmail] = useState('')

  // Changer d'email
  const [newEmail, setNewEmail] = useState('')
  const [changeEmailCode, setChangeEmailCode] = useState('')
  const [changeEmailStep, setChangeEmailStep] = useState<'idle' | 'code_sent'>('idle')
  const [changeEmailLoading, setChangeEmailLoading] = useState(false)
  const [changeEmailMessage, setChangeEmailMessage] = useState('')
  const [changeEmailCodeDisplay, setChangeEmailCodeDisplay] = useState<string | null>(null)
  const [subscriptionPlan, setSubscriptionPlan] = useState<'starter' | 'pro' | 'business'>('starter')
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null)
  const [cancelSubscriptionLoading, setCancelSubscriptionLoading] = useState(false)
  const searchParams = useSearchParams()
  const { data: session, update: updateSession } = useSession()
  const initialEffectRuns = useRef(0)
  const visibilityHandlerRuns = useRef(0)
  const lastSyncedPlanRef = useRef<string | null>(null)

  const syncPlanFromUser = useCallback((user: { subscriptionPlan?: string; billingCycle?: string | null; email?: string; name?: string; phone?: string }) => {
    const plan = user.subscriptionPlan ?? 'starter'
    const planVal = plan === 'pro' || plan === 'business' ? plan : 'starter'
    setSubscriptionPlan(planVal)
    updateSession?.({ subscriptionPlan: planVal, billingCycle: user.billingCycle ?? null }).catch(() => {})
    const email = user.email ?? ''
    setAccountEmail(email)
    setProfile({
      name: user.name ?? '',
      email,
      phone: user.phone ?? '',
    })
  }, [updateSession])

  const applyMeAndSettings = useCallback((user: Record<string, unknown>, settings: Record<string, unknown>) => {
    const plan = (user.subscriptionPlan as string) ?? 'starter'
    const planVal = (plan === 'pro' || plan === 'business' ? plan : 'starter') as 'starter' | 'pro' | 'business'
    setSubscriptionPlan(planVal)
    lastSyncedPlanRef.current = planVal
    setStripeSubscriptionId((user.stripeSubscriptionId as string) ?? null)
    setSubscriptionStatus((user.subscriptionStatus as string) ?? null)
    setSubscriptionEnd(user.subscriptionEnd != null ? (typeof user.subscriptionEnd === 'string' ? user.subscriptionEnd : new Date((user.subscriptionEnd as Date).getTime()).toISOString()) : null)
    setAccountEmail((user.email as string) ?? '')
    setProfile({ name: (user.name as string) ?? '', email: (user.email as string) ?? '', phone: (user.phone as string) ?? '' })
    const emitters = Array.isArray(settings.emitterProfiles) ? settings.emitterProfiles : []
    const defaultReason = (settings.vatExemptionReason as string) ?? 'TVA non applicable – article 293 B du CGI'
    if (emitters.length > 0) {
      setEmitterProfiles(emitters.map((e: EmitterProfileEntry) => ({
        ...newEmitterProfile(),
        ...e,
        id: (e.id as string) || crypto.randomUUID(),
        vatExempt: e.vatExempt ?? false,
        vatExemptionReason: e.vatExempt ? (e.vatExemptionReason ?? defaultReason) : undefined,
      })))
    } else if (settings.companyName || settings.siret) {
      setEmitterProfiles([{ ...newEmitterProfile(), name: 'Établissement principal', companyName: (settings.companyName as string) ?? '', legalStatus: (settings.legalStatus as string) ?? '', siret: (settings.siret as string) ?? '', address: (settings.address as string) ?? '', postalCode: (settings.postalCode as string) ?? '', city: (settings.city as string) ?? '' }])
    }
    const accounts = Array.isArray(settings.bankAccounts) ? settings.bankAccounts : []
    setBankAccounts(accounts.length > 0 ? accounts.map((a: BankAccountEntry) => ({ ...newBankAccount(), ...a, id: (a.id as string) || crypto.randomUUID() })) : [])
    setInvoiceNumberMiddle((settings.invoiceNumberMiddle as string) ?? '')
    setInvoiceNumberFormat((settings.invoiceNumberFormat as string) ?? 'sequential')
    setQuoteNumberMiddle((settings.quoteNumberMiddle as string) ?? '')
    setQuoteNumberFormat((settings.quoteNumberFormat as string) ?? 'sequential')
    setCreditNumberMiddle((settings.creditNumberMiddle as string) ?? '')
    setCreditNumberFormat((settings.creditNumberFormat as string) ?? 'sequential')
    setInvoicePrefix((settings.invoicePrefix as string) ?? 'F')
    setQuotePrefix((settings.quotePrefix as string) ?? 'D')
    setCreditNotePrefix((settings.creditNotePrefix as string) ?? 'A')
    setDefaultPaymentMethod((settings.defaultPaymentMethod as string) ?? '')
    const terms = (settings.defaultPaymentTerms as string) ?? ''
    const termsMatch = ['15 jours', '30 jours', '60 jours', '90 jours'].find((t) => terms.includes(t.split(' ')[0]))
    setDefaultPaymentTerms(termsMatch ?? '')
    setLegalPenaltiesText((settings.legalPenaltiesText as string) ?? '')
    setLegalRecoveryFeeText((settings.legalRecoveryFeeText as string) ?? '')
    setVatExemptionReasonDefault((settings.vatExemptionReason as string) ?? 'TVA non applicable – article 293 B du CGI')
  }, [])

  useEffect(() => {
    if (parametresResetTimeoutId) {
      clearTimeout(parametresResetTimeoutId)
      parametresResetTimeoutId = null
    }
    if (parametresInitialFetchDone && parametresCachedResult) {
      applyMeAndSettings(parametresCachedResult.user, parametresCachedResult.settings)
      return
    }
    if (parametresInitialFetchDone && !parametresCachedResult) {
      parametresInitialFetchDone = false
    }
    if (parametresInitialFetchDone) return
    parametresInitialFetchDone = true
    let cancelled = false
    Promise.all([fetch('/api/me').then((r) => r.json()), fetch('/api/settings').then((r) => r.json())])
      .then(([user, settings]) => {
        if (cancelled) return
        parametresCachedResult = { user: user as Record<string, unknown>, settings: settings as Record<string, unknown> }
        applyMeAndSettings(user as Record<string, unknown>, settings as Record<string, unknown>)
      })
      .catch(() => { if (!cancelled) setProfile({}) })
    return () => {
      cancelled = true
      parametresResetTimeoutId = setTimeout(() => {
        parametresInitialFetchDone = false
        parametresCachedResult = null
        parametresResetTimeoutId = null
      }, 150)
    }
    // Chargement initial une seule fois au montage pour éviter une boucle (updateSession peut changer après mise à jour)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onVisible = () => {
      visibilityHandlerRuns.current += 1
      fetch('/api/me')
        .then((r) => r.json())
        .then((user) => {
          const plan = user.subscriptionPlan ?? 'starter'
          const planVal = plan === 'pro' || plan === 'business' ? plan : 'starter'
          setSubscriptionPlan(planVal)
          if (planVal !== lastSyncedPlanRef.current) {
            lastSyncedPlanRef.current = planVal
            updateSession?.({ subscriptionPlan: planVal, billingCycle: user.billingCycle ?? null }).catch(() => {})
          }
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [updateSession])

  useEffect(() => {
    const upgraded = searchParams.get('upgraded')
    const resilie = searchParams.get('resilie')
    if (upgraded === 'pro' || upgraded === 'business') {
      setSubscriptionPlan(upgraded)
      setMessage('Formule mise à jour.')
    }
    if (resilie === '1') {
      setMessage('Abonnement résilié. Vous gardez l’accès jusqu’à la fin de la période payée.')
      fetch('/api/me')
        .then((r) => r.json())
        .then((user: Record<string, unknown>) => {
          setSubscriptionPlan((user.subscriptionPlan === 'pro' || user.subscriptionPlan === 'business' ? user.subscriptionPlan : 'starter') as 'starter' | 'pro' | 'business')
          setStripeSubscriptionId((user.stripeSubscriptionId as string) ?? null)
          setSubscriptionStatus((user.subscriptionStatus as string) ?? null)
          setSubscriptionEnd(user.subscriptionEnd != null ? (typeof user.subscriptionEnd === 'string' ? user.subscriptionEnd : new Date((user.subscriptionEnd as Date).getTime()).toISOString()) : null)
        })
        .catch(() => {})
    }
  }, [searchParams])

  useEffect(() => {
    if (!profile) return
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1).toLowerCase() : ''
    if (hash === 'etablissements' || hash === 'coordonnees-bancaires' || hash === 'requis') {
      const id = hash === 'requis' ? 'etablissements' : hash
      const el = document.getElementById(id)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [profile])

  const persistSettings = async (
    profiles: typeof emitterProfiles,
    accounts: typeof bankAccounts,
    numberSettings?: { invoiceNumberMiddle: string; invoiceNumberFormat: string; quoteNumberMiddle: string; quoteNumberFormat: string; creditNumberMiddle: string; creditNumberFormat: string; invoicePrefix: string; quotePrefix: string; creditNotePrefix: string },
    paymentAndLegal?: { defaultPaymentMethod: string; defaultPaymentTerms: string; legalPenaltiesText: string; legalRecoveryFeeText: string; logoUrl: string; vatApplicable?: boolean; vatExemptionReason?: string }
  ) => {
    const body: Record<string, unknown> = {
      emitterProfiles: profiles.map((e) => ({ ...e, vatNumber: e.vatExempt ? undefined : (e.vatNumber || undefined), vatExempt: e.vatExempt ?? false, vatExemptionReason: e.vatExempt ? (e.vatExemptionReason || undefined) : undefined, apeCode: e.apeCode || undefined, country: e.country || undefined, phone: e.phone || undefined, email: e.email || undefined, website: e.website || undefined })),
      bankAccounts: accounts.filter((a) => a.name.trim() || a.iban.trim()),
    }
    if (paymentAndLegal?.vatApplicable !== undefined) body.vatApplicable = paymentAndLegal.vatApplicable
    if (paymentAndLegal?.vatExemptionReason !== undefined) body.vatExemptionReason = paymentAndLegal.vatExemptionReason || null
    if (numberSettings) {
      body.invoiceNumberMiddle = numberSettings.invoiceNumberMiddle.slice(0, 6).replace(/[^a-zA-Z0-9]/g, '')
      body.invoiceNumberFormat = numberSettings.invoiceNumberFormat
      body.quoteNumberMiddle = numberSettings.quoteNumberMiddle.slice(0, 6).replace(/[^a-zA-Z0-9]/g, '')
      body.quoteNumberFormat = numberSettings.quoteNumberFormat
      body.creditNumberMiddle = numberSettings.creditNumberMiddle.slice(0, 6).replace(/[^a-zA-Z0-9]/g, '')
      body.creditNumberFormat = numberSettings.creditNumberFormat
      body.invoicePrefix = numberSettings.invoicePrefix.trim().slice(0, 4) || 'F'
      body.quotePrefix = numberSettings.quotePrefix.trim().slice(0, 4) || 'D'
      body.creditNotePrefix = numberSettings.creditNotePrefix.trim().slice(0, 4) || 'A'
    }
    if (paymentAndLegal) {
      body.defaultPaymentMethod = paymentAndLegal.defaultPaymentMethod || undefined
      body.defaultPaymentTerms = paymentAndLegal.defaultPaymentTerms || undefined
      body.legalPenaltiesText = paymentAndLegal.legalPenaltiesText || undefined
      body.legalRecoveryFeeText = paymentAndLegal.legalRecoveryFeeText || undefined
      body.logoUrl = paymentAndLegal.logoUrl !== undefined ? paymentAndLegal.logoUrl : undefined
    }
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || 'Erreur')
    }
  }

  const validateSettingsFacturX = (): string | null => {
    const missing: string[] = []
    for (let i = 0; i < emitterProfiles.length; i++) {
      const ep = emitterProfiles[i]
      const label = emitterProfiles.length > 1 ? `Établissement ${i + 1}` : 'Établissement'
      if (!(ep.name ?? '').trim()) missing.push(`${label} : Nom de l'établissement`)
      if (!(ep.companyName ?? '').trim()) missing.push(`${label} : Raison sociale`)
      if (!(ep.legalStatus ?? '').trim()) missing.push(`${label} : Forme juridique`)
      if (!(ep.siret ?? '').trim()) missing.push(`${label} : SIRET`)
      if (!(ep.address ?? '').trim()) missing.push(`${label} : Adresse`)
      if (!(ep.postalCode ?? '').trim()) missing.push(`${label} : Code postal`)
      if (!(ep.city ?? '').trim()) missing.push(`${label} : Ville`)
      if (!(ep.country ?? '').trim()) missing.push(`${label} : Pays`)
      if (!(ep.email ?? '').trim()) missing.push(`${label} : Email`)
      const vatExempt = !!ep.vatExempt
      if (!vatExempt && !(ep.vatNumber ?? '').trim()) missing.push(`${label} : N° TVA (obligatoire si assujetti)`)
      if (vatExempt && !(ep.vatExemptionReason ?? '').trim()) missing.push(`${label} : Motif d'exonération (obligatoire si non assujetti)`)
    }
    let hasCompleteBank = false
    bankAccounts.forEach((a, i) => {
      const hasAny = (a.name ?? '').trim() || (a.accountHolder ?? '').trim() || (a.bankName ?? '').trim() || (a.iban ?? '').trim() || (a.bic ?? '').trim()
      if (!hasAny) return
      const label = bankAccounts.length > 1 ? `Compte ${i + 1}` : 'Compte bancaire'
      const accountMissing: string[] = []
      if (!(a.name ?? '').trim()) accountMissing.push('Nom du compte')
      if (!(a.accountHolder ?? '').trim()) accountMissing.push('Titulaire')
      if (!(a.bankName ?? '').trim()) accountMissing.push('Banque')
      if (!(a.iban ?? '').trim()) accountMissing.push('IBAN')
      if (!(a.bic ?? '').trim()) accountMissing.push('BIC')
      if (accountMissing.length) missing.push(`${label} : ${accountMissing.join(', ')}`)
      else hasCompleteBank = true
    })
    if (!hasCompleteBank) missing.push('Au moins un compte bancaire complet (Nom, Titulaire, Banque, IBAN, BIC)')
    if (missing.length) return 'Champs obligatoires manquants : ' + missing.join('. ')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    const validationError = validateSettingsFacturX()
    if (validationError) {
      setMessage(validationError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, phone: profile.phone }),
      })
      await persistSettings(emitterProfiles, bankAccounts, {
        invoiceNumberMiddle,
        invoiceNumberFormat,
        quoteNumberMiddle,
        quoteNumberFormat,
        creditNumberMiddle,
        creditNumberFormat,
        invoicePrefix,
        quotePrefix,
        creditNotePrefix,
      }, {
        defaultPaymentMethod,
        defaultPaymentTerms,
        legalPenaltiesText,
        legalRecoveryFeeText,
        logoUrl: '',
        vatApplicable: emitterProfiles.some((p) => !p.vatExempt),
        vatExemptionReason: emitterProfiles.find((p) => p.vatExempt)?.vatExemptionReason ?? vatExemptionReasonDefault,
      })
      setMessage('Paramètres enregistrés.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setSaving(false)
  }

  const numSettings = () => ({ invoiceNumberMiddle, invoiceNumberFormat, quoteNumberMiddle, quoteNumberFormat, creditNumberMiddle, creditNumberFormat, invoicePrefix, quotePrefix, creditNotePrefix })
  const payLegal = () => ({ defaultPaymentMethod, defaultPaymentTerms, legalPenaltiesText, legalRecoveryFeeText, logoUrl: '', vatApplicable: emitterProfiles.some((p) => !p.vatExempt), vatExemptionReason: emitterProfiles.find((p) => p.vatExempt)?.vatExemptionReason ?? vatExemptionReasonDefault })

  const removeEstablishment = (ep: EmitterProfileEntry) => {
    const next = emitterProfiles.filter((e) => e.id !== ep.id)
    setEmitterProfiles(next)
    persistSettings(next, bankAccounts, numSettings(), payLegal())
      .then(() => setMessage('Établissement supprimé.'))
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Erreur lors de la suppression.'))
  }

  const removeBankAccount = (acc: BankAccountEntry) => {
    const next = bankAccounts.filter((a) => a.id !== acc.id)
    setBankAccounts(next)
    persistSettings(emitterProfiles, next, numSettings(), payLegal())
      .then(() => setMessage('Compte supprimé.'))
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Erreur lors de la suppression.'))
  }

  const handleRequestChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) return
    setChangeEmailLoading(true)
    setChangeEmailMessage('')
    try {
      const res = await fetch('/api/auth/request-change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setChangeEmailMessage(data.error || 'Erreur')
      } else {
        setChangeEmailStep('code_sent')
        setChangeEmailCodeDisplay(data.verificationCode ?? null)
        setChangeEmailMessage(data.message || 'Code envoyé.')
      }
    } catch {
      setChangeEmailMessage('Erreur réseau')
    }
    setChangeEmailLoading(false)
  }

  const handleConfirmChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeEmailLoading(true)
    setChangeEmailMessage('')
    try {
      const res = await fetch('/api/auth/confirm-change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: changeEmailCode.replace(/\D/g, '').slice(0, 6) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setChangeEmailMessage(data.error || 'Erreur')
      } else {
        setChangeEmailStep('idle')
        setNewEmail('')
        setChangeEmailCode('')
        setChangeEmailCodeDisplay(null)
        setChangeEmailMessage('Adresse email mise à jour. Rechargez la page.')
        const updated = newEmail.trim().toLowerCase()
        setAccountEmail(updated)
        if (profile) setProfile({ ...profile, email: updated })
      }
    } catch {
      setChangeEmailMessage('Erreur réseau')
    }
    setChangeEmailLoading(false)
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
      </div>
    )
  }

  const canEditAdvancedSettings = canAccessFeatureByPlan(subscriptionPlan, 'advancedSettings')
  const maxEstablishmentsPlan = maxEstablishments(subscriptionPlan)
  const maxBankAccountsPlan = maxBankAccounts(subscriptionPlan)

  const needsEstablishment = emitterProfiles.length === 0 || (emitterProfiles.length > 0 && !(emitterProfiles[0].companyName?.trim() && emitterProfiles[0].siret?.trim()))
  const needsBank = bankAccounts.length === 0

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Profil et informations pour vos factures</p>
      </div>

      {/* Formule actuelle */}
      <div className="border border-[var(--border)] rounded-xl p-6 mb-6 bg-[var(--background)]">
        <h2 className="text-sm font-medium text-[var(--foreground)] mb-2 flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Formule actuelle : {planLabel(subscriptionPlan)}
          </span>
          {(subscriptionPlan === 'pro' || subscriptionPlan === 'business') && subscriptionStatus === 'cancelled' && subscriptionEnd && (() => {
            const end = new Date(subscriptionEnd)
            const now = new Date()
            now.setHours(0, 0, 0, 0)
            end.setHours(0, 0, 0, 0)
            const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
            const dateStr = end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            return (
              <span className="text-[var(--muted)] font-normal text-xs sm:text-sm">
                — Se terminant dans {daysLeft} jour{daysLeft !== 1 ? 's' : ''} (le {dateStr})
              </span>
            )
          })()}
        </h2>
        {subscriptionPlan === 'starter' && (
          <>
            <p className="text-sm text-[var(--muted)] mb-4">Vous utilisez actuellement la formule gratuite.</p>
            <Link href="/formules" className="inline-flex px-4 py-2 rounded-lg border border-[var(--border)] font-medium text-sm hover:bg-[var(--border)]/20">
              Voir toutes les formules
            </Link>
          </>
        )}
        {subscriptionPlan === 'pro' && (
          <>
            <p className="text-sm text-[var(--muted)] mb-4">Accès aux produits, avoirs, dépenses et comptabilité.</p>
            <Link href="/formules" className="inline-flex px-4 py-2 rounded-lg border border-[var(--border)] font-medium text-sm hover:bg-[var(--border)]/20">
              Voir toutes les formules
            </Link>
          </>
        )}
        {subscriptionPlan === 'business' && (
          <p className="text-sm text-[var(--muted)]">Toutes les fonctionnalités sont débloquées.</p>
        )}
        <div className="mt-4">
          <button
            type="button"
            onClick={async () => {
              const isTrialing = subscriptionStatus === 'trialing'
              const hasStripe = !!stripeSubscriptionId
              const isPaid = subscriptionPlan === 'pro' || subscriptionPlan === 'business'
              const msg = !isPaid
                ? 'Confirmer : vous n’avez pas d’abonnement actif. Vous restez en Starter (aucun prélèvement).'
                : !hasStripe || isTrialing
                  ? 'Résilier votre abonnement ? Vous repasserez sur la formule Starter immédiatement.'
                  : 'Résilier votre abonnement ? Vous repasserez sur la formule Starter à la fin de la période déjà payée.'
              if (!confirm(msg)) return
              setCancelSubscriptionLoading(true)
              try {
                const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' })
                const data = await res.json()
                if (data.ok) {
                  setMessage(data.message || 'Abonnement résilié.')
                  const meRes = await fetch('/api/me')
                  const meData = await meRes.json().catch(() => ({}))
                  const planVal = (meData.subscriptionPlan === 'pro' || meData.subscriptionPlan === 'business' ? meData.subscriptionPlan : 'starter') as 'starter' | 'pro' | 'business'
                  setSubscriptionPlan(planVal)
                  setStripeSubscriptionId(meData.stripeSubscriptionId ?? null)
                  setSubscriptionStatus(meData.subscriptionStatus ?? null)
                  setSubscriptionEnd(meData.subscriptionEnd != null ? (typeof meData.subscriptionEnd === 'string' ? meData.subscriptionEnd : new Date(meData.subscriptionEnd).toISOString()) : null)
                  if (planVal === 'starter') lastSyncedPlanRef.current = 'starter'
                  updateSession?.({ subscriptionPlan: planVal }).catch(() => {})
                } else {
                  setMessage(data.error || 'Erreur')
                }
              } catch {
                setMessage('Erreur lors de la résiliation.')
              } finally {
                setCancelSubscriptionLoading(false)
              }
            }}
            disabled={cancelSubscriptionLoading}
            className="inline-flex px-4 py-2 rounded-lg border border-red-500/50 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-500/10 disabled:opacity-50"
          >
            {cancelSubscriptionLoading ? 'Résiliation…' : 'Résilier l’abonnement'}
          </button>
        </div>
        <p className="text-sm text-[var(--muted)] mt-4">
          <Link href="/settings/billing" className="text-violet-600 dark:text-violet-400 hover:underline">
            Facturation & abonnement
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <p className={`text-sm ${message.startsWith('Erreur') || message.startsWith('Champs obligatoires') || message.startsWith('Veuillez') || message.startsWith('Limite') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {message}
          </p>
        )}

        <div className="border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-medium mb-4">Profil</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm text-[var(--muted)] mb-1">
                Nom
              </label>
              <input
                id="name"
                type="text"
                value={profile.name ?? ''}
                onChange={(e) => setProfile((p) => (p ? { ...p, name: e.target.value } : p))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm text-[var(--muted)] mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={(accountEmail || profile?.email) ?? ''}
                readOnly
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
              />
              <p className="text-xs text-[var(--muted)] mt-1">Pour changer d&apos;email, utilisez le bloc ci-dessous.</p>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm text-[var(--muted)] mb-1">
                Téléphone
              </label>
              <input
                id="phone"
                type="tel"
                value={profile.phone ?? ''}
                onChange={(e) => setProfile((p) => (p ? { ...p, phone: e.target.value } : p))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                placeholder="06 12 34 56 78"
              />
            </div>

            <div className="pt-4 border-t border-[var(--border)]">
              <h3 className="text-sm font-medium mb-2">Changer d&apos;email</h3>
              <p className="text-xs text-[var(--muted)] mb-3">
                Un code sera envoyé à la nouvelle adresse. Une fois le code validé, le compte sera transféré sur cette adresse.
              </p>
              {changeEmailMessage && (
                <p className={`text-sm mb-2 ${changeEmailMessage.includes('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
                  {changeEmailMessage}
                </p>
              )}
              {changeEmailStep === 'idle' ? (
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Nouvelle adresse email"
                    className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                  />
                  <button
                    type="button"
                    onClick={handleRequestChangeEmail}
                    disabled={changeEmailLoading || !newEmail.trim()}
                    className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium disabled:opacity-50"
                  >
                    {changeEmailLoading ? 'Envoi…' : 'Envoyer le code'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {changeEmailCodeDisplay && (
                    <p className="text-sm p-2 rounded bg-[var(--border)]/30">
                      Code : <strong className="font-mono">{changeEmailCodeDisplay}</strong>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={changeEmailCode}
                      onChange={(e) => setChangeEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Code à 6 chiffres"
                      maxLength={6}
                      className="w-32 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmChangeEmail}
                      disabled={changeEmailLoading || changeEmailCode.replace(/\D/g, '').length !== 6}
                      className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium disabled:opacity-50"
                    >
                      {changeEmailLoading ? 'Vérification…' : 'Confirmer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setChangeEmailStep('idle'); setNewEmail(''); setChangeEmailCode(''); setChangeEmailCodeDisplay(null); setChangeEmailMessage(''); }}
                      className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          id="etablissements"
          className={`rounded-xl p-6 border-2 transition-colors ${needsEstablishment ? 'border-amber-500/80 bg-amber-500/5' : 'border-[var(--border)]'}`}
        >
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="text-sm font-medium">Établissements / Profils émetteur</h2>
            {needsEstablishment && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
                À remplir pour pouvoir facturer
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mb-2">
            Ajoutez un ou plusieurs établissements. Lors de la création d&apos;un devis ou d&apos;une facture, vous choisirez avec quel établissement facturer.
          </p>
          <p className="text-xs text-[var(--muted)] mb-4">
            Établissements : {emitterProfiles.length} / {maxEstablishmentsPlan} {subscriptionPlan === 'starter' && '— Passer à Pro pour 2, Business pour 10'}
            {subscriptionPlan === 'pro' && maxEstablishmentsPlan === 2 && ' — Passer à Business pour 10'}
          </p>
          <div className="space-y-6">
            {emitterProfiles.map((ep, index) => (
              <div key={ep.id} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--muted)]">Établissement {index + 1}</span>
                  <button type="button" onClick={() => removeEstablishment(ep)} className="text-[var(--muted)] hover:text-red-600 p-1" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Nom de l&apos;établissement (ex : Siège, Agence Lyon) *</label>
                  <input type="text" value={ep.name} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, name: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="Siège" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Forme juridique *</label>
                  <select value={ep.legalStatus} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, legalStatus: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]">
                    <option value="">— Choisir —</option>
                    {LEGAL_FORMS.map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Raison sociale *</label>
                  <input type="text" value={ep.companyName} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, companyName: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">SIRET *</label>
                  <input type="text" value={ep.siret} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, siret: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="123 456 789 00012" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Adresse *</label>
                  <textarea rows={2} value={ep.address} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, address: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="Numéro et nom de rue" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Code postal *</label>
                    <input type="text" value={ep.postalCode} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, postalCode: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="75001" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Ville *</label>
                    <input type="text" value={ep.city} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, city: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="Paris" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Pays *</label>
                  <input type="text" value={ep.country ?? ''} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, country: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="France" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Code APE / NAF (optionnel)</label>
                  <input type="text" value={ep.apeCode ?? ''} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, apeCode: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="62.01Z" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--muted)] mb-2">TVA</p>
                  <div className="flex items-center gap-4 mb-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`vat-${ep.id}`}
                        checked={!ep.vatExempt}
                        onChange={() => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, vatExempt: false, vatExemptionReason: undefined } : p)))}
                        className="rounded-full border-[var(--border)]"
                      />
                      <span className="text-sm">Assujetti à la TVA</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`vat-${ep.id}`}
                        checked={!!ep.vatExempt}
                        onChange={() => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, vatExempt: true, vatNumber: undefined, vatExemptionReason: p.vatExemptionReason ?? vatExemptionReasonDefault } : p)))}
                        className="rounded-full border-[var(--border)]"
                      />
                      <span className="text-sm">Non assujetti à la TVA</span>
                    </label>
                  </div>
                  {!ep.vatExempt && (
                    <div>
                      <label className="block text-sm text-[var(--muted)] mb-1">N° TVA intracommunautaire *</label>
                      <input type="text" value={ep.vatNumber ?? ''} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, vatNumber: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="FR XX XXXXXXXXX" />
                    </div>
                  )}
                  {ep.vatExempt && (
                    <div>
                      <label className="block text-sm text-[var(--muted)] mb-1">Motif d&apos;exonération (affiché sur les factures / avoirs) *</label>
                      <textarea
                        rows={2}
                        value={ep.vatExemptionReason ?? ''}
                        onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, vatExemptionReason: ev.target.value } : p)))}
                        placeholder="TVA non applicable – article 293 B du CGI"
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Téléphone</label>
                    <input type="text" value={ep.phone ?? ''} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, phone: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="06 12 34 56 78" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Email *</label>
                    <input type="email" value={ep.email ?? ''} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, email: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Site web</label>
                    <input type="text" value={ep.website ?? ''} onChange={(ev) => setEmitterProfiles((prev) => prev.map((p) => (p.id === ep.id ? { ...p, website: ev.target.value } : p)))} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]" placeholder="https://..." />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEmitterProfiles((prev) => [...prev, newEmitterProfile()])}
              disabled={emitterProfiles.length >= maxEstablishmentsPlan}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--border)]/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Ajouter un établissement
            </button>
          </div>
        </div>

        <div
          id="coordonnees-bancaires"
          className={`rounded-xl p-6 border-2 transition-colors ${needsBank ? 'border-amber-500/80 bg-amber-500/5' : 'border-[var(--border)]'}`}
        >
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="text-sm font-medium">Coordonnées bancaires</h2>
            {needsBank && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
                À remplir pour pouvoir facturer
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mb-2">
            Ajoutez un ou plusieurs comptes. Lors de la création d&apos;un devis ou d&apos;une facture avec mode de paiement par virement, vous pourrez choisir le compte à afficher.
          </p>
          <p className="text-xs text-[var(--muted)] mb-4">
            Comptes : {bankAccounts.length} / {maxBankAccountsPlan} {subscriptionPlan === 'starter' && '— Passer à Pro pour 2, Business pour 10'}
            {subscriptionPlan === 'pro' && maxBankAccountsPlan === 2 && ' — Passer à Business pour 10'}
          </p>
          <div className="space-y-6">
            {bankAccounts.map((acc, index) => (
              <div key={acc.id} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--muted)]">Compte {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeBankAccount(acc)}
                    className="text-[var(--muted)] hover:text-red-600 p-1"
                    title="Supprimer ce compte"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Nom du compte (ex : Compte pro, Compte perso) *</label>
                  <input
                    type="text"
                    value={acc.name}
                    onChange={(e) => setBankAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, name: e.target.value } : a)))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                    placeholder="Compte pro"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Titulaire du compte *</label>
                  <input
                    type="text"
                    value={acc.accountHolder}
                    onChange={(e) => setBankAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, accountHolder: e.target.value } : a)))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                    placeholder={PLACEHOLDER_ACCOUNT_HOLDER}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Nom de la banque *</label>
                  <input
                    type="text"
                    value={acc.bankName}
                    onChange={(e) => setBankAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, bankName: e.target.value } : a)))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                    placeholder="Banque Example"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">IBAN *</label>
                    <input
                      type="text"
                      value={acc.iban}
                      onChange={(e) => setBankAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, iban: e.target.value } : a)))}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                      placeholder="FR76 1234 5678 9012 3456 7890 123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">BIC / SWIFT *</label>
                    <input
                      type="text"
                      value={acc.bic}
                      onChange={(e) => setBankAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, bic: e.target.value } : a)))}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)]"
                      placeholder="BNPAFRPP"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setBankAccounts((prev) => [...prev, newBankAccount()])}
              disabled={bankAccounts.length >= maxBankAccountsPlan}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--border)]/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Ajouter un compte
            </button>
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-xl p-6 relative">
          {!canEditAdvancedSettings && (
            <div className="absolute inset-0 z-10 rounded-xl bg-[var(--background)]/80 flex flex-col items-center justify-center gap-2 cursor-not-allowed">
              <Lock className="w-8 h-8 text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)] text-center px-4">Disponible dans la formule Pro ou Business.</p>
              <Link href="/formules" className="text-sm font-medium text-violet-600 hover:underline">Voir les formules</Link>
            </div>
          )}
          <h2 className="text-sm font-medium mb-4">Numérotation des factures, devis et avoirs</h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            Préfixe (ex: F, D, A), partie centrale optionnelle (max 6 car.), format du numéro. Exemple : F-2026-0001.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-[var(--muted)]">Factures</h3>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Préfixe (ex: F)</label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
                  maxLength={4}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Partie centrale (optionnel, max 6 car.)</label>
                <input
                  type="text"
                  value={invoiceNumberMiddle}
                  onChange={(e) => setInvoiceNumberMiddle(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ex: 2026"
                  maxLength={6}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Format du numéro</label>
                <select
                  value={invoiceNumberFormat}
                  onChange={(e) => setInvoiceNumberFormat(e.target.value)}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="sequential">Séquentiel : 0001, 0002, 0003</option>
                  <option value="ddmm_seq">Date (JJMM) + séquentiel : 1003-0001 (ex. 10 mars)</option>
                  <option value="year_seq">Année + séquentiel : 2026-0001</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-[var(--muted)]">Devis</h3>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Préfixe (ex: D)</label>
                <input
                  type="text"
                  value={quotePrefix}
                  onChange={(e) => setQuotePrefix(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
                  maxLength={4}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Partie centrale (optionnel, max 6 car.)</label>
                <input
                  type="text"
                  value={quoteNumberMiddle}
                  onChange={(e) => setQuoteNumberMiddle(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ex: 2026"
                  maxLength={6}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Format du numéro</label>
                <select
                  value={quoteNumberFormat}
                  onChange={(e) => setQuoteNumberFormat(e.target.value)}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="sequential">Séquentiel : 0001, 0002, 0003</option>
                  <option value="ddmm_seq">Date (JJMM) + séquentiel : 1003-0001 (ex. 10 mars)</option>
                  <option value="year_seq">Année + séquentiel : 2026-0001</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-[var(--muted)]">Avoirs</h3>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Préfixe (ex: A)</label>
                <input
                  type="text"
                  value={creditNotePrefix}
                  onChange={(e) => setCreditNotePrefix(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
                  maxLength={4}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Partie centrale (optionnel, max 6 car.)</label>
                <input
                  type="text"
                  value={creditNumberMiddle}
                  onChange={(e) => setCreditNumberMiddle(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ex: 2026"
                  maxLength={6}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Format du numéro</label>
                <select
                  value={creditNumberFormat}
                  onChange={(e) => setCreditNumberFormat(e.target.value)}
                  disabled={!canEditAdvancedSettings}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="sequential">Séquentiel : 0001, 0002, 0003</option>
                  <option value="ddmm_seq">Date (JJMM) + séquentiel : 1003-0001</option>
                  <option value="year_seq">Année + séquentiel : 2026-0001</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-xl p-6 relative">
          {!canEditAdvancedSettings && (
            <div className="absolute inset-0 z-10 rounded-xl bg-[var(--background)]/80 flex flex-col items-center justify-center gap-2 cursor-not-allowed">
              <Lock className="w-8 h-8 text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)] text-center px-4">Disponible dans la formule Pro ou Business.</p>
              <Link href="/formules" className="text-sm font-medium text-violet-600 hover:underline">Voir les formules</Link>
            </div>
          )}
          <h2 className="text-sm font-medium mb-4">Paiement par défaut</h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            Ces valeurs peuvent être utilisées par défaut sur les nouveaux devis et factures.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Mode de paiement par défaut</label>
              <select
                value={defaultPaymentMethod}
                onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                disabled={!canEditAdvancedSettings}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">— Sélectionner —</option>
                <option value="Virement bancaire">Virement bancaire</option>
                <option value="Chèque">Chèque</option>
                <option value="Carte bancaire">Carte bancaire</option>
                <option value="Espèces">Espèces</option>
                <option value="Prélèvement">Prélèvement</option>
                <option value="Virement SEPA">Virement SEPA</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Conditions de paiement (échéance)</label>
              <select
                value={defaultPaymentTerms}
                onChange={(e) => setDefaultPaymentTerms(e.target.value)}
                disabled={!canEditAdvancedSettings}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">— Sélectionner —</option>
                <option value="15 jours">15 jours</option>
                <option value="30 jours">30 jours</option>
                <option value="60 jours">60 jours</option>
                <option value="90 jours">90 jours</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-xl p-6 relative">
          {!canEditAdvancedSettings && (
            <div className="absolute inset-0 z-10 rounded-xl bg-[var(--background)]/80 flex flex-col items-center justify-center gap-2 cursor-not-allowed">
              <Lock className="w-8 h-8 text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)] text-center px-4">Disponible dans la formule Pro ou Business.</p>
              <Link href="/formules" className="text-sm font-medium text-violet-600 hover:underline">Voir les formules</Link>
            </div>
          )}
          <h2 className="text-sm font-medium mb-4">Mentions légales (documents)</h2>
          <p className="text-xs text-[var(--muted)] mb-2">
            Textes affichés en pied de facture / devis. Laissez vide pour utiliser les textes légaux par défaut.
          </p>
          <p className="text-xs text-[var(--muted)] mb-4 font-medium">
            Nous vous conseillons de laisser par défaut : c&apos;est ce qui est recommandé et obligatoire.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Pénalités de retard</label>
              <textarea
                rows={2}
                value={legalPenaltiesText}
                onChange={(e) => setLegalPenaltiesText(e.target.value)}
                placeholder="Pénalités de retard exigibles en cas de non paiement à la date d'échéance."
                disabled={!canEditAdvancedSettings}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Indemnité forfaitaire recouvrement</label>
              <input
                type="text"
                value={legalRecoveryFeeText}
                onChange={(e) => setLegalRecoveryFeeText(e.target.value)}
                placeholder="Indemnité forfaitaire pour frais de recouvrement : 40€ (article L441-10 du Code de commerce)"
                disabled={!canEditAdvancedSettings}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--muted)] disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
