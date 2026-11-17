# M2 « Carnet » — éditorial vivant

**Idée** : un carnet d'entraînement de luxe qui s'écrit sous tes yeux ; la typographie est l'élément partagé (le titre d'une carte voyage et devient le titre de la page).
**3 mots** : papier · serif · tracé. Ouvrir `index.html` (servir en HTTP ; GSAP 3.13.0 + polices via CDN).

## Polices (variables `--font-*`)
Titres/chiffres **Fraunces** (opsz 96 fixe, graisse 300, italique pour l'emphase, chiffres tabulaires) · texte **Hanken Grotesk** · étiquettes **IBM Plex Mono** (capitales, 10,5 px).

## Palette (variables)
`--fond --surface --surface-2 --texte --texte-doux --filet --filet-fort --inverse-fond --inverse-texte --phase-repos --accent --accent-texte`.
Ambiances : **clair** « papier » (#F4EEE4 / encre #22201D, défaut), **sombre** « encre » (#1F1E1C), **sauge** (#D2DAC7). Accents : prusse #2D4BD8 (défaut), vermillon, olive, prune, moutarde, bleu nuit. Accent rare : actions et états (bouton, pastille, chrono de travail, tampon). Panneau « Réglages » (hors cadre sur ordinateur ; dans le menu sur mobile), mémorisé en localStorage.

## Échelle typo
Chiffres héros 150-190 px (sélecteur, tours) · titres de page 52-86 · titres d'exercice 64 · cartes 28-40 · texte 15-17 · étiquettes 10,5. Hiérarchie par la taille, jamais par le gras.

## Mouvement (constantes `DUREE`, `EASE` dans `outils.js`)
Grandes transitions 0,8-0,95 s `expo.inOut` (elles expliquent d'où l'on vient) ; apparitions `expo.out` (cascade 0,07 s) ; retours plus rapides (0,75 s) ; appui `scale(.97)`. Seuls `transform`, `opacity`, `clip-path` bougent (exception assumée : `stroke-dashoffset` des anneaux et traits). Chronos calculés sur `Horloge.now()` (performance.now, bouton ×10). Reduced-motion : fondus 0,25 s, pas de déplacement.

## Transitions (fonction JS)
| Transition | Fonction |
|---|---|
| Carte → page (Coaching, Programme, Workout, Check-in), le titre voyage | `ouvrirCarte` / `fermerCarte` + `voler` |
| Bouton menu → menu (cercle depuis le bouton), mot → titre de page | `ouvrirMenu` / `fermerMenu` / `ouvrirDepuisMenu` |
| Page de menu → accueil (glissement + profondeur) | `fermerPousse` |
| Semaine ⇄ mois (GSAP Flip) | `basculerVue` |
| Démarrer → séance (cercle accent) | `demarrerSeance` |
| Slide d'exercice (glisser/swipe, Draggable) | `allerA`, `arriveeA`, `autoSuivant` |
| Série → feuille, valeurs qui voyagent | `ouvrirSerie` / `fermerSerie` |
| Valeur → roue de chiffres (Draggable + Inertia) | `ouvrirSelecteur` / `fermerSelecteur` |
| Chrono repos / travail / circuit (cercle depuis le bouton) | `chronoOuvrir` / `chronoConfigurer` / `chronoFermer` |
| Circuit : explication → exercices → chrono | `ouvrirCircuit`, `circuitEtape`, `lancerCircuit`, `circuitTravail`, `circuitBilan` |
| Tiroir d'aperçu | `ouvrirTiroir` / `fermerTiroir` |
| Fin « couverture de magazine » (rideau, tampon) | `finirSeance`, `animFin`, `validerSeance` |
| Questionnaire (écran par écran, célébration) | `ouvrirQuestionnaire`, `qAller`, `qFin` |
Chiffres qui roulent : `rouler`. Lignes masquées : `lignes` (SplitText). Traits : `tracer`.

## Revue des animations (review-animations)
| Constat | Statut |
|---|---|
| `overflow:hidden` laissait défiler un conteneur au `scrollIntoView` (chrono décalé) | corrigé (`overflow: clip`) |
| Clics pendant une transition | gardés par `Nav.occupe` ; pas de file d'attente |
| Rouleau de chiffres : vitesse par chiffre bornée (<=1,3 s), décélération `expo.out` | ok |
| Anneaux animés via `stroke-dashoffset` (non composité) | accepté (petit SVG) |
| `clip-path` plein écran sur page : peut ramer sur mobile d'entrée de gamme | à mesurer sur vrai téléphone |
| Mi-vol d'un titre : l'`opsz` est fixe, pas de saut de glyphes | ok |

## Limites connues
- Pas de vidéo `parcours.webm` : aucun ffmpeg disponible pour Playwright (captures PNG fournies : 01 à 18).
- Repos après la dernière série d'un exercice remplacé par le bandeau « exercice suivant » (3 s, « Rester ici »).
- Durée de fin = temps réel écoulé (court en démo ; ×10 ou saut d'horloge pour la capture).
- Suivi et Profil : écran « bientôt ». Tampon et chiffres de fin dépendent des séries réellement validées.
- Testé en Chromium (390×844) ; Safari iOS non testé (`overflow: clip`, `color-mix` requis : iOS 16+). WhatsApp : liens wa.me.
