// Outils coach « questionnaires » : création -> lecture -> modification, validation, suppression en 2 temps, envoi, réponses et consentement santé.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assembler } from '../../serveur/src/assembler.js'
import { lireConfig } from '../../serveur/src/config.js'
import { appeler } from '../../serveur/src/outils.js'
import { VERSION_CONSENTEMENT } from '../../src/domain/consentement.js'
import { validerQuestionnaire } from '../../src/domain/modele.js'

let dossier, app
const CLE = 'cle-de-test-0123456789abcdef-0123456789'
const outil = (nom, args) => appeler(app, nom, args, 'test')
const consent = (sante) => ({ son: true, vibration: true, unite: 'kg', consentement: { version: VERSION_CONSENTEMENT, sante } })
const profil = (id, nom, sante) => ({ id, role: 'client', identifiant: id, nom, tarif: 35, lieuDefaut: 'domicile', modules: {}, archive: false, creeLe: 1, consentementLe: 1, preferences: consent(sante) })

const QUESTIONS = [
  { libelle: 'Comment avez-vous dormi ?', type: 'curseur', etiquettes: ['Très mal', 'Très bien'] },
  { libelle: 'Votre faim ?', type: 'choixUnique', choix: ['Pas faim', 'Normale', 'Très faim'] },
  { libelle: 'Votre poids', type: 'nombre', unite: 'kg', min: 20, max: 300, pas: 0.1, defaut: 70, cle: 'poids' },
  { libelle: 'Humeur', type: 'emojis' },
  { libelle: 'Un commentaire ?', type: 'texte', optionnel: true }
]

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'q-test-'))
  app = await assembler({ ...lireConfig({ COACH_API_KEY: CLE, DATA_DIR: dossier, DB_FILE: join(dossier, 'app.db') }), youtubeCle: '' }, { now: () => Date.UTC(2026, 10, 5, 12) })
  const b = app.backend
  await b.ecrire('profils', profil('alice', 'Alice Martin', true))
  await b.ecrire('profils', profil('bob', 'Bob Durand', true))
  await b.ecrire('profils', profil('carla', 'Carla Petit', false))
  await b.ecrire('profils', { ...profil('dan', 'Dan Nouveau', true), consentementLe: null, preferences: {} })
})
afterAll(() => { app.backend.db?.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('outils questionnaires', () => {
  let id
  it('crée un questionnaire valide pour l\'app, le relit, le liste', async () => {
    const r = await outil('creer_questionnaire', { nom: 'Bilan du matin', frequence: 'quotidien', questions: QUESTIONS })
    expect(r.ok).toBe(true)
    id = r.donnees.id
    expect(r.donnees.cles).toEqual(['commentAvezVousDormi', 'votreFaim', 'poids', 'humeur', 'unCommentaire'])
    const v = await outil('voir_questionnaire', { id })
    expect(validerQuestionnaire(v.donnees).ok).toBe(true)
    expect(v.donnees.questions[3].choix).toHaveLength(5)
    expect(v.donnees.questions[0]).toMatchObject({ min: 0, max: 10 })
    const l = await outil('lister_questionnaires', {})
    expect(l.donnees.questionnaires.map((q) => q.id)).toContain(id)
  })
  it('modifie le nom et les questions', async () => {
    const r = await outil('modifier_questionnaire', { id, nom: 'Bilan', questions: [QUESTIONS[2]] })
    expect(r.donnees).toMatchObject({ nom: 'Bilan', nbQuestions: 1 })
    expect((await outil('voir_questionnaire', { id })).donnees.questions[0].cle).toBe('poids')
  })
  it('refuse les questions mal formées et un id inconnu', async () => {
    const mal = (q) => outil('creer_questionnaire', { nom: 'X', frequence: 'hebdo', questions: [q] })
    expect((await mal({ libelle: 'A ?', type: 'choixUnique' })).code).toBe('VALIDATION')
    expect((await mal({ libelle: 'A ?', type: 'nombre', min: 10, max: 5 })).code).toBe('VALIDATION')
    expect((await mal({ libelle: 'A ?', type: 'inconnu' })).code).toBe('VALIDATION')
    expect((await outil('modifier_questionnaire', { id })).code).toBe('VALIDATION')
    expect((await outil('voir_questionnaire', { id: 'nope' })).code).toBe('QUESTIONNAIRE_INTROUVABLE')
  })
  it('envoie à un client une copie personnelle, sans doublon ; un autre client ne la voit pas', async () => {
    const r = await outil('envoyer_questionnaire', { id, client: 'Alice' })
    expect(r.donnees.deja).toBe(false)
    expect((await outil('envoyer_questionnaire', { id, client: 'alice' })).donnees.deja).toBe(true)
    const pourAlice = (await outil('lister_questionnaires', { client: 'alice' })).donnees.questionnaires.map((q) => q.id)
    const pourBob = (await outil('lister_questionnaires', { client: 'bob' })).donnees.questionnaires.map((q) => q.id)
    expect(pourAlice).toContain(r.donnees.id)
    expect(pourBob).not.toContain(r.donnees.id)
    expect((await outil('envoyer_questionnaire', { id: r.donnees.id, client: 'bob' })).code).toBe('QUESTIONNAIRE_AUTRE_CLIENT')
  })
  it('refuse d\'envoyer à un client sans accès santé', async () => {
    expect((await outil('envoyer_questionnaire', { id, client: 'carla' })).code).toBe('CONSENTEMENT_SANTE')
    expect((await outil('envoyer_questionnaire', { id, client: 'dan' })).code).toBe('CONSENTEMENT_SANTE')
  })
  it('lit les réponses d\'un client sans mélanger les autres, et masque les clients sans consentement', async () => {
    const b = app.backend
    await b.ecrire('reponses', { id: 'r1', clientId: 'alice', questionnaireId: id, frequence: 'quotidien', date: '2026-11-04', valeurs: { poids: 61.5 } })
    await b.ecrire('reponses', { id: 'r2', clientId: 'bob', questionnaireId: id, frequence: 'quotidien', date: '2026-11-05', valeurs: { poids: 80 } })
    await b.ecrire('reponses', { id: 'r3', clientId: 'carla', questionnaireId: id, frequence: 'quotidien', date: '2026-11-05', valeurs: { poids: 55 } })
    const a = await outil('lire_reponses', { client: 'alice' })
    expect(a.donnees.reponses).toHaveLength(1)
    expect(a.donnees.reponses[0]).toMatchObject({ client: 'Alice Martin', reponses: [{ question: 'Votre poids', valeur: 61.5 }] })
    const q = await outil('lire_reponses', { questionnaire: id })
    expect(q.donnees.reponses.map((r) => r.clientId)).toEqual(['bob', 'alice'])
    expect(q.donnees.masqueesConsentement).toBe(1)
    expect(JSON.stringify(q.donnees)).not.toContain('55')
    expect((await outil('lire_reponses', { client: 'carla' })).code).toBe('CONSENTEMENT_SANTE')
    expect((await outil('lire_reponses', {})).code).toBe('VALIDATION')
    expect((await outil('lire_reponses', { questionnaire: id, du: '2026-11-05' })).donnees.reponses).toHaveLength(1)
  })
  it('supprime en 2 temps : sans jeton rien ne part, mauvais jeton refusé, bon jeton supprime (réponses gardées)', async () => {
    const t1 = (await outil('supprimer_questionnaire', { id })).donnees
    expect(t1.confirmationRequise).toBe(true)
    expect((await outil('voir_questionnaire', { id })).ok).toBe(true)
    expect((await outil('supprimer_questionnaire', { id, jeton: 'a'.repeat(32) })).code).toBe('JETON_INVALIDE')
    expect((await outil('voir_questionnaire', { id })).ok).toBe(true)
    // un jeton d'un autre questionnaire ne sert pas
    const autre = (await outil('creer_questionnaire', { nom: 'Autre', frequence: 'ponctuel', questions: [QUESTIONS[4]] })).donnees.id
    const tAutre = (await outil('supprimer_questionnaire', { id: autre })).donnees.jeton
    expect((await outil('supprimer_questionnaire', { id, jeton: tAutre })).code).toBe('JETON_INVALIDE')
    const r = await outil('supprimer_questionnaire', { id, jeton: (await outil('supprimer_questionnaire', { id })).donnees.jeton })
    expect(r.donnees.supprimee).toBe(true)
    expect((await outil('voir_questionnaire', { id })).code).toBe('QUESTIONNAIRE_INTROUVABLE')
    expect(await app.backend.un('reponses', 'r1')).toBeTruthy()
  })
})
