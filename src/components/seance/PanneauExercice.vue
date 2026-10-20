<script setup>
// Un exercice plein écran : nom, puces, dernière fois, vidéo, consigne, lignes de séries, bouton principal.
import { computed } from 'vue'
import Icone from '../Icone.vue'
import { jetonsSerie, puces, serieCourante } from '../../domain/seanceUi.js'
import { videoDe } from '../../domain/video.js'
import { useEnLigne } from '../../composables/useEnLigne.js'

const props = defineProps({
  item: { type: Object, required: true },
  idx: { type: Number, required: true },
  exercice: { type: Object, default: () => ({}) },
  unite: { type: String, default: 'kg' },
  derniere: { type: String, default: null },
  libelle: { type: String, required: true }
})
const emit = defineEmits(['ouvrir-serie', 'action', 'video'])
const enLigne = useEnLigne()

const courante = computed(() => serieCourante(props.item))
const video = computed(() => videoDe(props.exercice))
const bloc = computed(() => {
  if (props.item.supersetId) return `Superset · ${String.fromCharCode(65 + props.item.supersetIndex)} sur ${props.item.supersetTaille}`
  const cat = props.exercice.categories?.[0]
  return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Exercice'
})
const consigne = computed(() => props.item.consignes || props.exercice.description || '')
const etat = (k, s) => (s.faite ? 'fait' : k === courante.value ? 'courant' : 'avenir')
</script>

<template>
  <section class="panel" :data-i="idx" :aria-label="exercice.nom || 'Exercice'">
    <p class="p-bloc" data-c>{{ bloc }}</p>
    <h2 class="p-nom" data-c>{{ exercice.nom || 'Exercice' }}</h2>
    <div class="p-meta" data-c>
      <span v-for="p in puces(item, unite)" :key="p">{{ p }}</span>
    </div>
    <div class="p-prec" data-c>
      <span v-if="derniere">Dernière fois · {{ derniere }}</span>
      <button v-if="video.type !== 'aucune' && enLigne" class="lien-video" type="button" @click="emit('video', $event.currentTarget)">
        <Icone nom="lecture" /> {{ video.type === 'youtube' ? 'Voir la vidéo' : 'Ouvrir la vidéo' }}
      </button>
      <span v-else-if="video.type !== 'aucune'" class="video-absente">Vidéo indisponible hors connexion</span>
      <span v-else class="video-absente">Vidéo bientôt disponible</span>
    </div>
    <p v-if="consigne" class="p-note" data-c>{{ consigne }}</p>
    <div class="rangs" :data-n="item.series.length" data-c>
      <button
        v-for="(s, k) in item.series" :key="k" class="rang" :class="etat(k, s)" type="button"
        :data-serie="k" :aria-label="`Série ${k + 1}${s.faite ? ', faite' : ''}`"
        @click="emit('ouvrir-serie', k, $event.currentTarget)"
      >
        <span class="rg-n">{{ k + 1 }}</span>
        <span class="rg-v">
          <template v-for="(j, i) in jetonsSerie(item.champs, s.valeurs, unite)" :key="i">
            <i v-if="j.type === 'sep'">{{ j.texte }}</i>
            <template v-else><b>{{ j.texte }}</b><small v-if="j.unite">{{ j.unite }}</small></template>
          </template>
        </span>
        <span class="rg-e"><Icone nom="coche" /></span>
      </button>
    </div>
    <div class="p-action" data-c>
      <button class="gros" type="button" data-action @click="emit('action', $event.currentTarget)">{{ libelle }}</button>
      <slot name="sous-action" />
    </div>
  </section>
</template>

