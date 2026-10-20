import { describe, it, expect } from 'vitest'
import { reduire, demarrerSeance } from '../../src/engine/seance.js'
import { construireRealisation, mettreAJourTemplate, appliquerRealisation, fusionnerFile, meilleuresCharges } from '../../src/domain/realisations.js'
import { numeroSemaine, etatSemaine, historiqueSemaines, workoutsDeSemaine } from '../../src/domain/programme.js'
import * as C from '../../src/domain/coaching.js'
import { alertesClient } from '../../src/domain/alertes.js'
import { horodatage } from '../../src/domain/dates.js'
import { validerRealisation } from '../../src/domain/modele.js'

const NOW = new Date(2026, 9, 20, 10, 0).getTime() // mardi 20 octobre 2026 (semaine du lundi 19)
const heures = (n) => n * 3600000
const jours = (n) => n * 86400000

// ---------------------------------------------------------------------------------------------- 1.9
const workout = {
  id: 'w1', nom: 'Workout 1',
  blocs: [
    { type: 'exercice', id: 'b1', exerciceId: 'ex-squat', champs: [{ cle: 'poids', modifiableParClient: true }, { cle: 'reps', modifiableParClient: true }], repos: 60, series: [{ poids: 50, reps: 8 }, { poids: 50, reps: 8 }] },
    { type: 'exercice', id: 'b2', exerciceId: 'ex-pompes', champs: [{ cle: 'reps', modifiableParClient: true }], series: [{ reps: 10 }] }
  ]
}
function faireSeance(template, poids, { commentaire, toutesSeries = true } = {}) {
  let e = demarrerSeance({ workout, clientId: 'c1', template }, NOW)
  e = reduire(e, { type: 'modifierValeur', exIdx: 0, serieIdx: 0, champ: 'poids', valeur: poids }, NOW)
  e = reduire(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, NOW)
  if (toutesSeries) {
    e = reduire(e, { type: 'modifierValeur', exIdx: 0, serieIdx: 1, champ: 'poids', valeur: poids }, NOW)
    e = reduire(e, { type: 'validerSerie', exIdx: 0, serieIdx: 1 }, NOW)
  }
  e = reduire(e, { type: 'terminer', commentaire }, NOW + 1800000)
  return e
}

describe('enregistrement de la séance (1.9)', () => {
  it('crée une réalisation valide', () => {
    const r = construireRealisation(faireSeance(null, 60), { id: 'r1', now: NOW + 1800000, programmeId: 'p1' })
    expect(validerRealisation(r).erreurs).toEqual([])
    expect(r).toMatchObject({ clientId: 'c1', workoutId: 'w1', date: '2026-10-20', semaine: '2026-10-19', dureeSec: 1800, volume: 60 * 8 * 2, programmeId: 'p1' })
    expect(r.valeurs.b1.series).toEqual([{ poids: 60, reps: 8 }, { poids: 60, reps: 8 }])
    expect(r.valeurs.b2.series).toEqual([null]) // exercice non fait
  })
  it('refuse une séance non terminée', () => {
    expect(() => construireRealisation(demarrerSeance({ workout }, NOW), { id: 'r', clientId: 'c1', now: NOW })).toThrow(/pas terminée/)
  })
  it('après validation à 60 kg, la séance suivante démarre pré-remplie à 60 kg', () => {
    const r = construireRealisation(faireSeance(null, 60), { id: 'r1', now: NOW })
    const template = mettreAJourTemplate(null, r)
    const suivante = demarrerSeance({ workout, template }, NOW + jours(7))
    expect(suivante.exercices[0].series.map((s) => s.valeurs.poids)).toEqual([60, 60])
    expect(suivante.exercices[0].series[0].prescrit.poids).toBe(50)
  })
  it('seules les valeurs réellement validées mettent à jour le template', () => {
    const r1 = construireRealisation(faireSeance(null, 60), { id: 'r1', now: NOW })
    const t1 = mettreAJourTemplate(null, r1)
    const r2 = construireRealisation(faireSeance(t1, 70, { toutesSeries: false }), { id: 'r2', now: NOW + 1 })
    const t2 = mettreAJourTemplate(t1, r2)
    expect(t2.valeurs.w1.b1).toEqual([{ poids: 70, reps: 8 }, { poids: 60, reps: 8 }]) // 2e série non faite : ancienne valeur gardée
    expect(t1.valeurs.w1.b1[0].poids).toBe(60) // template précédent intact
  })
  it('commentaire conservé (→ alerte coach), vide ignoré', () => {
    const avec = construireRealisation(faireSeance(null, 60, { commentaire: ' Genou sensible ' }), { id: 'r1', now: NOW })
    expect(avec.commentaire).toBe('Genou sensible')
    const sans = construireRealisation(faireSeance(null, 60, { commentaire: '   ' }), { id: 'r2', now: NOW })
    expect('commentaire' in sans).toBe(false)
  })
  it('rejouer deux fois la même file n\'enregistre qu\'une réalisation', () => {
    const r = construireRealisation(faireSeance(null, 60), { id: 'r-unique', now: NOW })
    const file = [r]
    const premier = fusionnerFile({ realisations: [], template: null }, file)
    expect(premier.ajoutees).toBe(1)
    const second = fusionnerFile({ realisations: premier.realisations, template: premier.template }, file)
    expect(second.ajoutees).toBe(0)
    expect(second.realisations).toHaveLength(1)
    expect(appliquerRealisation({ realisations: premier.realisations, template: premier.template }, r).ajoutee).toBe(false)
  })
  it('une file rejouée suit l\'ordre chronologique (la dernière valeur gagne)', () => {
    const a = construireRealisation(faireSeance(null, 60), { id: 'a', now: NOW })
    const b = construireRealisation(faireSeance(null, 80), { id: 'b', now: NOW + 5000 })
    const res = fusionnerFile({ realisations: [], template: null }, [b, a])
    expect(res.template.valeurs.w1.b1[0].poids).toBe(80)
  })
  it('meilleures charges par exercice', () => {
    const a = construireRealisation(faireSeance(null, 60), { id: 'a', now: NOW })
    const b = construireRealisation(faireSeance(null, 75), { id: 'b', now: NOW })
    expect(meilleuresCharges([a, b])).toEqual({ 'ex-squat': 75 })
    expect(meilleuresCharges([])).toEqual({})
  })
})

