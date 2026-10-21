import { describe, it, expect } from 'vitest'
import { reduire, demarrerSeance, vue, prochaineSerie, DELAI_AVANCE_AUTO } from '../../src/engine/seance.js'

const T0 = 5_000_000
const s = (n) => n * 1000

const champs = (modifiablePoids = true) => [{ cle: 'poids', modifiableParClient: modifiablePoids }, { cle: 'reps', modifiableParClient: true }]
const workout = {
  id: 'w1', nom: 'Workout 1',
  blocs: [
    { type: 'exercice', id: 'b1', exerciceId: 'ex-squat', champs: champs(), repos: 90, series: [{ poids: 60, reps: 8 }, { poids: 60, reps: 8 }] },
    { type: 'exercice', id: 'b2', exerciceId: 'ex-planche', champs: [{ cle: 'tempsTravail', modifiableParClient: false }], repos: 45, series: [{ tempsTravail: 30 }, { tempsTravail: 30 }] },
    { type: 'exercice', id: 'b3', exerciceId: 'ex-pompes', champs: champs(false), repos: 60, series: [{ poids: 0, reps: 10 }] },
    { type: 'exercice', id: 'b4', exerciceId: 'ex-libre', repos: 30, series: [{}] }
  ]
}
const go = (etat, action, t) => reduire(etat, action, T0 + s(t))
const types = (e) => e.evenements.map((x) => x.type)
const demarrer = (extra = {}) => demarrerSeance({ workout, clientId: 'c1', ...extra }, T0)

describe('démarrage et pré-remplissage', () => {
  it('valeurs prescrites par défaut', () => {
    const e = demarrer()
    expect(e.exercices[0].series[0].valeurs).toEqual({ poids: 60, reps: 8 })
    expect(e.exercices[1].series[0].valeurs).toEqual({ tempsTravail: 30 })
    expect(e.courant).toBe(0)
  })
  it('pré-remplie depuis le template du client (champs modifiables seulement)', () => {
    const template = { id: 'c1', valeurs: { w1: { b1: [{ poids: 65, reps: 8 }, { poids: 67.5, reps: 7 }], b3: [{ poids: 20, reps: 12 }] } } }
    const e = demarrer({ template })
    expect(e.exercices[0].series.map((x) => x.valeurs)).toEqual([{ poids: 65, reps: 8 }, { poids: 67.5, reps: 7 }])
    // b3 : poids verrouillé par le coach -> valeur prescrite, reps modifiables -> template
    expect(e.exercices[2].series[0].valeurs).toEqual({ poids: 0, reps: 12 })
    expect(e.exercices[0].series[0].prescrit).toEqual({ poids: 60, reps: 8 })
  })
  it('template avec séances non faites (null) : repli sur la dernière valeur connue puis le prescrit', () => {
    const template = { id: 'c1', valeurs: { w1: { b1: [{ poids: 65, reps: 8 }, null] } } }
    expect(demarrer({ template }).exercices[0].series[1].valeurs).toEqual({ poids: 65, reps: 8 })
  })
  it('exercice sans valeur prescrite ni historique : champs vides', () => {
    const e = demarrer()
    expect(e.exercices[3].series[0].valeurs).toEqual({})
    const sansValeur = demarrerSeance({ workout: { id: 'w', nom: 'w', blocs: [{ type: 'exercice', id: 'x', exerciceId: 'e', champs: champs(), series: [{}] }] } }, T0)
    expect(sansValeur.exercices[0].series[0].valeurs).toEqual({ poids: null, reps: null })
  })
  it('l\'action demarrer passe aussi par le réducteur', () => {
    const e = reduire(null, { type: 'demarrer', workout }, T0)
    expect(e.workoutId).toBe('w1')
  })
  it('action inconnue ou séance absente : erreur claire', () => {
    expect(() => reduire(null, { type: 'tick' }, T0)).toThrow(/Aucune séance/)
    expect(() => go(demarrer(), { type: 'danser' }, 1)).toThrow(/inconnue/)
  })
})

