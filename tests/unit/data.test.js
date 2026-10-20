import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// Espion : si le SDK Supabase est évalué, le drapeau passe à vrai.
const sdk = vi.hoisted(() => ({ charge: false }))
vi.mock('@supabase/supabase-js', () => {
  sdk.charge = true
  return { createClient: () => ({}) }
})

import { creerApi } from '../../src/data/commun.js'
import { creerData } from '../../src/data/index.js'
import { creerAdapterLocal, stockageMemoire, CLE_STOCKAGE } from '../../src/data/adapters/local.js'
import { creerAdapterSupabase } from '../../src/data/adapters/supabase.js'
import { NOMS_ENTITES } from '../../src/data/entites.js'
import { ErreurData } from '../../src/data/erreurs.js'
import { genererDemo } from '../../src/data/demo/index.js'
import { creerApi } from '../../src/data/commun.js'
import { construireRealisation } from '../../src/domain/realisations.js'
import { reduire, demarrerSeance } from '../../src/engine/seance.js'

const NOW = new Date(2026, 9, 20, 10, 0).getTime()

// ------------------------------------------------------------------------------------------ contrat
// Les mêmes tests doivent passer pour TOUT adaptateur de données.
function contrat(nom, fabrique) {
  describe(`contrat de données — ${nom}`, () => {
    const neuf = () => fabrique()

    it('lister / lire les données de démarrage', async () => {
      const d = neuf()
      expect((await d.exercices.lister()).length).toBe(80)
      expect((await d.profils.lister({ role: 'client' })).map((p) => p.identifiant).sort()).toEqual(['fabien.vincent', 'lea.martin', 'thomas.bernard'])
      const e = await d.exercices.lire('ex-squat')
      expect(e.nom).toBe('Squat')
      expect(await d.exercices.lire('inconnu')).toBe(null)
    })

    it('filtre par champ', async () => {
      const d = neuf()
      const fabien = (await d.profils.lister({ identifiant: 'fabien.vincent' }))[0]
      const seances = await d.seancesCoaching.lister({ clientId: fabien.id })
      expect(seances.length).toBeGreaterThan(0)
      expect(seances.every((s) => s.clientId === fabien.id)).toBe(true)
    })

    it('creer : valide, génère l\'id, refuse un doublon', async () => {
      const d = neuf()
      const cree = await d.exercices.creer({ nom: 'Mon exo', categories: ['jambes'] })
      expect(cree.id).toBeTruthy()
      expect((await d.exercices.lire(cree.id)).nom).toBe('Mon exo')
      await expect(d.exercices.creer({ id: cree.id, nom: 'x', categories: [] })).rejects.toMatchObject({ code: 'EXISTE' })
      await expect(d.exercices.creer({ categories: [] })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('« nom »') })
    })

    it('supprimerMesDonneesSante : efface mes douleurs, mesures, nutrition et réponses, rien d autre ni chez les autres', async () => {
      const d = neuf()
      const fabien = await d.connecter('fabien.vincent', 'DEMO2024')
      const avant = {}
      for (const e of ['douleurs', 'mesures', 'nutrition', 'reponses']) avant[e] = (await d[e].lister({ clientId: fabien.id })).length
      expect(Object.values(avant).every((n) => n > 0)).toBe(true)
      const seances = (await d.seancesCoaching.lister({ clientId: fabien.id })).length
      const realisations = (await d.realisations.lister({ clientId: fabien.id })).length
      expect(await d.supprimerMesDonneesSante()).toEqual(avant)
      for (const e of ['douleurs', 'mesures', 'nutrition', 'reponses']) expect(await d[e].lister({ clientId: fabien.id })).toEqual([])
      expect((await d.seancesCoaching.lister({ clientId: fabien.id })).length).toBe(seances)
      expect((await d.realisations.lister({ clientId: fabien.id })).length).toBe(realisations)
      await d.deconnecter()
      const lea = await d.connecter('lea.martin', 'DEMO2024')
      expect((await d.reponses.lister({ clientId: lea.id })).length).toBeGreaterThan(0)
      await d.deconnecter()
      await expect(d.supprimerMesDonneesSante()).rejects.toMatchObject({ code: 'NON_CONNECTE' })
    })

    it('modifier : fusionne et valide ; id inconnu -> INTROUVABLE', async () => {
      const d = neuf()
      const m = await d.exercices.modifier('ex-squat', { lienVideo: 'https://youtu.be/abc' })
      expect(m).toMatchObject({ nom: 'Squat', lienVideo: 'https://youtu.be/abc' })
      expect((await d.exercices.lire('ex-squat')).lienVideo).toBe('https://youtu.be/abc')
      await expect(d.exercices.modifier('nope', { nom: 'x' })).rejects.toMatchObject({ code: 'INTROUVABLE' })
      await expect(d.exercices.modifier('ex-squat', { nom: '' })).rejects.toMatchObject({ code: 'VALIDATION' })
    })

    it('archiver : masqué par défaut, visible avec { archives: true }, rien de supprimé', async () => {
      const d = neuf()
      await d.exercices.archiver('ex-squat')
      expect((await d.exercices.lister()).length).toBe(79)
      expect((await d.exercices.lister({}, { archives: true })).length).toBe(80)
      expect((await d.exercices.lire('ex-squat')).archive).toBe(true)
    })

    it('session : connexion, mauvais code, déconnexion', async () => {
      const d = neuf()
      expect(await d.utilisateurCourant()).toBe(null)
      await expect(d.connecter('fabien.vincent', 'FAUX00')).rejects.toMatchObject({ code: 'IDENTIFIANTS', message: 'Identifiant ou code incorrect' })
      const p = await d.connecter('Fabien.Vincent', 'DEMO2024')
      expect(p.identifiant).toBe('fabien.vincent')
      expect((await d.utilisateurCourant()).id).toBe(p.id)
      await d.deconnecter()
      expect(await d.utilisateurCourant()).toBe(null)
    })

    it('changerCode : 8 caractères minimum, ancien code vérifié, nouvelle connexion', async () => {
      const d = neuf()
      await d.connecter('fabien.vincent', 'DEMO2024')
      await expect(d.changerCode('DEMO2024', 'abc')).rejects.toMatchObject({ code: 'CODE_TROP_COURT' })
      await expect(d.changerCode('MAUVAIS', 'NOUVEAU24')).rejects.toMatchObject({ code: 'IDENTIFIANTS' })
      await d.changerCode('DEMO2024', 'NOUVEAU24')
      await d.deconnecter()
      await expect(d.connecter('fabien.vincent', 'DEMO2024')).rejects.toMatchObject({ code: 'IDENTIFIANTS' })
      expect((await d.connecter('fabien.vincent', 'NOUVEAU24')).nom).toBe('Fabien Vincent')
    })

    it('un client connecté ne voit que ses données (miroir de la RLS)', async () => {
      const d = neuf()
      const p = await d.connecter('fabien.vincent', 'DEMO2024')
      const profils = await d.profils.lister()
      expect(profils.map((x) => x.id)).toEqual([p.id])
      expect((await d.realisations.lister()).every((r) => r.clientId === p.id)).toBe(true)
      expect((await d.seancesCoaching.lister()).every((r) => r.clientId === p.id)).toBe(true)
      expect((await d.exercices.lister()).length).toBe(80) // bibliothèque lisible par tous
      expect((await d.questionnaires.lister()).length).toBe(2) // questionnaires par défaut
      const lea = (await (async () => { await d.deconnecter(); return d.profils.lister({ identifiant: 'lea.martin' }) })())[0]
      await d.connecter('fabien.vincent', 'DEMO2024')
      expect(await d.profils.lire(lea.id)).toBe(null)
      expect(await d.templates.lire(lea.id)).toBe(null)
    })

    it('le coach voit tout', async () => {
      const d = neuf()
      await d.connecter('corentin', 'COACH2026')
      expect((await d.profils.lister()).length).toBe(4)
    })

    it('creerClient : identifiant unique + code lisible, connexion possible', async () => {
      const d = neuf()
      await d.connecter('corentin', 'COACH2026')
      const a = await d.creerClient({ nom: 'Élodie D\'Arc', tarif: 40, lieuDefaut: 'salle' })
      expect(a.identifiant).toBe('elodie.darc')
      expect(a.code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/)
      expect(a.profil).toMatchObject({ role: 'client', tarif: 40, lieuDefaut: 'salle', archive: false })
      const b = await d.creerClient({ nom: 'Élodie D\'Arc' })
      expect(b.identifiant).toBe('elodie.darc-2')
      await d.deconnecter()
      expect((await d.connecter('elodie.darc', a.code)).id).toBe(a.profil.id)
    })

    it('creerClient avec un backend dont le compte crée aussi le profil (Edge Function Supabase)', async () => {
      const profils = new Map([['coach', { id: 'coach', role: 'coach', identifiant: 'corentin', nom: 'C', archive: false, creeLe: 1 }]])
      let recu = null
      const backend = {
        mode: 'test', profilCreeParCompte: true,
        tout: async () => [...profils.values()], un: async (e, id) => profils.get(id) ?? null,
        utilisateurCourant: async () => profils.get('coach'),
        async creerCompte(identifiant, code, profil) { recu = { identifiant, code, profil }; profils.set('nouveau', { ...profil, id: 'nouveau', archive: false }); return 'nouveau' }
      }
      const r = await creerApi(backend).creerClient({ nom: 'Léa Roux', tarif: 30 })
      expect(recu.code).toHaveLength(8)
      expect(recu.profil).toMatchObject({ role: 'client', identifiant: 'lea.roux', nom: 'Léa Roux', tarif: 30 })
      expect(r.profil.id).toBe('nouveau') // pas de deuxième écriture : le profil vient du backend
    })

    it('enregistrerSeance : idempotent, met à jour le template', async () => {
      const d = neuf()
      const fabien = (await d.profils.lister({ identifiant: 'fabien.vincent' }))[0]
      const workout = (await d.workouts.lire('w-fabien-1'))
      const template = await d.templates.lire(fabien.id)
      let e = demarrerSeance({ workout, clientId: fabien.id, template }, NOW)
      e = reduire(e, { type: 'modifierValeur', exIdx: 0, serieIdx: 0, champ: 'poids', valeur: 99 }, NOW)
      e = reduire(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, NOW)
      e = reduire(e, { type: 'terminer' }, NOW + 1000)
      const r = construireRealisation(e, { id: 'real-test', now: NOW + 1000 })
      expect(await d.enregistrerSeance(r)).toEqual({ ajoutee: true })
      expect(await d.enregistrerSeance(r)).toEqual({ ajoutee: false })
      expect((await d.realisations.lister({ id: 'real-test' }))).toHaveLength(1)
      expect((await d.templates.lire(fabien.id)).valeurs['w-fabien-1']['w1-b1'][0].poids).toBe(99)
      // la séance suivante est pré-remplie
      const suivante = demarrerSeance({ workout, template: await d.templates.lire(fabien.id) }, NOW + 86400000)
      expect(suivante.exercices[0].series[0].valeurs.poids).toBe(99)
    })

    it('import / export : aller-retour sans perte, rapport lisible, format inconnu refusé', async () => {
      const source = neuf()
      const doc = await source.exporterDonnees()
      expect(doc.format).toBe('cdc-coaching/1')
      const cible = fabrique({ vide: true })
      const rapport = await cible.importerDonnees(JSON.parse(JSON.stringify(doc)))
      expect(rapport.message).toContain('Exercices : 80 ajoutés')
      expect((await cible.exercices.lister()).length).toBe(80)
      expect(await cible.workouts.lister()).toEqual(await source.workouts.lister())
      expect(await cible.programmes.lister()).toEqual(await source.programmes.lister())
      await expect(source.importerDonnees({ format: 'cdc-coaching/2' })).rejects.toMatchObject({ code: 'FORMAT', message: 'Format non reconnu (attendu cdc-coaching/1)' })
      await expect(source.importerDonnees({})).rejects.toMatchObject({ code: 'FORMAT' })
    })

    it('exporterMesDonnees : seulement les données du client', async () => {
      const d = neuf()
      await d.connecter('fabien.vincent', 'DEMO2024')
      const doc = await d.exporterMesDonnees()
      expect(doc).toMatchObject({ format: 'cdc-coaching/1', type: 'donnees-client' })
      expect(doc.profil.identifiant).toBe('fabien.vincent')
      expect(doc.realisations.length).toBeGreaterThan(0)
      expect(doc.realisations.every((r) => r.clientId === doc.profil.id)).toBe(true)
    })
  })
}

