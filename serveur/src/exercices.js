// Exercices enrichis (refonte coach « Studio ») : validation zod, champs calculés, filtres, vue client.
// Contrat : docs/CONTRAT-EXERCICES-STUDIO.md. Partagé par les routes /api/app/exercices et les outils coach.
import { z } from 'zod'
import { idYoutube } from '../../src/domain/video.js'
import { norm } from './util.js'

export const NIVEAUX = ['debutant', 'intermediaire', 'confirme']
/** Champs calculés ou gérés par le serveur : jamais acceptés en écriture. */
export const CHAMPS_CALCULES = ['video', 'utiliseDans', 'utiliseDansProgrammes']
/** Champs que le client (élève) ne voit jamais. */
export const CHAMPS_COACH = ['notesPrivees', 'utiliseDans', 'utiliseDansProgrammes']

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
const schemaStocke = z.object({ id: z.string().min(1).max(80), archive: z.boolean().optional(), clientId: z.string().nullable().optional(), photo: z.any().optional(), ...CHAMPS }).strict().partial().required({ id: true, nom: true })

/** Applique un patch : '' ou null efface la clé. Renvoie un nouvel objet. */
export function appliquerPatch(actuel, patch) {
  const r = { ...actuel }
  for (const [k, v] of Object.entries(patch)) {
    if (v === '' || v === null || (Array.isArray(v) && v.length === 0 && k !== 'categories')) delete r[k]
    else r[k] = v
  }
  if (!r.categories) r.categories = []
  return r
}

const retirer = (o, cles) => { const r = { ...o }; for (const c of cles) delete r[c]; return r }

/** Objet complet venant d'un PUT : retire les champs calculés, garde la photo du serveur, valide. Renvoie l'objet nettoyé ou null. */
export function nettoyerPut(obj, existant) {
  const o = retirer(obj, CHAMPS_CALCULES)
  delete o.photo
  if (existant?.photo) o.photo = existant.photo
  const copie = retirer(o, ['photo'])
  for (const k of ['reposConseille']) if (copie[k] === undefined) delete copie[k]
  return schemaStocke.safeParse(copie).success ? o : null
}

/** Index d'usage : exerciceId -> { seances:Set, programmes:Set }. workouts et programmes = lignes du magasin. */
export function indexUsage(workouts, programmes) {
  const parWorkout = new Map()
  const parExo = new Map()
  const entree = (id) => { if (!parExo.has(id)) parExo.set(id, { seances: new Set(), programmes: new Set() }); return parExo.get(id) }
  for (const w of workouts) {
    const ids = (w.blocs || []).flatMap((b) => [b.exerciceId, ...(b.exercices || []).map((x) => x.exerciceId)]).filter(Boolean)
    for (const id of ids) entree(id).seances.add(w.id)
    parWorkout.set(w.id, ids)
  }
  for (const p of programmes) {
    const wids = [...(p.workouts || []), ...(p.semaines || []).flat()].map((x) => (typeof x === 'string' ? x : x?.workoutId ?? x?.id)).filter(Boolean)
    for (const wid of wids) for (const id of parWorkout.get(wid) || []) entree(id).programmes.add(p.id)
  }
  return parExo
}

/** Vidéo vue par l'écran : lienVideo + entrée de la bibliothèque (statut propose | valide). */
export function videoDe(ex, biblio) {
  if (!ex.lienVideo) return null
  const e = biblio?.chercher(ex.nom).find((x) => x.video.url === ex.lienVideo)
  return { url: ex.lienVideo, titre: e?.video.titre ?? null, chaine: e?.video.chaine ?? null, duree: e?.video.duree ?? null, statut: e?.statut === 'valide' ? 'valide' : 'propose' }
}

/** Exercice tel que renvoyé : champs calculés ajoutés, notes privées et usage retirés pour un client. */
export function presenter(ex, { coach, usage, biblio }) {
  const o = { ...ex, photo: ex.photo ?? null, video: videoDe(ex, biblio) }
  if (!coach) return retirer(o, CHAMPS_COACH)
  const u = usage?.get(ex.id)
  return { ...o, utiliseDans: u?.seances.size ?? 0, utiliseDansProgrammes: u?.programmes.size ?? 0 }
}

/** Filtres de la liste (voir le contrat), appliqués à des exercices déjà présentés (champ `video` calculé). */
export function filtrer(liste, f = {}) {
  const q = f.q ? norm(f.q) : ''
  const eq = (a, b) => norm(a) === norm(b)
  const dans = (tab, v) => (tab || []).some((x) => eq(x, v))
  return liste.filter((e) => {
    if (e.archive) return false
    if (q && !norm(`${e.nom} ${e.description ?? ''}`).includes(q)) return false
    if (f.categorie && !(e.categorie && eq(e.categorie, f.categorie)) && !dans(e.categories, f.categorie)) return false
    if (f.muscle && !dans(e.musclesPrincipaux, f.muscle) && !dans(e.musclesSecondaires, f.muscle)) return false
    if (f.materiel && !dans(e.materiel, f.materiel)) return false
    if (f.niveau && e.niveau !== f.niveau) return false
    if (f.video && (f.video === 'aucune' ? !!e.video : e.video?.statut !== f.video)) return false
    return true
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}
