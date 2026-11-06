// Banc de test « Studio » (refonte coach) : vrais clics souris, 1366x690 et 390x844, app en mode local (sans .env).
//
//   node tests/e2e/studio/banc.mjs            # construit l'app, la sert sous la CSP de production (port 5190), teste
//   node tests/e2e/studio/banc.mjs --dev      # serveur Vite de dev (sans CSP : le contrôle CSP est alors ignoré)
//   options : --strict (les échecs « pas encore Studio » comptent aussi), --force-studio (tout écran est jugé Studio),
//             --only=exercices (filtre de routes), --port=5190, --out=<dossier>, --no-build (réutilise <out>/dist)
//
// Statuts : ok | fail (échec réel, code de sortie 1) | attendu (échec sur un écran pas encore Studio) | warn (info) | skip.
// Sont toujours des échecs réels : erreur console, défilement horizontal, violation de CSP, lien cassé.
// Les contrôles de design (cibles 44 px, contraste, focus, mouvement réduit, scénarios) deviennent « attendu » tant que l'écran
// n'est pas Studio (= .st-app présent ET aucun élément hérité « c-… » dans <main>).
// Limite connue : le mouvement réduit est contrôlé via document.getAnimations() (CSS/WAAPI), pas les animations GSAP/rAF.
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { dirname, join, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '../../..')
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d }
const flag = (n) => process.argv.includes(`--${n}`)
const PORT = Number(arg('port', 5190))
const OUT = resolve(arg('out', '/private/tmp/claude-501/-Users-corentindelmee-Documents-REXV2/0e1caa14-04ed-46a4-b220-d2142a82a95f/scratchpad/studio-banc'))
const DEV = flag('dev'), STRICT = flag('strict'), FORCE = flag('force-studio')
const ONLY = arg('only', '')
const BASE = `http://127.0.0.1:${PORT}`
const VIEWPORTS = [{ nom: '1366x690', width: 1366, height: 690 }, { nom: '390x844', width: 390, height: 844 }]
mkdirSync(join(OUT, 'captures'), { recursive: true })

// ---------- résultats ----------
const R = []
const add = (route, vp, check, status, detail = '') => { R.push({ route, vp, check, status, detail }); if (status === 'fail') console.log(`  FAIL ${route} ${vp} ${check} ${detail.slice(0, 140)}`) }
// Contrôle de design : « attendu » tant que l'écran n'est pas Studio.
const design = (studio) => (studio ? 'fail' : 'attendu')

// ---------- chargement de Playwright ----------
async function chargerPlaywright() {
  const essais = ['playwright', 'playwright-core']
  for (const n of essais) { try { return await import(n) } catch {} }
  const g = execFileSync('npm', ['root', '-g']).toString().trim()
  const chemin = join(g, '@playwright/cli/node_modules/playwright-core/index.mjs')
  if (existsSync(chemin)) return await import(pathToFileURL(chemin).href)
  throw new Error('Playwright introuvable (npm i -g @playwright/cli, ou npm i -D playwright-core)')
}

// ---------- serveur : build + statique sous CSP de production, ou Vite dev ----------
function cspProduction() {
  const t = readFileSync(join(RACINE, 'deploiement/app-coaching.caddy'), 'utf8')
  const m = t.match(/Content-Security-Policy "([^"]+)"/)
  if (!m) throw new Error('CSP introuvable dans deploiement/app-coaching.caddy')
  return m[1]
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' }
let serveur, vite
async function demarrerServeur() {
  if (DEV) {
    vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: RACINE, stdio: 'ignore' })
    for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) return } catch {} await new Promise((r) => setTimeout(r, 500)) }
    throw new Error('Vite ne répond pas')
  }
  const dist = join(OUT, 'dist')
  if (!flag('no-build') || !existsSync(dist)) {
    console.log('Build de l’app (vite build)…')
    execFileSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir'], { cwd: RACINE, stdio: 'ignore', env: { ...process.env, VITE_MODE_DEMO: '1' } }) // sans MODE_DEMO, la prod locale affiche « Configuration manquante »
  }
  const csp = cspProduction()
  serveur = createServer((req, rep) => {
    let chemin = decodeURIComponent(req.url.split('?')[0])
    let f = join(dist, chemin)
    if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) f = join(dist, 'index.html') // repli SPA comme Caddy
    rep.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store' })
    rep.end(readFileSync(f))
  })
  await new Promise((ok, ko) => serveur.once('error', ko).listen(PORT, '127.0.0.1', ok))
}
function arreter() { try { serveur?.close() } catch {} try { vite?.kill() } catch {} }

