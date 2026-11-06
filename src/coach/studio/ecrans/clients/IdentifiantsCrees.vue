<script setup>
// Identifiant + code à transmettre tout de suite (affichés une seule fois) : copier le message, copier, WhatsApp.
import { ref } from 'vue'
import { lienWhatsApp } from '../../../../domain/coaching.js'
import { messageAcces, normaliserTelephone } from './logique.js'
import IconeSt from '../../IconeSt.vue'

const props = defineProps({ infos: { type: Object, required: true }, titre: { type: String, default: '' } }) // { nom, identifiant, code, url, numero? }
defineEmits(['termine'])
const copie = ref('')
async function copier(texte, quoi) {
  try { await navigator.clipboard.writeText(texte); copie.value = quoi } catch { copie.value = 'Copie impossible : sélectionne le texte à la main' }
  setTimeout(() => { copie.value = '' }, 2200)
}
</script>

<template>
  <div class="st-clients-codes" role="status">
    <h2 v-if="titre">{{ titre }}</h2>
    <p class="st-clients-doux">Ce code ne sera plus affiché ensuite : transmets-le maintenant.</p>
    <div class="st-clients-codes-val">
      <div><span>Identifiant</span><b>{{ infos.identifiant }}</b></div>
      <div><span>Code</span><b>{{ infos.code }}</b></div>
    </div>
    <div class="st-clients-boutons">
      <button type="button" class="st-btn" @click="copier(messageAcces(infos), 'Message copié')">Copier le message</button>
      <button type="button" class="st-btn" @click="copier(`${infos.identifiant} / ${infos.code}`, 'Identifiants copiés')">Copier identifiant + code</button>
      <a class="st-btn st-btn--encre" :href="lienWhatsApp(normaliserTelephone(props.infos.numero), messageAcces(infos))" target="_blank" rel="noopener">Envoyer par WhatsApp</a>
      <button type="button" class="st-btn st-btn--fantome" @click="$emit('termine')"><IconeSt nom="check" />Terminé</button>
      <span v-if="copie" class="st-clients-ok" role="status">{{ copie }}</span>
    </div>
  </div>
</template>
