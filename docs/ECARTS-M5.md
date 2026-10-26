# Écarts entre l'app et la maquette M5 — alignement du 26/10/2026

Demande de Corentin : l'app doit être **exactement comme M5** (`design/m5/`) sur la page d'accueil (et ses interactions),
le menu, le jaune, la couleur de surbrillance et les tokens. En cas de doute entre V2 et M5 sur ces points : **M5 gagne**.
Ce qui n'est pas concerné (et reste V2) : séance page par page, chronos, circuits, 3 ambiances, Grand affichage (`RETOURS-MAQUETTES-V1.md`).

Captures : `docs/captures-m5/` (`m5/` = maquette, `avant/` = app avant, `apres/` = app après) ; comparaison côte à côte :
`docs/captures-m5/comparaison.html`. M5 capturée avec l'accent « Jaune pâle » et l'ambiance correspondante.

## Valeurs de référence (relevées dans le code de M5)

| Token | Valeur M5 | Source |
|---|---|---|
| Jaune (accent) | `#F2E27A` | `design/m5/assets/app.js` (ACCENTS, « Jaune pâle ») + `DESIGN.md` |
| Texte sur le jaune | `#26230A` | idem (`t`) |
| Surbrillance (fond mis en avant) | `color-mix(in srgb, var(--accent) 22%, var(--surface))` + trait `inset 0 0 0 2px var(--accent)` | `style.css` `.wli.auj` (`--accent-doux`) |
| … calculée | clair `#FCF9E2` · sombre `#575641` · bleu `#4D5257` | mesuré dans le navigateur : identique M5 / app |
| Surbrillance légère / série | 16 % dans la surface (`.jour.sem`) · 14 % dans surface-2 (`.serie.cur`) | `style.css` |
| Durées / courbes | menu 0,85 s `expo.out` (fermeture 0,75 s), page 0,85 s `expo.inOut`, croix 0,45 s `cubic-bezier(.32,.72,0,1)`, lever de carte 0,22 s `power2.out` | `app.js` (T, E) |

Tous ces tokens sont désormais dans **`src/styles/tokens.css`** (source unique) ; `src/anim/constantes.js` (`M5`) en est le miroir pour GSAP.

## Tableau des écarts

| # | Élément | M5 | App avant | Action | État |
|---|---|---|---|---|---|
| 1 | Jaune | `#F2E27A`, texte `#26230A` | `#FFD43B`, texte `#1A1B1E` | `--jaune` / `--accent-texte` remplacés ; toutes les teintes dérivées (aplat, chips, halos, surbrillance, phases « travail ») suivent par variable | corrigé |
| 2 | Surbrillance (ligne « aujourd'hui » / à faire en premier) | fond accent 22 % dans la surface + trait d'accent 2 px, flèche ronde en accent | fond jaune plein, texte foncé | `--surbrillance`, `--surbrillance-trait` ; `.ligne-w.en-avant` (Programme, Questionnaires) ; messages du profil/connexion | corrigé |
| 3 | Semaine en cours dans le mois | accent 16 % (`.jour.sem`) | bande `--surface` | `--surbrillance-legere` sur `.bande-semaine` | corrigé |
| 4 | Accueil : structure | page « surface », décor (grand chiffre du jour détouré + 2 halos), en-tête (menu à gauche, « Semaine 3 sur 8 » à droite), « Bonjour » / « Fabien. » / date, grille 2 col. × 3 rangées (1.4fr 1.15fr .72fr) | aplat jaune en haut (en-tête + message + carte du jour encre), grille dessous, défilement | reconstruit à l'identique (`Accueil.vue`, `accueil.css`) | corrigé |
| 5 | Carte du jour | carte **accent** pleine largeur, « W2 » détouré, flèche ronde inversée (`--tf` / `--tb`) | carte encre dans l'aplat, flèche jaune | idem M5 | corrigé |
| 6 | Anneau « Cette semaine » | 96 px, viewBox 120, r 50, trait accent | 92 px, r 48, trait encre en clair | idem M5 (jaune en forme : déjà accepté en V2) | corrigé |
| 7 | Barres du programme | semaines passées en accent, semaine en cours en couleur du texte | barres encre | idem M5 (`.on`, `.cur`) | corrigé |
| 8 | Entrée de l'accueil | décor depuis z -400 (1,8 s), halos (2 s), en-tête, lettres en 3D (1,1 s, pas 0,055), cartes sur 3 couches (`data-couche`), anneau + compteur à 0,5 s, pastille `back.out(1.7)` à 1,1 s | rideau jaune, cartes 2 couches, barres qui poussent, pastille qui respire 3 fois | timeline M5 reprise (valeurs identiques) ; barres et respiration retirées | corrigé |
| 9 | Survol (ordinateur) | parallaxe : cartes inclinées selon leur couche (quickTo 0,6 s), décor en sens inverse (1 s) ; rien au toucher | aucune | portée telle quelle | corrigé |
| 10 | Clic sur une carte | la carte se soulève (z 70, scale 1.04, ombre `--lev`, 0,22 s), puis la page naît d'elle ; le tableau de bord **reste derrière** et recule (scale .92) ; au retour il se rapproche et la carte se repose | la page naissait de la carte sur un fond vide (le tableau de bord disparaissait) | lever de carte + copie inerte du tableau de bord derrière la page (`poserDessous` / `reculerDessous` / `rapprocherDessous`, `src/anim/passage.js`) | corrigé (mesuré : scale 0,92 à l'ouverture, 1 au retour) |
| 11 | Retour d'une séance validée | la carte « Cette semaine » se soulève une fois (scale 1.06, z 40, aller-retour) | anneau qui rebondit | idem M5 | corrigé |
| 12 | Bouton du menu | rond 52 px **dans la page, à gauche**, 2 traits de 2 px (22 × 12), croix en CSS 0,45 s vaul, sans ombre ; recule avec la page | rond 56 px flottant à droite, traits 2,5 px, ombre, croix en GSAP | accueil : bouton dans la page (`src/lib/menu.js` relie la page au menu) ; autres rubriques : bouton flottant du même dessin (à droite, voir écarts restants) | corrigé |
| 13 | Menu : rubrique active | titre en accent | numéro sur pastille jaune | sombre / bleu : titre en accent (M5) ; clair : pastille gardée (voir écarts restants) | corrigé (sauf clair) |
| 14 | Menu : marges, numéros, pied | haut `max(safe, 16px)`, numéros 22 px, pied « Force & cardio · semaine 3 / 8 » | haut 24 px + 6, numéros 30 px centrés, pied = nom du programme | idem M5 (pied : programme · semaine n / total) | corrigé |
| 15 | Menu : ouverture / fermeture / rubrique | plan x 70 %, scale .82, rotateY -14 (0,85 s expo.out) ; rubriques depuis z -340 rotateY 42 (pas .055) ; fermeture 0,75 s ; rubrique : plan qui s'envole puis nouvelle page depuis z -520 | identique (lot V2.3a) | durées branchées sur `M5.T` ; mesuré : même transform à 400 et 1000 ms | identique |
| 16 | Tokens | tout en variables dans `style.css` | `tokens.css` V2 + valeurs en dur dans quelques composants | `tokens.css` = source unique (couleurs M5, échelle typo, interlignes, espacements, rayons, ombres, durées, courbes) ; couleurs en dur retirées de `acces.css`, `ecrans.css`, `celebration.js` | corrigé |

