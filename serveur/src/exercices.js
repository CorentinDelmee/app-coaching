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
export const schemaCreation = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), ...CHAMPS }).strict().partial().required({ nom: true })
export const schemaPatch = z.object(CHAMPS).strict().partial()
// PUT générique : objet complet tel que stocké (id, archive, clientId en plus).
// Tolérant sur lienVideo (anciens liens non YouTube) et description (anciens imports longs) : rien d'existant ne doit devenir impossible à enregistrer.
const schemaStocke = z.object({ ...CHAMPS, id: z.string().min(1).max(80), archive: z.boolean().optional(), clientId: z.string().nullable().optional(), photo: z.any().optional(), lienVideo: z.string().max(2000), description: z.string() }).strict().partial().required({ id: true, nom: true })

const retirer = (o, cles) => { const r = { ...o }; for (const c of cles) delete r[c]; return r }

/** Objet complet venant d'un PUT : retire les champs calculés, garde la photo du serveur, valide. Renvoie l'objet nettoyé ou null. */
export function nettoyerPut(obj, existant) {
  const o = retirer(obj, CHAMPS_CALCULES)
  for (const k of Object.keys(o)) if (o[k] === null) delete o[k] // anciennes lignes : « lienVideo: null »
  delete o.photo
  if (existant?.photo) o.photo = existant.photo
  return schemaStocke.safeParse(retirer(o, ['photo'])).success ? o : null
}

/** Vidéo vue par l'écran : lienVideo + entrée de la bibliothèque (statut propose | valide). */
export function videoDe(ex, biblio) {
  if (!ex.lienVideo) return null
  const e = biblio?.chercher(ex.nom).find((x) => x.video.url === ex.lienVideo)
  return { url: ex.lienVideo, titre: e?.video.titre ?? null, chaine: e?.video.chaine ?? null, duree: e?.video.duree ?? null, statut: e?.statut === 'valide' ? 'valide' : 'propose' }
}

/** Exercice tel que renvoyé : champs calculés ajoutés, notes privées et usage retirés pour un client. */
export const presenter = (ex, { coach, usage, biblio }) => presenterExercice(ex, { coach, usage, video: videoDe(ex, biblio) })

export const filtrer = filtrerExercices
