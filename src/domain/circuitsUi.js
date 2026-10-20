// Ce que l'écran affiche pour chaque format de circuit (purs, testés). Le calcul du temps reste dans engine/circuits.js :
// ici on ne fait que traduire son état (`etatChrono`) en textes, gros chiffre, anneau et bouton d'action.
import { paramsComplets } from '../engine/circuits.js'
import { formaterChrono, pluriel } from './format.js'

export const NOMS_FORMATS = {
  amrap: 'AMRAP', emom: 'EMOM', fortime: 'For Time', timecap: 'Time cap', deathby: 'Death by',
  tabata: 'Tabata', intervalles: 'Intervalles', superset: 'Superset'
}

const mmss = (sec) => formaterChrono(Math.max(0, sec) * 1000)
const minutes = (s) => `${Math.round((s / 60) * 10) / 10}`.replace('.', ',')

/** Titre d'un circuit : { nom: 'AMRAP', detail: '12 minutes' }. */
export function titreCircuit(format, params = {}) {
  const p = paramsComplets(format, params)
  const nom = NOMS_FORMATS[format] || format
  let detail = ''
  if (format === 'amrap') detail = `${minutes(p.duree)} minutes`
  else if (format === 'emom') detail = `${p.minutes} minutes`
  else if (format === 'fortime') detail = p.cap ? `cap ${mmss(p.cap)}` : 'le plus vite possible'
  else if (format === 'timecap') detail = `cap ${mmss(p.cap)}`
  else if (format === 'deathby') detail = 'jusqu\'à l\'échec'
  else if (format === 'tabata' || format === 'intervalles') detail = `${p.tours} × ${p.travail} s / ${p.repos} s`
  else if (format === 'superset') detail = `${p.tours} ${pluriel(p.tours, 'passage', 'passages')}`
  return { nom, detail }
}

/** Les trois temps de l'écran d'explication (en plus de la phrase d'objectif fournie par engine/circuits `explication`). */
export function etapesExplication(format, params = {}) {
  const p = paramsComplets(format, params)
  const prep = `${p.preparation} secondes de préparation, non comptées dans votre temps.`
  switch (format) {
    case 'amrap': return [prep, 'Enchaînez les mouvements dans l\'ordre, sans pause imposée.', 'Touchez « +1 tour » à chaque tour complet.']
    case 'emom': return [prep, 'Au début de chaque minute, faites le mouvement demandé.', 'Le temps qui reste dans la minute sert de repos.']
    case 'fortime': return [prep, 'Faites tout le travail, le plus vite possible.', 'Touchez « Terminé » dès que vous avez fini.']
    case 'timecap': return [prep, 'Faites tout le travail avant le cap.', 'Touchez « Terminé » dès que vous avez fini : le cap ne bouge pas.']
    case 'deathby': return [prep, 'Minute 1 : 1 répétition, minute 2 : 2 répétitions…', 'Touchez « Échec » quand vous n\'arrivez plus à finir la minute.']
    case 'tabata':
    case 'intervalles': return [prep, `${p.travail} secondes de travail, puis ${p.repos} secondes de repos.`, `${p.tours} tours : le chrono annonce chaque phase.`]
    case 'superset': return [prep, 'Enchaînez les exercices sans pause, dans l\'ordre.', `Touchez « Suivant » après chacun ; repos de ${p.repos} s après chaque passage.`]
    default: return [prep]
  }
}

/** Secondes qui restent avant le prochain changement de segment (pour le tic des 3 dernières secondes), null si sans objet. */
export function secondesAvantChangement(st) {
  if (st.phase === 'preparation') return st.preparationRestante
  if (st.termine || st.enPause) return null
  switch (st.format) {
    case 'amrap': return st.restant
    case 'emom':
    case 'deathby': return st.restantMinute
    case 'tabata':
    case 'intervalles': return st.restant
    case 'superset': return st.phase === 'repos' ? st.restant : null
    case 'fortime':
    case 'timecap': return st.restantCap ?? null
    default: return null
  }
}

/** Moment sonore à jouer quand le segment change : 'go' | 'fin' | 'repos' | 'minute' | null (voir engine `detecterSignal`). */
export const sonDuSignal = (signal) => ({ go: 'go', travail: 'go', minute: 'go', repos: 'fin', fin: 'fin' }[signal] || null)

const THEME = { preparation: 'prep', travail: 'travail', repos: 'repos', termine: 'prep', attente: 'prep' }

/**
 * Modèle d'affichage du chrono plein écran.
 * @returns {{
 *   theme: 'prep'|'travail'|'repos', etiquette: string, sous: string, grand: string, petit: string,
 *   anneau: number|null, anneauProchain: number|null,
 *   action: null|{id: string, libelle: string}, termine: boolean }}
 *   anneau : 0..1 ; anneauProchain : valeur une seconde plus tard (le gabarit lisse l'anneau pas à pas), null si l'anneau est continu.
 */
