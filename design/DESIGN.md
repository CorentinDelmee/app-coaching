# DESIGN.md : app client « Corentin Delmée Coaching » (direction M1 « Atelier », provisoire)

> Source de vérité du style pour le développeur. La référence vivante est le prototype
> `design/m1/` : `assets/anim.js` contient toutes les transitions, `assets/style.css` les tokens,
> `assets/seance.js` la séance. **Porter ces fonctions telles quelles, sans réinventer.**
> Recommandation et limites : `design/RECOMMANDATION.md`. Inspiration : `design/inspiration/NOTE.md`.

## 1. Direction
**Lourd, net, chaleureux.** Tout part de l'élément touché : une carte devient une page, un bouton
devient un cercle plein écran, une ligne devient un panneau. Rien n'apparaît de nulle part.
Références retenues :
- coaching-domicile M3, pour la révélation en clip-path ;
- Apple Watch Workout, pour la donnée dominante en chiffres géants ;
- Hevy, pour la série validée en un geste, qui lance le repos ;
- Things et Family, pour l'objet qui se transforme ;
- Duolingo, pour une question par écran.

## 2. Tokens (fichier `src/styles/tokens.css`, repris de `m1/assets/style.css` lignes 1-80)
Ne mettre aucune couleur en dur dans les composants : utiliser seulement les variables.
- `--couleur` (accent choisi) : framboise `#E5486A` par défaut. Autres choix : lagon `#2FB8B0`,
  citron `#D8E04A`, sauge `#9DC08B`, lilas `#A99BEA`, corail rosé `#F28C86`.
