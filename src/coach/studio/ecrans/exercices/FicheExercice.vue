<script setup>
// Contenu du panneau d'un exercice : tous les champs du contrat, sauvegarde automatique (useSauvegardeAuto).
// Monté avec :key="exercice.id" : changer d'exercice démonte la fiche, ce qui écrit ce qui reste (arreter()).
// Émet : etat (état de sauvegarde), maj (exercice renvoyé par le serveur), archive (exercice archivé).
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useSauvegardeAuto } from '../../useSauvegardeAuto.js'
import { toast } from '../../toast.js'
import Puce from '../../Puce.vue'
import { NOMS_MUSCLES, TEINTES_STUDIO, NIVEAUX, statutVideo, teinteDe, dureeCourte, urlPhoto } from '../../medias.js'
import { CATEGORIES, libelleCategorie } from '../../../logique.js'
import { versFormulaire, construirePatch, basculer, messageErreurExo } from './logique.js'
import * as D from './donnees.js'

const props = defineProps({
  exercice: { type: Object, required: true },
  materiels: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] }
})
const emit = defineEmits(['etat', 'maj', 'archive'])

const ref0 = ref({ ...props.exercice })        // dernière version connue du serveur (base du PATCH)
const form = reactive(versFormulaire(props.exercice))
const erreurs = ref({})
const id = props.exercice.id
const p = (c) => `st-exo-${c}`                 // identifiants de champs

const s = useSauvegardeAuto(async (patch) => {
  const item = await D.mettreAJour(id, patch)
  if (item) { ref0.value = { ...ref0.value, ...item }; emit('maj', item) }
}, { delai: 500 })
watch(s.etat, (e) => emit('etat', e), { immediate: true })
watch(s.erreur, (e) => { if (e) toast(messageErreurExo(e)) })

function planifier() {
  const { patch, erreurs: er } = construirePatch(ref0.value, form)
  erreurs.value = er
  if (Object.keys(er).length || !Object.keys(patch).length) return
  // Carte de la grille à jour tout de suite (le serveur confirmera)
  emit('maj', { id, ...patch })
  s.planifier(patch)
}
watch(form, planifier, { deep: true })
onBeforeUnmount(() => s.arreter())
defineExpose({ reessayer: () => s.reessayer(), enregistrer: () => s.maintenant() })

// Muscles : les 8 teintes + les mots libres déjà présents (ex. « Fessiers » importé)
const optionsMuscles = (champ) => [...TEINTES_STUDIO.map((t) => ({ v: t, texte: NOMS_MUSCLES[t], m: t })),
  ...form[champ].filter((x) => !TEINTES_STUDIO.includes(x)).map((x) => ({ v: x, texte: nomMuscle(x), m: teinteDe(x) }))]
const nomMuscle = (m) => NOMS_MUSCLES[m] || (m.charAt(0).toUpperCase() + m.slice(1))
const etiquettes = computed(() => [...new Set([...Object.keys(CATEGORIES), ...form.categories])])
const nouveauMateriel = ref('')
function ajouterMateriel() {
  const v = nouveauMateriel.value.trim()
  if (v && !form.materiel.includes(v)) form.materiel.push(v)
  nouveauMateriel.value = ''
}
const listeMateriels = computed(() => [...new Set([...props.materiels, ...form.materiel])])

// Vidéo
const statut = computed(() => statutVideo({ ...ref0.value, lienVideo: form.lienVideo }))
const video = computed(() => ref0.value.video)
async function valider() {
  try {
    const item = await D.validerVideo(id)
    ref0.value = { ...ref0.value, ...item }; emit('maj', item)
    toast('Vidéo validée')
  } catch (e) { toast(messageErreurExo(e)) }
}

