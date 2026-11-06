// Écran Exercices (Studio) : logique pure, testée (tests/unit/studio-exercices.test.js).
// Forme d'un exercice : docs/CONTRAT-EXERCICES-STUDIO.md. Aucune dépendance à Vue ni au DOM.
import { idYoutube } from '../../../../domain/video.js'
import { teinteDe, statutVideo, TEINTES_STUDIO } from '../../medias.js'

export const normal = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Matériel proposé même s'il n'apparaît encore dans aucun exercice. */
export const MATERIELS_BASE = ['Poids du corps', 'Haltères', 'Kettlebell', 'Élastique', 'Barre', 'Banc', 'Machine', 'Poulie', 'TRX', 'Ballon', 'Tapis', 'Step']

/** Teintes Studio couvertes par l'exercice (principaux, secondaires, puis catégories historiques). */
export function teintesDe(e) {
  const t = new Set()
  for (const m of [...(e?.musclesPrincipaux || []), ...(e?.musclesSecondaires || []), ...(e?.categories || [])]) {
    const x = teinteDe(m)
    if (x) t.add(x)
  }
  return t
}

/**
 * Filtre en mémoire (instantané, 200+ exercices) : mêmes règles que le serveur (recherche sans accents ni casse
 * sur nom + description ; muscle dans principaux OU secondaires ; égalités sinon).
 * f = { q, muscles: [teinte], materiel, niveau, categorie, video: 'propose'|'valide'|'aucune'|'' }
 */
