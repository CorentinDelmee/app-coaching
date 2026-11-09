// Import de l'historique MyPTHub (sessions réalisées) : données INVENTÉES, aux formes de l'export réel du 2026-11-09.
import { describe, expect, it } from 'vitest'
import { planifierHistorique, serieFaite, jourParis, msUtc, canon, workoutDe, DESCRIPTION_VIDE } from '../src/import-mypthub/historique.js'
import { seanceGroupes } from '../src/import-mypthub/normaliser.js'

const PID = 'profil-1'
const CLE = 'mp-500'

// Exercice MyPTHub : colonnes weight + reps (ou autres), séries prescrites et faites.
const exo = (name, types, sets, extra = {}) => ({
  exercise: { name, description: extra.description ?? null, video_type: null, video_id: null, note: '' },
  meta: { ...Object.fromEntries(types.map((t, i) => [`field_${i + 1}`, t])), sets: sets.map(([p, d]) => ({ ...Object.fromEntries(p.map((v, i) => [`field_${i + 1}`, v])), done: d === null ? null : Object.fromEntries(d.map((v, i) => [`field_${i + 1}`, v])) })) }
})
const seul = (e) => ({ group_type: 'standalone', exercises: [e] })

function modele(groups, id = 77, title = 'Haut du corps') { return { id, title, note: null, metadata: { description: null }, groups } }
const squat = (faits = [[60, 10], [62.5, 8]]) => exo('Squat', ['weight', 'reps'], faits.map((f) => [[60, 10], f]))
const pompes = () => exo('Pompes', ['bodyweight', 'reps'], [[[0, 12], [0, 12]], [[0, 12], [null, null]]])
const gainage = () => exo('Gainage', ['time', 'speed'], [[[30, 5], [45, 6]]])

function session(id, utc, groups, { archived = 77, feedback = null, title = 'Haut du corps' } = {}) {
  return { resume: {}, session: { id, status: 'finished', date_completed_utc: utc, date_completed: utc, timezone: 'Europe/Paris', duration: 50, time_elapsed: 3000, feedback, workout: { ...modele(groups, 999, title), archived_original_id: archived } } }
}

const etatVide = (extra = {}) => ({
  profils: [{ id: PID, role: 'client', nom: 'Inventé', fiche: { source: { mypthub: { contactId: '500' } } } }],
  workouts: [], exercices: [{ id: 'ex-squat', nom: 'Squat', categories: [], description: DESCRIPTION_VIDE }], realisations: [], templates: [], ...extra
})

describe('serieFaite', () => {
  it('convertit les valeurs faites et compte les colonnes ignorées', () => {
    const ign = {}
    const meta = { field_1: 'weight', field_2: 'rep_range', field_3: 'distance' }
    expect(serieFaite({ done: { field_1: '42,5', field_2: 9, field_3: 3 } }, meta, ign)).toEqual({ poids: 42.5, reps: 9 })
    expect(ign).toEqual({ distance: 1 })
    expect(serieFaite({ done: null }, meta)).toBeNull()
    expect(serieFaite({ done: { field_1: null, field_2: null } }, meta)).toBeNull()
    expect(serieFaite({ done: { field_1: 0, field_2: 10 } }, { field_1: 'bodyweight', field_2: 'reps' })).toEqual({ poidsDuCorps: true, reps: 10 })
    expect(serieFaite({ done: { field_1: 40 } }, { field_1: 'time' })).toEqual({ tempsTravail: 40 })
  })
  it('date au jour de Paris (minuit passé en UTC la veille)', () => {
    expect(jourParis(msUtc('2025-11-13 23:30:00'))).toBe('2025-11-14')
    expect(jourParis(msUtc('2025-07-01 21:59:00'))).toBe('2025-07-01')
    expect(jourParis(msUtc('2025-07-01 22:01:00'))).toBe('2025-07-02')
  })
})

