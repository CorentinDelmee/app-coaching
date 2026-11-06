// Pastilles d'initiales des clients : teinte stable par client (décorative : le nom est toujours écrit à côté).
const TEINTES = ['dos', 'jambes', 'bras', 'epaules', 'mobilite', 'pecs', 'gainage', 'cardio']

export function initiales(nom = '') {
  const mots = String(nom).trim().split(/\s+/).filter(Boolean)
  return ((mots[0]?.[0] || '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase() || '?'
}

export function teinteDe(id = '') {
  let h = 0
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TEINTES[h % TEINTES.length]
}