export function filtrer(items, f = {}) {
  const q = normal(f.q)
  const muscles = f.muscles || []
  const cat = normal(f.categorie)
  return items.filter((e) => {
    if (q && !normal(`${e.nom} ${e.description || ''}`).includes(q)) return false
    if (muscles.length) { const t = teintesDe(e); if (!muscles.some((m) => t.has(m))) return false }
    if (f.materiel && !(e.materiel || []).includes(f.materiel)) return false
    if (f.niveau && e.niveau !== f.niveau) return false
    if (cat && normal(e.categorie) !== cat && !(e.categories || []).some((c) => normal(c) === cat)) return false
    if (f.video && statutVideo(e) !== f.video) return false
    return true
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

/** Nombre d'exercices par teinte (filtres muscles). */
export function compteParTeinte(items) {
  const n = Object.fromEntries(TEINTES_STUDIO.map((t) => [t, 0]))
  for (const e of items) for (const t of teintesDe(e)) n[t]++
  return n
}

const uniques = (liste) => [...new Set(liste.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
export const materielsDe = (items) => uniques([...MATERIELS_BASE, ...items.flatMap((e) => e.materiel || [])])
export const categoriesDe = (items) => uniques(items.map((e) => e.categorie))
export const compteVideo = (items, statut) => items.filter((e) => statutVideo(e) === statut).length

/** Champs modifiables dans le panneau (contrat : tout le reste est calculé par le serveur). */
export const CHAMPS_TEXTE = ['nom', 'description', 'categorie', 'consignes', 'erreursFrequentes', 'varianteFacile', 'varianteDifficile', 'tempo', 'notesPrivees', 'lienVideo', 'niveau']
export const CHAMPS_LISTE = ['categories', 'musclesPrincipaux', 'musclesSecondaires', 'materiel']
const LIMITES = { nom: 120, description: 1000, categorie: 40, consignes: 2000, erreursFrequentes: 2000, notesPrivees: 2000, varianteFacile: 500, varianteDifficile: 500, tempo: 20, lienVideo: 300 }
const MAX_LISTE = { categories: 10, musclesPrincipaux: 6, musclesSecondaires: 10, materiel: 10 }

/** Copie de travail du panneau (chaînes partout, '' = vide ; repos en texte pour l'input). */
export function versFormulaire(e) {
  const f = {}
  for (const c of CHAMPS_TEXTE) f[c] = e?.[c] ?? ''
  for (const c of CHAMPS_LISTE) f[c] = [...(e?.[c] || [])]
  f.reposConseille = e?.reposConseille ?? ''
  f.reposConseille = f.reposConseille === '' ? '' : String(f.reposConseille)
  return f
}

/**
 * Valide le formulaire et construit le PATCH du contrat (seulement ce qui a changé par rapport à `avant`).
 * @returns {{ patch: object, erreurs: Record<string,string> }}  erreurs non vide => ne pas enregistrer
 */
export function construirePatch(avant, form) {
  const erreurs = {}
  const patch = {}
  const ref = versFormulaire(avant)
  for (const c of CHAMPS_TEXTE) {
    const v = String(form[c] ?? '').trim()
    if (LIMITES[c] && v.length > LIMITES[c]) erreurs[c] = `${LIMITES[c]} caractères au maximum`
    if (v !== String(ref[c]).trim()) patch[c] = v
  }
  if (!String(form.nom ?? '').trim()) erreurs.nom = 'Le nom est obligatoire'
  const lien = String(form.lienVideo ?? '').trim()
  if (lien && !idYoutube(lien)) erreurs.lienVideo = 'Colle un lien YouTube (youtube.com/watch?v=… ou youtu.be/…)'
  for (const c of CHAMPS_LISTE) {
    const v = form[c] || []
    if (v.length > MAX_LISTE[c]) erreurs[c] = `${MAX_LISTE[c]} au maximum`
    if (v.join('\u0000') !== ref[c].join('\u0000')) patch[c] = [...v]
  }
  const r = String(form.reposConseille ?? '').trim()
  if (r !== ref.reposConseille) {
    if (r === '') patch.reposConseille = null // null efface (le serveur refuse « » pour un nombre)
    else if (!/^\d+$/.test(r) || Number(r) > 600) erreurs.reposConseille = 'Entre 0 et 600 secondes'
    else patch.reposConseille = Number(r)
  }
  if (patch.niveau && !['debutant', 'intermediaire', 'confirme'].includes(patch.niveau)) erreurs.niveau = 'Niveau inconnu'
  return { patch, erreurs }
}

/** Ajoute / retire une valeur d'une liste (jetons). */
export const basculer = (liste, v) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])

/** Taille cible d'une photo réduite avant l'envoi (contrat : ≤ 1600 px de large, l'écran réduit). */
export function tailleReduite(largeur, hauteur, max = 1600) {
  if (!largeur || !hauteur) return { largeur: 0, hauteur: 0 }
  if (largeur <= max) return { largeur, hauteur }
  return { largeur: max, hauteur: Math.round((hauteur * max) / largeur) }
}

/** Message lisible pour une erreur du contrat ({ erreur: code } ou ErreurData). */
export function messageErreurExo(err) {
  // ErreurData : code générique (VALIDATION, EXISTE…) + message = code du serveur (« trop_gros »…)
  const M = {
    trop_gros: 'Photo trop lourde (3 Mo au maximum).',
    type_refuse: 'Format refusé : JPG, PNG ou WebP.',
    invalide: 'Valeur refusée par le serveur : vérifie le champ modifié.',
    introuvable: 'Cet exercice n\'existe plus.',
    non_connecte: 'Session expirée : reconnecte-toi.',
    interdit: 'Action réservée au coach.',
    existe_deja: 'Un exercice porte déjà cet identifiant.',
    VALIDATION: 'Valeur refusée : vérifie le champ modifié.', EXISTE: 'Un exercice porte déjà cet identifiant.',
    INTROUVABLE: 'Cet exercice n\'existe plus.', NON_CONNECTE: 'Session expirée : reconnecte-toi.', INTERDIT: 'Action réservée au coach.',
    RESEAU: 'Pas de réseau : la modification sera retentée.', STOCKAGE_PLEIN: 'Stockage du navigateur plein.'
  }
  return M[err?.message] || M[err?.erreur] || M[err?.code] || 'Enregistrement impossible. Vérifie ta connexion.'
}

/** Voisin dans la liste affichée (↑ ↓ du panneau). */
export function voisin(liste, id, d) {
  const i = liste.findIndex((e) => e.id === id)
  if (i < 0) return null
  return liste[i + d] || null
}
