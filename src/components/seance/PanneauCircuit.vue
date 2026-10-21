<script setup>
// Page d'un circuit dans la séance (M4) : bloc, étiquette de format (AMRAP, EMOM…), but, liste des mouvements avec quantité et vidéo.
// Le bouton « Découvrir le circuit » ouvre la section du circuit (SectionCircuit). Si le circuit est facultatif (« l'option », M2) :
// « Faire l'option » / « Terminer sans l'option ».
import { computed } from 'vue'
import Icone from '../Icone.vue'
import { butCircuit, libelleResultat, minutesDesExercices, titreCircuit } from '../../domain/circuitsUi.js'
import { videoDe } from '../../domain/video.js'
import { useEnLigne } from '../../composables/useEnLigne.js'

const props = defineProps({
  item: { type: Object, required: true },
  idx: { type: Number, required: true },
  exercices: { type: Object, default: () => ({}) }, // bibliothèque indexée par id
  libelle: { type: String, required: true },
  libelleSecondaire: { type: String, default: '' }, // « Terminer sans l'option », « Passer l'option », « Passer ce circuit »
  repere: { type: Object, default: () => ({ lettre: 'A', rang: 1, taille: 1 }) }
})
const emit = defineEmits(['action', 'passer', 'video'])
const enLigne = useEnLigne()

const titre = computed(() => titreCircuit(props.item.format, props.item.params))
const but = computed(() => (props.item.facultatif ? 'Facultatif : une dernière dose, si vous avez encore de l\'énergie.' : butCircuit(props.item.format, props.item.params)))
const kicker = computed(() => (props.item.facultatif ? 'Option · Facultatif' : `Bloc ${props.repere.lettre} · Circuit`))
const fait = computed(() => !!(props.item.faite || props.item.passee)) // fait, ou option passée

// Mouvements : ceux du bloc, sinon les noms listés dans les paramètres (EMOM, superset).
const mouvements = computed(() => {
  const liste = props.item.exercices || []
  const base = liste.length
    ? liste.map((x) => {
      const ex = props.exercices[x.exerciceId] || {}
      return { q: x.reps ? String(x.reps) : '', nom: ex.nom || 'Exercice', note: x.consignes || '', exercice: ex, video: videoDe(ex) }
    })
    : (props.item.params?.exercices || []).map((n) => ({ q: '', nom: n, note: '', exercice: {}, video: { type: 'aucune' } }))
  const minutes = props.item.format === 'emom' ? minutesDesExercices(base.length, props.item.params?.minutes || 10) : []
  return base.map((m, i) => ({ ...m, note: [minutes[i], m.note].filter(Boolean).join(' · ') }))
})
</script>

<template>
  <section class="panel" :data-i="idx" :aria-label="item.nom || titre.nom">
    <div class="p-corps">
      <div class="p-ligne" data-c>
        <p class="p-bloc">{{ kicker }}</p>
        <span class="tag-format">{{ titre.nom }}</span>
      </div>
      <h2 class="p-nom" data-c>{{ titre.nom }}<small>{{ titre.detail }}</small></h2>
      <p v-if="but" class="p-note" data-c>{{ but }}</p>
      <div v-if="fait" class="circuit-fait" data-c><span>Résultat</span><b>{{ item.passee ? 'Option passée' : libelleResultat(item.resultat) }}</b></div>
      <div v-else class="mv-liste" data-c>
        <div v-for="(m, i) in mouvements" :key="i" class="mvt">
          <span class="q">{{ m.q || i + 1 }}</span>
          <span class="n"><b>{{ m.nom }}</b><small v-if="m.note">{{ m.note }}</small></span>
          <button v-if="m.video.type !== 'aucune' && enLigne" class="mv-video" type="button" :aria-label="`Voir la vidéo : ${m.nom}`" @click="emit('video', m.exercice, $event.currentTarget)">
            <Icone nom="lecture" />
          </button>
          <small v-else-if="m.video.type !== 'aucune'" class="mv-hors">hors connexion</small>
        </div>
      </div>
    </div>
    <div class="p-action" data-c>
      <button class="gros" type="button" data-action @click="emit('action', $event.currentTarget)">{{ libelle }}<Icone v-if="!fait" nom="fleche" /></button>
      <button v-if="!fait && libelleSecondaire" class="gros doux secondaire" :class="{ lien: !item.facultatif }" type="button" data-passer @click="emit('passer')">{{ libelleSecondaire }}</button>
    </div>
  </section>
