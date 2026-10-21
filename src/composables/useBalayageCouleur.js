// Changement de couleur d'écran des chronos (M1) : la nouvelle couleur balaie l'écran du bas vers le haut au lieu de se fondre
// (un fondu jaune -> encre passe par un kaki terne). Le texte change de couleur à mi-course.
// Gabarit attendu dans `racine` : <div class="bgs"><i data-ph="prep|travail|repos"></i>…</div> (une couche par phase).
// Renvoie `affiche` : la phase dont les couleurs de texte s'appliquent (en retard de 0,22 s sur `theme`).
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { mouvementReduit } from '../anim/transitions.js'

export function useBalayageCouleur(racine, theme) {
  const affiche = ref(theme.value)
  let retard = null
  const couches = () => [...(racine.value?.querySelectorAll('.bgs i') || [])]

  onMounted(() => { for (const i of couches()) gsap.set(i, { opacity: i.dataset.ph === theme.value ? 1 : 0, zIndex: 0 }) })

  watch(theme, (vers, avant) => {
    const cs = couches()
    const nouvelle = cs.find((i) => i.dataset.ph === vers)
    const ancienne = cs.find((i) => i.dataset.ph === avant)
    if (!nouvelle) { affiche.value = vers; return }
    gsap.killTweensOf(cs)
    retard?.kill()
    if (mouvementReduit()) {
      cs.forEach((i) => gsap.set(i, { opacity: i === nouvelle ? 1 : 0, clearProps: 'clipPath' }))
      affiche.value = vers
      return
    }
    cs.forEach((i) => gsap.set(i, { zIndex: i === nouvelle ? 2 : i === ancienne ? 1 : 0, opacity: i === nouvelle || i === ancienne ? 1 : 0 }))
    gsap.fromTo(nouvelle, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'power3.out',
      onComplete: () => { cs.forEach((i) => { if (i !== nouvelle) gsap.set(i, { opacity: 0 }) }); gsap.set(nouvelle, { clearProps: 'clipPath' }) }
    })
    retard = gsap.delayedCall(0.22, () => { affiche.value = vers })
  })

  onBeforeUnmount(() => { retard?.kill(); gsap.killTweensOf(couches()) })
  return affiche
}
