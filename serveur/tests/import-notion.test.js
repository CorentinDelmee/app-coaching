// Import Notion : récap SYNTHÉTIQUE (personnes inventées) aux formes de l'export réel du 2026-11-06,
// rapprochement par nom / prénom, notes gardées, bloc remplacé (idempotent), essai sans écriture, rien de créé.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { normaliser, nomsDe, fusionnerNotes, MARQUEUR_DEBUT } from '../src/import-notion/normaliser.js'
import { importer } from '../src/import-notion/importer.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'

const fiche = (titre, { statut = '🟢 Actif', lieu = 'Dance & Fitness', tel = '—', email = '—', seances = '' } = {}) => `### ${titre}

| | |
| --- | --- |
| **Statut** | ${statut} |
| **Priorité** | 🔥 Haute |
| **Rythme** | ~1x/semaine |
| **Lieu** | ${lieu} |
| **Origine** | Connaissance |
| **Frein** | Aucun |
| **Séances 2026 (compteur Notion)** | 3 |
| **Téléphone** | ${tel} |
| **Email** | ${email} |
| **Fiche Notion** | [ouvrir](https://app.notion.com/abc) |

**Prochaine action.** Rappeler **lundi**.

**Séances sur l'agenda : 2** — de 02/09/2026 19h00 à 16/09/2026 19h00.

- **2026** (2) : 02/09/2026 19h00 · 16/09/2026 19h00
${seances}
#### Contenu de la fiche

**Profil.** Coureuse.

## ⚠️ Antécédent

> Genou fragile.

---
`
const MD = `# Clients de coaching

**Export du 06/11/2026.** Fiches.

## Fiches clients

${fiche('Zoé Testeuse', { tel: '06 00 00 00 00' })}
${fiche('Anne (Durand) & Paul (domicile)', { lieu: 'Domicile' })}
${fiche('Marc')}
${fiche('Marc (Lebon) — duo avec Zoé')}
${fiche('Inconnu Total', { statut: '👀 Prospect' })}
${fiche('Léon Soualle', { email: 'Leon@Exemple.test' })}

## Séances non rattachées

- **Coaching Personne** — 1 : 01/01/2026 10h00
`

describe('normaliser (récap Notion)', () => {
  it('lit les fiches, noms, propriétés, séances, contenu', () => {
    const n = normaliser(MD)
    expect(n.exporteLe).toBe('2026-11-06')
    expect(n.clients).toHaveLength(6)
    const z = n.clients[0]
    expect(z.proprietes).toMatchObject({ statut: 'Actif', priorite: 'Haute', lieu: 'Dance & Fitness' })
    expect(z.lieuDefaut).toBe('salle')
    expect(z.contact).toEqual({ telephone: '06 00 00 00 00' })
    expect(z.seances).toEqual({ total: 2, dates: ['2026-09-02T19:00', '2026-09-16T19:00'] })
    expect(z.prochaineAction).toBe('Rappeler lundi.')
    expect(z.contenu).toContain('ANTÉCÉDENT')
    expect(z.contenu).toContain('Genou fragile.')
    expect(z.contenu).not.toContain('**')
    expect(n.clients[1].lieuDefaut).toBe('domicile')
    expect(n.clients[5].contact).toEqual({ email: 'leon@exemple.test' })
  })
  it('noms d\'une fiche', () => {
    expect(nomsDe('Christine (Tabourin) & Didier (domicile)')).toEqual(['Christine Tabourin', 'Didier'])
    expect(nomsDe('Gina (Dulac) — duo avec Xavier')).toEqual(['Gina Dulac'])
  })
  it('fusionnerNotes remplace l\'ancien bloc et garde le reste', () => {
    const b1 = `${MARQUEUR_DEBUT} v1 ━━\nA\n━━ fin Notion ━━`
    const n1 = fusionnerNotes('Note MyPTHub', b1)
    expect(fusionnerNotes(n1, b1.replace('A', 'B'))).toBe('Note MyPTHub\n\n' + b1.replace('A', 'B'))
  })
})

