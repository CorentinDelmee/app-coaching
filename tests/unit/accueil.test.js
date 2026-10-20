import { describe, it, expect } from 'vitest'
import { syntheseAccueil } from '../../src/domain/accueil.js'
import { questionnairesDus } from '../../src/domain/questionnairesDus.js'
import { formaterHeure, libelleSeance, moinsDe24h, phraseRang } from '../../src/domain/coaching.js'
import { VERSION_CONSENTEMENT, accesSante, consentementRepondu, patchConsentement } from '../../src/domain/consentement.js'
import { redirection } from '../../src/router/garde.js'
import { markdownVersHtml } from '../../src/domain/markdown.js'
import { validerNouveauCode } from '../../src/domain/identifiants.js'
import { estIOS } from '../../src/lib/installation.js'
import { genererDemo } from '../../src/data/demo/index.js'

const NOW = new Date(2026, 9, 22, 12).getTime() // jeudi 22 octobre 2026
const demo = genererDemo(NOW)
const profil = (id) => demo.profils.find((p) => p.identifiant === id)
const base = (id, extra = {}) => {
  const base0 = profil(id)
  const user = { ...base0, consentementLe: 1, preferences: { ...base0.preferences, consentement: { version: VERSION_CONSENTEMENT, sante: true } } }
  return {
    user, programme: demo.programmes.find((p) => p.clientId === user.id), workouts: demo.workouts.filter((w) => w.clientId === user.id),
    exercices: demo.exercices, template: demo.templates.find((t) => t.id === user.id),
    realisations: demo.realisations.filter((r) => r.clientId === user.id), seancesCoaching: demo.seancesCoaching.filter((s) => s.clientId === user.id),
    questionnaires: demo.questionnaires, reponses: demo.reponses.filter((r) => r.clientId === user.id), now: NOW, ...extra
  }
}

describe('synthèse du tableau de bord', () => {
  it('Fabien : workout du jour, semaine, coaching, programme, pastille', () => {
    const s = syntheseAccueil(base('fabien.vincent'))
    expect(s.prenom).toBe('Fabien')
    expect(s.jour).toBe('Jeudi 22 octobre')
    expect(s.hero).toMatchObject({ etat: 'prevu', etiquette: 'Aujourd\'hui' })
    expect(s.hero.meta[0]).toMatch(/^≈ \d+ min$/)
    expect(s.semaine.total).toBe(3)
    expect(s.coaching).toEqual({ date: 'Sam. 24', mois: 'octobre', heure: '18 h 30', lieu: 'à domicile' })
    expect(s.programme).toMatchObject({ nom: 'Programme Fabien Vincent', numero: 4, total: null })
    expect(s.programme.segments.filter(Boolean)).toHaveLength(4)
    expect(s.questionnaires).toBe(1) // bilan hebdo à faire ; check-in du jour déjà fait
  })
  it('workout fait aujourd\'hui : carte « fait » avec le prochain', () => {
    const b = base('fabien.vincent')
    const w = b.programme.workouts[1]
    const s = syntheseAccueil({ ...b, realisations: [...b.realisations, { clientId: b.user.id, workoutId: w, date: '2026-10-22', dureeSec: 3100 }] })
    expect(s.hero.etat).toBe('fait')
    expect(s.hero.etiquette).toBe('Terminé · 52 min')
    expect(s.hero.meta[0]).toMatch(/^Prochain : /)
  })
  it('semaine bouclée', () => {
    const b = base('fabien.vincent')
    const r = b.programme.workouts.map((w, i) => ({ clientId: b.user.id, workoutId: w, date: `2026-10-${19 + i}`, dureeSec: 1800 }))
    const s = syntheseAccueil({ ...b, realisations: r })
    expect(s.hero.etat).toBe('bouclee')
    expect(s.semaine).toEqual({ faits: 3, total: 3 })
  })
  it('aucune séance de coaching prévue, aucun programme, pas de pastille', () => {
    const t = syntheseAccueil(base('thomas.bernard'))
    expect(t.coaching).toBe(null)
    const sans = syntheseAccueil(base('fabien.vincent', { programme: null, questionnaires: [] }))
    expect(sans.hero.etat).toBe('aucun')
    expect(sans.programme).toBe(null)
    expect(sans.questionnaires).toBe(0)
  })
})

describe('questionnaires à remplir', () => {
  const q = [{ id: 'a', clientId: null, frequence: 'quotidien' }, { id: 'b', clientId: null, frequence: 'hebdo' }, { id: 'c', clientId: null, frequence: 'ponctuel' }, { id: 'd', clientId: 'autre', frequence: 'quotidien' }]
  const rep = (questionnaireId, date) => ({ clientId: 'x', questionnaireId, date })
  it('quotidien / hebdo / ponctuel, et ceux des autres clients ignorés', () => {
    const dus = (reponses) => questionnairesDus({ questionnaires: q, reponses, clientId: 'x', aujourdhui: '2026-10-22' }).map((z) => z.id)
    expect(dus([])).toEqual(['a', 'b', 'c'])
    expect(dus([rep('a', '2026-10-22'), rep('b', '2026-10-19'), rep('c', '2026-01-01')])).toEqual([])
    expect(dus([rep('a', '2026-10-21'), rep('b', '2026-10-18')])).toEqual(['a', 'b', 'c'])
  })
})

