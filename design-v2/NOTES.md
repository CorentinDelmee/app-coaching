# Maquette V2 — notes, choix provisoires et passation

**Ouvrir** : `design-v2/index.html` (servi en HTTP de préférence, ex. `npx http-server design-v2` ; polices Google et GSAP 3.13 par CDN).
Sur ordinateur : téléphone 390 × 844 au centre, panneau de comparaison à gauche (roue dentée) et bouton ×10 pour accélérer les chronos.
Sur téléphone : deux petits onglets discrets au bord gauche. Réglages aussi pilotables par l'URL : `?ambiance=sombre&chrono=inter&accueil=jour&aplat=blanc&grand=1`.
Mode absent : tous les choix ci-dessous sont **provisoires** (recommandation pré-sélectionnée), Corentin tranche.

## 1. Retours V1 → V2, point par point
| Retour (RETOURS-MAQUETTES-V1.md) | Où le voir |
|---|---|
| Base M5 : style, polices (Syne / Albert Sans), mise en page | partout |
| Menu M5 et ses animations, pour toute l'app | bouton menu (plan qui recule en 3D, rubriques depuis la profondeur) |
| Page Coaching M5, Programme M5 | menu → Coaching / Programme (gardés, textes au vouvoiement) |
| Accent jaune, texte toujours foncé dessus, jamais de jaune en texte sur clair | `--accent-lisible` = encre en ambiance claire (anneaux, traits, segments, bordures actives) |
| 3 ambiances M5, clair par défaut | panneau + Profil |
| Séance : une page entière par exercice/bloc, pas de cartes | séance : 7 pages (échauffement, A1, A2, B1, B2, circuit C, option) |
| Lisibilité M1 en séance | grandes lignes de série « 10 × 16 kg », 1 action en bas |
| Transitions de démarrage M1 | « Démarrer » : la page naît du bouton (clip), voile jaune qui se relève, cascade |
| Sélecteur glissant M1 tel quel | toucher une série → une valeur : défilement natif à crans, inertie, vibration par cran |
| Étiquettes AMRAP / EMOM M1 | pastilles jaunes `tag-format` (overview, page circuit) |
| Changement de couleur au lancement d'un circuit (M1) | le circuit ouvre une section en couleur inversée, puis le travail **balaie l'écran en jaune** |
| Animations du questionnaire M1 | mots qui montent, question qui glisse, barre rebondie, avance auto après un choix, cercle de fin + confettis |
| Aplat du dashboard M1, texte foncé | dashboard : aplat jaune avec message + carte du jour |
| Transitions entre exercices M2 + depuis l'overview | glissement + recul des voisins + titre en lignes masquées ; toucher un exercice de l'overview ouvre la séance **depuis l'encart** et arrive sur cet exercice |
| Décompte M2 + petite phrase | chiffres en roulette (descendent), phrase au-dessus : « Préparez-vous. », « Tenez bon. », « Respirez. », « On y retourne. », « Temps ! » |
| Son de fin M1 | deux bips 880 Hz × 0,5 s espacés de 220 ms + vibration 180-80-180 ; tic sur les 3 dernières secondes |
| Temps total en haut (M4) | pastille « Séance 12:34 » en haut de chaque page de séance, du chrono et de la section circuit |
| Check-in M2 (sons, chiffres dessus/dessous, humeur) avec polices M5 | check-in : curseur à tic, chiffres qui roulent vers le haut / le bas, émoji qui rebondit, choix tracé |
| Circuits M2 (« Découvrir le circuit », option) + détail M4 + couleur M1 + section qui s'ouvre/se referme | page circuit → section (explication → exercices → chrono → bilan) → se referme dans le bouton, résultat affiché |
| Effets rebondis M4 mesurés | `back.out(1.4-1.7)`, appui CSS 100 ms / relâchement 320 ms |
| Encart exercice retravaillé | code (A1), nom, prescription en 3 pastilles lisibles (séries×reps, kg, repos), « dernière fois », vidéo |
| Overview en sections Bloc A / B / C | une carte par bloc avec lettre ; circuit en bloc encre ; option en contour pointillé |
| Mode Grand affichage, zoom jamais bloqué | Profil + panneau ; viewport sans `maximum-scale` ni `user-scalable=no` |
| Bug Programme : un autre jour ouvre son workout | Programme : W1 (fait lundi) ouvre **ce qui a été réalisé** ; W3 (à venir) ouvre **son modèle** ; W2 = aujourd'hui |

