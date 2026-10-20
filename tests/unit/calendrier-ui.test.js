import { describe, it, expect } from 'vitest'
import { colonnesSemaine, grilleMois, jourLong, libelleSemaine, lignesSemaine, messageSemaine, ajouterMois } from '../../src/domain/calendrierUi.js'
import { apercuWorkout, dureeCircuitSec, etatBouton, titreWorkout } from '../../src/domain/workoutUi.js'
import { etatSemaine } from '../../src/domain/programme.js'
import { genererDemo } from '../../src/data/demo/index.js'

// Jeudi 22 octobre 2026, midi
const NOW = new Date(2026, 9, 22, 12).getTime()
const AUJ = '2026-10-22'
const demo = genererDemo(NOW)
const fabien = demo.profils.find((p) => p.identifiant === 'fabien.vincent')
const prog = demo.programmes.find((p) => p.clientId === fabien.id)
const reals = demo.realisations.filter((r) => r.clientId === fabien.id)

describe('libellés de dates', () => {
  it('jour long, semaine, mois', () => {
    expect(jourLong('2026-10-22')).toBe('jeudi 22 octobre')
    expect(libelleSemaine('2026-10-19')).toBe('19 – 25 oct.')
    expect(libelleSemaine('2026-09-28')).toBe('28 sept. – 4 oct.')
    expect(ajouterMois('2026-12', 1)).toBe('2027-01')
    expect(ajouterMois('2026-01', -1)).toBe('2025-12')
  })
})

describe('semaine : lignes et colonnes', () => {
  it('un workout fait est coché avec son jour', () => {
    const etat = etatSemaine(prog, reals, AUJ, AUJ)
    const lignes = lignesSemaine(etat, demo.workouts, AUJ)
    const faits = lignes.filter((l) => l.statut === 'fait')
    expect(faits.length).toBe(etat.faits)
    for (const l of faits) expect(l.texte).toMatch(/^Fait /)
  })
  it('faire un workout un jeudi : coché dans la colonne jeudi, disparu de « à faire »', () => {
    const avant = etatSemaine(prog, [], AUJ, AUJ)
    const w1 = prog.workouts[0]
    const apres = etatSemaine(prog, [{ clientId: fabien.id, workoutId: w1, date: AUJ }], AUJ, AUJ)
    const col = colonnesSemaine(apres, lignesSemaine(apres, demo.workouts, AUJ), AUJ).find((c) => c.jour === AUJ)
    expect(col.auj).toBe(true)
    expect(col.puces).toEqual([expect.objectContaining({ workoutId: w1, statut: 'fait', mention: 'fait auj.' })])
    expect(avant.aFaire).toContain(w1)
    expect(apres.aFaire).not.toContain(w1)
  })
  it('jour fixé par le coach : puce « coach » au bon jour', () => {
    const p = { ...prog, joursFixes: { [prog.workouts[2]]: 4 } }
    const e = etatSemaine(p, [], AUJ, AUJ)
    const l = lignesSemaine(e, demo.workouts, AUJ).find((x) => x.workoutId === prog.workouts[2])
    expect(l.statut).toBe('fixe')
    expect(l.texte).toBe('Fixé par votre coach · vendredi 23 octobre')
    expect(colonnesSemaine(e, lignesSemaine(e, demo.workouts, AUJ), AUJ)[4].puces[0].statut).toBe('fixe')
  })
})

describe('messages de cas limites', () => {
  it('pas de programme, avant le début, après la fin, semaine vide', () => {
    expect(messageSemaine(null, {}).titre).toBe('Pas encore de programme')
    const avant = etatSemaine(prog, [], '2026-01-05', AUJ)
    expect(messageSemaine(prog, avant).titre).toBe('Pas de programme cette semaine')
    const lea = demo.programmes.find((p) => p.mode === 'parSemaine')
    const fin = etatSemaine(lea, [], '2027-03-01', AUJ)
    expect(messageSemaine(lea, fin)).toMatchObject({ titre: 'Programme terminé', termine: true })
    expect(messageSemaine(prog, etatSemaine(prog, [], AUJ, AUJ))).toBe(null)
  })
  it('semaine bouclée', () => {
    const r = prog.workouts.map((w, i) => ({ clientId: fabien.id, workoutId: w, date: `2026-10-${19 + i}` }))
    expect(etatSemaine(prog, r, AUJ, AUJ).semaineBouclee).toBe(true)
  })
})

