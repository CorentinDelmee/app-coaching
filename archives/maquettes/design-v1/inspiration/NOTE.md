# Inspiration : ce qu'on reprend et pourquoi

> Repérage du 2026-10-20. Les apps du commerce sont décrites de mémoire (pas de captures
> récupérées) : à vérifier en ouvrant les apps. On s'inspire des principes, on ne copie ni
> polices, ni couleurs de marque, ni logos.

## Règle d'or (Family / Benji Taylor, Things 3)
**Rien n'apparaît de nulle part : tout vient de l'élément touché.** Une carte devient une page,
une série devient un panneau, une valeur devient un sélecteur, le bouton menu devient le menu.
C'est la règle commune aux 5 maquettes. Source : billet « Family values » (benji.org/family-values),
fondé sur trois idées : simplicité, fluidité, plaisir.

## Interne : coaching-domicile design-v2
| Réf. | On reprend | Pourquoi |
|---|---|---|
| M3 « Quel est votre objectif » | La carte touchée s'ouvre en plein écran par **clip-path `inset()` depuis son rectangle** (0,9 s, `expo.inOut`), puis le contenu arrive en cascade (y 40, stagger 0,1). Fermeture inverse plus rapide (fondu 0,25 s, puis clip 0,75 s). M3 préférait le clip-path au Flip, qui laissait des styles en ligne sur une carte `position: fixed`. | C'est la transition que Corentin adore : on en fait le **patron carte → page** (dashboard → Coaching, workout → séance). |
| M3 général | Lourd, net, chaleureux ; aplats de couleur qui s'ouvrent ; rideau de couleur entre pages ; menu plein écran en cascade ; compteurs qui défilent. | C'est son style préféré. On garde l'esprit, avec de nouvelles couleurs et polices. |
| M1/M2 | Anthracite et accents chauds, panneau de réglage ambiance/accent/typo. | Le panneau lui sert à tester : on le remet dans chaque maquette. |
| Interdits | Polices Archivo, Figtree, Bricolage Grotesque, Instrument Sans, Public Sans, Schibsted Grotesk (celles du site). Pas de noir pur, pas de noir + orange. Pas de titres très gras. | Ce sont ses retours (lecons.md) et la règle du cahier des charges. |

## Sport / fitness
| Réf. | On reprend | Pour quel écran |
|---|---|---|
| Apple Watch Workout | **Une donnée dominante** en chiffres géants, une couleur par métrique, le reste en petit. | Séance en cours, chronos |
| Apple Activity (anneaux) | Anneau qui se remplit avec un léger ressort, petite célébration quand il se ferme. | Dashboard « cette semaine x/3 », fin de séance |
| Chronos (Seconds, Tabata Timer, NTC) | **Fond entier teinté selon la phase** (travail / repos / préparation), fondu d'environ 200 ms, chiffres sur 35-40 % de la hauteur en **chiffres tabulaires**, anneau qui se vide, pulsation sur les 3 dernières secondes, bip et vibration. Le temps est calculé sur l'horloge réelle. | AMRAP, EMOM, Tabata, repos |
| Hevy / Strong | **Valider la série = un seul geste**, qui lance le chrono de repos tout seul ; la hiérarchie des infos (série, kg, répétitions, précédent). Leur style est trop plat : le waouh, on l'apporte nous. | Liste des séries |
| Future / Ladder | **Barre segmentée en haut**, façon stories : un segment par exercice, on voit où on en est. | Séance en cours |
| Nike Training Club | Nom de l'exercice en très grande typo condensée sur fond plein ; compte à rebours avec des coupes franches. | Exercice plein écran, maquette « salle » |
| Peloton | Changement de phase annoncé par un **bandeau plein écran bref** (« Minute 4 / 12 »). | EMOM, Tabata |
| Oura / Whoop | Une jauge héros, nombre qui **compte de 0 à la valeur** à l'ouverture. Oura : serif fin pour l'émotion, grotesque pour les faits, fond papier chaud, titres en graisse 300 (la taille fait la hiérarchie, pas le gras). | Dashboard, maquette éditoriale |
| Gentler Streak | Ton bienveillant : on récompense, on ne culpabilise jamais ; formes qui respirent. | Fin de séance, questionnaires |
| Strava | Carte récap de fin de séance, visuelle et « partageable ». | Écran de fin |
| Fitbod | La carte d'exercice qui s'agrandit en plein écran. | Overview vers exercice |

