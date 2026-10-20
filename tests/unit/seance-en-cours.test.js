import { describe, it, expect, beforeEach } from 'vitest'
import { effacerSeanceEnCours, lireSeanceEnCours, sauverSeanceEnCours } from '../../src/lib/seanceEnCours.js'
import { demarrerSeance, reduire } from '../../src/engine/seance.js'

// localStorage minimal pour l'environnement de test (node)
function brancherStockage() {
  const m = new Map()
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }
}

const workout = { id: 'w1', nom: 'W1', blocs: [{ type: 'exercice', id: 'b1', exerciceId: 'sq', champs: [{ cle: 'reps', modifiableParClient: true }], repos: 60, series: [{ reps: 8 }, { reps: 8 }] }] }

describe('séance en cours sauvegardée localement', () => {
  beforeEach(brancherStockage)

  it('rien de sauvegardé : null', () => {
    expect(lireSeanceEnCours()).toBe(null)
  })

  it('une séance en plein repos est rouverte à l\'identique, au bon temps', () => {
    const t0 = 1_000_000
    let e = demarrerSeance({ workout, clientId: 'c1' }, t0)
    e = reduire(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, t0 + 5_000) // repos de 60 s
    sauverSeanceEnCours({ workoutId: 'w1', clientId: 'c1', realisationId: 'r1', etat: e, circuit: null })

    const reprise = lireSeanceEnCours()
    expect(reprise).toMatchObject({ workoutId: 'w1', realisationId: 'r1', version: 1 })
    // l'état repris est celui du moteur : le repos reprend à l'échéance d'origine
    const etat = reduire({ ...reprise.etat, evenements: [] }, { type: 'tick' }, t0 + 35_000)
    expect(etat.repos.finLe).toBe(t0 + 65_000)
    expect(etat.exercices[0].series[0].faite).toBe(true)
    // et le repos se termine à l'heure prévue
    const fin = reduire(etat, { type: 'tick' }, t0 + 65_000)
    expect(fin.evenements.map((x) => x.type)).toContain('repos-fini')
  })

  it('le chrono d\'un circuit en cours est sauvegardé avec la séance', () => {
    const e = demarrerSeance({ workout, clientId: 'c1' }, 0)
    const circuit = { itemId: 'b1', evenements: [{ type: 'demarrer', t: 100 }, { type: 'tour', t: 5000 }] }
    sauverSeanceEnCours({ workoutId: 'w1', clientId: 'c1', realisationId: 'r1', etat: e, circuit })
    expect(lireSeanceEnCours().circuit).toEqual(circuit)
  })

  it('effacer (Abandonner ou séance validée)', () => {
    sauverSeanceEnCours({ workoutId: 'w1', clientId: 'c1', realisationId: 'r1', etat: demarrerSeance({ workout }, 0), circuit: null })
    effacerSeanceEnCours()
    expect(lireSeanceEnCours()).toBe(null)
  })

  it('contenu illisible ou d\'une autre version : ignoré, jamais d\'erreur', () => {
    globalThis.localStorage.setItem('cdc-coaching/seance-en-cours', '{pas du json')
    expect(lireSeanceEnCours()).toBe(null)
    globalThis.localStorage.setItem('cdc-coaching/seance-en-cours', JSON.stringify({ version: 99, workoutId: 'w1', etat: {} }))
    expect(lireSeanceEnCours()).toBe(null)
  })
})
