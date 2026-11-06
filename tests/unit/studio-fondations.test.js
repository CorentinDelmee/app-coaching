// Fondations du Studio coach (lot studio-l0) : médias, navigation, sauvegarde auto, transition partagée.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { muscleDe, teinteDe, nomMuscleDe, mediaDe, urlPhoto, statutVideo, dureeCourte, mouvementDe, miniatureYoutube } from '../../src/coach/studio/medias.js'
import { NAV_PRINCIPALE, NAV_SECONDAIRE, estActif, compte } from '../../src/coach/studio/navigation.js'
import { useSauvegardeAuto } from '../../src/coach/studio/useSauvegardeAuto.js'
import { bezier, vaul, etapeFlip } from '../../src/coach/studio/transitionPartagee.js'

const CONTRAT = {
  id: 'ex-squat-gobelet', nom: 'Squat gobelet', categories: ['jambes'],
  lienVideo: 'https://www.youtube.com/watch?v=mKREc_xl_j8',
  musclesPrincipaux: ['jambes'], musclesSecondaires: ['gainage'], materiel: ['Haltères'], niveau: 'debutant',
  photo: { id: 'p-3fa9c01b22de', url: '/api/app/fichiers?chemin=exercices%2Fp-3fa9c01b22de.webp' },
  video: { url: 'https://www.youtube.com/watch?v=mKREc_xl_j8', titre: null, chaine: null, duree: 20, statut: 'valide' }
}

describe('medias (forme du contrat et ancienne forme)', () => {
  it('teinte : muscles principaux libres, synonymes, accents, puis catégories historiques', () => {
    expect(muscleDe(CONTRAT)).toBe('jambes')
    expect(muscleDe({ musclesPrincipaux: ['Pectoraux'] })).toBe('pecs')
    expect(muscleDe({ musclesPrincipaux: ['Épaules'] })).toBe('epaules')
    expect(muscleDe({ musclesPrincipaux: ['inconnu'], categories: ['tirage'] })).toBe('dos')
    expect(muscleDe({ categories: ['poussee'] })).toBe('pecs')
    expect(muscleDe({})).toBe(null)
    expect(teinteDe('  FESSIERS ')).toBe('jambes')
  })
  it('nom affiché : le mot du coach, sinon le nom de la teinte', () => {
    expect(nomMuscleDe({ musclesPrincipaux: ['fessiers'] })).toBe('Fessiers')
    expect(nomMuscleDe({ categories: ['poussee'] })).toBe('Pectoraux')
    expect(nomMuscleDe({})).toBe('')
  })
  it('photo : objet du contrat (chemin same-origin), chaîne, data-URL ; refuse javascript: et //hote', () => {
    expect(urlPhoto(CONTRAT)).toBe(CONTRAT.photo.url)
    expect(urlPhoto({ photo: { url: 'data:image/webp;base64,AAA' } })).toBe('data:image/webp;base64,AAA')
    expect(urlPhoto({ photo: 'https://x.fr/a.jpg' })).toBe('https://x.fr/a.jpg')
    expect(urlPhoto({ photo: { url: 'javascript:alert(1)' } })).toBe(null)
    expect(urlPhoto({ photo: { url: '//evil.fr/a.jpg' } })).toBe(null)
    expect(urlPhoto({ photo: null })).toBe(null)
  })
  it('média : photo > miniature YouTube > figure', () => {
    expect(mediaDe(CONTRAT)).toEqual({ type: 'photo', src: CONTRAT.photo.url })
    const yt = mediaDe({ ...CONTRAT, photo: null })
    expect(yt.type).toBe('youtube')
    expect(yt.src).toBe('https://i.ytimg.com/vi/mKREc_xl_j8/mqdefault.jpg')
    expect(yt.embed).toContain('youtube-nocookie.com/embed/mKREc_xl_j8')
    expect(mediaDe({ nom: 'x', photo: null, video: null })).toEqual({ type: 'figure' })
    expect(miniatureYoutube('trop-court')).toBe(null)
  })
  it('statut vidéo et durée', () => {
    expect(statutVideo(CONTRAT)).toBe('valide')
    expect(statutVideo({ video: { statut: 'propose' } })).toBe('propose')
    expect(statutVideo({ lienVideo: 'https://youtu.be/mKREc_xl_j8' })).toBe('valide')
    expect(statutVideo({ video: null })).toBe('aucune')
    expect(dureeCourte(20)).toBe('0:20')
    expect(dureeCourte(65)).toBe('1:05')
    expect(dureeCourte(null)).toBe('')
  })
  it('mouvement de la figure selon la teinte', () => {
    expect(mouvementDe({ musclesPrincipaux: ['gainage'] })).toBe('gainage')
    expect(mouvementDe({})).toBe('squat')
  })
})