// ---------- code injecté dans la page ----------
const LIB_PAGE = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const mix = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1] }
  const nom = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
  // Contraste de tous les textes visibles (opacité des ancêtres comprise : c'est ce qui révèle les creux des fondus).
  function scan() {
    const sortie = [], ignores = { fond_image: 0 }
    for (const el of document.body.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(el.tagName.toUpperCase())) continue
      const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
      if (!texte) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
      const cs = getComputedStyle(el)
      if (cs.visibility !== 'visible' || cs.display === 'none') continue
      if (el.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"],.st-sr,.sr-only')) continue
      let op = 1; for (let n = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity)
      if (op === 0) continue
      const couches = []; let inconnu = false
      for (let n = el; n; n = n.parentElement) {
        const s = getComputedStyle(n)
        if (s.backgroundImage !== 'none') { inconnu = true; break }
        const a = rgba(s.backgroundColor); if (a[3] > 0) couches.push(a); if (a[3] >= 0.999) break
      }
      if (inconnu) { ignores.fond_image++; continue }
      let fond = [255, 255, 255, 1]; for (const c of couches.reverse()) fond = mix(c, fond)
      const f = rgba(cs.color); f[3] *= op
      const fg = mix(f, fond)
      const L1 = lum(fg), L2 = lum(fond), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
      const px = parseFloat(cs.fontSize), gras = parseInt(cs.fontWeight) >= 700
      const need = px >= 24 || (px >= 18.66 && gras) ? 3 : 4.5
      sortie.push({ sel: nom(el), texte: texte.slice(0, 30), ratio: Math.round(ratio * 100) / 100, need, px })
    }
    return { mesures: sortie, ignores }
  }
  // Mesure en temps réel : un scan toutes les 50 ms, on garde le pire ratio de chaque texte.
  let timer, pires
  window.__banc = {
    scan,
    veille() { pires = new Map(); let n = 0; timer = setInterval(() => { n++; for (const m of scan().mesures) { const k = m.sel + '|' + m.texte; const p = pires.get(k); if (!p || m.ratio < p.ratio) pires.set(k, m) } }, 50); window.__banc.n = () => n },
    fin() { clearInterval(timer); return { echecs: [...pires.values()].filter((m) => m.ratio < m.need).sort((a, b) => a.ratio - b.ratio), n: window.__banc.n() } },
    // Cibles tactiles : éléments interactifs visibles plus petits que 44 px (liens en ligne dans un texte exemptés).
    cibles() {
      const bad = []; let total = 0
      for (const el of document.body.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=switch],[tabindex]:not([tabindex="-1"])')) {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
        if (r.width < 1 || r.height < 1 || cs.visibility !== 'visible' || cs.display === 'none' || el.disabled) continue
        if (r.bottom < 0 || r.top > innerHeight * 3 || r.right < 0 || r.left > innerWidth) continue
        if (el.closest('[aria-hidden="true"],[inert]')) continue
        if (el.tagName === 'A' && cs.display === 'inline' && el.closest('p,li,span.texte')) continue
        // un input masqué visuellement dans un label cliquable : la cible est le label
        if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) { const lr = el.closest('label').getBoundingClientRect(); if (lr.height >= 44 && lr.width >= 44) continue }
        total++
        if (r.width < 43.5 || r.height < 43.5) bad.push({ sel: nom(el), texte: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) })
      }
      return { total, bad }
    },
    focusVisible() {
      const el = document.activeElement; if (!el || el === document.body) return null
      const cs = getComputedStyle(el), r = el.getBoundingClientRect()
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && rgba(cs.outlineColor)[3] > 0
      const ombre = cs.boxShadow !== 'none'
      return { sel: nom(el), texte: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), ok: outline || ombre || el.matches(':focus-visible') && cs.outlineStyle !== 'none', visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight }
    },
    studio() { return !!document.querySelector('.st-app') && !document.querySelector('main [class^="c-"], main [class*=" c-"], .c-main') },
    csp: [],
    liens() { return [...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))] },
    animations() {
      return document.getAnimations().filter((a) => { const t = a.effect?.getComputedTiming?.(); return a.playState === 'running' && t && (t.iterations === Infinity || t.duration > 120) }).map((a) => ({ cible: a.effect?.target ? nom(a.effect.target) : '?', duree: a.effect.getComputedTiming().duration, infini: a.effect.getComputedTiming().iterations === Infinity })).slice(0, 8)
    }
  }
  document.addEventListener('securitypolicyviolation', (e) => window.__banc.csp.push(e.blockedURI + ' <- ' + e.violatedDirective))
})()`

// ---------- utilitaires ----------
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'racine'
const resume = (l, f) => l.slice(0, 6).map(f).join(' ; ') + (l.length > 6 ? ` … (+${l.length - 6})` : '')

async function nouveauContexte(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, serviceWorkers: 'block', hasTouch: vp.width < 600, ...opts })
  await ctx.addInitScript(LIB_PAGE)
  // Les données de démo ne se créent qu'au premier accès avec une session : on amorce une fois, puis la session coach s'ouvre seule.
  const newPage = ctx.newPage.bind(ctx)
  ctx.newPage = async () => {
    const p = await newPage()
    await p.goto(BASE + '/bienvenue', { waitUntil: 'load' })
    await p.evaluate(() => localStorage.setItem('cdc-coaching/1:session', 'amorce'))
    await p.reload({ waitUntil: 'load' }); await pause(600)
    await p.evaluate(() => localStorage.setItem('cdc-coaching/1:session', 'coach-corentin'))
    return p
  }
  return ctx
}
function surveiller(page, journal) {
  page.on('pageerror', (e) => journal.erreurs.push('pageerror: ' + String(e.message || e).slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_(INTERNET|NAME|CONNECTION|BLOCKED)|Failed to load resource/.test(m.text())) journal.erreurs.push('console: ' + m.text().slice(0, 200)) })
  // les échecs réseau d'hôtes externes (pas d'Internet dans le banc) ne sont pas des erreurs de l'app ; ceux de notre origine, si
  page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) journal.erreurs.push('réseau: ' + r.url().replace(BASE, '') + ' ' + (r.failure()?.errorText || '')) })
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400 && !/favicon|\.map$/.test(r.url())) journal.erreurs.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`) })
}
async function aller(page, chemin) {
  await page.goto(BASE + chemin, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle').catch(() => {})
  await pause(700)
}

// ---------- audit d'une route ----------
async function auditerRoute(browser, vp, route, chemin) {
  const ctx = await nouveauContexte(browser, vp)
  const page = await ctx.newPage()
  const journal = { erreurs: [] }
  surveiller(page, journal)
  const tag = (c, s, d) => add(route, vp.nom, c, s, d)
  try {
    await aller(page, chemin)
    const finale = new URL(page.url()).pathname
    const studio = FORCE || await page.evaluate(() => window.__banc.studio())
    tag('écran Studio', studio ? 'ok' : 'attendu', studio ? '' : 'écran pas encore Studio (hérité)')
    if (!finale.startsWith('/coach')) tag('route accessible', 'fail', `redirigé vers ${finale}`)
    await page.screenshot({ path: join(OUT, 'captures', `${slug(route)}-${vp.nom}.png`) })

    // 1. console / réseau
    tag('console sans erreur', journal.erreurs.length ? 'fail' : 'ok', [...new Set(journal.erreurs)].slice(0, 4).join(' | '))
    // 2. défilement horizontal
    const h = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, bw: document.body.scrollWidth }))
    tag('pas de défilement horizontal', Math.max(h.sw, h.bw) > h.iw + 1 ? 'fail' : 'ok', `scrollWidth ${Math.max(h.sw, h.bw)} / ${h.iw}`)
    // 3. CSP
    if (DEV) tag('CSP production', 'skip', 'mode --dev (pas de CSP)')
    else { const csp = await page.evaluate(() => window.__banc.csp); tag('CSP production', csp.length ? 'fail' : 'ok', csp.slice(0, 3).join(' | ')) }
    // 4. cibles tactiles
    const ci = await page.evaluate(() => window.__banc.cibles())
    tag('cibles >= 44 px', ci.bad.length ? design(studio) : 'ok', ci.bad.length ? `${ci.bad.length}/${ci.total} trop petites : ` + resume(ci.bad, (b) => `${b.sel}"${b.texte}" ${b.w}x${b.h}`) : `${ci.total} cibles`)
    // 5. contraste AA (état statique)
    const co = await page.evaluate(() => window.__banc.scan())
    const mauvais = co.mesures.filter((m) => m.ratio < m.need).sort((a, b) => a.ratio - b.ratio)
    tag('contraste AA (statique)', mauvais.length ? design(studio) : 'ok', mauvais.length ? `${mauvais.length}/${co.mesures.length} sous le seuil : ` + resume(mauvais, (m) => `${m.sel}"${m.texte}" ${m.ratio}<${m.need}`) : `${co.mesures.length} textes mesurés (${co.ignores.fond_image} sur fond image ignorés)`)
    // 6. focus visible au clavier (25 tabulations)
    await page.evaluate(() => document.activeElement?.blur?.())
    const sans = []; let vus = 0
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      const f = await page.evaluate(() => window.__banc.focusVisible())
      if (!f) continue
      vus++
      if (!f.ok && f.visible) sans.push(f)
    }
    tag('focus visible au clavier', vus === 0 ? design(studio) : sans.length ? design(studio) : 'ok', vus === 0 ? 'aucun élément focalisable par Tab' : sans.length ? `${sans.length}/${vus} sans indicateur : ` + resume(sans, (s) => `${s.sel}"${s.texte}"`) : `${vus} éléments testés`)
    // 7. liens internes (mémorisés pour le contrôle des liens cassés)
    const liens = await page.evaluate(() => window.__banc.liens())
    liens.forEach((l) => LIENS.add(l))
  } catch (e) {
    tag('audit', 'fail', 'exception: ' + String(e.message).split('\n')[0])
  } finally { await ctx.close() }
}

