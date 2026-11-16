// Règles du détecteur de micro-sauts (tests/e2e/mouvement/analyse.mjs) sur des enregistrements synthétiques.
import { describe, expect, it } from 'vitest'
import { analyser } from '../e2e/mouvement/analyse.mjs'

// image : liste d'éléments [id, x, y, w, h, op, rid, txt, vis] ; racine 1 fixe en (0,0)
const R1 = [1, 0, 0, 390, 844, 1]
const im = (t, els, racines = [R1]) => ({ t, els, racines })
const descs = { 10: { el: 'span.chip' }, 11: { el: 'span.chip' }, 12: { el: 'b.compteur' }, 20: { el: 'span.chip' }, r1: {}, r2: {} }
const types = (rec) => analyser({ descs, ...rec }).sauts.map((s) => s.type)

describe('micro-sauts : analyse', () => {
  it('un élément qui saute de 10 px en une image est signalé, pas un glissement fluide', () => {
    const saut = [0, 0, 0, 10, 10, 10].map((y, k) => im(k * 16, [[10, 0, y, 50, 20, 1, 1, 'A', 1]]))
    expect(types({ images: saut })).toEqual(['position'])
    const fluide = [0, 2, 4, 6, 8, 10].map((y, k) => im(k * 16, [[10, 0, y, 50, 20, 1, 1, 'A', 1]]))
    expect(types({ images: fluide })).toEqual([])
  })
  it("un élément qui suit sa page (racine qui glisse) n'est pas un saut", () => {
    const images = [0, 0, 20, 20].map((x, k) => im(k * 16, [[10, x, 100, 50, 20, 1, 1, 'A', 1]], [[1, x, 0, 390, 844, 1]]))
    expect(types({ images }).filter((t) => t !== 'page')).toEqual([])
  })
  it("apparition d'un coup dans une page déjà là : signalée ; arrivée avec sa page : non", () => {
    const tard = [im(0, []), im(16, []), im(32, [[10, 0, 0, 50, 20, 1, 1, 'A', 1]]), im(48, [[10, 0, 0, 50, 20, 1, 1, 'A', 1]])]
    expect(types({ images: tard })).toEqual(['apparition'])
    const avecPage = [im(0, [], []), im(16, [], []), im(32, [[10, 0, 0, 50, 20, 1, 1, 'A', 1]]), im(48, [[10, 0, 0, 50, 20, 1, 1, 'A', 1]])]
    expect(types({ images: avecPage })).toEqual([])
  })
  it('fondu qui monte ou élément caché (rogné) : pas une apparition', () => {
    const fondu = [im(0, []), im(16, [[10, 0, 0, 50, 20, 0.3, 1, 'A', 1]]), im(32, [[10, 0, 0, 50, 20, 0.7, 1, 'A', 1]]), im(48, [[10, 0, 0, 50, 20, 1, 1, 'A', 1]])]
    expect(types({ images: fondu })).toEqual([])
    const rogne = [im(0, []), im(16, [[10, 0, 0, 50, 20, 1, 1, 'A', 0]]), im(32, [[10, 0, 0, 50, 20, 1, 1, 'A', 1]])]
    expect(types({ images: rogne })).toEqual([])
  })
  it('texte qui change après l’arrivée : signalé ; compteur qui défile : non', () => {
    const texte = ['A', 'A', 'B', 'B'].map((x, k) => im(k * 16, [[10, 0, 0, 50, 20, 1, 1, x, 1]]))
    expect(types({ images: texte })).toEqual(['texte'])
    const compteur = ['0', '1', '2', '3', '4'].map((x, k) => im(k * 16, [[12, 0, 0, 50, 20, 1, 1, x, 1]]))
    expect(types({ images: compteur })).toEqual([])
  })
  it('remplacement à l’identique (re-rendu, même place) : rien ; même élément ailleurs : position', () => {
    const ident = [im(0, [[10, 0, 0, 50, 20, 1, 1, 'A', 1]]), im(16, [[11, 0, 0, 50, 20, 1, 1, 'A', 1]]), im(32, [[11, 0, 0, 50, 20, 1, 1, 'A', 1]])]
    expect(types({ images: ident })).toEqual([])
    const ailleurs = [im(0, [[10, 0, 0, 50, 20, 1, 1, 'A', 1]]), im(16, [[11, 0, 30, 50, 20, 1, 1, 'A', 1]]), im(32, [[11, 0, 30, 50, 20, 1, 1, 'A', 1]])]
    expect(types({ images: ailleurs })).toEqual(['position'])
  })
  it("échange de page : la copie (nouvelle racine) met le même élément ailleurs : signalé", () => {
    const R2 = [2, 0, 0, 390, 844, 1]
    const images = [im(0, [[10, 20, 400, 80, 30, 1, 1, '≈ 25 min', 1]]), im(16, [[10, 20, 400, 80, 30, 1, 1, '≈ 25 min', 1]]),
      im(32, [[20, 20, 447, 80, 30, 1, 2, '≈ 25 min', 1]], [R2]), im(48, [[20, 20, 447, 80, 30, 1, 2, '≈ 25 min', 1]], [R2])]
    expect(types({ images })).toEqual(['echange'])
    const memePlace = images.map((x, k) => (k < 2 ? x : im(x.t, [[20, 20, 400, 80, 30, 1, 2, '≈ 25 min', 1]], [R2])))
    expect(types({ images: memePlace })).toEqual([])
  })
})
