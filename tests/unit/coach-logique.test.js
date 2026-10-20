import { describe, it, expect } from 'vitest'
import {
  messageIdentifiants, lienWhatsAppIdentifiants, basculerChamp, fixerNbSeries, nouveauBloc, nouvelleSerie, clePerso, deplacer,
  dupliquerWorkout, dupliquerProgramme, retirerWorkoutDuProgramme, nouvelleQuestion, cleDepuisLibelle, construireCourbe,
  chargesRealisees, pointsPoids, grilleMois, nouvelItemExercice, synchroniserExercicesCircuit, renommerPourClient, dateFr
} from '../../src/coach/logique.js'
import { validerWorkout, validerQuestionnaire } from '../../src/domain/modele.js'

let n = 0
const uuid = () => `id${++n}`

describe('messages', () => {
  it('message avec identifiant et code, lien WhatsApp encodé', () => {
    const infos = { nom: 'Léa Martin', identifiant: 'lea.martin', code: 'ABC234', url: 'https://app.test' }
    expect(messageIdentifiants(infos)).toContain('Bonjour Léa')
    expect(messageIdentifiants(infos)).toContain('Code : ABC234')
    const lien = lienWhatsAppIdentifiants(infos, '+33 6 12 34 56 78')
    expect(lien.startsWith('https://wa.me/33612345678?text=')).toBe(true)
    expect(decodeURIComponent(lien)).toContain('lea.martin')
  })
})