- `--encre #1F1B18` (texte posé sur l'accent).
- Ambiances, posées par `data-ambiance` sur `<html>` :

| Ambiance | `--fond` | `--surface` | `--surface-2` | `--texte` | `--texte-doux` |
|---|---|---|---|---|---|
| sombre (défaut) | #25221F | #302C28 | #3B3631 | #F3EDE4 | texte à 62 % |
| clair | #F4EEE3 | #FBF8F2 | #E9E0D1 | #26211D | texte à 62 % |
| aplat | `--couleur` | accent à 86 % + encre | — | #1F1B18 | — |

- Variables dérivées :
  - `--accent`, `--accent-texte` ;
  - `--accent-lisible` : en clair, l'accent assombri pour le texte (`color-mix`) ;
  - `--filet` : texte à 12-13 % ;
  - `--bien` : vert pour « fait ».
- Phases de chrono : `--ph-prep-bg/fg` (neutre), `--ph-travail-bg/fg` (accent / encre),
  `--ph-repos-bg/fg` (sombre : #2A3F6B / #E8EEFA ; clair : #CFE0F2 / #1F2A44).
- Rayons : cartes `--r-carte 26px`, boutons `--r-btn 22px`, tuiles 22-24, pastilles 999.
  Espacements : `--pad 16px`, `--gap 12px`.
- Zones sûres : `--haut: calc(env(safe-area-inset-top) + 24px)`,
  `--bas: max(env(safe-area-inset-bottom), 16px)`. Hauteur `100dvh`.
- Ombre (seulement pour une carte qui se soulève) : `0 18px 50px rgba(0,0,0,.35)`
  (clair : `rgba(60,40,20,.18)`).

## 3. Typographie (auto-hébergée dans `src/assets/fonts/`, licence OFL)
- **Unbounded 400** : titres et grands chiffres, `letter-spacing -.03 à -.04em`.
  **Jamais au-dessus de 500.**
- **Onest 400/500/600** : texte, boutons (600), étiquettes. **Chronos en Onest avec
  `font-variant-numeric: tabular-nums`**, parce qu'Unbounded n'a pas de chiffres tabulaires fiables.
- Échelle :

| Usage | Taille |
|---|---|
| Chrono | 150 px (112 px en repos) |
| Roue du sélecteur | 112 px |
| Valeur de champ | 96 px |
| Titre héros | 41-48 px |
| Titre de page | 34 px |
| Nom d'exercice | 31 px |
| Texte | 16-19 px |
| Étiquettes | 12-13 px, capitales, +.09em |

- Interdites : Archivo, Figtree, Bricolage Grotesque, Instrument Sans, Public Sans,
  Schibsted Grotesk (polices du site).

## 4. Mouvement (constantes à garder dans `src/motion/constantes.js`, issues de `anim.js` `T` / `E`)

| Transition | Durée | Courbe | Fonction du prototype |
|---|---|---|---|
| Carte → page (clip `inset` arrondi → plein) | 0,85 s | `expo.inOut` | `A.ouvrirPage` |
| Page → carte | 0,52 s | `power4.inOut` | `A.fermerPage` |
| Cascade du contenu (y 46 → 0, opacité) | décalage 0,07 s | `expo.out` | dans `ouvrirPage` |
| Menu (cercle depuis le bouton) | 0,78 s / 0,46 s | `power4.inOut` | `A.ouvrirMenu` / `A.fermerMenu` |
| Rideau d'accent entre rubriques | 0,72 s | `power4.inOut` | `A.balayerVers` |
| Bouton → chrono, repos ou fin (cercle) | 0,72 s / 0,46 s | `power4.inOut` | `A.ouvrirCercle` / `A.fermerCercle` |
| Ligne → série, valeur → roue (rectangle) | 0,62 s / 0,42 s | `power3.out` | `A.ouvrirRect` / `A.fermerRect` |
| Exercice suivant (slide + swipe) | 0,75 s | `expo.out` | `S.allerEtape` |
| Compteurs (0 → valeur) | 0,8-1,4 s | `power3.out` (jamais d'arrêt net) | `A.compter` |
| Appui sur un bouton | 0,16 s | CSS `scale(.97)`, retour `back.out(2.6)` | CSS `.gros:active` |

Règles :
1. **Entrée ample, sortie rapide** : la sortie dure 0,55 à 0,65 fois l'entrée.
2. Animer seulement **transform, opacity, clip-path**, plus le tracé d'un seul anneau SVG.
   Jamais width, height, top ou left.
3. `will-change` seulement pendant l'animation. Tuer les timelines au démontage
   (`onBeforeUnmount`, `gsap.context().revert()`).
4. **Bloquer les touchers pendant une transition de page**, puis rendre la main au `onComplete`
   (limite connue de la maquette).
5. `prefers-reduced-motion` : chaque transition devient un fondu de 0,15 à 0,25 s, sans
   déplacement ni découpe. Garder les repères : la couleur et le compteur final s'affichent.
6. Ce qui est fréquent reste sobre : valider une série, c'est une coche plus le repos, sans
   cascade. Ce qui est rare a droit à la fête : fin de séance, semaine bouclée, fin de
   questionnaire.
7. Chronos calculés sur l'horloge (`now` injecté, moteur pur dans `src/engine/`), jamais par
   addition de `setInterval`. Pulsation et bip sur les 3 dernières secondes. Le fond change de
   couleur selon la phase en fondu croisé (opacité de deux calques).

## 5. Composants clés (voir le prototype)
- **Accueil en bento**, sans défilement à 390×844. Trois rangées 1,55 / 1,05 / 0,85 :
  - carte héros « Aujourd'hui » en aplat d'accent, avec un rond flèche en haut à droite ;
  - « Cette semaine », avec l'anneau x/3 ;
  - « Coaching », avec la date en Unbounded et l'heure en accent ;
  - « Mon programme », avec des points de semaine ;
  - « Questionnaires », avec une pastille.
  Le bouton menu rond (56 px) est en haut à droite.
- **Menu** : cercle d'accent plein écran, 6 rubriques en grand, qui arrivent en cascade.
- **Coaching** : en-tête issu de la carte, boutons Modifier / Annuler (WhatsApp), rappel
  « 24 h », mot du coach, « 4e séance du mois », récap € compté.
- **Programme** : colonnes de la semaine. Bascule semaine ⇄ mois, et « À faire cette semaine ».
- **Exercice** :
  - en-tête : barre segmentée, nom, puces (4 × 10 reps · 16 kg · repos 90 s), « Dernière fois », vidéo ;
  - consigne du coach, avec un filet d'accent ;
  - lignes de série d'au moins 76 px (n°, « 10 × 16 kg », rond de validation) ;
  - bouton pleine largeur « Valider la série N » ;
  - tiroir de l'overview sur le bord droit.
- **Série ouverte** : deux grandes tuiles, Répétitions et Charge (96 px plus l'unité), avec
  « Modifier ». Un toucher sur une tuile ouvre la **roue**.
- **Roue** : plein écran sur l'accent. Défilement natif `scroll-snap-type: y mandatory`, valeurs
  voisines estompées et réduites, cadre central de 120 px, unité à droite, vibration à chaque
  cran (Android). Bouton « Valider » encre en bas.
- **Repos** : cercle depuis le bouton, anneau qui se vide, +15 s, Passer. Passage automatique
  à l'exercice suivant, avec « Rester ici ».
- **AMRAP / EMOM** : trois temps (explication → mouvements → chrono plein écran sur l'accent).
  - AMRAP : bouton **« +1 tour » de 138 px de haut** et compteur de tours.
  - EMOM : « minute x/6 » et l'exercice de la minute.
  - Préparation de 10 s non comptée dans le temps.
- **Fin** : l'aplat se referme en anneau, une coche, « Bravo, séance terminée ». Tuiles durée,
  volume, séries, tours, avec les chiffres qui comptent. Bandeau record en accent. « Valider ma
  séance » renvoie dans la carte « Cette semaine », qui passe à 2/3.
- **Questionnaire** : une question par écran, barre de progression, curseur 0-10 à crans,
  émojis, choix. Petite célébration à la fin, puis la pastille disparaît de l'accueil.

## 6. Panneau de réglage (à garder dans l'app, discret, dans Profil > Apparence)
Ambiance (sombre / clair / aplat) et accent (6 choix), mémorisés dans les préférences de
l'utilisateur. Dans la maquette, ce panneau sert à Corentin pour choisir. Dans l'app, ce sera
une préférence.
