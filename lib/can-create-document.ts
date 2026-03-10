import type { BankAccountEntry, EmitterProfileEntry } from '@/lib/billing-settings'
import { hasCompleteEmitterProfile, hasCompleteBankAccount } from '@/lib/billing-settings'

type SettingsLike = {
  name?: string | null
  companyName?: string | null
  legalStatus?: string | null
  siret?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  emitterProfiles?: string | EmitterProfileEntry[] | unknown[] | null
  bankAccounts?: string | unknown[] | null
}

/**
 * Vérifie si l'utilisateur peut créer une facture ou un devis :
 * - nom (profil) renseigné
 * - au moins un établissement / profil émetteur complet (ou infos facture legacy)
 * - au moins un compte bancaire avec titulaire, banque et IBAN
 */
export function canCreateDocument(data: SettingsLike): boolean {
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name) return false
  if (!hasCompleteEmitterProfile(data as { emitterProfiles?: string | EmitterProfileEntry[] | null; companyName?: string | null; legalStatus?: string | null; siret?: string | null; address?: string | null; postalCode?: string | null; city?: string | null })) return false
  if (!hasCompleteBankAccount(data as { bankAccounts?: string | BankAccountEntry[] | null })) return false
  return true
}

export const CANNOT_CREATE_MESSAGE =
  'Pour créer des devis et factures, renseignez votre nom, au moins un établissement (émetteur) avec toutes les informations obligatoires, et au moins un compte bancaire (titulaire, banque, IBAN) dans Paramètres.'
