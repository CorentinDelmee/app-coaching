// Mini convertisseur Markdown -> HTML, juste ce qu'il faut pour docs/page-confidentialite.md (titres, paragraphes, listes,
// tableaux, gras, liens, citations). Tout le texte est échappé avant la mise en forme : pas d'HTML injectable.
const echapper = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function enLigne(t) {
  return echapper(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[À COMPLÉTER[^\]]*\]/g, (m) => `<mark>${m}</mark>`)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
}

export function markdownVersHtml(source) {
  const lignes = source.replace(/\r/g, '').split('\n')
  const html = []
  let liste = false
  let tableau = null
  const fermer = () => {
    if (liste) { html.push('</ul>'); liste = false }
    if (tableau) { html.push(`<div class="md-tableau"><table><thead><tr>${tableau.entete}</tr></thead><tbody>${tableau.corps.join('')}</tbody></table></div>`); tableau = null }
  }
  for (const l of lignes) {
    const t = l.trim()
    if (/^\|.*\|$/.test(t)) {
      const cellules = t.slice(1, -1).split('|').map((c) => c.trim())
      if (cellules.every((c) => /^-+$/.test(c))) continue
      if (!tableau) { if (liste) fermer(); tableau = { entete: cellules.map((c) => `<th>${enLigne(c)}</th>`).join(''), corps: [] } } else tableau.corps.push(`<tr>${cellules.map((c) => `<td>${enLigne(c)}</td>`).join('')}</tr>`)
      continue
    }
    fermer()
    if (!t || t === '---') continue
    const h = t.match(/^(#{1,3})\s+(.*)$/)
    if (h) { const n = h[1].length; html.push(`<h${n}>${enLigne(h[2])}</h${n}>`); continue }
    if (t.startsWith('>')) { html.push(`<blockquote>${enLigne(t.replace(/^>\s?/, ''))}</blockquote>`); continue }
    if (/^[-*]\s+/.test(t)) { if (!liste) { html.push('<ul>'); liste = true } html.push(`<li>${enLigne(t.replace(/^[-*]\s+/, ''))}</li>`); continue }
    html.push(`<p>${enLigne(t)}</p>`)
  }
  fermer()
  return html.join('\n')
}
