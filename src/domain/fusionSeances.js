// Fusion des séances natives (créées dans l'appli) et des séances Google Agenda d'un client.
// Une séance native et une séance Google sur le même créneau (début à ±15 min) ne sont comptées qu'une fois :
// on garde la native, enrichie du lien Google (googleId).
export const TOLERANCE_MIN = 15

// Minutes depuis une origine commune (date 'AAAA-MM-JJ' + heure 'HH:MM', même fuseau des deux côtés).
const minutes = (s) => {
  const [y, m, d] = s.date.split('-').map(Number)
  const [h, mi] = s.heure.split(':').map(Number)
  return Date.UTC(y, m - 1, d, h, mi) / 60000
}

export function fusionnerSeances(natives, google) {
  const enrichies = natives.map((n) => ({ ...n }))
  const ajoutees = []
  for (const g of google) {
    const jumelle = g.journee ? null : enrichies.find((n) => n.statut !== 'annulee' && !n.googleId && n.clientId === g.clientId && n.heure && Math.abs(minutes(n) - minutes(g)) <= TOLERANCE_MIN)
    if (jumelle) jumelle.googleId = g.id
    else ajoutees.push(g)
  }
  return [...enrichies, ...ajoutees]
}
