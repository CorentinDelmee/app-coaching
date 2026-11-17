# Test indépendant — d1 « Atelier » (2026-11-05)
Chrome 156 en temps réel, vrais clics souris, 1366×690 et 390×844 (tactile et souris). Captures : `test-captures/`.

## Bloquant
- **Les modifications d'un exercice s'appliquent à tous les exercices ouverts avant lui** (`assets/app.js:311-357`, `bindPanel` ajoute de nouveaux écouteurs sur `#at-panel-in` à chaque `openEx`, sans retirer les anciens). Reproduire : ouvrir l'exercice 2, ouvrir l'exercice 3, taper dans « Nom » → la ligne 2 est renommée comme la 3 (mesuré : « Pompes inclinéesZZ » sur 2 lignes ; le toast de validation affiche le mauvais nom). Même risque pour valider, retirer un tag, niveau. Corrigeable par un seul écouteur délégué lié une fois.

## Gênant
- Mobile : 12 champs du panneau en police < 16 px → zoom automatique sur iPhone à la saisie.
- Mobile : cibles < 44 px : puces filtres 40, boutons de niveau 40, croix de tag 26×26, boutons « + » et poignées du programme 36, liens « Voir/Agenda/Tous » 31 px de haut.
- Mobile, éditeur : champ Rép. tronqué (« 8 / côt »), vignettes de la bibliothèque énormes en bas de page.
- Ouverture du panneau PC : anime `grid-template-columns` (mise en page, pas le compositeur). 0 image perdue sur cette machine (3 ouvertures, max 8 ms), mais un pic de 60-80 ms à la 1re ouverture ; risque de saccade sur un PC modeste.

## Mineur
- « 6 ex. » sur la carte du jour vs « 8 exercices » dans l'en-tête de séance. Le glisser des blocs ne défile pas la page (bloc hors écran à 690 px de haut inatteignable). Tabs de la fiche client défilent (Notes coupé, normal).
- Après validation, l'exercice reste dans le filtre « à valider » jusqu'au prochain rendu.

## Vérifié OK
Panneau à côté (x=848, 477 px) ; aperçu vidéo + lecture ; validation ; photo (setInputFiles) ; sauvegarde visible (Enregistrement → Enregistré) ; ↑/↓/Échap ; fiche client (5 onglets, courbes) ; glisser-déposer des blocs + ajout depuis la bibliothèque ; feuille mobile glissable (poignée et en-tête), fermeture, retour. Contraste : 0 texte < 4,5:1 (repos, survol, sélection, puce active, 4 onglets client, 2 tailles). 0 débordement horizontal (4 écrans × 2 tailles). 0 erreur console. prefers-reduced-motion : transitions à 1 ms.

## Notes /10
clarté 8,5 · plaisir d'usage 7 (6 tant que le bug ci-dessus existe) · mobile 7 · finition 8
Critères Corentin : panneau à côté oui, preview vidéo/photo oui, plus d'infos oui, pro et agréable oui.
**VERDICT : À CORRIGER** (1 bloquant).
