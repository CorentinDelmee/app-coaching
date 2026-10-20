// Import / export JSON « cdc-coaching/1 » (voir docs/FORMAT-JSON.md).
import { validerExercice, validerWorkout, validerProgramme } from './modele.js'

export const FORMAT = 'cdc-coaching/1'
export const MESSAGE_FORMAT_INCONNU = `Format non reconnu (attendu ${FORMAT})`

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const mmeNom = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()
const identiques = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Export du coach : bibliothèque, séances et programmes. */
export function exporter({ exercices = [], workouts = [], programmes = [] }, now) {
  return { format: FORMAT, exporteLe: new Date(now).toISOString(), exercices, workouts, programmes }
}

/** Export « mes données » (RGPD) côté client : tout ce qui le concerne. */
export function exporterMesDonnees(donnees, now) {
  const { profil, template, ...listes } = donnees
  return { format: FORMAT, type: 'donnees-client', exporteLe: new Date(now).toISOString(), profil, template: template || null, ...listes }
}

function nouveauRapport() {
  return { ajoutes: 0, misAJour: 0, inchanges: 0, rejetes: [] }
}

function ligne(titre, r) {
  const parts = []
  if (r.ajoutes) parts.push(`${r.ajoutes} ajouté${r.ajoutes > 1 ? 's' : ''}`)
  if (r.misAJour) parts.push(`${r.misAJour} mis à jour`)
  if (r.inchanges) parts.push(`${r.inchanges} inchangé${r.inchanges > 1 ? 's' : ''}`)
  if (r.rejetes.length) {
    const raisons = r.rejetes.map((x) => `${x.ref} : ${x.raison}`).join(' ; ')
    parts.push(`${r.rejetes.length} rejeté${r.rejetes.length > 1 ? 's' : ''} (${raisons})`)
  }
  return parts.length ? `${titre} : ${parts.join(', ')}` : null
}

/**
 * Valide tout le document AVANT toute écriture et prépare l'import.
 * @param {object} doc  document JSON
 * @param {{exercices:[], workouts:[], programmes:[]}} existant  données déjà présentes
 * @returns {{ok:boolean, message:string, aEcrire?:{exercices,workouts,programmes}, rapport?:object}}
 */
export function preparerImport(doc, existant = {}) {
  if (!doc || typeof doc !== 'object' || doc.format !== FORMAT) return { ok: false, message: MESSAGE_FORMAT_INCONNU }
  const ex = existant.exercices || []
  const wo = existant.workouts || []
  const pr = existant.programmes || []
  const rapport = { exercices: nouveauRapport(), workouts: nouveauRapport(), programmes: nouveauRapport() }
  const aEcrire = { exercices: [], workouts: [], programmes: [] }

  // Exercices : rapprochés par id, sinon par nom (sans tenir compte de la casse).
  const idsExercices = new Set(ex.map((e) => e.id))
  for (const brut of doc.exercices || []) {
    const ref = brut?.nom || brut?.id || '(sans nom)'
    const candidat = { ...brut }
    const parNom = ex.find((e) => brut?.nom && mmeNom(e.nom, brut.nom))
    if (!candidat.id) candidat.id = parNom ? parNom.id : brut?.nom ? `ex-${slug(brut.nom)}` : undefined
    const v = validerExercice(candidat)
    if (!v.ok) { rapport.exercices.rejetes.push({ ref, raison: v.erreurs[0] }); continue }
    const actuel = ex.find((e) => e.id === candidat.id) || (parNom && (candidat.id = parNom.id, parNom))
    if (actuel) {
      const fusion = { ...actuel, ...candidat }
      if (identiques(fusion, actuel)) rapport.exercices.inchanges++
      else { rapport.exercices.misAJour++; aEcrire.exercices.push(fusion) }
    } else {
      rapport.exercices.ajoutes++
      aEcrire.exercices.push(candidat)
    }
    idsExercices.add(candidat.id)
  }

  // Séances : tous les exercices cités doivent exister.
  const idsWorkouts = new Set(wo.map((w) => w.id))
  const rejetsWorkouts = []
  for (const w of doc.workouts || []) {
    const ref = w?.nom || w?.id || '(sans nom)'
    const v = validerWorkout(w)
    if (!v.ok) { rapport.workouts.rejetes.push({ ref, raison: v.erreurs[0] }); continue }
    const cites = w.blocs.flatMap((b) => (b.type === 'exercice' ? [b.exerciceId] : b.type === 'superset' ? b.exercices.map((x) => x.exerciceId) : (b.exercices || []).map((x) => x.exerciceId)))
    const inconnu = cites.find((id) => !idsExercices.has(id))
    if (inconnu) { rapport.workouts.rejetes.push({ ref, raison: `exercice inconnu « ${inconnu} »` }); rejetsWorkouts.push(w.id); continue }
    const actuel = wo.find((x) => x.id === w.id)
    if (actuel) {
      if (identiques({ ...actuel, ...w }, actuel)) rapport.workouts.inchanges++
      else { rapport.workouts.misAJour++; aEcrire.workouts.push({ ...actuel, ...w }) }
    } else { rapport.workouts.ajoutes++; aEcrire.workouts.push(w) }
    idsWorkouts.add(w.id)
  }

  // Programmes : les séances citées doivent exister.
  for (const p of doc.programmes || []) {
    const ref = p?.nom || p?.id || '(sans nom)'
    const v = validerProgramme(p)
    if (!v.ok) { rapport.programmes.rejetes.push({ ref, raison: v.erreurs[0] }); continue }
    const cites = p.mode === 'repete' ? p.workouts : p.semaines.flat()
    const inconnu = cites.find((id) => !idsWorkouts.has(id))
    if (inconnu) { rapport.programmes.rejetes.push({ ref, raison: `séance inconnue « ${inconnu} »` }); continue }
    const actuel = pr.find((x) => x.id === p.id)
    if (actuel) {
      if (identiques({ ...actuel, ...p }, actuel)) rapport.programmes.inchanges++
      else { rapport.programmes.misAJour++; aEcrire.programmes.push({ ...actuel, ...p }) }
    } else { rapport.programmes.ajoutes++; aEcrire.programmes.push(p) }
  }

  const lignes = [ligne('Exercices', rapport.exercices), ligne('Séances', rapport.workouts), ligne('Programmes', rapport.programmes)].filter(Boolean)
  return { ok: true, message: lignes.length ? lignes.join(' — ') : 'Rien à importer', aEcrire, rapport }
}
