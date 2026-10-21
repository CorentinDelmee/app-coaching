import { describe, it, expect } from 'vitest'
import { etatChrono, evenement as ev, detecterSignal, explication } from '../../src/engine/circuits.js'

const T0 = 1_000_000
const s = (n) => n * 1000
const demarrer = [ev('demarrer', T0)]
const etat = (format, params, evs, secondes) => etatChrono(format, params, evs, T0 + s(secondes))

describe('préparation (commune)', () => {
  it('avant le départ : attente', () => {
    expect(etatChrono('amrap', {}, [], T0).phase).toBe('attente')
    expect(etatChrono('amrap', {}, demarrer, T0 - 1).phase).toBe('attente')
  })
  it('10 s de préparation, décompte arrondi vers le haut', () => {
    expect(etat('amrap', {}, demarrer, 0)).toMatchObject({ phase: 'preparation', preparationRestante: 10, signal: 'preparation' })
    expect(etat('amrap', {}, demarrer, 9.5)).toMatchObject({ phase: 'preparation', preparationRestante: 1 })
    expect(etat('amrap', {}, demarrer, 10)).toMatchObject({ phase: 'travail', preparationRestante: 0, signal: 'go' })
  })
  it('la préparation est paramétrable (0 = départ immédiat)', () => {
    expect(etat('amrap', { preparation: 0 }, demarrer, 0).phase).toBe('travail')
  })
  it('format inconnu : erreur claire', () => {
    expect(() => etat('zumba', {}, demarrer, 20)).toThrow(/inconnu/)
  })
})

describe('AMRAP', () => {
  const p = { duree: 720 }
  it('compte à rebours de la durée, préparation exclue', () => {
    expect(etat('amrap', p, demarrer, 10)).toMatchObject({ restant: 720, tours: 0, phase: 'travail' })
    expect(etat('amrap', p, demarrer, 70)).toMatchObject({ restant: 660 })
  })
  it('+1 tour, -1 tour (correction), jamais négatif', () => {
    const evs = [...demarrer, ev('tour', T0 + s(100)), ev('tour', T0 + s(200)), ev('tour', T0 + s(300))]
    expect(etat('amrap', p, evs, 250).tours).toBe(2)
    expect(etat('amrap', p, [...evs, ev('moins-un-tour', T0 + s(310))], 320).tours).toBe(2)
    expect(etat('amrap', p, [...demarrer, ev('moins-un-tour', T0 + s(50))], 60).tours).toBe(0)
  })
  it('fin : tours + reps en plus demandées puis saisies', () => {
    const evs = [...demarrer, ev('tour', T0 + s(100)), ev('tour', T0 + s(400)), ev('tour', T0 + s(600))]
    const fin = etat('amrap', p, evs, 10 + 720)
    expect(fin).toMatchObject({ phase: 'termine', termine: true, tours: 3, saisieRequise: true, signal: 'fin', restant: 0 })
    expect(fin.resultat).toMatchObject({ tours: 3, repsEnPlus: 0 })
    const saisi = etat('amrap', p, [...evs, ev('reps-en-plus', T0 + s(735), { valeur: 7 })], 740)
    expect(saisi.saisieRequise).toBe(false)
    expect(saisi.resultat).toMatchObject({ tours: 3, repsEnPlus: 7, libelle: '3 tours + 7 reps' })
  })
  it('un tour tapé après la fin n\'est pas compté', () => {
    const evs = [...demarrer, ev('tour', T0 + s(100)), ev('tour', T0 + s(800))]
    expect(etat('amrap', p, evs, 900).tours).toBe(1)
  })
})

describe('EMOM', () => {
  const p = { minutes: 10, exercices: ['Pompes', 'Squats'] }
  it('minute 2/10 avec 59 s restantes à 10 + 61 s', () => {
    expect(etat('emom', p, demarrer, 71)).toMatchObject({ minute: 2, total: 10, restantMinute: 59, exerciceMinute: 'Squats', phase: 'travail', signal: 'minute' })
  })
  it('début de minute pile : 60 s restantes, exercice en alternance', () => {
    expect(etat('emom', p, demarrer, 10)).toMatchObject({ minute: 1, restantMinute: 60, exerciceMinute: 'Pompes', signal: 'go' })
    expect(etat('emom', p, demarrer, 130)).toMatchObject({ minute: 3, restantMinute: 60, exerciceMinute: 'Pompes' })
  })
  it('chaque nouvelle minute change de segment (signal)', () => {
    const a = etat('emom', p, demarrer, 69)
    const b = etat('emom', p, demarrer, 70)
    expect(a.segment).not.toBe(b.segment)
    expect(detecterSignal(a, b)).toBe('minute')
    expect(detecterSignal(b, etat('emom', p, demarrer, 71))).toBe(null)
  })
  it('fin à la dernière minute', () => {
    expect(etat('emom', p, demarrer, 10 + 599)).toMatchObject({ minute: 10, restantMinute: 1, termine: false })
    expect(etat('emom', p, demarrer, 10 + 600)).toMatchObject({ termine: true, phase: 'termine', signal: 'fin' })
  })
  it('sans liste d\'exercices : pas d\'exercice de la minute', () => {
    expect(etat('emom', { minutes: 5 }, demarrer, 20).exerciceMinute).toBe(null)
  })
})

