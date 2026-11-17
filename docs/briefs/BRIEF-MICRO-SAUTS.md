# Brief commun — micro-sauts de transition (2026-11-16)

Retour de Corentin (coach, mot pour mot), après test sur son téléphone :
« En fait, il s'agit surtout de petits bugs visuels de transition entre éléments ou pages. Par exemple quand je suis sur la page
client et qu'il y a marqué "Aujourd'hui, Lundi Haut du corps (force)" et que je clique dessus, la transition à la page suivante fait
légèrement bug et les petits éléments se déplacent rapidement sans transition de fondu ou de translate, ce qui donne un effet
saccadé. C'est sur ça que j'aimerais travailler. Tous ces petits éléments-là sur l'app. […] »

Ce n'est PAS la fluidité globale (déjà mesurée bonne) : ce sont des **éléments qui sautent** pendant ou juste après une transition.
**Règle : chaque élément arrive avec la page ou en fondu / translate court, jamais par saut.**

## Outil (lis `tests/e2e/mouvement/LISEZMOI.md`)
`node tests/e2e/mouvement/micro-sauts.mjs` : à chaque image (rAF) relève position, taille, opacité, texte, visibilité réelle des
éléments, puis signale : `position` (saut > 2 px en une image par rapport à sa page), `fin` (mouvement qui finit par un pas brusque),
`taille`, `texte` (texte changé après l'arrivée), `apparition` / `disparition` (d'un coup dans une page qui reste), `pop` (opacité qui
saute), `echange` (copie de page mise en page autrement), `page` (la page entière se recale). Planches image par image pour les sauts.
Si tu penses qu'un signalement est un faux positif, **dis-le dans ton rapport avec la preuve (planche)**, ne modifie pas l'outil.

## Déjà corrigé dans le socle par REX (NE PAS MODIFIER ces fichiers)
- Exemple de Corentin : la copie de la carte touchée (voile de `transitions.js`, fantôme de `passage.js`) était mise en page dans le
  rectangle de la carte SOULEVÉE (agrandie de ~10 %) : les puces « ≈ 25 min · 4 exercices · À faire » passaient sur une ligne et
  sautaient de 47 px à l'instant où la page naissait. Au retour, la copie du tableau de bord gardait la carte soulevée et le vrai
  tableau de bord la remplaçait au milieu de son retour (saut de 20-30 px). Corrigé : copie mise en page à la taille d'origine puis
  mise à l'échelle, fermeture dans la carte au repos, fantôme sans transition CSS.
- Coach : l'entrée de page en `translateX(20px)` débordait horizontalement : sur téléphone, la page s'élargissait une image et la
  barre du bas sautait de 9-18 px à l'ouverture d'un éditeur (`overflow-x: clip` sur `.st-main`).
- Accueil client : tuiles jamais rognées.
- Fichiers socle interdits : `src/anim/*`, `src/composables/*`, `src/coach/CoachLayout.vue`, `src/coach/studio/*.js|*.vue|*.css` à la
  racine de `studio/` (layout.css, tokens.css, transitionPartagee.js, PanneauLateral.vue, Filtres.vue, Puce.vue…), `src/data/*`,
  `src/router/*`, `src/styles/couches.css`, `src/styles/tokens.css`, `src/styles/base.css`, `tests/e2e/mouvement/*`, `DECISIONS.md`,
  `ETAT.md`, les LISEZMOI. Un besoin dans ces fichiers → ton rapport (« besoin socle : … » avec le correctif proposé exact).

## Causes typiques à chercher (et le correctif attendu)
- **Contenu qui arrive avec la donnée** à une autre place / taille que son squelette → squelette de la même taille exacte, ou place
  réservée (`min-height`, mêmes marges) ; ne pas insérer un bandeau / une ligne au-dessus du contenu déjà affiché.
- **Cache puis donnée fraîche** : si la valeur est identique, ne rien redessiner (clé stable `:key="x.id"`, pas de remplacement d'objet
  qui recrée les nœuds) ; si elle diffère, pas de saut de mise en page (place réservée).
- **Élément qui apparaît / disparaît d'un coup** dans une page déjà affichée (champ, bandeau, image, puce) → il arrive avec la page
  (présent dès le premier rendu, éventuellement désactivé) ou en fondu .9 → 1 + translate ≤ 8 px, 160-240 ms, `--st-sortie` /
  `ease-out` ; une disparition = fondu court (≤ 120 ms) ou rien si tout le bloc est remplacé (changement d'onglet : l'ancien contenu
  part dans la même image, le nouveau joue l'entrée d'onglet `translateY(6px)` + opacité .9 → 1, 240 ms, comme les pages).
- **Image qui arrive tard** (photo, vignette) → place réservée (ratio fixe) et fondu de l'image seule (opacité 0 → 1, 160 ms) ;
  jamais de changement de taille du cadre.