describe('page Coaching : libellés', () => {
  it('séance, heure, rang, délai de 24 h', () => {
    const s = { date: '2026-10-27', heure: '18:30', lieu: 'domicile', statut: 'prevue' }
    expect(libelleSeance(s)).toBe('mardi 27 octobre, 18 h 30, à domicile')
    expect(formaterHeure('09:00')).toBe('9 h')
    expect(phraseRang(1)).toBe('C\'est votre 1re séance du mois')
    expect(phraseRang(3)).toBe('C\'est votre 3e séance du mois')
    expect(moinsDe24h({ date: '2026-10-23', heure: '09:00' }, NOW)).toBe(true)
    expect(moinsDe24h({ date: '2026-10-24', heure: '18:30' }, NOW)).toBe(false)
  })
})

describe('consentement', () => {
  const client = { role: 'client', preferences: {} }
  it('répondu seulement à la version courante ; santé seulement si accepté ; le coach passe', () => {
    expect(consentementRepondu(client)).toBe(false)
    const accepte = { ...client, ...patchConsentement(client, true, 5) }
    const refuse = { ...client, ...patchConsentement(client, false, 5) }
    expect(consentementRepondu(accepte)).toBe(true)
    expect(accesSante(accepte)).toBe(true)
    expect(consentementRepondu(refuse)).toBe(true)
    expect(accesSante(refuse)).toBe(false)
    expect(consentementRepondu({ ...accepte, preferences: { consentement: { version: 'ancienne', sante: true } } })).toBe(false)
    expect(consentementRepondu({ role: 'coach' })).toBe(true)
    expect(accesSante(null)).toBe(false)
  })
  it('refus : le tableau de bord ne propose plus de questionnaires', () => {
    const b = base('fabien.vincent')
    const refus = { ...b.user, ...patchConsentement(b.user, false, 1) }
    const s = syntheseAccueil({ ...b, user: refus })
    expect(s.sante).toBe(false)
    expect(s.questionnaires).toBe(0)
  })
})

describe('garde de navigation', () => {
  const client = { role: 'client', ...patchConsentement({ preferences: {} }, true, 1) }
  const coach = { role: 'coach' }
  it('non connecté -> accueil public ; pages publiques ouvertes', () => {
    expect(redirection({ user: null, nom: 'accueil', chemin: '/' })).toBe('/bienvenue')
    expect(redirection({ user: null, nom: 'seance', chemin: '/seance/x' })).toBe('/bienvenue')
    expect(redirection({ user: null, nom: undefined, chemin: '/coach/clients' })).toBe('/bienvenue')
    for (const nom of ['bienvenue', 'connexion', 'confidentialite']) expect(redirection({ user: null, nom, chemin: '/' + nom })).toBe(null)
  })
  it('client : hors /coach, hors pages de connexion, consentement d\'abord', () => {
    expect(redirection({ user: client, nom: undefined, chemin: '/coach/clients' })).toBe('/')
    expect(redirection({ user: client, nom: 'bienvenue', chemin: '/bienvenue' })).toBe('/')
    expect(redirection({ user: client, nom: 'programme', chemin: '/programme' })).toBe(null)
    const neuf = { role: 'client', preferences: {} }
    expect(redirection({ user: neuf, nom: 'accueil', chemin: '/' })).toBe('/consentement')
    expect(redirection({ user: neuf, nom: 'consentement', chemin: '/consentement' })).toBe(null)
    expect(redirection({ user: neuf, nom: 'confidentialite', chemin: '/confidentialite' })).toBe(null)
  })
  it('coach -> /coach', () => {
    expect(redirection({ user: coach, nom: 'accueil', chemin: '/' })).toBe('/coach')
    expect(redirection({ user: coach, nom: undefined, chemin: '/coach/clients' })).toBe(null)
    expect(redirection({ user: coach, nom: 'coaching', chemin: '/coaching' })).toBe('/coach')
  })
})

describe('outils du lot 9', () => {
  it('nouveau code : 8 caractères et confirmation', () => {
    expect(validerNouveauCode('abc', 'abc')).toMatch(/8 caractères/)
    expect(validerNouveauCode('abcdefgh', 'abcdefgi')).toMatch(/confirmation/)
    expect(validerNouveauCode('abcdefgh', 'abcdefgh')).toBe(null)
  })
  it('détection iOS (iPhone, iPad, iPadOS en mode Mac)', () => {
    expect(estIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(estIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(estIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(estIOS('Mozilla/5.0 (Linux; Android 14)')).toBe(false)
  })
  it('markdown : échappe le HTML, titres, listes, tableaux, gras, à compléter', () => {
    const h = markdownVersHtml('## Titre\n\n- un **gras**\n- <script>x</script>\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nSIRET : [À COMPLÉTER]')
    expect(h).toContain('<h2>Titre</h2>')
    expect(h).toContain('<li>un <b>gras</b></li>')
    expect(h).not.toContain('<script>')
    expect(h).toContain('<th>A</th>')
    expect(h).toContain('<td>2</td>')
    expect(h).toContain('<mark>[À COMPLÉTER]</mark>')
  })
})
