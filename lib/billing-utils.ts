/**
 * Arrondit le prix unitaire à 2 décimales par défaut (vers le bas).
 * Évite les PU du type 33,3333… ; le total TTC reste la référence (chiffre rond).
 */
export function roundDownTo2Decimals(v: number): number {
  return Math.floor(v * 100) / 100
}
