# Studio (refonte coach d3) — fondations LOT 0

> **État au 2026-11-06 ~12 h 50 : lot 0 terminé** (branche `studio-l0`, poussée). Tout est utilisable par les lots d'écrans.
> **Changements d'API depuis le WIP du 05/11** (à lire si tu as fusionné avant) :
> - `medias.js` accepte maintenant la forme du contrat (`musclesPrincipaux`, `photo {url}`, `video {statut, duree}`) ; ajouts : `teinteDe`, `nomMuscleDe`, `mouvementDe`, `urlPhoto`, `statutVideo`, `dureeCourte`, `idVideoDe`, `NOMS_MUSCLES`, `NIVEAUX`. `mediaDe` / `muscleDe` / `miniatureYoutube` gardent la même signature.
> - `tokens.css` : les remises à zéro (`button`, `input`, `:focus-visible`, `box-sizing`) sont en `:where()` → spécificité nulle, une classe de composant gagne toujours (corrige `.st-btn--encre`/`--jaune` illisibles). Ajout `.st-btn--danger`.
> - `/coach` redirige vers `/coach/aujourdhui` (emplacement provisoire `AujourdhuiView.vue`).

## Conflits (Claude / autre appareil) — à brancher dans chaque éditeur à sauvegarde auto

Corentin dicte à Claude (outils MCP) pendant qu'un écran est ouvert, ou garde le Mac et le téléphone ouverts. Sans contrôle,
la sauvegarde auto de l'écran (objet entier) effaçait ce que Claude venait d'ajouter. Règle (src/data/versions.js) :
- `profils`, `exercices`, `workouts`, `programmes`, `questionnaires` portent `version` (1 à la création, +1 à chaque écriture, par tous les chemins).
- `data.<entite>.modifier(id, patch, { version })` et `data.exercices.mettreAJour(id, patch, { version })` : si l'objet a changé
  depuis la lecture → `ErreurData` `code: 'CONFLIT'`, `e.actuel` = l'objet à jour. Rien n'est écrit. Sans `{ version }` : comme avant.
- `creer` / `modifier` / `mettreAJour` **renvoient l'objet enregistré** (avec sa nouvelle `version`) : le callback doit le `return`.

**Dans un éditeur** (4 changements) :
```js
const s = useSauvegardeAuto(
  (valeur, opts) => data.workouts.modifier(id, valeur, opts),            // 1. passer `opts` et RENVOYER le résultat
  { delai: 700, recharger: (actuel) => { workout.value = copie(actuel) }, // 2. remplacer l'état de l'écran par l'objet à jour
    resumer: (v) => v.nom }                                               //    (facultatif) texte court de la saisie perdue
)
// 3. après CHAQUE lecture (ouverture, autre objet, rafraîchissement) : s.suivreVersion(objetLu.version)
// 4. <IndicateurSauvegarde :etat="s.etat.value" :conflit="s.conflit.value" @reessayer="s.reessayer" @recharger="s.recharger" />
```
En conflit : la file s'arrête (plus aucune écriture, même au démontage), l'indicateur affiche « Modifié ailleurs (Claude ou un autre
appareil) », la dernière saisie (si `resumer`) et « Recharger » ; `s.recharger()` appelle `recharger(actuel)`, reprend la version
d'`actuel` et relance les sauvegardes. `s.occupe()` = une saisie attend, s'écrit, a échoué ou est bloquée.
Si `recharger` remet l'état de l'écran, pense à remettre aussi la copie « dernier écrit » de l'écran (sinon une écriture inutile repart).

**Rafraîchir au retour** : `useRafraichirAuRetour(charger, { sauvegarde: s })` (`useRafraichirAuRetour.js`) relance `charger()` quand
l'onglet redevient visible ou que la fenêtre reprend le focus (au plus une fois toutes les 2 s), **jamais** si `s.occupe()`.
`charger()` doit rappeler `s.suivreVersion(...)`.

Maquette de référence : `design-coach/d3/` (DESIGN.md = règles de couleur, typo, mouvement). Préfixe CSS : `st-`.
Tout est limité à `.st-app` (racine de `CoachLayout`) : l'app client ne change pas.

