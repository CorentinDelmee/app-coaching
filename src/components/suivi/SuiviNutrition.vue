<script setup>
// Nutrition selon les modules activés par le coach : habitudes à cocher (avec les 7 derniers jours), photos de repas, check-in calories.
// Un module désactivé n'apparaît pas du tout. La page reçoit les événements et écrit dans data.nutrition.
import { computed } from 'vue'
import { gsap } from 'gsap'
import Courbe from './Courbe.vue'
import { REPAS, caloriesDuJour, habitudeFaite, nomsHabitudes, pointsCalories, repasDuJour, repasPrecedents, semaineHabitude, serieHabitude } from '../../domain/suivi.js'
import { dateCourte } from '../../domain/graphique.js'
import { nombreFr } from '../../domain/unites.js'
import { mouvementReduit } from '../../anim/transitions.js'

const props = defineProps({
  modules: { type: Object, required: true },   // { habitudes, photosRepas, calories }
  entrees: { type: Array, required: true },
  aujourdhui: { type: String, required: true },
  occupe: { type: String, default: '' },       // repas en cours de traitement (photo)
  erreur: { type: String, default: '' },
  liste: { type: Array, default: () => [] },   // habitudes définies par le coach (vide = liste par défaut)
  urls: { type: Object, default: () => ({}) }  // photo enregistrée -> adresse affichable (URL signée en mode Supabase)
})
const emit = defineEmits(['habitude', 'photo', 'calories'])

const habitudes = computed(() => nomsHabitudes(props.entrees, props.liste).map((nom) => ({
  nom, fait: habitudeFaite(props.entrees, nom, props.aujourdhui), serie: serieHabitude(props.entrees, nom, props.aujourdhui),
  semaine: semaineHabitude(props.entrees, nom, props.aujourdhui)
})))
const nbFaites = computed(() => habitudes.value.filter((h) => h.fait).length)
const repasAuj = computed(() => REPAS.map((nom) => ({ nom, entree: repasDuJour(props.entrees, nom, props.aujourdhui) })))
const precedents = computed(() => repasPrecedents(props.entrees, props.aujourdhui))
const kcal = computed(() => caloriesDuJour(props.entrees, props.aujourdhui))
const pointsKcal = computed(() => pointsCalories(props.entrees, props.aujourdhui))

function cocher(h, e) {
  const bouton = e.currentTarget
  if (!mouvementReduit() && !h.fait) {
    gsap.fromTo(bouton, { scale: 0.8 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1,.45)', clearProps: 'transform' })
    gsap.fromTo(bouton.querySelector('path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' })
  }
  emit('habitude', { nom: h.nom, fait: !h.fait })
}
function photo(repas, e) {
  const fichier = e.target.files?.[0]
  e.target.value = ''
  if (fichier) emit('photo', { repas, fichier })
}
const sem = (h) => `7 derniers jours : ${h.semaine.filter((j) => j.fait).length} sur 7`
</script>

<template>
  <div class="nutrition">
    <section v-if="modules.habitudes" class="nu-bloc" aria-labelledby="nu-hab">
      <h3 id="nu-hab">Habitudes du jour <span>{{ nbFaites }}/{{ habitudes.length }}</span></h3>
      <ul class="nu-habs">
        <li v-for="h in habitudes" :key="h.nom" class="hab" :class="{ fait: h.fait }">
          <button class="hab-case" type="button" role="checkbox" :aria-checked="h.fait" :aria-label="h.nom" @click="cocher(h, $event)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" style="stroke-dasharray: 1" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </button>
          <span class="hab-nom">{{ h.nom }}<small v-if="h.serie >= 2">{{ h.serie }} jours d'affilée</small></span>
          <span class="hab-sem" role="img" :aria-label="sem(h)"><i v-for="j in h.semaine" :key="j.jour" :class="{ on: j.fait }"></i></span>
        </li>
      </ul>
    </section>

    <section v-if="modules.photosRepas" class="nu-bloc" aria-labelledby="nu-rep">
      <h3 id="nu-rep">Photos de repas</h3>
      <div class="nu-repas">
        <label v-for="r in repasAuj" :key="r.nom" class="repas" :class="{ pris: !!r.entree, occupe: occupe === r.nom }">
          <input type="file" accept="image/*" capture="environment" :aria-label="`${r.entree ? 'Remplacer la photo du' : 'Photographier le'} ${r.nom.toLowerCase()}`" @change="photo(r.nom, $event)">
          <img v-if="r.entree" :src="urls[r.entree.valeur.photo] || r.entree.valeur.photo" :alt="`${r.nom} d'aujourd'hui`" width="160" height="160">
          <span class="repas-nom">{{ occupe === r.nom ? 'Enregistrement…' : r.nom }}</span>
          <svg v-if="!r.entree" class="repas-plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </label>
      </div>
      <p v-if="erreur" class="nu-erreur" role="alert">{{ erreur }}</p>
      <div v-if="precedents.length" class="nu-precedents" aria-label="Photos des jours précédents">
        <figure v-for="e in precedents" :key="e.id">
          <img :src="urls[e.valeur.photo] || e.valeur.photo" :alt="`${e.valeur.repas}, ${dateCourte(e.date)}`" loading="lazy" width="72" height="72">
          <figcaption>{{ dateCourte(e.date) }}</figcaption>
        </figure>
      </div>
    </section>

    <section v-if="modules.calories" class="nu-bloc" aria-labelledby="nu-cal">
      <h3 id="nu-cal">Check-in calories</h3>
      <button class="nu-kcal" type="button" :aria-label="`Calories du jour : ${kcal === null ? 'à noter' : nombreFr(kcal) + ' kilocalories'}`" @click="emit('calories', $event.currentTarget)">
        <span class="nu-kcal-val">{{ kcal === null ? '—' : nombreFr(kcal) }}<small>kcal</small></span>
        <span class="nu-kcal-aide">{{ kcal === null ? "Touchez pour noter aujourd'hui" : "Aujourd'hui · touchez pour modifier" }}</span>
      </button>
      <Courbe v-if="pointsKcal.length" :points="pointsKcal" unite="kcal" titre="Calories" :hauteur="150" />
      <p v-if="pointsKcal.length === 1" class="nu-note">Une 2e journée et la courbe apparaîtra.</p>
    </section>
  </div>
</template>

<style scoped>
.nu-bloc + .nu-bloc { margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--filet); }
.nu-bloc h3 { display: flex; align-items: baseline; justify-content: space-between; font-family: var(--font-titre); font-weight: 400; font-size: 16px; letter-spacing: -.03em; margin-bottom: 12px; }
.nu-bloc h3 span { font-family: var(--font-chiffres); font-size: 14px; color: var(--texte-doux); }