describe('For Time', () => {
  it('chrono qui monte, sans la préparation', () => {
    expect(etat('fortime', {}, demarrer, 10).ecoule).toBe(0)
    expect(etat('fortime', {}, demarrer, 40)).toMatchObject({ ecoule: s(30), phase: 'travail', termine: false })
  })
  it('« Terminé » à 4:32 après 10 s de préparation -> résultat 4:32', () => {
    const evs = [...demarrer, ev('termine', T0 + s(10 + 272))]
    const fin = etat('fortime', { cap: 720 }, evs, 400)
    expect(fin).toMatchObject({ termine: true, ecoule: s(272) })
    expect(fin.resultat).toEqual({ type: 'temps', ms: s(272), libelle: '4:32' })
  })
  it('le chrono reste figé après la fin', () => {
    const evs = [...demarrer, ev('termine', T0 + s(100))]
    expect(etat('fortime', {}, evs, 100).ecoule).toBe(etat('fortime', {}, evs, 5000).ecoule)
  })
  it('cap atteint : fin avec « cap 12:00 »', () => {
    const fin = etat('fortime', { cap: 720 }, demarrer, 10 + 720)
    expect(fin.termine).toBe(true)
    expect(fin.resultat).toEqual({ type: 'cap', cap: s(720), libelle: 'cap 12:00' })
    expect(fin.ecoule).toBe(s(720))
  })
  it('« Terminé » tapé après le cap est ignoré', () => {
    const evs = [...demarrer, ev('termine', T0 + s(10 + 730))]
    expect(etat('fortime', { cap: 720 }, evs, 900).resultat.type).toBe('cap')
  })
  it('sans cap : jamais de fin automatique', () => {
    const fin = etat('fortime', {}, demarrer, 99999)
    expect(fin.termine).toBe(false)
    expect(fin.cap).toBeUndefined()
  })
  it('le cap affiché ne descend pas : seul le chrono monte', () => {
    const a = etat('fortime', { cap: 720 }, demarrer, 100)
    const b = etat('fortime', { cap: 720 }, demarrer, 400)
    expect(a.capAffiche).toBe('12:00')
    expect(b.capAffiche).toBe('12:00')
    expect(b.ecoule).toBeGreaterThan(a.ecoule)
    expect(b.restantCap).toBeLessThan(a.restantCap)
  })
})

describe('Time cap', () => {
  const p = { cap: 480 }
  it('chrono montant jusqu\'au cap, cap fixe', () => {
    const a = etat('timecap', p, demarrer, 100)
    expect(a).toMatchObject({ format: 'timecap', cap: s(480), capAffiche: '8:00', ecoule: s(90), termine: false })
    const b = etat('timecap', p, demarrer, 300)
    expect(b.capAffiche).toBe('8:00')
  })
  it('fin au cap', () => {
    expect(etat('timecap', p, demarrer, 10 + 480).resultat).toEqual({ type: 'cap', cap: s(480), libelle: 'cap 8:00' })
  })
  it('terminé avant le cap : temps réalisé', () => {
    const evs = [...demarrer, ev('termine', T0 + s(10 + 301))]
    expect(etat('timecap', p, evs, 500).resultat).toMatchObject({ type: 'temps', libelle: '5:01' })
  })
})

