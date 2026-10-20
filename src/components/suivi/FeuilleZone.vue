<script setup>
// Feuille de saisie d'une zone de la carte du corps : dernière note, courbe de la zone, curseur d'intensité 0-10.
// Au-delà de 6, le client est prévenu que le coach le sera aussi (règle d'alerte de domain/alertes.js).
import { computed, ref, watch } from 'vue'
import FeuilleBas from '../seance/FeuilleBas.vue'
import CurseurDix from '../CurseurDix.vue'
import Courbe from './Courbe.vue'
import { SEUIL_DOULEUR } from '../../domain/alertes.js'
import { derniereNote, historiqueZone, libelleZone } from '../../domain/corps.js'
import { dateCourte } from '../../domain/graphique.js'

const props = defineProps({
  zone: { type: String, default: null },     // id de la zone ouverte (null = fermée)
  douleurs: { type: Array, required: true },
  aujourdhui: { type: String, required: true },
  enregistrement: { type: Boolean, default: false },
  erreur: { type: String, default: '' }
})
const emit = defineEmits(['fermer', 'enregistrer'])

const intensite = ref(3)
const historique = computed(() => (props.zone ? historiqueZone(props.douleurs, props.zone) : []))
const note = computed(() => (props.zone ? derniereNote(props.douleurs, props.zone, props.aujourdhui) : null))
const statut = computed(() => (note.value ? `Dernière note : ${note.value.intensite}/10 (${dateCourte(note.value.date)})` : 'Aucune douleur notée'))
// Le curseur part de la dernière intensité (si elle est encore d'actualité), sinon d'un niveau modéré.
watch(() => props.zone, (z) => { if (z) intensite.value = note.value && note.value.intensite > 0 && note.value.recente ? note.value.intensite : 3 })
</script>

<template>
  <FeuilleBas :ouverte="!!zone" :titre="zone ? libelleZone(zone) : ''" @fermer="emit('fermer')">
    <template v-if="zone">
      <p class="fz-statut">{{ statut }}</p>
      <Courbe v-if="historique.length" :key="zone" :points="historique" unite="/10" :titre="libelleZone(zone)" :domaine="[0, 10]" :hauteur="130" :delai="0.35" />
      <CurseurDix v-model="intensite" compact :etiquettes="['Aucune', 'Insupportable']" :label="`Intensité de la douleur, ${libelleZone(zone)}`" />
      <p class="fz-alerte" :class="{ visible: intensite > SEUIL_DOULEUR }" role="status">
        {{ intensite > SEUIL_DOULEUR ? 'Corentin sera prévenu pour adapter vos séances.' : '' }}
      </p>
      <p v-if="erreur" class="fz-erreur" role="alert">{{ erreur }}</p>
      <button class="gros" type="button" :disabled="enregistrement" @click="emit('enregistrer', intensite)">
        {{ enregistrement ? 'Enregistrement…' : intensite === 0 ? 'Noter : plus de douleur' : 'Enregistrer' }}
      </button>
    </template>
  </FeuilleBas>
</template>

<style scoped>
.fz-statut { margin: 4px 0 10px !important; }
.fz-alerte { min-height: 22px; margin: 4px 0 12px !important; font-size: 15px !important; font-weight: 600; color: var(--accent-lisible) !important; text-align: center; }
.fz-erreur { margin: 0 0 10px !important; padding: 10px 14px; border-radius: 14px; background: var(--surface-2); color: var(--texte) !important; font-size: 15px !important; box-shadow: inset 0 0 0 2px var(--accent-lisible); }
</style>
