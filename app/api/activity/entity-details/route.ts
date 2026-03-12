import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Récupère les détails d'une entité pour l'affichage dans le modal d'historique.
 * Inclut les entités soft-deleted pour que les détails des suppressions soient visibles
 * et que l'utilisateur puisse récupérer l'élément.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType et entityId requis' }, { status: 400 })
  }

  const userId = session.id
  const whereBase = { id: entityId, userId }

  switch (entityType) {
    case 'invoice': {
      const invoice = await prisma.invoice.findFirst({
        where: whereBase,
        include: { client: true, company: true, lines: true },
      })
      if (!invoice) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
      return NextResponse.json(invoice)
    }
    case 'quote': {
      const quote = await prisma.quote.findFirst({
        where: whereBase,
        include: { client: true, company: true, lines: true },
      })
      if (!quote) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
      return NextResponse.json(quote)
    }
    case 'credit_note': {
      const creditNote = await prisma.creditNote.findFirst({
        where: whereBase,
        include: { client: true, company: true, invoice: true, lines: true },
      })
      if (!creditNote) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
      return NextResponse.json(creditNote)
    }
    case 'client': {
      const client = await prisma.client.findFirst({
        where: whereBase,
      })
      if (!client) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
      return NextResponse.json(client)
    }
    case 'company': {
      const company = await prisma.company.findFirst({
        where: whereBase,
      })
      if (!company) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
      return NextResponse.json(company)
    }
    case 'expense': {
      if (session.subscriptionPlan !== 'pro' && session.subscriptionPlan !== 'business') {
        return NextResponse.json({ error: 'Fonctionnalité Premium' }, { status: 403 })
      }
      const expense = await prisma.expense.findFirst({
        where: whereBase,
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      })
      if (!expense) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
      return NextResponse.json(expense)
    }
    default:
      return NextResponse.json({ error: 'Type d\'entité non géré' }, { status: 400 })
  }
}
