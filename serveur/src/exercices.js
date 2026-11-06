// Exercices enrichis (refonte coach « Studio ») : validation zod, champs calculés, filtres, vue client.
// Contrat : docs/CONTRAT-EXERCICES-STUDIO.md. Partagé par les routes /api/app/exercices et les outils coach.
import { z } from 'zod'
import { idYoutube } from '../../src/domain/video.js'
import { CHAMPS_CALCULES, CHAMPS_COACH, NIVEAUX, appliquerPatch, filtrerExercices, indexUsage, presenterExercice } from '../../src/domain/exercices.js'

// Logique pure (patch, usage, filtres) : src/domain/exercices.js, partagée avec l'adaptateur local.
export { CHAMPS_COACH, NIVEAUX, appliquerPatch, indexUsage }

const texte = (max) => z.string().trim().max(max)
const liste = (max, n = 40) => z.array(z.string().trim().min(1).max(n)).max(max)

/** Champs modifiables. « » (ou null) = effacer le champ. */
export const CHAMPS = {
  nom: z.string().trim().min(1).max(120),
  description: texte(1000),
  categories: liste(10),
  lienVideo: z.union([z.literal(''), z.string().url().max(300).refine((v) => !!idYoutube(v), 'Lien YouTube attendu')]),
  categorie: texte(40),
  musclesPrincipaux: liste(6),
  musclesSecondaires: liste(10),
  materiel: liste(10),
  niveau: z.union([z.literal(''), z.enum(NIVEAUX)]),
  consignes: texte(2000),
  erreursFrequentes: texte(2000),
  varianteFacile: texte(500),
  varianteDifficile: texte(500),
  tempo: texte(20),
  reposConseille: z.number().int().min(0).max(600).nullable(),
  notesPrivees: texte(2000)
}
export const schemaCreation = z.object({ id: z.string().regex(/^(?!(?:__proto__|constructor|prototype)$)[A-Za-z0-9_-]{1,80}$/), ...CHAMPS }).strict().partial().required({ nom: true })
export const schemaPatch = z.object(CHAMPS).strict().partial()
// PUT générique : objet complet tel que stocké (id, archive, clientId en plus).
// Tolérant sur lienVideo (anciens liens non YouTube) et description (anciens imports longs) : rien d'existant ne doit devenir impossible à enregistrer.
const schemaStocke = z.object({ ...CHAMPS, id: z.string().min(1).max(80), archive: z.boolean().optional(), clientId: z.string().nullable().optional(), photo: z.any().optional(), lienVideo: z.string().max(2000).refine((v) => v === '' || /^https?:\/\//i.test(v.trim()), 'http(s) seulement'), description: z.string() }).strict().partial().required({ id: true, nom: true })

const retirer = (o, cles) => { const r = { ...o }; for (const c of cles) delete r[c]; return r }

const CLES_CONNUES = new Set([...Object.keys(CHAMPS), 'id', 'archive', 'clientId', 'photo', ...CHAMPS_CALCULES])
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Objet complet venant d'un PUT : retire les champs calculés, garde la photo du serveur, valide. Renvoie l'objet nettoyé ou null.
 * Clés inconnues (anciennes lignes, ex. `source`) : conservées telles quelles depuis la ligne stockée, jamais acceptées depuis l'écran
 * (une clé inconnue envoyée avec une valeur différente de la ligne stockée, ou absente de celle-ci, fait refuser le PUT).
 */
export function nettoyerPut(obj, existant) {
  const inconnues = Object.keys(obj).filter((k) => !CLES_CONNUES.has(k))
  if (inconnues.some((k) => !existant || !Object.hasOwn(existant, k) || !egal(obj[k], existant[k]))) return null
  obj = retirer(obj, inconnues)
  const o = retirer(obj, CHAMPS_CALCULES)
  for (const k of Object.keys(o)) if (o[k] === null) delete o[k] // anciennes lignes : « lienVideo: null »
  delete o.photo
  if (existant?.photo) o.photo = existant.photo
  if (!schemaStocke.safeParse(retirer(o, ['photo'])).success) return null
  for (const k of Object.keys(existant ?? {})) if (!CLES_CONNUES.has(k)) o[k] = existant[k] // clés inconnues d'une ancienne ligne : gardées en stockage
  return o
}

/** Vidéo vue par l'écran : lienVideo + entrée de la bibliothèque (statut propose | valide). */
export function videoDe(ex, biblio) {
  if (!ex.lienVideo || !idYoutube(ex.lienVideo)) return null // lien hérité non YouTube : jamais renvoyé comme vidéo (audit M1)
  let e
  try { e = biblio?.chercher(ex.nom).find((x) => x.video.url === ex.lienVideo) } catch { e = undefined } // bibliothèque illisible : statut « propose » (audit M2)
  return { url: ex.lienVideo, titre: e?.video.titre ?? null, chaine: e?.video.chaine ?? null, duree: e?.video.duree ?? null, statut: e?.statut === 'valide' ? 'valide' : 'propose' }
}

/** Exercice tel que renvoyé : champs calculés ajoutés, notes privées et usage retirés pour un client. */
export const presenter = (ex, { coach, usage, biblio }) => presenterExercice(ex, { coach, usage, video: videoDe(ex, biblio) })

export const filtrer = filtrerExercices
