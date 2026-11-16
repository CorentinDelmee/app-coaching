// Parcours mesurés par micro-sauts.mjs. Chaque parcours est une BOUCLE (il revient à son point de départ) : la variante
// « cache plein » le joue une fois sans mesure, puis une fois mesurée ; la variante « cache vide » recharge la page de départ
// (le cache des lectures est en mémoire) puis mesure directement.
// Étape : { nom, tap: sélecteur CSS (premier visible) | fonction (page) => locator, apres?: ms d'attente avant mesure suivante }.

export const RETOUR = 'button[aria-label="Retour"]'

// ---------- sessions démo (adaptateur local) ----------
const CLE = 'cdc-coaching/1'

/** Amorce les données de démo une fois dans ce contexte, puis ouvre la session `quoi`. */
export async function ouvrirSession(page, base, quoi) {
  await page.goto(base + '/bienvenue', { waitUntil: 'load' })
  if (await page.evaluate((c) => !localStorage.getItem(c), CLE)) {
    await page.evaluate((c) => localStorage.setItem(c + ':session', 'amorce'), CLE)
    await page.goto(base + '/', { waitUntil: 'load' })
    await page.waitForFunction((c) => !!localStorage.getItem(c), CLE, { timeout: 10000 })
  }
  if (quoi === 'coach') {
    await page.evaluate((c) => localStorage.setItem(c + ':session', 'coach-corentin'), CLE)
    return
  }
  // Client : Fabien, dans la situation du retour de Corentin (une séance « Aujourd'hui » à faire, 5 séances dans la semaine).
  // Modifie seulement les données de démo de CE navigateur (localStorage du contexte de test).
  await page.evaluate(({ c }) => {
    const s = JSON.parse(localStorage.getItem(c))
    const p = s.profils.find((x) => x.identifiant === 'fabien.vincent')
    p.consentementLe = Date.now()
    p.preferences = { ...p.preferences, consentement: { version: '2026-10-v1', sante: true } }
    const z = (n) => String(n).padStart(2, '0')
    const d = new Date(); const auj = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
    s.realisations = s.realisations.filter((r) => !(r.clientId === p.id && r.date === auj))
    const w1 = s.workouts.find((w) => w.id === 'w-fabien-1')
    if (w1) w1.nom = 'Lundi — Haut du corps (force)'
    const prog = s.programmes.find((x) => x.clientId === p.id)
    for (const [id, src, nom] of [['w-fabien-4', 'w-fabien-2', 'Jeudi — Bas du corps (volume)'], ['w-fabien-5', 'w-fabien-3', 'Samedi — Full body']]) {
      if (!s.workouts.some((w) => w.id === id)) s.workouts.push({ ...structuredClone(s.workouts.find((w) => w.id === src)), id, nom })
      if (prog && !prog.workouts.includes(id)) prog.workouts.push(id)
    }
    localStorage.setItem(c, JSON.stringify(s))
    localStorage.setItem(c + ':session', p.id)
  }, { c: CLE })
}

export async function poserLatence(page, ms) {
  await page.evaluate(({ c, ms }) => { if (ms) localStorage.setItem(c + ':latence', String(ms)); else localStorage.removeItem(c + ':latence') }, { c: CLE, ms })
}

// ---------- parcours ----------
const onglet = (texte) => (page) => page.locator('.st-tabbar a, .st-tabbar button').filter({ hasText: texte }).filter({ visible: true }).first()
const plus = (texte) => [
  { nom: 'ouvrir Plus', tap: (page) => page.locator('.st-tabbar button').filter({ hasText: 'Plus' }).first() },
  { nom: `Plus → ${texte}`, tap: (page) => page.locator('#st-feuille-plus a').filter({ hasText: texte }).first() }
]
const menu = (texte) => [
  { nom: 'ouvrir le menu', tap: '.ecran [data-nav]' },
  { nom: `menu → ${texte}`, tap: (page) => page.locator('.m-item').filter({ hasText: texte }).filter({ visible: true }).first() }
]