describe('modification des valeurs', () => {
  it('modifie une valeur modifiable', () => {
    const e = go(demarrer(), { type: 'modifierValeur', exIdx: 0, serieIdx: 0, champ: 'poids', valeur: 62.5 }, 1)
    expect(e.exercices[0].series[0].valeurs.poids).toBe(62.5)
  })
  it('refuse un champ non modifiable (fixé par le coach) et signale le refus', () => {
    const e = go(demarrer(), { type: 'modifierValeur', exIdx: 2, serieIdx: 0, champ: 'poids', valeur: 10 }, 1)
    expect(e.exercices[2].series[0].valeurs.poids).toBe(0)
    expect(e.evenements).toEqual([{ type: 'refuse', raison: 'champ-verrouille' }])
  })
  it('refuse les valeurs négatives et hors bornes, les séries et champs inconnus', () => {
    const base = demarrer()
    expect(go(base, { type: 'modifierValeur', exIdx: 0, serieIdx: 0, champ: 'poids', valeur: -5 }, 1).evenements[0].raison).toBe('valeur-negative')
    expect(go(base, { type: 'modifierValeur', exIdx: 0, serieIdx: 9, champ: 'poids', valeur: 5 }, 1).evenements[0].raison).toBe('serie-inconnue')
    expect(go(base, { type: 'modifierValeur', exIdx: 0, serieIdx: 0, champ: 'rpe', valeur: 5 }, 1).evenements[0].raison).toBe('champ-inconnu')
  })
  it('l\'état précédent n\'est jamais modifié (réducteur pur)', () => {
    const e = demarrer()
    const copie = JSON.stringify(e)
    go(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 5)
    expect(JSON.stringify(e)).toBe(copie)
  })
})

