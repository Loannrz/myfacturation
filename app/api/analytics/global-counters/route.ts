import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whereNotDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

/** Retourne l’évolution cumulative (fin de chaque mois) des clients, sociétés et produits. */
export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
    return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) || new Date().getFullYear() : new Date().getFullYear()
  const userId = session.id

  const [clients, companies, products] = await Promise.all([
    prisma.client.findMany({
      where: { userId, ...whereNotDeleted },
      select: { createdAt: true },
    }),
    prisma.company.findMany({
      where: { userId, ...whereNotDeleted },
      select: { createdAt: true },
    }),
    prisma.billingProduct.findMany({
      where: { userId },
      select: { createdAt: true },
    }),
  ])

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const monthKey = `${year}-${String(m).padStart(2, '0')}`
    const lastDay = new Date(year, m, 0).getDate()
    const endOfMonth = new Date(Date.UTC(year, m - 1, lastDay, 23, 59, 59, 999))
    return { month: monthKey, label: MONTH_LABELS[i], endOfMonth }
  })

  const byMonth = months.map(({ month, label, endOfMonth }) => {
    const clientsCount = clients.filter((c) => new Date(c.createdAt) <= endOfMonth).length
    const companiesCount = companies.filter((c) => new Date(c.createdAt) <= endOfMonth).length
    const productsCount = products.filter((p) => new Date(p.createdAt) <= endOfMonth).length
    return {
      month,
      label,
      clients: clientsCount,
      companies: companiesCount,
      products: productsCount,
    }
  })

  return NextResponse.json(byMonth)
}