## Écarts restants (assumés, à valider par Corentin)

1. **Menu en ambiance claire** : M5 met le titre actif en jaune ; sur le fond du menu (#D2D5DA) le jaune fait 1,1 : 1, illisible,
   et Corentin a demandé « jamais de jaune en texte sur fond clair ». Gardé : numéro sur pastille jaune (clair seulement).
2. **`--texte-doux` en clair** : `#565B62` (V2) au lieu de `#6A6F76` (M5, 4,0 : 1 sur le fond perle, sous le minimum 4,5 : 1).
3. **Message d'accueil** : texte V2 (« Prêt, / Fabien ? », « Bien joué, / Fabien. », « Semaine / bouclée ! ») posé dans la
   structure M5 (petite ligne au-dessus, grand titre) ; « Bonjour Fabien » avait été refusé (`RETOURS-MAQUETTES-V1.md`).
   Au-delà de 7 signes, le titre prend toute la largeur et la date passe dessous (aucun mot coupé).
4. **Bouton du menu sur les autres rubriques** : à droite (flottant), car leur en-tête V2 porte le bouton retour à gauche.
   Dans M5, une rubrique ouverte par le menu montre le menu à gauche à la place du retour. Hors périmètre (en-têtes V2).
5. **Liens de démo** (« Séance démo », « Circuits », mode local seulement) : hors maquette, superposés en 11 px au bas de l'accueil.
6. **Ordinateur** : M5 montre un cadre de téléphone de 390 px ; l'app garde sa colonne de 520 px max.
7. **Espace coach** (`src/coach/coach.css`) : palette propre, non concernée (l'alignement porte sur l'app client).
8. Séance, chronos, circuits : V2 conservée (choix de Corentin), y compris `--prep-bg` / `--repos-bg` V2 (M5 : préparation jaune pâle).

## Vérifications

- `npx vitest run` : 370 tests verts.
- Navigateur 390 × 844 et 1280 × 800, clair / sombre / bleu, Grand affichage : `tests/e2e/lot5-dashboard-menu.js` (sélecteur
  du bouton mis à jour) et `lot5-6-cas-limites.js` sans erreur ; tableau de bord sans défilement (844/844).
- Mesures (Playwright) : transform du plan pendant l'ouverture du menu M5 / app à 400 ms (x 270 / 268, scale .822 / .823) et
  1 s (x 273, scale .820 des deux côtés) ; copie du tableau de bord à scale .926 à 600 ms puis .92, revenue à 1 au retour.
- Mouvement réduit : menu = simple glissement (scale 1), entrée en fondu, pas de lever ni de recul de carte.
- Clavier : Entrée ouvre le menu, Échap ferme et rend le focus au bouton de la page, `aria-expanded` suit l'état.