describe('Death by', () => {
  it('minute N = N répétitions', () => {
    expect(etat('deathby', {}, demarrer, 10)).toMatchObject({ minute: 1, repsMinute: 1, signal: 'go' })
    expect(etat('deathby', {}, demarrer, 10 + 3 * 60 + 5)).toMatchObject({ minute: 4, repsMinute: 4, restantMinute: 55, signal: 'minute' })
  })
  it('échec en minute 7 -> résultat « 6 minutes » (dernière minute réussie)', () => {
    const evs = [...demarrer, ev('echec', T0 + s(10 + 6 * 60 + 20))]
    const fin = etat('deathby', {}, evs, 700)
    expect(fin).toMatchObject({ termine: true, minute: 7 })
    expect(fin.resultat).toEqual({ type: 'deathby', minutes: 6, reps: 6, libelle: '6 minutes' })
  })
  it('échec dès la première minute : 0 minute', () => {
    const evs = [...demarrer, ev('echec', T0 + s(30))]
    expect(etat('deathby', {}, evs, 40).resultat).toMatchObject({ minutes: 0, reps: 0, libelle: '0 minute' })
  })
  it('échec pile à la limite d\'une minute compte la nouvelle minute', () => {
    const evs = [...demarrer, ev('echec', T0 + s(10 + 120))]
    expect(etat('deathby', {}, evs, 200).resultat.minutes).toBe(2)
  })
  it('paramètres de départ et d\'incrément', () => {
    expect(etat('deathby', { repsDepart: 2, increment: 2 }, demarrer, 10 + 120).repsMinute).toBe(6)
  })
})

describe('Tabata et intervalles', () => {
  it('Tabata à 10 + 25 s : tour 1/8, repos, reste 5 s', () => {
    expect(etat('tabata', {}, demarrer, 35)).toMatchObject({ tour: 1, totalTours: 8, phase: 'repos', restant: 5, signal: 'repos' })
  })
  it('début : travail 20 s, signal go', () => {
    expect(etat('tabata', {}, demarrer, 10)).toMatchObject({ tour: 1, phase: 'travail', restant: 20, signal: 'go' })
    expect(etat('tabata', {}, demarrer, 29.9)).toMatchObject({ phase: 'travail', restant: 1 })
  })
  it('tour suivant : 30 s après le début, retour au travail', () => {
    expect(etat('tabata', {}, demarrer, 40)).toMatchObject({ tour: 2, phase: 'travail', restant: 20, signal: 'travail' })
  })
  it('fin après le 8e travail (pas de repos final) : 10 + 230 s', () => {
    expect(etat('tabata', {}, demarrer, 10 + 229)).toMatchObject({ tour: 8, phase: 'travail', termine: false })
    expect(etat('tabata', {}, demarrer, 10 + 230)).toMatchObject({ termine: true, signal: 'fin' })
  })
  it('chaque transition travail/repos change de segment', () => {
    const seg = [10, 29, 30, 39, 40, 59, 60].map((t) => etat('tabata', {}, demarrer, t).segment)
    expect(seg).toEqual([2, 2, 3, 3, 4, 4, 5])
  })
  it('intervalles paramétrables, repos final possible', () => {
    const p = { tours: 3, travail: 40, repos: 20 }
    expect(etat('intervalles', p, demarrer, 10 + 45)).toMatchObject({ tour: 1, phase: 'repos', restant: 15, totalTours: 3 })
    expect(etat('intervalles', p, demarrer, 10 + 3 * 60 - 20).termine).toBe(true)
    expect(etat('intervalles', { ...p, reposFinal: true }, demarrer, 10 + 3 * 60 - 20).termine).toBe(false)
  })
})

describe('Superset', () => {
  const p = { exercices: ['Pompes', 'Rowing'], tours: 2, repos: 60 }
  const suiv = (sec) => ev('suivant', T0 + s(sec))
  it('A puis B enchaînés, sans repos entre les deux', () => {
    expect(etat('superset', p, demarrer, 10)).toMatchObject({ tour: 1, exerciceIndex: 0, exerciceCourant: 'Pompes', phase: 'travail', signal: 'go' })
    expect(etat('superset', p, [...demarrer, suiv(30)], 31)).toMatchObject({ exerciceIndex: 1, exerciceCourant: 'Rowing', phase: 'travail' })
  })
  it('repos après le passage complet', () => {
    const evs = [...demarrer, suiv(30), suiv(60)]
    expect(etat('superset', p, evs, 90)).toMatchObject({ phase: 'repos', restant: 30, signal: 'repos' })
    const apres = etat('superset', p, evs, 125)
    expect(apres).toMatchObject({ phase: 'travail', tour: 2, exerciceIndex: 0, signal: 'travail' })
  })
  it('passer le repos', () => {
    const evs = [...demarrer, suiv(30), suiv(60), ev('passer-repos', T0 + s(70))]
    expect(etat('superset', p, evs, 75).phase).toBe('travail')
  })
  it('fin sans repos final, résultat avec durée', () => {
    const evs = [...demarrer, suiv(30), suiv(60), suiv(130), suiv(200)]
    const fin = etat('superset', p, evs, 210)
    expect(fin).toMatchObject({ termine: true, phase: 'termine', signal: 'fin' })
    expect(fin.resultat).toMatchObject({ tours: 2, libelle: '2 passages en 3:10' })
  })
  it('pas de repos pendant le premier exercice du tour', () => {
    expect(etat('superset', p, demarrer, 500).phase).toBe('travail')
  })
})

