import { describe, it, expect } from 'vitest'
import { echelleNice, construireCourbe, dateCourte, pasRond } from '../../src/domain/graphique.js'
import {
  seriesDisponibles, pointsSerie, filtrerPeriode, resumeSerie, nomsHabitudes, semaineHabitude, serieHabitude, pointsCalories,
  repasDuJour, repasPrecedents, modulesActifs, aUnModule, idHabitude, libelleSerie
} from '../../src/domain/suivi.js'
import { ZONES, zonesDeVue, cheminForme, historiqueZone, derniereNote, intensiteCarte, zonesActives, libelleZone, teinteIntensite } from '../../src/domain/corps.js'
import { configNombre } from '../../src/domain/questionnaireUi.js'

const AUJ = '2026-10-20'
const EAU = "Boire 2 L d'eau"

describe('échelle et courbe', () => {
  it('graduations rondes', () => {
    expect(pasRond(2.4, 3)).toBe(1)
    expect(echelleNice(80.6, 82.4)).toMatchObject({ min: 80, max: 83 })
    expect(echelleNice(81, 81)).toMatchObject({ min: 80, max: 82 })
    const e = echelleNice(1700, 2300)
    expect(e.ticks[0]).toBeLessThanOrEqual(1700)
    expect(e.ticks[e.ticks.length - 1]).toBeGreaterThanOrEqual(2300)
  })
  it("un seul point : centré, pas de tracé d'aire", () => {
    const c = construireCourbe([{ date: AUJ, valeur: 80 }])
    expect(c.pts).toHaveLength(1)
    expect(c.pts[0].x).toBe((c.zone.x0 + c.zone.x1) / 2)
    expect(c.aire).toBe('')
    expect(c.ticksX).toHaveLength(1)
  })
  it("les x suivent l'écart réel des dates, les y restent dans la zone", () => {
    const c = construireCourbe([{ date: '2026-10-01', valeur: 82 }, { date: '2026-10-02', valeur: 81 }, { date: '2026-10-11', valeur: 80 }])
    expect(c.pts[0].x).toBe(c.zone.x0)
    expect(c.pts[2].x).toBe(c.zone.x1)
    expect(c.pts[1].x - c.pts[0].x).toBeLessThan((c.pts[2].x - c.pts[1].x) / 5)
    for (const p of c.pts) { expect(p.y).toBeGreaterThanOrEqual(c.zone.y0); expect(p.y).toBeLessThanOrEqual(c.zone.y1) }
    expect(c.chemin.startsWith('M')).toBe(true)
  })
  it('domaine imposé (douleur 0-10)', () => {
    const c = construireCourbe([{ date: '2026-10-01', valeur: 0 }, { date: '2026-10-03', valeur: 10 }], { domaine: [0, 10] })
    expect(c.pts[0].y).toBe(c.zone.y1)
    expect(c.pts[1].y).toBe(c.zone.y0)
  })
  it('date courte', () => expect(dateCourte('2026-10-05')).toBe('5 oct.'))
})

describe('mesures', () => {
  const mesures = [
    { id: 'a', date: '2026-09-01', poids: 83 }, { id: 'b', date: '2026-10-06', poids: 82, mensurations: { tourDeTaille: 90 } },
    { id: 'c', date: '2026-10-19', poids: 81.5, mensurations: { tourDeTaille: 89, tourDeBras: 35 } }
  ]
  it('séries : poids puis taille puis le reste', () => {
    expect(seriesDisponibles(mesures).map((s) => s.id)).toEqual(['poids', 'tourDeTaille', 'tourDeBras'])
    expect(seriesDisponibles([]).map((s) => s.id)).toEqual(['poids'])
    expect(libelleSerie('tourDeBras')).toBe('Bras')
  })
  it('points triés, périodes, résumé', () => {
    const p = pointsSerie(mesures, 'poids')
    expect(p.map((x) => x.valeur)).toEqual([83, 82, 81.5])
    expect(filtrerPeriode(p, '4s', AUJ)).toHaveLength(2)
    expect(filtrerPeriode(p, '1a', AUJ)).toHaveLength(3)
    expect(filtrerPeriode(p, 'tout', AUJ)).toHaveLength(3)
    expect(resumeSerie(filtrerPeriode(p, '4s', AUJ))).toMatchObject({ derniere: 81.5, variation: -0.5 })
    expect(resumeSerie([p[0]]).variation).toBeNull()
    expect(resumeSerie([])).toBeNull()
    expect(pointsSerie(mesures, 'tourDeTaille')).toHaveLength(2)
  })
})

