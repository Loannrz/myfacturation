import { prisma } from '@/lib/prisma'

const DEFAULT_EXPENSE_CATEGORIES = ['Voyage', 'Équipement', 'Marketing', 'Logiciel', "Frais d'événement", 'Autre']

export function parseExpenseCategories(json: string | null): string[] {
  if (!json || json.trim() === '') return [...DEFAULT_EXPENSE_CATEGORIES]
  try {
    const arr = JSON.parse(json) as unknown
    return Array.isArray(arr) && arr.every((x) => typeof x === 'string') ? arr : [...DEFAULT_EXPENSE_CATEGORIES]
  } catch {
    return [...DEFAULT_EXPENSE_CATEGORIES]
  }
}

export type BankAccountEntry = { id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }

export function parseBankAccounts(json: string | null): BankAccountEntry[] {
  if (!json || json.trim() === '') return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (x): x is BankAccountEntry =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as BankAccountEntry).id === 'string' &&
        typeof (x as BankAccountEntry).name === 'string' &&
        typeof (x as BankAccountEntry).accountHolder === 'string' &&
        typeof (x as BankAccountEntry).bankName === 'string' &&
        typeof (x as BankAccountEntry).iban === 'string' &&
        typeof (x as BankAccountEntry).bic === 'string'
    )
  } catch {
    return []
  }
}

export type EmitterProfileEntry = {
  id: string
  name: string
  companyName: string
  legalStatus: string
  siret: string
  vatNumber?: string
  apeCode?: string
  address: string
  postalCode: string
  city: string
  country?: string
  phone?: string
  email?: string
  website?: string
}

export function parseEmitterProfiles(json: string | null): EmitterProfileEntry[] {
  if (!json || json.trim() === '') return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (x): x is EmitterProfileEntry =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as EmitterProfileEntry).id === 'string' &&
        typeof (x as EmitterProfileEntry).name === 'string' &&
        typeof (x as EmitterProfileEntry).companyName === 'string' &&
        typeof (x as EmitterProfileEntry).legalStatus === 'string' &&
        typeof (x as EmitterProfileEntry).siret === 'string' &&
        typeof (x as EmitterProfileEntry).address === 'string' &&
        typeof (x as EmitterProfileEntry).postalCode === 'string' &&
        typeof (x as EmitterProfileEntry).city === 'string'
    )
  } catch {
    return []
  }
}

export function hasCompleteEmitterProfile(settings: {
  emitterProfiles?: string | EmitterProfileEntry[] | null
  companyName?: string | null
  legalStatus?: string | null
  siret?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
}): boolean {
  const profiles = Array.isArray(settings.emitterProfiles)
    ? settings.emitterProfiles
    : parseEmitterProfiles(typeof settings.emitterProfiles === 'string' ? settings.emitterProfiles : null)
  if (profiles.length > 0) {
    return profiles.some((p) => {
      const cn = (p.companyName ?? '').trim()
      const ls = (p.legalStatus ?? '').trim()
      const s = (p.siret ?? '').trim()
      const a = (p.address ?? '').trim()
      const pc = (p.postalCode ?? '').trim()
      const c = (p.city ?? '').trim()
      return !!(cn && ls && s && a && pc && c)
    })
  }
  const companyName = typeof settings.companyName === 'string' ? settings.companyName.trim() : ''
  const legalStatus = typeof settings.legalStatus === 'string' ? settings.legalStatus.trim() : ''
  const siret = typeof settings.siret === 'string' ? settings.siret.trim() : ''
  const address = typeof settings.address === 'string' ? settings.address.trim() : ''
  const postalCode = typeof settings.postalCode === 'string' ? settings.postalCode.trim() : ''
  const city = typeof settings.city === 'string' ? settings.city.trim() : ''
  return !!(companyName && legalStatus && siret && address && postalCode && city)
}

/** Au moins un compte bancaire avec titulaire, banque et IBAN renseignés. */
export function hasCompleteBankAccount(settings: { bankAccounts?: string | BankAccountEntry[] | null }): boolean {
  const accounts = Array.isArray(settings.bankAccounts)
    ? settings.bankAccounts
    : parseBankAccounts(typeof settings.bankAccounts === 'string' ? settings.bankAccounts : null)
  return accounts.some(
    (a) =>
      (a.accountHolder ?? '').trim() !== '' &&
      (a.bankName ?? '').trim() !== '' &&
      (a.iban ?? '').trim() !== ''
  )
}

