// Pastille d'un client : initiales + teinte, identiques sur tous les écrans (décorative : le nom est toujours écrit à côté).
// Règle : prénom + nom -> 2 lettres (première du prénom, première du dernier mot) ; un seul mot -> ses 2 premières lettres.
import { TEINTES_STUDIO } from './medias.js'

export function initiales(nom = '') {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean)
  if (!mots.length) return '?'
  if (mots.length === 1) return [...mots[0]].slice(0, 2).join('').toUpperCase()
  return ([...mots[0]][0] + [...mots[mots.length - 1]][0]).toUpperCase()
}

/** Teinte stable : calculée sur l'identifiant du client. */
export function teinteDe(id = '') {
  let h = 0
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TEINTES_STUDIO[h % TEINTES_STUDIO.length]
}

/** @returns {{initiales:string, teinte:string}} */
export function avatarClient(id, nom) {
  return { initiales: initiales(nom), teinte: teinteDe(id) }
}
