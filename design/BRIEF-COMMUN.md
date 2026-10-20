# Brief commun — maquettes de l'app client « Corentin Delmée Coaching »

> Identique pour toutes les maquettes. Ta consigne propre (identité, polices, style d'animation)
> est dans ton message de lancement. Projet : `C:\Users\coren\Documents\REXV2\Projets\app-coaching`.

## À lire d'abord (ciblé)
1. `CAHIER-DES-CHARGES.md` §4 (app client) et §7 (design) : la référence.
2. `design/inspiration/NOTE.md` : ce qu'on reprend des références.
3. La transition fétiche de Corentin : `Projets/coaching-domicile/design-v2/m3/assets/index.js`,
   lignes 92-145 (fonction `objectifs()`). La carte touchée s'ouvre en plein écran par
   `clip-path: inset()`, en partant de son rectangle. **Esprit à retrouver, pas à copier.**
4. Skills : `impeccable` (direction, typo, layout, polish), `animate` + `animation-performance` +
   `mobile-native` (Emil Kowalski), `gsap-core`, `gsap-timeline`, `gsap-plugins` (Flip, Draggable,
   Inertia, SplitText), `review-animations` (revue finale), `playwright-cli` (captures).

## Ce que veut Corentin (goûts connus)
- Un **effet waouh**, du mouvement qui **emmène quelque part** : rien n'apparaît de nulle part,
  tout vient de l'élément touché (carte → page, série → détail, valeur → sélecteur, bouton → menu).
- **Tout gros et manipulable au pouce** : cibles d'au moins 48 px, actions principales dans le
  tiers bas de l'écran, chiffres géants pendant la séance.
- Anthracite plutôt que noir pur, **titres pas trop gras** (graisse 300 à 600), **pas noir + orange**.
- Sa maquette préférée du site était « lourde, nette, chaleureuse ». Une version « sombre premium »
  a été jugée « trop sage » : il faut **oser**.
- Pour les outils de salle, il aime le brut très lisible de loin.
- Mieux vaut moins d'écrans parfaitement animés que beaucoup d'écrans plats.

## Polices interdites (celles du site coaching-domicile)
Archivo, Figtree, Bricolage Grotesque, Instrument Sans, Public Sans, Schibsted Grotesk.
Les polices d'une autre maquette ne sont pas interdites, mais **utilise celles de ta consigne**.

## Livrable : un prototype cliquable mobile (390×844), dans TON dossier uniquement
- `design/mN/index.html` + `design/mN/assets/` (CSS, JS). HTML/CSS/JS autonomes, sans build.
- GSAP depuis cdnjs, **version épinglée 3.13.0** :
  `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js` (et `Flip.min.js`,
  `Draggable.min.js`, `InertiaPlugin.min.js`, `SplitText.min.js`, `CustomEase.min.js`… si besoin).
  View Transitions API autorisée (avec repli).
- Sur ordinateur, le prototype est centré dans un cadre de téléphone de 390×844. En dessous de
  500 px de large, il occupe tout l'écran (prévoir `100dvh` et les zones sûres).
- **Animer seulement `transform`, `opacity`** (et `clip-path` pour les révélations, comme M3).
  Jamais width/height/top/left. Viser 60 images/s sur un téléphone moyen.
- `prefers-reduced-motion` : animations **réduites** (fondus courts, pas de déplacement), pas supprimées.
- Couleurs et polices **uniquement en variables CSS** (`--fond`, `--surface`, `--texte`,
  `--texte-doux`, `--accent`, `--accent-texte`, `--filet`, `--font-titre`, `--font-texte`,
  `--font-chiffres`…). Aucune couleur en dur dans les composants.
- **Panneau de réglage en direct** (petit bouton discret dans un coin, hors du cadre du téléphone sur
  ordinateur) : 5-6 couleurs d'accent + 3 ambiances (clair, sombre, et une 3e propre à ta maquette).
  Le choix est mémorisé (localStorage).
- Code d'animation **lisible et réutilisable** : un développeur le portera en Vue 3. Une fonction
  par transition (ex. `ouvrirCarte(el)`, `fermerCarte()`, `ouvrirSelecteur(champ)`), avec des
  durées et des courbes centralisées en constantes, et un nettoyage propre (kill des timelines).
- Les chronos sont calculés sur l'horloge (`performance.now()`), pas en comptant des `setInterval`.
  Pour la maquette, un bouton discret « ×10 » accélère les chronos pour la démo.

## Écrans et transitions à couvrir (les VRAIES transitions entre eux)
1. **Dashboard** (sans scroll ou presque à 390×844) : bonjour Fabien ; **aujourd'hui** (Workout 2
   prévu) ; **cette semaine 1/3** (anneau ou jauge) ; **prochaine séance de coaching** ;
   **mon programme** ; **questionnaires** (pastille « 1 »). Entrée animée.
   **Menu** de 6 rubriques (Accueil, Programme, Coaching, Questionnaires, Suivi, Profil) qui s'ouvre
   avec une belle animation qui part du bouton. Les rubriques non faites (Suivi, Profil) peuvent
   afficher un écran simple « à venir », mais avec la transition.
