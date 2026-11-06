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

// Données dérivées d'un exercice, calculées une fois par objet (un exercice modifié est un nouvel objet) :
// filtrer 200+ exercices à chaque frappe ou après chaque sauvegarde ne refait pas les normalize() et teinteDe().
const CACHE = new WeakMap()
function derive(e) {
  let d = CACHE.get(e)
  if (!d) {
    d = {
      texte: normal(`${e.nom} ${e.description || ''}`), teintes: teintesDe(e), statut: statutVideo(e),
      materiel: new Set((e.materiel || []).map(cleMateriel)),
      cats: new Set([normal(e.categorie), ...(e.categories || []).map(normal)].filter(Boolean))
    }
    CACHE.set(e, d)
  }
  return d
}
const tri = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/** Clé d'un matériel : sans accents, casse ni pluriel simple (« Haltère » = « Haltères »). */
export const cleMateriel = (m) => normal(m).replace(/s$/, '')

/**
 * Filtre en mémoire (instantané, 200+ exercices) : mêmes règles que le serveur (recherche sans accents ni casse
 * sur nom + description ; muscle dans principaux OU secondaires ; égalités sinon).
 * f = { q, muscles: [teinte], materiel, niveau, categorie, video: 'propose'|'valide'|'aucune'|'' }
 */
export function filtrer(items, f = {}) {
  const q = normal(f.q)
  const muscles = f.muscles || []
  const cat = normal(f.categorie)
  const mat = f.materiel ? cleMateriel(f.materiel) : ''
  return items.filter((e) => {
    const d = derive(e)
    if (q && !d.texte.includes(q)) return false
    if (muscles.length && !muscles.some((m) => d.teintes.has(m))) return false
    if (mat && !d.materiel.has(mat)) return false
    if (f.niveau && e.niveau !== f.niveau) return false
    if (cat && !d.cats.has(cat)) return false
    if (f.video && d.statut !== f.video) return false
    return true
  }).sort((a, b) => tri.compare(a.nom, b.nom))
}

/** Nombre d'exercices par teinte (filtres muscles). */
export function compteParTeinte(items) {
  const n = Object.fromEntries(TEINTES_STUDIO.map((t) => [t, 0]))
  for (const e of items) for (const t of derive(e).teintes) n[t]++
  return n
}

const uniques = (liste) => [...new Set(liste.filter(Boolean))].sort(tri.compare)
/** Matériel proposé : celui des exercices d'abord (« Haltère » si c'est l'écriture utilisée), puis la liste de base, sans doublon. */
export function materielsDe(items) {
  const vus = new Map()
  for (const m of [...items.flatMap((e) => e.materiel || []), ...MATERIELS_BASE]) if (m && !vus.has(cleMateriel(m))) vus.set(cleMateriel(m), m)
  return [...vus.values()].sort(tri.compare)
}
export const categoriesDe = (items) => uniques(items.map((e) => e.categorie))
export const compteVideo = (items, statut) => items.filter((e) => derive(e).statut === statut).length

/**
 * La vidéo vient-elle vraiment de Claude ? Le contrat ne dit pas qui l'a proposée : on ne l'affirme que si la
 * bibliothèque connaît son titre ou sa chaîne (recherche faite par Claude). Un lien collé par le coach reste « à valider ».
 */
export const proposeeParClaude = (e) => derive(e).statut === 'propose' && !!(e.video?.titre || e.video?.chaine)

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

export const TOUS_CHAMPS = [...CHAMPS_TEXTE, ...CHAMPS_LISTE, 'reposConseille']

/** Lien YouTube sous la forme du contrat (https://www.youtube.com/watch?v=<id>) ; '' si vide ; tel quel si invalide. */
export function lienCanonique(lien) {
  const v = String(lien ?? '').trim()
  const id = idYoutube(v)
  return id ? `https://www.youtube.com/watch?v=${id}` : v
}

/** Valeur comparable d'un champ (texte rogné, liste jointe, repos en texte, lien canonique). */
function cle(c, v) {
  if (CHAMPS_LISTE.includes(c)) return (v || []).join('\u0000')
  if (c === 'lienVideo') return lienCanonique(v)
  return String(v ?? '').trim()
}
/** Même valeur pour ce champ ? (form ou serveur, indifféremment) */
export const memeValeur = (c, a, b) => cle(c, a) === cle(c, b)

/** Champs dont la valeur diffère entre deux copies de travail (pour savoir ce que l'utilisateur vient de toucher). */
export const champsDifferents = (a, b) => TOUS_CHAMPS.filter((c) => !memeValeur(c, a[c], b[c]))

/**
 * Construit le PATCH du contrat avec les SEULS champs touchés par l'utilisateur (`sales`) et valides.
 * Un champ non touché n'est jamais renvoyé : ce que Claude a changé entre-temps (MCP) n'est pas écrasé.
 * Les champs invalides restent hors du patch (et dans `erreurs`) : les autres s'enregistrent quand même.
 * @param {object} serveur  dernière version connue du serveur
 * @param {object} form     copie de travail (versFormulaire)
 * @param {Iterable<string>} [sales]  champs touchés (défaut : ceux qui diffèrent du serveur)
 * @returns {{ patch: object, erreurs: Record<string,string> }}
 */
export function construirePatch(serveur, form, sales) {
  const erreurs = {}
  const patch = {}
  // Champ touché et valide => envoyé, même s'il revient à l'ancienne valeur (une écriture précédente peut être en vol).
  for (const c of sales ?? champsDifferents(versFormulaire(serveur), form)) {
    const v = form[c]
    if (CHAMPS_LISTE.includes(c)) {
      if ((v || []).length > MAX_LISTE[c]) erreurs[c] = `${MAX_LISTE[c]} au maximum`
      else patch[c] = [...(v || [])]
      continue
    }
    const t = String(v ?? '').trim()
    if (c === 'reposConseille') {
      if (t !== '' && (!/^\d+$/.test(t) || Number(t) > 600)) erreurs[c] = 'Entre 0 et 600 secondes'
      else patch[c] = t === '' ? null : Number(t) // null efface (le serveur refuse « » pour un nombre)
      continue
    }
    if (c === 'nom' && !t) erreurs.nom = 'Le nom est obligatoire'
    else if (LIMITES[c] && t.length > LIMITES[c]) erreurs[c] = `${LIMITES[c]} caractères au maximum`
    else if (c === 'lienVideo' && t && !idYoutube(t)) erreurs.lienVideo = 'Colle un lien YouTube (youtube.com/watch?v=… ou youtu.be/…)'
    else if (c === 'niveau' && t && !['debutant', 'intermediaire', 'confirme'].includes(t)) erreurs.niveau = 'Niveau inconnu'
    else patch[c] = c === 'lienVideo' ? lienCanonique(t) : t
  }
  return { patch, erreurs }
}

/** Libellé d'un champ (messages « 1 champ à corriger », « Le lien n'est pas enregistré »). */
export const LIBELLES = {
  nom: 'Le nom', lienVideo: 'Le lien vidéo', reposConseille: 'Le repos', tempo: 'Le tempo', description: 'La description',
  consignes: 'Les consignes', erreursFrequentes: 'Les erreurs fréquentes', varianteFacile: 'La variante facile',
  varianteDifficile: 'La variante difficile', notesPrivees: 'Les notes privées', categorie: 'La catégorie', niveau: 'Le niveau',
  musclesPrincipaux: 'Les muscles principaux', musclesSecondaires: 'Les muscles secondaires', materiel: 'Le matériel', categories: 'Les étiquettes'
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
