// Analyse des images enregistrées par enregistreur-page.js : repère les micro-sauts (fonctions pures, testées par
// tests/unit/micro-sauts-analyse.test.js).
//
// Règle vérifiée : « chaque élément arrive avec la page ou en fondu / translate court, jamais par saut ».
// Types signalés (comptent comme des sauts) :
//   position   : bouge de plus de 2 px en une seule image par rapport à sa page (sans mouvement avant ni après)
//   fin        : un mouvement fluide qui se termine par un dernier pas brusque
//   taille     : change de taille de plus de 2 px en une seule image
//   texte      : change de texte après son arrivée (hors compteurs qui défilent)
//   apparition : apparaît dans une page déjà là, d'un coup (ni fondu, ni glissement, ni remplacement à l'identique)
//   disparition: disparaît d'une page qui reste, d'un coup
//   pop        : opacité qui saute (> .4) en une image, l'élément restant en place
//   squelette  : contenu qui remplace un squelette d'une autre taille
//   echange    : à l'arrivée d'une page (ou d'une copie : voile, page « dessous »), le même élément (mêmes balise, classes et texte)
//                se retrouve ailleurs ou avec une autre taille dans la nouvelle page (copie mise en page autrement)
//   page       : la page entière (racine) saute (défilement restauré tard, en-tête qui se recale…)
// À regarder (ne comptent pas) : tardif (mouvement fluide qui démarre après la fin de la transition),
//   double (enfant animé pendant que sa page bouge).

const SEUIL = 2 // px
const VISIBLE = 0.3

const hyp = (a, b) => Math.hypot(a, b)

/** Pistes par élément et par racine à partir des images brutes. */
export function pistes(images) {
  const els = new Map()
  const racines = new Map()
  images.forEach((im, k) => {
    const rmap = new Map(im.racines.map((r) => [r[0], r]))
    for (const r of im.racines) {
      if (!racines.has(r[0])) racines.set(r[0], [])
      racines.get(r[0]).push({ k, t: im.t, x: r[1], y: r[2], w: r[3], h: r[4], op: r[5] })
    }
    for (const e of im.els) {
      const [id, x, y, w, h, op, rid, txt, vis = 1] = e
      const r = rmap.get(rid)
      if (!els.has(id)) els.set(id, [])
      els.get(id).push({ k, t: im.t, x, y, w, h, op, vis, rid, txt, rx: x - (r ? r[1] : 0), ry: y - (r ? r[2] : 0) })
    }
  })
  return { els, racines }
}

/** Suites d'images consécutives où la valeur `pas(a, b)` dépasse .5 : [{ debut, fin, pas: [..] }] (indices dans la piste). */
export function suites(piste, pas) {
  const out = []
  let cour = null
  for (let i = 1; i < piste.length; i++) {
    const a = piste[i - 1], b = piste[i]
    const d = b.k === a.k + 1 ? pas(a, b) : 0
    if (d > 0.5) {
      if (!cour) { cour = { debut: i, fin: i, pas: [] }; out.push(cour) }
      cour.fin = i; cour.pas.push(d)
    } else cour = null
  }
  return out
}

const mediane = (l) => { const s = [...l].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0 }

/**
 * Analyse un enregistrement. `tTap` : instant du toucher (ms depuis le début de l'enregistrement).
 * Rend { sauts: [groupes], aRegarder: [groupes], tFin } ; un groupe réunit les éléments qui sautent ensemble (même image, même type).
 */