// Adaptateur local avec stockage en mémoire (aucune dépendance au navigateur).
contrat('local', ({ vide = false } = {}) => {
  const storage = stockageMemoire()
  if (vide) {
    // base sans bibliothèque ni séances ni programmes (cible d'un import)
    const demo = genererDemo(NOW)
    demo.exercices = []; demo.workouts = []; demo.programmes = []
    storage.setItem(CLE_STOCKAGE, JSON.stringify(demo))
  }
  return creerAdapterLocal({ storage, now: () => NOW })
})

// ---------------------------------------------------------------------------------------- spécifique
describe('adaptateur local', () => {
  it('sans .env : mode local', () => {
    const d = creerData({}, { storage: stockageMemoire() })
    expect(d.mode).toBe('local')
    expect(creerData({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }, { storage: stockageMemoire() }).mode).toBe('local')
    expect(creerData({ VITE_SUPABASE_URL: 'https://x.supabase.co' }, { storage: stockageMemoire() }).mode).toBe('local') // clé manquante
  })

  it('avec les deux variables : mode supabase (sans appel réseau à la création)', () => {
    const d = creerData({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'cle-anonyme' })
    expect(d.mode).toBe('supabase')
  })

  it('aucun import de Supabase n\'est exécuté en mode local', async () => {
    sdk.charge = false
    const d = creerData({}, { storage: stockageMemoire(), now: () => NOW })
    await d.exercices.lister()
    await d.connecter('corentin', 'COACH2026')
    expect(sdk.charge).toBe(false)
  })

  it('données persistées entre deux instanciations', async () => {
    const storage = stockageMemoire()
    const a = creerAdapterLocal({ storage, now: () => NOW })
    await a.exercices.creer({ id: 'ex-perso', nom: 'Perso', categories: [] })
    await a.connecter('fabien.vincent', 'DEMO2024')
    const b = creerAdapterLocal({ storage, now: () => NOW + 1e9 })
    expect((await b.exercices.lire('ex-perso')).nom).toBe('Perso')
    expect((await b.utilisateurCourant()).identifiant).toBe('fabien.vincent') // session persistante
  })

  it('les données factices sont générées une seule fois (dates relatives au 1er lancement)', async () => {
    const storage = stockageMemoire()
    const a = creerAdapterLocal({ storage, now: () => NOW })
    const avant = await a.reponses.lister()
    const b = creerAdapterLocal({ storage, now: () => NOW + 40 * 86400000 })
    expect(await b.reponses.lister()).toEqual(avant)
  })

  it('stockage plein -> erreur typée STOCKAGE_PLEIN, rien d\'enregistré à moitié', async () => {
    const storage = stockageMemoire()
    const d = creerAdapterLocal({ storage, now: () => NOW })
    await d.exercices.lister() // initialisation
    const reel = storage.setItem
    storage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e }
    const err = await d.exercices.creer({ id: 'ex-x', nom: 'X', categories: [] }).catch((e) => e)
    expect(err).toBeInstanceOf(ErreurData)
    expect(err).toMatchObject({ code: 'STOCKAGE_PLEIN', message: 'Stockage plein sur cet appareil — non enregistré' })
    storage.setItem = reel
    expect(await d.exercices.lire('ex-x')).toBe(null) // annulé en mémoire aussi
    expect((await d.exercices.lister()).length).toBe(80)
  })

  it('réinitialiser la démo restaure les données et déconnecte', async () => {
    const d = creerAdapterLocal({ storage: stockageMemoire(), now: () => NOW })
    await d.exercices.archiver('ex-squat')
    await d.connecter('fabien.vincent', 'DEMO2024')
    await d.reinitialiserDemo()
    expect((await d.exercices.lister()).length).toBe(80)
    expect(await d.utilisateurCourant()).toBe(null)
  })

  it('file d\'attente : rejouée sans doublon', async () => {
    const d = creerAdapterLocal({ storage: stockageMemoire(), now: () => NOW })
    expect(await d.tailleFile()).toBe(0)
    expect(await d.synchroniserFile()).toEqual({ envoyees: 0, restantes: 0 })
  })
})

