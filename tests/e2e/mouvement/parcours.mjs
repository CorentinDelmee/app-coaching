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
    { nom: 'questionnaire → retour liste', tap: 'button[aria-label^="Quitter"], button[aria-label="Fermer"]' },
    { nom: 'liste → retour accueil', tap: RETOUR }
  ] },
  { nom: 'client-programme-vues', role: 'client', depart: '/programme', etapes: [
    { nom: 'vue Mois', tap: (page) => page.locator('button[aria-pressed]').filter({ hasText: 'Mois' }).first() },
    { nom: 'vue Semaine', tap: (page) => page.locator('button[aria-pressed]').filter({ hasText: 'Semaine' }).first() },
    { nom: 'semaine précédente', tap: 'button[aria-label="Semaine précédente"]' },
    { nom: 'revenir à cette semaine', tap: 'button.retour-auj' }
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
    { nom: 'liste → fiche client', tap: 'a.st-clients-carte' },
    ...['Programme', 'Suivi', 'Réponses', 'Rendez-vous', 'Notes privées', 'Réglages', 'Aperçu'].map((o) => ({ nom: `fiche : onglet ${o}`, tap: (page) => page.locator('[role=tab]').filter({ hasText: o }).first() })),
    { nom: 'fiche → retour liste', tap: 'button[aria-label^="Fermer la fiche"]' }
  ] },
  { nom: 'coach-exercice-fiche', role: 'coach', depart: '/coach/exercices', etapes: [
    { nom: 'liste → fiche exercice', tap: '.st-page button.st-carte' },
    { nom: 'fiche → fermer', tap: '#st-calques button[aria-label^="Fermer"]' }
  ] },
  { nom: 'coach-programme-editeur', role: 'coach', depart: '/coach/programmes', etapes: [
    { nom: 'liste → programme', tap: 'a.st-prog-p-lien' },
    { nom: 'programme → retour', tap: 'a.st-prog-p-retour' }
  ] },
  { nom: 'coach-seance-editeur', role: 'coach', depart: '/coach/seances', etapes: [
    { nom: 'liste → séance', tap: 'a.st-prog-l-lien' },
    { nom: 'séance → retour', tap: 'a.st-prog-retour' }
  ] },
  { nom: 'coach-plus-agenda', role: 'coach', depart: '/coach/aujourdhui', etapes: [...plus('Agenda'), { nom: 'Agenda → Aujourd\'hui', tap: onglet('Aujourd') }] },
  { nom: 'coach-plus-questionnaires', role: 'coach', depart: '/coach/aujourdhui', etapes: [
    ...plus('Questionnaires'),
    { nom: 'liste → questionnaire', tap: 'a.st-qs-lien' },
    { nom: 'questionnaire → retour', tap: 'a.st-qs-retour' },
    { nom: 'Questionnaires → Aujourd\'hui', tap: onglet('Aujourd') }
  ] },
  { nom: 'coach-plus-reservations', role: 'coach', depart: '/coach/aujourdhui', etapes: [...plus('Réservations'),
    { nom: 'onglet Passées', tap: (page) => page.locator('button.st-ag-onglet').filter({ hasText: 'Passées' }).first() },
    { nom: 'onglet Règles', tap: (page) => page.locator('button.st-ag-onglet').filter({ hasText: 'Règles' }).first() },
    { nom: 'onglet À venir', tap: (page) => page.locator('button.st-ag-onglet').filter({ hasText: 'À venir' }).first() },
    { nom: 'Réservations → Aujourd\'hui', tap: onglet('Aujourd') }] },
  { nom: 'coach-exercices-filtre', role: 'coach', depart: '/coach/exercices', etapes: [
    { nom: 'filtre Jambes', tap: (page) => page.locator('.st-page button.st-filtre').filter({ hasText: 'Jambes' }).first() },
    { nom: 'filtre Jambes retiré', tap: (page) => page.locator('.st-page button.st-filtre').filter({ hasText: 'Jambes' }).first() }
  ] },
  { nom: 'coach-client-filtre', role: 'coach', depart: '/coach/clients', etapes: [
    { nom: 'filtre À surveiller', tap: (page) => page.locator('.st-page button.st-filtre').filter({ hasText: 'surveiller' }).first() },
    { nom: 'filtre Actifs', tap: (page) => page.locator('.st-page button.st-filtre').filter({ hasText: 'Actifs' }).first() }
  ] },
  { nom: 'coach-plus-seances', role: 'coach', depart: '/coach/aujourdhui', etapes: [...plus('Séances'), { nom: 'Séances → Aujourd\'hui', tap: onglet('Aujourd') }] }
]