// Photo : réduite dans le navigateur puis envoyée
const survol = ref(false)
const envoi = ref(false)
const aPhoto = computed(() => !!urlPhoto(ref0.value))
async function photo(fichier) {
  survol.value = false
  if (!fichier) return
  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) { toast('Format refusé : JPG, PNG ou WebP.'); return }
  envoi.value = true
  try {
    const blob = await D.reduireImage(fichier)
    const item = await D.envoyerPhoto(id, blob)
    ref0.value = { ...ref0.value, ...item }; emit('maj', item)
    toast('Photo enregistrée')
  } catch (e) { toast(messageErreurExo(e)) } finally { envoi.value = false }
}
async function retirer() {
  try { const item = await D.retirerPhoto(id); ref0.value = { ...ref0.value, ...item }; emit('maj', item); toast('Photo retirée') } catch (e) { toast(messageErreurExo(e)) }
}
const deposer = (ev) => photo(ev.dataTransfer?.files?.[0])

// Archiver : confirmation en deux appuis dans la page (pas de confirm())
const confirmer = ref(false)
let minuteurConfirmer = null
async function archiver() {
  if (!confirmer.value) { confirmer.value = true; clearTimeout(minuteurConfirmer); minuteurConfirmer = setTimeout(() => { confirmer.value = false }, 4000); return }
  clearTimeout(minuteurConfirmer)
  await s.maintenant()
  try { await D.archiver(id); emit('archive', id); toast(`« ${form.nom} » archivé`) } catch (e) { toast(messageErreurExo(e)) }
}
onBeforeUnmount(() => clearTimeout(minuteurConfirmer))

const utilise = computed(() => ref0.value.utiliseDans)
const utiliseProg = computed(() => ref0.value.utiliseDansProgrammes)
</script>