// Mouvement réduit : aucune animation infinie ni longue après chargement (CSS/WAAPI).
async function auditerMouvementReduit(browser, route, chemin) {
  const vp = VIEWPORTS[0]
  const ctx = await nouveauContexte(browser, vp, { reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  try {
    await aller(page, chemin)
    const studio = FORCE || await page.evaluate(() => window.__banc.studio())
    const anims = await page.evaluate(() => window.__banc.animations())
    const trans = await page.evaluate(() => [...document.querySelectorAll('.st-app *')].filter((e) => { const d = getComputedStyle(e).transitionDuration.split(',').map(parseFloat); return Math.max(...d) > 0.12 }).length)
    add(route, vp.nom, 'prefers-reduced-motion', anims.length || trans ? design(studio) : 'ok', anims.length ? 'animations actives : ' + resume(anims, (a) => `${a.cible}${a.infini ? ' ∞' : ' ' + Math.round(a.duree) + 'ms'}`) : trans ? `${trans} éléments avec transition > 120 ms` : '')
  } catch (e) { add(route, vp.nom, 'prefers-reduced-motion', 'fail', 'exception: ' + e.message.split('\n')[0]) } finally { await ctx.close() }
}

// Contraste en temps réel pendant les transitions : clic sur chaque lien de la barre, scan toutes les 50 ms.
async function auditerTransitions(browser, vp) {
  const ctx = await nouveauContexte(browser, vp)
  const page = await ctx.newPage()
  const journal = { erreurs: [] }
  surveiller(page, journal)
  try {
    await aller(page, '/coach/aujourdhui')
    const studio = FORCE || await page.evaluate(() => window.__banc.studio())
    for (const cible of ['/coach/exercices', '/coach/clients', '/coach/aujourdhui', '/coach/seances']) {
      const lien = page.locator(`a[href="${cible}"]:visible`).first()
      if (!(await lien.count())) { add(`transition → ${cible}`, vp.nom, 'contraste en temps réel', 'skip', 'lien de navigation non visible à cette taille'); continue }
      await page.evaluate(() => window.__banc.veille())
      await lien.click()
      await pause(1100)
      const r = await page.evaluate(() => window.__banc.fin())
      add(`transition → ${cible}`, vp.nom, 'contraste en temps réel', r.echecs.length ? design(studio) : 'ok', r.echecs.length ? `pire creux ${r.echecs[0].ratio}:1 sur ${r.echecs.length} textes (${r.n} scans) : ` + resume(r.echecs, (m) => `${m.sel}"${m.texte}" ${m.ratio}<${m.need}`) : `${r.n} scans, aucun creux`)
    }
    add('transitions', vp.nom, 'console sans erreur', journal.erreurs.length ? 'fail' : 'ok', [...new Set(journal.erreurs)].slice(0, 3).join(' | '))
  } catch (e) { add('transitions', vp.nom, 'contraste en temps réel', 'fail', 'exception: ' + e.message.split('\n')[0]) } finally { await ctx.close() }
}

// ---------- CSP : ressources que Studio doit pouvoir afficher ----------
async function auditerCsp(browser) {
  if (DEV) return add('CSP', '-', 'ressources autorisées', 'skip', 'mode --dev')
  const ctx = await nouveauContexte(browser, VIEWPORTS[0])
  const page = await ctx.newPage()
  try {
    await aller(page, '/coach/exercices')
    const viol = await page.evaluate(async () => {
      const ajoute = (el) => { document.body.appendChild(el); return el }
      const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      ajoute(Object.assign(new Image(), { src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }))
      ajoute(Object.assign(new Image(), { src: px }))
      ajoute(Object.assign(new Image(), { src: URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })) }))
      ajoute(Object.assign(document.createElement('iframe'), { src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }))
      ajoute(Object.assign(new Image(), { src: 'https://exemple-interdit.test/x.jpg' })) // témoin : DOIT être bloqué
      await new Promise((r) => setTimeout(r, 1500))
      return window.__banc.csp
    })
    const autorise = (s) => !viol.some((v) => v.includes(s))
    add('CSP', '-', 'miniatures i.ytimg.com', autorise('ytimg') ? 'ok' : 'fail', viol.join(' | '))
    add('CSP', '-', 'iframe youtube-nocookie', autorise('youtube-nocookie') ? 'ok' : 'fail', viol.join(' | '))
    add('CSP', '-', 'images data: et blob:', autorise('data') && autorise('blob') ? 'ok' : 'fail', viol.join(' | '))
    add('CSP', '-', 'témoin : hôte inconnu bloqué', viol.some((v) => v.includes('exemple-interdit')) ? 'ok' : 'fail', 'la CSP doit rester stricte')
  } catch (e) { add('CSP', '-', 'ressources autorisées', 'fail', e.message.split('\n')[0]) } finally { await ctx.close() }
}

