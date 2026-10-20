<script setup>
// Un circuit dans la séance : explication -> overview des mouvements (avec vidéos) -> lancement du chrono -> résultat.
import { computed } from 'vue'
import { gsap } from 'gsap'
import Icone from '../Icone.vue'
import { explication } from '../../engine/circuits.js'
import { titreCircuit, etapesExplication, libelleResultat } from '../../domain/circuitsUi.js'
import { videoDe } from '../../domain/video.js'
import { mouvementReduit } from '../../anim/transitions.js'
import { useEnLigne } from '../../composables/useEnLigne.js'

const props = defineProps({
  item: { type: Object, required: true },
  idx: { type: Number, required: true },
  stade: { type: String, required: true }, // 'expl' | 'exos' | 'fait' (fait déduit de item.faite)
  exercices: { type: Object, default: () => ({}) }, // bibliothèque indexée par id
  libelle: { type: String, required: true }
})
const emit = defineEmits(['action', 'passer', 'video'])
const enLigne = useEnLigne()

const etape = computed(() => (props.item.faite ? 'fait' : props.stade))
const titre = computed(() => titreCircuit(props.item.format, props.item.params))
const objectif = computed(() => explication(props.item.format, props.item.params))
const etapes = computed(() => etapesExplication(props.item.format, props.item.params))

// Mouvements : ceux du bloc, sinon les noms listés dans les paramètres (EMOM, superset).
const mouvements = computed(() => {
  const liste = props.item.exercices || []
  if (liste.length) {
    return liste.map((x) => {
      const ex = props.exercices[x.exerciceId] || {}
      return { q: x.reps ? String(x.reps) : '', nom: ex.nom || 'Exercice', exercice: ex, video: videoDe(ex) }
    })
  }
  return (props.item.params?.exercices || []).map((n) => ({ q: '', nom: n, exercice: {}, video: { type: 'aucune' } }))
})

// Glissement entre les trois temps (même geste que le passage d'un exercice à l'autre).
const avant = (el) => { gsap.set(el, { opacity: 0, x: 70 }) }
function entre(el, fini) {
  if (mouvementReduit()) { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, onComplete: fini }); return }
  gsap.to(el, { x: 0, opacity: 1, duration: 0.8, ease: 'expo.out', delay: 0.1, clearProps: 'transform,opacity', onComplete: fini })
  gsap.fromTo(el.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: 'expo.out', delay: 0.18, clearProps: 'transform,opacity' })
}
function sort(el, fini) {
  if (mouvementReduit()) { gsap.to(el, { opacity: 0, duration: 0.15, onComplete: fini }); return }
  gsap.to(el, { x: -60, opacity: 0, duration: 0.35, ease: 'power3.out', onComplete: fini })
}
</script>

<template>
  <section class="panel" :data-i="idx" :aria-label="item.nom || titre.nom">
    <p class="p-bloc" data-c>Circuit · {{ titre.detail }}</p>
    <div class="zone">
      <Transition :css="false" @before-enter="avant" @enter="entre" @leave="sort">
        <div v-if="etape === 'expl'" key="expl" class="stade">
          <h2 class="expl-gd"><em>{{ titre.nom }}</em><br>{{ titre.detail }}</h2>
          <p class="expl-tx">{{ objectif }}</p>
          <ol class="expl-liste">
            <li v-for="(t, i) in etapes" :key="i"><b>{{ i + 1 }}</b>{{ t }}</li>
          </ol>
        </div>
        <div v-else-if="etape === 'exos'" key="exos" class="stade">
          <h2 class="mv-t">Les mouvements</h2>
          <p class="mv-s">{{ item.format === 'amrap' ? 'Un tour = tous les mouvements, dans cet ordre.' : 'Dans cet ordre, en suivant le chrono.' }}</p>
          <div class="mv-liste">
            <div v-for="(m, i) in mouvements" :key="i" class="mvt">
              <span class="q">{{ m.q || i + 1 }}</span>
              <span class="n">{{ m.nom }}</span>
              <button v-if="m.video.type !== 'aucune' && enLigne" class="mv-video" type="button" :aria-label="`Voir la vidéo : ${m.nom}`" @click="emit('video', m.exercice, $event.currentTarget)">
                <Icone nom="lecture" />
              </button>
              <small v-else-if="m.video.type !== 'aucune'" class="mv-hors">hors connexion</small>
            </div>
          </div>
        </div>
        <div v-else key="fait" class="stade">
          <h2 class="expl-gd">Circuit<br><em>terminé</em></h2>
          <div class="circuit-fait"><b>{{ libelleResultat(item.resultat) }}</b></div>
        </div>
      </Transition>
    </div>
    <div class="p-action" data-c>
      <button class="gros" type="button" data-action @click="emit('action', $event.currentTarget)">{{ libelle }}</button>
      <button v-if="!item.faite" class="lien" type="button" @click="emit('passer')">Passer ce circuit</button>
    </div>
  </section>