describe('grille du mois', () => {
  it('octobre 2026 : 5 lignes lundi->dimanche, aujourd\'hui, points, semaine affichée', () => {
    const g = grilleMois({ mois: '2026-10', programme: prog, realisations: reals, aujourdhui: AUJ, lundiAffiche: '2026-10-19' })
    expect(g.lignes).toHaveLength(5)
    expect(g.lignes[0][0].jour).toBe('2026-09-28')
    expect(g.lignes[0][0].horsMois).toBe(true)
    expect(g.ligneSemaine).toBe(3)
    expect(g.lignes.flat().filter((c) => c.auj)).toHaveLength(1)
    expect(g.lignes.flat().some((c) => c.points.includes('fait'))).toBe(true)
  })
  it('les séances de coaching annulées ne comptent pas', () => {
    const g = grilleMois({ mois: '2026-10', programme: null, realisations: [], aujourdhui: AUJ, seancesCoaching: [{ date: '2026-10-27', statut: 'prevue' }, { date: '2026-10-28', statut: 'annulee' }] })
    const c = g.lignes.flat()
    expect(c.find((x) => x.jour === '2026-10-27').points).toEqual(['coach'])
    expect(c.find((x) => x.jour === '2026-10-28').points).toEqual([])
  })
})

describe('aperçu du workout', () => {
  const w2 = demo.workouts.find((w) => w.id === 'w-fabien-2')
  const template = demo.templates.find((t) => t.id === fabien.id)
  const a = apercuWorkout({ workout: w2, exercices: demo.exercices, template })
  it('titre, méta et blocs (superset séparé)', () => {
    expect(a.titre).toBe('Workout 2')
    expect(a.sous).toBe('Haut du corps')
    expect(a.meta[0]).toMatch(/^≈ \d+ min$/)
    expect(a.sections.map((s) => s.kind)).toEqual(['bloc', 'superset', 'bloc'])
    expect(a.sections[1].exos.map((e) => e.lettre)).toEqual(['A', 'B'])
  })
  it('valeurs pré-remplies depuis le template du client', () => {
    const premier = a.sections[0].exos[0]
    expect(premier.puces[0]).toBe('4 × 8 reps')
    expect(premier.prerempli).toBe(true)
    expect(premier.puces.join(' ')).toMatch(/kg/)
  })
  it('sans consigne : null (pas de bloc vide)', () => {
    expect(a.consigne).toBe(null)
    expect(apercuWorkout({ workout: demo.workouts.find((w) => w.id === 'w-fabien-1'), exercices: demo.exercices }).consigne).toMatch(/Échauffe-toi/)
  })
  it('circuits : format et durée', () => {
    const w3 = apercuWorkout({ workout: demo.workouts.find((w) => w.id === 'w-fabien-3'), exercices: demo.exercices })
    const circuits = w3.sections.filter((s) => s.kind === 'circuit')
    expect(circuits.map((c) => c.nom)).toEqual(['AMRAP', 'EMOM'])
    expect(circuits[0].detail).toBe('8 minutes')
    expect(circuits[0].exos[0]).toMatchObject({ nom: 'Burpees', reps: 5 })
    expect(w3.meta).toContain('2 circuits')
  })
  it('durées de circuit et titre sans tiret', () => {
    expect(dureeCircuitSec('tabata')).toBe(240)
    expect(dureeCircuitSec('amrap', { duree: 600 })).toBe(600)
    expect(titreWorkout('Full body')).toEqual({ titre: 'Full body', sous: '' })
    expect(titreWorkout('Semaine 2 — Séance A')).toEqual({ titre: 'Séance A', sous: 'Semaine 2' })
  })
})

describe('bouton principal', () => {
  const base = { workoutId: 'w1', aujourdhui: AUJ, realisations: [], enCours: null }
  it('démarrer / refaire / reprendre', () => {
    expect(etatBouton(base).action).toBe('demarrer')
    expect(etatBouton({ ...base, realisations: [{ workoutId: 'w1', date: AUJ }] })).toMatchObject({ action: 'refaire', mention: 'Fait aujourd\'hui' })
    expect(etatBouton({ ...base, realisations: [{ workoutId: 'w1', date: '2026-10-20' }] }).action).toBe('demarrer')
    expect(etatBouton({ ...base, enCours: { workoutId: 'w1' }, realisations: [{ workoutId: 'w1', date: AUJ }] }).action).toBe('reprendre')
  })
})