// ---------- scénarios métier ----------
// Sélecteurs : Studio d'abord (classes st-… du maquette d3, data-test si présents), repli sur l'ancienne app.
const SEL = {
  carteExo: '[data-test="exercice"], .st-grille [role="button"], .st-grille a, .st-grille button, .st-grille > *, .c-item',
  panneau: '[data-test="panneau"], .st-panneau',
  champNom: '[data-test="exo-nom"], .st-panneau input[type="text"], .st-panneau input:not([type]), .st-panneau input',
  biblio: '[data-test="biblio"] [draggable="true"], .st-ed-biblio [draggable="true"], .st-ed-biblio [role="button"], .st-ed-biblio > * > *',
  zoneSeance: '[data-test="zone-seance"], .st-ed-zone, .st-timeline, .st-ed',
  bloc: '[data-test="bloc"], .st-timeline > *, .st-ed [draggable="true"]'
}

async function scenarioExercice(browser, vp) {
  const ctx = await nouveauContexte(browser, vp)
  const page = await ctx.newPage()
  const journal = { erreurs: [] }
  surveiller(page, journal)
  const T = (c, s, d = '') => add('scénario exercice', vp.nom, c, s, d)
  try {
    await aller(page, '/coach/exercices')
    const studio = FORCE || await page.evaluate(() => window.__banc.studio())
    const attendu = design(studio)
    const cartes = page.locator(SEL.carteExo).filter({ visible: true })
    if (!(await cartes.count())) return T('ouvrir un exercice', attendu, 'aucune carte d’exercice trouvée')
    // vol de vignette : on observe pendant 700 ms les éléments fixes/animés qui apparaissent à l'ouverture
    await page.evaluate(() => {
      window.__vol = false
      const obs = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (/vol|fly|ghost|clone|partag/i.test(n.className?.toString() || '') || getComputedStyle(n).position === 'fixed' && n.querySelector?.('img,svg'))) window.__vol = true })
      obs.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => obs.disconnect(), 1500)
    })
    await page.evaluate(() => window.__banc.veille())
    await cartes.first().click() // vrai clic souris (ou toucher émulé via hasTouch : click reste un clic)
    await pause(1100)
    const creux = await page.evaluate(() => window.__banc.fin())
    const panneau = page.locator(SEL.panneau).first()
    const ouvert = await panneau.isVisible().catch(() => false)
    T('ouvrir un exercice (panneau)', ouvert ? 'ok' : attendu, ouvert ? '' : 'pas de panneau Studio après le clic')
    T('contraste en temps réel (ouverture du panneau)', creux.echecs.length ? attendu : 'ok', creux.echecs.length ? `pire ${creux.echecs[0].ratio}:1 : ` + resume(creux.echecs, (m) => `${m.sel}"${m.texte}" ${m.ratio}<${m.need}`) : `${creux.n} scans`)
    T('vol de la vignette', (await page.evaluate(() => window.__vol)) ? 'ok' : 'warn', 'détection heuristique (élément fixe/clone ajouté pendant l’ouverture) ; à confirmer sur les captures')
    if (ouvert && vp.width < 600) { const w = (await panneau.boundingBox())?.width || 0; T('mobile : feuille plein écran', w >= vp.width - 10 ? 'ok' : 'fail', `largeur ${Math.round(w)} / ${vp.width}`) }
    await page.screenshot({ path: join(OUT, 'captures', `scenario-exercice-panneau-${vp.nom}.png`) })
    if (!ouvert) return

    // modifier le nom → « Enregistré » → rechargement
    const champ = page.locator(SEL.champNom).first()
    const ancien = await champ.inputValue()
    const nouveau = `${ancien.replace(/ ✎\d+$/, '')} ✎${Date.now() % 100000}`
    await champ.click(); await champ.fill(nouveau)
    const enregistre = await page.getByText(/enregistré/i).first().waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)
    T('modifier → « Enregistré »', enregistre ? 'ok' : 'fail', enregistre ? '' : 'indicateur « Enregistré » non vu en 4 s')
    await page.screenshot({ path: join(OUT, 'captures', `scenario-exercice-enregistre-${vp.nom}.png`) })
    await page.reload({ waitUntil: 'load' }); await pause(800)
    T('rechargement : la modification est retrouvée', await page.getByText(nouveau).count() || await page.locator(`input[value="${nouveau}"]`).count() ? 'ok' : 'fail', nouveau)

    // naviguer pendant une sauvegarde : on tape puis on quitte tout de suite
    const carte2 = page.locator(SEL.carteExo).filter({ visible: true }).first()
    await carte2.click(); await pause(700)
    const champ2 = page.locator(SEL.champNom).first()
    const nom3 = `${nouveau.replace(/ ✎\d+$/, '')} ✎${(Date.now() + 7) % 100000}`
    await champ2.click(); await champ2.fill(nom3)
    const lienAutre = page.locator('a[href="/coach/clients"]:visible').first()
    if (await lienAutre.count()) await lienAutre.click({ timeout: 3000 }).catch(() => {}); else await page.goto(BASE + '/coach/clients')
    await pause(1200)
    await aller(page, '/coach/exercices')
    T('naviguer pendant une sauvegarde : rien de perdu', await page.getByText(nom3).count() ? 'ok' : 'fail', nom3)
    T('console sans erreur', journal.erreurs.length ? 'fail' : 'ok', [...new Set(journal.erreurs)].slice(0, 3).join(' | '))
  } catch (e) { T('scénario', 'fail', 'exception: ' + e.message.split('\n')[0]) } finally { await ctx.close() }
}