export async function getBillingSettings(userId: string) {
  let settings = await prisma.billingSettings.findUnique({
    where: { userId },
  })
  if (!settings) {
    settings = await prisma.billingSettings.create({
      data: {
        userId,
        nextInvoiceNumber: 1,
        nextQuoteNumber: 1,
        nextCreditNoteNumber: 1,
        expenseCategories: JSON.stringify(DEFAULT_EXPENSE_CATEGORIES),
        invoiceNumberFormat: 'year_seq',
        quoteNumberFormat: 'year_seq',
        creditNumberFormat: 'year_seq',
      },
    })
  }
  return settings
}

export async function getExpenseCategories(userId: string): Promise<string[]> {
  const settings = await getBillingSettings(userId)
  return parseExpenseCategories(settings.expenseCategories)
}

export async function addExpenseCategory(userId: string, name: string): Promise<string[]> {
  const settings = await getBillingSettings(userId)
  const categories = parseExpenseCategories(settings.expenseCategories)
  const trimmed = name.trim()
  if (!trimmed || categories.includes(trimmed)) return categories
  const next = [...categories, trimmed]
  await prisma.billingSettings.update({
    where: { id: settings.id },
    data: { expenseCategories: JSON.stringify(next), updatedAt: new Date() },
  })
  return next
}

const NUMBER_FORMATS = ['sequential', 'ddmm_seq', 'year_seq'] as const
export type NumberFormat = (typeof NUMBER_FORMATS)[number]

function sanitizeMiddle(s: string | null | undefined, maxLen = 6): string {
  if (!s || typeof s !== 'string') return ''
  return s.replace(/[^a-zA-Z0-9]/g, '').slice(0, maxLen)
}

function buildNumberSequence(
  prefix: string,
  seq: number,
  middle: string,
  format: string | null | undefined
): string {
  const p = (prefix || 'F').replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'F'
  const mid = sanitizeMiddle(middle, 6)
  const fmt = NUMBER_FORMATS.includes(format as NumberFormat) ? format : 'sequential'
  const seqPart = String(seq).padStart(4, '0')
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()

  let suffix: string
  if (fmt === 'sequential') {
    suffix = seqPart
  } else if (fmt === 'ddmm_seq') {
    suffix = `${dd}${mm}-${seqPart}`
  } else {
    suffix = `${yyyy}-${seqPart}`
  }
  const pDash = p + '-'
  if (mid) return `${pDash}${mid}-${suffix}`
  return `${pDash}${suffix}`
}

export async function getNextInvoiceNumber(userId: string): Promise<string> {
  const settings = await getBillingSettings(userId)
  const next = settings.nextInvoiceNumber
  const prefix = (settings.invoicePrefix ?? 'F').trim().slice(0, 4) || 'F'
  const number = buildNumberSequence(
    prefix,
    next,
    settings.invoiceNumberMiddle ?? '',
    settings.invoiceNumberFormat ?? 'sequential'
  )
  await prisma.billingSettings.update({
    where: { id: settings.id },
    data: { nextInvoiceNumber: next + 1, updatedAt: new Date() },
  })
  return number
}

export async function getNextQuoteNumber(userId: string): Promise<string> {
  const settings = await getBillingSettings(userId)
  const next = settings.nextQuoteNumber
  const prefix = (settings.quotePrefix ?? 'D').trim().slice(0, 4) || 'D'
  const number = buildNumberSequence(
    prefix,
    next,
    settings.quoteNumberMiddle ?? '',
    settings.quoteNumberFormat ?? 'sequential'
  )
  await prisma.billingSettings.update({
    where: { id: settings.id },
    data: { nextQuoteNumber: next + 1, updatedAt: new Date() },
  })
  return number
}

export async function getNextCreditNoteNumber(userId: string): Promise<string> {
  const settings = await getBillingSettings(userId)
  const next = settings.nextCreditNoteNumber ?? 1
  const prefix = (settings.creditNotePrefix ?? 'A').trim().slice(0, 4) || 'A'
  const number = buildNumberSequence(
    prefix,
    next,
    settings.creditNumberMiddle ?? '',
    settings.creditNumberFormat ?? 'sequential'
  )
  await prisma.billingSettings.update({
    where: { id: settings.id },
    data: { nextCreditNoteNumber: next + 1, updatedAt: new Date() },
  })
  return number
}