.hab { display: flex; align-items: center; gap: 14px; min-height: 64px; border-top: 1px solid var(--filet); }
.hab:first-child { border-top: 0; }
.hab-case { width: 48px; height: 48px; border-radius: 16px; flex: none; display: grid; place-items: center; background: var(--surface-2); box-shadow: inset 0 0 0 2px var(--filet); transition: background-color .2s; }
.hab-case svg { width: 24px; height: 24px; stroke: var(--accent-texte); fill: none; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
.hab.fait .hab-case { background: var(--accent); box-shadow: none; }
.hab.fait .hab-case svg { opacity: 1; }
.hab-nom { flex: 1; min-width: 0; font-weight: 600; font-size: 16.5px; line-height: 1.2; }
.hab-nom small { display: block; font-weight: 400; font-size: 13.5px; color: var(--texte-doux); margin-top: 2px; }
.hab-sem { display: flex; gap: 4px; flex: none; }
.hab-sem i { width: 8px; height: 8px; border-radius: 50%; background: var(--filet); }
.hab-sem i.on { background: var(--accent-lisible); }

.nu-repas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.repas { position: relative; aspect-ratio: 1; border-radius: 22px; background: var(--surface-2); overflow: hidden; display: grid; place-items: center; cursor: pointer; }
.repas input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.repas img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.repas-nom { position: absolute; left: 10px; bottom: 10px; padding: 6px 12px; border-radius: 14px; background: var(--fond); font-size: 14px; font-weight: 600; }
.repas-plus { width: 34px; height: 34px; margin-bottom: 26px; stroke: var(--accent-lisible); fill: none; stroke-width: 2.6; stroke-linecap: round; }
.repas.occupe { opacity: .6; }
.repas:focus-within { outline: 3px solid var(--accent-lisible); outline-offset: 2px; }
.nu-erreur { margin-top: 10px; padding: 10px 14px; border-radius: 14px; background: var(--surface-2); font-size: 15px; font-weight: 600; box-shadow: inset 0 0 0 2px var(--accent-lisible); }
.nu-precedents { display: flex; gap: 10px; margin-top: 14px; overflow-x: auto; scrollbar-width: none; }
.nu-precedents::-webkit-scrollbar { display: none; }
.nu-precedents figure { flex: none; width: 72px; font-size: 12px; color: var(--texte-doux); text-align: center; }
.nu-precedents img { display: block; width: 72px; height: 72px; object-fit: cover; border-radius: 16px; margin-bottom: 4px; }

.nu-kcal { width: 100%; min-height: 110px; border-radius: var(--r-carte); background: var(--surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; margin-bottom: 14px; transition: transform .14s var(--ease); }
.nu-kcal:active { transform: scale(.98); }
.nu-kcal-val { font-family: var(--font-chiffres); font-size: 48px; letter-spacing: -.06em; line-height: 1.1; color: var(--accent-lisible); font-variant-numeric: tabular-nums; }
.nu-kcal-val small { font-family: var(--font-texte); font-size: 20px; letter-spacing: 0; font-weight: 600; color: var(--texte-doux); margin-left: 6px; }
.nu-kcal-aide { font-size: 14.5px; color: var(--texte-doux); font-weight: 600; }
.nu-note { margin-top: 8px; font-size: 14.5px; color: var(--texte-doux); text-align: center; }
@media (prefers-reduced-motion: reduce) { .hab-case, .nu-kcal { transition: none; } }
</style>