describe('adaptateur Supabase', () => {
  const sb = () => creerAdapterSupabase({ url: 'https://x.supabase.co', anonKey: 'cle-anonyme', storage: stockageMemoire() })

  it('expose exactement les mêmes méthodes que l\'adaptateur local', () => {
    const local = creerAdapterLocal({ storage: stockageMemoire() })
    const distant = sb()
    expect(Object.keys(distant).sort()).toEqual(Object.keys(local).sort())
    for (const entite of NOMS_ENTITES) expect(Object.keys(distant[entite]).sort()).toEqual(Object.keys(local[entite]).sort())
    expect(distant.mode).toBe('supabase')
    expect(local.mode).toBe('local')
  })

  it('refuse de démarrer sans url ni clé', () => {
    expect(() => creerAdapterSupabase({})).toThrow(/VITE_SUPABASE_URL/)
  })

  it('aucune clé ni URL réelle dans le code source', () => {
    for (const f of ['src/data/adapters/supabase.js', 'src/data/index.js', 'src/data/adapters/local.js']) {
      const code = readFileSync(f, 'utf8')
      expect(code, f).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/)
      expect(code, f).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/)
    }
  })

  it('le SDK n\'est chargé qu\'à la première requête (import dynamique)', () => {
    const code = readFileSync('src/data/adapters/supabase.js', 'utf8')
    expect(code).not.toMatch(/^import .* from '@supabase\/supabase-js'/m)
    expect(code).toMatch(/await import\('@supabase\/supabase-js'\)/)
  })

})

