// Import Notion (CLIENTS PRO + séances de Google Agenda), étape 1 : récap Markdown -> fiches structurées.
// Le fichier vient de l'export du 2026-11-06 (« Clients de coaching — Corentin Delmée ») ; seules les fiches de la
// section « Fiches clients » sont lues (les séances non rattachées / à arbitrer ne sont attribuées à personne).

export const MARQUEUR_DEBUT = '━━ Notion'
export const MARQUEUR_FIN = '━━ fin Notion ━━'

const LIEUX = { domicile: 'domicile', 'dance & fitness': 'salle', 'danse & fitness': 'salle' }

/** Retire le gras, l'italique HTML, les liens et l'émoji de tête : texte lisible tel quel dans « Notes privées ». */
export function texteBrut(s) {
  return String(s ?? '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .trim()
}
const sansEmoji = (s) => texteBrut(s).replace(/^[^\p{L}\p{N}~(]+/u, '').trim()
const vide = (s) => !s || s === '—' || s === '-'

/** « Christine (Tabourin) & Didier (domicile) » -> ['Christine Tabourin', 'Didier'] ; « Gina (Dulac) — duo avec Xavier » -> ['Gina Dulac']. */
export function nomsDe(titre) {
  return titre.split(/\s+—\s+/)[0].split(/\s+&\s+/).map((p) => p
    .replace(/\(\s*domicile\s*\)/i, '')
    .replace(/\(([^)]+)\)/g, ' $1')
    .replace(/\s+/g, ' ').trim()).filter(Boolean)
}

/** « 22/08/2026 11h00 » -> '2026-08-22T11:00' */
export function dateDe(s) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2})h(\d{2}))?/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}${m[4] ? `T${m[4]}:${m[5]}` : ''}` : null
}

export function normaliser(md) {
  const texte = String(md).replace(/\r\n/g, '\n')
  const exp = /\*\*Export du (\d{2}\/\d{2}\/\d{4})/.exec(texte)
  const exporteLe = exp ? dateDe(exp[1]) : null
  const debut = texte.indexOf('\n## Fiches clients')
  const fin = texte.indexOf('\n## Séances non rattachées')
  if (debut < 0 || fin < 0 || !exporteLe) throw new Error('Récap Notion non reconnu (sections « Fiches clients » / « Séances non rattachées » ou date d\'export absentes).')
  const blocs = texte.slice(debut, fin).split(/\n### /).slice(1)
  return { version: 1, source: 'notion', exporteLe, clients: blocs.map(ficheDe) }
}

function ficheDe(bloc) {
  const lignes = bloc.split('\n')
  const titre = lignes[0].trim()
  const iContenu = lignes.findIndex((l) => /^#### Contenu de la fiche/.test(l))
  const tete = iContenu < 0 ? lignes.slice(1) : lignes.slice(1, iContenu)
  const corps = iContenu < 0 ? [] : lignes.slice(iContenu + 1)

  const props = {}
  for (const l of tete) {
    const m = /^\|\s*\*\*([^*]+)\*\*\s*\|\s*(.*?)\s*\|\s*$/.exec(l)
    if (m) props[m[1].trim()] = m[2].trim()
  }
  const url = /\((https:\/\/[^)]*notion[^)]*)\)/.exec(props['Fiche Notion'] || '')?.[1] || null
  const prop = (k) => (vide(props[k]) ? null : sansEmoji(props[k]))

  const prochaine = tete.find((l) => l.startsWith('**Prochaine action.**'))
  const resumeSeances = tete.find((l) => l.startsWith('**Séances sur l\'agenda'))
  const total = Number(/Séances sur l'agenda : (\d+)/.exec(resumeSeances || '')?.[1] ?? 0)
  const dates = []
  for (const l of tete) {
    const m = /^- \*\*(\d{4})\*\* \(\d+\) : (.*)$/.exec(l)
    if (m) for (const d of m[2].split('·')) { const iso = dateDe(d); if (iso) dates.push(iso) }
  }
  const alertes = tete.filter((l) => l.startsWith('> ')).map((l) => texteBrut(l.slice(2)).replace(/\s*—\s*voir À arbitrer\.?$/, '.'))

  // Contenu rédigé : titres « ## X » -> « X », citations -> texte, gras retiré, lignes vides fusionnées.
  const contenu = corps.join('\n').replace(/\n---\s*$/, '').split('\n').map((l) => {
    if (/^#{2,4}\s+/.test(l)) return sansEmoji(l.replace(/^#{2,4}\s+/, '')).toUpperCase()
    if (/^>\s?/.test(l)) return texteBrut(l.replace(/^>\s?/, ''))
    return texteBrut(l)
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim()

  const tel = prop('Téléphone')
  const email = prop('Email')
  const lieu = prop('Lieu')
  return {
    titre,
    noms: nomsDe(titre),
    proprietes: {
      statut: prop('Statut'), priorite: prop('Priorité'), rythme: prop('Rythme'), lieu, origine: prop('Origine'), frein: prop('Frein'),
      seances2026Notion: prop('Séances 2026 (compteur Notion)'), derniereSeanceNotion: prop('Dernière séance (Notion)')
    },
    contact: { ...(tel ? { telephone: tel } : {}), ...(email ? { email: email.toLowerCase() } : {}) },
    lieuDefaut: lieu ? LIEUX[lieu.toLowerCase()] ?? null : null,
    prochaineAction: prochaine ? texteBrut(prochaine.replace('**Prochaine action.**', '')) : null,
    seances: { total, dates },
    alertes,
    contenu,
    url
  }
}

/** Bloc texte ajouté aux « Notes privées » (remplacé à chaque import, le reste des notes est gardé). */
export function blocNotes(c, exporteLe) {
  const p = c.proprietes
  const fr = (iso) => iso.slice(0, 10).split('-').reverse().join('/') + (iso.length > 10 ? ` ${iso.slice(11).replace(':', 'h')}` : '')
  const ligne = (paires) => paires.filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`).join(' · ')
  const parAn = {}
  for (const d of c.seances.dates) (parAn[d.slice(0, 4)] ||= []).push(fr(d))
  const morceaux = [
    `${MARQUEUR_DEBUT} — export du ${fr(exporteLe)} (${c.titre}) ━━`,
    ligne([['Statut', p.statut], ['Priorité', p.priorite], ['Rythme', p.rythme]]),
    ligne([['Lieu', p.lieu], ['Origine', p.origine], ['Frein', p.frein]]),
    c.prochaineAction ? `\nProchaine action : ${c.prochaineAction}` : '',
    `\nSéances sur l'agenda Google : ${c.seances.total}${p.seances2026Notion ? ` (compteur Notion 2026 : ${p.seances2026Notion})` : ''}`,
    ...Object.entries(parAn).map(([an, ds]) => `${an} (${ds.length}) : ${ds.join(' · ')}`),
    ...c.alertes.map((a) => `\n${a}`),
    c.contenu ? `\n${c.contenu}` : '',
    c.url ? `\nFiche Notion : ${c.url}` : '',
    MARQUEUR_FIN
  ]
  return morceaux.filter(Boolean).join('\n')
}

/** Remplace l'ancien bloc Notion des notes (s'il existe) par le nouveau ; les notes MyPTHub ou saisies à la main restent. */
export function fusionnerNotes(notes, bloc) {
  const n = String(notes || '')
  const i = n.indexOf(MARQUEUR_DEBUT)
  const j = n.indexOf(MARQUEUR_FIN)
  if (i >= 0 && j > i) return (n.slice(0, i) + bloc + n.slice(j + MARQUEUR_FIN.length)).trim()
  return [n.trim(), bloc].filter(Boolean).join('\n\n')
}
