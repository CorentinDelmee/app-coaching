// Dates du projet : jours en 'AAAA-MM-JJ' (heure locale), semaine du lundi au dimanche.
// `now` est toujours un horodatage en millisecondes passé en paramètre (jamais Date.now() ici).
const pad = (n) => String(n).padStart(2, '0')
const JOUR_MS = 86400000

/** Jour local d'un horodatage. */
export function jourLocal(now) {
  const d = new Date(now)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Calculs sur les jours en UTC pour éviter tout décalage dû à l'heure d'été.
function enMs(jour) {
  const [y, m, d] = jour.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function enJour(ms) {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const ajouterJours = (jour, n) => enJour(enMs(jour) + n * JOUR_MS)
/** Nombre de jours entre a et b (a - b). */
export const diffJours = (a, b) => Math.round((enMs(a) - enMs(b)) / JOUR_MS)
/** 0 = lundi … 6 = dimanche. */
export const jourSemaine = (jour) => (new Date(enMs(jour)).getUTCDay() + 6) % 7
export const lundiDe = (jour) => ajouterJours(jour, -jourSemaine(jour))
export const moisDe = (jour) => jour.slice(0, 7)

/** Horodatage local d'un jour + heure 'HH:MM'. */
export function horodatage(jour, heure = '00:00') {
  const [y, m, d] = jour.split('-').map(Number)
  const [h, mi] = heure.split(':').map(Number)
  return new Date(y, m - 1, d, h, mi).getTime()
}

export const estJour = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
