<script setup>
// Un exercice dans un bloc (ou dans un superset) : choix, séries, champs et « modifiable par le client ».
import { reactive, ref } from 'vue'
import { CHAMPS } from '../../domain/modele.js'
import { CLES_CHAMPS, basculerChamp, clePerso, estPerso, fixerNbSeries, libelleChamp } from '../logique.js'
import SelecteurExercice from './SelecteurExercice.vue'

const props = defineProps({ item: { type: Object, required: true }, exercices: { type: Array, required: true }, titre: { type: String, default: '' } })
const emit = defineEmits(['update:item'])

const persoTexte = ref('')
const maj = (patch) => emit('update:item', { ...props.item, ...patch })

function setSerie(i, cle, valeur) {
  const series = props.item.series.map((s, j) => (j === i ? { ...s, [cle]: valeur } : s))
  maj({ series })
}
const toggle = (cle) => emit('update:item', basculerChamp(props.item, cle))
const aChamp = (cle) => props.item.champs.some((c) => c.cle === cle)
const setModifiable = (cle, v) => maj({ champs: props.item.champs.map((c) => (c.cle === cle ? { ...c, modifiableParClient: v } : c)) })

function ajouterPerso() {
  const libelle = persoTexte.value.trim()
  if (!libelle) return
  const cle = clePerso(libelle, props.item.champs.map((c) => c.cle))
  emit('update:item', basculerChamp(props.item, cle, libelle))
  persoTexte.value = ''
}

// Valeur saisie -> nombre pour les champs numériques.
const lire = (cle, ev) => {
  const spec = CHAMPS[cle]
  if (spec?.type === 'nombre') return ev.target.value === '' ? 0 : Number(ev.target.value)
  if (spec?.type === 'booleen') return ev.target.checked
  return ev.target.value
}
</script>

<template>
  <div>
    <div class="c-ligne c-bas">
      <div style="flex: 1; min-width: 220px">
        <SelecteurExercice :model-value="item.exerciceId" :exercices="exercices" :label="titre || 'Exercice'" @update:model-value="maj({ exerciceId: $event })" />
      </div>
      <label class="c-court">Séries
        <input type="number" min="1" max="20" :value="item.series.length" @change="emit('update:item', fixerNbSeries(item, Number($event.target.value)))" />
      </label>
    </div>

    <div class="c-champs" role="group" aria-label="Champs de l'exercice">
      <button v-for="cle in CLES_CHAMPS" :key="cle" type="button" class="c-champ" :aria-pressed="aChamp(cle)" @click="toggle(cle)">{{ CHAMPS[cle].label }}</button>
      <button v-for="c in item.champs.filter((c) => estPerso(c.cle))" :key="c.cle" type="button" class="c-champ" aria-pressed="true" :title="'Retirer ce champ'" @click="toggle(c.cle)">{{ libelleChamp(c) }} ✕</button>
      <span class="c-ligne" style="gap: 4px">
        <input v-model="persoTexte" class="c-moyen" placeholder="Champ perso…" aria-label="Nom d'un champ personnalisé" style="min-height: 30px" @keydown.enter.prevent="ajouterPerso" />
        <button type="button" class="c-btn c-mini" @click="ajouterPerso">Ajouter</button>
      </span>
    </div>

    <div v-if="item.champs.length" class="c-defil">
      <table class="c-table">
        <thead>
          <tr>
            <th>#</th>
            <th v-for="c in item.champs" :key="c.cle">
              {{ libelleChamp(c) }}<span v-if="CHAMPS[c.cle]?.unite" class="c-doux"> ({{ CHAMPS[c.cle].unite }})</span>
              <label class="c-case c-petit" style="margin-top: 2px" title="Le client peut modifier cette valeur pendant la séance"><input type="checkbox" :checked="c.modifiableParClient" @change="setModifiable(c.cle, $event.target.checked)" />Client modifie</label>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in item.series" :key="i">
            <td class="c-doux">{{ i + 1 }}</td>
            <td v-for="c in item.champs" :key="c.cle">
              <input v-if="CHAMPS[c.cle]?.type === 'booleen'" type="checkbox" :checked="s[c.cle]" :aria-label="libelleChamp(c)" @change="setSerie(i, c.cle, lire(c.cle, $event))" />
              <select v-else-if="CHAMPS[c.cle]?.type === 'choix'" :value="s[c.cle]" @change="setSerie(i, c.cle, $event.target.value)">
                <option v-for="o in CHAMPS[c.cle].choix" :key="o" :value="o">{{ o }}</option>
              </select>
              <input v-else-if="CHAMPS[c.cle]?.type === 'nombre'" type="number" :min="CHAMPS[c.cle].min" :max="CHAMPS[c.cle].max" :step="CHAMPS[c.cle].pas" :value="s[c.cle]" class="c-court" :aria-label="`${libelleChamp(c)} série ${i + 1}`" @input="setSerie(i, c.cle, lire(c.cle, $event))" />
              <input v-else type="text" :value="s[c.cle]" class="c-moyen" :aria-label="`${libelleChamp(c)} série ${i + 1}`" @input="setSerie(i, c.cle, $event.target.value)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="c-doux c-petit">Aucun champ : choisis au moins un champ ci-dessus.</p>
  </div>
</template>
