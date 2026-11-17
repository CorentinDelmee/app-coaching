# Recommandation design (provisoire, mode absent)

> 2026-10-20. Corentin choisira à son retour. En attendant, le développeur applique **M1 « Atelier »**
> selon `design/DESIGN.md`. Les quatre autres maquettes sont conservées telles quelles.
> Comparer : `design/index.html` (double-clic, le tout fonctionne sans serveur).

## Classement

Critères : waouh, lisibilité au pouce, portage en Vue ce soir, goûts de Corentin. Note sur 5.

| # | Maquette | Waouh | Pouce | Vue ce soir | Goûts | Verdict |
|---|---|---|---|---|---|---|
| 1 | **M1 Atelier** | 4,5 | 5 | 5 | 5 | Recommandée |
| 2 | M4 Ressort | 5 | 4,5 | 3,5 | 4 | Le plus « app native ». Coûteux à porter (feuilles au doigt, îlot partout). |
| 3 | M5 Profondeur | 5 | 4 | 3 | 3,5 | Le plus spectaculaire. La 3D CSS est à risque sur un Android d'entrée de gamme, et les chiffres Syne sont fantaisistes. |
| 4 | M2 Carnet | 4 | 4 | 4 | 3,5 | La plus belle typographie. Le serif fin et le clair par défaut risquent le « trop sage ». |
| 5 | M3 Tableau | 3,5 | 5 | 4,5 | 3,5 | Imbattable en salle (chronos lisibles de loin). Le reste de l'app manque de chaleur. |

## Pourquoi M1
- **Le geste que Corentin adore, partout.** La révélation par clip-path depuis l'élément touché
  (carte « Quel est votre objectif » du site) devient la grammaire de l'app :
  - la carte devient la page, et la page redevient la carte ;
  - le menu s'ouvre en cercle depuis le bouton ;
  - le chrono, le repos et la fin s'ouvrent en cercle depuis le bouton touché ;
  - la ligne devient la série, la valeur devient la roue.
  Le mouvement « emmène quelque part », exactement ce qu'il a demandé.
- **Ses goûts.** Anthracite chaud (pas de noir pur), accent framboise (pas noir + orange), titres en
  Unbounded 400 (présents sans être gras), esprit « lourd, net, chaleureux ».
- **Au pouce.** Toutes les actions sont en bas, en pleine largeur. Les valeurs de série font 96 px,
  la roue 112 px, le chrono AMRAP 150 px, et le bouton « +1 tour » occupe un quart de l'écran.
- **Faisable ce soir.** Pas de 3D, pas de feuilles tirées au doigt. Le sélecteur utilise le
  défilement natif avec accroche (scroll-snap) : inertie et crans fournis par le navigateur, fiable
  sur iOS. Toutes les transitions sont des fonctions GSAP isolées (`A.ouvrirPage`, `A.ouvrirCercle`…),
  faciles à appeler depuis des composants Vue.
- **Panneau d'ambiance.** Ambiances sombre, clair et aplat, 6 accents : Corentin peut ajuster
  sans toucher au code.

## Emprunts proposés aux autres maquettes (à faire seulement si le temps le permet)
1. **M4 : pastille de repos persistante.** Si on quitte l'écran de repos (tiroir, autre exercice),
   le chrono reste visible en pastille en haut de l'écran ; un toucher le rouvre.
2. **M3 : chronos en salle.** Chiffres sur environ 40 % de la hauteur, avec une pulsation et un bip
   sur les 3 dernières secondes. M1 le fait déjà en grande partie ; à vérifier au portage.
3. **M2 : écran de fin.** Le « tampon » de séance validée peut s'ajouter à l'anneau de M1 comme
   petite touche finale.

## Limites connues de M1 (à traiter au portage)
- Pendant une transition de page, les touchers sont ignorés. En Vue, verrouiller la navigation
  pendant les 0,85 s, puis la libérer.
- La fluidité du clip-path animé n'a pas été mesurée sur un vrai téléphone. Il faudra la tester sur
  un Android moyen. Si ça rame, remplacer par un agrandissement (transform) de la carte et un fondu.
- L'anneau des chronos est animé par `stroke-dashoffset` sur un seul élément SVG. C'est accepté.
- Pas de retour par glissement depuis le bord gauche : on revient avec le bouton en haut à gauche.
- Bip et vibration sont à tester sur appareil réel (iOS ne vibre pas).

## Revue des animations (review-animations)
Chaque designer a passé sa maquette au barème Emil Kowalski ; les tableaux sont dans chaque
`mN/DESIGN.md`. Au contrôle croisé, REX a corrigé :
- les sorties en `ease-in` de M2 (rideau, bandeau, fondus, toast), passées en `ease-out` ou `inOut` ;
- deux départs depuis `scale(0)` : les confettis de M1 et la pastille de M4.
On garde les courbes `ease-in` qui imitent la gravité (chute des confettis, tampon qui frappe,
fouetté de M3), parce qu'elles sont physiquement justifiées.
Les grandes transitions de navigation durent 0,5 à 0,9 s, au-dessus de la règle des 300 ms, et
c'est voulu : elles montrent où l'on va. Les retours d'action restent courts (appui 0,16 s,
fermetures 0,4 à 0,5 s).

## Constats du tournage des vidéos
- M1 et M3 : à la souris, la roue tourne à la molette mais pas en glissant. Au doigt, c'est le défilement natif, donc ça marche. Au portage, ajouter un glisser souris pour l'ordinateur.
- M2 : depuis l'exercice 2, un deuxième glissement vers la gauche ramène à l'exercice 1 (bug de la maquette, à corriger si M2 est choisie).
