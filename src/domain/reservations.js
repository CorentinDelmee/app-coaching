// Réservations du site vitrine : logique pure de l'écran coach (regroupement, libellés, validation des règles).
// Aucun accès réseau ni Date.now() : `now` est passé en paramètre.

export const JOURS_SEMAINE = [
  ['lun', 'Lundi'], ['mar', 'Mardi'], ['mer', 'Mercredi'], ['jeu', 'Jeudi'], ['ven', 'Vendredi'], ['sam', 'Samedi'], ['dim', 'Dimanche']
]
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Parties locales (Europe/Paris) d'un ISO avec décalage ou d'un « AAAA-MM-JJTHH:MM » nu. */
export function partiesParis(iso) {
  if (typeof iso !== 'string') return null
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) && !/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
    return { date: iso.slice(0, 10), heure: iso.slice(11, 16) }
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value])
  )
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` }
}

/** « mardi 10 novembre » */
export function libelleJourLong(date) {
  const [a, m, j] = date.split('-').map(Number)
  return `${JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]} ${j === 1 ? '1er' : j} ${MOIS[m - 1]}`
}
/** « 09:00 » → « 9 h », « 14:30 » → « 14 h 30 » */
export const libelleHeure = (hhmm) => {
  const [h, mi] = hhmm.split(':').map(Number)
  return mi ? `${h} h ${String(mi).padStart(2, '0')}` : `${h} h`
}

/** Décalage Europe/Paris (« +01:00 » / « +02:00 ») pour une date + heure locales. */
export function decalageParis(date, heure) {
  const [a, m, j] = date.split('-').map(Number)
  const [h, mi] = heure.split(':').map(Number)
  const utc = Date.UTC(a, m - 1, j, h, mi)
  // Deux essais : on cherche le décalage dont l'heure Paris redonne l'heure demandée.
  for (const dec of [1, 2]) {
    const t = new Date(utc - dec * 3600000)
    const p = partiesParis(t.toISOString())
    if (p.date === date && p.heure === heure) return `+0${dec}:00`
  }
  return '+01:00'
}
export const versIso = (date, heure) => `${date}T${heure}:00${decalageParis(date, heure)}`

/** Normalise une réservation reçue (formes du contrat : debut, fin, synchro_etat…). */
export function normaliserReservation(r) {
  const p = partiesParis(r.debut) || { date: '', heure: '' }
  const f = r.fin ? partiesParis(r.fin) : null
  const synchro = r.synchro_etat || 'cree'
  return {
    id: r.id, date: p.date, heure: p.heure, heureFin: f?.heure || '',
    prenom: r.prenom || '', nom: r.nom || '', commune: r.commune || '', adresse: r.adresse || '',
    telephone: r.telephone || '', email: r.email || '', synchro, statut: r.statut || ''
  }
}

export const LIB_SYNCHRO = {
  a_creer: 'Sera ajouté ce soir à 20 h',
  cree: 'Dans l’agenda',
  a_supprimer: 'Sera retiré ce soir',
  supprime: ''
}

/** Groupe par jour. `ordre` = 'asc' (à venir) ou 'desc' (passées, annulées). */
export function grouperParJour(liste, ordre = 'asc') {
  const sens = ordre === 'desc' ? -1 : 1
  const items = liste.map(normaliserReservation).sort((a, b) => sens * (`${a.date} ${a.heure}`).localeCompare(`${b.date} ${b.heure}`))
  const groupes = []
  for (const it of items) {
    let g = groupes[groupes.length - 1]
    if (!g || g.date !== it.date) { g = { date: it.date, libelle: libelleJourLong(it.date), items: [] }; groupes.push(g) }
    g.items.push(it)
  }
  return groupes
}

export const lienCarte = (adresse, commune) => `https://www.openstreetmap.org/search?query=${encodeURIComponent([adresse, commune].filter(Boolean).join(', '))}`
export const lienTel = (t) => `tel:${String(t).replace(/[^\d+]/g, '')}`

