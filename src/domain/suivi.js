// Suivi du client (lot 8) : séries de mesures, périodes, résumé, nutrition. Pur : `aujourdhui` toujours en paramètre.
import { ajouterJours, diffJours } from './dates.js'
import { libelleCourt } from './questionnaireUi.js'

// --- Mesures ------------------------------------------------------------------------------------------------------
export const PERIODES = [
  { id: '4s', libelle: '4 sem.', jours: 28 },
  { id: '3m', libelle: '3 mois', jours: 91 },
  { id: '1a', libelle: '1 an', jours: 365 },
  { id: 'tout', libelle: 'Tout', jours: null }
]
const LIBELLES_SERIES = { poids: 'Poids', tourDeTaille: 'Taille', tourDeHanches: 'Hanches', tourDeBras: 'Bras', tourDeCuisse: 'Cuisse', tourDePoitrine: 'Poitrine' }

export const libelleSerie = (id) => LIBELLES_SERIES[id] || libelleCourt(id).replace(/^Tour de /, '').replace(/^./, (c) => c.toUpperCase())
export const uniteSerie = (id) => (id === 'poids' ? 'kg' : 'cm')

/** Séries affichables : le poids toujours, puis chaque mensuration qui a au moins une valeur. */
export function seriesDisponibles(mesures) {
  const cles = new Set()
  for (const m of mesures) for (const [k, v] of Object.entries(m.mensurations || {})) if (typeof v === 'number') cles.add(k)
  const ordre = ['tourDeTaille', 'tourDeHanches']
  const autres = [...cles].filter((k) => !ordre.includes(k)).sort()
  return ['poids', ...ordre.filter((k) => cles.has(k)), ...autres].map((id) => ({ id, libelle: libelleSerie(id), unite: uniteSerie(id) }))
}

/** Points [{ date, valeur }] d'une série, triés par date. */
export function pointsSerie(mesures, serieId) {
  return mesures
    .map((m) => ({ date: m.date, valeur: serieId === 'poids' ? m.poids : m.mensurations?.[serieId] }))
    .filter((p) => typeof p.valeur === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function filtrerPeriode(points, periodeId, aujourdhui) {
  const p = PERIODES.find((x) => x.id === periodeId)
  if (!p || p.jours === null) return points
  const debut = ajouterJours(aujourdhui, -p.jours)
  return points.filter((pt) => pt.date >= debut)
}

/** Dernière valeur et variation depuis la première valeur de la période (arrondie au dixième). */
export function resumeSerie(points) {
  if (!points.length) return null
  const derniere = points[points.length - 1]
  if (points.length === 1) return { derniere: derniere.valeur, date: derniere.date, variation: null }
  return { derniere: derniere.valeur, date: derniere.date, variation: Math.round((derniere.valeur - points[0].valeur) * 10) / 10 }
}

// --- Nutrition ----------------------------------------------------------------------------------------------------
// Habitudes proposées tant que le coach ne les personnalise pas (voir DECISIONS.md) ; les habitudes déjà cochées s'y ajoutent.
export const HABITUDES_DEFAUT = ["Boire 2 L d'eau", '5 fruits et légumes', 'Protéines à chaque repas', 'Dormir 7 h']
export const REPAS = ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']

const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const idHabitude = (clientId, jour, nom) => `nut-${clientId}-${jour}-h-${slug(nom)}`
export const idRepas = (clientId, jour, repas) => `nut-${clientId}-${jour}-r-${slug(repas)}`
export const idCalories = (clientId, jour) => `nut-${clientId}-${jour}-kcal`

export function nomsHabitudes(entrees) {
  const noms = [...HABITUDES_DEFAUT]
  for (const e of entrees) if (e.type === 'habitude' && e.valeur?.nom && !noms.includes(e.valeur.nom)) noms.push(e.valeur.nom)
  return noms
}

export const habitudeFaite = (entrees, nom, jour) => entrees.some((e) => e.type === 'habitude' && e.date === jour && e.valeur?.nom === nom && e.valeur.fait)

/** Les 7 derniers jours (du plus ancien à aujourd'hui) : [{ jour, fait }]. */
export function semaineHabitude(entrees, nom, aujourdhui) {
  return Array.from({ length: 7 }, (_, i) => {
    const jour = ajouterJours(aujourdhui, i - 6)
    return { jour, fait: habitudeFaite(entrees, nom, jour) }
  })
}

/** Jours d'affilée jusqu'à aujourd'hui (si aujourd'hui n'est pas encore coché, on compte à partir d'hier). */
export function serieHabitude(entrees, nom, aujourdhui) {
  let jour = habitudeFaite(entrees, nom, aujourdhui) ? aujourdhui : ajouterJours(aujourdhui, -1)
  let n = 0
  while (habitudeFaite(entrees, nom, jour) && n < 400) { n++; jour = ajouterJours(jour, -1) }
  return n
}

/** Points [{ date, valeur }] des calories sur les `nbJours` derniers jours. */
export function pointsCalories(entrees, aujourdhui, nbJours = 14) {
  const debut = ajouterJours(aujourdhui, -(nbJours - 1))
  return entrees
    .filter((e) => e.type === 'calories' && typeof e.valeur?.kcal === 'number' && e.date >= debut && e.date <= aujourdhui)
    .map((e) => ({ date: e.date, valeur: e.valeur.kcal }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const caloriesDuJour = (entrees, aujourdhui) => entrees.find((e) => e.type === 'calories' && e.date === aujourdhui)?.valeur.kcal ?? null

/** Photo d'un repas à un jour donné (ou null). */
export const repasDuJour = (entrees, repas, jour) => entrees.find((e) => e.type === 'repas' && e.date === jour && e.valeur?.repas === repas && e.valeur.photo) || null

/** Photos des jours précédents (hors aujourd'hui), les plus récentes d'abord, sur `nbJours`. */
export function repasPrecedents(entrees, aujourdhui, nbJours = 7) {
  return entrees
    .filter((e) => e.type === 'repas' && e.valeur?.photo && e.date < aujourdhui && diffJours(aujourdhui, e.date) <= nbJours)
    .sort((a, b) => b.date.localeCompare(a.date) || REPAS.indexOf(a.valeur.repas) - REPAS.indexOf(b.valeur.repas))
}

/** Modules du client (absents = désactivés). */
export const modulesActifs = (profil) => ({ habitudes: !!profil?.modules?.habitudes, photosRepas: !!profil?.modules?.photosRepas, calories: !!profil?.modules?.calories })
export const aUnModule = (profil) => Object.values(modulesActifs(profil)).some(Boolean)
