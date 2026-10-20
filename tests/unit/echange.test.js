import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { exporter, exporterMesDonnees, preparerImport, FORMAT, MESSAGE_FORMAT_INCONNU } from '../../src/domain/echange.js'
import { genererDemo } from '../../src/data/demo/index.js'

const NOW = new Date(2026, 9, 20, 10, 0).getTime()
const demo = genererDemo(NOW)
const biblio = { exercices: demo.exercices, workouts: demo.workouts, programmes: demo.programmes }

describe('export / import JSON cdc-coaching/1', () => {
  it('export : format versionné et date', () => {
    const doc = exporter(biblio, NOW)
    expect(doc.format).toBe(FORMAT)
    expect(doc.exporteLe).toBe(new Date(NOW).toISOString())
    expect(doc.exercices).toHaveLength(80)
  })

  it('aller-retour : export puis import dans une base vide = données identiques', () => {
    const doc = JSON.parse(JSON.stringify(exporter(biblio, NOW)))
    const prep = preparerImport(doc, {})
    expect(prep.ok).toBe(true)
    expect(prep.aEcrire.exercices).toEqual(demo.exercices)
    expect(prep.aEcrire.workouts).toEqual(demo.workouts)
    expect(prep.aEcrire.programmes).toEqual(demo.programmes)
    expect(prep.rapport.exercices).toMatchObject({ ajoutes: 80, misAJour: 0, rejetes: [] })
  })

  it('réimporter les mêmes données : tout est inchangé, rien à écrire', () => {
    const prep = preparerImport(exporter(biblio, NOW), biblio)
    expect(prep.aEcrire).toEqual({ exercices: [], workouts: [], programmes: [] })
    expect(prep.rapport.exercices.inchanges).toBe(80)
  })

  it('format absent, inconnu ou document invalide : refus avec le message attendu', () => {
    for (const doc of [{}, { format: 'cdc-coaching/2' }, null, 'texte', { exercices: [] }]) {
      expect(preparerImport(doc, {})).toEqual({ ok: false, message: 'Format non reconnu (attendu cdc-coaching/1)' })
    }
    expect(MESSAGE_FORMAT_INCONNU).toBe('Format non reconnu (attendu cdc-coaching/1)')
  })

  it('rapport : ajoutés, mis à jour, rejetés avec la raison', () => {
    const doc = {
      format: FORMAT,
      exercices: [
        { id: 'ex-squat', nom: 'Squat', description: 'Nouvelle description', categories: ['jambes'], lienVideo: null }, // mis à jour
        { nom: 'Nouvel exercice', categories: ['cardio'] }, // ajouté (id créé)
        { id: 'ex-sans-nom', categories: [] } // rejeté
      ]
    }
    const prep = preparerImport(doc, biblio)
    expect(prep.rapport.exercices).toMatchObject({ ajoutes: 1, misAJour: 1, rejetes: [{ ref: 'ex-sans-nom', raison: 'Exercice : le champ « nom » est obligatoire' }] })
    expect(prep.message).toBe('Exercices : 1 ajouté, 1 mis à jour, 1 rejeté (ex-sans-nom : Exercice : le champ « nom » est obligatoire)')
    const ajoute = prep.aEcrire.exercices.find((e) => e.nom === 'Nouvel exercice')
    expect(ajoute.id).toBe('ex-nouvel-exercice')
    const maj = prep.aEcrire.exercices.find((e) => e.id === 'ex-squat')
    expect(maj.description).toBe('Nouvelle description')
  })

  it('exercice rapproché par nom (casse ignorée) quand l\'id manque', () => {
    const prep = preparerImport({ format: FORMAT, exercices: [{ nom: 'squat', description: 'Mise à jour', categories: ['jambes'] }] }, biblio)
    expect(prep.aEcrire.exercices).toHaveLength(1)
    expect(prep.aEcrire.exercices[0].id).toBe('ex-squat')
    expect(prep.aEcrire.exercices[0].description).toBe('Mise à jour') // le document importé fait foi
  })

  it('séance citant un exercice inconnu : rejetée, le reste est importé', () => {
    const bon = demo.workouts[0]
    const mauvais = { id: 'w-x', nom: 'Séance X', blocs: [{ type: 'exercice', id: 'b', exerciceId: 'ex-fantome', champs: [{ cle: 'reps', modifiableParClient: true }], series: [{ reps: 5 }] }] }
    const prep = preparerImport({ format: FORMAT, workouts: [mauvais, { ...bon, id: 'w-copie' }] }, biblio)
    expect(prep.rapport.workouts.rejetes).toEqual([{ ref: 'Séance X', raison: 'exercice inconnu « ex-fantome »' }])
    expect(prep.rapport.workouts.ajoutes).toBe(1)
    expect(prep.message).toContain('Séances : 1 ajouté, 1 rejeté')
  })

  it('programme citant une séance inconnue : rejeté', () => {
    const p = { id: 'p-x', clientId: 'c', nom: 'P', mode: 'repete', debut: '2026-10-05', workouts: ['w-inexistante'] }
    const prep = preparerImport({ format: FORMAT, programmes: [p] }, biblio)
    expect(prep.rapport.programmes.rejetes[0].raison).toBe('séance inconnue « w-inexistante »')
    const ok = preparerImport({ format: FORMAT, programmes: [{ ...p, workouts: ['w-fabien-1'] }] }, biblio)
    expect(ok.rapport.programmes.ajoutes).toBe(1)
  })

  it('un programme peut citer une séance importée dans le même document', () => {
    const w = { id: 'w-nouvelle', nom: 'N', blocs: [{ type: 'exercice', id: 'b', exerciceId: 'ex-squat', champs: [{ cle: 'reps', modifiableParClient: true }], series: [{ reps: 5 }] }] }
    const p = { id: 'p-n', clientId: 'c', nom: 'P', mode: 'repete', debut: '2026-10-05', workouts: ['w-nouvelle'] }
    expect(preparerImport({ format: FORMAT, workouts: [w], programmes: [p] }, biblio).rapport.programmes.ajoutes).toBe(1)
  })

  it('document vide : « Rien à importer »', () => {
    expect(preparerImport({ format: FORMAT }, {}).message).toBe('Rien à importer')
  })

  it('export « mes données » côté client', () => {
    const doc = exporterMesDonnees({ profil: demo.profils[1], template: demo.templates[0], realisations: [] }, NOW)
    expect(doc).toMatchObject({ format: FORMAT, type: 'donnees-client' })
    expect(doc.profil.identifiant).toBe('fabien.vincent')
  })
})

describe('docs/FORMAT-JSON.md', () => {
  const md = readFileSync('docs/FORMAT-JSON.md', 'utf8').replace(/\r\n/g, '\n') // insensible aux fins de ligne
  const bloc = md.match(/```json\n([\s\S]*?)```/)

  it('contient un exemple complet', () => {
    expect(bloc).not.toBeNull()
    const exemple = JSON.parse(bloc[1])
    expect(exemple.format).toBe(FORMAT)
    expect(exemple.exercices.length).toBeGreaterThan(1)
    expect(exemple.workouts[0].blocs.map((b) => b.type).sort()).toEqual(['circuit', 'exercice', 'exercice', 'superset'])
    expect(exemple.programmes).toHaveLength(1)
  })

  it('l\'exemple est importable sans aucun rejet', () => {
    const prep = preparerImport(JSON.parse(bloc[1]), {})
    expect(prep.ok).toBe(true)
    expect(prep.message).toBe('Exercices : 3 ajoutés — Séances : 1 ajouté — Programmes : 1 ajouté')
  })
})
