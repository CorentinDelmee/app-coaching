import { describe, expect, it } from 'vitest'
import {
  aRelancer, checkinsDuJour, dateDuJour, frise, heureCourte, libelleJour, programmeDuJour, prochainsJours, rendezVous, resumeJour, salutation
} from '../../src/coach/studio/ecrans/aujourdhui/journee.js'
import { initiales, teinteDe } from '../../src/coach/studio/ecrans/aujourdhui/avatar.js'
import routes from '../../src/coach/studio/ecrans/aujourdhui/routes.js'

const JOUR = '2026-11-06' // vendredi
const clients = [
  { id: 'c1', role: 'client', nom: 'Fabien Vincent' },
  { id: 'c2', role: 'client', nom: 'Léa Martin' },
  { id: 'c3', role: 'client', nom: 'Thomas Bernard' },
  { id: 'c4', role: 'client', nom: 'Ancien Client', archive: true }
]

describe('rendezVous', () => {
  it('fusionne séances, agenda Google et réservations, trie et dédoublonne', () => {
    const tous = rendezVous({
      clients,
      seances: [
        { id: 's1', clientId: 'c1', date: JOUR, heure: '18:30', lieu: 'domicile', statut: 'prevue' },
        { id: 's2', clientId: 'c2', date: JOUR, heure: '08:00', lieu: 'salle', statut: 'faite' },
        { id: 's3', clientId: 'c3', date: JOUR, heure: '12:00', lieu: 'salle', statut: 'annulee' }
      ],
      evenements: [
        { id: 'e1', statut: 'attribue', clientId: 'c1', date: JOUR, heure: '18:30', finHeure: '19:30' }, // doublon de s1
        { id: 'e2', statut: 'attribue', clientId: 'c3', date: JOUR, heure: '10:00', finHeure: '11:00', lieu: 'domicile' },
        { id: 'e3', statut: 'inconnu', date: JOUR, heure: '11:00' }
      ],
      reservations: [{ id: 'r1', debut: '2026-11-06T14:00:00+01:00', fin: '2026-11-06T15:00:00+01:00', prenom: 'Camille', nom: 'Martin', commune: 'Tours', statut: 'a_venir' }]
    })
    expect(tous.map((r) => r.id)).toEqual(['appli-s2', 'google-e2', 'site-r1', 'appli-s1'])
    expect(tous[0]).toMatchObject({ titre: 'Léa Martin', faite: true, lien: '/coach/clients/c2' })
    expect(tous[0].detail).toContain('en salle')
    expect(tous[2]).toMatchObject({ titre: 'Camille MARTIN', heure: '14:00', fin: '15:00', source: 'site', lien: '/coach/reservations' })
  })
})

describe('programmeDuJour', () => {
  const tous = [
    { id: 'a', date: JOUR, heure: '08:00', fin: '' },
    { id: 'b', date: JOUR, heure: '10:00', fin: '11:00' },
    { id: 'c', date: JOUR, heure: '14:00', fin: '' },
    { id: 'd', date: '2026-11-07', heure: '09:00', fin: '' }
  ]
  it('marque passé / en cours / à venir avec un seul repère', () => {
    const it = programmeDuJour(tous, JOUR, 10 * 60 + 15)
    expect(it.map((x) => x.etat)).toEqual(['passe', 'en-cours', 'a-venir'])
  })
  it('marque le prochain quand rien n’est en cours', () => {
    expect(programmeDuJour(tous, JOUR, 12 * 60).map((x) => x.etat)).toEqual(['passe', 'passe', 'prochain'])
  })
  it('tout est passé le soir', () => {
    expect(programmeDuJour(tous, JOUR, 22 * 60).every((x) => x.etat === 'passe')).toBe(true)
  })
})

describe('frise', () => {
  it('place les rendez-vous et le curseur entre 7 h et 21 h', () => {
    const items = programmeDuJour([{ id: 'a', date: JOUR, heure: '14:00', fin: '' }], JOUR, 14 * 60)
    const f = frise(items, 14 * 60)
    expect(f.plots[0].x).toBe(50)
    expect(f.maintenant).toBe(50)
    expect(f.graduations[0]).toEqual({ h: 7, x: 0 })
  })
  it('s’élargit pour un rendez-vous à 6 h, sans curseur la nuit', () => {
    const items = programmeDuJour([{ id: 'a', date: JOUR, heure: '06:00', fin: '' }], JOUR, 23 * 60)
    const f = frise(items, 23 * 60)
    expect(f.plots[0].x).toBe(0)
    expect(f.maintenant).toBeNull()
  })
})

