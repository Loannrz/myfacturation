import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ENTITY_LABELS: Record<string, string> = {
  invoice: 'Facture',
  quote: 'Devis',
  credit_note: 'Avoir',
  client: 'Client',
  company: 'Société',
  expense: 'Dépense',
  employee: 'Salarié',
}

const ACTION_LABELS: Record<string, string> = {
  created: 'créé',
  updated: 'modifié',
  deleted: 'supprimé',
  restored: 'récupéré',
  paid: 'payée',
  sent: 'envoyé',
  'status updated': 'statut mis à jour',
  'converted to invoice': 'converti en facture',
  added: 'ajoutée',
  'client created': 'créé',
  'client updated': 'modifié',
  'client deleted': 'supprimé',
  'client restored': 'récupéré',
  'quote created': 'créé',
  'quote updated': 'modifié',
  'quote deleted': 'supprimé',
  'quote restored': 'récupéré',
  'invoice created': 'créé',
  'invoice updated': 'modifié',
  'invoice deleted': 'supprimé',
  'invoice restored': 'récupéré',
  'credit_note created': 'créé',
  'credit_note updated': 'modifié',
  'credit_note deleted': 'supprimé',
  'credit_note restored': 'récupéré',
  'employee created': 'créé',
  'employee updated': 'modifié',
  'employee deleted': 'supprimé',
  'employee restored': 'récupéré',
  'expense added': 'ajoutée',
  'expense updated': 'modifié',
  'expense deleted': 'supprimé',
  'expense restored': 'récupéré',
  'company updated': 'modifié',
  'company deleted': 'supprimé',
  'company restored': 'récupéré',
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('type') ?? undefined
  const from = searchParams.get('from') ?? undefined // YYYY-MM-DD
  const to = searchParams.get('to') ?? undefined

  const where: { userId: string; entityType?: string; createdAt?: { gte?: Date; lte?: Date } } = {
    userId: session.id,
  }
  if (entityType) where.entityType = entityType
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z')
  }

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const items = logs.map((log) => {
    let metadata: Record<string, unknown> = {}
    try {
      if (log.metadata) metadata = JSON.parse(log.metadata) as Record<string, unknown>
    } catch {}
    const name = (metadata.name as string) || log.entityId || ''
    const entityLabel = ENTITY_LABELS[log.entityType] || log.entityType
    const actionLabel = ACTION_LABELS[log.action] || log.action
    const label = `${entityLabel} ${actionLabel}${name ? ` • ${name}` : log.entityId ? ` ${log.entityId}` : ''}`
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      label,
      metadata,
      createdAt: log.createdAt.toISOString(),
    }
  })

  return NextResponse.json(items)
}
