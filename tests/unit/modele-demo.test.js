import { describe, it, expect } from 'vitest'
import { genererDemo, COMPTES_DEMO } from '../../src/data/demo/index.js'
import * as M from '../../src/domain/modele.js'
import { numeroSemaine, etatSemaine } from '../../src/domain/programme.js'
import { jourLocal } from '../../src/domain/dates.js'

const NOW = new Date(2026, 9, 20, 10, 0).getTime() // mardi 20 octobre 2026
const demo = genererDemo(NOW)

describe('validateurs du modèle', () => {
  it('toutes les données factices respectent le modèle', () => {
    const regles = {
      profils: M.validerProfil, exercices: M.validerExercice, workouts: M.validerWorkout, programmes: M.validerProgramme,
      realisations: M.validerRealisation, templates: M.validerTemplateClient, seancesCoaching: M.validerSeanceCoaching,
      motsDuCoach: M.validerMotDuCoach, questionnaires: M.validerQuestionnaire, reponses: M.validerReponse,
      mesures: M.validerMesure, douleurs: M.validerDouleur, nutrition: M.validerEntreeNutrition
    }
    for (const [cle, valider] of Object.entries(regles)) {
      expect(demo[cle].length, cle).toBeGreaterThan(0)
      for (const o of demo[cle]) {
        const r = valider(o)
        expect(r.erreurs, `${cle} ${o.id}`).toEqual([])
      }
    }
  })

  it('un champ manquant donne un message lisible qui nomme l\'entité et le champ', () => {
    expect(M.validerExercice({ id: 'x', categories: [] }).erreurs).toEqual(['Exercice : le champ « nom » est obligatoire'])
    expect(M.validerDouleur({ id: 'd', clientId: 'c', zone: 'dos', intensite: 11, date: '2026-10-20' }).erreurs[0]).toMatch(/Douleur.*« intensite ».*au plus 10/)
    expect(M.validerSeanceCoaching({}).erreurs).toContain('Séance de coaching : le champ « date » est obligatoire')
    expect(M.validerProfil(null).erreurs[0]).toMatch(/Profil/)
  })

  it('refuse un bloc de séance sans champ « modifiableParClient » et un format de circuit inconnu', () => {
    const base = { id: 'w', nom: 'W', blocs: [{ type: 'exercice', id: 'b', exerciceId: 'e', champs: [{ cle: 'poids' }], series: [{ poids: 1 }] }] }
    expect(M.validerWorkout(base).erreurs[0]).toMatch(/modifiableParClient/)
    const c = { id: 'w', nom: 'W', blocs: [{ type: 'circuit', id: 'c', format: 'zumba', exercices: [] }] }
    expect(M.validerWorkout(c).erreurs[0]).toMatch(/format/)
  })

  it('un client doit avoir tarif, lieu et modules', () => {
    const r = M.validerProfil({ id: 'a', role: 'client', identifiant: 'a.b', nom: 'A B', creeLe: 1 })
    expect(r.erreurs).toHaveLength(3)
  })
})

