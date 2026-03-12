/**
 * Catégories de dépenses pour la comptabilité (environ 20 catégories réalistes).
 * Utilisées dans les dépenses, la comptabilité et les graphiques.
 */

export const EXPENSE_CATEGORIES = [
  { value: 'Salaires', label: 'Salaires' },
  { value: 'Frais de déplacement', label: 'Frais de déplacement' },
  { value: 'Défraiements', label: 'Défraiements' },
  { value: 'Charges sociales', label: 'Charges sociales' },
  { value: 'Impôts', label: 'Impôts' },
  { value: 'TVA', label: 'TVA' },
  { value: 'Loyer', label: 'Loyer' },
  { value: 'Matériel', label: 'Matériel' },
  { value: 'Logiciels / SaaS', label: 'Logiciels / SaaS' },
  { value: 'Marketing / publicité', label: 'Marketing / publicité' },
  { value: 'Frais bancaires', label: 'Frais bancaires' },
  { value: 'Assurances', label: 'Assurances' },
  { value: 'Honoraires comptables', label: 'Honoraires comptables' },
  { value: 'Formation', label: 'Formation' },
  { value: 'Téléphonie', label: 'Téléphonie' },
  { value: 'Internet', label: 'Internet' },
  { value: 'Fournitures de bureau', label: 'Fournitures de bureau' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Autres dépenses', label: 'Autres dépenses' },
] as const

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]['value']

/** Valeur de la catégorie "Salaires" : afficher le sélecteur de salarié quand cette catégorie est choisie. */
export const SALAIRES_CATEGORY_VALUE: ExpenseCategoryValue = 'Salaires'

export const CONTRACT_TYPES = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'Alternant', label: 'Alternant' },
  { value: 'Stage', label: 'Stage' },
  { value: 'Freelance / Mission', label: 'Freelance / Mission' },
  { value: 'Autre', label: 'Autre' },
] as const
