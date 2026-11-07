// Import Notion, étape 2 (sur le serveur) : fiches normalisées -> profils clients de l'app.
// Par client trouvé : bloc « Notion » dans les notes privées (remplacé à chaque import, le reste gardé),
// fiche.notion (propriétés structurées), téléphone / e-mail seulement s'ils manquent, lieu par défaut si Notion le donne.
// Rapprochement : nom complet exact, puis prénom + nom dans le désordre, puis prénom seul s'il est unique et libre.
// Options (demande de Corentin du 2026-11-07) :
//   creer             : un client par nom Notion sans correspondance (mêmes règles que creer_client : identifiant
//                       prenom.nom unique, code de 8 caractères haché, codes rendus pour un fichier privé) ;
//   alignerArchivage  : statut Notion « Actif » -> client actif, tout autre statut -> archivé (profil ET compte,
//                       comme archiver_client / reactiver_client).
// Rien de la santé (mesures, PAR-Q) n'est touché. Idempotent. `essai` : transaction annulée à la fin.
import { randomUUID } from 'node:crypto'
import { creerApi } from '../../../src/data/commun.js'
import { identifiantUnique, genererCode } from '../../../src/domain/identifiants.js'
import { hacherCode } from '../app-http.js'
import { norm } from '../util.js'
import { blocNotes, fusionnerNotes } from './normaliser.js'

const TARIF_DEFAUT = 35
const mots = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean)
export const estActif = (statut) => norm(statut || '') === 'actif'