## Hors sport
| Réf. | On reprend | Pour quel écran |
|---|---|---|
| Things 3 | Un bouton qui **devient** un formulaire, sans coupure, avec un ressort soigné. | Série vers détail, valeur vers sélecteur |
| Duolingo | **Une question = un écran**, barre de progression qui bondit, retour immédiat, fin en 3 temps (score, série de jours, récompense). | Questionnaires, fin de séance |
| Revolut | **Chiffres qui roulent** (roulette de chiffres). Rythme magazine : des bandes pleines qui se succèdent sans transition molle. | Sélecteur de valeur, compteurs |
| Airbnb | Patron carte vers détail : l'image ou le bloc s'agrandit et devient l'en-tête de la page. | Programme vers workout |
| Flighty / Opal | **Un état = une couleur + une animation** (prévu, fait, en retard). | Calendrier (fait / à faire / aujourd'hui) |
| Apple (bibliothèque) | Bandes alternées clair / sombre, une seule couleur d'action, interface qui s'efface. | Rythme général |

## Technique et ressenti (Emil Kowalski, Rauno, Codrops)
- **Barème Emil** (`review-animations`) : interface sous 300 ms, `ease-out` fort `cubic-bezier(.23,1,.32,1)`, jamais `ease-in`, jamais `scale(0)` (partir de 0,95 + opacité), appui `scale(.97)`, entrée et sortie asymétriques, rien d'animé sur une action répétée 100 fois par jour. Les grandes transitions de navigation peuvent dépasser 300 ms (0,5 à 0,9 s) parce qu'elles **expliquent où l'on va**.
- **Vaul** (tiroir d'Emil) : tiroir qu'on tire au doigt, avec la vitesse du geste, interruptible, courbe `cubic-bezier(.32,.72,0,1)`. Pour l'overview pendant la séance.
- **Roue iOS** : grand sélecteur avec **crans magnétiques**, valeurs voisines estompées et réduites, inertie (GSAP Draggable + Inertia, ou scroll-snap), vibration à chaque cran sur Android (iOS Safari ne vibre pas).
- **Codrops / View Transitions** : grille vers détail avec `view-transition-name` partagé. Pour un contrôle fin et un portage Vue facile : **GSAP Flip** ou clip-path (patron M3).
- **Rauno** : finitions au geste (léger aimant, inertie, retour d'échelle au toucher).
- Retour critique sur Family : des chiffres qui défilent puis s'arrêtent net, ça choque. Il faut toujours une décélération (`expo.out`, `power3.out`).

## Sources
- [Family values, Benji Taylor](https://benji.org/family-values), résumé dans le [Bitcoin Design Monthly d'août 2024](https://studio21design.substack.com/p/august-2024-bitcoin-design-monthly)
- [Hevy : chrono de repos automatique](https://www.hevyapp.com/features/workout-rest-timer/)
- [Exemples de design d'apps de suivi d'entraînement](https://screensdesign.com/articles/workout-tracker-app-design-examples/) : annuler ou corriger une série sans remettre le repos à zéro
- [Vaul](https://vaul.emilkowal.ski), [Emil Kowalski](https://emilkowal.ski), [Rauno](https://rauno.me), [Codrops](https://tympanus.net/codrops/), [View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions)
- Bibliothèque REX : `bibliotheque/design-md/oura`, `revolut`, `nike`, `apple`
