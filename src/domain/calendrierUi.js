// Libellés et grilles de l'écran Programme (lot 4) : colonnes de la semaine, grille du mois, textes. Pur, testé.
// Les règles (semaine courante, workouts faits/à placer, historique) restent dans domain/programme.js.
import { ajouterJours, diffJours, jourSemaine, lundiDe } from './dates.js'
import { etatSemaine } from './programme.js'
import { titreWorkout } from './workoutUi.js'

export const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

const partie = (jour) => { const [a, m, j] = jour.split('-').map(Number); return { a, m, j } }

/** '2026-10-22' -> « jeudi 22 octobre ». */
export const jourLong = (jour) => `${JOURS_LONGS[jourSemaine(jour)]} ${partie(jour).j} ${MOIS_NOMS[partie(jour).m - 1]}`
/** '2026-10-22' -> « jeu. 22 ». */
export const jourCourt = (jour) => `${JOURS_COURTS[jourSemaine(jour)].toLowerCase()}. ${partie(jour).j}`
/** Lundi 2026-10-19 -> « 19 – 25 oct. » (ou « 28 sept. – 4 oct. » à cheval sur deux mois). */
export function libelleSemaine(lundi) {
  const a = partie(lundi)
  const b = partie(ajouterJours(lundi, 6))
  return a.m === b.m ? `${a.j} – ${b.j} ${MOIS_COURTS[b.m - 1]}` : `${a.j} ${MOIS_COURTS[a.m - 1]} – ${b.j} ${MOIS_COURTS[b.m - 1]}`
}
/** '2026-10' -> « octobre 2026 ». */
export const libelleMois = (mois) => { const [a, m] = mois.split('-').map(Number); return `${MOIS_NOMS[m - 1]} ${a}` }
/** Mois affiché pour une semaine : celui de son jeudi (la majorité de ses jours). */
export const moisDeSemaine = (lundi) => ajouterJours(lundi, 3).slice(0, 7)
export function ajouterMois(mois, n) {
  const [a, m] = mois.split('-').map(Number)
  const t = a * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/**
 * Lignes de la liste d'une semaine : une par workout, avec ce qu'on dit à l'écran.
 * statut : 'fait' (« Fait jeudi 22 octobre »), 'fixe' (jour fixé par le coach), 'aplacer' (le client choisit son jour).
 */
export function lignesSemaine(etat, workouts, aujourdhui) {
  const parId = Object.fromEntries(workouts.map((w) => [w.id, w]))
  return etat.workouts.map((w, i) => {
    const { titre, sous } = titreWorkout(parId[w.workoutId]?.nom || 'Workout')
    let statut = 'aplacer'
    let texte = 'À placer quand vous voulez'
    if (w.fait) {
      statut = 'fait'
      texte = w.jourFait === aujourdhui ? 'Fait aujourd\'hui' : `Fait ${jourLong(w.jourFait)}`
    } else if (w.jourFixe !== null) {
      statut = 'fixe'
      texte = w.jourPlace === aujourdhui ? 'Fixé par votre coach · aujourd\'hui' : `Fixé par votre coach · ${jourLong(w.jourPlace)}`
    }
    return { workoutId: w.workoutId, code: `W${i + 1}`, titre, sous, statut, texte, jour: w.jourPlace }
  })
}

/** Les 7 colonnes de la semaine (lundi -> dimanche) : jour, date, puces de workout posées dans la journée. */
export function colonnesSemaine(etat, lignes, aujourdhui) {
  const parId = Object.fromEntries(lignes.map((l) => [l.workoutId, l]))
  return Array.from({ length: 7 }, (_, i) => {
    const jour = ajouterJours(etat.lundi, i)
    const puces = (etat.parJour[i] || []).map((id) => {
      const l = parId[id]
      const mention = l.statut === 'fait' ? (jour === aujourdhui ? 'fait auj.' : `fait ${jourCourt(jour)}`) : jour === aujourdhui ? 'auj.' : 'coach'
      return { workoutId: id, code: l.code, statut: l.statut, mention, jour }
    })
    return { jour, nom: JOURS_COURTS[i], numero: partie(jour).j, auj: jour === aujourdhui, puces }
  })
}

/**
 * Grille du mois (lundi -> dimanche, 5 ou 6 lignes). `points` par jour : 'fait' (workout réalisé), 'prevu' (jour fixé par le coach,
 * pas encore fait), 'coach' (séance de coaching prévue ou faite).
 */
export function grilleMois({ mois, programme, realisations, seancesCoaching = [], aujourdhui, lundiAffiche }) {
  const premier = `${mois}-01`
  const debut = lundiDe(premier)
  const dernier = ajouterJours(`${ajouterMois(mois, 1)}-01`, -1)
  const nbLignes = Math.floor(diffJours(lundiDe(dernier), debut) / 7) + 1
  const faits = new Set(realisations.filter((r) => !programme || r.clientId === programme.clientId).map((r) => r.date))
  const prevus = new Set()
  if (programme) {
    for (let i = 0; i < nbLignes; i++) {
      const s = etatSemaine(programme, realisations, ajouterJours(debut, i * 7), aujourdhui)
      for (const w of s.workouts) if (!w.fait && w.jourPlace && w.jourPlace >= aujourdhui) prevus.add(w.jourPlace)
    }
  }
  const coachs = new Set(seancesCoaching.filter((s) => s.statut !== 'annulee').map((s) => s.date))
  const lignes = Array.from({ length: nbLignes }, (_, l) => Array.from({ length: 7 }, (_, c) => {
    const jour = ajouterJours(debut, l * 7 + c)
    const points = []
    if (faits.has(jour)) points.push('fait')
    if (prevus.has(jour)) points.push('prevu')
    if (coachs.has(jour)) points.push('coach')
    return { jour, numero: partie(jour).j, horsMois: jour.slice(0, 7) !== mois, auj: jour === aujourdhui, points }
  }))
  const ligneSemaine = lundiAffiche ? Math.floor(diffJours(lundiAffiche, debut) / 7) : -1
  return { lignes, ligneSemaine: ligneSemaine >= 0 && ligneSemaine < nbLignes ? ligneSemaine : -1 }
}

/** Message affiché à la place des colonnes quand la semaine n'a pas de workout (ou null s'il y en a). */
export function messageSemaine(programme, etat) {
  if (!programme) return { titre: 'Pas encore de programme', texte: 'Votre coach prépare votre programme. Écrivez-lui pour qu\'il le prépare plus vite.', ecrire: true }
  if (etat.statut === 'termine') return { titre: 'Programme terminé', texte: 'Votre coach prépare la suite.', termine: true }
  if (etat.statut === 'avenir' && etat.numero < 1) return { titre: 'Pas de programme cette semaine', texte: `Votre programme commence le ${jourLong(programme.debut)}.` }
  if (!etat.total) return { titre: 'Pas de programme cette semaine', texte: 'Rien de prévu pour cette semaine.' }
  return null
}