describe('prochainsJours', () => {
  it('regroupe par jour avec « Demain »', () => {
    const tous = [
      { id: 'x', date: JOUR, heure: '09:00' },
      { id: 'a', date: '2026-11-07', heure: '09:00' },
      { id: 'b', date: '2026-11-07', heure: '11:00' },
      { id: 'c', date: '2026-11-10', heure: '10:00' },
      { id: 'z', date: '2026-11-30', heure: '10:00' }
    ]
    const g = prochainsJours(tous, JOUR)
    expect(g.map((x) => x.libelle)).toEqual(['Demain', 'Mardi 10 novembre'])
    expect(g[0].items).toHaveLength(2)
    expect(prochainsJours(tous, JOUR, { max: 1 })[0].items).toHaveLength(1)
  })
})

describe('aRelancer', () => {
  const questionnaires = [
    { id: 'q-quot', nom: 'Check-in', frequence: 'quotidien', clientId: null },
    { id: 'q-hebdo', nom: 'Bilan', frequence: 'hebdo', clientId: null },
    { id: 'q-dep', nom: 'Départ', frequence: 'ponctuel', clientId: 'c2' }
  ]
  const reponses = [
    { clientId: 'c1', questionnaireId: 'q-hebdo', date: '2026-11-03' },
    { clientId: 'c3', questionnaireId: 'q-hebdo', date: '2026-11-02' }
  ]
  it('liste les questionnaires dus (hors check-in) et les clients sans séance prévue', () => {
    const tous = [{ clientId: 'c1', date: '2026-11-08' }, { clientId: 'c2', date: '2026-11-09' }]
    const seances = [{ clientId: 'c3', statut: 'faite', date: '2026-10-20' }]
    const r = aRelancer({ clients, questionnaires, reponses, tous, seances, jour: JOUR })
    expect(r.map((x) => x.id)).toEqual(['q:c2:q-hebdo', 'q:c2:q-dep', 's:c3'])
    expect(r[2].detail).toBe('Aucune séance prévue · dernière il y a 17 jours')
    expect(r[1].message).toContain('Bonjour Léa')
    expect(r[1].lienWhatsApp).toMatch(/^https:\/\/wa\.me\/\?text=Bonjour%20L/)
  })
  it('ne relance pas un client vu récemment, ni un archivé', () => {
    const seances = [{ clientId: 'c3', statut: 'faite', date: '2026-11-01' }]
    const r = aRelancer({ clients, questionnaires: [], reponses: [], tous: [{ clientId: 'c1', date: JOUR }, { clientId: 'c2', date: JOUR }], seances, jour: JOUR })
    expect(r).toEqual([])
  })
})

describe('checkinsDuJour', () => {
  it('résume les check-ins remplis aujourd’hui', () => {
    const r = checkinsDuJour({
      clients, jour: JOUR,
      reponses: [
        { id: 'r1', clientId: 'c1', frequence: 'quotidien', date: JOUR, valeurs: { sommeil: 7, stress: 3, douleur: 0, energie: '🙂' } },
        { id: 'r2', clientId: 'c2', frequence: 'quotidien', date: '2026-11-05', valeurs: {} },
        { id: 'r3', clientId: 'c3', frequence: 'hebdo', date: JOUR, valeurs: {} }
      ]
    })
    expect(r).toEqual([{ id: 'r1', clientId: 'c1', nom: 'Fabien Vincent', resume: 'Sommeil 7/10 · Stress 3/10', humeur: '🙂' }])
  })
})

describe('libellés', () => {
  it('formate dates, heures et salutations', () => {
    expect(dateDuJour(JOUR)).toBe('Vendredi 6 novembre')
    expect(dateDuJour('2026-12-01')).toBe('Mardi 1er décembre')
    expect(libelleJour(JOUR, JOUR)).toBe('Aujourd’hui')
    expect(heureCourte('09:05')).toBe('9 h 05')
    expect(salutation(9 * 60)).toBe('Bonjour')
    expect(salutation(19 * 60)).toBe('Bonsoir')
    expect(resumeJour([], 0)).toBe('Aucun rendez-vous aujourd’hui')
    expect(resumeJour([{ etat: 'passe' }, { etat: 'prochain' }], 2)).toBe('1 rendez-vous à venir sur 2 · 2 alertes à traiter')
    expect(initiales('Léa Martin')).toBe('LM')
    expect(initiales('')).toBe('?')
    expect(teinteDe('c1')).toBe(teinteDe('c1'))
  })
  it('exporte les routes aujourdhui et alertes', () => {
    expect(routes.map((r) => r.path)).toEqual(['aujourdhui', 'alertes'])
  })
})
