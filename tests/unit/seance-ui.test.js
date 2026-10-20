import { describe, it, expect } from 'vitest'
import { idYoutube, videoDe } from '../../src/domain/video.js'
import { poidsAffiche, poidsStocke, lbVersKg } from '../../src/domain/unites.js'
import { configRoue } from '../../src/domain/roue.js'
import { jetonsSerie, libelleAction, puces, derniereFois, serieCourante, estAuTemps } from '../../src/domain/seanceUi.js'
import { modeleChrono, secondesAvantChangement, titreCircuit, etapesExplication } from '../../src/domain/circuitsUi.js'
import { etatChrono, evenement } from '../../src/engine/circuits.js'
import { demarrerSeance } from '../../src/engine/seance.js'

describe('liens vidéo', () => {
  it('reconnaît les formes courantes de liens YouTube', () => {
    const id = 'dQw4w9WgXcQ'
    for (const l of [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?t=3`, `https://m.youtube.com/watch?v=${id}&list=x`,
      `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube-nocookie.com/embed/${id}`]) {
      expect(idYoutube(l), l).toBe(id)
    }
  })
  it('refuse ce qui n\'est pas YouTube', () => {
    expect(idYoutube('https://vimeo.com/12345678901')).toBe(null)
    expect(idYoutube('pas un lien')).toBe(null)
    expect(idYoutube(undefined)).toBe(null)
    expect(idYoutube('https://www.youtube.com/watch?v=court')).toBe(null)
  })
  it('intégrée en youtube-nocookie, sinon ouverte, sinon rien', () => {
    expect(videoDe({ lienVideo: 'https://youtu.be/dQw4w9WgXcQ' })).toMatchObject({ type: 'youtube', embed: expect.stringContaining('youtube-nocookie.com/embed/dQw4w9WgXcQ') })
    expect(videoDe({ lienVideo: 'https://vimeo.com/1' })).toEqual({ type: 'lien', lien: 'https://vimeo.com/1' })
    for (const lien of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://x.fr/a', 'pas un lien'])
      expect(videoDe({ lienVideo: lien })).toEqual({ type: 'aucune' })
    expect(videoDe({})).toEqual({ type: 'aucune' })
    expect(videoDe(undefined)).toEqual({ type: 'aucune' })
  })
})

describe('unités', () => {
  it('kg tels quels, lb arrondies à l\'unité', () => {
    expect(poidsAffiche(60, 'kg')).toBe(60)
    expect(poidsAffiche(60, 'lb')).toBe(132)
  })
  it('une valeur saisie en lb se retrouve à l\'identique à l\'affichage', () => {
    for (const lb of [45, 135, 225, 317]) expect(poidsAffiche(lbVersKg(lb), 'lb')).toBe(lb)
    expect(poidsStocke(60, 'kg')).toBe(60)
  })
})

describe('roue de valeur', () => {
  it('poids : pas de 0,5 kg, jamais négatif, index de la valeur actuelle', () => {
    const r = configRoue('poids', 62.5)
    expect(r).toMatchObject({ min: 0, pas: 0.5, unite: 'kg' })
    expect(r.valeurDe(0)).toBe(0)
    expect(r.valeurDe(r.index)).toBe(62.5)
    expect(r.valeurDe(r.index + 1)).toBe(63)
    expect(Math.min(...Array.from({ length: r.nb }, (_, i) => r.valeurDe(i)))).toBeGreaterThanOrEqual(0)
  })
  it('reps : pas de 1 ; temps : pas de 5 s', () => {
    expect(configRoue('reps', 8).pas).toBe(1)
    const t = configRoue('tempsTravail', 30)
    expect(t.pas).toBe(5)
    expect(t.valeurDe(t.index)).toBe(30)
  })
  it('en lb : pas de 1 lb, la valeur enregistrée repasse en kg', () => {
    const r = configRoue('poids', 60, 'lb')
    expect(r).toMatchObject({ unite: 'lb', pas: 1 })
    expect(r.valeurDe(r.index)).toBe(132)
    expect(r.stocke(r.indexDe(135))).toBe(lbVersKg(135))
  })
  it('une valeur fixée au-delà du plafond reste atteignable ; sans valeur on part du minimum', () => {
    const r = configRoue('reps', 250)
    expect(r.valeurDe(r.index)).toBe(250)
    expect(configRoue('reps', null).index).toBe(0)
  })
  it('RPE borné entre 1 et 10', () => {
    const r = configRoue('rpe', 7)
    expect([r.min, r.max]).toEqual([1, 10])
  })
})

const champsCharge = [{ cle: 'poids', modifiableParClient: true }, { cle: 'reps', modifiableParClient: true }]
const workout = {
  id: 'w', nom: 'W',
  blocs: [
    { type: 'exercice', id: 'b1', exerciceId: 'squat', champs: champsCharge, repos: 90, series: [{ poids: 60, reps: 8 }, { poids: 60, reps: 8 }] },
    { type: 'exercice', id: 'b2', exerciceId: 'planche', champs: [{ cle: 'tempsTravail', modifiableParClient: false }], repos: 45, series: [{ tempsTravail: 30 }] },
    { type: 'exercice', id: 'b3', exerciceId: 'pompes', champs: [{ cle: 'reps', modifiableParClient: true }], series: [{ reps: 12 }] }
  ]
}

describe('lignes de série et boutons', () => {
  const e = demarrerSeance({ workout }, 0)
  it('8 × 60 kg / 30 s / 12 reps', () => {
    expect(jetonsSerie(e.exercices[0].champs, e.exercices[0].series[0].valeurs).map((j) => j.texte + (j.unite || ''))).toEqual(['8', '×', '60kg'])
    expect(jetonsSerie(e.exercices[1].champs, e.exercices[1].series[0].valeurs)).toEqual([{ type: 'val', texte: '30', unite: 's' }])
    expect(jetonsSerie(e.exercices[2].champs, e.exercices[2].series[0].valeurs)).toEqual([{ type: 'val', texte: '12', unite: 'reps' }])
  })
  it('poids affiché en lb selon la préférence, virgule française', () => {
    expect(jetonsSerie(champsCharge, { poids: 60, reps: 8 }, 'lb')[2]).toEqual({ type: 'val', texte: '132', unite: 'lb' })
    expect(jetonsSerie(champsCharge, { poids: 57.5, reps: 8 })[2].texte).toBe('57,5')
  })
  it('valeur vide : un tiret', () => {
    expect(jetonsSerie([{ cle: 'reps' }], { reps: null })[0].texte).toBe('–')
  })
  it('bouton principal : Valider / Lancer / Exercice suivant / Terminer', () => {
    expect(libelleAction(e.exercices[0])).toBe('Valider la série 1')
    expect(libelleAction(e.exercices[1])).toBe('Lancer la série 1')
    expect(estAuTemps(e.exercices[1])).toBe(true)
    expect(estAuTemps(e.exercices[0])).toBe(false)
    const fait = { ...e.exercices[0], series: e.exercices[0].series.map((s) => ({ ...s, faite: true })) }
    expect(serieCourante(fait)).toBe(-1)
    expect(libelleAction(fait)).toBe('Exercice suivant')
    expect(libelleAction(fait, { derniereEtape: true })).toBe('Terminer la séance')
    expect(libelleAction(e.exercices[0], { toutFait: true })).toBe('Terminer la séance')
  })
  it('puces d\'en-tête', () => {
    expect(puces(e.exercices[0])).toEqual(['2 × 8 reps', '60 kg', 'repos 90 s'])
    expect(puces(e.exercices[1])).toEqual(['1 × 30 s', 'repos 45 s'])
  })
  it('dernière fois', () => {
    const realisations = [
      { termineLe: 1, valeurs: { b1: { exerciceId: 'squat', series: [{ poids: 50, reps: 8 }] } } },
      { termineLe: 2, valeurs: { b1: { exerciceId: 'squat', series: [null, { poids: 57.5, reps: 8 }] } } }
    ]
    expect(derniereFois(realisations, 'squat')).toBe('8 × 57,5 kg')
    expect(derniereFois(realisations, 'inconnu')).toBe(null)
  })
})

describe('chrono de circuit : ce que l\'écran affiche', () => {
  const T0 = 1_000_000
  const s = (n) => n * 1000
  const avec = (format, params, evs, t) => etatChrono(format, params, [evenement('demarrer', T0), ...evs], T0 + s(t))
  const m = (format, params, evs, t) => modeleChrono(avec(format, params, evs, t))

  it('préparation : décompte, anneau qui se vide, pas d\'action', () => {
    const x = m('amrap', { duree: 720 }, [], 4)
    expect(x).toMatchObject({ theme: 'prep', etiquette: 'Préparation', grand: '6', action: null })
    expect(x.anneau).toBeCloseTo(0.6)
    expect(x.anneauProchain).toBeCloseTo(0.5)
  })
  it('AMRAP : compte à rebours de la durée, tour en cours, bouton +1 tour', () => {
    const x = m('amrap', { duree: 720 }, [evenement('tour', T0 + s(40))], 70)
    expect(x).toMatchObject({ theme: 'travail', grand: '11:00', sous: 'Tour 2 en cours', action: { id: 'tour', libelle: '+1 tour' } })
  })
  it('EMOM : minute x/N, compte à rebours de la minute, exercice de la minute', () => {
    const x = m('emom', { minutes: 6, exercices: ['Swing', 'Pompes'] }, [], 10 + 75)
    expect(x).toMatchObject({ etiquette: 'Minute 2 / 6', sous: 'Pompes', grand: '0:45' })
  })
  it('For Time : le chrono monte, le cap affiché ne change pas', () => {
    const a = m('fortime', { cap: 720 }, [], 10 + 60)
    const b = m('fortime', { cap: 720 }, [], 10 + 300)
    expect([a.grand, b.grand]).toEqual(['1:00', '5:00'])
    expect(a.sous).toBe('Cap 12:00')
    expect(b.sous).toBe('Cap 12:00')
    expect(a.action.id).toBe('termine')
  })
  it('For Time sans cap : pas d\'anneau', () => {
    expect(m('fortime', {}, [], 10 + 30).anneau).toBe(null)
  })
  it('For Time terminé : le temps final exclut la préparation', () => {
    const x = m('fortime', { cap: 720 }, [evenement('termine', T0 + s(10 + 125))], 10 + 130)
    expect(x).toMatchObject({ termine: true, etiquette: 'Terminé', grand: '2:05' })
  })
  it('Time cap atteint : le cap est affiché', () => {
    const x = m('timecap', { cap: 480 }, [], 10 + 481)
    expect(x).toMatchObject({ termine: true, etiquette: 'Cap atteint', grand: '8:00' })
  })
  it('Death by : minute N = N répétitions, bouton Échec ; résultat = dernière minute réussie', () => {
    expect(m('deathby', {}, [], 10 + 130)).toMatchObject({ etiquette: 'Minute 3', sous: '3 répétitions', action: { id: 'echec', libelle: 'Échec' } })
    const fin = m('deathby', {}, [evenement('echec', T0 + s(10 + 190))], 10 + 195)
    expect(fin).toMatchObject({ termine: true, grand: '3', petit: 'minutes' })
  })
  it('Tabata : tour x/8, travail puis repos', () => {
    expect(m('tabata', {}, [], 10 + 5)).toMatchObject({ etiquette: 'Travail', sous: 'Tour 1 / 8', grand: '15', theme: 'travail' })
    expect(m('tabata', {}, [], 10 + 25)).toMatchObject({ etiquette: 'Repos', theme: 'repos', grand: '5' })
  })
  it('Intervalles paramétrables', () => {
    expect(m('intervalles', { tours: 5, travail: 40, repos: 20 }, [], 10 + 70)).toMatchObject({ sous: 'Tour 2 / 5', etiquette: 'Travail', grand: '30' })
  })
  it('Superset : exercice courant, suivant, repos après le passage complet', () => {
    const p = { tours: 2, repos: 60, exercices: ['Pompes', 'Rowing'] }
    expect(m('superset', p, [], 12)).toMatchObject({ etiquette: 'Passage 1 / 2', grand: 'Pompes', action: { id: 'suivant', libelle: 'Suivant' } })
    const apres = [evenement('suivant', T0 + s(20)), evenement('suivant', T0 + s(40))]
    expect(m('superset', p, apres.slice(0, 1), 25)).toMatchObject({ grand: 'Rowing', action: { libelle: 'Passage fini' } })
    expect(m('superset', p, apres, 50)).toMatchObject({ etiquette: 'Repos', theme: 'repos', action: { id: 'passer-repos' } })
  })
  it('AMRAP terminé : tours en grand', () => {
    const x = m('amrap', { duree: 60 }, [evenement('tour', T0 + s(30)), evenement('tour', T0 + s(50))], 10 + 61)
    expect(x).toMatchObject({ termine: true, etiquette: 'Temps !', grand: '2', petit: 'tours' })
  })
  it('secondes avant changement : sert au tic des 3 dernières secondes', () => {
    expect(secondesAvantChangement(avec('amrap', { duree: 60 }, [], 3))).toBe(7)
    expect(secondesAvantChangement(avec('tabata', {}, [], 10 + 18))).toBe(2)
    expect(secondesAvantChangement(avec('fortime', {}, [], 10 + 18))).toBe(null)
    expect(secondesAvantChangement(avec('amrap', { duree: 60 }, [], 10 + 61))).toBe(null)
  })
  it('titres et explications', () => {
    expect(titreCircuit('amrap', { duree: 720 })).toEqual({ nom: 'AMRAP', detail: '12 minutes' })
    expect(titreCircuit('tabata', {})).toEqual({ nom: 'Tabata', detail: '8 × 20 s / 10 s' })
    for (const f of ['amrap', 'emom', 'fortime', 'timecap', 'deathby', 'tabata', 'intervalles', 'superset']) {
      expect(etapesExplication(f, {}).length, f).toBeGreaterThanOrEqual(3)
    }
  })
})
