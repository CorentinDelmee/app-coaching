// Bibliothèque d'exercices + vidéos de démonstration (fichier JSON). Une entrée = une vidéo proposée pour un exercice.
// statut : 'propose' (trouvée par Claude / import, à valider) · 'valide' (OK par le coach) · 'remplace' (écartée).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { idYoutube } from '../../src/domain/video.js'
import { norm, secondes, slug } from './util.js'

export const STATUTS = ['propose', 'valide', 'remplace']
const RANG = { valide: 0, propose: 1, remplace: 9 }

/** Démo : noms, alias et muscles, SANS lien (aucun lien inventé : les vrais viennent de l'import ou de la recherche YouTube). */
export const BIBLIOTHEQUE_DEMO = [
  { nom: 'Squat', alias: ['squat poids du corps', 'back squat'], muscles: ['quadriceps', 'fessiers'] },
  { nom: 'Développé couché', alias: ['bench press', 'developpe couche barre'], muscles: ['pectoraux', 'triceps'] },
  { nom: 'Rowing haltère un bras', alias: ['rowing unilateral', 'tirage haltere'], muscles: ['dos', 'biceps'] },
  { nom: 'Fentes arrière', alias: ['fente arriere', 'reverse lunge'], muscles: ['quadriceps', 'fessiers'] },
  { nom: 'Pompes', alias: ['push up', 'push-ups'], muscles: ['pectoraux', 'triceps', 'epaules'] },
  { nom: 'Planche', alias: ['gainage', 'plank'], muscles: ['abdominaux'] }
].map((e) => ({ id: `bib-${slug(e.nom)}`, ...e, video: null, justification: 'Exercice de démonstration (pas encore de vidéo)', score: 0, statut: 'propose' }))

/** Normalise une entrée venant d'un import, tolérante sur les noms de champs (fr/en). */
export function normaliserEntree(brut) {
  if (!brut || typeof brut !== 'object') return null
  const nom = brut.nom ?? brut.exercice ?? brut.name
  const v = typeof brut.video === 'object' && brut.video ? brut.video : {}
  const url = v.url ?? (typeof brut.video === 'string' ? brut.video : null) ?? brut.url ?? brut.lien ?? brut.lienVideo ?? null
  if (typeof nom !== 'string' || !nom.trim()) return null
  const id = url ? idYoutube(url) : null
  if (url && !id) return null // lien non YouTube : refusé
  const statut = STATUTS.includes(brut.statut) ? brut.statut : 'propose'
  const vues = v.vues ?? brut.vues
  return {
    id: brut.id || `bib-${slug(nom)}${id ? `-${id.slice(0, 4).toLowerCase()}` : ''}`,
    nom: nom.trim(),
    alias: [].concat(brut.alias ?? brut.aliases ?? []).map(String),
    muscles: [].concat(brut.muscles ?? []).map(String),
    video: id ? {
      url: `https://www.youtube.com/watch?v=${id}`, id,
      titre: v.titre ?? brut.titre ?? brut.title ?? null,
      duree: secondes(v.duree ?? v.duree_s ?? brut.duree ?? brut.dureeSec ?? brut.duree_s ?? null),
      chaine: v.chaine ?? brut.chaine ?? brut['chaîne'] ?? brut.channel ?? null,
      vues: typeof vues === 'number' ? vues : null
    } : null,
    justification: brut.justification ?? brut.raison ?? '',
    score: typeof brut.score === 'number' ? brut.score : 0,
    statut
  }
}