describe('pause / reprise', () => {
  it('une pause gèle le chrono et la reprise ne le fait pas dériver', () => {
    const evs = [...demarrer, ev('pause', T0 + s(40)), ev('reprendre', T0 + s(100))]
    expect(etat('fortime', {}, evs, 70)).toMatchObject({ ecoule: s(30), enPause: true })
    expect(etat('fortime', {}, evs, 99)).toMatchObject({ ecoule: s(30), enPause: true })
    expect(etat('fortime', {}, evs, 120)).toMatchObject({ ecoule: s(50), enPause: false })
  })
  it('pause pendant la préparation', () => {
    const evs = [...demarrer, ev('pause', T0 + s(4)), ev('reprendre', T0 + s(64))]
    expect(etat('amrap', {}, evs, 30)).toMatchObject({ phase: 'preparation', preparationRestante: 6, enPause: true })
    expect(etat('amrap', {}, evs, 70)).toMatchObject({ phase: 'travail', preparationRestante: 0 })
  })
  it('plusieurs pauses : le temps final exclut toutes les pauses et la préparation', () => {
    const evs = [
      ...demarrer, ev('pause', T0 + s(30)), ev('reprendre', T0 + s(60)),
      ev('pause', T0 + s(90)), ev('reprendre', T0 + s(100)), ev('termine', T0 + s(130))
    ]
    // actif : 130 - 30 - 10 = 90 s ; moins 10 s de préparation = 80 s
    expect(etat('fortime', {}, evs, 200).resultat).toMatchObject({ ms: s(80), libelle: '1:20' })
  })
  it('un événement pendant la pause est ignoré', () => {
    const evs = [...demarrer, ev('pause', T0 + s(40)), ev('tour', T0 + s(50)), ev('reprendre', T0 + s(100))]
    expect(etat('amrap', {}, evs, 200).tours).toBe(0)
  })
  it('un EMOM en pause garde sa minute', () => {
    const evs = [...demarrer, ev('pause', T0 + s(75))]
    const a = etat('emom', { minutes: 10 }, evs, 76)
    const b = etat('emom', { minutes: 10 }, evs, 500)
    expect(a.minute).toBe(2)
    expect(b).toMatchObject({ minute: 2, restantMinute: a.restantMinute, enPause: true })
  })
  it('état sérialisable : même résultat après aller-retour JSON', () => {
    const evs = JSON.parse(JSON.stringify([...demarrer, ev('tour', T0 + s(60))]))
    expect(etat('amrap', { duree: 300 }, evs, 100).tours).toBe(1)
  })
})

describe('signaux et explication', () => {
  it('detecterSignal : rien sans transition, signal à l\'entrée du segment', () => {
    const a = etat('tabata', {}, demarrer, 5)
    const b = etat('tabata', {}, demarrer, 10)
    expect(detecterSignal(null, a)).toBe('preparation')
    expect(detecterSignal(a, b)).toBe('go')
    expect(detecterSignal(b, etat('tabata', {}, demarrer, 11))).toBe(null)
    expect(detecterSignal(null, etatChrono('tabata', {}, [], T0))).toBe(null)
  })
  it('texte d\'explication par format', () => {
    expect(explication('amrap', { duree: 720 })).toBe('AMRAP — objectif : faire le plus de tours possible en 12 min.')
    expect(explication('fortime', { cap: 720 })).toContain('cap à 12:00')
    expect(explication('tabata')).toContain('8 tours de 20 s')
    for (const f of ['emom', 'timecap', 'deathby', 'intervalles', 'superset']) expect(explication(f)).not.toBe('')
  })
})

import { butCircuit, minutesDesExercices } from '../../src/domain/circuitsUi.js'
describe('page circuit : but et minutes EMOM', () => {
  it('but sans le nom du format', () => {
    expect(butCircuit('amrap', { duree: 480 })).toBe('Faire le plus de tours possible en 8 min.')
    expect(butCircuit('emom', { minutes: 6 })).toMatch(/^Toutes les minutes, pendant 6 min/)
    expect(butCircuit('fortime', {})).toMatch(/^Terminer le travail/)
  })
  it('minutes de chaque exercice d\'un EMOM', () => {
    expect(minutesDesExercices(2, 6)).toEqual(['minutes 1, 3, 5', 'minutes 2, 4, 6'])
    expect(minutesDesExercices(3, 6)).toEqual(['minutes 1, 4', 'minutes 2, 5', 'minutes 3, 6'])
    expect(minutesDesExercices(1, 6)).toEqual([])
  })
})