describe('importer (base temporaire)', () => {
  let dossier, db, backend
  const lire = async (id) => backend.un('profils', id)
  beforeAll(async () => {
    dossier = mkdtempSync(join(tmpdir(), 'import-notion-'))
    db = ouvrirBase(join(dossier, 'app.db'))
    backend = creerStoreSqlite(db)
    const p = (id, nom, extra = {}) => backend.ecrire('profils', { id, role: 'client', identifiant: id, nom, archive: false, creeLe: 1, lieuDefaut: 'domicile', tarif: 35, modules: { habitudes: false, photosRepas: false, calories: false }, ...extra })
    await backend.ecrire('profils', { id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Zoé Testeuse', archive: false, creeLe: 1 })
    await p('zoe', 'zoé testeuse', { fiche: { notes: 'Note MyPTHub', contact: { telephone: '07 11 11 11 11' }, source: { mypthub: { contactId: '1' } } } })
    await p('anne', 'Anne Durand')
    await p('paul', 'Paul Durand-Martin')
    await p('marc', 'Marc Petit', { archive: true })
    await p('leon', 'Léon Souale')
    await p('autre', 'Inès Autre')
  })
  afterAll(() => { db?.close(); rmSync(dossier, { recursive: true, force: true }) })

  it('--essai : compte rendu, rien d\'écrit', async () => {
    const avant = JSON.stringify(db.prepare('SELECT * FROM profiles ORDER BY id').all())
    const b = await importer({ db, backend }, normaliser(MD), { essai: true })
    expect(b.lignes.map((l) => l.app).sort()).toEqual(['Anne Durand', 'Léon Souale', 'Marc Petit', 'Paul Durand-Martin', 'zoé testeuse'])
    expect(b.nonTrouves).toEqual(expect.arrayContaining(['Inconnu Total (Prospect)', 'Marc Lebon (Actif)']))
    expect(JSON.stringify(db.prepare('SELECT * FROM profiles ORDER BY id').all())).toBe(avant)
  })

  it('import : notes gardées + bloc, contact complété sans écraser, lieu, archivage inchangé, coach ignoré, rien créé', async () => {
    const n = normaliser(MD)
    const nb = db.prepare('SELECT count(*) n FROM profiles').get().n
    await importer({ db, backend }, n)
    const zoe = await lire('zoe')
    expect(zoe.fiche.notes.startsWith('Note MyPTHub\n\n' + MARQUEUR_DEBUT)).toBe(true)
    expect(zoe.fiche.contact.telephone).toBe('07 11 11 11 11')
    expect(zoe.fiche.source.mypthub.contactId).toBe('1')
    expect(zoe.fiche.notion).toMatchObject({ statut: 'Actif', seancesAgenda: 2, derniereSeanceAgenda: '2026-09-16T19:00' })
    expect(zoe.lieuDefaut).toBe('salle')
    expect((await lire('anne')).lieuDefaut).toBe('domicile')
    expect((await lire('paul')).fiche.notion.statut).toBe('Actif')
    expect((await lire('marc')).archive).toBe(true)
    expect((await lire('leon')).fiche.contact.email).toBe('leon@exemple.test')
    expect((await lire('autre')).fiche).toBeUndefined()
    expect((await lire('pc')).fiche).toBeUndefined()
    expect(db.prepare('SELECT count(*) n FROM profiles').get().n).toBe(nb)
    // Idempotent : le bloc est remplacé, pas ajouté une 2e fois.
    const b2 = await importer({ db, backend }, n)
    expect((await lire('zoe')).fiche.notes.split(MARQUEUR_DEBUT)).toHaveLength(2)
    expect(b2.lignes.every((l) => l.action === 'déjà à jour')).toBe(true)
  })
})
