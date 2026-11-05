// Correctifs d'audit (2026-11-05) : dates du calendrier, séance passée, blocage inversé, avertissement de doublon,
// messages en français (zod, client archivé, jeton), reps 0 + tempsTravail.
import { beforeEach, describe, expect, it } from 'vitest'
import { creerOutils, appeler } from '../../serveur/src/outils.js'
import { creerService } from '../../serveur/src/service.js'
import { creerStoreSqlite, ouvrirBase } from '../../serveur/src/magasin-sqlite.js'
import { jourValide } from '../../serveur/src/outils/dates.js'

const NOW = Date.UTC(2026, 10, 5, 10)
const BIBLIO = { connue: () => null, chercher: () => [], proposer() {}, remplacer() {}, valider() {} }
let outils
const journal = { ecrire() {} }
const lancer = (nom, args) => appeler({ outils, journal }, nom, args, 'test')
const fetchFn = async () => ({ status: 200, ok: true, json: async () => ({ blocage: { id: 'b1' } }) })

beforeEach(() => {
  const backend = creerStoreSqlite(ouvrirBase(':memory:'))
  const service = creerService({ backend, biblio: BIBLIO, now: () => NOW })
  outils = creerOutils(service, { service, backend, biblio: BIBLIO, config: { resaUrl: 'http://resa.test', resaCle: 'k'.repeat(40) }, now: () => NOW, fetchFn })
})

describe('dates du calendrier', () => {
  it('jourValide', () => {
    for (const ok of ['2026-02-28', '2028-02-29', '2026-12-31']) expect(jourValide(ok)).toBe(true)
    for (const ko of ['2026-02-30', '2026-13-01', '2026-99-99', '2027-02-29', '2026-1-01']) expect(jourValide(ko)).toBe(false)
  })
  it('refusées dans les schémas (creer_seance, consulter_agenda, bloquer_creneau)', async () => {
    const { donnees } = await lancer('creer_client', { nom: 'Lou Test' })
    expect((await lancer('creer_seance', { client: donnees.id, nom: 'S', date: '2026-02-30' })).code).toBe('VALIDATION')
    expect((await lancer('consulter_agenda', { client: donnees.id, du: '2026-13-01' })).code).toBe('VALIDATION')
    expect((await lancer('bloquer_creneau', { debut: '2026-99-99', fin: '2026-99-99' })).code).toBe('VALIDATION')
    expect((await lancer('bloquer_creneau', { debut: '2026-11-06T25:00', fin: '2026-11-06T26:00' })).code).toBe('VALIDATION')
  })
  it('planifier_seance_coaching refuse une date passée, accepte aujourd\'hui', async () => {
    const { donnees } = await lancer('creer_client', { nom: 'Lou Test' })
    const r = await lancer('planifier_seance_coaching', { client: donnees.id, date: '2026-11-04', heure: '10:00' })
    expect(r.code).toBe('VALIDATION'); expect(r.erreur).toContain('passée')
    expect((await lancer('planifier_seance_coaching', { client: donnees.id, date: '2026-11-05', heure: '10:00' })).ok).toBe(true)
  })
})

describe('bloquer_creneau', () => {
  it('refuse un début après la fin ; accepte une journée entière (début = fin)', async () => {
    expect((await lancer('bloquer_creneau', { debut: '2026-11-07', fin: '2026-11-06' })).code).toBe('VALIDATION')
    expect((await lancer('bloquer_creneau', { debut: '2026-11-06T16:00', fin: '2026-11-06T14:00' })).code).toBe('VALIDATION')
    expect((await lancer('bloquer_creneau', { debut: '2026-11-06T14:00', fin: '2026-11-06T14:00' })).code).toBe('VALIDATION')
    expect((await lancer('bloquer_creneau', { debut: '2026-11-06', fin: '2026-11-06' })).ok).toBe(true)
  })
})

describe('creer_programme', () => {
  it('avertit si un programme du même nom existe déjà', async () => {
    const { donnees } = await lancer('creer_client', { nom: 'Lou Test' })
    const a = { client: donnees.id, nom: 'Force', semaines: [{ seances: [{ nom: 'A', blocs: [{ exercice: { nom: 'Gainage', reps: 0, tempsTravail: 45 } }] }] }] }
    const un = await lancer('creer_programme', a)
    expect(un.erreur).toBeUndefined(); expect(un.donnees.avertissement).toBeUndefined()
    const deux = await lancer('creer_programme', { ...a, nom: 'force' })
    expect(deux.donnees.avertissement).toContain('existe déjà')
  })
})

describe('messages en français', () => {
  it('erreurs zod traduites', async () => {
    const r = await lancer('creer_client', { tarif: 'cher', role: 'coach' })
    expect(r.code).toBe('VALIDATION')
    expect(r.erreur).toContain('obligatoire'); expect(r.erreur).toContain('type incorrect'); expect(r.erreur).toContain('champ(s) inconnu(s)')
    expect(r.erreur).not.toMatch(/Invalid|expected|Unrecognized|Too small/)
  })
  it('client introuvable / archivé / ambigu', async () => {
    expect((await lancer('fiche_client', { client: 'Personne' })).erreur).toMatch(/^Client introuvable : « Personne »/)
    const { donnees } = await lancer('creer_client', { nom: 'Eva Retour' })
    const t = (await lancer('archiver_client', { client: donnees.id })).donnees
    await lancer('archiver_client', { client: donnees.id, jeton: t.jeton })
    for (const outil of [['creer_seance', { client: donnees.id, nom: 'S' }], ['nouveau_code_client', { client: donnees.id }]]) {
      const r = await lancer(...outil)
      expect(r.code).toBe('CLIENT_ARCHIVE'); expect(r.erreur).toContain('reactiver_client')
    }
  })
  it('jeton invalide : demande les mêmes arguments ou un nouveau jeton', async () => {
    const { donnees } = await lancer('creer_client', { nom: 'Eva Retour' })
    const r = await lancer('archiver_client', { client: donnees.id, jeton: 'a'.repeat(32) })
    expect(r.code).toBe('JETON_INVALIDE'); expect(r.erreur).toContain('mêmes arguments'); expect(r.erreur).toContain('nouveau jeton')
  })
})