// Glisser-déposer à la souris réelle (HTML5 DnD ou pointeur : Chromium déclenche les deux avec mouse.down/move/up).
async function glisser(page, source, cible, versHaut = false) {
  const a = await source.boundingBox(), b = await cible.boundingBox()
  if (!a || !b) return false
  const x1 = a.x + a.width / 2, y1 = a.y + a.height / 2
  const x2 = b.x + b.width / 2, y2 = versHaut ? b.y + 4 : b.y + b.height / 2
  await page.mouse.move(x1, y1); await page.mouse.down()
  await page.mouse.move(x1 + 8, y1 + 8, { steps: 4 })
  await page.mouse.move(x2, y2, { steps: 18 })
  await pause(150); await page.mouse.up(); await pause(500)
  return true
}

async function scenarioSeance(browser, vp) {
  const ctx = await nouveauContexte(browser, vp)
  const page = await ctx.newPage()
  const T = (c, s, d = '') => add('scénario séance', vp.nom, c, s, d)
  try {
    await aller(page, '/coach/seances')
    const studio = FORCE || await page.evaluate(() => window.__banc.studio())
    const attendu = design(studio)
    // nouvelle séance (ou ouverture de la première si le bouton n’existe pas)
    const nouvelle = page.getByRole('button', { name: /nouvelle séance|nouveau|créer/i }).or(page.getByRole('link', { name: /nouvelle séance|nouveau|créer/i })).first()
    if (await nouvelle.count()) { await nouvelle.click(); await pause(900) }
    if (!/\/coach\/seances\/[^/]+/.test(page.url())) {
      const lien = page.locator('a[href^="/coach/seances/"]:visible').first()
      if (await lien.count()) { await lien.click(); await pause(900) }
    }
    const enEditeur = /\/coach\/seances\/[^/]+/.test(page.url())
    T('ouvrir l’éditeur de séance', enEditeur ? 'ok' : attendu, page.url().replace(BASE, ''))
    if (!enEditeur) return
    const sources = page.locator(SEL.biblio).filter({ visible: true }), zone = page.locator(SEL.zoneSeance).filter({ visible: true }).first()
    const nSources = await sources.count()
    if (!nSources || !(await zone.count())) return T('créer une séance par glisser-déposer', attendu, 'bibliothèque glissable / zone de séance introuvable (pas encore Studio)')
    const blocs = () => page.locator(SEL.bloc).filter({ visible: true })
    const avant = await blocs().count()
    await glisser(page, sources.nth(0), zone)
    await glisser(page, sources.nth(Math.min(1, nSources - 1)), zone)
    const apres = await blocs().count()
    T('glisser 2 exercices dans la séance', apres >= avant + 2 ? 'ok' : 'fail', `blocs ${avant} → ${apres}`)
    await page.screenshot({ path: join(OUT, 'captures', `scenario-seance-glisse-${vp.nom}.png`) })
    if (apres >= 2) {
      const ordre = async () => (await blocs().allTextContents()).map((t) => t.trim().slice(0, 30))
      const o1 = await ordre()
      await glisser(page, blocs().nth(apres - 1), blocs().nth(0), true)
      const o2 = await ordre()
      T('réordonner par glisser-déposer', JSON.stringify(o1) !== JSON.stringify(o2) ? 'ok' : 'fail', `${o1.join(' | ')}  →  ${o2.join(' | ')}`)
    }
    // affecter à un client
    const select = page.locator('select').filter({ visible: true }).first()
    const btnAff = page.getByRole('button', { name: /affecter|assigner|client/i }).first()
    let affecte = false
    if (await select.count() && (await select.locator('option').count()) > 1) { await select.selectOption({ index: 1 }); affecte = true }
    else if (await btnAff.count()) { await btnAff.click(); await pause(400); const opt = page.getByRole('option').or(page.getByRole('menuitem')).or(page.locator('[role=dialog] button, .st-panneau button')).filter({ visible: true }).first(); if (await opt.count()) { await opt.click(); affecte = true } }
    T('affecter la séance à un client', affecte ? 'ok' : attendu, affecte ? '' : 'aucun sélecteur de client trouvé')
    // persistance
    const url = page.url()
    await pause(1500); await page.reload({ waitUntil: 'load' }); await pause(800)
    T('séance retrouvée après rechargement', (await blocs().count()) >= Math.min(apres, 1) ? 'ok' : 'fail', url.replace(BASE, ''))
  } catch (e) { T('scénario', 'fail', 'exception: ' + e.message.split('\n')[0]) } finally { await ctx.close() }
}

