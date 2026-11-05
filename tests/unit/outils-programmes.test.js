// Outils du lot « programmes » : création → lecture → modification, validation, suppression en 2 temps, isolation entre clients.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assembler } from '../../serveur/src/assembler.js'
import { lireConfig } from '../../serveur/src/config.js'
import { appeler } from '../../serveur/src/outils.js'
import { validerProgramme, validerWorkout } from '../../src/domain/modele.js'
import { etatSemaine } from '../../src/domain/programme.js'

const VIDEO = 'https://www.youtube.com/watch?v=abcdefghijk'
let dossier
let app
const outil = (nom, args) => appeler(app, nom, args, 'test')
const profil = (id, nom) => ({ id, role: 'client', identifiant: id, nom, tarif: 35, lieuDefaut: 'domicile', modules: {}, archive: false, creeLe: 1 })
const squat = { exercice: { nom: 'Squat', series: 3, reps: 8, charge: 40, repos: 90 } }

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'prog-test-'))
  const config = { ...lireConfig({ COACH_API_KEY: 'cle-de-test-0123456789abcdef-0123456789', DATA_DIR: dossier, DB_FILE: join(dossier, 'test.db') }), youtubeCle: '' }
  app = await assembler(config, { now: () => Date.UTC(2026, 10, 5, 12) }) // jeudi 2026-11-05
  await app.service.api.profils.creer(profil('alice', 'Alice Durand'))
  await app.service.api.profils.creer(profil('bruno', 'Bruno Petit'))
  app.biblio.proposer({ nom: 'Squat', url: VIDEO, chaine: 'Test', duree: 15, titre: 'Squat', score: 90 })
})
afterAll(() => { app.backend.db?.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('programmes', () => {
  let prog
  it('crée un programme de 2 semaines, valide pour l\'app, avec vidéos et jours fixes', async () => {
    const r = await outil('creer_programme', {
      client: 'alice', nom: 'Prépa été', debut: '2026-11-05', notes: 'Genou fragile',
      semaines: [
        { seances: [{ nom: 'Bas du corps', jour: 'lundi', blocs: [squat] }, { nom: 'Haut du corps', jour: 'jeudi', blocs: [{ exercice: { nom: 'Zzz inconnu', reps: 10 } }] }] },
        { seances: [{ nom: 'Full body', blocs: [squat] }] }
      ]
    })
    expect(r.ok).toBe(true)
    prog = r.donnees.id
    const p = await app.service.api.programmes.lire(prog)
    expect(validerProgramme(p).ok).toBe(true)
    expect(p).toMatchObject({ clientId: 'alice', mode: 'parSemaine', debut: '2026-11-02', notes: expect.stringContaining('Genou fragile') })
    expect(p.semaines.map((s) => s.length)).toEqual([2, 1])
    for (const id of p.semaines.flat()) expect(validerWorkout(await app.service.api.workouts.lire(id)).ok).toBe(true)
    // vidéo du Squat attachée, Zzz inconnu signalé sans vidéo
    expect(r.donnees.exercicesSansVideo).toEqual(['Zzz inconnu'])
    expect((await app.service.api.exercices.lister()).find((e) => e.nom === 'Squat').lienVideo).toBe(VIDEO)
    // l'app cliente place bien les séances (lundi / jeudi)
    const sem = etatSemaine(p, [], '2026-11-05')
    expect(sem.parJour[0]).toHaveLength(1)
    expect(sem.parJour[3]).toHaveLength(1)
    expect(sem.aFaire).toHaveLength(0)
  })

  it('lit : liste et détail', async () => {
    const l = await outil('lister_programmes', { client: 'alice' })
    expect(l.donnees.programmes).toMatchObject([{ id: prog, nbSemaines: 2, nbSeances: 3, client: 'Alice Durand' }])
    const v = await outil('voir_programme', { programme: 'Prépa été', client: 'alice' })
    expect(v.donnees.programme.semaines[0].seances[0]).toMatchObject({ nom: 'Bas du corps', jour: 'lundi', exercices: ['Squat'] })
  })

  it('modifie : renomme, ajoute une séance en semaine 3, déplace une séance', async () => {
    const v = (await outil('voir_programme', { programme: prog })).donnees.programme
    const hautId = v.semaines[0].seances[1].id
    const r = await outil('modifier_programme', {
      programme: prog, nom: 'Prépa été 2', deplacerSeance: { seanceId: hautId, jour: 'vendredi' },
      ajouterSeances: [{ semaine: 3, nom: 'Cardio', jour: 'mardi', blocs: [{ circuit: { format: 'amrap', minutes: 8, exercices: [{ nom: 'Burpees', reps: 5 }] } }] }]
    })
    expect(r.ok).toBe(true)
    const p = await app.service.api.programmes.lire(prog)
    expect(p.nom).toBe('Prépa été 2')
    expect(p.semaines).toHaveLength(3)
    expect(p.joursFixes[hautId]).toBe(4)
    expect(validerProgramme(p).ok).toBe(true)
    const mauvais = await outil('modifier_programme', { programme: prog, deplacerSeance: { seanceId: 'absente', jour: 'mardi' } })
    expect(mauvais.code).toBe('SEANCE_INTROUVABLE')
  })

  it('note : ajoute le texte tel quel avec la date, sans rien effacer', async () => {
    const r = await outil('noter_programme', { programme: prog, texte: '  Il a mal au dos, <b>alléger</b> ' })
    expect(r.donnees.notes).toContain('Genou fragile')
    expect(r.donnees.notes).toMatch(/\n\[2026-11-05\] Il a mal au dos, <b>alléger<\/b>$/)
  })

  it('duplique une séance vers un autre client et la place', async () => {
    const v = (await outil('voir_programme', { programme: prog })).donnees.programme
    const src = v.semaines[0].seances[0].id
    const r = await outil('dupliquer_seance', { seanceId: src, vers: 'bruno', nom: 'Bas du corps B' })
    expect(r.ok).toBe(true)
    expect(r.donnees.place).toBeNull()
    const w = await app.service.api.workouts.lire(r.donnees.id)
    expect(w).toMatchObject({ clientId: 'bruno', nom: 'Bas du corps B' })
    expect(validerWorkout(w).ok).toBe(true)
    expect(w.blocs[0].id).not.toBe((await app.service.api.workouts.lire(src)).blocs[0].id)
    // refus de placer la copie de Bruno dans le programme d'Alice
    const refus = await outil('dupliquer_seance', { seanceId: src, vers: 'bruno', programme: prog, semaine: 1 })
    expect(refus.code).toBe('PROGRAMME_AUTRE_CLIENT')
    // copie pour le même client, placée en semaine 2, vendredi
    const ok = await outil('dupliquer_seance', { seanceId: src, programme: prog, semaine: 2, jour: 'vendredi' })
    expect(ok.donnees.place).toMatchObject({ semaine: 2, jour: 'vendredi' })
    expect((await app.service.api.programmes.lire(prog)).semaines[1]).toContain(ok.donnees.id)
  })

  it('isole les clients : Bruno ne voit rien d\'Alice', async () => {
    expect((await outil('lister_programmes', { client: 'bruno' })).donnees.programmes).toEqual([])
    expect((await outil('lister_programmes', {})).donnees.programmes).toHaveLength(1)
  })

  it('refuse les entrées invalides', async () => {
    expect((await outil('creer_programme', { client: 'alice', nom: 'X', semaines: [] })).code).toBe('VALIDATION')
    expect((await outil('creer_programme', { client: 'alice', nom: 'X', semaines: [{ seances: [{ nom: 'a', jour: 'lundi2' }] }] })).code).toBe('VALIDATION')
    expect((await outil('creer_programme', { client: 'alice', nom: 'X', repeter: true, semaines: [{ seances: [{ nom: 'a' }] }, { seances: [{ nom: 'b' }] }] })).code).toBe('VALIDATION')
    expect((await outil('creer_programme', { client: 'inconnu', nom: 'X', semaines: [{ seances: [{ nom: 'a' }] }] })).code).toBe('CLIENT_INTROUVABLE')
    expect((await outil('voir_programme', { programme: 'nope' })).code).toBe('PROGRAMME_INTROUVABLE')
  })

  it('n\'enregistre rien si une séance échoue en cours de création', async () => {
    const avant = (await app.service.api.workouts.lister()).length
    const r = await outil('creer_programme', { client: 'alice', nom: 'Raté', semaines: [{ seances: [{ nom: 'ok', blocs: [squat] }, { nom: 'ko', blocs: [{ circuit: { format: 'emom', exercices: [{ nom: 'X' }] } }] }] }] })
    expect(r.ok).toBe(false)
    expect((await app.service.api.workouts.lister()).length).toBe(avant)
  })

  it('programme répété : une semaine type', async () => {
    const r = await outil('creer_programme', { client: 'bruno', nom: 'Routine', repeter: true, semaines: [{ seances: [{ nom: 'A', jour: 'mardi', blocs: [squat] }] }] })
    const p = await app.service.api.programmes.lire(r.donnees.id)
    expect(validerProgramme(p).ok).toBe(true)
    expect(p).toMatchObject({ mode: 'repete', workouts: [expect.any(String)] })
  })

  it('supprime en 2 temps', async () => {
    const a = await outil('supprimer_programme', { programme: prog })
    expect(a.donnees.confirmationRequise).toBe(true)
    expect(await app.service.api.programmes.lire(prog)).toBeTruthy()
    const mauvais = await outil('supprimer_programme', { programme: prog, jeton: '0'.repeat(32) })
    expect(mauvais.code).toBe('JETON_INVALIDE')
    expect(await app.service.api.programmes.lire(prog)).toBeTruthy()
    // un jeton ne vaut que pour la même action (avecSeances change l'action)
    expect((await outil('supprimer_programme', { programme: prog, avecSeances: true, jeton: a.donnees.jeton })).code).toBe('JETON_INVALIDE')
    const ids = (await app.service.api.programmes.lire(prog)).semaines.flat()
    const b = await outil('supprimer_programme', { programme: prog })
    const fin = await outil('supprimer_programme', { programme: prog, jeton: b.donnees.jeton })
    expect(fin.donnees.supprimee).toBe(true)
    expect(await app.service.api.programmes.lire(prog)).toBeFalsy()
    expect(await app.service.api.workouts.lire(ids[0])).toBeTruthy() // séances conservées par défaut
    const rejoue = await outil('supprimer_programme', { programme: prog, jeton: b.donnees.jeton })
    expect(rejoue.code).toBe('PROGRAMME_INTROUVABLE')
  })
})