export function creerBibliotheque(fichier, { now = () => Date.now() } = {}) {
  mkdirSync(dirname(fichier), { recursive: true })
  const lire = () => (existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : BIBLIOTHEQUE_DEMO.map((e) => ({ ...e })))
  const ecrire = (liste) => {
    writeFileSync(`${fichier}.tmp`, JSON.stringify(liste, null, 1))
    renameSync(`${fichier}.tmp`, fichier)
  }
  const correspond = (e, nom) => {
    const n = norm(nom)
    return norm(e.nom) === n || e.alias.some((a) => norm(a) === n)
  }
  const meilleurs = (liste) => liste.sort((a, b) => RANG[a.statut] - RANG[b.statut] || b.score - a.score)

  const api = {
    lister: ({ statut } = {}) => lire().filter((e) => !statut || e.statut === statut),
    lire: (id) => lire().find((e) => e.id === id) || null,
    /** Entrées avec vidéo pour un nom d'exercice (nom exact ou alias, sinon nom contenu), meilleures d'abord. */
    chercher(nom) {
      const n = norm(nom)
      const avecVideo = lire().filter((e) => e.video && e.statut !== 'remplace')
      const exact = avecVideo.filter((e) => correspond(e, nom))
      return meilleurs(exact.length ? exact : avecVideo.filter((e) => n && (norm(e.nom).includes(n) || n.includes(norm(e.nom)))))
    },
    /** Entrée (même sans vidéo) connue pour ce nom : sert à récupérer alias et muscles. */
    connue: (nom) => lire().find((e) => correspond(e, nom)) || null,
    /** Importe des entrées (même id = mise à jour). Renvoie { ajoutees, miseAJour, rejetees }. */
    importer(brut) {
      const items = Array.isArray(brut) ? brut : brut?.exercices ?? brut?.bibliotheque ?? brut?.videos ?? []
      const liste = lire()
      const r = { ajoutees: 0, miseAJour: 0, rejetees: 0 }
      for (const b of items) {
        const e = normaliserEntree(b)
        if (!e) { r.rejetees++; continue }
        const i = liste.findIndex((x) => x.id === e.id)
        if (i >= 0) { liste[i] = { ...liste[i], ...e }; r.miseAJour++ } else { liste.push(e); r.ajoutees++ }
      }
      ecrire(liste)
      return r
    },
    /** Ajoute une proposition (une vidéo YouTube pour un exercice) ; renvoie l'entrée. */
    proposer({ nom, url, titre = null, chaine = null, duree = null, vues = null, justification = '', score = 0, statut = 'propose' }) {
      const e = normaliserEntree({ nom, url, titre, chaine, duree, vues, justification, score, statut })
      if (!e || !e.video) throw new Error('Lien vidéo YouTube invalide')
      const connue = api.connue(nom)
      if (connue) { e.alias = connue.alias; e.muscles = connue.muscles }
      const liste = lire()
      const i = liste.findIndex((x) => x.id === e.id)
      if (i >= 0) liste[i] = { ...liste[i], ...e, statut: liste[i].statut === 'valide' ? 'valide' : e.statut }
      else liste.push(e)
      ecrire(liste)
      return liste[i >= 0 ? i : liste.length - 1]
    },
    /** Le coach valide une vidéo ; les autres vidéos du même exercice passent « remplace ». */
    valider(id) {
      const liste = lire()
      const e = liste.find((x) => x.id === id)
      if (!e || !e.video) throw new Error('Entrée introuvable ou sans vidéo')
      for (const x of liste) if (x.id !== id && norm(x.nom) === norm(e.nom) && x.statut !== 'remplace') x.statut = 'remplace'
      e.statut = 'valide'
      e.majLe = now()
      ecrire(liste)
      return e
    },
    /** Le coach remplace une vidéo par un autre lien : l'ancienne passe « remplace », la nouvelle est validée. */
    remplacer(id, { url, titre = null, chaine = null }) {
      const ancienne = lire().find((x) => x.id === id)
      if (!ancienne) throw new Error('Entrée introuvable')
      const nouvelle = api.proposer({ nom: ancienne.nom, url, titre, chaine, justification: 'Choisie par le coach', score: 100 })
      return api.valider(nouvelle.id)
    }
  }
  return api
}