export async function importer({ db, backend }, normalise, { essai = false, creer = false, alignerArchivage = false, now = () => Date.now(), avantValidation = null } = {}) {
  if (normalise?.version !== 1 || normalise.source !== 'notion' || !Array.isArray(normalise.clients)) throw new Error('Fichier normalisé Notion invalide.')
  const api = creerApi(backend, { now })
  const bilan = { essai, lignes: [], nonTrouves: [], ambigus: [] }
  const codes = []
  db.exec('BEGIN IMMEDIATE')
  try {
    const clients = (await backend.tout('profils')).filter((p) => p.role === 'client')
    const pris = new Set()
    const affectations = [] // { fiche, nomNotion, profil, par }
    const restants = []
    const absents = [] // { fiche, nom }

    // Passe 1 : nom complet (exact, puis mêmes mots dans le désordre).
    for (const f of normalise.clients) {
      for (const nom of f.noms) {
        const m = mots(nom)
        let trouves = m.length > 1 ? clients.filter((p) => norm(p.nom) === norm(nom)) : []
        if (m.length > 1 && !trouves.length) trouves = clients.filter((p) => { const mp = mots(p.nom); return m.every((x) => mp.includes(x)) })
        if (trouves.length === 1) { affectations.push({ fiche: f, nomNotion: nom, profil: trouves[0], par: 'nom complet' }); pris.add(trouves[0].id) }
        else if (trouves.length > 1) bilan.ambigus.push(`${nom} (${f.titre}) : ${trouves.map((p) => p.nom).join(', ')}`)
        else restants.push({ fiche: f, nom })
      }
    }
    // Passe 2 : prénom seul, unique parmi les clients pas encore pris, et demandé par une seule fiche Notion.
    // Nom Notion avec nom de famille : le client de l'app doit n'avoir qu'un prénom, ou un nom qui commence pareil
    // (Souale / Soualle) ; sinon deux personnes différentes du même prénom seraient fusionnées.
    const compatible = (nomNotion, p) => {
      const [, ...famille] = mots(nomNotion)
      const [, ...autres] = mots(p.nom)
      return !famille.length || !autres.length || famille.some((f) => autres.some((a) => a.slice(0, 3) === f.slice(0, 3)))
    }
    const parPrenom = new Map()
    for (const r of restants) {
      const prenom = mots(r.nom)[0]
      const trouves = clients.filter((p) => !pris.has(p.id) && mots(p.nom)[0] === prenom && compatible(r.nom, p))
      if (trouves.length === 1) (parPrenom.get(trouves[0].id) || parPrenom.set(trouves[0].id, []).get(trouves[0].id)).push({ ...r, profil: trouves[0] })
      else if (trouves.length > 1) bilan.ambigus.push(`${r.nom} (${r.fiche.titre}) : ${trouves.map((p) => p.nom).join(', ')}`)
      else absents.push(r)
    }
    for (const liste of parPrenom.values()) {
      // Deux fiches visent le même client : la fiche au prénom seul l'emporte si elle est la seule (« Xavier » vs « Xavier Dulac »).
      const seuls = liste.filter((r) => mots(r.nom).length === 1)
      if (liste.length > 1 && seuls.length === 1) {
        for (const r of liste) if (r !== seuls[0]) absents.push(r)
        liste.splice(0, liste.length, seuls[0])
      }
      if (liste.length > 1) { bilan.ambigus.push(`${liste[0].profil.nom} : visé par ${liste.map((r) => r.fiche.titre).join(' et ')}`); continue }
      affectations.push({ fiche: liste[0].fiche, nomNotion: liste[0].nom, profil: liste[0].profil, par: 'prénom seul — à vérifier' })
    }
    // Un même profil visé par deux fiches (nom complet) : on n'en applique aucune.
    const compte = new Map()
    for (const a of affectations) compte.set(a.profil.id, (compte.get(a.profil.id) || 0) + 1)

    for (const a of affectations) {
      if (compte.get(a.profil.id) > 1) { bilan.ambigus.push(`${a.profil.nom} : visé par plusieurs fiches Notion`); continue }
      bilan.lignes.push(await appliquer(a.profil.id, a.fiche, { app: a.profil.nom, notion: a.nomNotion, par: a.par }))
    }

    for (const r of absents) {
      const statut = r.fiche.proprietes.statut || 'sans statut'
      if (!creer) { bilan.nonTrouves.push(`${r.nom} (${statut})`); continue }
      const archive = !estActif(r.fiche.proprietes.statut)
      const tous = (await backend.tout('profils')).map((x) => x.identifiant).concat(db.prepare('SELECT identifiant FROM comptes').all().map((x) => x.identifiant))
      const identifiant = identifiantUnique(r.nom, tous)
      if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(identifiant)) { bilan.ambigus.push(`${r.nom} : identifiant impossible à fabriquer, non créé`); continue }
      const profil = await api.profils.creer({
        id: randomUUID(), role: 'client', identifiant, nom: r.nom, tarif: TARIF_DEFAUT, lieuDefaut: r.fiche.lieuDefaut || 'salle',
        modules: { habitudes: false, photosRepas: false, calories: false },
        preferences: { son: true, vibration: true, unite: 'kg' }, consentementLe: null, archive, creeLe: now(), fiche: {}
      })
      const code = genererCode()
      db.prepare("INSERT INTO comptes (identifiant, hash, role, profil_id, archive) VALUES (?, ?, 'client', ?, ?)").run(identifiant, await hacherCode(code), profil.id, archive ? 1 : 0)
      codes.push({ nom: r.nom, identifiant, code, archive })
      const ligne = await appliquer(profil.id, r.fiche, { app: r.nom, notion: r.nom, par: 'créé' })
      bilan.lignes.push({ ...ligne, action: `créé (${identifiant})${archive ? ' archivé' : ' actif'}` })
    }

    if (essai) db.exec('ROLLBACK')
    else { if (avantValidation) avantValidation(codes); db.exec('COMMIT') } // codes écrits AVANT de valider : jamais de compte sans code connu
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { ...bilan, codes: essai ? [] : codes, nouveauxComptes: codes.length }

  async function appliquer(id, f, ligne) {
    const p = await backend.un('profils', id)
    const actuelle = p.fiche || {}
    const contact = { ...f.contact, ...Object.fromEntries(Object.entries(actuelle.contact || {}).filter(([, v]) => v)) }
    const fiche = {
      ...actuelle,
      contact,
      notes: fusionnerNotes(actuelle.notes, blocNotes(f, normalise.exporteLe)),
      notion: { ...f.proprietes, prochaineAction: f.prochaineAction, seancesAgenda: f.seances.total, derniereSeanceAgenda: f.seances.dates.at(-1) || null },
      source: { ...actuelle.source, notion: { url: f.url, titre: f.titre, importeLe: normalise.exporteLe } }
    }
    const patch = {}
    if (JSON.stringify(fiche) !== JSON.stringify(actuelle)) patch.fiche = fiche
    if (f.lieuDefaut && f.lieuDefaut !== p.lieuDefaut) patch.lieuDefaut = f.lieuDefaut
    let archivage = ''
    if (alignerArchivage) {
      const voulu = !estActif(f.proprietes.statut)
      if (voulu !== !!p.archive) {
        patch.archive = voulu
        // Comme archiver_client / reactiver_client : archivé = connexion impossible, sessions coupées.
        if (voulu) db.prepare('UPDATE comptes SET archive = 1, sv = sv + 1 WHERE profil_id = ?').run(id)
        else db.prepare('UPDATE comptes SET archive = 0 WHERE profil_id = ?').run(id)
        archivage = voulu ? 'ARCHIVÉ' : 'RÉACTIVÉ'
      }
    }
    if (Object.keys(patch).length) await api.profils.modifier(id, patch)
    return {
      ...ligne, archive: patch.archive ?? !!p.archive, statut: f.proprietes.statut, archivage,
      action: Object.keys(patch).length ? `mis à jour (${Object.keys(patch).join(', ')})` : 'déjà à jour',
      contactAjoute: Object.keys(f.contact).filter((k) => !actuelle.contact?.[k])
    }
  }
}