describe('planifierHistorique', () => {
  it('crée la séance, la réalisation, le template et complète la description', () => {
    const d = { contact: '500', workoutsAssignes: [modele([seul(squat()), { group_type: 'superset', exercises: [pompes(), gainage()] }])], sessions: [
      session(1, '2025-11-13 23:30:00', [seul(exo('Squat', ['weight', 'reps'], [[[60, 10], [60, 10]], [[60, 10], [62.5, 8]]], { description: 'Descendre.' })), { group_type: 'superset', exercises: [pompes(), gainage()] }], { feedback: ' Bien ' })
    ] }
    const plan = planifierHistorique([d], etatVide(), null)
    expect(plan.rapport.erreurs).toEqual([])
    const w = plan.workouts.find((x) => x.id === `${CLE}-w-77`)
    expect(w.blocs.map((b) => b.id)).toEqual([`${CLE}-w-77-b1`, `${CLE}-w-77-b2`])
    expect(w.blocs[1].exercices.map((x) => x.id)).toEqual([`${CLE}-w-77-b2a`, `${CLE}-w-77-b2b`])
    const r = plan.realisations[0]
    expect(r).toMatchObject({ id: `${CLE}-s-1`, clientId: PID, workoutId: w.id, date: '2025-11-14', semaine: '2025-11-10', dureeSec: 3000, volume: 1100, seriesFaites: 4, circuits: {}, commentaire: 'Bien' })
    expect(r.valeurs[`${CLE}-w-77-b1`]).toEqual({ exerciceId: 'ex-squat', series: [{ poids: 60, reps: 10 }, { poids: 62.5, reps: 8 }] })
    expect(r.valeurs[`${CLE}-w-77-b2a`].series).toEqual([{ poidsDuCorps: true, reps: 12 }, null]) // 2e série : done tout vide -> non faite
    expect(plan.rapport.clients[0].colonnesIgnorees).toEqual({ speed: 1 })
    // Exercices : Pompes et Gainage créés, Squat (texte d'attente) reçoit la description MyPTHub.
    expect(plan.exercices.map((e) => e.id).sort()).toEqual(['ex-gainage', 'ex-pompes', 'ex-squat'])
    expect(plan.exercices.find((e) => e.id === 'ex-squat').description).toContain('Descendre.')
    expect(plan.templates[0].valeurs[w.id][`${CLE}-w-77-b1`]).toEqual([{ poids: 60, reps: 10 }, { poids: 62.5, reps: 8 }])
  })

  it('séance version si la structure de la session diffère du modèle ; mutualisée', () => {
    const d = { contact: '500', workoutsAssignes: [modele([seul(squat())])], sessions: [
      session(1, '2025-10-01 08:00:00', [seul(squat()), seul(gainage())], { title: 'Ancienne' }),
      session(2, '2025-10-08 08:00:00', [seul(squat()), seul(gainage())], { title: 'Ancienne' }),
      session(3, '2025-10-15 08:00:00', [seul(squat())])
    ] }
    const plan = planifierHistorique([d], etatVide(), null)
    const v = plan.workouts.find((x) => x.id === `${CLE}-w-77-v1`)
    expect(v.nom).toBe('Ancienne')
    expect(plan.workouts.filter((x) => x.id.includes('-v'))).toHaveLength(1)
    expect(plan.realisations.map((r) => r.workoutId)).toEqual([v.id, v.id, `${CLE}-w-77`])
    expect(plan.rapport.clients[0].versions).toBe(1)
  })

  it('met à jour une séance jamais retouchée, ne touche pas une séance retouchée', () => {
    const ancien = modele([seul(squat())])
    const frais = modele([seul(squat()), seul(gainage())])
    const normalise = { clients: [{ source: { mypthub_contact_id: '500' }, seances: [{ sourceId: '77', ...seanceGroupes(ancien) }, { sourceId: '78', ...seanceGroupes(ancien) }] }] }
    const telImporte = (id) => ({ ...workoutDe(id, PID, seanceGroupes(ancien), () => 'ex-squat'), version: 3 }) // ce que l'import du 5/11 a écrit
    const retouche = { ...telImporte(`${CLE}-w-78`), nom: 'Renommée par le coach' }
    const etat = etatVide({ workouts: [telImporte(`${CLE}-w-77`), retouche] })
    const plan = planifierHistorique([{ contact: '500', workoutsAssignes: [frais, { ...frais, id: 78 }], sessions: [] }], etat, normalise)
    const maj = plan.workouts.find((w) => w.id === `${CLE}-w-77`)
    expect(maj.blocs).toHaveLength(2)
    expect(maj.version).toBeUndefined()
    expect(plan.workouts.some((w) => w.id === `${CLE}-w-78`)).toBe(false)
    const c = plan.rapport.clients[0]
    expect([c.seancesMisesAJour, c.seancesRetouchees.length]).toEqual([1, 1])
    expect(c.seancesRetouchees[0].differences.join('\n')).toContain('nom')
  })

  it('séance déjà à jour : rien ; réalisation déjà là : pas réécrite ; le template de l\'app gagne', () => {
    const w = modele([seul(squat())])
    const etat0 = etatVide()
    const plan0 = planifierHistorique([{ contact: '500', workoutsAssignes: [w], sessions: [] }], etat0, null)
    const wid = `${CLE}-w-77`
    const etat = etatVide({
      workouts: plan0.workouts, exercices: [...etat0.exercices, ...plan0.exercices],
      realisations: [{ id: `${CLE}-s-1` }],
      templates: [{ id: PID, valeurs: { [wid]: { [`${wid}-b1`]: [{ poids: 70, reps: 6 }, null] } } }]
    })
    const plan = planifierHistorique([{ contact: '500', workoutsAssignes: [w], sessions: [session(1, '2025-10-01 08:00:00', [seul(squat())]), session(2, '2025-10-08 08:00:00', [seul(squat([[65, 5], [66, 4]]))])] }], etat, null)
    expect(plan.workouts).toEqual([])
    expect(plan.realisations.map((r) => r.id)).toEqual([`${CLE}-s-2`])
    expect(plan.templates[0].valeurs[wid][`${wid}-b1`]).toEqual([{ poids: 70, reps: 6 }, { poids: 66, reps: 4 }])
  })

  it('client sans profil ignoré ; objet invalide ou trop gros signalé', () => {
    const plan = planifierHistorique([{ contact: '999', sessions: [session(1, '2025-10-01 08:00:00', [seul(squat())])] }], etatVide(), null)
    expect(plan.rapport.clients[0].action).toMatch(/ignoré/)
    expect(plan.realisations).toEqual([])
    const gros = planifierHistorique([{ contact: '500', workoutsAssignes: [modele([seul(squat())])], sessions: [] }], etatVide(), null, { octetsLigne: 50 })
    expect(gros.rapport.erreurs.some((e) => e.includes('trop grosse'))).toBe(true)
  })

  it('canon ignore l\'ordre des clés', () => {
    expect(canon({ a: 1, b: [{ c: 2, d: 3 }] })).toBe(canon({ b: [{ d: 3, c: 2 }], a: 1 }))
  })
})
