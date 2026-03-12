import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBillingSettings, getNextInvoiceNumber, getNextQuoteNumber, getNextCreditNoteNumber } from '@/lib/billing-settings'
import { EXPENSE_CATEGORIES } from '@/lib/expense-categories'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CLIENT_NAMES = [
  { firstName: 'Marie', lastName: 'Dupont', type: 'particulier' as const },
  { firstName: 'Jean', lastName: 'Martin', type: 'particulier' as const },
  { firstName: 'Sophie', lastName: 'Bernard', type: 'professionnel' as const, companyName: 'SB Consulting' },
  { firstName: 'Pierre', lastName: 'Petit', type: 'entreprise' as const, companyName: 'Petit & Cie' },
  { firstName: 'Julie', lastName: 'Robert', type: 'particulier' as const },
]
const COMPANY_NAMES = ['Tech Solutions SAS', 'Agence Web Pro']
const PRODUCT_NAMES = [
  { name: 'Consulting jour', description: 'Prestation conseil', unitPrice: 600 },
  { name: 'Développement web', description: 'Site vitrine', unitPrice: 2500 },
  { name: 'Formation', description: 'Formation sur mesure', unitPrice: 800 },
  { name: 'Maintenance', description: 'Maintenance mensuelle', unitPrice: 150 },
  { name: 'Audit', description: 'Audit technique', unitPrice: 1200 },
  { name: 'Support', description: 'Support prioritaire / mois', unitPrice: 99 },
]

function dateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id: userId } = await params
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, subscriptionPlan: true },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  await getBillingSettings(userId)

  const year = new Date().getFullYear()
  const clients: { id: string }[] = []
  const companies: { id: string }[] = []
  const productIds: string[] = []
  const employeeIds: string[] = []

  for (const c of CLIENT_NAMES) {
    const client = await prisma.client.create({
      data: {
        userId,
        type: c.type,
        firstName: c.firstName,
        lastName: c.lastName,
        email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@example.com`,
        companyName: (c as { companyName?: string }).companyName ?? null,
      },
      select: { id: true },
    })
    clients.push(client)
  }

  for (const name of COMPANY_NAMES) {
    const company = await prisma.company.create({
      data: {
        userId,
        name,
        legalName: name,
        address: '123 rue Example',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
        siret: '12345678901234',
        email: `contact@${name.toLowerCase().replace(/\s/g, '')}.fr`,
      },
      select: { id: true },
    })
    companies.push(company)
  }

  for (const p of PRODUCT_NAMES) {
    const product = await prisma.billingProduct.create({
      data: {
        userId,
        name: p.name,
        description: p.description,
        type: 'service',
        unitPrice: p.unitPrice,
        vatRate: 20,
        discount: 0,
      },
      select: { id: true },
    })
    productIds.push(product.id)
  }

  const isBusiness = user.subscriptionPlan === 'business'
  if (isBusiness) {
    for (let i = 1; i <= 2; i++) {
      const emp = await prisma.employee.create({
        data: {
          userId,
          firstName: `Employé${i}`,
          lastName: `Test`,
          email: `employe${i}@example.com`,
          contractType: 'CDI',
          status: 'active',
        },
        select: { id: true },
      })
      employeeIds.push(emp.id)
    }
  }

  let quotesCount = 0
  let invoicesCount = 0
  let creditNotesCount = 0
  let expensesCount = 0

  for (let month = 1; month <= 12; month++) {
    const issueDate = dateStr(year, month, 15)
    const dueDate = dateStr(year, month, 30)

    for (let q = 0; q < 2; q++) {
      const number = await getNextQuoteNumber(userId)
      const clientOrCompany = q === 0 ? { clientId: clients[0].id, companyId: null } : { clientId: null, companyId: companies[0].id }
      const totalTTC = 1200 + month * 50
      const quote = await prisma.quote.create({
        data: {
          userId,
          number,
          status: month <= 6 ? 'sent' : 'draft',
          issueDate,
          dueDate,
          currency: 'EUR',
          paymentTerms: '30 jours',
          paymentMethod: 'virement',
          totalHT: Math.round((totalTTC / 1.2) * 100) / 100,
          vatAmount: Math.round((totalTTC - totalTTC / 1.2) * 100) / 100,
          totalTTC,
          tvaNonApplicable: false,
          ...clientOrCompany,
        },
      })
      await prisma.quoteLine.create({
        data: {
          quoteId: quote.id,
          type: 'service',
          description: 'Prestation ' + PRODUCT_NAMES[month % PRODUCT_NAMES.length].name,
          quantity: 1,
          unitPrice: totalTTC / 1.2,
          vatRate: 20,
          discount: 0,
          total: totalTTC / 1.2,
        },
      })
      quotesCount++
    }

    for (let inv = 0; inv < 2; inv++) {
      const number = await getNextInvoiceNumber(userId)
      const clientOrCompany = inv === 0 ? { clientId: clients[1].id, companyId: null } : { clientId: null, companyId: companies[1]?.id ?? companies[0].id }
      const totalTTC = 800 + month * 30 + inv * 200
      const status = inv === 0 && month <= 6 ? 'paid' : month <= 8 ? 'sent' : 'draft'
      const invoice = await prisma.invoice.create({
        data: {
          userId,
          number,
          status,
          issueDate,
          dueDate,
          currency: 'EUR',
          paymentTerms: '30 jours',
          paymentMethod: 'virement',
          totalHT: Math.round((totalTTC / 1.2) * 100) / 100,
          vatAmount: Math.round((totalTTC - totalTTC / 1.2) * 100) / 100,
          totalTTC,
          tvaNonApplicable: false,
          paidAt: status === 'paid' ? new Date(year, month - 1, 20) : null,
          ...clientOrCompany,
        },
      })
      await prisma.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          type: 'service',
          description: 'Facturation ' + PRODUCT_NAMES[inv % PRODUCT_NAMES.length].name,
          quantity: 1,
          unitPrice: totalTTC / 1.2,
          vatRate: 20,
          discount: 0,
          total: totalTTC / 1.2,
        },
      })
      invoicesCount++

      if (inv === 0 && month <= 4) {
        const cnNumber = await getNextCreditNoteNumber(userId)
        const cnTotal = Math.round(totalTTC * 0.2 * 100) / 100
        const cnHT = Math.round((cnTotal / 1.2) * 100) / 100
        const creditNote = await prisma.creditNote.create({
          data: {
            userId,
            number: cnNumber,
            status: 'refunded',
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            companyId: invoice.companyId,
            issueDate: dateStr(year, month, 25),
            currency: 'EUR',
            totalHT: cnHT,
            vatAmount: Math.round((cnTotal - cnTotal / 1.2) * 100) / 100,
            totalTTC: cnTotal,
            tvaNonApplicable: false,
            reason: 'Avoir test',
            refundedAt: new Date(year, month - 1, 26),
          },
        })
        await prisma.creditNoteLine.create({
          data: {
            creditNoteId: creditNote.id,
            type: 'service',
            description: 'Remboursement partiel',
            quantity: 1,
            unitPrice: cnHT,
            vatRate: 20,
            discount: 0,
            total: cnHT,
          },
        })
        creditNotesCount++
      }
    }

    const categories = EXPENSE_CATEGORIES.map((x) => x.value)
    for (let e = 0; e < 3; e++) {
      await prisma.expense.create({
        data: {
          userId,
          date: dateStr(year, month, 5 + e * 8),
          amount: 50 + month * 5 + e * 20,
          category: categories[e % categories.length],
          description: `Dépense test ${month}/${year}`,
          supplier: e === 0 ? 'Fournisseur A' : undefined,
        },
      })
      expensesCount++
    }
  }

  return NextResponse.json({
    ok: true,
    message: 'Données de test créées.',
    created: {
      clients: clients.length,
      companies: companies.length,
      products: productIds.length,
      employees: employeeIds.length,
      quotes: quotesCount,
      invoices: invoicesCount,
      creditNotes: creditNotesCount,
      expenses: expensesCount,
    },
  })
}
