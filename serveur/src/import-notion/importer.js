// Import Notion, étape 2 (sur le serveur) : fiches normalisées -> profils clients EXISTANTS de l'app.
// Aucun client n'est créé, aucun archivage changé, rien de la santé (mesures, PAR-Q) n'est touché.
// Par client trouvé : bloc « Notion » dans les notes privées (remplacé à chaque import, le reste gardé),
// fiche.notion (propriétés structurées), téléphone / e-mail seulement s'ils manquent, lieu par défaut si Notion le donne.
// Rapprochement : nom complet exact, puis prénom + nom dans le désordre, puis prénom seul s'il est unique et libre.
// Idempotent. `essai` : transaction annulée à la fin.
import { creerApi } from '../../../src/data/commun.js'
import { norm } from '../util.js'
import { blocNotes, fusionnerNotes } from './normaliser.js'

const mots = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean)

export async function importer({ db, backend }, normalise, { essai = false, now = () => Date.now() } = {}) {
  if (normalise?.version !== 1 || normalise.source !== 'notion' || !Array.isArray(normalise.clients)) throw new Error('Fichier normalisé Notion invalide.')
  const api = creerApi(backend, { now })
  const bilan = { essai, lignes: [], nonTrouves: [], ambigus: [] }
  db.exec('BEGIN IMMEDIATE')
  try {
    const clients = (await backend.tout('profils')).filter((p) => p.role === 'client')
    const pris = new Set()
    const affectations = [] // { fiche, nomNotion, profil, par }
    const restants = []

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
    const parPrenom = new Map()
    // Nom Notion avec nom de famille : le client de l'app doit n'avoir qu'un prénom, ou un nom qui commence pareil
    // (Souale / Soualle) ; sinon deux personnes différentes du même prénom seraient fusionnées.
    const compatible = (nomNotion, p) => {
      const [, ...famille] = mots(nomNotion)
      const [, ...autres] = mots(p.nom)
      return !famille.length || !autres.length || famille.some((f) => autres.some((a) => a.slice(0, 3) === f.slice(0, 3)))
    }
    for (const r of restants) {
      const prenom = mots(r.nom)[0]
      const trouves = clients.filter((p) => !pris.has(p.id) && mots(p.nom)[0] === prenom && compatible(r.nom, p))
      if (trouves.length === 1) (parPrenom.get(trouves[0].id) || parPrenom.set(trouves[0].id, []).get(trouves[0].id)).push({ ...r, profil: trouves[0] })
      else if (trouves.length > 1) bilan.ambigus.push(`${r.nom} (${r.fiche.titre}) : ${trouves.map((p) => p.nom).join(', ')}`)
      else bilan.nonTrouves.push(`${r.nom} (${r.fiche.proprietes.statut || 'sans statut'})`)
    }
    for (const liste of parPrenom.values()) {
      // Deux fiches visent le même client : la fiche au prénom seul l'emporte si elle est la seule (« Xavier » vs « Xavier Dulac »).
      const seuls = liste.filter((r) => mots(r.nom).length === 1)
      if (liste.length > 1 && seuls.length === 1) {
        for (const r of liste) if (r !== seuls[0]) bilan.nonTrouves.push(`${r.nom} (${r.fiche.proprietes.statut || 'sans statut'})`)
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
      const p = (await backend.un('profils', a.profil.id)) || a.profil
      const f = a.fiche
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
      if (Object.keys(patch).length) await api.profils.modifier(p.id, patch)
      bilan.lignes.push({
        app: p.nom, notion: a.nomNotion, par: a.par, archive: !!p.archive, statut: f.proprietes.statut,
        action: Object.keys(patch).length ? `mis à jour (${Object.keys(patch).join(', ')})` : 'déjà à jour',
        contactAjoute: Object.keys(f.contact).filter((k) => !actuelle.contact?.[k])
      })
    }
    if (essai) db.exec('ROLLBACK')
    else db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return bilan
}