- **Rangée d'onglets / filtres qui défile d'un coup** pour montrer l'onglet actif → `scrollTo({ left, behavior: mouvementReduit() ? 'auto' : 'smooth' })`
  (ou `scrollIntoView({ inline: 'nearest', block: 'nearest', behavior })`), jamais un `scrollLeft =` sec.
- **Enfant animé pendant l'entrée de la page** (cascade, GSAP) qui finit par un saut → une seule source de mouvement par élément ;
  pas de cascade rejouée sur un contenu qui arrive après un chargement.
- **Fin de vol / transitionPartagee** qui se termine par un saut → l'élément d'arrivée doit être à sa place finale avant la fin du vol.
- Police qui change (FOUT) : vérifier que la page n'utilise que les polices préchargées.

## Ta méthode
1. Lis `src/coach/studio/LISEZMOI.md` (sections « Espacements » et « Mouvement et chargement ») et ta consigne.
2. Construis et sers TON build (le serveur de dev fausse les mesures en CPU ×4) — dossier et port à toi :
   `VITE_MODE_DEMO=1 npx vite build --outDir <ton scratch>/dist --emptyOutDir` puis
   `npx vite preview --port <TON PORT> --strictPort --outDir <ton scratch>/dist` en arrière-plan (note le PID).
   Après chaque correction : rebuild (2-3 s), le preview resert le nouveau dossier.
3. **Avant** : `node tests/e2e/mouvement/micro-sauts.mjs --base=http://localhost:<PORT> --parcours=<tes parcours> --etiquette=avant --sortie=<ton scratch>/sauts --film`
   (4 variantes : lent/rapide × cache vide/plein). Ouvre les planches et les films (`Read` sur les JPEG) : regarde ce que le doigt voit.
   Ajoute des parcours propres à ton écran si les miens ne couvrent pas tout (ouvrir/fermer feuilles, panneaux, onglets internes,
   suivant/précédent…) dans `<ton scratch>/parcours.mjs` (`export const PARCOURS = [...]`, même forme que `tests/e2e/mouvement/parcours.mjs`,
   importe `RETOUR` / rien d'autre), lancé avec `--fichier=<ton scratch>/parcours.mjs`.
4. Corrige **cause par cause**, un commit par cause (testé). Changements chirurgicaux : pas de nouveau design, ni couleur ni typo,
   pas de nouvelle animation décorative, rien au fonctionnement métier. Uniquement `transform` / `opacity`. `mouvementReduit()` respecté
   (tokens.css ramène les durées CSS à 1 ms sous `.st-app` ; un tween GSAP / rAF teste `mouvementReduit()` lui-même).
5. **Après** : même commande avec `--etiquette=apres` et la même `--sortie` (la page `index.html` montre avant / après par étape).

## Interdits (rappel de la checklist REX)
- Ne touche **que** tes fichiers (liste dans ta consigne).
- Git : `git -C /Users/corentindelmee/Documents/REXV2/Projets/app-coaching add -- <chemins précis>` puis
  `git -C … commit -m "…" -- <chemins précis>` ; jamais `-A`, `--amend`, `stash`, `push`, `reset`, `checkout` de fichiers d'autrui.
  D'autres agents commitent en même temps : si `index.lock` existe, attends 3 s et réessaie. Message en français, préfixe
  `micro-sauts (<écran>) : …`, dernière ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Serveur : ton port seulement ; **arrête ton preview par son PID (`kill <PID>`) avant ton rapport**, vérifie avec `lsof -iTCP:<PORT> -sTCP:LISTEN`.
- Scripts temporaires et sorties : `/private/tmp/claude-501/-Users-corentindelmee-Documents-REXV2/7d6e82c9-8e39-4968-958e-bacf37fe3f79/scratchpad/micro-sauts/<ton-nom>/`.
  Jamais de `node -e` avec des backticks : écris un fichier puis lance-le.
- Le Mac est partagé par ~8 agents : les durées varient ; fie-toi aux sauts et aux planches, pas aux millisecondes.

## Vérifications obligatoires avant ton rapport
- `npx vitest run` : tout vert (876 aujourd'hui).
- Banc Studio de ton écran (espace coach) : `node tests/e2e/studio/banc.mjs --only=<ecran> --port=<TON PORT + 100> --out=<ton scratch>/banc` : 0 fail.
  (Écrans client : pas de banc Studio ; fais à la place une capture 390×844 et 1366×690 de chaque page touchée.)
- Capture 1366×690 (ordinateur) des pages touchées : aucune régression.

## Rapport (15 lignes max, en message)
Sauts avant → après par parcours (chiffres de `index.html`), causes trouvées et corrigées (1 ligne chacune), commits (identifiants),
tests et banc, faux positifs de l'outil (avec planche), besoins socle, **doutes et failles**, tokens et durée.
