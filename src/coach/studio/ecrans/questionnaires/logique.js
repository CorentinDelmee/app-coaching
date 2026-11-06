// Logique pure de l'écran Questionnaires (Studio) : sans Vue, testée par Vitest.
export const LIBELLE_FREQ = { quotidien: 'Quotidien', hebdo: 'Hebdomadaire', ponctuel: 'Ponctuel' }
// Teinte pastel (data-m du Studio) : une par fréquence dans la liste, une par type dans l'éditeur. Le nom est toujours écrit à côté.
export const TEINTE_FREQ = { quotidien: 'mobilite', hebdo: 'dos', ponctuel: 'gainage' }
export const TEINTE_TYPE = { curseur: 'dos', choixUnique: 'bras', choixMultiple: 'mobilite', emojis: 'gainage', nombre: 'jambes', texte: 'epaules', photo: 'pecs' }

export const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Lignes de texte -> liste de choix (une par ligne, vides retirées). */
export const choixDepuisTexte = (texte) => texte.split('\n').map((s) => s.trim()).filter(Boolean)
/** Texte libre -> émojis (espaces ignorés, un caractère graphique par choix). */
export const emojisDepuisTexte = (texte) => {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(texte.replace(/\s+/g, ''))].map((s) => s.segment) : [...texte.replace(/\s+/g, '')]
  return seg.filter(Boolean)
}

/** Message d'incomplétude (null = enregistrable). Mêmes règles que l'ancien éditeur + nom obligatoire. */
export function probleme(q) {
  if (!q.nom.trim()) return 'Donne un nom au questionnaire pour l’enregistrer.'
  if (!q.questions.length) return 'Ajoute au moins une question pour l’enregistrer.'
  const i = q.questions.findIndex((x) => !x.libelle.trim())
  if (i >= 0) return `La question ${i + 1} n’a pas encore de texte.`
  for (const [k, x] of q.questions.entries()) {
    if (x.type === 'choixUnique' || x.type === 'choixMultiple') {
      const c = (x.choix || []).map((v) => String(v).trim().toLowerCase())
      if (c.length < 2) return `La question ${k + 1} a besoin d’au moins deux choix.`
      if (new Set(c).size < c.length) return `La question ${k + 1} a deux choix identiques.`
    }
    if (x.type === 'nombre' && Number.isFinite(x.min) && Number.isFinite(x.max) && !(x.min < x.max)) return `La question ${k + 1} : le minimum doit être inférieur au maximum.`
  }
  return null
}

/** Copie prête à écrire : sans champs d'interface (_u, cleFigee), nom nettoyé, clientId absent si « tous ». */
export function documentPropre(q, { creation = false } = {}) {
  const doc = JSON.parse(JSON.stringify(q))
  doc.nom = doc.nom.trim()
  doc.clientId = doc.clientId || null
  if (creation && !doc.clientId) delete doc.clientId
  doc.questions.forEach((x) => { delete x.cleFigee; delete x._u })
  return doc
}
