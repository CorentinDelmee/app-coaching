# Lot écran « programmes » (séances + programmes) — Studio

Routes (`routes.js`, meta.studio) : /coach/seances, /coach/seances/:id, /coach/programmes, /coach/programmes/:id (mêmes URL qu'avant).

## commun/ (réutilisable par d'autres écrans)
- `glisser.js` — `creerGlisser({ surDeposer, surAjouter, capturer, restaurer })` : glisser-déposer souris (seuil 6 px), doigt
  (par la poignée, `touch-action: none`), clavier (Entrée/Espace saisit, ↑↓ dans la liste, ←→ liste voisine, Entrée pose, Échap annule),
  défilement automatique (fenêtre + conteneurs `data-st-defile-x`), toast « Annuler » automatique. Index cible = après retrait.
- `ListeTriable.vue` — une liste enregistrée auprès du contrôleur (ligne d'insertion sans décalage, liste cible teintée, origine estompée).
- `Poignee.vue`, `VignetteMini.vue` (vignette compacte d'exercice), `deplacements.js`, `exercices.js` (teinte, recherche sans accents),
  `adresse.js` (`/nouveau` → `/<id>` sans navigation : CoachLayout clé la page par r.path, un router.replace remonterait l'éditeur),
  `formulaires.css` (champs sous `.st-prog`).

## Choix
- Séance : blocs repliés en résumé (« 3 × 10 · 40 kg · repos 90 s »), « Modifier » déplie ; toute la carte se glisse à la souris.
- Nouvelle séance nommée « Nouvelle séance » : créée dès le 1er bloc (une seule fois ; EXISTE → modifier).
- Programme : 8 colonnes « Au choix du client » + Lundi…Dimanche ; un jour fixé vaut pour tout le programme (modèle de données).
- Entrées sans fondu d'opacité (contraste mesuré pendant les transitions).

## Correctifs du 2026-11-06 (lot correctifs-prog)
- Glisser : aimantation (scroll-snap) coupée pendant un glisser (`.st-gl-en-cours [data-st-defile-x]`) ; toast « Annuler » 8 s.
- Programme (ordinateur) : jours sans séance repliés en bandes de 48 px (cibles de dépôt ; toucher = cibler et déplier), bouton « Afficher les 7 jours ».
- Programme : « Répété » garde la répartition par semaine en mémoire (`restaurerSemaines`), retour = restauration, toast Annuler ; « Copier Sn » / « Semaine vide ».
- Programme (téléphone) : bibliothèque collante repliable, barre des semaines collée dessous (`--st-prog-p-hb` mesuré).
- Toasts des 2 éditeurs : dans la colonne de la bibliothèque (ordinateur), au-dessus des boutons d'ajout (téléphone) — surcharge locale de `.st-toast` via `:has()`.
- Superset créé avec 2 emplacements vides, la bibliothèque enchaîne A puis B. `?client=` accepté seulement pour un client connu (`clientDeLien`).
- `commun/clics.js` `ignorerClics(ms)` : après fermeture d'un panneau (double-clic « Dupliquer »). Bandeau « Modifié ailleurs » collant (`.st-prog-conflit`).
