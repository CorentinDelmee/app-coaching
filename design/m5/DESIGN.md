# M5 « Profondeur » — app client Corentin Delmée Coaching

**Idée** : l'app est un volume ; chaque écran est un plan posé dans l'espace (perspective CSS, translateZ, rotateX/Y) et chaque geste fait reculer, avancer ou basculer un plan.
**3 mots** : cinéma, relief, tranchant. **Polices** : titres Syne 500 (jamais > 600), texte Albert Sans, chiffres Syne, chronos Azeret Mono (tabulaire).

## Palette (variables dans `assets/style.css`)
- Graphite : `--fond #202224`, `--fond-profond #16181A`, `--surface #2B2E31`, `--surface-2 #363A3E`, `--texte #F1F2EF`, `--texte-doux #A4A8AA`.
- Clair : fond `#E3E5E8` (gris perle), surfaces `#FFFFFF`, texte `#1B1D20`. Bleu profond : fond `#141B33`, surfaces `#1F2A4D`, texte `#EAF0FF`.
- Accent (6, `--accent` + `--accent-texte`) : bleu électrique `#4C6FFF` (défaut), vert d'eau `#3FD8BC`, rose vif `#FF3D8B`, jaune pâle `#F2E27A`, violet `#9B6BFF`, rouge cerise `#E5173F`. Pas d'orange. Teintes de carte : `accent`, `inverse` (texte/fond inversés), `surface`.
- Phases des chronos : préparation `--prep-bg` (jaune pâle), travail = accent, repos `--repos-bg` (accent 30 % dans le fond profond).

## Échelle typo
Display 54-68 (« Fabien. », Syne 500, -0.045em) · titre de page 36-52 · titre de carte 34-46 · texte 15-18 · étiquette 12 px capitales +0.14em · chiffres de séance 92-190 · chronos 78-118 (Azeret Mono). Cartes à coins 28 px, cibles >= 48 px, actions principales dans le tiers bas.

## Principes de mouvement
- Constantes dans `app.js` : `T` (durées : appui .15, rapide .25, base .5, page .85, menu .85) et `E` (`expo.out` entrées, `expo.inOut` grandes navigations, `back.out` pastilles, `vaul` = cubic-bezier(.32,.72,0,1) pour tiroir et bascule).
- Profondeur = hiérarchie : ce qui arrive vient de l'arrière (z -150 à -400 + rotateX), ce qui part recule ou sort sur le côté. Les couches du dashboard ont 3 vitesses (data-couche) ; décor et cartes bougent en sens inverse à la souris (quickTo).
- Tout part de l'élément touché : carte -> page par `clip-path: inset()` depuis son rectangle (patron M3) + rideau de couleur qui se rétracte en bandeau ; série -> panneau ; valeur -> roue ; bouton -> repos/circuit.
- Seulement transform / opacity / clip-path ; `will-change` posé le temps de l'animation ; 4 cartes 3D maximum ; aucun flou animé. Exceptions assumées : anneau de repos (`stroke-dashoffset` d'un SVG de 320 px, peinture seule), variable CSS `--lev` (ombre de carte par opacité).
- `prefers-reduced-motion` : fondus de 250 ms, plus de z/rotation/clip ; menu = simple glissement.
- Chronos : horloge virtuelle `REX.horloge` (performance.now, vitesse x10 via le bouton hors cadre), `REX.chrono()` sans setInterval.

## Transitions (fonction JS)
| Transition | Fonction (fichier) |
|---|---|
| Menu qui pousse le plan (scale .82, rotateY -14, x 70 %) | `ouvrirMenu` / `fermerMenu` (app.js) |
| Rubrique choisie : l'ancien plan sort, le nouveau revient de la profondeur | `allerRubrique` (app.js) |
| Carte -> page (lift z + ombre, clip, rideau) et retour | `ouvrirCarte` / `fermerCarte` / `retourRacine` (app.js) |
| Révélation générique depuis un rectangle | `reveler` / `refermer` (app.js) |
| Entrée du dashboard (3 couches, SplitText en 3D, anneau) | `PAGES['e-dash'].entrer`, `.apresSeance` (ecrans.js) |
| Semaine <-> mois (bascule rotateX) ; W3 vole vers jeudi (Flip) | `basculerVue`, `placerW3` (ecrans.js) |
| Paquet d'exercices, swipe Draggable, départ de la carte | `placer`, `aller`, `nouvelleSeance` (seance.js) ; pose : `REX.poseRel` |
| Retournement de la carte circuit (3D) | `retourner` (seance.js) |
| Série agrandie ; roue 3D (Draggable + Inertia) | `ouvrirSerie`, `ouvrirRoue` (seance.js) |
| Repos / travail (anneau + rotation 3D finale) | `ouvrirChrono`, `phase`, `spin3d` (seance.js) |
| AMRAP / EMOM plein écran, bilan | `lancerCircuit`, `cPrep`, `cTravail`, `cBilan` (seance.js) |
| Tiroir overview (glisse et se ferme au doigt) | `ouvrirTiroir` / `fermerTiroir` (seance.js) |
| Fin de séance, questionnaire, célébrations | `PAGES['e-fin']`, `quizFin`, `REX.confettis` (seance.js, ecrans.js) |

## Revue `review-animations` (constats restants)
| Constat | Gravité | Statut |
|---|---|---|
| Navigations 0,85 s (> 300 ms) | faible | voulu : elles expliquent où l'on va ; interface courante < 300 ms |
| `expo.inOut` sur les grandes navigations (démarre lentement) | faible | voulu pour le patron M3 ; les micro-gestes utilisent `expo.out` |
| Rose / jaune / vert d'eau : contraste du texte blanc ou foncé sur l'accent limite en petit corps | moyenne | `--accent-texte` adapté par accent ; chips en 13 px à revoir |
| Anneau de repos en `stroke-dashoffset` (peinture) | faible | petit SVG, 60 i/s en test ; alternative : deux demi-disques en rotate |
| `+1 tour` animé à chaque appui (action répétée) | faible | réduit à 0,4 s |
| Paquet 3D sur téléphone d'entrée de gamme | à mesurer | 4 cartes + voiles d'opacité, pas de filtre |

## Limites connues
- Pas de sauvegarde ni reprise de séance, Wake Lock demandé mais non vérifié ; son = bips Web Audio, vibration selon appareil.
- Durée affichée en fin de séance : plancher de 49 min (démo, la maquette se joue en quelques minutes avec x10).
- « Suivi » et « Profil » : écran « à venir » avec transition. WhatsApp : feuille avec lien `wa.me` (pas d'alerte < 24 h).
- Tests : navigateur Chrome headless 390x844, 360x640 (tactile), 1280x900 ; vidéo `captures/parcours.webm`.