export function modeleChrono(st, noms = {}) {
  const p = st.params
  const titre = titreCircuit(st.format, p)
  const m = { theme: THEME[st.phase] || 'prep', etiquette: titre.nom, sous: '', grand: '', petit: '', anneau: null, anneauProchain: null, action: null, termine: st.termine }

  if (st.phase === 'preparation') {
    const r = st.preparationRestante
    return { ...m, etiquette: 'Préparation', sous: `${titre.nom} · ${titre.detail}`, grand: String(r), petit: 'Prenez votre place', anneau: r / p.preparation, anneauProchain: (r - 1) / p.preparation }
  }
  if (st.termine) return { ...m, ...modeleFin(st) }

  switch (st.format) {
    case 'amrap':
      return { ...m, sous: `Tour ${st.tours + 1} en cours`, grand: mmss(st.restant), petit: '', anneau: 1 - st.ecoule / (p.duree * 1000), action: { id: 'tour', libelle: '+1 tour' } }
    case 'emom': {
      const total = p.minutes * 60
      return {
        ...m, etiquette: `Minute ${st.minute} / ${st.total}`, sous: st.exerciceMinute || '', grand: mmss(st.restantMinute),
        petit: `Reste ${mmss(Math.ceil(total - st.ecoule / 1000))} au total`, anneau: 1 - (st.ecoule % 60000) / 60000
      }
    }
    case 'fortime':
    case 'timecap':
      return {
        ...m, sous: st.capAffiche ? `Cap ${st.capAffiche}` : 'Le plus vite possible', grand: formaterChrono(st.ecoule),
        petit: st.restantCap !== undefined ? `Reste ${mmss(st.restantCap)} avant le cap` : '',
        anneau: st.cap ? st.ecoule / st.cap : null, action: { id: 'termine', libelle: 'Terminé' }
      }
    case 'deathby':
      return {
        ...m, etiquette: `Minute ${st.minute}`, sous: `${st.repsMinute} ${pluriel(st.repsMinute, 'répétition', 'répétitions')}`, grand: mmss(st.restantMinute),
        anneau: 1 - (st.ecoule % 60000) / 60000, action: { id: 'echec', libelle: 'Échec' }
      }
    case 'tabata':
    case 'intervalles': {
      const travail = st.phase === 'travail'
      const dans = st.ecoule % ((p.travail + p.repos) * 1000)
      return {
        ...m, etiquette: travail ? 'Travail' : 'Repos', sous: `Tour ${st.tour} / ${st.totalTours}`, grand: String(st.restant),
        anneau: travail ? 1 - dans / (p.travail * 1000) : 1 - (dans - p.travail * 1000) / (p.repos * 1000)
      }
    }
    case 'superset': {
      if (st.phase === 'repos') {
        return { ...m, etiquette: 'Repos', sous: `Passage ${st.tour} / ${st.totalTours} à suivre`, grand: String(st.restant), anneau: st.restant / p.repos, anneauProchain: (st.restant - 1) / p.repos, action: { id: 'passer-repos', libelle: 'Passer le repos' } }
      }
      const taille = (p.exercices?.length || 2)
      return {
        ...m, etiquette: `Passage ${st.tour} / ${st.totalTours}`, sous: `Exercice ${st.exerciceIndex + 1} / ${taille}`, grand: st.exerciceCourant || '',
        petit: formaterChrono(st.ecoule), action: { id: 'suivant', libelle: st.exerciceIndex + 1 === taille ? 'Passage fini' : 'Suivant' }
      }
    }
    default: return m
  }
}

// Écran « circuit terminé » : le résultat en grand. L'ensemble reste identique pour tous les formats.
function modeleFin(st) {
  const r = st.resultat || {}
  const gagne = { theme: 'prep', anneau: 0, anneauProchain: null, action: null }
  switch (r.type) {
    case 'amrap': return { ...gagne, etiquette: 'Temps !', sous: 'Bien joué.', grand: String(r.tours), petit: pluriel(r.tours, 'tour', 'tours') }
    case 'emom': return { ...gagne, etiquette: 'Temps !', sous: 'Toutes les minutes sont faites.', grand: String(r.minutes), petit: 'minutes enchaînées' }
    case 'temps': return { ...gagne, etiquette: 'Terminé', sous: 'Votre temps', grand: formaterChrono(r.ms), petit: '' }
    case 'cap': return { ...gagne, etiquette: 'Cap atteint', sous: 'Le temps est écoulé', grand: formaterChrono(r.cap), petit: 'cap' }
    case 'deathby': return { ...gagne, etiquette: 'Terminé', sous: 'Dernière minute réussie', grand: String(r.minutes), petit: pluriel(r.minutes, 'minute', 'minutes') }
    case 'intervalles': return { ...gagne, etiquette: 'Temps !', sous: 'Bien joué.', grand: String(r.tours), petit: 'tours' }
    case 'superset': return { ...gagne, etiquette: 'Terminé', sous: `${r.tours} ${pluriel(r.tours, 'passage', 'passages')}`, grand: formaterChrono(r.ms), petit: '' }
    default: return { ...gagne, etiquette: 'Terminé', grand: '', petit: '' }
  }
}

/** Texte du résultat d'un circuit fait, pour le panneau « Circuit terminé » et l'écran de fin. */
export const libelleResultat = (resultat) => resultat?.libelle || 'Fait'
