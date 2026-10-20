import { describe, it, expect } from 'vitest'
import { syntheseAccueil } from '../../src/domain/accueil.js'
import { questionnairesDus } from '../../src/domain/questionnairesDus.js'
import { formaterHeure, libelleSeance, moinsDe24h, phraseRang } from '../../src/domain/coaching.js'
import { genererDemo } from '../../src/data/demo/index.js'

const NOW = new Date(2026, 9, 22, 12).getTime() // jeudi 22 octobre 2026
const demo = genererDemo(NOW)
const profil = (id) => demo.profils.find((p) => p.identifiant === id)
const base = (id, extra = {}) => {
  const user = profil(id)
  return {
    user, programme: demo.programmes.find((p) => p.clientId === user.id), workouts: demo.workouts.filter((w) => w.clientId === user.id),
    exercices: demo.exercices, template: demo.templates.find((t) => t.id === user.id),
    realisations: demo.realisations.filter((r) => r.clientId === user.id), seancesCoaching: demo.seancesCoaching.filter((s) => s.clientId === user.id),
    questionnaires: demo.questionnaires, reponses: demo.reponses.filter((r) => r.clientId === user.id), now: NOW, ...extra
  }
}

describe('synthèse du tableau de bord', () => {
  it('Fabien : workout du jour, semaine, coaching, programme, pastille', () => {
    const s = syntheseAccueil(base('fabien.vincent'))
    expect(s.prenom).toBe('Fabien')
    expect(s.jour).toBe('Jeudi 22 octobre')
    expect(s.hero).toMatchObject({ etat: 'prevu', etiquette: 'Aujourd\'hui' })
    expect(s.hero.meta[0]).toMatch(/^≈ \d+ min$/)
    expect(s.semaine.total).toBe(3)
    expect(s.coaching).toEqual({ date: 'Sam. 24', mois: 'octobre', heure: '18 h 30', lieu: 'à domicile' })
    expect(s.programme).toMatchObject({ nom: 'Programme Fabien Vincent', numero: 4, total: null })
    expect(s.programme.segments.filter(Boolean)).toHaveLength(4)
    expect(s.questionnaires).toBe(1) // bilan hebdo à faire ; check-in du jour déjà fait
  })
  it('workout fait aujourd\'hui : carte « fait » avec le prochain', () => {
    const b = base('fabien.vincent')
    const w = b.programme.workouts[1]
    const s = syntheseAccueil({ ...b, realisations: [...b.realisations, { clientId: b.user.id, workoutId: w, date: '2026-10-22', dureeSec: 3100 }] })
    expect(s.hero.etat).toBe('fait')
    expect(s.hero.etiquette).toBe('Terminé · 52 min')
    expect(s.hero.meta[0]).toMatch(/^Prochain : /)
  })
  it('semaine bouclée', () => {
    const b = base('fabien.vincent')
    const r = b.programme.workouts.map((w, i) => ({ clientId: b.user.id, workoutId: w, date: `2026-10-${19 + i}`, dureeSec: 1800 }))
    const s = syntheseAccueil({ ...b, realisations: r })
    expect(s.hero.etat).toBe('bouclee')
    expect(s.semaine).toEqual({ faits: 3, total: 3 })
  })
  it('aucune séance de coaching prévue, aucun programme, pas de pastille', () => {
    const t = syntheseAccueil(base('thomas.bernard'))
    expect(t.coaching).toBe(null)
    const sans = syntheseAccueil(base('fabien.vincent', { programme: null, questionnaires: [] }))
    expect(sans.hero.etat).toBe('aucun')
    expect(sans.programme).toBe(null)
    expect(sans.questionnaires).toBe(0)
  })
})

describe('questionnaires à remplir', () => {
  const q = [{ id: 'a', clientId: null, frequence: 'quotidien' }, { id: 'b', clientId: null, frequence: 'hebdo' }, { id: 'c', clientId: null, frequence: 'ponctuel' }, { id: 'd', clientId: 'autre', frequence: 'quotidien' }]
  const rep = (questionnaireId, date) => ({ clientId: 'x', questionnaireId, date })
  it('quotidien / hebdo / ponctuel, et ceux des autres clients ignorés', () => {
    const dus = (reponses) => questionnairesDus({ questionnaires: q, reponses, clientId: 'x', aujourdhui: '2026-10-22' }).map((z) => z.id)
    expect(dus([])).toEqual(['a', 'b', 'c'])
    expect(dus([rep('a', '2026-10-22'), rep('b', '2026-10-19'), rep('c', '2026-01-01')])).toEqual([])
    expect(dus([rep('a', '2026-10-21'), rep('b', '2026-10-18')])).toEqual(['a', 'b', 'c'])
  })
})

describe('page Coaching : libellés', () => {
  it('séance, heure, rang, délai de 24 h', () => {
    const s = { date: '2026-10-27', heure: '18:30', lieu: 'domicile', statut: 'prevue' }
    expect(libelleSeance(s)).toBe('mardi 27 octobre, 18 h 30, à domicile')
    expect(formaterHeure('09:00')).toBe('9 h')
    expect(phraseRang(1)).toBe('C\'est votre 1re séance du mois')
    expect(phraseRang(3)).toBe('C\'est votre 3e séance du mois')
    expect(moinsDe24h({ date: '2026-10-23', heure: '09:00' }, NOW)).toBe(true)
    expect(moinsDe24h({ date: '2026-10-24', heure: '18:30' }, NOW)).toBe(false)
  })
})