describe('repos automatique', () => {
  const apresValidation = () => go(demarrer(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 100)
  it('valider une série lance le repos prescrit (90 s)', () => {
    const e = apresValidation()
    expect(types(e)).toEqual(['serie-validee', 'repos-demarre'])
    expect(e.exercices[0].series[0].faite).toBe(true)
    expect(vue(e, T0 + s(100))).toMatchObject({ reposActif: true, reposRestant: 90, reposDuree: 90, reposFraction: 1 })
  })
  it('à +89 s il reste 1 s ; à +90 s le repos est terminé (événement son + vibration)', () => {
    const e = apresValidation()
    expect(vue(e, T0 + s(189)).reposRestant).toBe(1)
    expect(vue(e, T0 + s(189)).reposActif).toBe(true)
    expect(vue(e, T0 + s(190))).toMatchObject({ reposRestant: 0, reposActif: false })
    const fini = go(e, { type: 'tick' }, 190)
    expect(fini.evenements).toEqual([{ type: 'repos-fini', exIdx: 0, serieIdx: 0, son: true, vibration: true }])
    expect(fini.repos).toBe(null)
  })
  it('pas de fin de repos avant l\'heure', () => {
    expect(go(apresValidation(), { type: 'tick' }, 150).evenements).toEqual([])
  })
  it('+15 s prolonge, plusieurs fois', () => {
    let e = apresValidation()
    e = go(e, { type: 'ajouterRepos' }, 150)
    e = go(e, { type: 'ajouterRepos' }, 151)
    expect(vue(e, T0 + s(190)).reposRestant).toBe(30)
    expect(vue(e, T0 + s(190)).reposDuree).toBe(120)
    expect(go(e, { type: 'tick' }, 219).evenements).toEqual([])
    expect(types(go(e, { type: 'tick' }, 220))).toEqual(['repos-fini'])
  })
  it('+15 s sans repos en cours : refusé', () => {
    expect(go(demarrer(), { type: 'ajouterRepos' }, 1).evenements[0].raison).toBe('pas-de-repos')
  })
  it('passer le repos', () => {
    const e = go(apresValidation(), { type: 'passerRepos' }, 110)
    expect(e.repos).toBe(null)
    expect(vue(e, T0 + s(110)).reposActif).toBe(false)
  })
  it('valider deux fois la même série ne relance rien', () => {
    const e = apresValidation()
    const encore = go(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 130)
    expect(encore.evenements).toEqual([])
    expect(encore.repos.finLe).toBe(e.repos.finLe)
  })
  it('durée de repos propre à la série (champ repos) prioritaire', () => {
    const w = { id: 'w', nom: 'w', blocs: [{ type: 'exercice', id: 'x', exerciceId: 'e', repos: 90, champs: [{ cle: 'repos', modifiableParClient: true }], series: [{ repos: 20 }, { repos: 20 }] }] }
    const e = reduire(demarrerSeance({ workout: w }, T0), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, T0)
    expect(e.repos.duree).toBe(20)
  })
  it('repos par défaut de 60 s sans valeur prescrite', () => {
    const w = { id: 'w', nom: 'w', blocs: [{ type: 'exercice', id: 'x', exerciceId: 'e', series: [{ reps: 5 }, { reps: 5 }] }] }
    const e = reduire(demarrerSeance({ workout: w }, T0), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, T0)
    expect(e.repos.duree).toBe(60)
  })
  it('pas de repos après la toute dernière série de la séance', () => {
    const w = { id: 'w', nom: 'w', blocs: [{ type: 'exercice', id: 'x', exerciceId: 'e', series: [{ reps: 5 }] }] }
    const e = reduire(demarrerSeance({ workout: w }, T0), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, T0)
    expect(e.repos).toBe(null)
    expect(types(e)).toContain('seance-complete')
  })
})

describe('séries en temps de travail', () => {
  const lance = () => go(demarrer(), { type: 'lancerSerie', exIdx: 1, serieIdx: 0 }, 10)
  it('« Lancer la série » démarre le chrono de travail', () => {
    const e = lance()
    expect(types(e)).toEqual(['travail-demarre'])
    expect(vue(e, T0 + s(10))).toMatchObject({ travailActif: true, travailRestant: 30, travailFraction: 1 })
    expect(vue(e, T0 + s(25)).travailRestant).toBe(15)
  })
  it('fin du travail : son + série validée + repos démarré à l\'heure exacte de fin', () => {
    const e = go(lance(), { type: 'tick' }, 40.5) // le tick arrive un peu en retard
    expect(types(e)).toEqual(['travail-fini', 'serie-validee', 'repos-demarre'])
    expect(e.evenements[0]).toMatchObject({ son: true, vibration: true })
    expect(e.exercices[1].series[0].faite).toBe(true)
    expect(e.travail).toBe(null)
    expect(e.repos.finLe).toBe(T0 + s(40) + s(45)) // repos de 45 s compté depuis la fin du travail
  })
  it('rien avant la fin', () => {
    expect(go(lance(), { type: 'tick' }, 39).evenements).toEqual([])
  })
  it('un tick très tardif termine aussi le repos dans la foulée', () => {
    const e = go(lance(), { type: 'tick' }, 500)
    expect(types(e)).toEqual(['travail-fini', 'serie-validee', 'repos-demarre', 'repos-fini'])
    expect(e.repos).toBe(null)
  })
  it('refusé sur une série sans temps de travail', () => {
    expect(go(demarrer(), { type: 'lancerSerie', exIdx: 0, serieIdx: 0 }, 1).evenements[0].raison).toBe('pas-de-temps-de-travail')
  })
  it('annuler le travail ne valide pas la série', () => {
    const e = go(lance(), { type: 'annulerTravail' }, 15)
    expect(e.travail).toBe(null)
    expect(e.exercices[1].series[0].faite).toBe(false)
  })
  it('lancer une série coupe le repos en cours', () => {
    let e = go(demarrer(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 5)
    e = go(e, { type: 'lancerSerie', exIdx: 1, serieIdx: 0 }, 10)
    expect(e.repos).toBe(null)
  })
})

describe('enchaînement des exercices', () => {
  const toutValider = (e, exIdx, t) => {
    for (let i = 0; i < e.exercices[exIdx].series.length; i++) e = go(e, { type: 'validerSerie', exIdx, serieIdx: i }, t + i)
    return e
  }
  it('après la dernière série : avance automatique dans 3 s, annulable', () => {
    const e = toutValider(demarrer(), 0, 100)
    expect(e.avancerAuto).toEqual({ vers: 1, finLe: T0 + s(101) + DELAI_AVANCE_AUTO })
    expect(types(e)).toContain('exercice-termine')
    expect(types(e)).toContain('avance-auto-prevue')
    expect(vue(e, T0 + s(102))).toMatchObject({ avancerAutoRestant: 2, avancerAutoVers: 1 })
  })
  it('pas d\'avance auto tant qu\'il reste des séries', () => {
    const e = go(demarrer(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 100)
    expect(e.avancerAuto).toBe(null)
  })
  it('le tick effectue l\'avance 3 s après la fin du repos (pas pendant)', () => {
    let e = toutValider(demarrer(), 0, 100) // dernière série à 101, repos de 90 s jusqu'à 191
    expect(go(e, { type: 'tick' }, 150).courant).toBe(0) // le repos tourne : pas d'avance
    e = go(e, { type: 'tick' }, 191) // fin du repos : le compte à rebours de 3 s repart
    expect(e.evenements.map((x) => x.type)).toEqual(['repos-fini', 'avance-auto-prevue'])
    expect(e.avancerAuto.finLe).toBe(T0 + s(191) + DELAI_AVANCE_AUTO)
    expect(go(e, { type: 'tick' }, 193).courant).toBe(0)
    e = go(e, { type: 'tick' }, 194)
    expect(e.courant).toBe(1)
    expect(e.evenements).toContainEqual({ type: 'avance', vers: 1 })
    expect(e.avancerAuto).toBe(null)
  })
  it('« Passer » le repos relance aussi les 3 s d\'avance auto', () => {
    let e = toutValider(demarrer(), 0, 100)
    e = go(e, { type: 'passerRepos' }, 120)
    expect(e.avancerAuto.finLe).toBe(T0 + s(120) + DELAI_AVANCE_AUTO)
    expect(go(e, { type: 'tick' }, 123).courant).toBe(1)
  })
  it('« Rester » annule l\'avance', () => {
    let e = go(toutValider(demarrer(), 0, 100), { type: 'rester' }, 102)
    expect(e.avancerAuto).toBe(null)
    expect(go(e, { type: 'tick' }, 200).courant).toBe(0)
  })
  it('swipe manuel : aller à un exercice annule l\'avance auto', () => {
    let e = go(toutValider(demarrer(), 0, 100), { type: 'allerA', exIdx: 3 }, 102)
    expect(e).toMatchObject({ courant: 3, avancerAuto: null })
    expect(go(e, { type: 'allerA', exIdx: 99 }, 103).evenements[0].raison).toBe('exercice-inconnu')
  })
  it('prochaineSerie suit l\'ordre de la séance', () => {
    let e = demarrer()
    expect(prochaineSerie(e)).toEqual({ exIdx: 0, serieIdx: 0 })
    e = go(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 1)
    expect(prochaineSerie(e)).toEqual({ exIdx: 0, serieIdx: 1 })
    e = toutValider(e, 0, 2)
    expect(prochaineSerie(e)).toEqual({ exIdx: 1, serieIdx: 0 })
  })
  it('séance complète : événement et plus de prochaine série', () => {
    let e = demarrer()
    for (let i = 0; i < e.exercices.length; i++) e = toutValider(e, i, 10 + i * 10)
    expect(types(e)).toContain('seance-complete')
    expect(prochaineSerie(e)).toBe(null)
    expect(vue(e, T0 + s(100))).toMatchObject({ seriesFaites: 6, seriesTotal: 6, exercicesFaits: 4 })
  })
})

describe('superset', () => {
  const w = {
    id: 'ws', nom: 'Superset',
    blocs: [
      { type: 'superset', id: 'ss', repos: 75, exercices: [
        { id: 'a', exerciceId: 'ex-a', series: [{ poids: 10, reps: 12 }, { poids: 10, reps: 12 }] },
        { id: 'b', exerciceId: 'ex-b', series: [{ poids: 15, reps: 12 }, { poids: 15, reps: 12 }] }
      ] },
      { type: 'exercice', id: 'z', exerciceId: 'ex-z', series: [{ reps: 5 }] }
    ]
  }
  const base = () => demarrerSeance({ workout: w }, T0)
  it('ordre de passage A1, B1, A2, B2', () => {
    let e = base()
    expect(prochaineSerie(e)).toEqual({ exIdx: 0, serieIdx: 0 })
    e = go(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 1)
    expect(prochaineSerie(e)).toEqual({ exIdx: 1, serieIdx: 0 })
    e = go(e, { type: 'validerSerie', exIdx: 1, serieIdx: 0 }, 2)
    expect(prochaineSerie(e)).toEqual({ exIdx: 0, serieIdx: 1 })
  })
  it('pas de repos entre A et B, repos après le passage complet', () => {
    let e = go(base(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 1)
    expect(e.repos).toBe(null)
    e = go(e, { type: 'validerSerie', exIdx: 1, serieIdx: 0 }, 2)
    expect(e.repos).toMatchObject({ duree: 75 })
  })
  it('avance auto seulement quand tout le superset est fini', () => {
    let e = base()
    for (const [ex, se] of [[0, 0], [1, 0], [0, 1]]) e = go(e, { type: 'validerSerie', exIdx: ex, serieIdx: se }, 1)
    expect(e.avancerAuto).toBe(null)
    e = go(e, { type: 'validerSerie', exIdx: 1, serieIdx: 1 }, 5)
    expect(e.avancerAuto.vers).toBe(2)
  })
})

describe('circuits dans la séance', () => {
  const w = {
    id: 'wc', nom: 'Circuits',
    blocs: [
      { type: 'circuit', id: 'c1', format: 'amrap', params: { duree: 300 }, exercices: [] },
      { type: 'exercice', id: 'z', exerciceId: 'ex-z', series: [{ reps: 5 }] }
    ]
  }
  it('un circuit terminé enregistre son résultat et déclenche l\'avance auto', () => {
    let e = demarrerSeance({ workout: w }, T0)
    expect(vue(e, T0)).toMatchObject({ seriesTotal: 2 })
    e = go(e, { type: 'terminerCircuit', exIdx: 0, resultat: { tours: 5, repsEnPlus: 3 } }, 400)
    expect(e.exercices[0]).toMatchObject({ faite: true, resultat: { tours: 5, repsEnPlus: 3 } })
    expect(e.avancerAuto).toBeFalsy()
    expect(prochaineSerie(e)).toEqual({ exIdx: 1, serieIdx: 0 })
  })
  it('terminerCircuit sur un exercice : refusé', () => {
    const e = go(demarrer(), { type: 'terminerCircuit', exIdx: 0, resultat: {} }, 5)
    expect(e.evenements[0].raison).toBe('pas-un-circuit')
  })
})

describe('reprise après fermeture', () => {
  it('état sérialisé en plein repos : même affichage à la reprise (t+40 s)', () => {
    let e = go(demarrer(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 100)
    const avant = vue(e, T0 + s(140))
    const repris = JSON.parse(JSON.stringify(e)) // sauvegarde localStorage puis relecture
    expect(vue(repris, T0 + s(140))).toEqual(avant)
    expect(avant.reposRestant).toBe(50)
    expect(types(go(repris, { type: 'tick' }, 190))).toEqual(['repos-fini'])
  })
  it('reprise en plein travail', () => {
    let e = go(demarrer(), { type: 'lancerSerie', exIdx: 1, serieIdx: 0 }, 10)
    const repris = JSON.parse(JSON.stringify(e))
    expect(vue(repris, T0 + s(30)).travailRestant).toBe(10)
  })
  it('reprise longtemps après : les repos échus sont terminés au premier tick', () => {
    const e = go(demarrer(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 100)
    expect(go(JSON.parse(JSON.stringify(e)), { type: 'tick' }, 100000).repos).toBe(null)
  })
})

describe('fin de séance et résumé', () => {
  const faire = (recordsAvant = {}) => {
    let e = demarrer({ recordsAvant })
    e = go(e, { type: 'modifierValeur', exIdx: 0, serieIdx: 1, champ: 'poids', valeur: 70 }, 1)
    e = go(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 2) // 60 × 8 = 480
    e = go(e, { type: 'validerSerie', exIdx: 0, serieIdx: 1 }, 3) // 70 × 8 = 560
    return e
  }
  it('durée totale, volume (Σ poids × reps), séries faites', () => {
    const e = go(faire(), { type: 'terminer' }, 1800)
    expect(e.terminee).toBe(true)
    expect(e.resume).toMatchObject({ dureeSec: 1800, volume: 1040, seriesFaites: 2, seriesTotal: 6, records: [] })
    expect(types(e)).toEqual(['seance-terminee'])
  })
  it('record : meilleure charge par exercice battue', () => {
    const e = go(faire({ 'ex-squat': 65 }), { type: 'terminer' }, 1800)
    expect(e.resume.records).toEqual([{ exerciceId: 'ex-squat', charge: 70, precedente: 65 }])
  })
  it('pas de record si égalité, si charge inférieure, ou sans historique (« Aucun record cette fois »)', () => {
    expect(go(faire({ 'ex-squat': 70 }), { type: 'terminer' }, 9).resume.records).toEqual([])
    expect(go(faire({ 'ex-squat': 100 }), { type: 'terminer' }, 9).resume.records).toEqual([])
    expect(go(faire({}), { type: 'terminer' }, 9).resume.records).toEqual([])
  })
  it('seules les séries faites comptent dans le volume', () => {
    let e = demarrer()
    e = go(e, { type: 'terminer' }, 10)
    expect(e.resume).toMatchObject({ volume: 0, seriesFaites: 0 })
  })
  it('commentaire facultatif, terminer le fige', () => {
    let e = go(faire(), { type: 'commenter', texte: 'Genou sensible' }, 100)
    e = go(e, { type: 'terminer' }, 200)
    expect(e.commentaire).toBe('Genou sensible')
    const fige = go(e, { type: 'validerSerie', exIdx: 2, serieIdx: 0 }, 300)
    expect(fige.exercices[2].series[0].faite).toBe(false)
    expect(go(e, { type: 'terminer', commentaire: 'Autre' }, 300).commentaire).toBe('Genou sensible')
  })
  it('terminer coupe repos, travail et avance auto', () => {
    let e = go(demarrer(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, 5)
    e = go(e, { type: 'terminer', commentaire: 'ok' }, 6)
    expect(e).toMatchObject({ repos: null, travail: null, avancerAuto: null, commentaire: 'ok' })
  })
  it('l\'état terminé reste du JSON pur', () => {
    const e = go(faire(), { type: 'terminer' }, 100)
    expect(JSON.parse(JSON.stringify(e))).toEqual(e)
  })
})