export async function updateBillingSettings(
  userId: string,
  data: {
    companyName?: string
    legalStatus?: string
    siret?: string
    vatNumber?: string
    apeCode?: string
    address?: string
    postalCode?: string
    city?: string
    country?: string
    phone?: string
    email?: string
    website?: string
    logoUrl?: string
    bankAccountHolder?: string
    bankName?: string
    bankIban?: string
    bankBic?: string
    bankAccounts?: BankAccountEntry[]
    emitterProfiles?: EmitterProfileEntry[]
    expenseCategories?: string[]
    invoiceNumberMiddle?: string
    invoiceNumberFormat?: string
    invoicePrefix?: string
    quoteNumberMiddle?: string
    quoteNumberFormat?: string
    quotePrefix?: string
    creditNumberMiddle?: string
    creditNumberFormat?: string
    creditNotePrefix?: string
    defaultPaymentMethod?: string
    defaultPaymentTerms?: string
    legalPenaltiesText?: string
    legalRecoveryFeeText?: string
  }
) {
  const settings = await getBillingSettings(userId)
  const { expenseCategories, bankAccounts, emitterProfiles, ...rest } = data
  const updateData = { ...rest, updatedAt: new Date() } as Parameters<typeof prisma.billingSettings.update>[0]['data']
  if (Array.isArray(expenseCategories)) {
    (updateData as { expenseCategories?: string }).expenseCategories = JSON.stringify(expenseCategories)
  }
  if (Array.isArray(bankAccounts)) {
    (updateData as { bankAccounts?: string }).bankAccounts = JSON.stringify(bankAccounts)
  }
  if (Array.isArray(emitterProfiles)) {
    (updateData as { emitterProfiles?: string }).emitterProfiles = JSON.stringify(emitterProfiles)
  }
  if (data.invoiceNumberMiddle !== undefined) (updateData as { invoiceNumberMiddle?: string }).invoiceNumberMiddle = data.invoiceNumberMiddle === '' ? null : sanitizeMiddle(data.invoiceNumberMiddle, 6) || null
  if (data.invoiceNumberFormat !== undefined) (updateData as { invoiceNumberFormat?: string }).invoiceNumberFormat = data.invoiceNumberFormat || null
  if (data.invoicePrefix !== undefined) (updateData as { invoicePrefix?: string }).invoicePrefix = (data.invoicePrefix ?? '').trim().slice(0, 4) || null
  if (data.quoteNumberMiddle !== undefined) (updateData as { quoteNumberMiddle?: string }).quoteNumberMiddle = data.quoteNumberMiddle === '' ? null : sanitizeMiddle(data.quoteNumberMiddle, 6) || null
  if (data.quoteNumberFormat !== undefined) (updateData as { quoteNumberFormat?: string }).quoteNumberFormat = data.quoteNumberFormat || null
  if (data.quotePrefix !== undefined) (updateData as { quotePrefix?: string }).quotePrefix = (data.quotePrefix ?? '').trim().slice(0, 4) || null
  if (data.creditNumberMiddle !== undefined) (updateData as { creditNumberMiddle?: string }).creditNumberMiddle = data.creditNumberMiddle === '' ? null : sanitizeMiddle(data.creditNumberMiddle, 6) || null
  if (data.creditNumberFormat !== undefined) (updateData as { creditNumberFormat?: string }).creditNumberFormat = data.creditNumberFormat || null
  if (data.creditNotePrefix !== undefined) (updateData as { creditNotePrefix?: string }).creditNotePrefix = (data.creditNotePrefix ?? '').trim().slice(0, 4) || null
  if (data.defaultPaymentMethod !== undefined) (updateData as { defaultPaymentMethod?: string }).defaultPaymentMethod = data.defaultPaymentMethod || null
  if (data.defaultPaymentTerms !== undefined) (updateData as { defaultPaymentTerms?: string }).defaultPaymentTerms = data.defaultPaymentTerms || null
  if (data.legalPenaltiesText !== undefined) (updateData as { legalPenaltiesText?: string }).legalPenaltiesText = data.legalPenaltiesText || null
  if (data.legalRecoveryFeeText !== undefined) (updateData as { legalRecoveryFeeText?: string }).legalRecoveryFeeText = data.legalRecoveryFeeText || null
  return prisma.billingSettings.update({
    where: { id: settings.id },
    data: updateData,
  })
}
