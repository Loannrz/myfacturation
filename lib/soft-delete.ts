/**
 * Soft delete : filtres pour exclure les éléments supprimés (récupérables 7 jours).
 */
export const whereNotDeleted = { deletedAt: null } as const

export const SOFT_DELETE_RETENTION_DAYS = 7

/** Date limite : les éléments supprimés avant cette date peuvent être purgés définitivement. */
export function deletedBeforeRetention(): Date {
  const d = new Date()
  d.setDate(d.getDate() - SOFT_DELETE_RETENTION_DAYS)
  return d
}