<template>
  <div class="st-exo-tete">
    <label class="st-sr" :for="p('nom')">Nom de l'exercice</label>
    <textarea :id="p('nom')" v-model="form.nom" data-test="exo-nom" class="st-exo-nom" rows="1" maxlength="120" :aria-invalid="!!erreurs.nom" :aria-describedby="erreurs.nom ? p('e-nom') : undefined" />
    <p v-if="erreurs.nom" :id="p('e-nom')" class="st-exo-err">{{ erreurs.nom }}</p>
    <div class="st-exo-statut">
      <Puce v-if="statut === 'propose'" variante="propose" point>Vidéo proposée par Claude</Puce>
      <Puce v-else-if="statut === 'valide'" variante="ok" point>Vidéo validée</Puce>
      <Puce v-else>Aucune vidéo</Puce>
      <Puce v-for="m in form.musclesPrincipaux.slice(0, 2)" :key="m" variante="muscle" :muscle="teinteDe(m)">{{ nomMuscle(m) }}</Puce>
      <Puce v-if="form.categorie && !form.musclesPrincipaux.some((m) => nomMuscle(m).toLowerCase() === form.categorie.toLowerCase())">{{ form.categorie }}</Puce>
    </div>
  </div>

  <div v-if="statut === 'propose'" class="st-exo-valider">
    <p>
      <b>Claude a proposé cette vidéo</b><template v-if="video?.chaine || video?.duree"> ({{ [video?.chaine, dureeCourte(video?.duree)].filter(Boolean).join(', ') }})</template>.
      Vérifie qu'elle montre la bonne exécution.
      <template v-if="!D.validationPossible()"> Pour la valider, dis-le à Claude ; pour en mettre une autre, colle un lien plus bas.</template>
    </p>
    <button v-if="D.validationPossible()" type="button" class="st-btn st-btn--encre" @click="valider">Valider</button>
  </div>

  <div class="st-exo-chiffres">
    <label class="st-exo-chiffre"><span>Tempo</span><input v-model="form.tempo" maxlength="20" placeholder="3-1-1" :aria-invalid="!!erreurs.tempo"></label>
    <label class="st-exo-chiffre"><span>Repos (s)</span><input v-model="form.reposConseille" inputmode="numeric" placeholder="60" :aria-invalid="!!erreurs.reposConseille"></label>
    <div class="st-exo-chiffre"><span>Niveau</span><b>{{ NIVEAUX[form.niveau] || '—' }}</b></div>
  </div>
  <p v-if="erreurs.reposConseille" class="st-exo-err" role="alert">Repos : {{ erreurs.reposConseille }}</p>

  <div class="st-exo-utilise">
    <template v-if="utilise === 0"><span>Aucune séance n'utilise encore cet exercice</span></template>
    <template v-else-if="utilise != null">
      <b>{{ utilise }}</b>
      <span>séance{{ utilise > 1 ? 's' : '' }} utilise{{ utilise > 1 ? 'nt' : '' }} cet exercice<template v-if="utiliseProg"> · dans {{ utiliseProg }} programme{{ utiliseProg > 1 ? 's' : '' }}</template></span>
    </template>
    <span v-else>Utilisation dans les séances : inconnue</span>
    <RouterLink to="/coach/seances" class="st-btn st-btn--fantome">Séances</RouterLink>
  </div>

  <section class="st-exo-section" aria-labelledby="st-exo-h-media">
    <h3 id="st-exo-h-media">Média</h3>
    <div class="st-exo-champ">
      <label :for="p('yt')">Lien de la vidéo YouTube</label>
      <input :id="p('yt')" v-model="form.lienVideo" type="url" inputmode="url" placeholder="Coller un lien YouTube" :aria-invalid="!!erreurs.lienVideo" :aria-describedby="erreurs.lienVideo ? p('e-yt') : undefined">
      <p v-if="erreurs.lienVideo" :id="p('e-yt')" class="st-exo-err">{{ erreurs.lienVideo }}</p>
      <p v-else-if="video?.titre" class="st-exo-aide">{{ video.titre }}<template v-if="video.chaine"> · {{ video.chaine }}</template><template v-if="dureeCourte(video.duree)"> · {{ dureeCourte(video.duree) }}</template></p>
    </div>
    <div class="st-exo-depot" :class="{ 'is-survol': survol }" @dragenter.prevent="survol = true" @dragover.prevent="survol = true" @dragleave="survol = false" @drop.prevent="deposer">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 7h3l2-2.5h6L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
      <div>
        <b>{{ envoi ? 'Envoi…' : aPhoto ? 'Remplacer la photo' : 'Ajouter une photo' }}</b><br>
        Glisse une image ici ou <label :for="p('fichier')">choisis un fichier</label>
        <input :id="p('fichier')" type="file" accept="image/jpeg,image/png,image/webp" class="st-sr" @change="photo($event.target.files[0]); $event.target.value = ''">
      </div>
      <button v-if="aPhoto" type="button" class="st-btn st-btn--fantome" @click="retirer">Retirer</button>
    </div>
  </section>

  <section class="st-exo-section" aria-labelledby="st-exo-h-classement">
    <h3 id="st-exo-h-classement">Classement</h3>
    <div class="st-exo-champ">
      <span :id="p('l-mp')" class="st-exo-lab">Muscles principaux</span>
      <div class="st-exo-jetons" role="group" :aria-labelledby="p('l-mp')">
        <button v-for="o in optionsMuscles('musclesPrincipaux')" :key="o.v" type="button" class="st-exo-jeton" :data-m="o.m || undefined" :aria-pressed="form.musclesPrincipaux.includes(o.v)" @click="form.musclesPrincipaux = basculer(form.musclesPrincipaux, o.v)">{{ o.texte }}</button>
      </div>
      <p v-if="erreurs.musclesPrincipaux" class="st-exo-err">{{ erreurs.musclesPrincipaux }}</p>
    </div>
    <div class="st-exo-champ">
      <span :id="p('l-ms')" class="st-exo-lab">Muscles secondaires</span>
      <div class="st-exo-jetons" role="group" :aria-labelledby="p('l-ms')">
        <button v-for="o in optionsMuscles('musclesSecondaires')" :key="o.v" type="button" class="st-exo-jeton" :data-m="o.m || undefined" :aria-pressed="form.musclesSecondaires.includes(o.v)" @click="form.musclesSecondaires = basculer(form.musclesSecondaires, o.v)">{{ o.texte }}</button>
      </div>
    </div>
    <div class="st-exo-champ">
      <span :id="p('l-mat')" class="st-exo-lab">Matériel</span>
      <div class="st-exo-jetons" role="group" :aria-labelledby="p('l-mat')">
        <button v-for="m in listeMateriels" :key="m" type="button" class="st-exo-jeton" :aria-pressed="form.materiel.includes(m)" @click="form.materiel = basculer(form.materiel, m)">{{ m }}</button>
      </div>
      <form class="st-exo-ajout" @submit.prevent="ajouterMateriel">
        <label class="st-sr" :for="p('mat-n')">Autre matériel</label>
        <input :id="p('mat-n')" v-model="nouveauMateriel" maxlength="40" placeholder="Autre matériel…">
        <button type="submit" class="st-btn" :disabled="!nouveauMateriel.trim()">Ajouter</button>
      </form>
    </div>
    <div class="st-exo-deux">
      <div class="st-exo-champ">
        <label :for="p('cat')">Catégorie</label>
        <input :id="p('cat')" v-model="form.categorie" maxlength="40" :list="p('cats')" placeholder="Renforcement, Mobilité…">
        <datalist :id="p('cats')"><option v-for="c in categories" :key="c" :value="c" /></datalist>
      </div>
      <div class="st-exo-champ">
        <span :id="p('l-niv')" class="st-exo-lab">Niveau</span>
        <div class="st-exo-niveau" role="group" :aria-labelledby="p('l-niv')">
          <button v-for="(t, v) in NIVEAUX" :key="v" type="button" :aria-pressed="form.niveau === v" @click="form.niveau = form.niveau === v ? '' : v">{{ t.slice(0, 5) }}<span v-if="t.length > 5" aria-hidden="true">.</span><span class="st-sr">{{ t.slice(5) }}</span></button>
        </div>
      </div>
    </div>
    <div class="st-exo-champ">
      <span :id="p('l-tags')" class="st-exo-lab">Étiquettes (filtres des séances)</span>
      <div class="st-exo-jetons" role="group" :aria-labelledby="p('l-tags')">
        <button v-for="c in etiquettes" :key="c" type="button" class="st-exo-jeton" :aria-pressed="form.categories.includes(c)" @click="form.categories = basculer(form.categories, c)">{{ libelleCategorie(c) }}</button>
      </div>
    </div>
  </section>

  <section class="st-exo-section" aria-labelledby="st-exo-h-exec">
    <h3 id="st-exo-h-exec">Exécution</h3>
    <div class="st-exo-champ"><label :for="p('desc')">Description courte</label><textarea :id="p('desc')" v-model="form.description" maxlength="1000" rows="2" /></div>
    <div class="st-exo-champ"><label :for="p('cons')">Consignes d'exécution</label><textarea :id="p('cons')" v-model="form.consignes" maxlength="2000" /></div>
    <div class="st-exo-champ"><label :for="p('err')">Erreurs fréquentes</label><textarea :id="p('err')" v-model="form.erreursFrequentes" maxlength="2000" /></div>
    <div class="st-exo-deux">
      <div class="st-exo-champ"><label :for="p('fac')">Plus facile</label><input :id="p('fac')" v-model="form.varianteFacile" maxlength="500"></div>
      <div class="st-exo-champ"><label :for="p('dur')">Plus dur</label><input :id="p('dur')" v-model="form.varianteDifficile" maxlength="500"></div>
    </div>
  </section>

  <section class="st-exo-section" aria-labelledby="st-exo-h-notes">
    <h3 id="st-exo-h-notes">Notes privées</h3>
    <div class="st-exo-champ"><label :for="p('notes')" class="st-sr">Notes privées</label><textarea :id="p('notes')" v-model="form.notesPrivees" class="st-exo-prive" maxlength="2000" placeholder="Visible par toi seul : ex. éviter avec Bernard (genou)." /></div>
  </section>

  <div class="st-exo-section st-exo-fin">
    <button type="button" class="st-btn" :class="{ 'st-exo-danger': confirmer }" @click="archiver">{{ confirmer ? 'Confirmer l\'archivage' : 'Archiver l\'exercice' }}</button>
    <span v-if="confirmer" class="st-exo-aide" role="status">Appuie encore pour archiver : il disparaîtra de la bibliothèque.</span>
  </div>
</template>