/** Libellé d'un blocage : « mardi 10 novembre, 9 h – 12 h » ou « mardi 10 novembre, toute la journée ». */
export function libelleBlocage(b) {
  const d = partiesParis(b.debut), f = partiesParis(b.fin)
  if (!d || !f) return ''
  const jour = (x) => libelleJourLong(x.date)
  if (d.heure === '00:00' && (f.heure === '23:59' || f.heure === '00:00') ) {
    return d.date === f.date || f.heure === '00:00' ? `${jour(d)}, toute la journée` : `${jour(d)} → ${jour(f)}`
  }
  if (d.date === f.date) return `${jour(d)}, ${libelleHeure(d.heure)} – ${libelleHeure(f.heure)}`
  return `${jour(d)} ${libelleHeure(d.heure)} → ${jour(f)} ${libelleHeure(f.heure)}`
}

/** Valide le formulaire de blocage ; renvoie { erreur } ou { debut, fin } (ISO Paris). */
export function validerBlocage({ date, debut, fin, journee }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { erreur: 'Choisissez une date.' }
  if (journee) return { debut: versIso(date, '00:00'), fin: versIso(date, '23:59') }
  if (!/^\d{2}:\d{2}$/.test(debut || '') || !/^\d{2}:\d{2}$/.test(fin || '')) return { erreur: 'Indiquez l’heure de début et de fin.' }
  if (fin <= debut) return { erreur: 'L’heure de fin doit être après l’heure de début.' }
  return { debut: versIso(date, debut), fin: versIso(date, fin) }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const entier = (v) => (typeof v === 'number' ? v : Number(String(v).trim()))

/** Règles vides par défaut (formulaire) à partir de ce que renvoie l'API. */
export function formulaireRegles(r = {}) {
  const plages = {}
  for (const [k] of JOURS_SEMAINE) plages[k] = (r.plages?.[k] || []).map(([a, b]) => ({ debut: a, fin: b }))
  return {
    plages, dureeMin: r.dureeMin ?? 60, tamponMin: r.tamponMin ?? 30, delaiMinHeures: r.delaiMinHeures ?? 24,
    horizonJours: r.horizonJours ?? 21, maxParJour: r.maxParJour ?? 3, conservationMois: r.conservationMois ?? 12,
    fermetures: [...(r.fermetures || [])]
  }
}

/** Valide le formulaire ; renvoie { erreurs: [..] } ou { regles } à envoyer (on garde les champs inconnus de `base`). */
export function validerRegles(f, base = {}) {
  const erreurs = []
  const plages = {}
  for (const [k, nom] of JOURS_SEMAINE) {
    const l = (f.plages[k] || []).map((p) => [p.debut, p.fin])
    for (const [a, b] of l) {
      if (!HHMM.test(a || '') || !HHMM.test(b || '')) { erreurs.push(`${nom} : indiquez une heure de début et de fin.`); break }
      if (b <= a) { erreurs.push(`${nom} : la fin doit être après le début (${a} – ${b}).`); break }
    }
    const tri = [...l].sort((x, y) => x[0].localeCompare(y[0]))
    for (let i = 1; i < tri.length; i++) if (tri[i][0] < tri[i - 1][1]) { erreurs.push(`${nom} : deux plages se chevauchent.`); break }
    plages[k] = tri
  }
  const num = (cle, libelle, min, max) => {
    const n = entier(f[cle])
    if (!Number.isInteger(n) || n < min || n > max) { erreurs.push(`${libelle} : un nombre entier entre ${min} et ${max}.`); return null }
    return n
  }
  const dureeMin = num('dureeMin', 'Durée', 15, 480)
  const tamponMin = num('tamponMin', 'Tampon', 0, 240)
  const delaiMinHeures = num('delaiMinHeures', 'Délai minimal', 0, 720)
  const horizonJours = num('horizonJours', 'Horizon', 1, 365)
  const maxParJour = num('maxParJour', 'Maximum par jour', 1, 20)
  const conservationMois = num('conservationMois', 'Conservation', 1, 120)
  const fermetures = [...new Set(f.fermetures)].sort()
  if (fermetures.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) erreurs.push('Fermetures : une date est invalide.')
  if (!JOURS_SEMAINE.some(([k]) => plages[k].length)) erreurs.push('Ajoutez au moins une plage horaire sur la semaine.')
  if (erreurs.length) return { erreurs }
  return { regles: { ...base, plages, dureeMin, tamponMin, delaiMinHeures, horizonJours, maxParJour, conservationMois, fermetures } }
}