2. **Coaching** : la carte du dashboard **devient** la page (élément partagé). Contenu : « Votre
   séance : mardi 27 octobre, 18 h 30, à domicile », boutons Modifier / Annuler (WhatsApp ;
   ici une simple alerte ou un lien `https://wa.me/?text=...`), rappel « Annulation gratuite jusqu'à
   24 h avant », mot du coach, « M'envoyer un mot », « C'est votre 4e séance du mois »,
   récap « Ce mois : 3 séances × 35 € = 105 € ». Retour : la page redevient la carte.
3. **Programme** : « Programme Fabien Vincent », calendrier en colonnes, **vue semaine** par défaut,
   bascule animée vers la **vue mois**. W1 fait lundi (coche + date), W2 prévu aujourd'hui (mardi),
   W3 dans « À faire cette semaine ». Semaine en cours mise en avant.
4. **Overview du workout** (W2) : on y arrive depuis le dashboard ou le programme, par élément
   partagé. Blocs, exercices (nom, séries × reps / poids, repos, lien vidéo), circuit, consignes du
   coach. Bouton **Démarrer** toujours accessible.
5. **Séance en cours** (le cœur, priorité absolue) :
   - barre de progression des exercices en haut ;
   - un exercice plein écran à la fois ; **slide horizontal** vers le suivant (automatique après
     la dernière série validée, avec un court délai et « Rester ici » ; swipe manuel possible) ;
   - toucher une série → elle **s'agrandit** (élément partagé) avec ses champs ;
   - toucher une valeur → **grand sélecteur** vertical (roue, inertie, crans magnétiques, valeurs
     voisines estompées) avec **gros chiffre + unité**, « Valider » → retour animé dans la série ;
   - « Valider la série » → **chrono de repos automatique** (anneau ou compte à rebours, +15 s, Passer) ;
   - une série au temps (« Gainage 40 s ») : « Lancer la série », chrono de travail, bip à la fin
     (Web Audio), puis repos automatique ;
   - petit bouton latéral : **tiroir de l'overview** à tout moment ;
   - un **circuit** : AMRAP 8 min (obligatoire, avec un bouton « +1 tour » géant et un compteur) et,
     si tu as le temps, un EMOM 6 min. Chacun avec 1) un écran d'explication (« AMRAP — faites le
     plus de tours possible en 8 min »), 2) l'overview des exercices du circuit, 3) un **chrono plein
     écran** (préparation 10 s non comptée, couleur de fond selon la phase, 3 dernières secondes
     marquées) ;
   - **écran de fin** qui récompense (« Bravo, séance terminée » : durée, volume, séries, record)
     → « Valider ma séance » → retour au dashboard, avec 2/3 cette semaine mis à jour et animé.
6. **Questionnaire** (check-in quotidien, depuis la pastille du dashboard) : une question par écran,
   transitions entre questions, barre de progression ; au moins **un curseur 0-10** (sommeil,
   énergie), **une échelle d'émojis** (humeur), un choix ; fin = petite célébration → retour au
   dashboard, pastille disparue.

