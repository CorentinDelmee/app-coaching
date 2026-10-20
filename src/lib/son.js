// Sons (Web Audio) et vibrations. Le contexte audio ne démarre qu'au premier toucher (règle des navigateurs) :
// `deverrouiller()` est appelé à chaque interaction. Préférences du profil : son / vibration (activés par défaut).
let ctx = null
const prefs = { son: true, vibration: true }

export function regler(preferences = {}) {
  prefs.son = preferences.son !== false
  prefs.vibration = preferences.vibration !== false
}

export function deverrouiller() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* pas de son : tant pis */ }
}

export function bip(freq = 880, duree = 0.18, vol = 0.25) {
  if (!ctx || !prefs.son) return
  try {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    const t = ctx.currentTime
    o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree)
    o.connect(g).connect(ctx.destination)
    o.start(t); o.stop(t + duree + 0.05)
  } catch { /* ignore */ }
}

export function vibre(motif) {
  if (!prefs.vibration) return
  try { if (navigator.vibrate) navigator.vibrate(motif) } catch { /* iOS ne vibre pas */ }
}

/** Les trois sons de la maison : tic (3 dernières secondes), go (départ), fin (fin de série / repos / chrono). */
export const SONS = {
  tic: () => { bip(740, 0.09, 0.22); vibre(12) },
  go: () => { bip(1180, 0.22, 0.28); vibre(60) },
  fin: () => { bip(880, 0.5, 0.3); setTimeout(() => bip(880, 0.5, 0.3), 220); vibre([180, 80, 180]) },
  plus: () => bip(1000, 0.06, 0.2),
  tour: () => { bip(1320, 0.07, 0.2); vibre(30) },
  valide: () => vibre(25),
  cran: () => vibre(6)
}
