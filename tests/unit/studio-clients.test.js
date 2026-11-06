import { describe, it, expect } from 'vitest'
import {
  libelleStatut, dateAvecAnnee, normaliser, initiales, teinteClient, joursEntre, assiduite, resumeClient, libelleDepuis, filtrerClients, compterFiltres, optionsReponses, normaliserTelephone, patchTelephone, telephoneClient, messageAcces
} from '../../src/coach/studio/ecrans/clients/logique.js'
import { TEINTES_STUDIO } from '../../src/coach/studio/medias.js'

const AUJ = '2026-11-06' // vendredi
const prog = (clientId, extra = {}) => ({ id: `p-${clientId}`, clientId, nom: 'P', mode: 'repete', debut: '2026-09-01', workouts: ['w1', 'w2'], ...extra })
const real = (clientId, date, workoutId = 'w1') => ({ id: `${clientId}-${date}-${workoutId}`, clientId, workoutId, date })

describe('studio clients : textes', () => {
  it('normalise sans accents ni casse', () => {
    expect(normaliser('  Léa MARTIN ')).toBe('lea martin')
    expect(normaliser(undefined)).toBe('')
  })
  it('initiales', () => {
    expect(initiales('Fabien Vincent')).toBe('FV')
    expect(initiales('Jean de la Fontaine')).toBe('JF')
    expect(initiales('cher')).toBe('CH')
    expect(initiales('')).toBe('?')
  })
  it('teinte stable et connue', () => {
    expect(teinteClient('client-a')).toBe(teinteClient('client-a'))
    expect(TEINTES_STUDIO).toContain(teinteClient('x'))
  })
  it('jours entre deux dates', () => {
    expect(joursEntre('2026-11-01', AUJ)).toBe(5)
  })
  it('libellé de la dernière séance', () => {
    expect(libelleDepuis(null)).toBe('Aucune séance faite')
    expect(libelleDepuis(0)).toMatch(/aujourd'hui/)
    expect(libelleDepuis(1)).toMatch(/hier/)
    expect(libelleDepuis(9)).toBe('Dernière séance il y a 9 j')
  })
})

describe('studio clients : assiduité', () => {
  it('null sans programme', () => {
    expect(assiduite([], [], AUJ)).toBeNull()
  })
  it('compte les semaines passées et seulement le fait de la semaine en cours', () => {
    // 4 semaines passées × 2 séances = 8 prévues ; 4 faites ; semaine en cours : 1 faite (comptée 1/1)
    const reals = ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03'].map((d) => real('c', d))
    expect(assiduite([prog('c')], reals, AUJ)).toBe(Math.round((5 / 9) * 100))
  })
  it('plafonne à 100', () => {
    const reals = []
    for (const d of ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']) { reals.push(real('c', d, 'w1'), real('c', d, 'w2')) }
    expect(assiduite([prog('c')], reals, AUJ)).toBe(100)
  })
})

describe('studio clients : résumé, filtres', () => {
  const p = (id, nom, extra = {}) => ({ id, nom, identifiant: normaliser(nom).replace(' ', '.'), role: 'client', ...extra })
  it('statuts', () => {
    expect(resumeClient({ profil: p('a', 'A', { archive: true }), aujourdhui: AUJ }).statut).toBe('archive')
    expect(resumeClient({ profil: p('a', 'A'), nbAlertes: 2, aujourdhui: AUJ }).statut).toBe('alerte')
    expect(resumeClient({ profil: p('a', 'A'), aujourdhui: AUJ }).statut).toBe('sansProgramme')
    expect(resumeClient({ profil: p('a', 'A'), programmes: [prog('a')], realisations: [real('a', '2026-10-01')], aujourdhui: AUJ }).statut).toBe('aRelancer')
    const r = resumeClient({ profil: p('a', 'A'), programmes: [prog('a')], realisations: [real('a', '2026-11-04'), real('b', '2026-11-06')], aujourdhui: AUJ })
    expect(r).toMatchObject({ statut: 'actif', derniere: '2026-11-04', depuis: 2 })
  })
  const liste = [
    { profil: p('1', 'Léa Martin'), resume: { statut: 'actif' } },
    { profil: p('2', 'Fabien Vincent'), resume: { statut: 'alerte' } },
    { profil: p('3', 'Élodie Archivée', { archive: true }), resume: { statut: 'archive' } },
    { profil: p('4', 'Thomas Bernard'), resume: { statut: 'aRelancer' } }
  ]
  it('filtre actifs / attention / archivés, trié par nom', () => {
    expect(filtrerClients(liste).map((c) => c.profil.id)).toEqual(['2', '1', '4'])
    expect(filtrerClients(liste, { filtre: 'attention' }).map((c) => c.profil.id)).toEqual(['2', '4'])
    expect(filtrerClients(liste, { filtre: 'archives' }).map((c) => c.profil.id)).toEqual(['3'])
  })
  it('recherche sans accents sur nom et identifiant', () => {
    expect(filtrerClients(liste, { recherche: 'lea' }).map((c) => c.profil.id)).toEqual(['1'])
    expect(filtrerClients(liste, { filtre: 'archives', recherche: 'elodie' })).toHaveLength(1)
    expect(filtrerClients(liste, { recherche: 'thomas.b' })).toHaveLength(1)
    expect(filtrerClients(liste, { recherche: 'zzz' })).toHaveLength(0)
  })
  it('compteurs', () => {
    expect(compterFiltres(liste)).toEqual({ actifs: 3, attention: 2, archives: 1 })
  })
})

describe('studio clients : options de réponses', () => {
  it('un filtre par questionnaire, ponctuels (PAR-Q) en premier', () => {
    const qs = [{ id: 'q1', nom: 'Check-in', frequence: 'quotidien' }, { id: 'q2', nom: 'PAR-Q', frequence: 'ponctuel' }]
    const rs = [{ questionnaireId: 'q1' }, { questionnaireId: 'q1' }, { questionnaireId: 'q2' }, { questionnaireId: 'q-inconnu' }]
    expect(optionsReponses(rs, qs)).toEqual([
      { valeur: 'q2', texte: 'PAR-Q', n: 1 }, { valeur: 'q-inconnu', texte: 'Questionnaire', n: 1 }, { valeur: 'q1', texte: 'Check-in', n: 2 }
    ])
  })
})

describe('studio clients : libellés (correctifs)', () => {
  const p = { id: 'n', nom: 'N', identifiant: 'n', role: 'client' }
  it('client neuf sans programme : « Nouveau · sans programme » pendant 14 jours', () => {
    const neuf = resumeClient({ profil: { ...p, creeLe: Date.parse('2026-11-01T10:00:00') }, aujourdhui: AUJ })
    expect(neuf.statut).toBe('sansProgramme')
    expect(libelleStatut(neuf)).toBe('Nouveau · sans programme')
    const ancien = resumeClient({ profil: { ...p, creeLe: Date.parse('2026-10-01T10:00:00') }, aujourdhui: AUJ })
    expect(libelleStatut(ancien)).toBe('Sans programme')
    expect(libelleStatut({ statut: 'alerte', nbAlertes: 2 })).toBe('2 alertes')
    expect(libelleStatut({ statut: 'actif' })).toBe('Actif')
  })
  it('date avec année', () => {
    expect(dateAvecAnnee('1985-03-12')).toBe('12 mars 1985')
    expect(dateAvecAnnee('1990-01-01')).toBe('1er janvier 1990')
    expect(dateAvecAnnee('inconnue')).toBe('inconnue')
  })
})

describe('téléphone et message d’accès', () => {
  it('normalise au format WhatsApp', () => {
    expect(normaliserTelephone('06 12 34 56 78')).toBe('33612345678')
    expect(normaliserTelephone('+33 6 12 34 56 78')).toBe('33612345678')
    expect(normaliserTelephone('0033612345678')).toBe('33612345678')
    expect(normaliserTelephone('+33 (0)6 12 34 56 78')).toBe('33612345678')
    expect(normaliserTelephone('06.12.34.56.78')).toBe('33612345678')
    expect(normaliserTelephone('12')).toBe('')
    expect(normaliserTelephone('')).toBe('')
  })
  it('lit et écrit le numéro dans la fiche sans perdre le reste', () => {
    const p = { fiche: { notes: 'n', contact: { email: 'a@b.fr', telephone: '0612345678' } } }
    expect(telephoneClient(p)).toBe('33612345678')
    expect(patchTelephone(p, '07 00 00 00 01')).toEqual({ fiche: { notes: 'n', contact: { email: 'a@b.fr', telephone: '33700000001' } } })
    expect(patchTelephone({}, '0612345678').fiche.contact.telephone).toBe('33612345678')
  })
  it('le message d’accès tutoie', () => {
    const m = messageAcces({ nom: 'Léa Martin', identifiant: 'lea', code: 'AB12', url: 'https://x.fr' })
    expect(m).toContain('ton accès')
    expect(m).not.toMatch(/vous|votre|vos/i)
  })
})