<style scoped>
.panel { flex: none; width: 100%; height: 100%; display: flex; flex-direction: column; padding: 8px var(--pad) 0; }
.p-bloc { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; color: var(--accent-lisible); }
.p-nom { font-family: var(--font-titre); font-weight: 400; font-size: 31px; letter-spacing: -.045em; line-height: 1.04; margin: 8px 0 12px; }
.p-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.p-meta span { padding: 8px 13px; border-radius: 16px; background: var(--surface); font-size: 15px; font-weight: 500; }
.p-note { margin-top: 12px; font-size: 15px; line-height: 1.38; color: var(--texte-doux); padding-left: 14px; border-left: 3px solid var(--accent-lisible);
  display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.p-prec { margin-top: 10px; font-size: 14.5px; color: var(--texte-doux); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 44px; }
.lien-video { color: var(--texte); font-weight: 600; font-size: 14.5px; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px 0 10px; border-radius: 22px; background: var(--surface); }
.lien-video svg { width: 15px; height: 15px; fill: currentColor; stroke: none; }
.video-absente { font-size: 13.5px; opacity: .8; }
.rangs { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow: hidden; }
.rang { position: relative; flex: 1 1 0; max-height: 76px; min-height: 58px; display: grid; grid-template-columns: 52px 1fr auto; align-items: center; gap: 4px; padding: 0 16px 0 10px; background: var(--surface); border-radius: 22px; text-align: left; width: 100%; transition: transform .16s var(--ease); }
.rang:active { transform: scale(.98); }
.rg-n { font-family: var(--font-chiffres); font-size: 15px; width: 36px; height: 36px; border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; letter-spacing: -.03em; }
.rg-v { font-family: var(--font-chiffres); font-size: 25px; letter-spacing: -.05em; padding-left: 10px; }
.rg-v b { font-weight: 400; }
.rg-v small { font-family: var(--font-texte); font-size: 15px; letter-spacing: 0; color: var(--texte-doux); margin-left: 3px; }
.rg-v i { font-style: normal; opacity: .4; margin: 0 4px; }
.rg-e { width: 34px; height: 34px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--filet); display: grid; place-items: center; color: var(--accent-texte); }
.rg-e svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
.rang.fait .rg-e { background: var(--accent); box-shadow: none; }
.rang.fait .rg-e svg { opacity: 1; }
.rang.fait .rg-n { background: transparent; color: var(--texte-doux); }
.rang.courant { background: var(--surface-2); box-shadow: inset 0 0 0 2.5px var(--accent-lisible); }
.rang.courant .rg-n { background: var(--accent); color: var(--accent-texte); }
.rang.avenir { opacity: .62; }
/* Peu de séries : les lignes grandissent, les valeurs aussi (lisibilité à bout de bras) */
.rangs[data-n="2"] .rang, .rangs[data-n="3"] .rang { max-height: 124px; grid-template-columns: 62px 1fr auto; }
.rangs[data-n="2"] .rg-v, .rangs[data-n="3"] .rg-v { font-size: 42px; }
.rangs[data-n="2"] .rg-v small, .rangs[data-n="3"] .rg-v small { font-size: 18px; }
.rangs[data-n="2"] .rg-n, .rangs[data-n="3"] .rg-n { width: 44px; height: 44px; font-size: 17px; }
.rangs[data-n="2"] .rg-e, .rangs[data-n="3"] .rg-e { width: 40px; height: 40px; }
.rangs[data-n="1"] .rang { max-height: 150px; grid-template-columns: 62px 1fr auto; }
.rangs[data-n="1"] .rg-v { font-size: 52px; }
.rangs[data-n="4"] .rang { max-height: 88px; }
.rangs[data-n="4"] .rg-v { font-size: 30px; }
.p-action { flex: none; padding: 14px 0 var(--bas); }
.p-action .gros { min-height: 72px; font-size: 17px; }
@media (max-height: 700px) { .p-note { -webkit-line-clamp: 2; line-clamp: 2; } .p-nom { font-size: 27px; margin-bottom: 8px; } }
@media (prefers-reduced-motion: reduce) { .rang { transition: none; } }
</style>