export function analyser(rec, { tTap = 0 } = {}) {
  const { images, descs = {} } = rec
  const { els, racines } = pistes(images)
  const n = images.length
  const ev = []
  const add = (type, p, extra = {}) => ev.push({ type, k: p.k, t: p.t, id: extra.id, ...extra })

  // premières / dernières images des racines
  const rDebut = new Map(), rFin = new Map()
  for (const [rid, l] of racines) { rDebut.set(rid, l[0].k); rFin.set(rid, l[l.length - 1].k) }

  // fin de transition : dernière image où une racine bouge ou change d'opacité
  let kFin = 0
  for (const l of racines.values()) {
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], b = l[i]
      if (b.k !== a.k + 1) continue
      if (hyp(b.x - a.x, b.y - a.y) > 0.5 || Math.abs(b.w - a.w) > 0.5 || Math.abs(b.op - a.op) > 0.01) kFin = Math.max(kFin, b.k)
    }
    if (l[0].k > 0) kFin = Math.max(kFin, l[0].k)
  }
  const tFin = images[kFin]?.t ?? 0

  // --- racines : saut de page entière
  for (const [rid, l] of racines) {
    for (const s of suites(l, (a, b) => hyp(b.x - a.x, b.y - a.y))) {
      const tot = s.pas.reduce((x, y) => x + y, 0)
      if (s.pas.length === 1 && tot > SEUIL) add('page', l[s.fin], { id: 'r' + rid, d: +tot.toFixed(1), dx: +(l[s.fin].x - l[s.fin - 1].x).toFixed(1), dy: +(l[s.fin].y - l[s.fin - 1].y).toFixed(1) })
    }
  }

  // la racine bouge entre les images k-1 et k (feuille qui glisse : ses éléments entrent / sortent de l'écran en glissant)
  const rParK = new Map()
  for (const [rid, l] of racines) rParK.set(rid, new Map(l.map((r) => [r.k, r])))
  const vw = rec.vw || 390, vh = rec.vh || 844
  const auBord = (p) => p.y < 2 || p.x < 2 || p.y + p.h > vh - 2 || p.x + p.w > vw - 2 // touche (ou dépasse) un bord de l'écran
  const racineBougeA = (rid, k) => { const m = rParK.get(rid); const a = m?.get(k - 1), b = m?.get(k); return !!(a && b && (hyp(b.x - a.x, b.y - a.y) > 0.5 || Math.abs(b.h - a.h) > 0.5)) }

  // index des pistes par image de début / fin (appariement apparition <-> disparition)
  const parDebut = new Map(), parFin = new Map()
  for (const [id, l] of els) {
    const d = l[0].k, f = l[l.length - 1].k
    if (d > 0) { if (!parDebut.has(d)) parDebut.set(d, []); parDebut.get(d).push(id) }
    if (f < n - 1) { if (!parFin.has(f)) parFin.set(f, []); parFin.get(f).push(id) }
  }
  const same = (a, b) => Math.abs(a.x - b.x) <= SEUIL && Math.abs(a.y - b.y) <= SEUIL && Math.abs(a.w - b.w) <= SEUIL && Math.abs(a.h - b.h) <= SEUIL
  const recouvre = (a, b) => {
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    return (ix * iy) / Math.max(1, Math.min(a.w * a.h, b.w * b.h))
  }
  const estSquelette = (id) => /sq|squelette|skel|fantome|charg/i.test((descs[id]?.el || '') + ' ' + (descs[id]?.ctx || ''))
  const remplaces = new Set() // pistes disparues expliquées par un remplacement

  for (const [id, l] of els) {
    const d = descs[id] || {}
    // position relative à la page
    for (const s of suites(l, (a, b) => (a.rid === b.rid && a.vis && b.vis ? hyp(b.rx - a.rx, b.ry - a.ry) : 0))) {
      const p = l[s.fin]
      if (p.op < VISIBLE) continue
      const tot = s.pas.reduce((x, y) => x + y, 0)
      const max = Math.max(...s.pas)
      const dx = +(p.rx - l[s.fin - 1].rx).toFixed(1), dy = +(p.ry - l[s.fin - 1].ry).toFixed(1)
      if (s.pas.length === 1 && tot > SEUIL) add('position', p, { id, d: +tot.toFixed(1), dx, dy })
      else if (s.pas.length >= 2 && max > 40 && max > 0.7 * tot) add('position', l[s.debut + s.pas.indexOf(max)], { id, d: +max.toFixed(1), dx, dy })
      else if (s.pas.length >= 3) {
        const der = s.pas[s.pas.length - 1]
        const med = mediane(s.pas.slice(0, -1))
        if (der > 6 && der > 3 * med) add('fin', p, { id, d: +der.toFixed(1), dx, dy })
        else {
          const debut = l[s.debut]
          const rl = racines.get(p.rid)
          const racineBouge = rl && rl.some((r, i) => i > 0 && r.k >= debut.k && r.k <= p.k && rl[i - 1].k === r.k - 1 && hyp(r.x - rl[i - 1].x, r.y - rl[i - 1].y) > 0.5)
          if (debut.k > kFin + 3) ev.push({ type: 'tardif', k: debut.k, t: debut.t, id, d: +tot.toFixed(1), voir: true })
          else if (racineBouge) ev.push({ type: 'double', k: debut.k, t: debut.t, id, d: +tot.toFixed(1), voir: true })
        }
      }
    }
    // taille
    for (const s of suites(l, (a, b) => (a.vis && b.vis ? Math.abs(b.w - a.w) + Math.abs(b.h - a.h) : 0))) {
      const p = l[s.fin]
      if (p.op < VISIBLE || s.pas.length !== 1) continue
      const a = l[s.fin - 1]
      const dw = p.w - a.w, dh = p.h - a.h
      if (Math.abs(dw) > SEUIL || Math.abs(dh) > SEUIL) add('taille', p, { id, dw: +dw.toFixed(1), dh: +dh.toFixed(1) })
    }
    // texte
    const changes = []
    for (let i = 1; i < l.length; i++) if (l[i].k === l[i - 1].k + 1 && l[i].txt !== l[i - 1].txt && l[i].op >= VISIBLE && l[i].vis && l[i - 1].vis) changes.push(i)
    const compteur = changes.length >= 3 && changes.every((i) => /^[\d\s.,:/%+−-]*$/.test(l[i].txt) && /^[\d\s.,:/%+−-]*$/.test(l[i - 1].txt))
    if (!compteur) for (const i of changes) add('texte', l[i], { id, avant: l[i - 1].txt, apres: l[i].txt })
    // opacité qui saute sur place
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], b = l[i]
      if (b.k !== a.k + 1 || !a.vis || !b.vis || rDebut.get(b.rid) >= a.k) continue
      const dop = b.op - a.op
      if (Math.abs(dop) <= 0.4) continue
      const av = l[i - 2], ap = l[i + 1]
      const stableAv = !av || av.k !== a.k - 1 || Math.abs(a.op - av.op) < 0.05
      const stableAp = !ap || ap.k !== b.k + 1 || Math.abs(ap.op - b.op) < 0.05
      if (stableAv && stableAp) add('pop', b, { id, de: a.op, a: b.op })
    }
  }

  // apparitions
  for (const [k, ids] of parDebut) {
    const parties = parFin.get(k - 1) || []
    for (const id of ids) {
      const l = els.get(id)
      const p = l[0]
      if (p.op < 0.05 || !p.vis) continue
      if (rDebut.get(p.rid) === k) continue // arrive avec sa page
      const d = descs[id] || {}
      // remplacement : même élément (mêmes balise/classes et texte) re-rendu au même endroit, ou squelette remplacé
      const jumeau = parties.find((j) => { const dj = descs[j] || {}; return dj.el === d.el && els.get(j).at(-1).txt === p.txt })
      if (jumeau) {
        remplaces.add(jumeau)
        const q = els.get(jumeau).at(-1)
        if (!same(q, p) && q.op >= VISIBLE) add('position', p, { id, d: +hyp(p.x - q.x, p.y - q.y).toFixed(1), dx: +(p.x - q.x).toFixed(1), dy: +(p.y - q.y).toFixed(1), dw: +(p.w - q.w).toFixed(1), dh: +(p.h - q.h).toFixed(1), remplace: true })
        continue
      }
      const sq = parties.find((j) => estSquelette(j) && recouvre(els.get(j).at(-1), p) > 0.5)
      if (sq) {
        remplaces.add(sq)
        continue // le contenu remplace le squelette (sans fondu, voulu) ; un écart de taille se voit sur les voisins (position)
      }
      // glisse dans l'écran, ou fondu qui monte : voulu
      const suiv = l.slice(1, 4)
      const glisse = suiv.some((s, i) => { const a = i ? suiv[i - 1] : p; return hyp(s.rx - a.rx, s.ry - a.ry) > 0.5 || hyp(s.x - a.x, s.y - a.y) > 0.5 })
      const monte = suiv.length && suiv.at(-1).op > p.op + 0.05
      if (glisse || monte || p.op < 0.6 || (auBord(p) && racineBougeA(p.rid, k))) continue
      add('apparition', p, { id, op: p.op })
    }
  }
  // remplacement de contenu d'un bloc (changement d'onglet…) : au moins 4 éléments partent et 3 arrivent dans la même page
  const swaps = new Set()
  for (const [k, ids] of parDebut) {
    const parRacine = (l) => l.reduce((m, id) => { const r = els.get(id)[0].rid; m.set(r, (m.get(r) || 0) + 1); return m }, new Map())
    const arr = parRacine(ids)
    const dep = parRacine((parFin.get(k - 1) || []).map((id) => ({ id, p: els.get(id).at(-1) })).filter((x) => x.p.vis && x.p.op >= VISIBLE).map((x) => x.id))
    for (const [r, nA] of arr) if (nA >= 3 && (dep.get(r) || 0) >= 4) swaps.add(`${r}|${k}`)
  }
  for (const s of swaps) { const [r, k] = s.split('|').map(Number); ev.forEach((e) => { if (e.type === 'position' && e.k === k && e.d > 150 && els.get(e.id)?.find((x) => x.k === k)?.rid === r) e.annule = true }) }

  // disparitions
  for (const [k, ids] of parFin) {
    for (const id of ids) {
      if (remplaces.has(id)) continue
      const l = els.get(id)
      const p = l.at(-1)
      if (p.op < 0.6 || !p.vis) continue
      if (rFin.get(p.rid) === k) continue // la page entière part (sortie 0 ms : voulu)
      const prec = l.at(-2)
      if (prec && prec.k === k - 1 && (hyp(p.rx - prec.rx, p.ry - prec.ry) > 0.5 || hyp(p.x - prec.x, p.y - prec.y) > 0.5 || prec.op > p.op + 0.05)) continue // sortait en glissant / fondu
      if (swaps.has(`${p.rid}|${k + 1}`) || (auBord(p) && racineBougeA(p.rid, k + 1))) continue // contenu remplacé d'un bloc (onglet) : l'ancien part dans la même image, voulu
      const nouveaux = parDebut.get(k + 1) || []
      if (nouveaux.some((j) => { const dj = descs[j] || {}, dd = descs[id] || {}; return dj.el === dd.el && els.get(j)[0].txt === p.txt })) continue
      add('disparition', p, { id })
    }
  }

  // échange de page : mêmes éléments (balise + classes + texte) qui changent de place quand une racine arrive
  for (let k = 1; k < n; k++) {
    const nouvelles = new Set([...rDebut].filter(([, d]) => d === k).map(([r]) => r))
    if (!nouvelles.size) continue
    const visibles = (im) => im.els.filter((e) => e[5] >= VISIBLE && (e[8] ?? 1) && e[7])
    const maintenant = visibles(images[k])
    const encore = new Set(maintenant.map((e) => e[0]))
    const partis = visibles(images[k - 1]).filter((e) => !encore.has(e[0]))
    const pris = new Set()
    const paires = []
    for (const a of partis) {
      const da = descs[a[0]] || {}
      const b = maintenant.find((e) => nouvelles.has(e[6]) && !pris.has(e[0]) && e[7] === a[7] && (descs[e[0]] || {}).el === da.el)
      if (!b) continue
      pris.add(b[0])
      paires.push([a, b])
    }
    if (paires.length < 3) continue
    for (const [a, b] of paires) {
      const dx = b[1] - a[1], dy = b[2] - a[2], dw = b[3] - a[3], dh = b[4] - a[4]
      if (Math.abs(dx) > SEUIL || Math.abs(dy) > SEUIL || Math.abs(dw) > SEUIL || Math.abs(dh) > SEUIL) {
        ev.push({ type: 'echange', k, t: images[k].t, id: b[0], d: +hyp(dx, dy).toFixed(1), dx: +dx.toFixed(1), dy: +dy.toFixed(1), dw: +dw.toFixed(1), dh: +dh.toFixed(1) })
      }
    }
  }

  // garder ce qui suit le toucher
  const apres = ev.filter((e) => e.t >= tTap - 20 && !e.annule)
  const grouper = (liste) => {
    const g = new Map()
    for (const e of liste) {
      const cle = e.type === 'echange' ? `echange|${e.k}` : `${e.type}|${e.k}|${Math.round((e.dx || 0) / 4)}|${Math.round((e.dy || 0) / 4)}`
      if (!g.has(cle)) g.set(cle, { type: e.type, k: e.k, t: +(e.t - tTap).toFixed(0), apresFin: e.k > kFin, elements: [] })
      const d = descs[e.id] || {}
      g.get(cle).elements.push({ ...d, ...Object.fromEntries(Object.entries(e).filter(([c]) => !['type', 'k', 't', 'voir'].includes(c))), rect: rectDe(els, e) })
    }
    return [...g.values()].sort((a, b) => a.t - b.t)
  }
  return {
    sauts: grouper(apres.filter((e) => !e.voir)),
    aRegarder: grouper(apres.filter((e) => e.voir)),
    tFin: +(tFin - tTap).toFixed(0),
    images: n
  }
}

function rectDe(els, e) {
  if (typeof e.id !== 'number') return null
  const p = (els.get(e.id) || []).find((x) => x.k === e.k)
  return p ? [p.x, p.y, p.w, p.h] : null
}
