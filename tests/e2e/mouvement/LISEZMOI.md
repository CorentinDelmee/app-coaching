# Détecteur de micro-sauts

Repère les éléments qui **sautent** pendant ou juste après une transition (changement de place, de taille, de texte, apparition
ou disparition sans fondu, copie de page mise en page autrement, page entière qui se recale). Règle vérifiée :
**chaque élément arrive avec la page ou en fondu / translate court, jamais par saut.**

- `enregistreur-page.js` : injecté dans la page ; à chaque `requestAnimationFrame` relève `getBoundingClientRect`, opacité
  effective, visibilité réelle (rognage `overflow` / `clip-path`, page opaque posée au-dessus) et texte propre des éléments visibles.
  Enregistre jusqu'à 1,2 s de calme après le toucher (min 1,2 s, 2,5 s en lent).
- `analyse.mjs` : règles (fonctions pures, testées par `tests/unit/micro-sauts-analyse.test.js`), types de sauts en tête du fichier.
- `parcours.mjs` : parcours (boucles qui reviennent au départ) + sessions démo (Fabien avec une séance « Aujourd'hui · Lundi —
  Haut du corps (force) » à faire et 5 séances dans la semaine, posé dans le localStorage du test seulement).
- `micro-sauts.mjs` : lance Chrome (390×844, toucher, `isMobile`, temps réel), 4 variantes : `lent` (CPU ×4 + base ralentie
  400 ms) / `rapide`, `vide` (page rechargée : cache des lectures vide) / `plein` (parcours déjà joué). Planches image par image
  (capture d'écran continue du navigateur, JPEG réduits) pour les plus gros sauts.

## Lancer

Mesurer sur un **build** (le serveur de dev charge chaque module à la demande : en CPU ×4 il fausse les temps) :

```sh
VITE_MODE_DEMO=1 npx vite build --outDir /chemin/temporaire/dist --emptyOutDir
npx vite preview --port 5251 --strictPort --outDir /chemin/temporaire/dist
node tests/e2e/mouvement/micro-sauts.mjs --base=http://localhost:5251 --etiquette=apres
```

Options : `--parcours=client-accueil,coach-onglets` (filtre sur le nom), `--variantes=rapide-vide,lent-plein`,
`--planches=2` (par étape, 0 = aucune), `--film` (planche de 16 images de chaque étape, même sans saut),
`--sortie=<dossier>` (défaut `docs/captures-micro-sauts`), `--fichier=<module.mjs>` (parcours en plus : `export const PARCOURS = [...]`, même forme, `RETOUR` et `ouvrirSession` importables depuis `parcours.mjs`), `--brut` (enregistrements bruts, débogage), `--index` (régénère seulement la page).

Sortie : `<sortie>/<etiquette>.json`, `<sortie>/planches/<etiquette>/*.jpg`, `<sortie>/index.html` (tableau avant / après par étape).

## Lire un résultat

Un « saut » = un groupe d'éléments qui sautent ensemble dans la même image. `t` = ms après le toucher ; « après la fin » =
après la dernière image où une page bouge. Les types « tardif » et « double » sont seulement à regarder (mouvement fluide
qui démarre tard, enfant animé pendant que sa page bouge).
Limites : un élément rogné à plus de 50 % compte comme invisible ; les révélations par `clip-path` (page qui naît de la
carte) ne sont pas des apparitions ; le détecteur ne juge pas la beauté d'un mouvement fluide, seulement les sauts.
