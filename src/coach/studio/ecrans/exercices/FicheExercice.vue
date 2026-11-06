<script setup>
// Contenu du panneau d'un exercice : tous les champs du contrat, sauvegarde automatique (useSauvegardeAuto).
// Monté avec :key="exercice.id" : changer d'exercice démonte la fiche, ce qui écrit ce qui reste (arreter()).
// Seuls les champs TOUCHÉS par le coach partent au serveur (`sales`) : ce que Claude a changé entre-temps (MCP) n'est
// jamais écrasé, et la réponse du serveur met à jour les champs non touchés. Un champ invalide reste de côté
// (« 1 champ à corriger ») sans bloquer l'enregistrement des autres.
// Émet : etat (état de sauvegarde), invalides (champs à corriger), maj (exercice), archive (id archivé).
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useSauvegardeAuto } from '../../useSauvegardeAuto.js'
import { toast } from '../../toast.js'
import Puce from '../../Puce.vue'
import { NOMS_MUSCLES, TEINTES_STUDIO, NIVEAUX, statutVideo, teinteDe, dureeCourte, urlPhoto } from '../../medias.js'
import { CATEGORIES, libelleCategorie } from '../../../logique.js'
import { versFormulaire, construirePatch, basculer, messageErreurExo, champsDifferents, memeValeur, TOUS_CHAMPS, proposeeParClaude, cleMateriel } from './logique.js'
import * as D from './donnees.js'

const props = defineProps({
  exercice: { type: Object, required: true },
  materiels: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] }
})
const emit = defineEmits(['etat', 'invalides', 'maj', 'archive'])

const serveur = ref({ ...props.exercice })     // dernière version connue du serveur
const form = reactive(versFormulaire(props.exercice))
const copie = (v) => (Array.isArray(v) ? [...v] : v)
const vu = versFormulaire(props.exercice)      // état du formulaire au dernier passage (pour repérer ce que le coach touche)
const sales = new Set()                        // champs touchés pas encore confirmés par le serveur
const erreurs = ref({})
const id = props.exercice.id
const p = (c) => `st-exo-${c}`                 // identifiants de champs
const ID_CHAMP = { nom: 'nom', lienVideo: 'yt', reposConseille: 'repos', tempo: 'tempo', description: 'desc', consignes: 'cons', erreursFrequentes: 'err', varianteFacile: 'fac', varianteDifficile: 'dur', notesPrivees: 'notes', categorie: 'cat' }

/** Réponse du serveur : base à jour ; champs confirmés -> propres ; champs non touchés -> valeur du serveur. */
function appliquerServeur(item) {
  if (!item) return
  serveur.value = { ...serveur.value, ...item }
  emit('maj', item)
  const f = versFormulaire(serveur.value)
  for (const c of TOUS_CHAMPS) {
    if (sales.has(c)) { if (memeValeur(c, form[c], f[c])) sales.delete(c); continue }
    if (!memeValeur(c, form[c], f[c])) form[c] = copie(f[c])
    vu[c] = copie(form[c])
  }
}

const s = useSauvegardeAuto(async ({ id: idExo, patch }) => appliquerServeur(await D.mettreAJour(idExo, patch)), { delai: 500 })
watch(s.etat, (e) => emit('etat', e), { immediate: true })
watch(s.erreur, (e) => { if (e) toast(messageErreurExo(e)) })
watch(erreurs, (e) => emit('invalides', Object.keys(e)), { immediate: true })

function planifier() {
  const { patch, erreurs: er } = construirePatch(serveur.value, form, sales)
  erreurs.value = er
  if (!Object.keys(patch).length) return
  emit('maj', { id, ...patch }) // carte de la grille à jour tout de suite (le serveur confirmera)
  s.planifier({ id, patch })
}
watch(form, () => {
  for (const c of champsDifferents(vu, form)) { sales.add(c); vu[c] = copie(form[c]) }
  planifier()
}, { deep: true })

// Onglet masqué, page quittée ou rechargée : on écrit tout de suite ce qui attend.
const vider = () => { if (document.visibilityState === 'hidden') s.maintenant() }
const quitter = () => s.maintenant()
onMounted(() => { document.addEventListener('visibilitychange', vider); window.addEventListener('pagehide', quitter) })
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', vider); window.removeEventListener('pagehide', quitter); s.arreter() })

function focusInvalide() {
  const c = Object.keys(erreurs.value)[0]
  const el = c && (document.getElementById(p(ID_CHAMP[c] || c)) || document.querySelector(`[data-champ="${c}"] button`))
  el?.focus()
  el?.scrollIntoView?.({ block: 'center' })
}
defineExpose({ reessayer: () => s.reessayer(), enregistrer: () => s.maintenant(), invalides: () => Object.keys(erreurs.value), focusInvalide })

