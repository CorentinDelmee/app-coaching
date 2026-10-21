// Synthèse du tableau de bord (accueil client) : tout ce que les cartes affichent, calculé ici (pur, testé).
import { etatSemaine, numeroSemaine } from './programme.js'
import { apercuWorkout, titreWorkout } from './workoutUi.js'
import { formaterHeure, prochaineSeance } from './coaching.js'
import { questionnairesDus } from './questionnairesDus.js'
import { accesSante } from './consentement.js'
import { jourLocal } from './dates.js'
import { jourLong, MOIS_COURTS, MOIS_NOMS } from './calendrierUi.js'
import { minutesDe } from './seanceUi.js'

const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * @returns {{prenom, jour, hero, semaine, coaching, programme, questionnaires}}
 *  hero : { etat:'prevu'|'fait'|'bouclee'|'aucun', workoutId|null, etiquette, titre, sous, meta[] }
 *  semaine : { faits, total } ; coaching : null | { date:'Mar. 27', mois:'octobre', heure:'18 h 30', lieu:'à domicile', jourNom:'mardi', num:27, moisCourt:'oct.' }
 *  programme : null | { nom, numero, total|null, segments:boolean[] } ; questionnaires : nombre à remplir
 */
export function syntheseAccueil({ user, programme, workouts, exercices, template, realisations, seancesCoaching, questionnaires, reponses, now }) {
  const aujourdhui = jourLocal(now)
  const prenom = user.nom.split(' ')[0]
  const etat = programme ? etatSemaine(programme, realisations, aujourdhui, aujourdhui) : null
  const actif = !!etat && etat.statut !== 'termine' && etat.total > 0
  const nomDe = (id) => titreWorkout(workouts.find((w) => w.id === id)?.nom || 'Workout')

  let hero = { etat: 'aucun', workoutId: null, etiquette: 'Aujourd\'hui', titre: 'Rien de prévu', sous: programme ? 'Pas de workout cette semaine' : 'Votre coach prépare votre programme', meta: [] }
  if (actif) {
    const restants = etat.workouts.filter((w) => !w.fait)
    const faitAuj = etat.workouts.find((w) => w.jourFait === aujourdhui)
    if (etat.semaineBouclee) {
      hero = { etat: 'bouclee', workoutId: null, etiquette: 'Semaine bouclée', titre: `Bravo ${prenom}`, sous: `${etat.total} workouts sur ${etat.total}`, meta: ['Repos mérité', 'À lundi'] }
    } else if (faitAuj) {
      const r = realisations.find((x) => x.workoutId === faitAuj.workoutId && x.date === aujourdhui)
      const suivant = restants[0]
      hero = {
        etat: 'fait', workoutId: faitAuj.workoutId, etiquette: r?.dureeSec ? `Terminé · ${minutesDe(r.dureeSec)} min` : 'Terminé',
        titre: nomDe(faitAuj.workoutId).titre, sous: nomDe(faitAuj.workoutId).sous, // le message « Bien joué, Fabien. » est dans le titre de l'aplat
        meta: suivant ? [`Prochain : ${nomDe(suivant.workoutId).titre}`, ...(nomDe(suivant.workoutId).sous ? [nomDe(suivant.workoutId).sous] : [])] : []
      }
    } else {
      const prochain = restants.find((w) => w.jourPlace === aujourdhui) || restants[0]
      const w = workouts.find((x) => x.id === prochain.workoutId)
      const t = nomDe(prochain.workoutId)
      const a = w ? apercuWorkout({ workout: w, exercices, template, unite: user.preferences?.unite || 'kg' }) : null
      hero = { etat: 'prevu', workoutId: prochain.workoutId, etiquette: 'Aujourd\'hui', titre: t.titre, sous: t.sous, meta: a ? a.meta : [] }
    }
  }

  const s = prochaineSeance(seancesCoaching, now)
  let coaching = null
  if (s) {
    const [, m, j] = s.date.split('-').map(Number)
    const jourNom = jourLong(s.date).split(' ')[0]
    coaching = {
      date: `${majuscule(jourNom).slice(0, 3)}. ${j}`, mois: MOIS_NOMS[m - 1], heure: formaterHeure(s.heure), lieu: s.lieu === 'domicile' ? 'à domicile' : 'en salle',
      jourNom, num: j, moisCourt: MOIS_COURTS[m - 1] // carte de la maquette V2 : « 27 oct. » puis « mardi · 18 h 30 »
    }
  }

  let prog = null
  if (programme) {
    const numero = numeroSemaine(programme, aujourdhui)
    const total = programme.mode === 'parSemaine' ? programme.semaines.length : programme.nbSemaines || null
    const nb = total || Math.max(4, numero)
    prog = { nom: programme.nom, numero, total, segments: Array.from({ length: nb }, (_, i) => i < Math.min(numero, nb)) }
  }

  return {
    prenom, jour: majuscule(jourLong(aujourdhui)), hero,
    semaine: actif ? { faits: etat.faits, total: etat.total } : { faits: 0, total: 0 },
    coaching, programme: prog,
    sante: accesSante(user),
    questionnaires: accesSante(user) ? questionnairesDus({ questionnaires, reponses, clientId: user.id, aujourdhui }).length : 0
  }
}
