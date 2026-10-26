// Petits utilitaires partagés (texte tolérant, identifiants, durées).
import { randomBytes } from 'node:crypto'

/** Minuscules sans accents ni ponctuation : « Léa  MARTIN » -> « lea martin ». */
export const norm = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export const slug = (s) => norm(s).replace(/ /g, '-')

/** Identifiant court aléatoire (base36). */
export const idCourt = (n = 6) => randomBytes(8).toString('hex').slice(0, n)

/** « 1:45 », « 105 », 105 -> 105 (secondes) ; null si illisible. */
export function secondes(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v)
  if (typeof v !== "string" || !/^\d+(:\d{1,2}){0,2}$/.test(v.trim())) return null
  return v.trim().split(":").reduce((t, p) => t * 60 + Number(p), 0)
}