// Muscles : les 8 teintes + les mots libres déjà présents (ex. « Fessiers » importé)
const optionsMuscles = (champ) => [...TEINTES_STUDIO.map((t) => ({ v: t, texte: NOMS_MUSCLES[t], m: t })),
  ...form[champ].filter((x) => !TEINTES_STUDIO.includes(x)).map((x) => ({ v: x, texte: nomMuscle(x), m: teinteDe(x) }))]
const nomMuscle = (m) => NOMS_MUSCLES[m] || (m.charAt(0).toUpperCase() + m.slice(1))
const etiquettes = computed(() => [...new Set([...Object.keys(CATEGORIES), ...form.categories])])
const nouveauMateriel = ref('')
function ajouterMateriel() {
  const v = nouveauMateriel.value.trim()
  if (v && !form.materiel.some((m) => cleMateriel(m) === cleMateriel(v))) form.materiel.push(v)
  nouveauMateriel.value = ''
}
// L'écriture de l'exercice d'abord (« Haltère »), puis le reste de la liste sans doublon
const listeMateriels = computed(() => {
  const cles = new Set(form.materiel.map(cleMateriel))
  return [...form.materiel, ...props.materiels.filter((m) => !cles.has(cleMateriel(m)))]
})

// Vidéo
const statut = computed(() => statutVideo(serveur.value))
const parClaude = computed(() => proposeeParClaude(serveur.value))
const video = computed(() => serveur.value.video)
async function valider() {
  await s.maintenant()
  try { appliquerServeur(await D.validerVideo(id)); toast('Vidéo validée') } catch (e) { toast(messageErreurExo(e)) }
}

