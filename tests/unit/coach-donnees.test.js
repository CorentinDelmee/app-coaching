// Parcours du coach sur la couche de données locale : client créé -> connexion -> programme assigné ; alertes « vu ».
import { describe, it, expect } from 'vitest'
import { creerAdapterLocal, stockageMemoire } from '../../src/data/adapters/local.js'
import { toutesLesAlertes } from '../../src/domain/alertes.js'
import { dupliquerProgramme, nouveauBloc } from '../../src/coach/logique.js'

const NOW = new Date(2026, 9, 20, 10, 0).getTime()
let n = 0
const uuid = () => `t-${++n}`
const neuf = () => creerAdapterLocal({ storage: stockageMemoire(), now: () => NOW })

async function coach(data) {
  await data.connecter('corentin', 'COACH7')
  return data
}

describe('parcours coach (adaptateur local)', () => {
  it('un client créé par le coach se connecte avec identifiant + code et voit seulement son programme', async () => {
    const data = await coach(neuf())
    const { identifiant, code, profil } = await data.creerClient({ nom: 'Camille Dupont', tarif: 40 })
    expect(identifiant).toBe('camille.dupont')

    // Le coach duplique le programme de Fabien vers Camille.
    const [fabien] = await data.profils.lister({ identifiant: 'fabien.vincent' })
    const [prog] = await data.programmes.lister({ clientId: fabien.id })
    const copie = dupliquerProgramme(prog, await data.workouts.lister(), profil.id, uuid, '2026-10-19')
    for (const w of copie.workouts) await data.workouts.creer(w)
    await data.programmes.creer(copie.programme)

    await data.deconnecter()
    const moi = await data.connecter(identifiant, code)
    expect(moi.role).toBe('client')
    const programmes = await data.programmes.lister()
    expect(programmes).toHaveLength(1)
    expect(programmes[0].clientId).toBe(profil.id)
    const workouts = await data.workouts.lister()
    expect(workouts.length).toBeGreaterThan(0)
    expect(workouts.every((w) => w.clientId === profil.id)).toBe(true)
  })

  it('un client archivé ne peut plus se connecter, mais ses données restent', async () => {
    const data = await coach(neuf())
    const { identifiant, code, profil } = await data.creerClient({ nom: 'Paul Durand' })
    await data.profils.archiver(profil.id)
    expect(await data.profils.lister({ identifiant })).toHaveLength(0)
    expect(await data.profils.lister({ identifiant }, { archives: true })).toHaveLength(1)
    await data.deconnecter()
    await expect(data.connecter(identifiant, code)).rejects.toThrow()
  })

  it('séance de coaching : le tarif est figé à la création', async () => {
    const data = await coach(neuf())
    const { profil } = await data.creerClient({ nom: 'Jo Test', tarif: 40 })
    await data.seancesCoaching.creer({ id: uuid(), clientId: profil.id, date: '2026-10-21', heure: '18:30', lieu: 'domicile', statut: 'prevue', tarif: 40 })
    await data.profils.modifier(profil.id, { tarif: 55 })
    const [s] = await data.seancesCoaching.lister({ clientId: profil.id })
    expect(s.tarif).toBe(40)
  })

  it('« marquer vu » retire l\'alerte et elle ne revient pas', async () => {
    const data = await coach(neuf())
    const charger = async () => {
      const clients = (await data.profils.lister()).filter((p) => p.role === 'client')
      const [reponses, douleurs, realisations, vues] = await Promise.all([data.reponses.lister(), data.douleurs.lister(), data.realisations.lister(), data.alertesVues.lister()])
      const de = (l, id) => l.filter((x) => x.clientId === id)
      return toutesLesAlertes(clients.map((profil) => ({ profil, reponses: de(reponses, profil.id), douleurs: de(douleurs, profil.id), realisations: de(realisations, profil.id) })), vues, NOW)
    }
    const avant = await charger()
    expect(avant.length).toBeGreaterThan(0)
    await data.alertesVues.creer({ id: avant[0].id, clientId: avant[0].clientId, vueLe: NOW })
    const apres = await charger()
    expect(apres).toHaveLength(avant.length - 1)
    expect(apres.some((a) => a.id === avant[0].id)).toBe(false)
  })

  it('une séance construite dans le constructeur s\'enregistre et se relit à l\'identique', async () => {
    const data = await coach(neuf())
    const [ex] = await data.exercices.lister()
    const w = { id: uuid(), nom: 'Test', clientId: null, blocs: [nouveauBloc('exercice', uuid, ex.id), nouveauBloc('superset', uuid, ex.id), nouveauBloc('circuit', uuid)] }
    await data.workouts.creer(w)
    expect(await data.workouts.lire(w.id)).toEqual(w)
  })
})
