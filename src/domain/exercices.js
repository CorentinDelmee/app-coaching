// Exercices enrichis (fiche Studio) : logique pure partagée par le serveur (serveur/src/exercices.js) et l'adaptateur local.
// Contrat : docs/CONTRAT-EXERCICES-STUDIO.md.

export const NIVEAUX = ['debutant', 'intermediaire', 'confirme']
/** Champs calculés ou gérés par le serveur : jamais acceptés en écriture. */
export const CHAMPS_CALCULES = ['photo', 'video', 'utiliseDans', 'utiliseDansProgrammes']
/** Champs que le client (élève) ne voit jamais. */
export const CHAMPS_COACH = ['notesPrivees', 'utiliseDans', 'utiliseDansProgrammes']

/** Minuscules sans accents ni ponctuation : « Écartés » -> « ecartes ». */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Applique un patch : '' ou null (ou liste vide) efface la clé. Renvoie un nouvel objet. */
export function appliquerPatch(actuel, patch) {
  const r = { ...actuel }
  for (const [k, v] of Object.entries(patch)) {
    if (v === '' || v === null || (Array.isArray(v) && v.length === 0 && k !== 'categories')) delete r[k]
    else r[k] = v
  }
  if (!r.categories) r.categories = []
  return r
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

/** Exercice tel que renvoyé : photo/vidéo normalisées, notes privées et usage retirés pour un client. */
export function presenterExercice(ex, { coach, usage, video }) {
  const o = { ...ex, photo: ex.photo ?? null, video }
  if (o.lienVideo === null) delete o.lienVideo // anciennes lignes : « pas de lien » = champ absent
  if (!coach) {
    for (const c of CHAMPS_COACH) delete o[c]
    return o
  }
  const u = usage?.get(ex.id)
  return { ...o, utiliseDans: u?.seances.size ?? 0, utiliseDansProgrammes: u?.programmes.size ?? 0 }
}

/** Filtres de la liste (voir le contrat), appliqués à des exercices déjà présentés (champ `video` calculé). */
export function filtrerExercices(liste, f = {}) {
  const q = f.q ? norm(f.q) : ''
  // Valeurs de filtre normalisées une seule fois (pas une fois par exercice et par élément).
  const [fCat, fMus, fMat] = [f.categorie, f.muscle, f.materiel].map((v) => (v ? norm(v) : ''))
  const dans = (tab, n) => (tab || []).some((x) => norm(x) === n)
  return liste.filter((e) => {
    if (e.archive) return false
    if (q && !norm(`${e.nom} ${e.description ?? ''}`).includes(q)) return false
    if (fCat && !(e.categorie && norm(e.categorie) === fCat) && !dans(e.categories, fCat)) return false
    if (fMus && !dans(e.musclesPrincipaux, fMus) && !dans(e.musclesSecondaires, fMus)) return false
    if (fMat && !dans(e.materiel, fMat)) return false
    if (f.niveau && e.niveau !== f.niveau) return false
    if (f.video && (f.video === 'aucune' ? !!e.video : e.video?.statut !== f.video)) return false
    return true
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}