describe('navigation', () => {
  const ex = NAV_PRINCIPALE.find((e) => e.to === '/coach/exercices')
  it('actif sur la page, ses sous-pages et ses pages « aussi », pas sur un préfixe voisin', () => {
    expect(estActif(ex, '/coach/exercices')).toBe(true)
    expect(estActif(ex, '/coach/exercices/ex-1')).toBe(true)
    expect(estActif(ex, '/coach/bibliotheque')).toBe(true)
    expect(estActif(ex, '/coach/exercicesX')).toBe(false)
    expect(estActif(ex, '/coach/clients')).toBe(false)
  })
  it('pastilles : tableau -> longueur, nombre, rien sinon', () => {
    const alertes = NAV_PRINCIPALE.find((e) => e.compteur === 'alertes')
    const agenda = NAV_PRINCIPALE.find((e) => e.compteur === 'alertesAgenda')
    expect(compte(alertes, { alertes: [1, 2, 3] })).toBe(3)
    expect(compte(agenda, { alertesAgenda: 2 })).toBe(2)
    expect(compte(ex, { alertes: [1] })).toBe(0)
    expect(compte(alertes, {})).toBe(0)
  })
  it('barre du bas : 4 onglets (+ « Plus »), toutes les anciennes pages restent atteignables', () => {
    expect(NAV_PRINCIPALE.filter((e) => e.bas)).toHaveLength(4)
    const chemins = [...NAV_PRINCIPALE, ...NAV_SECONDAIRE].map((e) => e.to)
    for (const p of ['clients', 'alertes', 'agenda', 'reservations', 'seances', 'programmes', 'exercices', 'bibliotheque', 'questionnaires', 'donnees']) {
      expect(chemins).toContain(`/coach/${p}`)
    }
  })
})

