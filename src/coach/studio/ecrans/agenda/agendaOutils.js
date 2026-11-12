// Logique pure de l'écran Agenda Studio (pas de Vue, pas de Date.now()).
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Parties d'une date « AAAA-MM-JJ » : { jour: 'mar.', num: '10', mois: 'nov.', court: 'mar. 10/11' }. */
export function partiesDate(date) {
  const [a, m, j] = String(date).split('-').map(Number)
  const jour = JOURS[new Date(a, m - 1, j).getDay()]
  return { jour, num: String(j), mois: MOIS[m - 1], court: `${jour} ${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}` }
}

export const heureLisible = (h) => String(h || '').replace(':', ' h ').trim()

export function libelleHeureEvt(e) {
  if (e.journee) return 'toute la journée'
  return e.finHeure ? `${heureLisible(e.heure)} – ${heureLisible(e.finHeure)}` : heureLisible(e.heure)
}

/** Regroupe des événements par jour (ordre chronologique). */
export function grouperEvenements(liste) {
  const tri = [...liste].sort((a, b) => `${a.date} ${a.heure || ''}`.localeCompare(`${b.date} ${b.heure || ''}`))
  const groupes = []
  for (const e of tri) {
    let g = groupes[groupes.length - 1]
    if (!g || g.date !== e.date) { g = { date: e.date, ...partiesDate(e.date), items: [] }; groupes.push(g) }
    g.items.push(e)
  }
  return groupes
}

export const LIB_ALERTE = { inconnu: 'Nom inconnu', ambigu: 'Nom ambigu', 'sans-nom': 'Sans nom' }
export const CONSEIL_ALERTE = {
  inconnu: 'Aucun client ne porte ce nom : corrigez le titre dans Google Agenda.',
  ambigu: 'Plusieurs clients correspondent : ajoutez un identifiant court (ex. #md2).',
  'sans-nom': 'Ajoutez le prénom et le nom du client après « Coaching ».'
}
/** Bilan d'une synchro serveur en une phrase : « Synchronisé : 12 coachings lus, 3 séances créées, 1 modifiée · 2 titres à attribuer. » */
export function libelleBilan(b) {
  if (!b) return ''
  const s = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`
  const parties = [
    b.crees && s(b.crees, 'séance créée', 'séances créées'), b.modifies && s(b.modifies, 'modifiée', 'modifiées'),
    b.supprimes && s(b.supprimes, 'supprimée', 'supprimées'), b.annules && s(b.annules, 'annulée', 'annulées')
  ].filter(Boolean)
  const lus = s(b.evenements ?? 0, 'coaching lu', 'coachings lus')
  const aAttribuer = b.aAttribuer ? ` · ${s(b.aAttribuer, 'titre', 'titres')} à attribuer` : ''
  return `Synchronisé : ${lus}, ${parties.length ? parties.join(', ') : 'rien de nouveau'}${aAttribuer}.`
}

export function libelleSynchro(t) {
  if (!t) return 'Jamais synchronisé'
  const d = new Date(t)
  return `Synchronisé le ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}
