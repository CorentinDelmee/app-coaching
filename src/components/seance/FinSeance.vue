<script setup>
// Écran de fin : l'aplat d'accent se referme en anneau, une coche se dessine, les chiffres comptent.
// Fête permise ici (c'est rare) ; « Valider ma séance » enregistre puis renvoie au parent.
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { gsap } from 'gsap'
import Icone from '../Icone.vue'
import { ouvrirCercle, nettoyer, compter, mouvementReduit } from '../../anim/transitions.js'
import { centreDe, racineDe, hauteurDe } from '../../anim/geometrie.js'
import { confettis } from '../../anim/celebration.js'
import { SONS } from '../../lib/son.js'
import { minutesDe, milliers } from '../../domain/seanceUi.js'
import { poidsAffiche, nombreFr } from '../../domain/unites.js'

const props = defineProps({
  resume: { type: Object, required: true },        // engine/seance resumer()
  nomWorkout: { type: String, default: '' },
  nbExercices: { type: Number, default: 0 },
  records: { type: Array, default: () => [] },     // [{ nom, charge }]
  unite: { type: String, default: 'kg' },
  src: { type: Object, default: null },
  enCours: { type: Boolean, default: false },      // enregistrement en cours
  erreur: { type: String, default: '' }
})
const emit = defineEmits(['valider'])

const racine = ref(null)
const commentaire = ref('')
const commentaireOuvert = ref(false)
let tl = null
let delai = 0

const minutes = computed(() => minutesDe(props.resume.dureeSec))
const volume = computed(() => poidsAffiche(props.resume.volume, props.unite))
const record = computed(() => [...props.records].sort((a, b) => b.charge - a.charge)[0] || null)
const quatrieme = computed(() => (props.resume.circuitsFaits > 0
  ? { v: props.resume.circuitsFaits, l: props.resume.circuitsFaits > 1 ? 'Circuits' : 'Circuit' }
  : { v: props.nbExercices, l: 'Exercices' }))

const $ = (sel) => racine.value.querySelector(sel)
const $$ = (sel) => Array.from(racine.value.querySelectorAll(sel))

onMounted(() => {
  const cibles = '.f-h, .f-p, .st, .fin-bas, .f-ok, .f-trou'
  gsap.set($$(cibles), { opacity: 0 })
  ouvrirCercle(racine.value, props.src, { duree: 0.7 })
  delai = setTimeout(animer, mouvementReduit() ? 100 : 460)
})
onBeforeUnmount(() => { clearTimeout(delai); if (tl) tl.kill(); nettoyer(racine.value) })

function nombres() {
  compter($('.f-min'), 0, minutes.value, { duree: 1.4, delay: 0.1 })
  compter($('.f-vol'), 0, volume.value, { duree: 2.2, delay: 0.15, fmt: (v) => milliers(v) })
  compter($('.f-ser'), 0, props.resume.seriesFaites, { duree: 1.5, delay: 0.2 })
  compter($('.f-4'), 0, quatrieme.value.v, { duree: 1.3, delay: 0.25 })
}