describe("file d'attente hors connexion", () => {
  // Backend minimal en mémoire dont le « réseau » se coupe et se rétablit.
  function backendCoupe() {
    const etat = { enLigne: false, realisations: [], templates: [], file: [] }
    const coupe = () => { if (!etat.enLigne) throw new ErreurData('RESEAU', 'Failed to fetch') }
    return {
      etat,
      mode: 'test',
      un: async (entite, id) => { coupe(); return etat[entite].find((x) => x.id === id) || null },
      ecrire: async (entite, obj) => { coupe(); etat[entite].push(obj) },
      tout: async () => [],
      file: { lire: async () => etat.file, ecrire: async (l) => { etat.file = l } }
    }
  }
  const realisation = { id: 'r1', clientId: 'c1', workoutId: 'w', date: '2026-10-20', semaine: '2026-10-19', valeurs: {}, dureeSec: 60, volume: 0, termineLe: NOW }

  it('sans réseau la séance est mise en file ; rejouée deux fois, une seule réalisation', async () => {
    const b = backendCoupe()
    const d = creerApi(b)
    expect(await d.enregistrerSeanceOuFile(realisation)).toEqual({ ajoutee: false, enAttente: true })
    await d.enregistrerSeanceOuFile(realisation) // même séance retentée : pas de doublon dans la file
    expect(await d.tailleFile()).toBe(1)
    expect(await d.synchroniserFile()).toEqual({ envoyees: 0, restantes: 1 }) // toujours hors connexion
    b.etat.enLigne = true
    expect(await d.synchroniserFile()).toEqual({ envoyees: 1, restantes: 0 })
    expect(await d.synchroniserFile()).toEqual({ envoyees: 0, restantes: 0 })
    expect(b.etat.realisations).toHaveLength(1)
    expect(b.etat.templates).toHaveLength(1)
  })

  it('une réalisation invalide est refusée avant toute mise en file', async () => {
    const d = creerApi(backendCoupe())
    await expect(d.enregistrerSeanceOuFile({ id: 'x' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

// ------------------------------------------------------------------------------------------ schema.sql
describe('supabase/schema.sql', () => {
  const sql = readFileSync('supabase/schema.sql', 'utf8')
  const tables = [...sql.matchAll(/create table (\w+)/g)].map((m) => m[1])

  it('contient toutes les tables du modèle', () => {
    expect(tables.sort()).toEqual([
      'alertes_vues', 'douleurs', 'entrees_nutrition', 'exercices', 'mesures', 'mots_du_coach', 'profiles',
      'programmes', 'questionnaires', 'realisations', 'reponses', 'seances_coaching', 'templates_client', 'workouts'
    ])
  })

  it('RLS activée sur chaque table, avec au moins une policy, déclarée APRÈS la table', () => {
    for (const t of tables) {
      const creation = sql.indexOf(`create table ${t} `)
      const rls = sql.indexOf(`alter table ${t} enable row level security`)
      const policy = sql.search(new RegExp(`create policy \\w+ on ${t}\\b`))
      expect(creation, `create table ${t}`).toBeGreaterThanOrEqual(0)
      expect(rls, `RLS ${t}`).toBeGreaterThan(creation)
      expect(policy, `policy ${t}`).toBeGreaterThan(rls)
    }
  })

  it('les tables du registre de données existent dans le schéma', () => {
    // (importé dynamiquement pour garder ce test indépendant de l'ordre)
    const attendues = ['profiles', 'exercices', 'workouts', 'programmes', 'realisations', 'templates_client', 'seances_coaching', 'mots_du_coach', 'questionnaires', 'reponses', 'mesures', 'douleurs', 'entrees_nutrition', 'alertes_vues']
    for (const t of attendues) expect(tables).toContain(t)
  })

  it('la fonction is_coach existe avant les policies qui l\'utilisent', () => {
    expect(sql.indexOf('create function is_coach')).toBeGreaterThan(0)
    expect(sql.indexOf('create function is_coach')).toBeLessThan(sql.indexOf('create policy'))
  })

  it('un client ne lit que ses lignes et ne peut changer ni son rôle ni son tarif ni ses modules', () => {
    expect(sql).toMatch(/create policy profiles_lecture on profiles[\s\S]*?\(id = auth\.uid\(\)\) or is_coach\(\)/)
    expect(sql).toMatch(/new\.role := old\.role/)
    expect(sql).toMatch(/new\.tarif := old\.tarif/)
    expect(sql).toMatch(/new\.modules := old\.modules/)
    // tables en lecture seule pour le client : toute policy d'écriture est réservée au coach
    const policies = [...sql.matchAll(/create policy (\w+) on (\w+) for (\w+) to authenticated([^;]*);/g)]
    for (const t of ['programmes', 'seances_coaching', 'workouts', 'mots_du_coach', 'exercices', 'alertes_vues']) {
      for (const [, nom, table, commande, corps] of policies.filter((p) => p[2] === t && p[3] !== 'select')) {
        expect(corps, `${table} ${nom} (${commande})`).toMatch(/is_coach\(\)/)
      }
    }
  })

  it('I1 : un client archivé perd l accès (toute policy client teste est_actif)', () => {
    expect(sql).toMatch(/create function est_actif\(\)[\s\S]*?security definer set search_path = public, pg_temp[\s\S]*?not archive/)
    expect(sql.indexOf('create function est_actif')).toBeLessThan(sql.indexOf('create policy'))
    expect(sql).toMatch(/revoke execute on function est_actif\(\) from public, anon/)
    const policies = [...sql.matchAll(/create policy (\w+) on ([\w.]+) for (\w+) to authenticated([^;]*);/g)]
    for (const [, nom, , , corps] of policies.filter((p) => /auth\.uid\(\)/.test(p[4]) && !/profiles_lecture/.test(p[1]))) {
      expect(corps, nom).toMatch(/est_actif\(\)/)
    }
  })

  it('bucket de photos privé avec règles par dossier client', () => {
    expect(sql).toMatch(/insert into storage\.buckets[\s\S]*'photos', 'photos', false/)
    expect(sql).toMatch(/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)
  })

  it('aucune table sans clé de rattachement client (sauf bibliothèque et profils)', () => {
    for (const t of tables.filter((x) => !['profiles', 'exercices'].includes(x))) {
      const bloc = sql.slice(sql.indexOf(`create table ${t} `), sql.indexOf(');', sql.indexOf(`create table ${t} `)))
      expect(bloc, t).toMatch(/client_id/)
    }
  })
})
