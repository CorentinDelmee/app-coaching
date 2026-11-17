# Test indépendant d3 « Studio » — 2026-11-05

Méthode : Chrome en temps réel, vrais clics/touch (CDP pour le glissé), 1366×690 et 390×844, port 5493. Captures : `test-captures/` (01 à 51). Serveur arrêté (PID 23704 vérifié).

## Bloquants
Aucun.

## Gênants
1. **Panneau d'édition recouvert après défilement (1366×690)** : dès qu'on fait défiler la page, la barre sticky recherche/filtres passe PAR-DESSUS le haut du panneau : croix, ↑/↓ et « Enregistré » deviennent inaccessibles (elementFromPoint à y=50 → `st-recherche`). Seul Échap ferme. Reproduire : ouvrir un exercice, molette de 500 px (capture `20-sticky-recouvre.png`). Aussi : à l'ouverture, le panneau commence à y=265 sur 690 : champs sous la ligne de flottaison, zone de défilement interne de seulement ~400 px.
2. **Cibles < 44 px** (le designer annonce 40, c'est exact mais hors règle) : filtres-pastilles 40, menus matériel/catégorie 40, jetons muscles 36 (49–86 px de large), niveau 40, Valider 40, « Lire l'aperçu » 40, champ nom 40 ; boutons grille/liste 44×42 ; aussi sur 390 (téléphone).
3. **Contraste < 4,5:1** : le compteur `.st-n` (13,5 px) d'un filtre muscle sélectionné : 3,68 (cardio), 3,76 (mobilité), 3,86 (gainage), 3,91 (jambes), 4,09 (pecs), 4,10 (dos), 4,33 (épaules) ; seul « bras » passe. Les autres textes mesurés (4 vues, panneau sur les 8 teintes, 390 px) passent ; le contraste de la barre du bas est faux-positif de mon outil (lecture visuelle OK).
4. **Échap ne ferme pas la fiche client sur ordinateur** (le test utilise la classe `is-vu`, réservée au téléphone). La croix fonctionne.

## Mineurs
- « Plus » (barre du bas) et Agenda/Questionnaires/Alertes : simple toast « Écran non maquetté ».
- Vol de la vignette : mise à l'échelle non uniforme (4:3 → ~16:9, ×1,33 en largeur) donc le bonhomme est étiré en cours de route (520 ms, 116 images, sans saut) ; le panneau fait aussi un fondu/glissé de 24 px en parallèle.
- Chip « Cardio » en double dans l'en-tête du panneau (muscle + catégorie) ; la puce « À valider » masque la tête du bonhomme sur les cartes.
- Retour navigateur après ouverture d'une feuille : remonte à l'écran précédent (replaceState), pas seulement la feuille.
- Les vignettes sont des bonhommes SVG, pas de vraies images YouTube : le rendu photo/miniature réel n'est pas évalué ; le « lecteur » est une animation du bonhomme, pas une vidéo.

## Ce qui marche (vérifié)
- Panneau À CÔTÉ (x=866, 460 px) sur ordinateur ; feuille plein écran sur 390 ; glisser 80 px = revient, 270 px = ferme ; défilement du body verrouillé puis rendu.
- Modification d'un champ : « Enregistrement… » à 200 ms puis « Enregistré » ; la carte de la grille se met à jour. Valider : compteur 9 → 8, toast avec Annuler qui restaure bien (9). Ajout photo (setInputFiles) : image dans le panneau ET dans la carte.
- ↑/↓ changent d'exercice (pas quand le focus est dans un champ), Échap ferme et rend le focus à la carte. Recherche vide : message clair ; chaîne de 300 caractères : pas de débordement.
- Clients : 5 onglets, courbe qui se dessine, croix OK. Programme : glisser un bloc (Lundi→Mardi) et depuis la bibliothèque OK, toucher = ajout au jour actif.
- 0 débordement horizontal (accueil, exercices, clients, programme, 390 et 1366) ; 0 erreur console.
- Grille de 200 vignettes (5 147 nœuds) : défilement 25 coups de molette, médiane 4,2 ms/image, p95 6 ms, 0 image >34 ms, 0 image perdue (aucun fichier image). Animations de vignette seulement au survol/appui long.
- prefers-reduced-motion : plus de vol, pas d'animation infinie, panneau immédiat.

## Notes /10
- Clarté : 8,5 (recouvrement du panneau et textes de 11 px mis à part)
- Plaisir d'usage : 8
- Mobile : 7,5 (feuille et barre du bas très bonnes ; cibles 36–40 px, « Plus » vide)
- Finition : 7,5 (bug de recouvrement, vol déformé, doublon de puce)

VERDICT : à corriger légèrement (aucun bloquant ; 4 gênants).