// Photo : réduite dans le navigateur puis envoyée
const survol = ref(false)
const envoi = ref(false)
const aPhoto = computed(() => !!urlPhoto(serveur.value))
async function photo(fichier) {
  survol.value = false
  if (!fichier) return
  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) { toast('Format refusé : JPG, PNG ou WebP.'); return }
  envoi.value = true
  try {
    let blob = null
    try { blob = await D.reduireImage(fichier) } catch { blob = null }
    if (!blob) { toast('Image illisible : choisis une autre photo.'); return }
    appliquerServeur(await D.envoyerPhoto(id, blob))
    toast('Photo enregistrée')
  } catch (e) { toast(messageErreurExo(e)) } finally { envoi.value = false }
}
async function retirer() {
  try { appliquerServeur(await D.retirerPhoto(id)); toast('Photo retirée') } catch (e) { toast(messageErreurExo(e)) }
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

const utilise = computed(() => serveur.value.utiliseDans)
const utiliseProg = computed(() => serveur.value.utiliseDansProgrammes)
</script>

<template>
  <div class="st-exo-tete">
    <label class="st-sr" :for="p('nom')">Nom de l'exercice</label>
    <textarea :id="p('nom')" v-model="form.nom" data-test="exo-nom" class="st-exo-nom" rows="1" maxlength="120" :aria-invalid="!!erreurs.nom" :aria-describedby="erreurs.nom ? p('e-nom') : undefined" />
    <p v-if="erreurs.nom" :id="p('e-nom')" class="st-exo-err">{{ erreurs.nom }}</p>
    <div class="st-exo-statut">
      <Puce v-if="statut === 'propose'" variante="propose" point>{{ parClaude ? 'Vidéo proposée par Claude' : 'Vidéo à valider' }}</Puce>
      <Puce v-else-if="statut === 'valide'" variante="ok" point>Vidéo validée</Puce>
      <Puce v-else>Aucune vidéo</Puce>
      <Puce v-for="m in form.musclesPrincipaux.slice(0, 2)" :key="m" variante="muscle" :muscle="teinteDe(m)">{{ nomMuscle(m) }}</Puce>
      <Puce v-if="form.categorie && !form.musclesPrincipaux.some((m) => nomMuscle(m).toLowerCase() === form.categorie.toLowerCase())">{{ form.categorie }}</Puce>
    </div>
  </div>

  <div v-if="statut === 'propose'" class="st-exo-valider">
    <p>
      <b>{{ parClaude ? 'Claude a proposé cette vidéo' : 'Vidéo pas encore validée' }}</b><template v-if="video?.chaine || video?.duree"> ({{ [video?.chaine, dureeCourte(video?.duree)].filter(Boolean).join(', ') }})</template>.
      Vérifie qu'elle montre la bonne exécution.
      <template v-if="!D.validationPossible()"> Pour la valider, dis-le à Claude ; pour en mettre une autre, colle un lien plus bas.</template>
    </p>
    <button v-if="D.validationPossible()" type="button" class="st-btn st-btn--encre" @click="valider">Valider</button>
  </div>

  <div class="st-exo-chiffres">
    <label class="st-exo-chiffre"><span>Tempo</span><input :id="p('tempo')" v-model="form.tempo" maxlength="20" placeholder="ex. 3-1-1" :aria-invalid="!!erreurs.tempo"></label>
    <label class="st-exo-chiffre"><span>Repos (s)</span><input :id="p('repos')" v-model="form.reposConseille" inputmode="numeric" placeholder="ex. 60" :aria-invalid="!!erreurs.reposConseille"></label>
    <div class="st-exo-chiffre"><span>Niveau</span><b>{{ NIVEAUX[form.niveau] || '—' }}</b></div>
  </div>
  <p v-if="erreurs.reposConseille" class="st-exo-err" role="alert">Repos : {{ erreurs.reposConseille }}</p>
  <p v-if="erreurs.tempo" class="st-exo-err" role="alert">Tempo : {{ erreurs.tempo }}</p>

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
      <div class="st-exo-jetons" role="group" data-champ="musclesPrincipaux" :aria-labelledby="p('l-mp')">
        <button v-for="o in optionsMuscles('musclesPrincipaux')" :key="o.v" type="button" class="st-exo-jeton" :data-m="o.m || undefined" :aria-pressed="form.musclesPrincipaux.includes(o.v)" @click="form.musclesPrincipaux = basculer(form.musclesPrincipaux, o.v)">{{ o.texte }}</button>
      </div>
      <p v-if="erreurs.musclesPrincipaux" class="st-exo-err">{{ erreurs.musclesPrincipaux }}</p>
    </div>
    <div class="st-exo-champ">
      <span :id="p('l-ms')" class="st-exo-lab">Muscles secondaires</span>
      <div class="st-exo-jetons" role="group" data-champ="musclesSecondaires" :aria-labelledby="p('l-ms')">
        <button v-for="o in optionsMuscles('musclesSecondaires')" :key="o.v" type="button" class="st-exo-jeton" :data-m="o.m || undefined" :aria-pressed="form.musclesSecondaires.includes(o.v)" @click="form.musclesSecondaires = basculer(form.musclesSecondaires, o.v)">{{ o.texte }}</button>
      </div>
    </div>
    <div class="st-exo-champ">
      <span :id="p('l-mat')" class="st-exo-lab">Matériel</span>
      <div class="st-exo-jetons" role="group" data-champ="materiel" :aria-labelledby="p('l-mat')">
        <button v-for="m in listeMateriels" :key="m" type="button" class="st-exo-jeton" :aria-pressed="form.materiel.includes(m)" @click="form.materiel = basculer(form.materiel, m)">{{ m }}</button>
      </div>
      <form class="st-exo-ajout" @submit.prevent="ajouterMateriel">
        <label class="st-sr" :for="p('mat-n')">Autre matériel</label>
        <input :id="p('mat-n')" v-model="nouveauMateriel" maxlength="40" placeholder="Autre matériel…">
        <button type="submit" class="st-btn" :disabled="!nouveauMateriel.trim()">Ajouter</button>
      </form>
    </div>
    <div class="st-exo-champ">
      <label :for="p('cat')">Catégorie</label>
      <input :id="p('cat')" v-model="form.categorie" maxlength="40" :list="p('cats')" placeholder="ex. Renforcement, Mobilité">
      <datalist :id="p('cats')"><option v-for="c in categories" :key="c" :value="c" /></datalist>
    </div>
    <div class="st-exo-champ">
      <span :id="p('l-niv')" class="st-exo-lab">Niveau</span>
      <div class="st-exo-niveau" role="group" :aria-labelledby="p('l-niv')">
        <button v-for="(t, v) in NIVEAUX" :key="v" type="button" :aria-pressed="form.niveau === v" @click="form.niveau = form.niveau === v ? '' : v">{{ t }}</button>
      </div>
    </div>
    <div class="st-exo-champ">
      <span :id="p('l-tags')" class="st-exo-lab">Étiquettes (filtres des séances)</span>
      <div class="st-exo-jetons" role="group" data-champ="categories" :aria-labelledby="p('l-tags')">
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
      <div class="st-exo-champ"><label :for="p('fac')">Plus facile</label><textarea :id="p('fac')" v-model="form.varianteFacile" maxlength="500" rows="2" /></div>
      <div class="st-exo-champ"><label :for="p('dur')">Plus dur</label><textarea :id="p('dur')" v-model="form.varianteDifficile" maxlength="500" rows="2" /></div>
    </div>
  </section>

  <section class="st-exo-section" aria-labelledby="st-exo-h-notes">
    <h3 id="st-exo-h-notes">Notes privées</h3>
    <div class="st-exo-champ"><label :for="p('notes')" class="st-sr">Notes privées</label><textarea :id="p('notes')" v-model="form.notesPrivees" class="st-exo-prive" maxlength="2000" placeholder="ex. éviter avec Bernard (genou). Visible par toi seul." /></div>
  </section>

  <div class="st-exo-section st-exo-fin">
    <button type="button" class="st-btn" :class="{ 'st-exo-danger': confirmer }" @click="archiver">{{ confirmer ? 'Confirmer l\'archivage' : 'Archiver l\'exercice' }}</button>
    <span v-if="confirmer" class="st-exo-aide" role="status">Appuie encore pour archiver : il disparaîtra de la bibliothèque.</span>
  </div>
</template>