export const PARCOURS = [
  // --- client : l'exemple de Corentin d'abord
  { nom: 'client-accueil-workout', role: 'client', depart: '/', etapes: [
    { nom: 'Aujourd\'hui → workout', tap: '.c-aujourdhui' },
    { nom: 'workout → retour accueil', tap: RETOUR }
  ] },
  { nom: 'client-accueil-programme', role: 'client', depart: '/', etapes: [
    { nom: 'Cette semaine → programme', tap: '.c-semaine' },
    { nom: 'programme → retour', tap: RETOUR }
  ] },
  { nom: 'client-programme-workout', role: 'client', depart: '/programme', etapes: [
    { nom: 'programme → workout', tap: '.ligne-w.cliquable' },
    { nom: 'workout → retour programme', tap: RETOUR }
  ] },
  { nom: 'client-accueil-coaching', role: 'client', depart: '/', etapes: [
    { nom: 'Coaching → page', tap: '.c-coaching' },
    { nom: 'coaching → retour', tap: RETOUR }
  ] },
  { nom: 'client-accueil-questionnaires', role: 'client', depart: '/', etapes: [
    { nom: 'Questionnaires → liste', tap: '.c-quest' },
    { nom: 'liste → questionnaire', tap: (page) => page.locator('main button.cliquable, main .q-ligne, main li button').filter({ visible: true }).first() },
    { nom: 'questionnaire → retour liste', tap: RETOUR },
    { nom: 'liste → retour accueil', tap: RETOUR }
  ] },
  { nom: 'client-menu-suivi', role: 'client', depart: '/', etapes: [...menu('Suivi'), { nom: 'suivi → retour', tap: RETOUR }] },
  { nom: 'client-menu-profil', role: 'client', depart: '/', etapes: [...menu('Profil'), { nom: 'profil → retour', tap: RETOUR }] },
  { nom: 'client-menu-programme', role: 'client', depart: '/', etapes: [...menu('programme'), { nom: 'programme → retour', tap: RETOUR }] },

  // --- coach : onglets du bas (téléphone), dans les deux sens
  { nom: 'coach-onglets', role: 'coach', depart: '/coach/aujourdhui', etapes: [
    { nom: 'Aujourd\'hui → Clients', tap: onglet('Clients') },
    { nom: 'Clients → Exercices', tap: onglet('Exercices') },
    { nom: 'Exercices → Programmes', tap: onglet('Programmes') },
    { nom: 'Programmes → Aujourd\'hui', tap: onglet('Aujourd') }
  ] },
  { nom: 'coach-client-fiche', role: 'coach', depart: '/coach/clients', etapes: [
    { nom: 'liste → fiche client', tap: (page) => page.locator('.st-page [data-client], .st-page .cl-ligne, .st-page li button, .st-page button.cl-carte').filter({ visible: true }).first() },
    { nom: 'fiche : onglet 2', tap: (page) => page.locator('[role=tab]').filter({ visible: true }).nth(1) },
    { nom: 'fiche : onglet 3', tap: (page) => page.locator('[role=tab]').filter({ visible: true }).nth(2) },
    { nom: 'fiche : onglet 1', tap: (page) => page.locator('[role=tab]').filter({ visible: true }).nth(0) },
    { nom: 'fiche → retour liste', tap: (page) => page.locator('button[aria-label^="Retour"], button[aria-label="Fermer"], button[aria-label^="Fermer"]').filter({ visible: true }).first() }
  ] },
  { nom: 'coach-exercice-fiche', role: 'coach', depart: '/coach/exercices', etapes: [
    { nom: 'liste → fiche exercice', tap: (page) => page.locator('.st-page .st-vignette, .st-page [data-exercice], .st-page article button').filter({ visible: true }).first() },
    { nom: 'fiche → fermer', tap: (page) => page.locator('button[aria-label^="Fermer"], button[aria-label^="Retour"]').filter({ visible: true }).first() }
  ] },
  { nom: 'coach-programme-editeur', role: 'coach', depart: '/coach/programmes', etapes: [
    { nom: 'liste → programme', tap: (page) => page.locator('.st-page a[href^="/coach/programmes/"], .st-page [data-programme]').filter({ visible: true }).first() },
    { nom: 'programme → retour', tap: (page) => page.locator('a[href="/coach/programmes"], button[aria-label^="Retour"]').filter({ visible: true }).first() }
  ] },
  { nom: 'coach-seance-editeur', role: 'coach', depart: '/coach/seances', etapes: [
    { nom: 'liste → séance', tap: (page) => page.locator('.st-page a[href^="/coach/seances/"], .st-page [data-seance]').filter({ visible: true }).first() },
    { nom: 'séance → retour', tap: (page) => page.locator('a[href="/coach/seances"], button[aria-label^="Retour"]').filter({ visible: true }).first() }
  ] },
  { nom: 'coach-plus-agenda', role: 'coach', depart: '/coach/aujourdhui', etapes: [...plus('Agenda'), { nom: 'Agenda → Aujourd\'hui', tap: onglet('Aujourd') }] },
  { nom: 'coach-plus-questionnaires', role: 'coach', depart: '/coach/aujourdhui', etapes: [
    ...plus('Questionnaires'),
    { nom: 'liste → questionnaire', tap: (page) => page.locator('.st-page a[href^="/coach/questionnaires/"], .st-page [data-questionnaire]').filter({ visible: true }).first() },
    { nom: 'questionnaire → retour', tap: (page) => page.locator('a[href="/coach/questionnaires"], button[aria-label^="Retour"]').filter({ visible: true }).first() },
    { nom: 'Questionnaires → Aujourd\'hui', tap: onglet('Aujourd') }
  ] },
  { nom: 'coach-plus-reservations', role: 'coach', depart: '/coach/aujourdhui', etapes: [...plus('Réservations'), { nom: 'Réservations → Aujourd\'hui', tap: onglet('Aujourd') }] },
  { nom: 'coach-plus-seances', role: 'coach', depart: '/coach/aujourdhui', etapes: [...plus('Séances'), { nom: 'Séances → Aujourd\'hui', tap: onglet('Aujourd') }] }
]