// ---------- liens : aucun lien cassé entre écrans ----------
const LIENS = new Set()
async function auditerLiens(browser) {
  const vp = VIEWPORTS[0]
  const ctx = await nouveauContexte(browser, vp)
  const page = await ctx.newPage()
  const journal = { erreurs: [] }
  surveiller(page, journal)
  const casses = []
  try {
    const liste = [...LIENS].filter((l) => l.startsWith('/coach') && !l.includes('#') && !/^\/coach\/[a-z]+\/:/.test(l)).slice(0, 80)
    for (const l of liste) {
      journal.erreurs.length = 0
      await page.goto(BASE + l, { waitUntil: 'load' }); await pause(450)
      const info = await page.evaluate(() => ({ chemin: location.pathname, texte: document.body.innerText.trim().length, nf: /404|introuvable|page non trouvée/i.test(document.body.innerText.slice(0, 400)) }))
      if (!info.chemin.startsWith('/coach') && !l.startsWith(info.chemin) || info.texte < 15 || info.nf || journal.erreurs.length) casses.push(`${l} → ${info.chemin} (${info.texte} car.${info.nf ? ', 404' : ''}${journal.erreurs.length ? ', ' + journal.erreurs[0].slice(0, 60) : ''})`)
    }
    add('liens', vp.nom, 'aucun lien cassé entre écrans', casses.length ? 'fail' : 'ok', casses.length ? casses.join(' ; ') : `${liste.length} liens /coach/* suivis`)
  } catch (e) { add('liens', vp.nom, 'aucun lien cassé entre écrans', 'fail', e.message.split('\n')[0]) } finally { await ctx.close() }
}

