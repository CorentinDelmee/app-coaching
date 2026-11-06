// Conflits d'écriture en vrais clics (mode api) : Claude (outil REST = mêmes outils que le MCP) modifie pendant que l'écran est ouvert.
// Scénario par écran : écran ouvert -> l'outil modifie -> le coach saisit -> « Modifié ailleurs », rien d'écrasé -> Recharger -> la saisie suivante passe.
// Prérequis : serveur de test SQLite sur 5445 (APP_ORIGIN=http://127.0.0.1:5195, compte coach « coach » / code-test-5445, cliente « alice »),
//             Vite en mode api sur 5195 avec proxy /api -> 5445 (VITE_BACKEND=api).
// Lancer : playwright-cli -s=conflits open http://127.0.0.1:5195/ ; playwright-cli -s=conflits resize 1366 690 ;
//          playwright-cli -s=conflits run-code --filename=tests/e2e/studio/conflits-ecrans.js   (puis resize 390 844 et relancer)
async page => {
  const B = 'http://127.0.0.1:5195'
  const CLE = { Authorization: 'Bearer cle-locale-test-0123456789abcdef-012345' }
  const vp = page.viewportSize()
  const tag = `${vp.width}x${vp.height}`
  const SP = 'tests/e2e/studio/captures/'
  const log = []
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  const ok = (cond, msg) => { log.push(`${cond ? 'OK' : 'ÉCHEC'} ${msg}`) }
  // Outils du coach par l'API REST du serveur (5445 en direct : mêmes outils et même service que le serveur MCP).
  const outil = async (nom, args) => {
    const r = await page.request.post(`http://127.0.0.1:5445/api/outils/${nom}`, { headers: CLE, data: args })
    const j = await r.json()
    return j.donnees ?? j
  }
  const lire = async (entite, id) => (await (await page.request.get(`${B}/api/app/e/${entite}/${id}`)).json()).item
  const bandeau = page.locator('.st-sauve.is-conflit')

  await page.request.post(`${B}/api/app/connexion`, { headers: { Origin: B }, data: { identifiant: 'coach', code: 'code-test-5445' } })

  // ---------------- Séance
  const { seance } = await outil('creer_seance', { client: 'alice', nom: `Séance ${tag}`, blocs: [{ exercice: { nom: 'Squat', reps: 8 } }] })
  await page.goto(`${B}/coach/seances/${seance.id}`)
  await page.waitForSelector('#st-prog-s-nom')
  await page.waitForTimeout(600)
  await outil('ajouter_exercice', { seanceId: seance.id, exercice: { nom: 'Fente', reps: 10 } }) // Claude, pendant que l'écran est ouvert
  await page.click('#st-prog-s-nom')
  await page.fill('#st-prog-s-nom', `Séance ${tag} (coach)`)
  await bandeau.waitFor({ timeout: 5000 }).catch(() => {})
  ok(await bandeau.isVisible(), 'séance : bandeau « Modifié ailleurs » affiché')
  ok((await bandeau.textContent()).includes(`Séance ${tag} (coach)`), 'séance : la dernière saisie est montrée')
  let w = await lire('workouts', seance.id)
  ok(w.blocs.length === 2 && w.nom === `Séance ${tag}`, `séance : rien d'écrasé (blocs ${w.blocs.length}, nom « ${w.nom} »)`)
  await page.screenshot({ path: `${SP}seance-conflit-${tag}.png` })
  await bandeau.getByRole('button', { name: 'Recharger' }).click()
  await page.waitForTimeout(400)
  ok(await page.inputValue('#st-prog-s-nom') === `Séance ${tag}`, 'séance : Recharger remet le nom enregistré')
  await page.fill('#st-prog-s-nom', `Séance ${tag} v2`)
  await page.locator('.st-sauve.is-ok').waitFor({ timeout: 5000 }).catch(() => {})
  w = await lire('workouts', seance.id)
  ok(w.nom === `Séance ${tag} v2` && w.blocs.length === 2, `séance : après Recharger la saisie passe, l'exercice de Claude reste (blocs ${w.blocs.length})`)
  await page.screenshot({ path: `${SP}seance-apres-${tag}.png` })

  // ---------------- Fiche client (réglages)
  const avant = await lire('profils', 'alice')
  await page.goto(`${B}/coach/clients/alice?onglet=reglages`)
  const nom = page.getByLabel('Nom', { exact: true })
  await nom.waitFor()
  await page.waitForTimeout(800)
  await outil('modifier_client', { client: 'alice', tarif: avant.tarif + 5 }) // Claude change le tarif
  await nom.click()
  await nom.fill('Alice Durand-Martin')
  await bandeau.waitFor({ timeout: 5000 }).catch(() => {})
  ok(await bandeau.isVisible(), 'fiche : bandeau « Modifié ailleurs » affiché')
  let p = await lire('profils', 'alice')
  ok(p.tarif === avant.tarif + 5 && p.nom === 'Alice Durand', `fiche : rien d'écrasé (tarif ${p.tarif}, nom « ${p.nom} »)`)
  await page.screenshot({ path: `${SP}fiche-conflit-${tag}.png` })
  await bandeau.getByRole('button', { name: 'Recharger' }).click()
  await page.waitForTimeout(400)
  ok(Number(await page.getByLabel('Tarif (€)').inputValue()) === avant.tarif + 5, 'fiche : Recharger affiche le tarif de Claude')
  await nom.fill('Alice Durand-Martin')
  await page.locator('.st-sauve.is-ok').waitFor({ timeout: 5000 }).catch(() => {})
  p = await lire('profils', 'alice')
  ok(p.nom === 'Alice Durand-Martin' && p.tarif === avant.tarif + 5, `fiche : après Recharger la saisie passe (nom « ${p.nom} », tarif ${p.tarif})`)
  await page.screenshot({ path: `${SP}fiche-apres-${tag}.png` })
  await outil('modifier_client', { client: 'alice', nom: 'Alice Durand' }) // remise en état pour le passage suivant

  // Même scénario, écrit une fois pour les éditeurs à un champ « nom » (programme, questionnaire).
  async function scenarioNom(ecran, url, champ, entite, id, modifierParClaude, nomEnBase) {
    await page.goto(url)
    await champ.waitFor()
    await page.waitForTimeout(800)
    await modifierParClaude()
    await champ.fill(`${ecran} coach ${tag}`)
    await bandeau.waitFor({ timeout: 5000 }).catch(() => {})
    ok(await bandeau.isVisible(), `${ecran} : bandeau « Modifié ailleurs » affiché`)
    let o = await lire(entite, id)
    ok(o.nom === nomEnBase, `${ecran} : rien d'écrasé (nom « ${o.nom} »)`)
    await page.screenshot({ path: `${SP}${ecran}-conflit-${tag}.png` })
    await bandeau.getByRole('button', { name: 'Recharger' }).click()
    await page.waitForTimeout(400)
    ok(await champ.inputValue() === nomEnBase, `${ecran} : Recharger affiche la version de Claude`)
    await champ.fill(`${ecran} v2 ${tag}`)
    await page.locator('.st-sauve.is-ok').waitFor({ timeout: 5000 }).catch(() => {})
    o = await lire(entite, id)
    ok(o.nom === `${ecran} v2 ${tag}`, `${ecran} : après Recharger la saisie passe (« ${o.nom} »)`)
  }

  // ---------------- Programme
  const prog = await outil('creer_programme', { client: 'alice', nom: `Prépa ${tag}`, debut: '2026-11-02', semaines: [{ seances: [{ nom: 'S1', blocs: [{ exercice: { nom: 'Squat', reps: 5 } }] }] }] })
  await scenarioNom('programme', `${B}/coach/programmes/${prog.id}`, page.getByLabel('Nom du programme'), 'programmes', prog.id,
    () => outil('modifier_programme', { programme: prog.id, nom: `Prépa Claude ${tag}` }), `Prépa Claude ${tag}`)

  // ---------------- Questionnaire
  const qn = await outil('creer_questionnaire', { nom: `Bilan ${tag}`, frequence: 'ponctuel', questions: [{ libelle: 'Forme ?', type: 'curseur' }] })
  await scenarioNom('questionnaire', `${B}/coach/questionnaires/${qn.id}`, page.locator('.st-qs-titre-input'), 'questionnaires', qn.id,
    () => outil('modifier_questionnaire', { id: qn.id, nom: `Bilan Claude ${tag}` }), `Bilan Claude ${tag}`)

  // ---------------- Exercice (fiche : seuls les champs touchés partent)
  const detail = async () => (await (await page.request.get(`${B}/api/app/exercices/ex-squat`)).json()).item
  const cons = page.locator('#st-exo-cons')
  await page.goto(`${B}/coach/exercices?ex=ex-squat`)
  await cons.waitFor()
  await page.waitForTimeout(800)
  // a) Claude change un AUTRE champ : pas de bandeau, les deux changements sont gardés
  await outil('modifier_exercice', { exercice: 'ex-squat', tempo: `2-0-${vp.width % 7}` })
  await cons.fill(`Talons au sol ${tag}`)
  await page.waitForTimeout(2000)
  let e = await detail()
  ok(!(await bandeau.isVisible()) && e.consignes === `Talons au sol ${tag}` && e.tempo === `2-0-${vp.width % 7}`, `exercice : autre champ changé par Claude -> fusion sans bandeau (consignes « ${e.consignes} », tempo ${e.tempo})`)
  // b) Claude change le MÊME champ : bandeau, rien d'écrasé, Recharger, puis la saisie passe
  await outil('modifier_exercice', { exercice: 'ex-squat', consignes: `Genoux dehors (Claude) ${tag}` })
  await cons.fill(`Dos droit ${tag}`)
  await bandeau.waitFor({ timeout: 5000 }).catch(() => {})
  ok(await bandeau.isVisible(), 'exercice : même champ changé -> bandeau « Modifié ailleurs »')
  e = await detail()
  ok(e.consignes === `Genoux dehors (Claude) ${tag}`, `exercice : rien d'écrasé (« ${e.consignes} »)`)
  await page.screenshot({ path: `${SP}exercice-conflit-${tag}.png` })
  await bandeau.getByRole('button', { name: 'Recharger' }).click()
  await page.waitForTimeout(400)
  ok(await cons.inputValue() === `Genoux dehors (Claude) ${tag}`, 'exercice : Recharger affiche la version de Claude')
  await cons.fill(`Dos droit v2 ${tag}`)
  await page.waitForTimeout(2000)
  e = await detail()
  ok(e.consignes === `Dos droit v2 ${tag}` && !(await bandeau.isVisible()), `exercice : après Recharger la saisie passe (« ${e.consignes} »)`)

  if (errs.length) log.push(`erreurs page : ${errs.join(' / ')}`)
  return log.join(' || ')
}