</template>

<style scoped>
.panel { flex: none; width: 100%; height: 100%; display: flex; flex-direction: column; padding: 8px var(--pad) 0; }
.p-bloc { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; color: var(--accent-lisible); }
.zone { position: relative; flex: 1; min-height: 0; margin-top: 6px; }
.stade { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
.expl-gd { font-family: var(--font-titre); font-weight: 400; font-size: 46px; letter-spacing: -.055em; line-height: 1; margin: 14px 0 12px; }
.expl-gd em { font-style: normal; color: var(--accent-lisible); }
.expl-tx { font-size: 20px; line-height: 1.38; font-weight: 500; }
.expl-liste { margin-top: 22px; display: flex; flex-direction: column; gap: 10px; }
.expl-liste li { display: flex; gap: 14px; align-items: center; background: var(--surface); border-radius: 20px; padding: 14px 16px; font-size: 16px; line-height: 1.3; }
.expl-liste li b { font-family: var(--font-chiffres); font-weight: 400; width: 34px; height: 34px; border-radius: 50%; background: var(--accent); color: var(--accent-texte); display: grid; place-items: center; font-size: 14px; flex: none; letter-spacing: -.03em; }
.mv-t { font-family: var(--font-titre); font-weight: 400; font-size: 25px; letter-spacing: -.045em; margin: 6px 0 4px; }
.mv-s { font-size: 15px; color: var(--texte-doux); margin-bottom: 14px; }
.mv-liste { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
.mv-liste::-webkit-scrollbar { display: none; }
.mvt { display: flex; align-items: center; gap: 14px; background: var(--surface); border-radius: 22px; padding: 12px 12px 12px 18px; min-height: 80px; margin-bottom: 10px; }
.mvt .q { font-family: var(--font-chiffres); font-size: 34px; letter-spacing: -.07em; min-width: 56px; color: var(--accent-lisible); }
.mvt .n { flex: 1; font-size: 19px; font-weight: 600; line-height: 1.2; }
.mv-video { width: 52px; height: 52px; border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; flex: none; }
.mv-video svg { width: 18px; height: 18px; fill: currentColor; stroke: none; }
.mv-hors { font-size: 12.5px; color: var(--texte-doux); }
.circuit-fait { display: flex; align-items: center; gap: 12px; background: var(--surface); border-radius: 22px; padding: 18px; margin-top: 14px; }
.circuit-fait b { font-family: var(--font-chiffres); font-weight: 400; font-size: 30px; color: var(--accent-lisible); letter-spacing: -.05em; }
.p-action { flex: none; padding: 14px 0 var(--bas); }
.p-action .gros { min-height: 72px; font-size: 17px; }
.p-action .lien { display: block; width: 100%; text-align: center; margin-top: 6px; font-size: 15px; color: var(--texte-doux); font-weight: 500; min-height: 48px; }
@media (max-height: 700px) { .expl-gd { font-size: 38px; } .expl-tx { font-size: 18px; } }
</style>
