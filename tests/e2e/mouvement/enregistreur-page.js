// Enregistreur image par image, injecté dans la page (addInitScript) par micro-sauts.mjs.
// À chaque requestAnimationFrame : position (getBoundingClientRect), opacité effective (produit des ancêtres), visibilité réelle
// (rognage par overflow / clip-path des ancêtres, page opaque posée par-dessus) et texte propre des éléments visibles
// (textes, puces, icônes, boutons, images), et position de leur « racine de page ». Lecture seule.
// window.__ms.lancer(max) : enregistre jusqu'à 1,2 s de calme (aucune page qui bouge / change) ou `max` ms.
;(() => {
  if (window.__ms) return
  const ids = new WeakMap()
  let suivant = 1
  const descs = {}
  const idDe = (el) => {
    let id = ids.get(el)
    if (!id) { id = suivant++; ids.set(el, id) }
    return id
  }
  const CLASSES = /(^|[\s_-])(chip|puce|pastille|badge|vignette|squelette|skel|st-sq|ico|icone|avatar|st-av|anneau)/i
  const TAGS = new Set(['IMG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'VIDEO', 'CANVAS', 'svg'])
  const RACINES = '.st-page, .c-pont, .st-feuille-plus, #st-calques > *'
  const texteDe = (el) => {
    let t = ''
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue
    return t.replace(/\s+/g, ' ').trim().slice(0, 60)
  }
  const cls = (el) => (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '')
  // Racine de page : la page du routeur (espace coach) ou un calque, sinon l'enfant direct de #app ou de body.
  const racineDe = (el) => {
    const p = el.closest(RACINES)
    if (p) return p
    let n = el
    while (n.parentElement && n.parentElement.id !== 'app' && n.parentElement !== document.body) n = n.parentElement
    return n
  }
  const decrire = (el, racine) => {
    const c = cls(el).trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
    const chemin = el.tagName.toLowerCase() + (c ? '.' + c : '')
    let a = el.parentElement, ctx = ''
    for (let k = 0; a && k < 4 && !ctx; k++, a = a.parentElement) { const ca = cls(a).trim().split(/\s+/)[0]; if (ca) ctx = ca }
    const rc = cls(racine).trim().split(/\s+/)[0] || racine.id || racine.tagName.toLowerCase()
    return { el: chemin, ctx, racine: rc, texte: texteDe(el) || el.getAttribute('aria-label') || '' }
  }
  const retenu = (el) => {
    if (el.tagName !== 'svg' && el.closest('svg')) return false
    if (el.tagName === 'svg' && el.parentElement?.closest('svg')) return false
    if (TAGS.has(el.tagName)) return true
    if (CLASSES.test(cls(el))) return true
    return texteDe(el).length > 0
  }
  const INF = [-1e9, -1e9, 1e9, 1e9]
  const inter = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]
  const aire = (r) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1])
  const val = (s, ref) => (s.endsWith('%') ? (parseFloat(s) / 100) * ref : parseFloat(s) || 0)
  function image(t0) {
    const vw = innerWidth, vh = innerHeight
    const styles = new Map()
    const st = (el) => { let s = styles.get(el); if (!s) { s = getComputedStyle(el); styles.set(el, s) } return s }
    const memoOp = new Map()
    const opDe = (el) => {
      if (!el || el === document.documentElement) return 1
      let o = memoOp.get(el)
      if (o !== undefined) return o
      const s = st(el)
      o = (s.visibility === 'hidden' || s.display === 'none') ? 0 : parseFloat(s.opacity) * opDe(el.parentElement)
      memoOp.set(el, o)
      return o
    }
    // zone dans laquelle les descendants de `el` sont visibles (overflow, clip-path inset, ancêtres)
    const memoB = new Map()
    const bornes = (el) => {
      if (!el || el === document.documentElement || el === document.body) return INF
      let b = memoB.get(el)
      if (b) return b
      const s = st(el)
      b = s.position === 'fixed' ? INF : bornes(el.parentElement)
      const rognage = s.overflowX !== 'visible' || s.overflowY !== 'visible'
      if (rognage || (s.clipPath && s.clipPath !== 'none')) {
        const r = el.getBoundingClientRect()
        let z = [r.left, r.top, r.right, r.bottom]
        const m = /^inset\(([^)]*?)(?:\s+round[^)]*)?\)/.exec(s.clipPath || '')
        if (m) {
          const v = m[1].trim().split(/\s+/)
          const [h, d, ba, g] = [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]]
          z = [r.left + val(g, r.width), r.top + val(h, r.height), r.right - val(d, r.width), r.bottom - val(ba, r.height)]
        }
        b = inter(b, z)
      }
      memoB.set(el, b)
      return b
    }
    const racines = new Map()
    const infoRacine = (racine) => {
      const rid = idDe(racine)
      let ri = racines.get(rid)
      if (ri) return ri
      const rr = racine.getBoundingClientRect()
      const s = st(racine)
      const fondOpaque = (e) => { if (!e) return false; const c = st(e).backgroundColor; const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return false; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length < 4 || parseFloat(p[3]) > 0.9 }
      const opaque = opDe(racine) > 0.9 && (fondOpaque(racine) || fondOpaque(racine.firstElementChild))
      const z = s.position !== 'static' && s.zIndex !== 'auto' ? parseInt(s.zIndex, 10) || 0 : 0
      const zone = inter([rr.left, rr.top, rr.right, rr.bottom], bornes(racine))
      ri = { rid, el: racine, z, opaque, zone, ligne: [rid, +rr.left.toFixed(1), +rr.top.toFixed(1), +rr.width.toFixed(1), +rr.height.toFixed(1), +opDe(racine).toFixed(3)] }
      racines.set(rid, ri)
      if (!descs['r' + rid]) descs['r' + rid] = decrire(racine, racine)
      return ri
    }
    // une racine est « au-dessus » d'une autre : z-index plus grand, sinon plus loin dans le document
    const dessus = (a, b) => (a.z !== b.z ? a.z > b.z : !!(b.el.compareDocumentPosition(a.el) & Node.DOCUMENT_POSITION_FOLLOWING))
    const bruts = []
    const tous = document.body.getElementsByTagName('*')
    for (let i = 0; i < tous.length; i++) {
      const el = tous[i]
      if (!retenu(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue
      bruts.push([el, r, infoRacine(racineDe(el))])
    }
    const liste = [...racines.values()]
    const els = []
    for (const [el, r, ri] of bruts) {
      const vue = inter(inter([r.left, r.top, r.right, r.bottom], bornes(el)), [0, 0, vw, vh])
      let vis = aire(vue) >= 0.5 * r.width * r.height ? 1 : 0
      if (vis) {
        const cx = (vue[0] + vue[2]) / 2, cy = (vue[1] + vue[3]) / 2
        for (const o of liste) if (o !== ri && o.opaque && dessus(o, ri) && cx >= o.zone[0] && cx <= o.zone[2] && cy >= o.zone[1] && cy <= o.zone[3]) { vis = 0; break }
      }
      const id = idDe(el)
      if (!descs[id]) descs[id] = decrire(el, ri.el)
      els.push([id, +r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1), +opDe(el).toFixed(3), ri.rid, texteDe(el), vis])
    }
    return { t: +(performance.now() - t0).toFixed(1), els, racines: liste.map((x) => x.ligne) }
  }
  // Décalages de mise en page vus par le navigateur (complément : y compris ceux qui suivent un toucher)
  const decalages = []
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) decalages.push({ t: e.startTime, v: +e.value.toFixed(4), recent: e.hadRecentInput }) })
      .observe({ type: 'layout-shift', buffered: false })
  } catch {}
  const CALME = 1200
  window.__ms = {
    demarrer({ min = 1200, max = 6000 } = {}) {
      const t0 = performance.now()
      const images = []
      const debutDecalages = decalages.length
      let sig = '', change = 0
      return new Promise((fini) => {
        const boucle = () => {
          const im = image(t0)
          images.push(im)
          const s = location.href + '#' + im.els.length + '#' + im.racines.map((r) => r.map((v) => Math.round(v * 10)).join(',')).join('|')
          if (s !== sig) { sig = s; change = im.t }
          if (im.t < max && (im.t < min || im.t - change < CALME)) requestAnimationFrame(boucle)
          else fini({ t0Epoque: performance.timeOrigin + t0, images, descs, decalages: decalages.slice(debutDecalages).map((d) => ({ ...d, t: +(d.t - t0).toFixed(1) })), vw: innerWidth, vh: innerHeight })
        }
        requestAnimationFrame(boucle)
      })
    },
    /** Lance l'enregistrement et rend la main après 2 images (l'état d'avant le toucher est capté) ; résultat dans __ms.resultat. */
    lancer(opts) {
      window.__ms.resultat = null
      window.__ms.demarrer(opts).then((r) => { window.__ms.resultat = r })
      return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(performance.timeOrigin + performance.now()))))
    }
  }
})()