describe('useSauvegardeAuto', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('debounce : une seule écriture, la dernière valeur, puis ok -> repos', async () => {
    const ecrit = vi.fn(async () => {})
    const s = useSauvegardeAuto(ecrit, { delai: 600, dureeOk: 1000 })
    s.planifier('a'); s.planifier('ab'); s.planifier('abc')
    expect(s.etat.value).toBe('attente')
    await vi.advanceTimersByTimeAsync(599)
    expect(ecrit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(ecrit).toHaveBeenCalledTimes(1)
    expect(ecrit).toHaveBeenCalledWith('abc')
    expect(s.etat.value).toBe('ok')
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.etat.value).toBe('repos')
  })

  it('file : une seule écriture en vol ; la saisie pendant l\'écriture repart ensuite avec la dernière valeur', async () => {
    let finir
    const ecrit = vi.fn(() => new Promise((r) => { finir = r }))
    const s = useSauvegardeAuto(ecrit, { delai: 100 })
    s.planifier(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(s.etat.value).toBe('encours')
    s.planifier(2); s.planifier(3)
    await vi.advanceTimersByTimeAsync(100)
    expect(ecrit).toHaveBeenCalledTimes(1) // pas de 2e écriture en parallèle
    finir()
    await vi.advanceTimersByTimeAsync(0)
    expect(ecrit).toHaveBeenCalledTimes(2)
    expect(ecrit).toHaveBeenLastCalledWith(3)
    finir()
    await vi.advanceTimersByTimeAsync(0)
    expect(s.etat.value).toBe('ok')
  })

  it('erreur puis réessayer : retente la dernière valeur', async () => {
    const ecrit = vi.fn().mockRejectedValueOnce(new Error('reseau')).mockResolvedValue(undefined)
    const s = useSauvegardeAuto(ecrit, { delai: 10 })
    s.planifier({ nom: 'x' })
    await vi.advanceTimersByTimeAsync(10)
    expect(s.etat.value).toBe('erreur')
    expect(s.erreur.value.message).toBe('reseau')
    await s.reessayer()
    expect(ecrit).toHaveBeenCalledTimes(2)
    expect(ecrit).toHaveBeenLastCalledWith({ nom: 'x' })
    expect(s.etat.value).toBe('ok')
  })

  it('maintenant / arreter : écrit tout de suite ce qui reste (fermeture du panneau)', async () => {
    const ecrit = vi.fn(async () => {})
    const s = useSauvegardeAuto(ecrit, { delai: 5000 })
    s.planifier('reste')
    await s.arreter()
    expect(ecrit).toHaveBeenCalledWith('reste')
    await s.maintenant() // rien en attente : pas de 2e écriture
    expect(ecrit).toHaveBeenCalledTimes(1)
  })
})

describe('transitionPartagee', () => {
  it('bezier : bornes, monotone, et courbe Vaul rapide au départ', () => {
    const lin = bezier(0, 0, 1, 1)
    expect(lin(0.3)).toBeCloseTo(0.3, 4)
    expect(vaul(0)).toBe(0)
    expect(vaul(1)).toBe(1)
    let avant = 0
    for (let t = 0.05; t <= 1; t += 0.05) { const v = vaul(t); expect(v).toBeGreaterThanOrEqual(avant - 1e-9); avant = v }
    expect(vaul(0.25)).toBeGreaterThan(0.5)
  })
  it('FLIP : départ = rectangle de la vignette, arrivée = identité', () => {
    const a = { left: 100, top: 300, width: 200, height: 150 } // vignette 4:3
    const b = { left: 820, top: 16, width: 440, height: 247.5 } // en-tête 16:9
    const d = etapeFlip(a, b, 0)
    expect(d.sx).toBeCloseTo(200 / 440)
    expect(d.sy).toBeCloseTo(150 / 247.5)
    expect(d.calque).toBe(`translate(-720px, 284px) scale(${200 / 440}, ${150 / 247.5})`)
    const f = etapeFlip(a, b, 1)
    expect(f.calque).toBe('translate(0px, 0px) scale(1, 1)')
    expect(f.contenu).toBe('scale(1, 1)')
    expect(f.rayon).toBe('28px / 28px')
  })
  it('contre-échelle : le contenu garde ses proportions (jamais étiré) à chaque étape', () => {
    const a = { left: 0, top: 0, width: 200, height: 150 }
    const b = { left: 0, top: 0, width: 440, height: 247.5 }
    for (const p of [0, 0.2, 0.5, 0.8, 1]) {
      const e = etapeFlip(a, b, p)
      const [, cx, cy] = e.contenu.match(/scale\(([^,]+), ([^)]+)\)/).map(Number)
      // échelle visible = calque × contenu ; identique en x et y => pas d'étirement
      expect(e.sx * cx).toBeCloseTo(e.sy * cy, 9)
      // et couvre le calque (recadrage façon object-fit: cover)
      expect(cx).toBeGreaterThanOrEqual(1 - 1e-9)
      expect(cy).toBeGreaterThanOrEqual(1 - 1e-9)
    }
  })
})