</template>

<style scoped>
.panel { flex: none; width: 100%; height: 100%; display: flex; flex-direction: column; padding: 4px var(--pad) 0; }
.p-corps { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
.p-corps::-webkit-scrollbar { display: none; }
.p-ligne { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: var(--cible); flex: none; }
.p-bloc { font-size: calc(var(--e) * 13px); letter-spacing: .14em; text-transform: uppercase; font-weight: 600; color: var(--accent-lisible); }
.p-nom { font-family: var(--font-titre); font-weight: 400; font-size: calc(var(--e) * 58px); letter-spacing: -.055em; line-height: .98; margin: 6px 0 14px; flex: none; overflow-wrap: anywhere; }
.p-nom small { display: block; font-size: .46em; letter-spacing: -.035em; color: var(--texte-doux); margin-top: 4px; line-height: 1.1; }
.p-note { font-size: calc(var(--e) * 15px); line-height: 1.38; color: var(--texte-doux); padding-left: 14px; border-left: 3px solid var(--accent-lisible); margin-bottom: 16px; flex: none; }
.mv-liste { background: var(--surface); border-radius: 22px; padding: 4px 8px 4px 16px; flex: none; }
.mvt { display: flex; align-items: center; gap: 14px; padding: 12px 0; min-height: calc(var(--e) * 72px); }
.mvt + .mvt { border-top: 1px solid var(--filet); }
.mvt .q { font-family: var(--font-chiffres); font-size: calc(var(--e) * 32px); letter-spacing: -.06em; min-width: calc(var(--e) * 46px); }
.mvt .n { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mvt .n b { font-size: calc(var(--e) * 17px); font-weight: 600; line-height: 1.2; }
.mvt .n small { font-size: calc(var(--e) * 13.5px); color: var(--texte-doux); line-height: 1.3; }
.mv-video { width: var(--cible); height: var(--cible); border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; flex: none; }
.mv-video svg { width: 16px; height: 16px; fill: currentColor; stroke: none; }
.mv-hors { font-size: calc(var(--e) * 12.5px); color: var(--texte-doux); }
.circuit-fait { display: flex; flex-direction: column; gap: 6px; background: var(--surface); border-radius: 22px; padding: 18px; flex: none; }
.circuit-fait span { font-size: calc(var(--e) * 13px); letter-spacing: .14em; text-transform: uppercase; font-weight: 600; color: var(--texte-doux); }
.circuit-fait b { font-family: var(--font-chiffres); font-weight: 400; font-size: calc(var(--e) * 34px); color: var(--texte); letter-spacing: -.05em; }
.p-action { flex: none; padding: 14px 0 var(--bas); display: flex; flex-direction: column; gap: 10px; }
.p-action .gros { min-height: calc(var(--e) * 72px); font-size: calc(var(--e) * 17px); }
.p-action .gros :deep(svg) { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.p-action .secondaire { min-height: calc(var(--e) * 64px); }
/* circuit obligatoire : « Passer ce circuit » reste discret, comme un lien */
.p-action .secondaire.lien { background: none; color: var(--texte-doux); min-height: var(--cible); font-weight: 500; font-size: calc(var(--e) * 15px); }
@media (max-height: 700px) { .p-nom { font-size: calc(var(--e) * 46px); } .mvt { min-height: calc(var(--e) * 62px); padding: 8px 0; } }
</style>
