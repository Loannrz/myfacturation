import { prisma } from '@/lib/prisma'

export type BillingEntityType = 'invoice' | 'quote' | 'client' | 'company' | 'expense'

export async function logBillingActivity(
  userId: string,
  action: string,
  entityType: BillingEntityType,
  entityId?: string | null,
  metadata?: Record<string, unknown>
) {
  await prisma.activityLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId: entityId ?? undefined,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  })
}