// ---------- identifiants pour les routes à paramètre : pris dans les liens de la page liste ----------
async function trouverIds(browser) {
  const ctx = await nouveauContexte(browser, VIEWPORTS[0])
  const page = await ctx.newPage()
  const ids = {}
  for (const base of ['clients', 'seances', 'programmes', 'questionnaires']) {
    try {
      await aller(page, `/coach/${base}`)
      const liens = await page.evaluate(() => window.__banc.liens())
      const m = liens.find((l) => new RegExp(`^/coach/${base}/[^/?#]+$`).test(l) && !/nouveau|nouvelle/.test(l))
      if (m) ids[base] = m.split('/').pop()
      else { // pas de lien <a> : on clique la première ligne/carte pour lire l'URL
        const el = page.locator('main li, main tr, main [role=button], main .c-item, .st-main [role=button], .st-main li').filter({ visible: true }).first()
        if (await el.count()) { await el.click().catch(() => {}); await pause(600); const mm = new URL(page.url()).pathname.match(new RegExp(`^/coach/${base}/([^/]+)$`)); if (mm) ids[base] = mm[1] }
      }
    } catch {}
  }
  await ctx.close()
  return ids
}

// ---------- rapport ----------
function rapport(duree) {
  const compte = (s) => R.filter((r) => r.status === s).length
  const reels = R.filter((r) => r.status === 'fail'), attendus = R.filter((r) => r.status === 'attendu'), warns = R.filter((r) => r.status === 'warn')
  const ligne = (r) => `| ${r.route} | ${r.vp} | ${r.check} | ${r.detail.replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 400)} |`
  const tete = '| Route | Taille | Contrôle | Détail |\n|---|---|---|---|'
  const md = [
    `# Banc Studio — ${new Date().toLocaleString('fr-FR')}`,
    `Mode : ${DEV ? 'Vite dev (sans CSP)' : 'build servi sous la CSP de production'} · ${BASE} · durée ${Math.round(duree)} s${FORCE ? ' · --force-studio' : ''}${STRICT ? ' · --strict' : ''}`,
    `**Résultat : ${compte('ok')} ok · ${reels.length} échecs réels · ${attendus.length} attendus (pas encore Studio) · ${warns.length} avertissements · ${compte('skip')} ignorés**`,
    '', `## Échecs réels (${reels.length})`, reels.length ? tete + '\n' + reels.map(ligne).join('\n') : 'Aucun.',
    '', `## Attendus : écran pas encore Studio (${attendus.length})`, attendus.length ? tete + '\n' + attendus.map(ligne).join('\n') : 'Aucun.',
    '', `## Avertissements (${warns.length})`, warns.length ? tete + '\n' + warns.map(ligne).join('\n') : 'Aucun.',
    '', `## Tout ce qui passe (${compte('ok')})`, R.filter((r) => r.status === 'ok').map((r) => `- ${r.route} ${r.vp} — ${r.check}${r.detail ? ' (' + r.detail.slice(0, 80) + ')' : ''}`).join('\n'),
    '', 'Captures : `captures/`.'
  ].join('\n')
  writeFileSync(join(OUT, 'RAPPORT.md'), md)
  writeFileSync(join(OUT, 'resultats.json'), JSON.stringify(R, null, 1))
  console.log(`\n${compte('ok')} ok · ${reels.length} échecs réels · ${attendus.length} attendus · ${warns.length} avertissements · rapport : ${join(OUT, 'RAPPORT.md')}`)
  return reels.length + (STRICT ? attendus.length : 0)
}