## 2. « Faire l'option » (M2) : ce que c'est, gardé tel quel
Dans M2, l'option est **un circuit facultatif en fin de séance** (EMOM 6 min, bloc « Option »), pas un exercice.
La page propose deux boutons : **« Faire l'option »** (ouvre le circuit : explication → exercices → chrono) et
**« Terminer sans l'option »** (termine la séance). V2 garde exactement ce comportement, avec l'affichage M4
(bloc en contour pointillé « Option · si vous avez encore de l'énergie », minutes impaires / paires détaillées).

## 3. Panneau de comparaison : recommandations (pré-sélectionnées)
| Réglage | Choix | Recommandation et raison |
|---|---|---|
| Ambiance | clair / sombre / bleu profond | **Clair** (défaut demandé) ; les 3 restent au choix du client dans son Profil |
| Texte de l'aplat jaune | foncé / blanc | **Foncé** : 12,1 : 1. Le blanc sur jaune fait 1,4 : 1 (illisible, échoue WCAG) : montré pour comparaison seulement |
| Police des chiffres du chrono | Barlow Semi Condensed 600 / Inter Tight 600 / Azeret Mono 500 | **Barlow Semi Condensed** : chiffres hauts et étroits (50,7 px par chiffre à 100 px contre 63 pour Inter et 65 pour Azeret), donc plus grands à largeur égale, formes très distinctes (1/7, 3/8, 6/9), allure « tableau d'affichage » sportif. Les 3 ont des chiffres tabulaires vérifiés (`1111` = `0000` = `8888`). Celle de M1 (Onest) est écartée |
| Message d'accueil | « Prêt, Fabien ? » / « Plus que 2 séances pour boucler la semaine. » / « Jour de jambes, Fabien. » | **« Prêt, Fabien ? »** : court, lisible de loin, appel à l'action. Il change selon l'état : après la séance « Bien joué, Fabien. », semaine finie « Semaine bouclée ! » (les 3 versions ont leurs variantes) |
| Grand affichage | non / oui | **Non** par défaut ; « oui » = textes, chiffres, boutons ×1,2 et chronos ×1,12 (déjà presque pleine largeur), boutons d'action collants |

**Vouvoiement** : l'app vouvoie (questionnaires, vues `src/`), donc toute la maquette vouvoie, petites phrases du chrono comprises
(« Respirez. », « Tenez bon. »). La variante tutoiement (« Respire. », « Tiens bon. ») est prête dans `config.js` (`PHRASES.tu`).

## 4. Contrastes WCAG (calculés, formule de luminance relative)
| Couple | clair | sombre | bleu profond |
|---|---|---|---|
| Texte sur fond | 13,4 | 14,2 | 14,9 |
| Texte sur surface | 16,9 | 12,2 | 12,3 |
| Texte doux sur fond | 5,4 | 6,7 | 7,4 |
| Texte doux sur surface | 6,8 | 5,7 | 6,1 |
| Texte doux sur surface-2 | 6,0 | 4,8 | 4,9 |
| Accent lisible (anneaux, traits, bordure active) sur fond | 13,4 (encre) | 11,2 (jaune) | 11,9 (jaune) |
| Chrono repos : texte / fond | 11,6 | 8,9 | 7,3 |
| Chrono prépa et section circuit : texte / fond | 15,0 | 15,0 | 14,9 |
| Bouton jaune contre le fond (forme) | 1,1 ⚠ | 11,2 | 11,9 |

Communs à toutes les ambiances : **encre sur jaune 12,1** (boutons, aplat, sélecteur, chrono de travail, étiquettes) ;
jaune sur encre 12,1 (carte du jour, bouton du sélecteur) ; texte clair sur encre 15,3 ; vert validé 8,6 ; **blanc sur jaune 1,4 (refusé)**.
Séries « à venir » (texte à 55 % d'opacité, 38 px) ≈ 3,5 : 1 : conforme pour du gros texte (≥ 3 : 1).
⚠ En clair, le jaune et le gris du fond se distinguent peu en luminance (1,1) : les boutons restent identifiables par leur libellé
foncé (12,1) et la saturation du jaune ; si Corentin le souhaite, un liseré encre de 1,5 px est possible.

## 5. Revue `review-animations` : constats et corrections
| Avant | Après | Pourquoi |
|---|---|---|
| Repos ouvert en cercle 0,72 s `power4.inOut` après chaque série (`seance.js` ouvrirChrono) | 0,5 s `expo.out` | Action fréquente (≈ 15 fois par séance) : doit partir tout de suite du bouton |
| `ease-in` à la fermeture du tiroir et de la feuille « Quitter » (`power3.in`), pastille du check-in (`power2.in`) | `power3.out` 0,28-0,3 s | Jamais d'`ease-in` sur l'interface |
| Rebond JS de 0,45 s au relâchement de chaque bouton (`noyau.js`) | Supprimé, remplacé par CSS : enfoncement 100 ms, relâchement 320 ms `cubic-bezier(.34,1.45,.64,1)` | Interruptible, asymétrique, aucun JS, rebond M4 mesuré |
| `scale(.4)` / `.5` / `.6` en entrée (badge de fin, coche de série, pastilles, lettres de bloc) | `.7` à `.85` + opacité | Rien n'apparaît de nulle part |
| Glissement entre exercices 0,85 s | 0,7 s | Fréquent dans la séance ; reste assez long pour garder l'effet M2 |
| Fondu jaune ↔ encre des phases du chrono et du voile du circuit (kaki terne à mi-fondu) | Balayage `clip-path` de bas en haut, texte qui change à mi-course | Changement de couleur net (M1), pas de mélange sale |
| Roulette de chiffres 0,6 s même en ×10 (chiffres jamais posés) | durée = min(0,6 s ; 0,7 s / vitesse) | Le décompte reste lisible à toute vitesse |
| Seuil de vitesse du swipe 0,45 px/ms | 0,25 px/ms + retour rebondi léger | Un geste rapide suffit à changer d'exercice |
| Un Tab ou un `scrollIntoView` vers une page hors écran décalait toute la piste | `overflow: clip` + pages hors écran `inert` | Rien ne peut faire défiler les conteneurs masqués |

**Verdict** : approuvé pour la maquette. Restent assumés : navigations de 0,85 s (> 300 ms, elles expliquent d'où l'on vient, M5) ;
`clip-path` plein écran (peinture) à mesurer sur un téléphone moyen ; anneaux en `stroke-dashoffset` (petit SVG) ;
les touchers pendant une navigation sont ignorés (pas d'interruption fluide) ; sons Web Audio et vibration à tester sur appareil (iOS ne vibre pas).

## 6. Décisions prises seul (mode absent)
- Message d'accueil, police du chrono, texte de l'aplat : voir §3 (provisoires).
- Carte du jour en **encre dans l'aplat jaune** (une carte jaune sur un aplat jaune disparaîtrait) ; la page Workout s'ouvre donc avec un bandeau encre.
- Menu : rubrique active marquée par son **numéro sur pastille jaune** (le titre jaune de M5 serait illisible sur clair).
- Repos aussi après la dernière série d'un exercice, puis bandeau « Exercice suivant · Rester ici » 3 s (M1/M2).
- Bilan d'AMRAP : « répétitions en plus » saisies avec le **même grand sélecteur** que les charges.
- Profil : changement d'ambiance par une tache de la nouvelle couleur qui part de la vignette touchée ; aperçu du chrono pour le Grand affichage.
- Durée affichée en fin de séance : plancher de 49 min (démo jouée en quelques minutes).
- Suivi : hors maquette (écran existant dans l'app, il reprendra ce style).

## 7. À transposer dans l'app (pour le développeur)
1. **Tokens** → `src/styles/tokens.css` : tout le bloc `:root` + `html[data-ambiance=…]` + `html[data-aplat|data-chrono|data-grand]` de `assets/style.css` (lignes 1-74), dont `--e`, `--e-chrono`, `--cible`, `--accent-lisible`, `--aplat-texte`, `--repos-bg/fg`, `--prep-bg/fg`. Remplacer Unbounded/Onest par Syne / Albert Sans / Barlow Semi Condensed (auto-hébergées en woff2 latin, comme aujourd'hui).
2. **Préférences client** (`config.js`) → store préférences dans `src/data` : `{ ambiance, grand, son, vibration }` par client ; un watcher pose `data-ambiance` / `data-grand` sur `<html>`. `aplat`, `chrono`, `accueil` deviennent des constantes une fois tranchés.
3. **Mouvement** → `src/anim/constantes.js` (objets `T` et `E` de `noyau.js`) ; `src/anim/transitions.js` : `reveler/refermer`, `ouvrirRect/fermerRect`, `ouvrirCercle/fermerCercle`, `ouvrirCarte/fermerCarte`, menu `ouvrirMenu/fermerMenu/allerRubrique`, `lignes`, `rouler` (roulette M2, à extraire en composant `<ChiffresRoulants>`), `mesurerChiffres`.
4. **Sons** (`noyau.js` `REX.SONS`) → composable `useSons` : `tic` 740 Hz 90 ms, `go` 1180 Hz 220 ms, `fin` 2 × 880 Hz 500 ms (+220 ms), `tick` 1900 Hz 30 ms, `choix` 1320 Hz 70 ms, `valide` 660 Hz 90 ms, `fete` 660-880-1320 Hz ; vibrations associées ; respect des préférences son/vibration.
5. **Séance** (`seance.js`) : `REX.Chrono` = moteur de phases sur horloge (`performance.now`, pas de setInterval) avec phrases, balayage de couleur, `plus/passer/terminer`, `bandeau` (annonce de minute) → à brancher sur le moteur existant `src/engine` (garder sa logique, prendre l'affichage). Sélecteur M1 (`Selecteur`) → composant `<GrandSelecteur>` (scroll-snap natif). Pages exercice/circuit en piste horizontale avec pages hors écran `inert`.
6. **Circuit** (`circuit.js`) : section plein écran en teinte inverse ; étapes explication → exercices → chrono → bilan → fermeture dans le bouton ; option = circuit facultatif + « Terminer sans l'option ».
7. **Overview** : sections par bloc, encart exercice (`.ex*` dans `v2.css`), bloc circuit encre, option en pointillé, grille EMOM des minutes.
8. **Check-in** (`checkin.js`) : modèle d'écran par type (curseur, émojis, choix, nombre) → composants de questionnaire existants (`CurseurDix.vue`…), en reprenant les animations et sons.
9. **Correction du bug Programme** : le récap de semaine ouvre le workout **du jour touché** (fait = réalisé enregistré ; à venir = modèle) — voir `ecrans.js` `rendreWorkout(id)` ; ajouter le test qui le reproduit (RETOURS §5).
10. CSS anti-décalage : `overflow: clip` sur les conteneurs masqués de la séance.

## 8. Captures (`captures/`, 390 × 844)
Dashboard ×3 ambiances + aplat blanc + 2 variantes d'accueil ; menu ; coaching ; programme + W1 fait ; overview (blocs, circuit + option) ;
séance : démarrage, échauffement, série, sélecteur, tiroir, « exercice suivant », chronos (préparation, travail, repos ×3 ambiances) ;
circuit : page, ouverture, découvrir, exercices, préparation, passage au jaune, AMRAP, bilan, fermeture, résultat ; option EMOM (page, exercices, annonce de minute) ;
fin de séance, dashboard après ; check-in (5 écrans + merci) ; profil (réglages, changement d'ambiance, bleu) ; 3 polices de chrono ;
Grand affichage (dashboard, séance, chrono, check-in sombre) ; vue ordinateur avec le panneau.
Vidéos locales (exclues de Git par `design-v2/.gitignore`) : `video-1-…workout`, `video-2-seance-selecteur-repos-circuit`, `video-3-checkin-sombre`.