describe('données factices', () => {
  it('80 exercices aux noms uniques, sans vidéo, catégories variées', () => {
    expect(demo.exercices).toHaveLength(80)
    expect(new Set(demo.exercices.map((e) => e.nom)).size).toBe(80)
    expect(new Set(demo.exercices.map((e) => e.id)).size).toBe(80)
    expect(demo.exercices.every((e) => e.lienVideo === null)).toBe(true)
    const cats = new Set(demo.exercices.flatMap((e) => e.categories))
    for (const c of ['jambes', 'poussee', 'tirage', 'gainage', 'cardio', 'mobilite']) expect(cats.has(c)).toBe(true)
  })

  it('Fabien Vincent : 3 workouts par semaine, domicile 35 €, commencé il y a 3 semaines', () => {
    const fabien = demo.profils.find((p) => p.identifiant === 'fabien.vincent')
    expect(fabien).toMatchObject({ role: 'client', tarif: 35, lieuDefaut: 'domicile' })
    const prog = demo.programmes.find((p) => p.clientId === fabien.id)
    expect(prog.mode).toBe('repete')
    expect(prog.workouts).toHaveLength(3)
    expect(numeroSemaine(prog, jourLocal(NOW))).toBe(4)
    const passees = demo.realisations.filter((r) => r.clientId === fabien.id && r.date < '2026-10-19')
    expect(passees).toHaveLength(9)
  })

  it('Fabien : séances de coaching passées et au moins une à venir', () => {
    const fabien = demo.profils.find((p) => p.identifiant === 'fabien.vincent')
    const s = demo.seancesCoaching.filter((x) => x.clientId === fabien.id)
    expect(s.some((x) => x.statut === 'faite')).toBe(true)
    expect(s.some((x) => x.statut === 'annulee')).toBe(true)
    expect(s.some((x) => x.statut === 'prevue' && x.date > jourLocal(NOW))).toBe(true)
  })

  it('autres clients : Léa en salle à 50 € par semaine sur 4 semaines, Thomas sans séance prévue', () => {
    const lea = demo.profils.find((p) => p.identifiant === 'lea.martin')
    expect(lea).toMatchObject({ tarif: 50, lieuDefaut: 'salle' })
    const prog = demo.programmes.find((p) => p.clientId === lea.id)
    expect(prog).toMatchObject({ mode: 'parSemaine' })
    expect(prog.semaines).toHaveLength(4)
    const thomas = demo.profils.find((p) => p.identifiant === 'thomas.bernard')
    expect(demo.seancesCoaching.filter((s) => s.clientId === thomas.id && s.statut === 'prevue')).toHaveLength(0)
  })

  it('chaque format de circuit est présent, ainsi qu\'une série en temps de travail et un superset', () => {
    const blocs = demo.workouts.flatMap((w) => w.blocs)
    const formats = new Set(blocs.filter((b) => b.type === 'circuit').map((b) => b.format))
    expect([...formats].sort()).toEqual([...M.FORMATS_CIRCUIT].sort())
    expect(blocs.some((b) => b.type === 'exercice' && b.series.some((s) => 'tempsTravail' in s))).toBe(true)
    expect(blocs.some((b) => b.type === 'superset')).toBe(true)
  })

  it('les deux questionnaires couvrent les 7 types de question', () => {
    const types = new Set(demo.questionnaires.flatMap((q) => q.questions.map((x) => x.type)))
    expect([...types].sort()).toEqual([...M.TYPES_QUESTION].sort())
    expect(demo.questionnaires.map((q) => q.frequence).sort()).toEqual(['hebdo', 'quotidien'])
    const quotidien = demo.questionnaires.find((q) => q.frequence === 'quotidien')
    expect(quotidien.questions.map((q) => q.cle)).toEqual(['sommeil', 'energie', 'stress', 'douleur', 'faim', 'hydratation'])
  })

  it('les dates sont relatives à aujourd\'hui (la démo reste vivante)', () => {
    const plus = genererDemo(NOW + 30 * 86400000)
    const dernier = (d) => d.reponses.filter((r) => r.clientId === 'client-fabien-vincent').map((r) => r.date).sort().pop()
    expect(dernier(demo)).toBe('2026-10-20')
    expect(dernier(plus)).toBe('2026-11-19')
  })

  it('semaine en cours de Fabien cohérente et comptes de démo présents', () => {
    const fabien = demo.profils.find((p) => p.identifiant === 'fabien.vincent')
    const prog = demo.programmes.find((p) => p.clientId === fabien.id)
    const s = etatSemaine(prog, demo.realisations.filter((r) => r.clientId === fabien.id), jourLocal(NOW))
    expect(s.total).toBe(3)
    expect(COMPTES_DEMO.map((c) => c.identifiant)).toEqual(['corentin', 'fabien.vincent', 'lea.martin', 'thomas.bernard'])
    expect(Object.keys(demo.comptes)).toHaveLength(4)
  })
})
