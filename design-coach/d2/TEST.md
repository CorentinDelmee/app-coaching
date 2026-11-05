# Test indépendant — d2 « Console » (2026-11-05, Chrome temps réel, 1366×690 et 390×844)
Parcours complet OK : exercices, panneau à côté (480 px, repousse la liste), édition + « Enregistrement… → Enregistré », filtre « vidéo à valider », Valider, photo (setInputFiles), ↑/↓/Échap, Ctrl+K « fabien » → fiche (5 onglets), éditeur de programme (glisser-déposer 12→13). 0 erreur console, 0 débordement horizontal, reduced-motion OK (1 ms).
## Bloquants : aucun
## Gênants
- Lecture vidéo factice : le clic sur ▶ affiche seulement un toast « maquette hors ligne » (pas de vrai lecteur) ; le critère « preview » repose sur la vignette.
- Ouverture du panneau (200 ms, 145 images, pas de saccade) : la liste est re-mise en page pendant le glissement (largeur 1092→612 px, lignes qui sautent de 42 px à ~50 ms, filtres qui passent sur 2 lignes).
- Cibles < 44 px : mobile dans le panneau (retirer un muscle 28 px, champ d'ajout 26 px, lien « choisissez un fichier » 16 px, titre 35 px, bouton Agenda 36 px) ; ordinateur 32-34 px presque partout (boutons, chips, selects).
- Glisser-déposer inutilisable au toucher (HTML5 DnD) ; le bouton « Déposer ou ajouter » (palette) compense et fonctionne (12→13).
## Mineurs
- Contraste 4,13:1 sur le texte 12 px « Reprise force · S3 J1 » (tableau de bord) ; tous les autres textes (hover, sélection, panneau) ≥ 4,5:1.
- Mobile : onglet « Notes privées » coupé à droite (défilement horizontal, sans indice net) ; le toast recouvre le contenu en bas de la feuille.
## Notes /10 : clarté 8 · plaisir d'usage 8 · mobile 7 · finition 7
Captures : test-captures/ (d-* ordinateur, m-* mobile).
