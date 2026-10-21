<script setup>
// Une page entière par exercice (maquette V2, lisibilité M1) : repère de bloc + vidéo, nom, 3 pastilles, dernière fois, consigne,
// grandes lignes de série « 10 × 16 kg », une seule action en bas. Toutes les tailles suivent le Grand affichage (--e).
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
  libelle: { type: String, required: true },
  repere: { type: Object, default: () => ({ lettre: 'A', rang: 1, taille: 1 }) } // { lettre, rang, taille } (reperesBlocs)
})
const emit = defineEmits(['ouvrir-serie', 'action', 'video'])
const enLigne = useEnLigne()

const courante = computed(() => serieCourante(props.item))
const video = computed(() => videoDe(props.exercice))
const bloc = computed(() => {
  const r = props.repere
  if (props.item.supersetId) return `Bloc ${r.lettre} · Superset ${String.fromCharCode(64 + r.rang)} sur ${r.taille}`
  return `Bloc ${r.lettre} · ${r.rang} sur ${r.taille}`
})
const consigne = computed(() => props.item.consignes || props.exercice.description || '')
const etat = (k, s) => (s.faite ? 'fait' : k === courante.value ? 'courant' : 'avenir')
</script>

<template>
  <section class="panel" :data-i="idx" :aria-label="exercice.nom || 'Exercice'">
    <div class="p-corps">
      <div class="p-ligne" data-c>
        <p class="p-bloc">{{ bloc }}</p>
        <button v-if="video.type !== 'aucune' && enLigne" class="lien-video" type="button" @click="emit('video', $event.currentTarget)">
          <Icone nom="lecture" /> Vidéo
        </button>
        <span v-else-if="video.type !== 'aucune'" class="video-absente">Vidéo hors connexion</span>
      </div>
      <h2 class="p-nom" data-c>{{ exercice.nom || 'Exercice' }}</h2>
      <div class="p-meta" data-c>
        <span v-for="p in puces(item, unite)" :key="p">{{ p }}</span>
      </div>
      <p v-if="derniere" class="p-prec" data-c>Dernière fois · {{ derniere }}</p>
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
    </div>
    <div class="p-action" data-c>
      <button class="gros" type="button" data-action @click="emit('action', $event.currentTarget)">{{ libelle }}</button>
      <slot name="sous-action" />
    </div>
  </section>
</template>

