// Planning d'un programme vu en colonnes (« Au choix du client » + Lundi … Dimanche). Fonctions pures, testées.
// Une semaine = liste ordonnée d'ids de séances ; joursFixes { workoutId: 0-6 } est GLOBAL au programme.
import { JOURS_COURTS } from '../../../../logique.js'

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const JOURS_ABR = JOURS_COURTS
/** Colonnes dans l'ordre d'affichage : 'choix' puis 0..6. */
export const COLONNES = ['choix', 0, 1, 2, 3, 4, 5, 6]
export const nomColonne = (c) => (c === 'choix' ? 'Au choix du client' : JOURS[c])

const colonneDe = (id, joursFixes) => (Number.isInteger(joursFixes?.[id]) ? joursFixes[id] : 'choix')

/** { choix: [...ids], 0: [...], … 6: [...] } dans l'ordre de la semaine. */
export function colonnes(ids, joursFixes = {}) {
  const res = Object.fromEntries(COLONNES.map((c) => [c, []]))
  for (const id of ids) res[colonneDe(id, joursFixes)].push(id)
  return res
}

/**
 * Pose une séance dans une colonne de la semaine.
 * @param {{ ids: string[], joursFixes: object }} semaine
 * @param {{ source: { col, index } | null, id?: string, cible: { col, index } }} geste
 *   source = carte déjà posée (colonne + index dans la colonne) ; sinon `id` venu de la bibliothèque.
 *   cible.index = position dans la colonne cible APRÈS retrait de l'élément.
 * @returns {{ ids, joursFixes, id, deplace: boolean, dejaLa: boolean } | null}
 *   dejaLa = la séance venait de la bibliothèque mais était déjà dans la semaine (déplacement, pas de doublon).
 *   Nouvelle semaine ordonnée : Lundi … Dimanche puis « Au choix ».
 */
export function poser({ ids, joursFixes = {} }, { source = null, id = null, cible }) {
  const cols = colonnes(ids, joursFixes)
  let quoi = id
  let dejaLa = false
  if (source) {
    quoi = cols[source.col]?.[source.index]
    if (quoi === undefined) return null
    cols[source.col].splice(source.index, 1)
  } else {
    if (!quoi) return null
    if (ids.includes(quoi)) {
      dejaLa = true
      const c = colonneDe(quoi, joursFixes)
      cols[c].splice(cols[c].indexOf(quoi), 1)
    }
  }
  const dest = cols[cible.col]
  if (!dest) return null
  dest.splice(Math.max(0, Math.min(cible.index ?? dest.length, dest.length)), 0, quoi)
  const jf = { ...joursFixes }
  if (cible.col === 'choix') delete jf[quoi]
  else jf[quoi] = cible.col
  const nouveaux = [0, 1, 2, 3, 4, 5, 6, 'choix'].flatMap((c) => cols[c])
  return { ids: nouveaux, joursFixes: jf, id: quoi, deplace: Boolean(source) || dejaLa, dejaLa }
}

/** Liste des séances de la semaine `s` (répété : la liste unique). */
export const idsSemaine = (p, s = 0) => (p.mode === 'repete' ? p.workouts || [] : p.semaines?.[s] || [])

/** Écrit la liste d'ids de la semaine `s` (en place sur un programme réactif). */
export function ecrireSemaine(p, s, ids) {
  if (p.mode === 'repete') p.workouts = ids
  else p.semaines[s] = ids
}

/** Toutes les séances utilisées par le programme (sans doublon). */
export const idsUtilises = (p) => (p.mode === 'repete' ? [...(p.workouts || [])] : [...new Set((p.semaines || []).flat())])

/** Change de mode sans perdre les séances (renvoie une copie). */
export function convertirMode(p, mode) {
  if (mode === p.mode) return p
  const c = JSON.parse(JSON.stringify(p))
  if (mode === 'parSemaine') {
    const base = c.workouts || []
    c.semaines = Array.from({ length: Math.max(1, c.nbSemaines || 1) }, () => [...base])
    delete c.workouts
    delete c.nbSemaines
  } else {
    c.workouts = [...new Set((c.semaines || []).flat())]
    delete c.semaines
  }
  c.mode = mode
  return c
}

/**
 * Retour en « par semaine » après un passage en « répété » : la répartition mémorisée revient.
 * Séances retirées entre-temps : enlevées de chaque semaine ; séances ajoutées : ajoutées à chaque semaine.
 */
export function restaurerSemaines(memo, workouts = []) {
  const garde = new Set(workouts)
  const semaines = memo.map((s) => s.filter((id) => garde.has(id)))
  const connues = new Set(memo.flat())
  const nouvelles = workouts.filter((id) => !connues.has(id))
  const res = semaines.map((s) => [...s, ...nouvelles])
  return res.length ? res : [[...workouts]]
}

/** Programme prêt à écrire : nom nettoyé, champs vides retirés (undefined = effacé par modifier()). */
export function pourEcriture(p) {
  const c = JSON.parse(JSON.stringify(p))
  c.nom = String(c.nom || '').trim()
  const out = { ...c, nbSemaines: c.mode === 'repete' && c.nbSemaines > 0 ? Math.floor(c.nbSemaines) : undefined }
  if (c.mode === 'repete') out.semaines = undefined
  else out.workouts = undefined
  const jf = Object.fromEntries(Object.entries(c.joursFixes || {}).filter(([k]) => idsUtilises(c).includes(k)))
  out.joursFixes = Object.keys(jf).length ? jf : undefined
  return out
}

/** Raison pour laquelle le programme ne peut pas être enregistré ('' = valide). */
export function raisonInvalide(p) {
  if (!p?.clientId) return 'choisis un client'
  if (!String(p.nom || '').trim()) return 'donne un nom au programme'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.debut || '')) return 'indique la date de début'
  return ''
}

/** « Répété · 3 séances/semaine » / « Par semaine · 6 semaines ». */
export function libelleMode(p) {
  if (p.mode === 'repete') {
    const n = (p.workouts || []).length
    return `Répété · ${n} séance${n > 1 ? 's' : ''}/semaine${p.nbSemaines ? ` · ${p.nbSemaines} sem.` : ''}`
  }
  const n = (p.semaines || []).length
  return `Par semaine · ${n} semaine${n > 1 ? 's' : ''}`
}

export const initiales = (nom) => String(nom || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || '?'

const TEINTES_AVATAR = ['jambes', 'dos', 'pecs', 'epaules', 'bras', 'gainage', 'mobilite', 'cardio']
/** Teinte stable d'un client (avatar) d'après son id. */
export function teinteClient(id) {
  let h = 0
  for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TEINTES_AVATAR[h % TEINTES_AVATAR.length]
}
