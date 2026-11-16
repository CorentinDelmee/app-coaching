#!/usr/bin/env node
// Détecteur de micro-sauts : à chaque image pendant ~1,2 s après un toucher, relève position, taille, opacité et texte des
// éléments visibles, puis signale tout élément qui saute (voir analyse.mjs). Téléphone 390×844 (toucher, isMobile), temps réel
// (jamais --virtual-time-budget), 4 variantes : lent (CPU ×4 + base ralentie 400 ms) / rapide, cache vide / cache plein.
// Planche image par image (JPEG réduits, capture d'écran continue du navigateur) pour les sauts.
//
// Usage (serveur déjà lancé : npx vite --port 5251 --strictPort) :
//   node tests/e2e/mouvement/micro-sauts.mjs --etiquette=avant [--base=http://localhost:5251] [--parcours=client-accueil]
//        [--variantes=lent-vide,lent-plein,rapide-vide,rapide-plein] [--planches=3] [--sortie=docs/captures-micro-sauts]
// Écrit <sortie>/<etiquette>.json, <sortie>/planches/<etiquette>/*.jpg, puis régénère <sortie>/index.html (avant / après).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { analyser } from './analyse.mjs'
import { PARCOURS, ouvrirSession, poserLatence } from './parcours.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '../../..')
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = arg('base', 'http://localhost:5251')
const ETIQ = arg('etiquette', 'mesure')
const FILTRE = arg('parcours', '')
const VARIANTES = arg('variantes', 'lent-vide,lent-plein,rapide-vide,rapide-plein').split(',')
const MAX_PLANCHES = +arg('planches', '3')
const SORTIE = resolve(RACINE, arg('sortie', 'docs/captures-micro-sauts'))
const VP = { width: 390, height: 844 }
const FILM = process.argv.includes('--film') // planche de toute l'étape (16 images), même sans saut
const BRUT = process.argv.includes('--brut') // enregistrements bruts (débogage du détecteur)
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

async function chargerPlaywright() {
  for (const n of ['playwright', 'playwright-core']) { try { return await import(n) } catch {} }
  const g = execFileSync('npm', ['root', '-g']).toString().trim()
  const c = join(g, '@playwright/cli/node_modules/playwright-core/index.mjs')
  if (existsSync(c)) return await import(pathToFileURL(c).href)
  throw new Error('Playwright introuvable')
}

// ---------- une étape mesurée ----------
async function mesurerEtape(page, cdp, etape, { duree, captures }) {
  const cible = typeof etape.tap === 'function' ? etape.tap(page) : page.locator(etape.tap).filter({ visible: true }).first()
  try { await cible.waitFor({ state: 'visible', timeout: 4000 }) } catch { return { erreur: 'cible introuvable' } }
  const images = []
  const surImage = (f) => { images.push({ ts: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) }
  if (captures) {
    cdp.on('Page.screencastFrame', surImage)
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: VP.width, maxHeight: VP.height, everyNthFrame: 1 })
  }
  await page.evaluate((o) => window.__ms.lancer(o), duree)
  const tTapEpoque = Date.now()
  const touche = await cible.tap({ timeout: 3000 }).then(() => true, () => cible.click({ timeout: 3000 }).then(() => true, () => false))
  if (!touche) {
    await page.waitForFunction(() => window.__ms && window.__ms.resultat, null, { timeout: 30000, polling: 100 }).catch(() => {})
    if (captures) { await cdp.send('Page.stopScreencast').catch(() => {}); cdp.off('Page.screencastFrame', surImage) }
    return { erreur: 'toucher refusé (élément couvert)' }
  }
  await page.waitForFunction(() => window.__ms && window.__ms.resultat, null, { timeout: 30000, polling: 100 })
  const rec = await page.evaluate(() => window.__ms.resultat)
  if (captures) { await cdp.send('Page.stopScreencast').catch(() => {}); cdp.off('Page.screencastFrame', surImage) }
  const tTap = tTapEpoque - rec.t0Epoque
  const res = analyser(rec, { tTap })
  return { ...res, decalages: rec.decalages.filter((d) => d.t >= tTap - 20), rec, tTap, ecran: images, url: page.url() }
}

