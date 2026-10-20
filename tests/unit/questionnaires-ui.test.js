import { describe, it, expect } from 'vitest'
import {
  listeQuestionnaires, valeurInitiale, peutContinuer, valeursAEnregistrer, configNombre, mesureDepuisReponse,
  douleurAlertante, resumeFin, libelleCourt, reponseDeLaPeriode
} from '../../src/domain/questionnaireUi.js'
import { QUESTIONNAIRES, QUESTIONNAIRE_HEBDO, QUESTIONNAIRE_QUOTIDIEN } from '../../src/data/demo/questionnaires.js'
import { alertesClient } from '../../src/domain/alertes.js'
import { validerReponse } from '../../src/domain/modele.js'
import { dimensionsCibles } from '../../src/lib/photo.js'
import { lireBrouillon, sauverBrouillon, effacerBrouillon, brouillonsDuJour } from '../../src/lib/brouillonQuestionnaire.js'
import { stockageMemoire } from '../../src/data/adapters/local.js'

const AUJ = '2026-10-21' // mercredi
const rep = (qid, date, valeurs = {}) => ({ id: `r-${qid}-${date}`, clientId: 'c1', questionnaireId: qid, frequence: 'quotidien', date, valeurs })

describe('liste des questionnaires', () => {
  it('à faire d\'abord, groupes par fréquence, textes de statut', () => {
    const g = listeQuestionnaires({ questionnaires: QUESTIONNAIRES, reponses: [rep('q-checkin-quotidien', AUJ)], clientId: 'c1', aujourdhui: AUJ })
    expect(g.map((x) => x.frequence)).toEqual(['quotidien', 'hebdo'])
    expect(g[0].lignes[0].fait).toBe(true)
    expect(g[0].lignes[0].texte).toBe("Déjà fait aujourd'hui")
    expect(g[1].lignes[0].texte).toMatch(/8 questions/)
  })
  it('un hebdo rempli lundi compte pour la semaine ; la veille du lundi non', () => {
    expect(reponseDeLaPeriode(QUESTIONNAIRE_HEBDO, [rep('q-bilan-hebdo', '2026-10-19')], 'c1', AUJ)).toBeTruthy()
    expect(reponseDeLaPeriode(QUESTIONNAIRE_HEBDO, [rep('q-bilan-hebdo', '2026-10-18')], 'c1', AUJ)).toBeNull()
  })
  it('affiche « En cours » avec la question du brouillon', () => {
    const g = listeQuestionnaires({ questionnaires: QUESTIONNAIRES, reponses: [], clientId: 'c1', aujourdhui: AUJ, brouillons: { 'q-checkin-quotidien': { index: 2 } } })
    expect(g[0].lignes[0].texte).toBe('En cours · question 3 sur 6')
  })
  it('ignore les questionnaires d\'un autre client', () => {
    const g = listeQuestionnaires({ questionnaires: [{ ...QUESTIONNAIRE_HEBDO, clientId: 'autre' }], reponses: [], clientId: 'c1', aujourdhui: AUJ })
    expect(g).toEqual([])
  })
})

describe('questions', () => {
  const [sommeil, , , douleur, , hydratation] = QUESTIONNAIRE_QUOTIDIEN.questions
  it('valeurs de départ', () => {
    expect(valeurInitiale(sommeil)).toBe(5)
    expect(valeurInitiale(douleur)).toBe(0)
    expect(valeurInitiale(hydratation)).toBeNull()
    expect(valeurInitiale(hydratation, 2)).toBe(2)
    expect(valeurInitiale({ type: 'choixMultiple' })).toEqual([])
  })
  it('peutContinuer par type, facultatif toujours', () => {
    expect(peutContinuer({ type: 'nombre' }, null)).toBe(false)
    expect(peutContinuer({ type: 'nombre' }, 0)).toBe(true)
    expect(peutContinuer({ type: 'texte' }, '  ')).toBe(false)
    expect(peutContinuer({ type: 'texte', optionnel: true }, '')).toBe(true)
    expect(peutContinuer({ type: 'choixMultiple' }, [])).toBe(false)
    expect(peutContinuer({ type: 'emojis' }, '🙂')).toBe(true)
  })
  it('ne garde que les questions répondues', () => {
    const v = valeursAEnregistrer(QUESTIONNAIRE_HEBDO, { poids: 80, tourDeTaille: null, objectifs: [], bilan: '  ok  ', photo: '' })
    expect(v).toEqual({ poids: 80, bilan: 'ok' })
  })
  it('config de roue : bornes, pas, départ', () => {
    const c = configNombre(hydratation, 1.5)
    expect(c.nb).toBe(41)
    expect(c.valeurDe(c.index)).toBe(1.5)
    expect(c.unite).toBe('L')
    expect(configNombre(QUESTIONNAIRE_HEBDO.questions[0], null).valeurDe(configNombre(QUESTIONNAIRE_HEBDO.questions[0], null).index)).toBe(70)
  })
  it('libellé court', () => expect(libelleCourt('tourDeTaille')).toBe('Tour de taille'))
  it('récapitulatif de fin', () => {
    expect(resumeFin(QUESTIONNAIRE_QUOTIDIEN, { sommeil: 7, energie: '🙂', stress: 3 })).toEqual(['Sommeil 7/10', '🙂', 'Stress 3/10'])
  })
})

describe('réponses -> suivi et alertes', () => {
  it('une réponse hebdo produit une mesure', () => {
    expect(mesureDepuisReponse(QUESTIONNAIRE_HEBDO, { poids: 81.2, tourDeTaille: 88, ressenti: '🙂' })).toEqual({ poids: 81.2, mensurations: { tourDeTaille: 88 } })
    expect(mesureDepuisReponse(QUESTIONNAIRE_QUOTIDIEN, { sommeil: 7 })).toBeNull()
  })
  it('douleur > 6 : alerte coach', () => {
    expect(douleurAlertante({ douleur: 7 })).toBe(true)
    expect(douleurAlertante({ douleur: 6 })).toBe(false)
    const r = rep('q-checkin-quotidien', AUJ, { douleur: 8 })
    expect(validerReponse(r).ok).toBe(true)
    const a = alertesClient({ profil: { id: 'c1', role: 'client', creeLe: Date.parse('2026-09-01T10:00:00Z') }, reponses: [r] }, Date.parse('2026-10-21T10:00:00Z'))
    expect(a.some((x) => x.type === 'douleur')).toBe(true)
  })
})

describe('photo et brouillon', () => {
  it('redimensionne sans agrandir', () => {
    expect(dimensionsCibles(4000, 3000, 1280)).toEqual({ largeur: 1280, hauteur: 960 })
    expect(dimensionsCibles(3000, 4000, 1280)).toEqual({ largeur: 960, hauteur: 1280 })
    expect(dimensionsCibles(800, 600, 1280)).toEqual({ largeur: 800, hauteur: 600 })
  })
  it('brouillon valable le jour même seulement', () => {
    const s = stockageMemoire()
    sauverBrouillon('c1', 'q1', AUJ, { index: 3, valeurs: { a: 1 } }, s)
    expect(lireBrouillon('c1', 'q1', AUJ, s)).toMatchObject({ index: 3, valeurs: { a: 1 } })
    expect(lireBrouillon('c1', 'q1', '2026-10-22', s)).toBeNull()
    expect(brouillonsDuJour('c1', ['q1', 'q2'], AUJ, s)).toEqual({ q1: { index: 3 } })
    effacerBrouillon('c1', 'q1', s)
    expect(lireBrouillon('c1', 'q1', AUJ, s)).toBeNull()
  })
})
