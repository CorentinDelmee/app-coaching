// Horloge de l'app (ms). Égale à Date.now() sauf en développement : ?vitesse=10 dans l'URL l'accélère
// (pour vérifier un AMRAP de 12 min en 72 s). Les moteurs reçoivent toujours `horloge.now()`, jamais Date.now().
const depart = Date.now()
let vitesse = 1
let ref = depart
let base = depart

export const horloge = {
  now: () => base + (Date.now() - ref) * vitesse,
  regler(v) { base = this.now(); ref = Date.now(); vitesse = v }
}

if (import.meta.env?.DEV && typeof location !== 'undefined') {
  const v = Number(new URLSearchParams(location.search).get('vitesse'))
  if (v > 0 && v <= 100) horloge.regler(v)
}

// Pour les tests navigateur  : window.__horloge.regler(30) accélère le temps en cours de route.
if (import.meta.env?.DEV && typeof window !== 'undefined') window.__horloge = horloge