<style scoped>
.panel { flex: none; width: 100%; height: 100%; display: flex; flex-direction: column; padding: 4px var(--pad) 0; }
/* tout ce qui précède le bouton défile si le Grand affichage ou un petit écran manque de place : le bouton reste en bas */
.p-corps { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
.p-corps::-webkit-scrollbar { display: none; }
.p-ligne { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: var(--cible); flex: none; }
.p-bloc { font-size: calc(var(--e) * 13px); letter-spacing: .14em; text-transform: uppercase; font-weight: 600; color: var(--accent-lisible); }
.p-nom { font-family: var(--font-titre); font-weight: 400; font-size: calc(var(--e) * 34px); letter-spacing: -.045em; line-height: 1.04; margin: 4px 0 12px; flex: none; overflow-wrap: anywhere; }
.p-meta { display: flex; flex-wrap: wrap; gap: 8px; flex: none; }
.p-meta span { padding: calc(var(--e) * 8px) calc(var(--e) * 13px); border-radius: 14px; background: var(--surface); font-size: calc(var(--e) * 15px); font-weight: 500; }
.p-prec { margin-top: 10px; font-size: calc(var(--e) * 14.5px); color: var(--texte-doux); flex: none; }
.p-note { margin-top: 12px; font-size: calc(var(--e) * 15px); line-height: 1.38; color: var(--texte-doux); padding-left: 14px; border-left: 3px solid var(--accent-lisible); flex: none;
  display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.lien-video { color: var(--texte); font-weight: 600; font-size: calc(var(--e) * 14.5px); display: inline-flex; align-items: center; gap: 6px; min-height: var(--cible); padding: 0 16px 0 12px; border-radius: 999px; background: var(--surface); flex: none; }
.lien-video svg { width: 14px; height: 14px; fill: currentColor; stroke: none; }
.video-absente { font-size: calc(var(--e) * 13px); color: var(--texte-doux); text-align: right; }
.rangs { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1 0 auto; }
.rang { position: relative; flex: 1 1 0; max-height: calc(var(--e) * 76px); min-height: calc(var(--e) * 58px); display: grid; grid-template-columns: calc(var(--e) * 52px) 1fr auto; align-items: center; gap: 4px; padding: 0 16px 0 10px; background: var(--surface); border-radius: 22px; text-align: left; width: 100%; transition: transform .32s var(--ressort); }
.rang:active { transform: scale(.98); transition-duration: .1s; }
.rg-n { font-family: var(--font-chiffres); font-size: calc(var(--e) * 15px); width: calc(var(--e) * 36px); height: calc(var(--e) * 36px); border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; letter-spacing: -.03em; }
.rg-v { font-family: var(--font-chiffres); font-size: calc(var(--e) * 25px); letter-spacing: -.05em; padding-left: 10px; min-width: 0; }
.rg-v b { font-weight: 400; }
.rg-v small { font-family: var(--font-texte); font-size: calc(var(--e) * 15px); letter-spacing: 0; color: var(--texte-doux); margin-left: 3px; }
.rg-v i { font-style: normal; opacity: .4; margin: 0 4px; }
.rg-e { width: calc(var(--e) * 34px); height: calc(var(--e) * 34px); border-radius: 50%; box-shadow: inset 0 0 0 2px var(--filet); display: grid; place-items: center; color: var(--accent-texte); }
.rg-e svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
.rang.fait .rg-e { background: var(--accent); box-shadow: none; }
.rang.fait .rg-e svg { opacity: 1; }
.rang.fait .rg-n { background: transparent; color: var(--texte-doux); }
.rang.courant { background: var(--surface); box-shadow: inset 0 0 0 2.5px var(--accent-lisible); }
.rang.courant .rg-n { background: var(--accent); color: var(--accent-texte); }
.rang.avenir { color: color-mix(in srgb, var(--texte) 55%, transparent); }
/* Peu de séries : les lignes grandissent, les valeurs aussi (lisibilité à bout de bras) */
.rangs[data-n="2"] .rang, .rangs[data-n="3"] .rang { max-height: calc(var(--e) * 124px); grid-template-columns: calc(var(--e) * 62px) 1fr auto; }
.rangs[data-n="2"] .rg-v, .rangs[data-n="3"] .rg-v { font-size: calc(var(--e) * 42px); }
.rangs[data-n="2"] .rg-v small, .rangs[data-n="3"] .rg-v small { font-size: calc(var(--e) * 18px); }
.rangs[data-n="2"] .rg-n, .rangs[data-n="3"] .rg-n { width: calc(var(--e) * 44px); height: calc(var(--e) * 44px); font-size: calc(var(--e) * 17px); }
.rangs[data-n="2"] .rg-e, .rangs[data-n="3"] .rg-e { width: calc(var(--e) * 40px); height: calc(var(--e) * 40px); }
.rangs[data-n="1"] .rang { max-height: calc(var(--e) * 150px); grid-template-columns: calc(var(--e) * 62px) 1fr auto; }
.rangs[data-n="1"] .rg-v { font-size: calc(var(--e) * 52px); }
.rangs[data-n="4"] .rang { max-height: calc(var(--e) * 88px); }
.rangs[data-n="4"] .rg-v { font-size: calc(var(--e) * 30px); }
.p-action { flex: none; padding: 14px 0 var(--bas); }
.p-action .gros { min-height: calc(var(--e) * 72px); font-size: calc(var(--e) * 17px); }
@media (max-height: 700px) {
  .p-note { -webkit-line-clamp: 2; line-clamp: 2; margin-top: 8px; }
  .p-nom { font-size: calc(var(--e) * 28px); margin-bottom: 8px; }
  .rangs { margin-top: 8px; gap: 6px; }
  .rang { min-height: calc(var(--e) * 50px); }
  .rangs[data-n="4"] .rg-v { font-size: calc(var(--e) * 26px); }
}
@media (prefers-reduced-motion: reduce) { .rang { transition: none; } }
</style>
