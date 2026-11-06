// Navigation du Studio coach : une seule liste, lue par la barre latérale, la barre du bas et la feuille « Plus ».
// compteur : clé lue dans store.etat (nombre affiché en pastille). bas : présent dans la barre du bas (téléphone).

export const NAV_PRINCIPALE = [
  { to: '/coach/aujourdhui', texte: "Aujourd'hui", court: "Aujourd'hui", icone: 'maison', bas: true },
  { to: '/coach/exercices', texte: 'Exercices', court: 'Exercices', icone: 'ex', bas: true, aussi: ['/coach/bibliotheque'] },
  { to: '/coach/clients', texte: 'Clients', court: 'Clients', icone: 'clients', bas: true },
  { to: '/coach/programmes', texte: 'Programmes', court: 'Programmes', icone: 'prog', bas: true, aussi: ['/coach/seances'] },
  { to: '/coach/agenda', texte: 'Agenda', court: 'Agenda', icone: 'cal', compteur: 'alertesAgenda', aussi: ['/coach/reservations'] },
  { to: '/coach/questionnaires', texte: 'Questionnaires', court: 'Questionnaires', icone: 'msg' },
  { to: '/coach/alertes', texte: 'Alertes', court: 'Alertes', icone: 'cloche', compteur: 'alertes' }
]

/** Pages secondaires (toujours accessibles : barre latérale en bas de liste, feuille « Plus » sur téléphone). */
export const NAV_SECONDAIRE = [
  { to: '/coach/reservations', texte: 'Réservations', icone: 'cal' },
  { to: '/coach/seances', texte: 'Séances', icone: 'seance' },
  { to: '/coach/bibliotheque', texte: 'Vidéos à valider', icone: 'video' },
  { to: '/coach/donnees', texte: 'Import / export', icone: 'donnees' }
]

/** Vrai si le chemin courant appartient à l'entrée (elle-même, ses sous-pages, ses pages « aussi »). */
export function estActif(entree, chemin) {
  const dans = (base) => chemin === base || chemin.startsWith(base + '/')
  return dans(entree.to) || (entree.aussi || []).some(dans)
}

/** Nombre affiché en pastille (0 = pas de pastille). */
export function compte(entree, etat) {
  if (!entree.compteur) return 0
  const v = etat?.[entree.compteur]
  return Array.isArray(v) ? v.length : Number(v) || 0
}