async function attendreCalme(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await pause(900)
}

// ---------- planches ----------
async function planche(navigateur, mesure, groupe, fichier, film = false) {
  const t0 = mesure.rec.t0Epoque + mesure.tTap
  const cible = t0 + groupe.t
  const imgs = mesure.ecran
  if (!imgs.length) return null
  let i = imgs.findIndex((f) => f.ts >= cible - 4)
  if (i < 0) i = imgs.length - 1
  let choix = imgs.slice(Math.max(0, i - 2), i + 4)
  if (film) { // film de l'étape : 16 images réparties du toucher à la fin de la transition (+ 300 ms)
    const dans = imgs.filter((f) => f.ts >= t0 - 20 && f.ts <= t0 + Math.max(mesure.tFin, 300) + 300)
    choix = Array.from({ length: Math.min(16, dans.length) }, (_, j) => dans[Math.floor((j * dans.length) / Math.min(16, dans.length))])
    i = -1
  }
  const rect = groupe.elements.find((e) => e.rect)?.rect
  const ech = 0.5
  const html = `<!doctype html><html><body style="margin:0;background:#222;font:12px system-ui;color:#eee"><div style="display:flex;flex-wrap:wrap;gap:6px;padding:6px;width:${Math.min(choix.length, 8) * (VP.width * ech + 6)}px">${choix.map((f) => {
    const dt = Math.round(f.ts - t0)
    const surligne = f === imgs[i] && rect ? `<i style="position:absolute;left:${rect[0] * ech - 2}px;top:${rect[1] * ech - 2}px;width:${rect[2] * ech + 4}px;height:${rect[3] * ech + 4}px;border:2px solid #f33;box-sizing:border-box"></i>` : ''
    return `<figure style="margin:0;position:relative"><img src="data:image/jpeg;base64,${f.data}" style="display:block;width:${VP.width * ech}px">${surligne}<figcaption style="padding:2px 0;${f === imgs[i] ? 'color:#f66;font-weight:700' : ''}">${dt} ms</figcaption></figure>`
  }).join('')}</div></body></html>`
  const p = await navigateur.newPage({ viewport: { width: Math.min(choix.length, 8) * (VP.width * ech + 6) + 12, height: Math.ceil(choix.length / 8) * (VP.height * ech + 30) + 12 } })
  await p.setContent(html)
  await p.screenshot({ path: fichier, type: 'jpeg', quality: 60 })
  await p.close()
  return fichier
}