// ---------------------------------------------------------------------------------------------- 1.10
describe('programme et calendrier (1.10)', () => {
  const rep = { id: 'p', clientId: 'c1', nom: 'P', mode: 'repete', debut: '2026-10-05', workouts: ['w1', 'w2', 'w3'] }
  const fait = (workoutId, date) => ({ id: `${workoutId}-${date}`, clientId: 'c1', workoutId, date })
  it('numéro de semaine du programme', () => {
    expect(numeroSemaine(rep, '2026-10-05')).toBe(1)
    expect(numeroSemaine(rep, '2026-10-11')).toBe(1)
    expect(numeroSemaine(rep, '2026-10-20')).toBe(3)
    expect(numeroSemaine(rep, '2026-10-04')).toBe(0)
  })
  it('2 workouts faits sur 3 -> « 2/3 », 3/3 -> semaine bouclée', () => {
    const deux = etatSemaine(rep, [fait('w1', '2026-10-19'), fait('w2', '2026-10-20')], '2026-10-20')
    expect(deux).toMatchObject({ libelle: '2/3', faits: 2, total: 3, semaineBouclee: false, statut: 'enCours', aFaire: ['w3'] })
    const trois = etatSemaine(rep, [fait('w1', '2026-10-19'), fait('w2', '2026-10-20'), fait('w3', '2026-10-21')], '2026-10-21')
    expect(trois).toMatchObject({ libelle: '3/3', semaineBouclee: true, aFaire: [] })
  })
  it('un workout fait un jeudi est placé dans la colonne jeudi', () => {
    const s = etatSemaine(rep, [fait('w1', '2026-10-22')], '2026-10-22')
    expect(s.parJour[3]).toEqual(['w1'])
    expect(s.workouts[0]).toMatchObject({ fait: true, jourFait: '2026-10-22', jourPlace: '2026-10-22' })
    expect(s.aFaire).toEqual(['w2', 'w3'])
  })
  it('refaire un workout la même semaine ne compte qu\'une fois (jour le plus récent)', () => {
    const s = etatSemaine(rep, [fait('w1', '2026-10-19'), fait('w1', '2026-10-21')], '2026-10-21')
    expect(s.faits).toBe(1)
    expect(s.workouts[0].jourFait).toBe('2026-10-21')
  })
  it('les réalisations des autres semaines ou clients ne comptent pas', () => {
    const autres = [fait('w1', '2026-10-12'), { ...fait('w2', '2026-10-20'), clientId: 'c2' }]
    expect(etatSemaine(rep, autres, '2026-10-20').faits).toBe(0)
  })
  it('jours fixés par le coach : placés dans le calendrier, absents de « À faire »', () => {
    const fixe = { ...rep, joursFixes: { w2: 3 } }
    const s = etatSemaine(fixe, [], '2026-10-20')
    expect(s.parJour[3]).toEqual(['w2'])
    expect(s.workouts[1]).toMatchObject({ jourFixe: 3, jourPlace: '2026-10-22', fait: false })
    expect(s.aFaire).toEqual(['w1', 'w3'])
  })
  it('mode par semaine : workouts de la semaine N', () => {
    const ps = { id: 'p', clientId: 'c1', nom: 'P', mode: 'parSemaine', debut: '2026-10-05', semaines: [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']] }
    expect(workoutsDeSemaine(ps, 2)).toEqual(['c', 'd'])
    expect(etatSemaine(ps, [], '2026-10-20').workouts.map((w) => w.workoutId)).toEqual(['e', 'f'])
  })
  it('programme de 4 semaines en semaine 5 -> terminé', () => {
    const ps = { id: 'p', clientId: 'c1', nom: 'P', mode: 'parSemaine', debut: '2026-10-05', semaines: [['a'], ['b'], ['c'], ['d']] }
    expect(numeroSemaine(ps, '2026-11-02')).toBe(5)
    expect(etatSemaine(ps, [], '2026-11-02')).toMatchObject({ statut: 'termine', total: 0 })
    expect(etatSemaine(ps, [], '2026-10-26').statut).toBe('enCours') // semaine 4
  })
  it('programme pas encore commencé : à venir', () => {
    expect(etatSemaine(rep, [], '2026-09-28').statut).toBe('avenir')
  })
  it('semaine passée ou à venir par rapport à aujourd\'hui', () => {
    expect(etatSemaine(rep, [], '2026-10-12', '2026-10-20').statut).toBe('passee')
    expect(etatSemaine(rep, [], '2026-10-27', '2026-10-20').statut).toBe('avenir')
  })
  it('historique des semaines, la plus récente en premier', () => {
    const h = historiqueSemaines(rep, [fait('w1', '2026-10-07'), fait('w2', '2026-10-08'), fait('w3', '2026-10-09')], '2026-10-20')
    expect(h.map((x) => x.numero)).toEqual([3, 2, 1])
    expect(h[2]).toMatchObject({ libelle: '3/3', semaineBouclee: true, statut: 'passee' })
    expect(h[0].statut).toBe('enCours')
  })
})

// ---------------------------------------------------------------------------------------------- 1.11
describe('calculs coaching (1.11)', () => {
  const s = (id, date, statut, tarif = 35, heure = '18:30') => ({ id, clientId: 'c1', date, heure, lieu: 'domicile', statut, tarif })
  it('prochaine séance : prévue et à venir, sinon null', () => {
    const liste = [s('a', '2026-10-15', 'faite'), s('b', '2026-10-24', 'prevue'), s('c', '2026-10-21', 'prevue'), s('d', '2026-10-22', 'annulee')]
    expect(C.prochaineSeance(liste, NOW).id).toBe('c')
    expect(C.prochaineSeance([s('a', '2026-10-15', 'faite')], NOW)).toBe(null)
    expect(C.prochaineSeance([], NOW)).toBe(null)
    expect(C.prochaineSeance([s('p', '2026-10-19', 'prevue')], NOW)).toBe(null) // passée et jamais marquée faite
  })
  it('rang dans le mois : 3 séances non annulées + 1 annulée -> la 3e affiche rang 3', () => {
    const liste = [s('a', '2026-10-06', 'faite'), s('x', '2026-10-09', 'annulee'), s('b', '2026-10-13', 'faite'), s('c', '2026-10-21', 'prevue')]
    expect(C.rangDansLeMois(liste, liste[3])).toBe(3)
    expect(C.rangDansLeMois(liste, liste[0])).toBe(1)
    expect(C.rangDansLeMois(liste, liste[1])).toBe(null)
    expect(C.phraseRang(3)).toBe('C\'est votre 3e séance du mois')
    expect(C.phraseRang(1)).toBe('C\'est votre 1re séance du mois')
  })
  it('rang : le mois est calendaire, tri par date puis heure', () => {
    const liste = [s('a', '2026-09-29', 'faite'), s('b', '2026-10-01', 'faite', 35, '19:00'), s('c', '2026-10-01', 'faite', 35, '08:00')]
    expect(C.rangDansLeMois(liste, liste[2])).toBe(1)
    expect(C.rangDansLeMois(liste, liste[1])).toBe(2)
  })
  it('nombre de séances de la semaine (lun-dim) et du mois, annulées exclues', () => {
    const liste = [s('a', '2026-10-18', 'faite'), s('b', '2026-10-19', 'faite'), s('c', '2026-10-25', 'prevue'), s('d', '2026-10-26', 'prevue'), s('e', '2026-10-21', 'annulee')]
    expect(C.nbSeancesSemaine(liste, NOW)).toBe(2)
    expect(C.nbSeancesMois(liste, NOW)).toBe(4)
  })
  it('payé ce mois : 2 faites à 35 € -> 70 € ; annulées et prévues exclues', () => {
    const liste = [s('a', '2026-10-06', 'faite'), s('b', '2026-10-13', 'faite'), s('c', '2026-10-21', 'prevue'), s('d', '2026-10-09', 'annulee'), s('e', '2026-09-30', 'faite')]
    expect(C.payeCeMois(liste, NOW)).toEqual({ nb: 2, total: 70, libelle: 'Payé ce mois : 2 × 35 € = 70 €' })
  })
  it('payé ce mois : aucune séance faite -> 0 €, tarifs mélangés -> total', () => {
    expect(C.payeCeMois([s('c', '2026-10-21', 'prevue')], NOW).libelle).toBe('Payé ce mois : 0 €')
    expect(C.payeCeMois([s('a', '2026-10-06', 'faite', 35), s('b', '2026-10-13', 'faite', 50)], NOW).libelle).toBe('Payé ce mois : 85 €')
  })
  it('le tarif figé de la séance prime sur un tarif modifié ensuite', () => {
    expect(C.payeCeMois([s('a', '2026-10-06', 'faite', 30)], NOW).total).toBe(30)
  })
  it('délai : séance dans 23 h -> moins de 24 h ; 25 h -> non ; passée -> non', () => {
    const dans = (h) => { const d = new Date(NOW + heures(h)); const p = (n) => String(n).padStart(2, '0'); return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, heure: `${p(d.getHours())}:${p(d.getMinutes())}` } }
    expect(C.moinsDe24h({ ...s('a', '', 'prevue'), ...dans(23) }, NOW)).toBe(true)
    expect(C.moinsDe24h({ ...s('a', '', 'prevue'), ...dans(25) }, NOW)).toBe(false)
    expect(C.moinsDe24h({ ...s('a', '', 'prevue'), ...dans(-2) }, NOW)).toBe(false)
  })
  it('libellé « mardi 21 octobre, 18 h 30, à domicile »', () => {
    expect(C.libelleSeance(s('a', '2026-10-21', 'prevue'))).toBe('mercredi 21 octobre, 18 h 30, à domicile')
    expect(C.libelleSeance({ ...s('a', '2026-10-27', 'prevue'), heure: '09:00', lieu: 'salle' })).toBe('mardi 27 octobre, 9 h, en salle')
    expect(C.libelleSeance(s('a', '2026-11-01', 'prevue'))).toContain('dimanche 1er novembre')
  })
  it('WhatsApp : lien encodé avec message pré-rempli', () => {
    const lien = C.lienWhatsApp('+33 6 12 34 56 78', 'Bonjour Corentin, c\'est Fabien & co')
    expect(lien).toBe('https://wa.me/33612345678?text=Bonjour%20Corentin%2C%20c\'est%20Fabien%20%26%20co')
    expect(C.lienWhatsApp('', 'Salut')).toBe('https://wa.me/?text=Salut')
    expect(C.messageAnnuler(s('a', '2026-10-21', 'prevue'), 'Fabien')).toContain('annuler ma séance du mercredi 21 octobre')
    expect(C.messageModifier(s('a', '2026-10-21', 'prevue'), 'Fabien')).toContain('modifier')
    expect(C.messageEcrire('Fabien')).toContain('Fabien')
  })
})

// ---------------------------------------------------------------------------------------------- 1.12
describe('alertes coach (1.12)', () => {
  const profil = { id: 'c1', role: 'client', identifiant: 'a.b', nom: 'A B', creeLe: NOW - jours(30), archive: false }
  const checkin = (joursAvant, douleur = 1) => ({
    id: `r${joursAvant}`, clientId: 'c1', questionnaireId: 'q', frequence: 'quotidien',
    date: new Date(NOW - jours(joursAvant)).toISOString().slice(0, 10), valeurs: { douleur }
  })
  // (NOW est à 10 h heure locale ; toISOString peut décaler d'un jour en UTC+x : on fabrique les dates en local)
  const local = (joursAvant) => { const d = new Date(NOW - jours(joursAvant)); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  const rep = (joursAvant, douleur = 1) => ({ ...checkin(joursAvant, douleur), date: local(joursAvant) })
  const types = (a) => a.map((x) => x.type)

  it('dernier check-in il y a 3 jours -> alerte ; il y a 2 jours -> non', () => {
    expect(types(alertesClient({ profil, reponses: [rep(3)] }, NOW))).toEqual(['checkin'])
    expect(alertesClient({ profil, reponses: [rep(2)] }, NOW)).toEqual([])
    expect(alertesClient({ profil, reponses: [rep(0)] }, NOW)).toEqual([])
  })
  it('les questionnaires hebdo ne remplacent pas le check-in quotidien', () => {
    const hebdo = { ...rep(0), frequence: 'hebdo' }
    expect(types(alertesClient({ profil, reponses: [hebdo] }, NOW))).toEqual(['checkin'])
  })
  it('aucun check-in jamais : alerte si le client existe depuis 3 jours ou plus, pas avant', () => {
    expect(types(alertesClient({ profil }, NOW))).toEqual(['checkin'])
    expect(alertesClient({ profil: { ...profil, creeLe: NOW - jours(2) } }, NOW)).toEqual([])
    expect(types(alertesClient({ profil: { ...profil, creeLe: NOW - jours(3) } }, NOW))).toEqual(['checkin'])
  })
  it('douleur 6 -> non, 7 -> oui (check-in)', () => {
    expect(alertesClient({ profil, reponses: [rep(0, 6)] }, NOW)).toEqual([])
    expect(types(alertesClient({ profil, reponses: [rep(0, 7)] }, NOW))).toEqual(['douleur'])
  })
  it('douleur de la carte du corps : > 6 sur les 7 derniers jours seulement', () => {
    const d = (joursAvant, intensite) => ({ id: `d${joursAvant}`, clientId: 'c1', zone: 'genou-gauche', intensite, date: local(joursAvant) })
    expect(types(alertesClient({ profil, reponses: [rep(0)], douleurs: [d(6, 8)] }, NOW))).toEqual(['douleur'])
    expect(alertesClient({ profil, reponses: [rep(0)], douleurs: [d(7, 8)] }, NOW)).toEqual([])
    expect(alertesClient({ profil, reponses: [rep(0)], douleurs: [d(1, 6)] }, NOW)).toEqual([])
  })
  it('séance commentée -> alerte', () => {
    const r = { id: 'real1', clientId: 'c1', date: local(5), commentaire: 'Dos tendu' }
    const a = alertesClient({ profil, reponses: [rep(0)], realisations: [r, { id: 'real2', commentaire: '  ' }] }, NOW)
    expect(types(a)).toEqual(['commentaire'])
    expect(a[0].message).toContain('Dos tendu')
  })
  it('une alerte marquée vue ne revient pas ; une nouvelle absence crée une nouvelle alerte', () => {
    const premiere = alertesClient({ profil, reponses: [rep(4)] }, NOW)
    const vues = [{ id: premiere[0].id, clientId: 'c1', vueLe: NOW }]
    expect(alertesClient({ profil, reponses: [rep(4)], alertesVues: vues }, NOW)).toEqual([])
    expect(alertesClient({ profil, reponses: [rep(4)], alertesVues: vues }, NOW + jours(2))).toEqual([])
    // après un nouveau check-in puis une nouvelle absence : clé différente
    expect(types(alertesClient({ profil, reponses: [rep(4), rep(10 - 10 + 3)], alertesVues: vues }, NOW))).toEqual(['checkin'])
  })
  it('client archivé ou coach : aucune alerte', () => {
    expect(alertesClient({ profil: { ...profil, archive: true }, reponses: [rep(10, 9)] }, NOW)).toEqual([])
    expect(alertesClient({ profil: { ...profil, role: 'coach' } }, NOW)).toEqual([])
  })
  it('horodatage utilitaire cohérent', () => {
    expect(horodatage('2026-10-20', '10:00')).toBe(NOW)
  })
})