describe('champs et séries', () => {
  it('ajouter / retirer un champ met les séries à jour', () => {
    let it1 = nouvelItemExercice('a', 'x')
    it1 = basculerChamp(it1, 'rpe')
    expect(it1.champs.map((c) => c.cle)).toEqual(['poids', 'reps', 'rpe'])
    expect(it1.series[0].rpe).toBe(7)
    it1 = basculerChamp(it1, 'poids')
    expect(it1.series[0]).not.toHaveProperty('poids')
  })
  it('nombre de séries : copie la dernière, minimum 1', () => {
    const base = nouvelItemExercice('a', 'x')
    base.series[2].reps = 12
    expect(fixerNbSeries(base, 5).series[4].reps).toBe(12)
    expect(fixerNbSeries(base, 0).series).toHaveLength(1)
  })
  it('champ personnalisé : clé unique', () => {
    expect(clePerso('Grip large')).toBe('perso:grip-large')
    expect(clePerso('Grip large', ['perso:grip-large'])).toBe('perso:grip-large-2')
  })
  it('un workout construit avec les blocs est valide', () => {
    const w = { id: 'w', nom: 'Test', clientId: null, blocs: [nouveauBloc('exercice', uuid, 'ex1'), nouveauBloc('superset', uuid, 'ex1'), nouveauBloc('circuit', uuid)] }
    expect(validerWorkout(w)).toEqual({ ok: true, erreurs: [] })
  })
  it('deplacer ne sort pas des bornes', () => {
    expect(deplacer([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(deplacer([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
  })
  it("emom : la liste d'exercices des paramètres suit les exercices", () => {
    const b = synchroniserExercicesCircuit({ format: 'emom', params: { minutes: 6 }, exercices: [{ exerciceId: 'a' }, { exerciceId: 'b' }] })
    expect(b.params).toEqual({ minutes: 6, exercices: ['a', 'b'] })
  })
  it('nouvelleSerie suit les champs', () => {
    expect(nouvelleSerie([{ cle: 'poidsDuCorps' }, { cle: 'tempo' }])).toEqual({ poidsDuCorps: false, tempo: '' })
  })
})

describe('valeurs par défaut', () => {
  it('un exercice ajouté est prévu 3 × 10, pas 3 × 0', () => {
    const it1 = nouvelItemExercice('a', 'x')
    expect(it1.series).toHaveLength(3)
    expect(it1.series.every((s) => s.reps === 10)).toBe(true)
  })
})

describe('duplication', () => {
  const w1 = { id: 'w1', clientId: 'c1', nom: 'W1', blocs: [] }
  const w2 = { id: 'w2', clientId: 'c1', nom: 'W2', blocs: [] }
  it('séance : nouvel id, nouveau client, original intact', () => {
    const c = dupliquerWorkout(w1, 'c2', uuid)
    expect(c.id).not.toBe('w1')
    expect(c.clientId).toBe('c2')
    expect(w1.clientId).toBe('c1')
  })
  it('programme répété : séances copiées pour le client cible, jours fixés suivent', () => {
    const p = { id: 'p', clientId: 'c1', nom: 'P', mode: 'repete', debut: '2026-10-19', workouts: ['w1', 'w2'], joursFixes: { w1: 0, w2: 3 } }
    const { programme, workouts } = dupliquerProgramme(p, [w1, w2], 'c2', uuid)
    expect(programme.clientId).toBe('c2')
    expect(programme.id).not.toBe('p')
    expect(workouts.map((w) => w.id).sort()).toEqual([...programme.workouts].sort())
    expect(workouts.every((w) => w.clientId === 'c2')).toBe(true)
    const [a, b] = programme.workouts
    expect(programme.joursFixes).toEqual({ [a]: 0, [b]: 3 })
  })
  it("programme par semaine : une séance utilisée deux fois n'est copiée qu'une fois", () => {
    const p = { id: 'p', clientId: 'c1', nom: 'P', mode: 'parSemaine', debut: '2026-10-19', semaines: [['w1'], ['w1', 'w2']] }
    const { programme, workouts } = dupliquerProgramme(p, [w1, w2], 'c2', uuid)
    expect(workouts).toHaveLength(2)
    expect(programme.semaines[0][0]).toBe(programme.semaines[1][0])
  })
  it('le nom de l ancien client ne fuit pas chez le destinataire', () => {
    const p = { id: 'p', clientId: 'c1', nom: 'Programme Fabien Vincent', mode: 'repete', debut: '2026-10-19', workouts: ['w1'] }
    const src = [{ id: 'w1', clientId: 'c1', nom: 'Séance Fabien Vincent — Haut', blocs: [] }]
    const { programme, workouts } = dupliquerProgramme(p, src, 'c2', uuid, undefined, { ancien: 'Fabien Vincent', nouveau: 'Léa Martin' })
    expect(programme.nom).toBe('Programme Léa Martin')
    expect(workouts[0].nom).toBe('Séance Léa Martin — Haut')
    expect(renommerPourClient('Full body', 'Fabien Vincent', 'Léa Martin')).toBe('Full body')
  })
  it('dates en français', () => {
    expect(dateFr('2026-09-28')).toBe('lun. 28 sept.')
    expect(dateFr('2025-01-05', 2026)).toBe('dim. 5 janv. 2025')
  })
  it('retirer une séance du programme nettoie les jours fixés', () => {
    const p = { mode: 'repete', workouts: ['a', 'b'], joursFixes: { a: 1, b: 2 } }
    const r = retirerWorkoutDuProgramme(p, 'a')
    expect(r.workouts).toEqual(['b'])
    expect(r.joursFixes).toEqual({ b: 2 })
  })
})

describe('questionnaires', () => {
  it('chaque type donne une question valide', () => {
    const types = ['curseur', 'choixUnique', 'choixMultiple', 'emojis', 'nombre', 'texte', 'photo']
    const questions = types.map((t, i) => ({ ...nouvelleQuestion(t, []), cle: `q${i}`, libelle: `Q${i}` }))
    expect(validerQuestionnaire({ id: 'q', nom: 'N', frequence: 'ponctuel', questions }).ok).toBe(true)
  })
  it('clé issue du libellé, unique', () => {
    expect(cleDepuisLibelle('Ton poids du matin')).toBe('tonPoidsDuMatin')
    expect(cleDepuisLibelle('Poids', ['poids'])).toBe('poids2')
  })
})

describe('courbes et vue client', () => {
  it('courbe : points triés, dans le cadre, chemin SVG', () => {
    const c = construireCourbe([{ date: '2026-10-10', valeur: 72 }, { date: '2026-10-01', valeur: 75 }], { largeur: 200, hauteur: 100, marge: 10 })
    expect(c.points[0].date).toBe('2026-10-01')
    expect(c.points[0].x).toBe(10)
    expect(c.points[1].x).toBe(190)
    expect(c.points[0].y).toBe(10)
    expect(c.chemin.startsWith('M10.0,10.0 L190.0')).toBe(true)
  })
  it('courbe : un seul point ou aucun ne plante', () => {
    expect(construireCourbe([]).chemin).toBe('')
    expect(construireCourbe([{ date: '2026-10-01', valeur: 70 }]).points).toHaveLength(1)
  })
  it('poids : une mesure prime sur la réponse du même jour', () => {
    const pts = pointsPoids([{ date: '2026-10-01', poids: 70 }], [{ date: '2026-10-01', valeurs: { poids: 71 } }, { date: '2026-10-08', valeurs: { poids: 72 } }])
    expect(pts).toEqual([{ date: '2026-10-01', valeur: 70 }, { date: '2026-10-08', valeur: 72 }])
  })
  it('charges réalisées : meilleure charge par séance, séries non faites ignorées', () => {
    const r = [
      { date: '2026-10-01', valeurs: { b1: { exerciceId: 'sq', series: [{ poids: 60, reps: 8 }, null, { poids: 65, reps: 6 }] } } },
      { date: '2026-10-08', valeurs: { b1: { exerciceId: 'sq', series: [{ poids: 70, reps: 5 }] }, b2: { exerciceId: 'pl', series: [{ reps: 30 }] } } }
    ]
    const c = chargesRealisees(r, (id) => id)
    expect(c).toHaveLength(1)
    expect(c[0].historique).toEqual([{ date: '2026-10-08', poids: 70, reps: 5, series: 1 }, { date: '2026-10-01', poids: 65, reps: 6, series: 2 }])
  })
  it('grille du mois : semaines lundi-dimanche couvrant tout le mois', () => {
    const g = grilleMois('2026-10')
    expect(g[0][0]).toBe('2026-09-28')
    expect(g.flat()).toContain('2026-10-31')
    expect(g.every((s) => s.length === 7)).toBe(true)
  })
})
