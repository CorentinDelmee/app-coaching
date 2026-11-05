// Date du calendrier AAAA-MM-JJ, vérifiée pour de vrai (2026-02-30, 2026-13-01 refusées). Un seul helper pour tous les outils.
import { z } from 'zod'

export const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/

/** Vrai si « AAAA-MM-JJ » est un jour qui existe. */
export function jourValide(s) {
  if (!FORMAT_JOUR.test(s)) return false
  const [a, m, j] = s.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j))
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j
}

export const jour = z.string().regex(FORMAT_JOUR, 'date attendue au format AAAA-MM-JJ').refine(jourValide, { message: 'cette date n\'existe pas dans le calendrier' })
