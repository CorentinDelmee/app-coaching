// Parcours en vrais clics (playwright-cli run-code) : Agenda coach (synchro, à attribuer, 503), fiche client, accueil client.
async page => {
  const B = 'http://127.0.0.1:5472'
  const vp = page.viewportSize()
  const tag = `${vp.width}x${vp.height}`
  const SP = 'docs/captures-agenda-google/' // relatif au dossier du projet (lancer playwright-cli depuis la racine)
  const log = []
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  const ok = (cond, msg) => log.push(`${cond ? 'OK' : 'ÉCHEC'} ${msg}`)
  const connecter = async (id) => {
    await page.request.post(`${B}/api/app/deconnexion`, { headers: { Origin: B } })
    const r = await page.request.post(`${B}/api/app/connexion`, { headers: { Origin: B }, data: { identifiant: id, code: 'code-test-5471' } })
    ok(r.status() === 200, `connexion ${id}`)
  }
  const seances = async (clientId) => (await (await page.request.get(`${B}/api/app/e/seancesCoaching`)).json()).items.filter((s) => !clientId || s.clientId === clientId)

  // ---------- Agenda coach
  await connecter('coach')
  await page.goto(`${B}/coach/agenda`)
  await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Synchroniser' }).click()
  const statut = page.locator('.st-ag-msg--ok')
  await statut.waitFor({ timeout: 8000 })
  const txt = await statut.textContent()
  ok(/coachings lus/.test(txt), `bilan affiché : « ${txt.trim()} »`)
  const groupe = page.locator('[data-testid="a-attribuer"] li', { hasText: 'Coaching Denis' })
  if (await groupe.count()) {
    ok(true, 'à attribuer : « Coaching Denis » (prénom partagé) listé')
    ok((await groupe.locator('.st-ag-case').count()) === 2, 'à attribuer : 2 candidats proposés')
    await page.screenshot({ path: `${SP}agenda-a-attribuer-${tag}.jpg`, type: 'jpeg', quality: 70 })
    await groupe.locator('.st-ag-case', { hasText: 'Denis Leroy' }).click()
    await groupe.getByRole('button', { name: 'Attribuer' }).click()
    await page.locator('.st-ag-msg--ok', { hasText: 'attribué' }).waitFor({ timeout: 8000 })
    ok((await seances('denis')).length === 2, 'attribuer : 2 séances créées pour Denis Leroy (passée + à venir)')
    ok((await seances('denism')).length === 0, 'attribuer : rien pour l\'autre Denis')
  } else ok((await seances('denis')).length === 2, 'déjà attribué au passage précédent : 2 séances pour Denis Leroy')
  await page.locator('.st-ag-ok', { hasText: 'Tous les événements' }).waitFor({ timeout: 5000 })
  ok(true, 'plus rien à attribuer')
  const nbAvant = (await seances()).length
  await page.getByRole('button', { name: 'Synchroniser' }).click()
  await page.locator('.st-ag-msg--ok', { hasText: 'rien de nouveau' }).waitFor({ timeout: 8000 })
  ok((await seances()).length === nbAvant, `2e synchro : rien de nouveau (${nbAvant} séances)`)
  await page.screenshot({ path: `${SP}agenda-attribue-${tag}.jpg`, type: 'jpeg', quality: 70 })

  // 503 : autorisation Google à renouveler, rien supprimé
  await page.request.get(`${B}/__test/503?v=1`)
  await page.getByRole('button', { name: 'Synchroniser' }).click()
  await page.locator('[data-testid="autorisation-google"]').waitFor({ timeout: 8000 })
  ok((await page.locator('[data-testid="autorisation-google"]').textContent()).includes('Autorisation Google à renouveler'), '503 : message « Autorisation Google à renouveler »')
  ok((await seances()).length === nbAvant, '503 : rien supprimé')
  await page.screenshot({ path: `${SP}agenda-503-${tag}.jpg`, type: 'jpeg', quality: 70 })
  await page.request.get(`${B}/__test/503?v=0`)
  await page.getByRole('button', { name: 'Synchroniser' }).click()
  await page.locator('[data-testid="autorisation-google"]').waitFor({ state: 'detached', timeout: 8000 })
  ok(true, '503 levé après une synchro réussie')

  // ---------- Fiche client : coachings passés et à venir, sans doublon
  await page.goto(`${B}/coach/clients/fabien?onglet=coaching`)
  const lignes = page.locator('.st-clients-lignes').first().locator('li')
  await lignes.first().waitFor()
  const n = await lignes.count()
  const google = await page.locator('.st-clients-lignes li', { hasText: 'Google Agenda' }).count()
  ok(n === 4 && google === 3, `fiche Fabien : 4 rendez-vous (2 passés Google, 1 saisi à la main = jumeau Google, 1 à venir Google) : ${n} lignes, ${google} Google`)
  ok((await page.locator('.st-clients-lignes li select').nth(n - 1).inputValue()) === 'faite', 'fiche Fabien : le plus ancien (22 sept.) est « faite »')
  await lignes.first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SP}fiche-fabien-${tag}.jpg`, type: 'jpeg', quality: 70 })
  await page.goto(`${B}/coach/clients/christine?onglet=coaching`)
  await page.locator('.st-clients-lignes li').first().waitFor()
  ok((await page.locator('.st-clients-lignes li').count()) === 3, 'fiche Christine : 3 coachings (« Christine et Didier » ×2 passés, « Didier Christine » à venir)')

  // ---------- Client : prochain coaching sur l'accueil, une seule fois
  await connecter('fabien')
  await page.goto(`${B}/`)
  const carte = page.locator('.c-coaching')
  await carte.waitFor({ timeout: 10000 })
  const c = (await carte.innerText()).replace(/\s+/g, ' ')
  ok(/19/.test(c) && /18/.test(c), `accueil client : prochain coaching « ${c} »`)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SP}accueil-client-${tag}.jpg`, type: 'jpeg', quality: 70 })
  const mes = await seances('fabien')
  ok(mes.filter((s) => s.date === '2026-11-19').length === 1, 'client : le 19/11 n\'existe qu\'une fois dans ses séances')
  await page.goto(`${B}/coaching`)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SP}coaching-client-${tag}.jpg`, type: 'jpeg', quality: 70 })
  ok(!(await page.locator('body').innerText()).includes('Coaching Fabien'), 'client : aucun titre d\'agenda brut affiché')
  const debord = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  ok(!debord, 'pas de défilement horizontal')
  await connecter('coach')
  return [...log, ...errs.map((e) => `ERREUR CONSOLE ${e}`)].join('\n')
}
