// Calendrier et programme : semaine courante, workouts placés / à faire, historique.
import { ajouterJours, diffJours, jourSemaine, lundiDe } from './dates.js'

/** Numéro de semaine du programme (1 = semaine du début). <= 0 : pas encore commencé. */
export function numeroSemaine(programme, jour) {
  return Math.floor(diffJours(lundiDe(jour), lundiDe(programme.debut)) / 7) + 1
}

/** Workouts de la semaine n (mode répété : toujours les mêmes). */
export function workoutsDeSemaine(programme, n) {
  if (programme.mode === 'repete') return programme.workouts
  return programme.semaines[n - 1] || []
}

/** Un programme par semaine est terminé après sa dernière semaine ; un programme répété ne se termine pas sauf nbSemaines. */
function estTermine(programme, n) {
  const max = programme.mode === 'parSemaine' ? programme.semaines.length : programme.nbSemaines
  return !!max && n > max
}

/**
 * État d'une semaine (par défaut celle de `jour`).
 * @returns {{statut:'avenir'|'enCours'|'passee'|'termine', numero, lundi, workouts, faits, total, libelle, semaineBouclee, aFaire, parJour}}
 *  workouts[i] = { workoutId, fait, jourFait|null, jourFixe(0-6)|null, jourPlace('AAAA-MM-JJ')|null }
 *  parJour = 7 listes de workoutId (lundi→dimanche) : placés au jour réalisé, ou au jour fixé par le coach.
 */
export function etatSemaine(programme, realisations, jour, aujourdhui = jour) {
  const lundi = lundiDe(jour)
  const numero = numeroSemaine(programme, jour)
  const vide = { numero, lundi, workouts: [], faits: 0, total: 0, libelle: '0/0', semaineBouclee: false, aFaire: [], parJour: [[], [], [], [], [], [], []] }
  if (numero < 1) return { ...vide, statut: 'avenir' }
  if (estTermine(programme, numero)) return { ...vide, statut: 'termine' }

  const ids = workoutsDeSemaine(programme, numero)
  const dimanche = ajouterJours(lundi, 6)
  const parJour = [[], [], [], [], [], [], []]
  const workouts = ids.map((workoutId) => {
    // Réalisation la plus récente de la semaine pour ce workout (refaire un workout ne compte qu'une fois).
    const faits = realisations
      .filter((r) => r.clientId === programme.clientId && r.workoutId === workoutId && r.date >= lundi && r.date <= dimanche)
      .sort((a, b) => a.date.localeCompare(b.date))
    const derniere = faits[faits.length - 1]
    const jourFixe = programme.joursFixes && Number.isInteger(programme.joursFixes[workoutId]) ? programme.joursFixes[workoutId] : null
    const jourFait = derniere ? derniere.date : null
    const jourPlace = jourFait || (jourFixe !== null ? ajouterJours(lundi, jourFixe) : null)
    if (jourPlace) parJour[jourSemaine(jourPlace)].push(workoutId)
    return { workoutId, fait: !!derniere, jourFait, jourFixe, jourPlace }
  })
  const nbFaits = workouts.filter((w) => w.fait).length
  const statut = aujourdhui < lundi ? 'avenir' : aujourdhui > dimanche ? 'passee' : 'enCours'
  return {
    statut, numero, lundi, workouts, faits: nbFaits, total: ids.length,
    libelle: `${nbFaits}/${ids.length}`, semaineBouclee: ids.length > 0 && nbFaits === ids.length,
    // « À faire cette semaine » : workouts non faits (ceux avec un jour fixé sont aussi placés dans le calendrier)
    aFaire: workouts.filter((w) => !w.fait && w.jourFixe === null).map((w) => w.workoutId),
    parJour
  }
}

/** Historique : état de chaque semaine du début jusqu'à la semaine de `aujourdhui` (la plus récente en premier). */
export function historiqueSemaines(programme, realisations, aujourdhui) {
  const n = numeroSemaine(programme, aujourdhui)
  const semaines = []
  for (let i = 1; i <= n; i++) {
    const lundi = ajouterJours(lundiDe(programme.debut), (i - 1) * 7)
    const s = etatSemaine(programme, realisations, lundi, aujourdhui)
    if (s.statut !== 'termine') semaines.push(s)
  }
  return semaines.reverse()
}