## Pour un lot d'écran (Aujourd'hui, Exercices, Clients, Programmes, Questionnaires, Agenda…)

**Fichiers que tu peux créer sans conflit** : uniquement `src/coach/studio/ecrans/<ecran>/` (vues, composants locaux, CSS `st-<ecran>-…`),
`tests/unit/studio-<ecran>*.test.js`, `tests/e2e/studio-<ecran>*`. Ne modifie ni `src/coach/routes.js`, ni les fichiers à la racine de
`src/coach/studio/`, ni `src/data`, ni `serveur/`. Besoin d'un composant partagé qui manque → fais-le dans ton dossier et signale-le.

**Routes** : `src/coach/studio/ecrans/<ecran>/routes.js`
```js
export default [
  { path: 'clients', component: () => import('./ClientsStudio.vue'), meta: { studio: true } },
  { path: 'clients/:id', component: () => import('./FicheClient.vue'), props: true, meta: { studio: true } }
]
```
Chemins relatifs à `/coach`, **mêmes URL que les anciennes vues**. **`meta: { studio: true }` est obligatoire** : sans lui, `CoachLayout`
rend la route dans le *pont* (anciens tokens sombres). REX branche à la fusion par une ligne dans `src/coach/routes.js`
(`...routesClients` placé avant les anciennes routes du même chemin, qu'il retire). Pour tester chez toi : branche temporairement, **sans committer**.

**Squelette d'un écran**
```vue
<template>
  <section aria-labelledby="st-t-clients">
    <header class="st-entete"><div><h1 id="st-t-clients">Clients</h1><p>Sous-titre.</p></div>
      <div class="st-actions"><button class="st-btn st-btn--jaune" type="button"><IconeSt nom="plus" />Nouveau client</button></div></header>
    <!-- contenu ; .st-bloc pour une carte utilitaire -->
  </section>
</template>
```
Le cadre (`.st-main`) gère déjà les marges, la place de la barre du bas (96 px + zone sûre) et l'entrée de page (fondu + 10 px).

**Démo vivante** : `/coach/studio-demo` (dev seulement, `DemoComposants.vue`) = câblage complet vignette → panneau → élément partagé →
sauvegarde auto → toast. Copie-la.

## Cadre : `src/coach/CoachLayout.vue` + `layout.css`
- Ordinateur (> 900 px) : barre latérale 248 px (`NAV_PRINCIPALE` puis « Autres pages » = `NAV_SECONDAIRE`, carte « Corentin » + déconnexion).
- Téléphone (≤ 900 px) : barre d'onglets flottante (4 entrées `bas: true` + « Plus ») ; « Plus » ouvre une feuille basse (le reste + déconnexion),
  Échap / voile / changement de page la ferment, le focus revient au bouton.
- Onglet actif : `estActif()` (page, sous-pages, pages `aussi`) → `aria-current="page"`. Pastilles : `compte(entree, etat)` lit `store.etat`.
- **Pont** : route sans `meta.studio` → `<div class="coach c-pont"><div class="c-main">…` (ancien thème sombre, carte arrondie). Les anciennes vues
  marchent telles quelles ; REX les remplace une par une.
- `#st-calques` : cible des calques (panneau, fiche, volant). Depuis un écran : `<Teleport defer to="#st-calques">` (PanneauLateral le fait déjà).
- `<ToastSt />` est monté ici une fois : appelle seulement `toast()`.
- Empilement : barres sticky des vues < 10 ; barre du bas 40 ; voile 49 ; panneau/feuille 50 ; volant 60 ; toast 80 (`--st-z-*`).

## Composants

### `PanneauLateral.vue` — panneau d'édition / fiche
Ordinateur : fixe à droite (440 px ; 400 px de 901 à 1180 px), entrée glissée 24 px. Téléphone : feuille plein écran, glisser la poignée ou
le média vers le bas > 140 px (ou vite) ferme. Téléporté dans `#st-calques`.
- Props : `ouvert` (Boolean) · `etiquette` (nom accessible, ex. nom de l'exercice) · `muscle` (teinte du média) · `sauvegarde`
  (état de `useSauvegardeAuto`, `''` = pas d'indicateur) · `precedent`, `suivant` (Boolean : affiche/active ↑ ↓) · `cascade` (défaut true ;
  passe à false quand on change d'élément panneau ouvert).
- Événements : `fermer`, `precedent`, `suivant`, `reessayer`.
- Slots : `media` (en-tête 16:9 : `<img>`, `<LecteurVideo>`, `<FigureMouvement>` en enfant direct) · `barre` (boutons en plus, après ↑ ↓) · défaut (contenu défilant, cascade 40 ms par enfant direct).
- Expose (ref) : `media()` → élément d'en-tête (cible de `volerVers`), `racine()`.
- Clavier : Échap ferme (même dans un champ) ; ↑ ↓ hors champ = précédent/suivant ; focus sur « Fermer » à l'ouverture, rendu à l'élément précédent à la fermeture.
- **Place du contenu** : ajoute la classe `st-reserve-panneau` à ta zone quand le panneau est ouvert (ordinateur : `padding-right` 456/416 px).
- Fermeture : appelle `sauvegarde.maintenant()` **sans l'attendre** puis passe `ouvert` à false (le panneau se ferme tout de suite, l'écriture finit en arrière-plan ; mets l'id de l'élément dans la valeur planifiée : `s.planifier({ id, patch })`).

### `VignetteExercice.vue` — carte d'exercice
- Props : `exercice` (forme du contrat `docs/CONTRAT-EXERCICES-STUDIO.md`, ou ancienne forme) · `actif` (ouvert dans le panneau → `aria-current`) · `affichage` (`'grille'` 4:3 | `'liste'` ligne compacte).
- Événement : `ouvrir(exercice, elMedia)` — `elMedia` = `.st-carte-media`, à passer à `volerVers`.
- Affiche : photo (`photo.url`) > miniature YouTube (`lienVideo`) > `FigureMouvement` ; puce « À valider » si `video.statut === 'propose'`,
  « Sans vidéo » sinon sans média ; durée `video.duree` ; nom (2 lignes) ; « muscle · 1er matériel » ; en liste : niveau.
  Image en erreur → figure. Appui long (doigt, 380 ms) anime l'aperçu sans ouvrir ; survol souris idem.
- C'est un `<button>` : mets-le dans un `<li>` d'une `<ul>` ; grille conseillée `repeat(auto-fill, minmax(190px, 1fr))`, 2 colonnes ≤ 900 px.

### `transitionPartagee.js` — élément partagé (le moment fort)
- `volerVers(depuis, vers, { duree = 500, muscle, contenu, rayonDepart = 20, rayonArrivee = 28 })` → `{ fini: Promise, annuler() }`.
  `depuis` : élément (son contenu est cloné) ou rectangle ; `vers` : élément d'arrivée (masqué pendant le vol). FLIP par rAF, courbe Vaul
  `cubic-bezier(.32,.72,0,1)`, **contre-échelle** : le contenu n'est jamais étiré (4:3 → 16:9 recadré comme `object-fit: cover`).
  `prefers-reduced-motion` : rien ne vole, `fini` est résolue tout de suite.
- Câblage : `ouvert = id; await nextTick(); volerVers(elMedia, panneau.value.media(), { muscle })` — seulement à la 1re ouverture
  (pas quand on passe au suivant, panneau déjà ouvert). Marche aussi vignette → bandeau d'une fiche client.
- Aussi : `bezier(x1,y1,x2,y2)`, `vaul`, `etapeFlip(a, b, p)` (pures, testées), `mouvementReduit()`.

### `FigureMouvement.vue`
`<FigureMouvement :mouvement="mouvementDe(ex)" />` — bâtons qui miment le mouvement (`squat | charniere | tirage | pousse | pompe | gainage | cardio`).
Bouge au survol d'une `.st-carte` ou sous un ancêtre `.is-joue`. Couleur `--mi` (posée par `data-m`).

### `useSauvegardeAuto.js`
`const s = useSauvegardeAuto((patch) => data.exercices.mettreAJour(id, patch), { delai: 600, dureeOk: 2400 })`
- `s.planifier(valeur)` à chaque saisie (écrit `delai` ms après la dernière ; une seule écriture en vol, la dernière valeur gagne) ·
  `await s.maintenant()` (avant fermeture / changement d'élément) · `s.reessayer()` · `await s.arreter()` dans `onBeforeUnmount`.
- `s.etat.value` : `repos | attente | encours | ok | erreur` ; `s.erreur.value`. À passer à `IndicateurSauvegarde` ou à `PanneauLateral :sauvegarde`.
- Attention : `planifier` remplace la valeur en attente → envoie l'objet complet des champs modifiés (fusionne toi-même les patchs si plusieurs champs).

### `IndicateurSauvegarde.vue`
`<IndicateurSauvegarde :etat="s.etat.value" @reessayer="s.reessayer" />` — anneau « Enregistrement… », coche « Enregistré », « Non enregistré » + Réessayer.

### `toast.js` + `ToastSt.vue`
`toast('Vidéo validée', { action: 'Annuler', surAction: () => annuler(), duree: 4500 })` ; `fermerToast()`. Un seul à la fois.

### `Filtres.vue`
`<Filtres v-model="choix" :options="[{ valeur, texte, muscle?, n?, propose? }]" :multiple="true" etiquette="Groupes musculaires" />`
Rangée défilante de bascules (`aria-pressed`), teinte du muscle quand `muscle` est donné ; `multiple=false` → valeur unique (`''` = aucune). Slot en fin de rangée.

### `Puce.vue`
`<Puce variante="neutre|propose|ok|alerte|muscle" :muscle="'dos'" point>Texte</Puce>` — statut non cliquable.

### `LecteurVideo.vue`
`<LecteurVideo :id="idVideoDe(ex)" :titre="ex.nom" :auto="true" />` — iframe youtube-nocookie, à monter **au clic seulement**, en enfant direct d'un conteneur positionné (en-tête du panneau).

### `IconeSt.vue`
`<IconeSt nom="ex" />` — 24×24, trait 1,8, `currentColor`. Noms : maison, ex, clients, prog, cal, msg, cloche, seance, video, donnees, sortir, plusmenu, plus, fermer, haut, bas, play, check.

### `medias.js` (pures, testées)
`muscleDe(ex)` (teinte : 1er muscle principal reconnu → `muscle` → catégories) · `teinteDe(mot)` (synonymes : pectoraux→pecs, fessiers→jambes, abdos→gainage…) ·
`nomMuscleDe(ex)` · `mouvementDe(ex)` · `mediaDe(ex)` → `{ type: 'photo'|'youtube'|'figure', src?, id?, embed? }` · `urlPhoto(ex)` (accepte `/api/…`, http(s), blob:, data:image ; refuse `//hote`, `javascript:`) ·
`statutVideo(ex)` → `propose|valide|aucune` · `dureeCourte(s)` → « 0:20 » · `idVideoDe(ex)` · `miniatureYoutube(id)` · `TEINTES_STUDIO`, `NOMS_MUSCLES`, `NIVEAUX`.

### `navigation.js`
`NAV_PRINCIPALE`, `NAV_SECONDAIRE` (`{ to, texte, court?, icone, bas?, compteur?, aussi? }`), `estActif(entree, chemin)`, `compte(entree, etat)`.
Un nouvel écran avec une nouvelle URL : demande à REX de l'ajouter ici (fichier racine).

### `tokens.css` (classes communes)
Variables `--st-*` (couleurs, rayons, ombres, courbes `--st-ressort|--st-sortie|--st-vaul`, durées `--st-d-*`), teintes `data-m="jambes|dos|pecs|epaules|bras|gainage|mobilite|cardio"` → `--mc` (pastel) / `--mi` (encre).
Classes : `.st-entete` (+ `.st-actions`), `.st-btn` (`--jaune`, `--encre`, `--danger`, `--rond`, `--fantome`), `.st-bloc`, `.st-sr` (texte pour lecteur d'écran).
Animations : `st-entree`, `st-cascade`, `st-tourne`, `st-trace`. Mouvement réduit : tout est ramené à 1 ms sous `.st-app`.

## Tests et vérifications du lot 0
- `tests/unit/studio-fondations.test.js` (16 tests : médias au contrat, navigation, sauvegarde auto, Bézier, FLIP + contre-échelle).
- Captures 1280×800 et 390×844 : `src/coach/studio/captures/` (cadre, pont, feuille « Plus », démo vignettes, vol, panneau, feuille).