## Données d'exemple (les mêmes partout)
- Client : **Fabien Vincent**. Aujourd'hui : **mardi 20 octobre 2026**. Programme « Force & cardio »,
  semaine 3 sur 8, 3 workouts par semaine, mode répété.
- Semaine : W1 « Haut du corps » fait lundi 19 ; **W2 « Bas du corps + circuit » prévu aujourd'hui** ;
  W3 « Full body » à placer.
- **W2 (environ 50 min)** :
  - Échauffement : Mobilité hanches 2 × 45 s.
  - Bloc A : **Goblet squat** 4 × 10 à 16 kg, repos 90 s (précédent : 10 × 14 kg) ;
    **Fente bulgare** 3 × 8 par jambe à 10 kg, repos 75 s.
  - Bloc B : **Hip thrust** 3 × 12 à 40 kg, repos 90 s ; **Gainage ventral** 3 × 40 s, repos 30 s.
  - Circuit **AMRAP 8 min** : 10 kettlebell swings (16 kg), 8 burpees, 12 mountain climbers.
  - (Option) **EMOM 6 min** : minutes impaires 12 air squats, minutes paires 10 pompes.
  - Consigne du coach : « Descends lentement sur le squat, 3 secondes. On garde 2 répétitions en
    réserve. »
- Coaching : **mardi 27 octobre, 18 h 30, à domicile**, 35 € par séance. Mot du coach :
  « Belle semaine Fabien ! Mardi on attaque le travail de hanches, prévois une bouteille d'eau. »
- Questionnaire : check-in du jour (sommeil, énergie, humeur, douleur, hydratation).

## Règles impératives
- Tu n'écris **que dans ton dossier** `design/mN/` (et ton sous-dossier du scratchpad).
  Aucun `git commit` (REX commite). Ne touche ni à `src/`, ni à `package.json`, ni aux autres
  dossiers `design/` : un développeur et d'autres designers travaillent en parallèle.
- **Un port de serveur par agent** (m1 → 4101, m2 → 4102, m3 → 4103, m4 → 4104, m5 → 4105).
  Arrête ton serveur **par son PID uniquement**. JAMAIS `taskkill /im node.exe` ni rien qui tue
  tous les processus node.
- Scripts temporaires dans **ton** sous-dossier du scratchpad
  (`C:\Users\coren\AppData\Local\Temp\claude\C--Users-coren-Documents-REXV2\95e86eac-8501-4226-b361-8f36c22b62c3\scratchpad\mN\`).
- Pas de grosses images (aucune photo nécessaire : formes, typo, SVG). Node v24 est dans le PATH.
  Commandes simples, pas de longues chaînes.
- Textes en français correct, ton chaleureux et direct (tutoiement du coach vers Fabien).

## Vérification avant de rendre
1. Ouvre le prototype en 390×844 (playwright-cli ; si ça plante : Chrome headless) : 0 erreur
   console, pas de débordement horizontal, tout le parcours cliquable de bout en bout.
2. **Captures** PNG 390×844 dans `design/mN/captures/` : `01-dashboard.png`, `02-menu.png`,
   `03-coaching.png`, `04-programme-semaine.png`, `05-programme-mois.png`, `06-workout.png`,
   `07-exercice.png`, `08-serie-ouverte.png`, `09-selecteur.png`, `10-repos.png`,
   `11-amrap-explication.png`, `12-amrap-chrono.png`, `13-fin.png`, `14-questionnaire.png`,
   + une capture en ambiance claire `15-clair.png`. Plus, si l'outil le permet, **une courte vidéo**
   (`parcours.webm`, 20-40 s) du parcours dashboard → workout → séance → série → sélecteur → repos.
3. **Revue `review-animations`** sur ton propre code : corrige tout ce qui bloquerait. Mets le
   tableau des constats restants dans ton `DESIGN.md`.
4. `design/mN/DESIGN.md` (court, 60 lignes max) : nom, idée en une phrase, 3 mots, polices,
   palette (variables), échelle typo, **principes de mouvement** (durées, courbes, ce qui bouge et
   pourquoi), liste des transitions avec le nom de leur fonction JS, limites connues.
5. Rapport final (10 lignes) : ce qui est fait, ce qui manque, les points faibles honnêtes.
