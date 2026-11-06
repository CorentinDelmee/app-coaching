// Glisser-déposer du Studio (éditeurs de séance et de programme) : souris, tactile (par la poignée) et clavier.
// Un contrôleur par éditeur ; les listes (<ListeTriable>) s'y enregistrent ; l'éditeur applique les déplacements.
//
//   const g = creerGlisser({
//     surDeposer({ type, origine: { liste, index } | null, donnee, cible: { liste, index } }) -> message | false,
//     surAjouter(donnee) -> message | false,       // toucher / Entrée sur une source (bibliothèque)
//     capturer() -> instantané, restaurer(instantané)  // pour Échap et « Annuler » du toast
//   })
// Index de cible = position APRÈS retrait de l'élément tiré (voir deplacements.js).
// Souris : on tire l'élément entier ou sa poignée (seuil 6 px). Tactile : uniquement la poignée (touch-action: none),
// le reste de la page défile normalement. Clavier : Entrée/Espace sur la poignée saisit, flèches déplacent, Entrée pose, Échap annule.
import { nextTick, reactive, ref } from 'vue'
import { toast } from '../../../toast.js'
import { indexInsertion } from './deplacements.js'

const SEUIL = 6
const BORD = 72 // zone de défilement automatique (px)

export function creerGlisser({ surDeposer, surAjouter = () => false, capturer, restaurer }) {
  const listes = new Map() // id -> { el: () => HTMLElement, type, accepte: string[], longueur: () => number }
  const etat = reactive({ actif: false, type: '', origine: null, cible: null, cleSaisie: '' })
  const annonce = ref('')
  let geste = null // { x, y, pointerId, el, origine, donnee, type, demarre, decX, decY, fantome, px, py }
  let raf = 0
  let instantane = null

  function enregistrerListe(id, options) { listes.set(id, options) }
  function retirerListe(id) { listes.delete(id) }

  const annoncer = (t) => { annonce.value = ''; requestAnimationFrame(() => { annonce.value = t }) }
  const accepte = (l, type) => (l.accepte || [l.type]).includes(type)

  function listesOrdonnees(type) {
    return [...listes.entries()]
      .filter(([, l]) => accepte(l, type) && l.el())
      .sort(([, a], [, b]) => (a.el().compareDocumentPosition(b.el()) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  }

  /** Message de fin + toast « Annuler » (l'instantané est pris avant le premier changement). */
  function conclure(message, avant) {
    if (!message) return
    annoncer(message)
    toast(message, { action: 'Annuler', surAction: () => { restaurer(avant); annoncer('Déplacement annulé') }, duree: 8000 })
  }

  // ---------------------------------------------------------------- pointeur
  function debuter(ev, { liste = null, index = -1, type, donnee = null, cle = '' }) {
    if (ev.button !== 0 || geste || etat.cleSaisie) return
    if (ev.pointerType === 'touch' && !ev.target.closest('[data-st-poignee]')) return // tactile : seulement la poignée
    if (ev.target.closest('input, textarea, select, [contenteditable]') && !ev.target.closest('[data-st-poignee]')) return
    const el = liste ? ev.currentTarget.closest('[data-st-item]') : ev.currentTarget
    if (!el) return
    geste = { x: ev.clientX, y: ev.clientY, px: ev.clientX, py: ev.clientY, pointerId: ev.pointerId, el, origine: liste ? { liste, index } : null, donnee, type, cle, demarre: false, tactile: ev.pointerType === 'touch' }
    window.addEventListener('pointermove', bouger, { passive: false })
    window.addEventListener('pointerup', finir)
    window.addEventListener('pointercancel', annulerGeste)
    window.addEventListener('keydown', echapGeste)
  }

  function demarrer() {
    const r = geste.el.getBoundingClientRect()
    geste.decX = geste.x - r.left
    geste.decY = geste.y - r.top
    const f = geste.el.cloneNode(true)
    f.removeAttribute('id')
    f.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
    f.classList.add('st-gl-fantome')
    f.setAttribute('aria-hidden', 'true')
    Object.assign(f.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px` })
    ;(geste.el.closest('.st-app') || document.body).appendChild(f)
    geste.fantome = f
    geste.demarre = true
    instantane = capturer()
    Object.assign(etat, { actif: true, type: geste.type, origine: geste.origine, cible: null })
    document.documentElement.classList.add('st-gl-en-cours')
    if (geste.tactile && navigator.vibrate) navigator.vibrate(8)
    raf = requestAnimationFrame(boucle)
  }

  function bouger(ev) {
    if (!geste || ev.pointerId !== geste.pointerId) return
    geste.px = ev.clientX
    geste.py = ev.clientY
    if (!geste.demarre) {
      if (Math.hypot(ev.clientX - geste.x, ev.clientY - geste.y) < (geste.tactile ? 3 : SEUIL)) return
      demarrer()
    }
    ev.preventDefault()
  }

  // Une seule mise à jour par image : fantôme (transform), cible, défilement automatique.
  function boucle() {
    if (!geste?.demarre) return
    const { px, py } = geste
    geste.fantome.style.transform = `translate3d(${px - geste.x}px, ${py - geste.y}px, 0) rotate(-1.2deg) scale(1.02)`
    etat.cible = cibleSous(px, py)
    const h = window.innerHeight
    if (py < BORD) window.scrollBy(0, -Math.ceil((BORD - py) / 5))
    else if (py > h - BORD) window.scrollBy(0, Math.ceil((py - (h - BORD)) / 5))
    const defileX = document.elementsFromPoint(px, py).find((n) => n.hasAttribute?.('data-st-defile-x'))
    if (defileX) {
      const r = defileX.getBoundingClientRect()
      if (px < r.left + BORD) defileX.scrollLeft -= Math.ceil((r.left + BORD - px) / 5)
      else if (px > r.right - BORD) defileX.scrollLeft += Math.ceil((px - (r.right - BORD)) / 5)
    }
    raf = requestAnimationFrame(boucle)
  }

  /** Liste acceptante la plus petite (la plus imbriquée) sous le pointeur, et l'index d'insertion. */
  function cibleSous(x, y) {
    let meilleure = null
    for (const [id, l] of listes) {
      const el = l.el()
      if (!el || !accepte(l, geste.type)) continue
      const r = el.getBoundingClientRect()
      if (x < r.left || x > r.right || y < r.top - 8 || y > r.bottom + 8) continue
      const aire = r.width * r.height
      if (!meilleure || aire < meilleure.aire) meilleure = { id, el, aire }
    }
    if (!meilleure) return null
    const items = [...meilleure.el.querySelectorAll(':scope > [data-st-item]')].filter((n) => n !== geste.el)
    const milieux = items.map((n) => { const r = n.getBoundingClientRect(); return r.top + r.height / 2 })
    return { liste: meilleure.id, index: indexInsertion(milieux, y) }
  }

  function nettoyer() {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', bouger)
    window.removeEventListener('pointerup', finir)
    window.removeEventListener('pointercancel', annulerGeste)
    window.removeEventListener('keydown', echapGeste)
    geste?.fantome?.remove()
    document.documentElement.classList.remove('st-gl-en-cours')
    Object.assign(etat, { actif: false, type: '', origine: null, cible: null })
    geste = null
  }

  // Après un vrai glisser, le « click » qui suit ne doit pas ouvrir l'élément.
  function avalerClic() {
    const f = (e) => { e.stopPropagation(); e.preventDefault() }
    window.addEventListener('click', f, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', f, { capture: true }), 0)
  }

  function finir(ev) {
    if (!geste || ev.pointerId !== geste.pointerId) return
    if (!geste.demarre) return nettoyer()
    geste.px = ev.clientX
    geste.py = ev.clientY
    const cible = cibleSous(ev.clientX, ev.clientY)
    const { type, origine, donnee } = geste
    const avant = instantane
    avalerClic()
    nettoyer()
    if (!cible) return
    if (origine && origine.liste === cible.liste && origine.index === cible.index) return
    conclure(surDeposer({ type, origine, donnee, cible }), avant)
  }

  function annulerGeste() { nettoyer() }
  function echapGeste(e) { if (e.key === 'Escape' && geste?.demarre) { e.preventDefault(); nettoyer(); annoncer('Déplacement annulé') } }

  // ---------------------------------------------------------------- clavier (poignée)
  let saisie = null // { liste, index, cle, type, libelle, avant }

  async function refocaliser(cle) {
    await nextTick()
    const el = document.querySelector(`[data-st-poignee="${CSS.escape(cle)}"]`)
    if (el && document.activeElement !== el) el.focus()
  }

  function clavier(ev, { liste, index, type, cle, libelle }) {
    const k = ev.key
    if (!saisie) {
      if (k !== 'Enter' && k !== ' ') return
      ev.preventDefault()
      saisie = { liste, index, cle, type, libelle, avant: capturer() }
      etat.cleSaisie = cle
      const n = listes.get(liste)?.longueur() ?? 0
      annoncer(`${libelle} saisi, position ${index + 1} sur ${n}. Flèches pour déplacer, Entrée pour poser, Échap pour annuler.`)
      return
    }
    if (k === 'Escape') {
      ev.preventDefault()
      const avant = saisie.avant
      saisie = null
      etat.cleSaisie = ''
      restaurer(avant)
      annoncer('Déplacement annulé')
      refocaliser(cle)
      return
    }
    if (k === 'Enter' || k === ' ' || k === 'Tab') {
      if (k !== 'Tab') ev.preventDefault()
      const { avant, libelle: nom, index: i } = saisie
      const change = JSON.stringify(capturer()) !== JSON.stringify(avant)
      saisie = null
      etat.cleSaisie = ''
      if (change) conclure(`${nom} posé en position ${i + 1}`, avant)
      else annoncer(`${nom} posé`)
      return
    }
    let cible = null
    const n = listes.get(saisie.liste)?.longueur() ?? 0
    if (k === 'ArrowUp' && saisie.index > 0) cible = { liste: saisie.liste, index: saisie.index - 1 }
    else if (k === 'ArrowDown' && saisie.index < n - 1) cible = { liste: saisie.liste, index: saisie.index + 1 }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      const ordre = listesOrdonnees(saisie.type)
      const pos = ordre.findIndex(([id]) => id === saisie.liste)
      const voisine = ordre[pos + (k === 'ArrowLeft' ? -1 : 1)]
      if (voisine) cible = { liste: voisine[0], index: Math.min(saisie.index, voisine[1].longueur()) }
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) return
    ev.preventDefault()
    if (!cible) return
    const res = surDeposer({ type: saisie.type, origine: { liste: saisie.liste, index: saisie.index }, donnee: null, cible, clavier: true })
    if (res === false) return
    saisie.liste = cible.liste
    saisie.index = cible.index
    const total = listes.get(cible.liste)?.longueur() ?? 0
    annoncer(`${typeof res === 'string' && cible.liste !== liste ? res + ', ' : ''}position ${cible.index + 1} sur ${total}`)
    refocaliser(cle)
  }

  /** Attributs à poser (v-bind) sur la poignée d'un élément de liste. */
  function poignee({ liste, index, type, cle, libelle }) {
    return {
      type: 'button',
      'data-st-poignee': cle,
      'aria-label': `Déplacer ${libelle}`,
      'aria-describedby': 'st-gl-aide',
      'aria-pressed': etat.cleSaisie === cle ? 'true' : 'false',
      onPointerdown: (ev) => debuter(ev, { liste, index, type, cle }),
      onKeydown: (ev) => clavier(ev, { liste, index, type, cle, libelle }),
      // Le focus peut sauter quand Vue déplace le nœud : on ne pose que si le focus est vraiment parti ailleurs.
      onBlur: () => setTimeout(() => {
        if (saisie?.cle === cle && document.activeElement?.getAttribute('data-st-poignee') !== cle) clavier({ key: 'Tab', preventDefault() {} }, saisie)
      }, 30)
    }
  }

  /** Attributs pour un élément entier tirable à la souris (en plus de sa poignée). */
  function tirable({ liste, index, type, cle }) {
    return { onPointerdown: (ev) => { if (ev.pointerType === 'mouse') debuter(ev, { liste, index, type, cle }) } }
  }

  /** Attributs pour une source (vignette de la bibliothèque) : souris = glisser, toucher / Entrée = ajouter. */
  function source({ donnee, type }) {
    return {
      // draggable + dragstart annulé : signale l'élément comme glissable sans laisser le glisser HTML5 natif voler les événements pointeur
      draggable: 'true',
      onDragstart: (ev) => ev.preventDefault(),
      onPointerdown: (ev) => { if (ev.pointerType === 'mouse' || ev.pointerType === 'pen') debuter(ev, { type, donnee }) },
      onClick: () => {
        const avant = capturer()
        conclure(surAjouter(donnee), avant)
      }
    }
  }

  return { etat, annonce, enregistrerListe, retirerListe, poignee, tirable, source, detruire: nettoyer }
}

export const AIDE_GLISSER = 'Entrée ou Espace pour saisir, flèches pour déplacer, Entrée pour poser, Échap pour annuler.'