describe('nutrition', () => {
  const h = (jour, fait, nom = EAU) => ({ id: idHabitude('c', jour, nom), clientId: 'c', date: jour, type: 'habitude', valeur: { nom, fait } })
  it("séries d'habitude", () => {
    const e = [h('2026-10-18', true), h('2026-10-19', true), h('2026-10-20', false)]
    expect(serieHabitude(e, EAU, AUJ)).toBe(2) // aujourd'hui pas encore coché : on compte depuis hier
    expect(serieHabitude([h('2026-10-18', true), h('2026-10-19', true), h('2026-10-20', true)], EAU, AUJ)).toBe(3)
    const sem = semaineHabitude(e, EAU, AUJ)
    expect(sem).toHaveLength(7)
    expect(sem.map((s) => s.fait)).toEqual([false, false, false, false, true, true, false])
  })
  it('habitudes par défaut + celles déjà cochées ; ids stables', () => {
    expect(nomsHabitudes([h('2026-10-20', true, 'Marcher 8000 pas')])).toContain('Marcher 8000 pas')
    expect(idHabitude('c', AUJ, EAU)).toBe('nut-c-2026-10-20-h-boire-2-l-d-eau')
  })
  it('calories sur 14 jours, repas du jour et précédents', () => {
    const e = [
      { id: '1', date: '2026-10-01', type: 'calories', valeur: { kcal: 2000 } }, { id: '2', date: '2026-10-19', type: 'calories', valeur: { kcal: 1850 } },
      { id: '3', date: AUJ, type: 'repas', valeur: { repas: 'Déjeuner', photo: 'data:x' } }, { id: '4', date: '2026-10-18', type: 'repas', valeur: { repas: 'Dîner', photo: 'data:y' } }
    ]
    expect(pointsCalories(e, AUJ)).toEqual([{ date: '2026-10-19', valeur: 1850 }])
    expect(repasDuJour(e, 'Déjeuner', AUJ).id).toBe('3')
    expect(repasDuJour(e, 'Dîner', AUJ)).toBeNull()
    expect(repasPrecedents(e, AUJ).map((x) => x.id)).toEqual(['4'])
  })
  it('modules désactivés = absents', () => {
    expect(modulesActifs({ modules: { habitudes: true } })).toEqual({ habitudes: true, photosRepas: false, calories: false })
    expect(aUnModule({ modules: { habitudes: false, photosRepas: false, calories: false } })).toBe(false)
    expect(aUnModule({})).toBe(false)
  })
})

describe('carte du corps', () => {
  it('ids uniques, formes dans la carte', () => {
    const ids = ZONES.map((z) => z.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const vue of ['face', 'dos']) {
      expect(zonesDeVue(vue).length).toBeGreaterThan(15)
      for (const z of zonesDeVue(vue)) expect(cheminForme(z.formes[vue])).toMatch(/^M[\d.]/)
    }
    for (const id of ['epaule-droite', 'genou-gauche']) expect(ids).toContain(id) // zones des données de démonstration
  })
  it("droite à gauche de l'écran en face, à droite en dos", () => {
    const x = (id, vue) => { const f = ZONES.find((z) => z.id === id).formes[vue]; return f.t === 'rect' ? f.x + f.w / 2 : f.cx }
    expect(x('epaule-droite', 'face')).toBeLessThan(100)
    expect(x('epaule-droite', 'dos')).toBeGreaterThan(100)
    expect(x('bras-gauche', 'face')).toBeGreaterThan(100)
  })
  it("historique, dernière note, fenêtre récente", () => {
    const d = [
      { zone: 'genou-gauche', intensite: 2, date: '2026-10-01' }, { zone: 'genou-gauche', intensite: 5, date: '2026-10-10' },
      { zone: 'genou-gauche', intensite: 6, date: '2026-10-10' }, { zone: 'epaule-droite', intensite: 4, date: '2026-10-18' }
    ]
    expect(historiqueZone(d, 'genou-gauche')).toEqual([{ date: '2026-10-01', valeur: 2 }, { date: '2026-10-10', valeur: 6 }])
    expect(derniereNote(d, 'genou-gauche', AUJ)).toMatchObject({ intensite: 6, recente: true })
    expect(derniereNote(d, 'coude', AUJ)).toBeNull()
    expect(intensiteCarte(d, 'genou-gauche', '2026-11-20')).toBe(0)
    expect(zonesActives(d, AUJ).map((z) => z.id)).toEqual(['genou-gauche', 'epaule-droite'])
    expect(libelleZone('epaule-droite')).toBe('Épaule droite')
    expect(libelleZone('zone-inconnue')).toBe('Zone inconnue')
    expect(teinteIntensite(0)).toBe(0)
    expect(teinteIntensite(10)).toBe(100)
  })
})

describe('roue des nombres du suivi', () => {
  it('calories par 50, départ sur la dernière valeur', () => {
    const c = configNombre({ cle: 'kcal', min: 0, max: 6000, pas: 50, unite: 'kcal', defaut: 2000 }, 1850)
    expect(c.valeurDe(c.index)).toBe(1850)
    expect(configNombre({ cle: 'kcal', min: 0, max: 6000, pas: 50, defaut: 2000 }, null).valeurDe(40)).toBe(2000)
  })
})
