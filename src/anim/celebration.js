// Petite célébration de fin (confettis qui jaillissent puis retombent). Porté de design/m1/assets/vues.js.
// Mouvement réduit : rien (la fin reste lisible sans). Les confettis se retirent tout seuls du DOM.
import { gsap } from 'gsap'
import { mouvementReduit } from './transitions.js'

const COULEURS = ['var(--accent-texte)', '#ffffff', 'var(--accent-texte)']

/** `conteneur` : élément positionné (absolute/relative) ; `haut` : hauteur de départ en % ; `couleurs` : sur l'accent par défaut. */
export function confettis(conteneur, { haut = 34, nombre = 26, delai = 0.6, couleurs = COULEURS } = {}) {
  if (mouvementReduit() || !conteneur) return
  for (let k = 0; k < nombre; k++) {
    const c = document.createElement('i')
    c.setAttribute('aria-hidden', 'true')
    Object.assign(c.style, {
      position: 'absolute', left: '50%', top: `${haut}%`, pointerEvents: 'none', zIndex: 6,
      width: `${8 + Math.random() * 10}px`, height: `${8 + Math.random() * 10}px`,
      background: couleurs[k % couleurs.length], borderRadius: k % 2 ? '50%' : '3px'
    })
    conteneur.appendChild(c)
    const ang = Math.random() * Math.PI * 2
    const d = 90 + Math.random() * 190
    gsap.fromTo(c, { x: 0, y: 0, scale: 0.4, rotate: 0, opacity: 1 },
      { x: Math.cos(ang) * d, y: Math.sin(ang) * d - 40, scale: 1, rotate: Math.random() * 540, duration: 0.9 + Math.random() * 0.4, delay: delai, ease: 'expo.out' })
    gsap.to(c, { y: `+=${160 + Math.random() * 120}`, opacity: 0, duration: 1.1, delay: delai + 0.75 + Math.random() * 0.3, ease: 'power2.in', onComplete: () => c.remove() })
  }
}