// ---------- page de synthèse ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function genererIndex() {
  const lire = (n) => { const f = join(SORTIE, `${n}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null }
  const jeux = readdirSync(SORTIE).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort((a, b) => (a === 'avant' ? -1 : b === 'avant' ? 1 : a.localeCompare(b)))
  const donnees = Object.fromEntries(jeux.map((j) => [j, lire(j)]))
  const lignes = new Map()
  for (const [j, d] of Object.entries(donnees)) for (const m of d.mesures) {
    const cle = `${m.parcours}|${m.etape}`
    if (!lignes.has(cle)) lignes.set(cle, { parcours: m.parcours, etape: m.etape, par: {} })
    lignes.get(cle).par[j] = (lignes.get(cle).par[j] || []).concat(m)
  }
  const cellule = (ms) => {
    if (!ms) return '<td>—</td>'
    return '<td>' + ms.map((m) => m.erreur ? `<span title="${esc(m.erreur)}" class="err">${m.variante} ⚠</span>` : `<span class="${m.sauts.length ? 'mal' : 'bien'}" title="${esc(m.sauts.map((s) => s.type + ' ' + s.t + 'ms : ' + s.elements.slice(0, 3).map((e) => e.el + ' « ' + (e.texte || '') + ' »').join(', ')).join('\n'))}">${m.variante} ${m.sauts.length}</span>`).join(' ') + '</td>'
  }
  const totaux = Object.fromEntries(jeux.map((j) => [j, donnees[j].mesures.reduce((n, m) => n + (m.sauts?.length || 0), 0)]))
  const details = jeux.map((j) => `<h2>Détail : ${esc(j)} (${esc(donnees[j].date)})</h2>` + donnees[j].mesures.filter((m) => m.sauts?.length).map((m) => `<details><summary>${esc(m.parcours)} · ${esc(m.etape)} · ${m.variante} : <b>${m.sauts.length}</b> saut(s), fin de transition à ${m.tFin} ms</summary><ul>${m.sauts.map((s) => `<li><b>${s.type}</b> à ${s.t} ms${s.apresFin ? ' (après la fin)' : ''} — ${s.elements.length} élément(s) : ${s.elements.slice(0, 4).map((e) => `<code>${esc(e.el)}</code> « ${esc(e.texte)} » ${e.d != null ? esc(e.d) + ' px' : ''}${e.dw != null ? ` Δ${esc(e.dw)}×${esc(e.dh)}` : ''}${e.avant != null ? ` « ${esc(e.avant)} » → « ${esc(e.apres)} »` : ''}`).join(' ; ')}${s.planche ? ` <a href="${esc(s.planche)}">planche</a>` : ''}</li>`).join('')}</ul>${m.sauts.filter((s) => s.planche).map((s) => `<img loading="lazy" src="${esc(s.planche)}" alt="">`).join('')}</details>`).join('')).join('')
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Micro-sauts — avant / après</title>
<style>body{font:14px system-ui;margin:24px;color:#1d1f24;background:#f4f4f6}table{border-collapse:collapse;background:#fff}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
.mal{color:#b3261e;font-weight:600}.bien{color:#1b7f3b}.err{color:#a60}span{margin-right:8px;white-space:nowrap}details{background:#fff;margin:6px 0;padding:6px 10px;border-radius:8px}img{max-width:100%;display:block;margin:6px 0}code{font-size:12px}</style>
<h1>Micro-sauts — détecteur image par image</h1>
<p>Téléphone 390×844 (toucher), temps réel, 4 variantes : <b>lent</b> = CPU ×4 + base ralentie 400 ms, <b>rapide</b> = sans ralenti ; <b>vide</b> = page rechargée (cache des lectures vide), <b>plein</b> = parcours déjà joué une fois.
Un « saut » = un groupe d'éléments qui sautent ensemble dans la même image (position, taille, texte, apparition / disparition sans fondu, page entière). Règles : <code>tests/e2e/mouvement/analyse.mjs</code>. Relancer : <code>node tests/e2e/mouvement/micro-sauts.mjs --etiquette=apres</code>.</p>
<p>Total des sauts : ${jeux.map((j) => `<b>${esc(j)}</b> ${totaux[j]}`).join(' → ')}</p>
<table><tr><th>Parcours</th><th>Étape</th>${jeux.map((j) => `<th>${esc(j)}</th>`).join('')}</tr>
${[...lignes.values()].map((l) => `<tr><td>${esc(l.parcours)}</td><td>${esc(l.etape)}</td>${jeux.map((j) => cellule(l.par[j])).join('')}</tr>`).join('\n')}</table>
${details}</html>`
  writeFileSync(join(SORTIE, 'index.html'), html)
}

// ---------- programme ----------
async function principal() {
  if (process.argv.includes('--index')) { genererIndex(); return }
  mkdirSync(SORTIE, { recursive: true })
  const dossierPl = join(SORTIE, 'planches', ETIQ)
  rmSync(dossierPl, { recursive: true, force: true })
  mkdirSync(dossierPl, { recursive: true })
  const pw = await chargerPlaywright()
  const chromium = pw.chromium || pw.default?.chromium
  const navigateur = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const mesures = []
  const parcours = PARCOURS.filter((p) => !FILTRE || FILTRE.split(',').some((f) => p.nom.includes(f)))
  try {
    for (const variante of VARIANTES) {
      const [vitesse, cache] = variante.split('-')
      const lent = vitesse === 'lent'
      for (const role of ['client', 'coach']) {
        const liste = parcours.filter((p) => p.role === role)
        if (!liste.length) continue
        const ctx = await navigateur.newContext({ viewport: VP, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' })
        await ctx.addInitScript({ path: join(ICI, 'enregistreur-page.js') })
        const page = await ctx.newPage()
        const erreurs = []
        page.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 160)))
        await ouvrirSession(page, BASE, role)
        await poserLatence(page, lent ? 400 : 0)
        const cdp = await ctx.newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: lent ? 4 : 1 })
        for (const p of liste) {
          process.stdout.write(`${variante} ${p.nom} `)
          await page.goto(BASE + p.depart, { waitUntil: 'load' })
          await attendreCalme(page)
          if (cache === 'plein') {
            for (const e of p.etapes) { const r = await mesurerEtape(page, cdp, e, { duree: { min: 300, max: 4000 }, captures: false }); if (r.erreur) break; await attendreCalme(page) }
          }
          let k = 0
          for (const e of p.etapes) {
            const r = await mesurerEtape(page, cdp, e, { duree: lent ? { min: 2500, max: 8000 } : { min: 1200, max: 5000 }, captures: MAX_PLANCHES > 0 || FILM })
            const m = { parcours: p.nom, etape: e.nom, variante, url: r.url }
            if (r.erreur) { m.erreur = r.erreur; mesures.push(m); process.stdout.write('⚠ '); break }
            Object.assign(m, { sauts: r.sauts, aRegarder: r.aRegarder, tFin: r.tFin, images: r.images, decalages: r.decalages })
            // planches : les groupes les plus gros d'abord
            const tri = [...r.sauts].sort((a, b) => b.elements.length - a.elements.length).slice(0, MAX_PLANCHES)
            for (const g of tri) {
              const nom = `${p.nom}-${k}-${variante}-${g.type}-${g.t}.jpg`.replace(/[^a-z0-9.-]+/gi, '-')
              if (await planche(navigateur, r, g, join(dossierPl, nom))) g.planche = `planches/${ETIQ}/${nom}`
            }
            if (FILM && r.ecran.length) {
              const nom = `film-${p.nom}-${k}-${variante}.jpg`.replace(/[^a-z0-9.-]+/gi, '-')
              if (await planche(navigateur, r, { t: 0, elements: [] }, join(dossierPl, nom), true)) m.film = `planches/${ETIQ}/${nom}`
            }
            if (BRUT) { mkdirSync(join(SORTIE, "brut"), { recursive: true }); writeFileSync(join(SORTIE, "brut", `${p.nom}-${k}-${variante}.json`), JSON.stringify({ tTap: r.tTap, rec: r.rec, ecran: r.ecran.map((f) => f.ts - r.rec.t0Epoque - r.tTap) })) }
            mesures.push(m)
            process.stdout.write(`${r.sauts.length} `)
            k++
            await attendreCalme(page)
          }
          process.stdout.write('\n')
        }
        if (erreurs.length) mesures.push({ parcours: `(${role})`, etape: 'erreurs de page', variante, erreur: [...new Set(erreurs)].slice(0, 5).join(' | '), sauts: [] })
        await ctx.close()
      }
    }
  } finally {
    await navigateur.close()
  }
  writeFileSync(join(SORTIE, `${ETIQ}.json`), JSON.stringify({ date: new Date().toISOString(), base: BASE, variantes: VARIANTES, mesures }, null, 1))
  genererIndex()
  const total = mesures.reduce((n, m) => n + (m.sauts?.length || 0), 0)
  console.log(`\n${total} saut(s) sur ${mesures.length} mesures → ${join(SORTIE, 'index.html')}`)
}

principal().catch((e) => { console.error(e); process.exit(1) })