function animer() {
  const aplat = $('.f-aplat')
  if (mouvementReduit()) {
    gsap.set($$('.f-h, .f-p, .st, .fin-bas, .f-ok, .f-trou'), { opacity: 1 })
    aplat.remove(); nombres(); return
  }
  const C = centreDe($('.f-anneau'), racineDe(racine.value))
  tl = gsap.timeline()
  tl.fromTo(aplat, { clipPath: `circle(1000px at ${C.x}px ${C.y}px)` }, { clipPath: `circle(95px at ${C.x}px ${C.y}px)`, duration: 0.85, ease: 'expo.inOut' }, 0)
    .add(() => { aplat.style.display = 'none' }, '>')
    .set($('.f-trou'), { opacity: 1, scale: 0 }, '<')
    .to($('.f-trou'), { scale: 1, duration: 0.8, ease: 'back.out(1.5)' }, '<')
    .fromTo($('.f-ok'), { opacity: 1 }, { opacity: 1, duration: 0.01 }, '<')
    .fromTo($('.f-ok path'), { strokeDasharray: 40, strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' }, '<.25')
    .fromTo($('.f-anneau'), { scale: 1 }, { scale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<.3')
    // la coche est posée : les confettis jaillissent de l'anneau (c'est le moment le plus rare de l'app, la fête est permise)
    .add(() => { SONS.tour(); confettis(racine.value, { haut: (C.y / hauteurDe(racineDe(racine.value))) * 100, nombre: 34, delai: 0, couleurs: ['var(--accent)', 'var(--texte)', 'var(--accent-lisible)'] }) }, '<')
    .fromTo($$('.f-h, .f-p'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.1, ease: 'expo.out', clearProps: 'transform' }, '<-.25')
    .fromTo($$('.st'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.09, ease: 'expo.out', clearProps: 'transform' }, '<.15')
    .add(nombres, '<.1')
    .fromTo($('.fin-bas'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', clearProps: 'transform' }, '<.5')
    .fromTo($('.st.record'), { scale: 0.9 }, { scale: 1, duration: 0.7, ease: 'back.out(1.7)' }, '<.2')
}

defineExpose({ racine })
</script>

<template>
  <div ref="racine" class="couche fin" hidden>
    <div class="fin-contenu">
      <div class="fin-hero">
        <div class="f-anneau">
          <span class="disque"></span><span class="f-trou"></span>
          <svg class="f-ok ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
      </div>
      <div class="fin-t">
        <h2 class="f-h">Bravo,<br>séance terminée</h2>
        <p class="f-p">{{ nomWorkout }}</p>
      </div>
      <div class="fin-stats">
        <div class="st"><div class="v"><span class="f-min">0</span><small>min</small></div><div class="l">Durée</div></div>
        <div class="st"><div class="v"><span class="f-vol">0</span><small>{{ unite }}</small></div><div class="l">Volume</div></div>
        <div class="st"><div class="v"><span class="f-ser">0</span><small>/ {{ resume.seriesTotal }}</small></div><div class="l">Séries</div></div>
        <div class="st"><div class="v"><span class="f-4">0</span></div><div class="l">{{ quatrieme.l }}</div></div>
        <div class="st record" :class="{ vide: !record }">
          <Icone nom="coupe" />
          <div>
            <div class="l">{{ record ? (records.length > 1 ? `Nouveau record · +${records.length - 1} autre${records.length > 2 ? 's' : ''}` : 'Nouveau record') : 'Aucun record cette fois' }}</div>
            <div class="v">{{ record ? `${record.nom} · ${nombreFr(poidsAffiche(record.charge, unite))} ${unite}` : 'La régularité fait les records' }}</div>
          </div>
        </div>
      </div>
      <div class="fin-bas">
        <button v-if="!commentaireOuvert" class="lien-com" type="button" @click="commentaireOuvert = true">Laisser un mot à votre coach (facultatif)</button>
        <label v-else class="com">
          <span>Un mot pour votre coach (facultatif)</span>
          <textarea v-model="commentaire" rows="2" maxlength="500" placeholder="Une douleur, une victoire, une question…"></textarea>
        </label>
        <p v-if="erreur" class="erreur" role="alert">{{ erreur }}</p>
        <button class="gros" type="button" :disabled="enCours" @click="emit('valider', commentaire.trim())">{{ enCours ? 'Enregistrement…' : 'Valider ma séance' }}</button>
      </div>
    </div>
    <div class="f-aplat aplat"></div>
    <div class="voile" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.fin { z-index: 65; }
.aplat { position: absolute; inset: 0; background: var(--accent); }
.fin-contenu { position: absolute; inset: 0; padding: var(--haut) var(--pad) var(--bas); display: flex; flex-direction: column; }
.fin-hero { position: relative; height: 210px; display: grid; place-items: center; flex: none; }
.f-anneau { position: relative; width: 170px; height: 170px; display: grid; place-items: center; }
.disque { position: absolute; inset: 0; border-radius: 50%; background: var(--accent); }
.f-trou { position: absolute; inset: 22px; border-radius: 50%; background: var(--fond); }
.ok { position: absolute; left: 50%; top: 50%; margin: -34px 0 0 -34px; width: 68px; height: 68px; stroke: var(--accent-lisible); fill: none; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
.fin-t { text-align: center; }
h2 { font-family: var(--font-titre); font-weight: 400; font-size: 36px; letter-spacing: -.05em; line-height: 1.04; }
.f-p { margin-top: 8px; color: var(--texte-doux); font-size: 17px; }
.fin-stats { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.st { background: var(--surface); border-radius: 22px; padding: 13px 16px; }
.st .v { font-family: var(--font-chiffres); font-size: 36px; letter-spacing: -.06em; line-height: 1; font-variant-numeric: tabular-nums; }
.st .v small { font-size: 16px; letter-spacing: 0; color: var(--texte-doux); margin-left: 4px; font-family: var(--font-texte); }
.st .l { margin-top: 6px; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600; color: var(--texte-doux); }
.st.record { grid-column: 1 / -1; background: var(--accent); color: var(--accent-texte); display: flex; align-items: center; gap: 14px; }
.st.record.vide { background: var(--surface); color: var(--texte); }
.st.record .l { color: var(--on-accent-doux); margin: 0 0 2px; }
.st.record.vide .l { color: var(--texte-doux); }
.st.record .v { font-size: 20px; letter-spacing: -.04em; line-height: 1.15; }
.st.record svg { width: 34px; height: 34px; flex: none; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.fin-bas { margin-top: auto; padding-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.lien-com { color: var(--texte-doux); font-size: 15px; font-weight: 500; min-height: 44px; text-decoration: underline; text-underline-offset: 3px; }
.com { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--texte-doux); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
textarea { font: inherit; font-size: 16px; letter-spacing: 0; text-transform: none; font-weight: 400; color: var(--texte); background: var(--surface); border: 0; border-radius: 18px; padding: 12px 14px; resize: none; }
textarea:focus-visible { outline: 3px solid var(--accent-lisible); }
.erreur { color: var(--accent-lisible); font-size: 14.5px; font-weight: 500; }
@media (max-height: 760px) { .fin-hero { height: 150px; } .f-anneau { width: 120px; height: 120px; } .f-trou { inset: 16px; } .ok { width: 50px; height: 50px; margin: -25px 0 0 -25px; } h2 { font-size: 30px; } }
</style>
