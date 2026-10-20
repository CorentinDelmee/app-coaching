// Petits effets de la direction M1 portés de design/m1/assets/anim.js : titres « mots qui montent » et anneau SVG.
import { gsap } from 'gsap'
import { mouvementReduit } from './transitions.js'

/** Découpe le texte d'un élément en mots masqués (sans toucher aux <br>). Une seule fois par élément. */
export function decouperMots(el) {
  if (el.dataset.decoupe) return Array.from(el.querySelectorAll('.mot > span'))
  el.dataset.decoupe = '1'
  const parcourir = (noeud) => {
    Array.from(noeud.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment()
        // seuls les espaces ordinaires coupent : une espace insécable reste dans le mot (« passé ? » ne se sépare pas)
        n.textContent.split(/([ \t\r\n]+)/).forEach((w) => {
          if (!w) return
          if (/^[ \t\r\n]+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return }
          const m = document.createElement('span'); m.className = 'mot'
          const s = document.createElement('span'); s.textContent = w
          m.appendChild(s); frag.appendChild(m)
        })
        n.replaceWith(frag)
      } else if (n.nodeType === 1 && n.tagName !== 'BR') parcourir(n)
    })
  }
  parcourir(el)
  return Array.from(el.querySelectorAll('.mot > span'))
}

export function motsMontent(el, delay = 0) {
  const mots = decouperMots(el)
  if (mouvementReduit()) return gsap.fromTo(mots, { opacity: 0 }, { opacity: 1, duration: 0.25, delay })
  return gsap.fromTo(mots, { yPercent: 115 }, { yPercent: 0, duration: 1.05, stagger: 0.07, ease: 'expo.out', delay })
}

/** Trait d'un anneau SVG (<circle r=…>) rempli à la fraction p (0..1). */
export function anneau(circ, p) {
  const C = 2 * Math.PI * parseFloat(circ.getAttribute('r'))
  circ.style.strokeDasharray = C
  circ.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(1, p)))
}
export function animerAnneau(circ, de, a, opts = {}) {
  anneau(circ, de)
  if (mouvementReduit()) { anneau(circ, a); return null }
  const o = { p: de }
  return gsap.to(o, { p: a, duration: opts.duree || 1.2, delay: opts.delay || 0, ease: opts.ease || 'expo.out', onUpdate: () => anneau(circ, o.p), onComplete: () => anneau(circ, a) })
}