// ---------- main ----------
const ROUTES = [
  ['aujourdhui', '/coach/aujourdhui'], ['clients', '/coach/clients'], ['clients/:id', '/coach/clients/:id', 'clients'], ['exercices', '/coach/exercices'],
  ['bibliotheque', '/coach/bibliotheque'], ['seances', '/coach/seances'], ['seances/:id', '/coach/seances/:id', 'seances'], ['programmes', '/coach/programmes'],
  ['programmes/:id', '/coach/programmes/:id', 'programmes'], ['questionnaires', '/coach/questionnaires'], ['questionnaires/:id', '/coach/questionnaires/:id', 'questionnaires'],
  ['agenda', '/coach/agenda'], ['reservations', '/coach/reservations'], ['donnees', '/coach/donnees'], ['alertes', '/coach/alertes']
]
const debut = Date.now()
let browser, code = 1
try {
  const pw = await chargerPlaywright()
  const chromium = (pw.chromium || pw.default?.chromium)
  await demarrerServeur()
  browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }))
  const ids = await trouverIds(browser)
  console.log('Identifiants trouvés :', JSON.stringify(ids))
  const routes = ROUTES.filter(([n]) => !ONLY || n.includes(ONLY))
  for (const vp of VIEWPORTS) {
    console.log(`== ${vp.nom}`)
    for (const [nom, modele, base] of routes) {
      if (base && !ids[base]) { add(nom, vp.nom, 'route', 'skip', `aucun ${base} pour fournir un identifiant`); continue }
      await auditerRoute(browser, vp, nom, base ? modele.replace(':id', ids[base]) : modele)
    }
    await auditerTransitions(browser, vp)
  }
  for (const [nom, modele, base] of routes) { if (!base || ids[base]) await auditerMouvementReduit(browser, nom, base ? modele.replace(':id', ids[base]) : modele) }
  await auditerCsp(browser)
  for (const vp of VIEWPORTS) { await scenarioExercice(browser, vp); await scenarioSeance(browser, vp) }
  await auditerLiens(browser)
  code = rapport((Date.now() - debut) / 1000) ? 1 : 0
} catch (e) {
  console.error('Banc en erreur :', e)
  add('banc', '-', 'exécution', 'fail', String(e.message).split('\n')[0])
  try { rapport((Date.now() - debut) / 1000) } catch {}
} finally {
  await browser?.close().catch(() => {})
  arreter()
}
process.exit(code)
