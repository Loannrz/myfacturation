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

export async function getBillingSettings(userId: string) {
  let settings = await prisma.billingSettings.findUnique({
    where: { userId },
  })
  if (!settings) {
    settings = await prisma.billingSettings.create({
      data: {
        userId,
        companyName: 'Myfacturation',
        nextInvoiceNumber: 1,
        nextQuoteNumber: 1,
        expenseCategories: JSON.stringify(DEFAULT_EXPENSE_CATEGORIES),
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

export async function getNextInvoiceNumber(userId: string): Promise<number> {
  const settings = await getBillingSettings(userId)
  const next = settings.nextInvoiceNumber
  await prisma.billingSettings.update({
    where: { id: settings.id },
    data: { nextInvoiceNumber: next + 1, updatedAt: new Date() },
  })
  return next
}

export async function getNextQuoteNumber(userId: string): Promise<number> {
  const settings = await getBillingSettings(userId)
  const next = settings.nextQuoteNumber
  await prisma.billingSettings.update({
    where: { id: settings.id },
    data: { nextQuoteNumber: next + 1, updatedAt: new Date() },
  })
  return next
}

export async function updateBillingSettings(
  userId: string,
  data: {
    companyName?: string
    legalStatus?: string
    siret?: string
    vatNumber?: string
    address?: string
    phone?: string
    email?: string
    website?: string
    logoUrl?: string
    bankAccountHolder?: string
    bankName?: string
    bankIban?: string
    bankBic?: string
    expenseCategories?: string[]
  }
) {
  const settings = await getBillingSettings(userId)
  const { expenseCategories, ...rest } = data
  const updateData = { ...rest, updatedAt: new Date() } as Parameters<typeof prisma.billingSettings.update>[0]['data']
  if (Array.isArray(expenseCategories)) {
    (updateData as { expenseCategories?: string }).expenseCategories = JSON.stringify(expenseCategories)
  }
  return prisma.billingSettings.update({
    where: { id: settings.id },
    data: updateData,
  })
}
