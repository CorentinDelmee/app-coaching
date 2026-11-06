<script setup>
// Un exercice dans un bloc (ou un superset) : exercice choisi (vignette, « Changer »), séries, champs suivis
// (+ champs perso), valeurs par série, « le client peut modifier ». Reprend tout l'ancien ItemExercice.
// Émet `maj` avec l'item complet modifié (le parent fait Object.assign : l'id ne change pas, le focus reste).
import { ref } from 'vue'
import { CHAMPS } from '../../../../../domain/modele.js'
import { CLES_CHAMPS, basculerChamp, clePerso, estPerso, fixerNbSeries, libelleChamp } from '../../../../logique.js'
import VignetteMini from '../commun/VignetteMini.vue'

const props = defineProps({
  item: { type: Object, required: true },
  exercice: { type: Object, default: null },   // fiche de l'exercice choisi (null = pas encore choisi / supprimé)
  titre: { type: String, default: '' },          // « A », « B » dans un superset
  remplacement: { type: Boolean, default: false } // la bibliothèque attend le nouvel exercice pour cet item
})
const emit = defineEmits(['maj', 'choisir'])

const persoTexte = ref('')
const maj = (patch) => emit('maj', { ...props.item, ...patch })
const setSerie = (i, cle, valeur) => maj({ series: props.item.series.map((s, j) => (j === i ? { ...s, [cle]: valeur } : s)) })
const aChamp = (cle) => props.item.champs.some((c) => c.cle === cle)
const toggle = (cle) => emit('maj', basculerChamp(props.item, cle))
const setModifiable = (cle, v) => maj({ champs: props.item.champs.map((c) => (c.cle === cle ? { ...c, modifiableParClient: v } : c)) })
function ajouterPerso() {
  const libelle = persoTexte.value.trim()
  if (!libelle) return
  emit('maj', basculerChamp(props.item, clePerso(libelle, props.item.champs.map((c) => c.cle)), libelle))
  persoTexte.value = ''
}
function nbSeries(n) {
  const v = Math.max(1, Math.min(20, Math.round(Number(n) || 1)))
  if (v !== props.item.series.length) emit('maj', fixerNbSeries(props.item, v))
}
const lire = (cle, ev) => {
  const spec = CHAMPS[cle]
  if (spec?.type === 'nombre') return ev.target.value === '' ? 0 : Number(ev.target.value)
  if (spec?.type === 'booleen') return ev.target.checked
  return ev.target.value
}
const champsOuverts = ref(false)
</script>

<template>
  <div class="st-prog-s-item">
    <div class="st-prog-s-choix">
      <span v-if="titre" class="st-prog-s-lettre" aria-hidden="true">{{ titre }}</span>
      <VignetteMini v-if="exercice" :exercice="exercice" tag="div" class="st-prog-s-actuel" />
      <p v-else class="st-prog-s-manque">{{ item.exerciceId ? 'Exercice introuvable (supprimé ?)' : 'Aucun exercice choisi' }}</p>
      <button type="button" class="st-btn st-prog-mini" :class="{ 'st-btn--encre': remplacement }" :aria-pressed="remplacement" @click="emit('choisir')">
        {{ remplacement ? 'Choisis dans la bibliothèque…' : exercice ? 'Changer' : 'Choisir' }}<span class="st-sr"> l'exercice {{ titre }}</span>
      </button>
      <label class="st-prog-s-pas">Séries
        <span class="st-prog-s-stepper">
          <button type="button" aria-label="Une série de moins" :disabled="item.series.length <= 1" @click="nbSeries(item.series.length - 1)">−</button>
          <input type="number" min="1" max="20" inputmode="numeric" :value="item.series.length" @change="nbSeries($event.target.value)" />
          <button type="button" aria-label="Une série de plus" :disabled="item.series.length >= 20" @click="nbSeries(item.series.length + 1)">+</button>
        </span>
      </label>
    </div>

    <div class="st-prog-s-champs">
      <button type="button" class="st-prog-lien" :aria-expanded="champsOuverts" @click="champsOuverts = !champsOuverts">
        Champs suivis : {{ item.champs.map(libelleChamp).join(', ') || 'aucun' }} <span aria-hidden="true">{{ champsOuverts ? '▴' : '▾' }}</span>
      </button>
      <div v-if="champsOuverts" class="st-prog-s-jetons" role="group" aria-label="Champs de l'exercice">
        <button v-for="cle in CLES_CHAMPS" :key="cle" type="button" class="st-prog-s-jeton" :aria-pressed="aChamp(cle)" @click="toggle(cle)">{{ CHAMPS[cle].label }}</button>
        <button v-for="c in item.champs.filter((c) => estPerso(c.cle))" :key="c.cle" type="button" class="st-prog-s-jeton" aria-pressed="true" :aria-label="`Retirer le champ ${libelleChamp(c)}`" @click="toggle(c.cle)">{{ libelleChamp(c) }} ✕</button>
        <span class="st-prog-s-perso">
          <input v-model="persoTexte" placeholder="Champ perso…" aria-label="Nom d'un champ personnalisé" @keydown.enter.prevent="ajouterPerso" />
          <button type="button" class="st-btn st-prog-mini" @click="ajouterPerso">Ajouter</button>
        </span>
      </div>
    </div>

    <div v-if="item.champs.length" class="st-prog-s-defil">
      <table class="st-prog-s-table">
        <thead>
          <tr>
            <th scope="col">Série</th>
            <th v-for="c in item.champs" :key="c.cle" scope="col">
              {{ libelleChamp(c) }}<span v-if="CHAMPS[c.cle]?.unite" class="st-prog-s-unite"> {{ CHAMPS[c.cle].unite }}</span>
              <label class="st-prog-s-modif" title="Le client peut modifier cette valeur pendant la séance"><input type="checkbox" :checked="c.modifiableParClient" @change="setModifiable(c.cle, $event.target.checked)" />client modifie</label>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in item.series" :key="i">
            <th scope="row">{{ i + 1 }}</th>
            <td v-for="c in item.champs" :key="c.cle">
              <input v-if="CHAMPS[c.cle]?.type === 'booleen'" type="checkbox" :checked="s[c.cle]" :aria-label="`${libelleChamp(c)} série ${i + 1}`" @change="setSerie(i, c.cle, lire(c.cle, $event))" />
              <select v-else-if="CHAMPS[c.cle]?.type === 'choix'" :value="s[c.cle]" :aria-label="`${libelleChamp(c)} série ${i + 1}`" @change="setSerie(i, c.cle, $event.target.value)">
                <option v-for="o in CHAMPS[c.cle].choix" :key="o" :value="o">{{ o }}</option>
              </select>
              <input v-else-if="CHAMPS[c.cle]?.type === 'nombre'" type="number" inputmode="decimal" :min="CHAMPS[c.cle].min" :max="CHAMPS[c.cle].max" :step="CHAMPS[c.cle].pas" :value="s[c.cle]" :aria-label="`${libelleChamp(c)} série ${i + 1}`" @input="setSerie(i, c.cle, lire(c.cle, $event))" />
              <input v-else type="text" :value="s[c.cle]" class="st-prog-s-texte" :aria-label="`${libelleChamp(c)} série ${i + 1}`" @input="setSerie(i, c.cle, $event.target.value)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="st-prog-s-aide">Aucun champ : ouvre « Champs suivis » et choisis-en au moins un.</p>
  </div>
</template>
