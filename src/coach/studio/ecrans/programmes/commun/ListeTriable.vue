<script setup>
// Liste triable du Studio (séances, programmes). S'enregistre auprès du contrôleur creerGlisser().
// Slot : { item, index, poignee, tirable, saisi } — poser v-bind="poignee" sur un <button> (la poignée), v-bind="tirable" sur la carte.
// Retour visuel : élément d'origine estompé, ligne d'insertion (sans décaler la mise en page), liste cible teintée.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  glisser: { type: Object, required: true },
  id: { type: String, required: true },
  type: { type: String, required: true },          // type des éléments de cette liste
  accepte: { type: Array, default: null },         // types acceptés en dépôt (défaut : [type])
  items: { type: Array, required: true },
  cle: { type: Function, required: true },          // item -> clé unique (aussi utilisée pour rendre le focus)
  libelle: { type: Function, required: true },      // item -> nom lu par le lecteur d'écran
  etiquette: { type: String, default: '' },
  tag: { type: String, default: 'div' }
})

const el = ref(null)
onMounted(() => props.glisser.enregistrerListe(props.id, { el: () => el.value, type: props.type, accepte: props.accepte || [props.type], longueur: () => props.items.length }))
onBeforeUnmount(() => props.glisser.retirerListe(props.id))

const g = props.glisser.etat
const estCible = computed(() => g.actif && g.cible?.liste === props.id)
const memeListe = computed(() => g.origine?.liste === props.id)
const estOrigine = (i) => g.actif && memeListe.value && g.origine.index === i
// Index « sans l'élément tiré » de l'élément réel i.
const indexFiltre = (i) => (memeListe.value && g.actif && i > g.origine.index ? i - 1 : i)
const marqueAvant = (i) => estCible.value && !estOrigine(i) && indexFiltre(i) === g.cible.index
const longueurFiltree = computed(() => props.items.length - (g.actif && memeListe.value ? 1 : 0))
const marqueFin = computed(() => estCible.value && g.cible.index >= longueurFiltree.value && !(memeListe.value && g.origine.index === props.items.length - 1 && g.cible.index === longueurFiltree.value))

const pour = (item, index) => {
  const cle = props.cle(item)
  const base = { liste: props.id, index, type: props.type, cle, libelle: props.libelle(item) }
  return { poignee: props.glisser.poignee(base), tirable: props.glisser.tirable(base), saisi: g.cleSaisie === cle }
}
</script>

<template>
  <component
    :is="tag" ref="el" class="st-gl-liste" role="list" :aria-label="etiquette || undefined"
    :class="{ 'is-cible': estCible, 'is-marque-fin': marqueFin, 'is-vide': !items.length }"
  >
    <div
      v-for="(item, i) in items" :key="cle(item)" data-st-item role="listitem" class="st-gl-item"
      :class="{ 'is-tire': estOrigine(i), 'is-marque': marqueAvant(i), 'is-saisi': g.cleSaisie === cle(item) }"
    >
      <slot :item="item" :index="i" v-bind="pour(item, i)" />
    </div>
    <slot v-if="!items.length" name="vide" />
  </component>
</template>

<style>
.st-gl-liste { position: relative; display: flex; flex-direction: column; gap: var(--st-gl-ecart, 10px); border-radius: 18px; transition: background var(--st-d-court), box-shadow var(--st-d-court); }
.st-gl-liste.is-cible { background: color-mix(in srgb, var(--st-ok-fond) 70%, transparent); box-shadow: 0 0 0 2px var(--st-ok); }
.st-gl-item { position: relative; transition: opacity var(--st-d-court); }
.st-gl-item.is-tire { opacity: .35; }
.st-gl-item.is-saisi > * { box-shadow: 0 0 0 2.5px var(--st-encre), var(--st-ombre-2); transform: scale(1.01); }
/* ligne d'insertion : pseudo-élément, n'occupe aucune place */
.st-gl-item.is-marque::before, .st-gl-liste.is-marque-fin::after {
  content: ''; position: absolute; left: 6px; right: 6px; height: 4px; border-radius: 2px; background: var(--st-ok);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--st-ok) 22%, transparent); pointer-events: none; z-index: 2;
  animation: st-gl-marque .18s var(--st-sortie);
}
.st-gl-item.is-marque::before { top: calc(var(--st-gl-ecart, 10px) / -2 - 2px); }
.st-gl-liste.is-marque-fin::after { bottom: -6px; }
@keyframes st-gl-marque { from { transform: scaleX(.6); opacity: 0; } }
/* fantôme qui suit le pointeur (transform seulement) */
.st-gl-fantome { position: fixed; z-index: var(--st-z-volant, 60); margin: 0; pointer-events: none; max-height: 180px; overflow: hidden; box-shadow: var(--st-ombre-3); border-radius: 16px; opacity: .96; will-change: transform; transition: none; }
.st-gl-en-cours, .st-gl-en-cours * { cursor: grabbing !important; user-select: none; -webkit-user-select: none; }
/* poignée : 44 px, seule zone qui capte le doigt */
.st-gl-poignee { flex: none; display: inline-grid; place-items: center; width: 44px; height: 44px; margin: -6px 0 -6px -8px; border: 0; border-radius: 12px; background: transparent; color: var(--st-doux); cursor: grab; touch-action: none; transition: background var(--st-d-court), transform var(--st-d-appui); }
.st-gl-poignee:hover { background: var(--st-surface-2); color: var(--st-encre); }
.st-gl-poignee:active { transform: scale(.92); }
.st-gl-poignee[aria-pressed="true"] { background: var(--st-encre); color: #fff; }
.st-gl-poignee svg { width: 18px; height: 18px; }
@media (prefers-reduced-motion: reduce) { .st-gl-item.is-saisi > * { transform: none; } }
</style>
