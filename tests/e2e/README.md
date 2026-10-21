# Tests navigateur — lot 2 (séance en cours)

Scripts Playwright à lancer avec le CLI du projet, serveur de dev sur le port 5182 (`npx vite --port 5182`), viewport 390×844 :

```
playwright-cli -s=lot2 open http://localhost:5182/
playwright-cli -s=lot2 resize 390 844
playwright-cli -s=lot2 run-code --filename=tests/e2e/lot2-seance-complete.js
```

Chaque script renvoie une ligne de constats (`||` entre les étapes) et enregistre des captures dans `captures/`
(à créer, non versionné). Le temps est accéléré avec `?vitesse=30` dans l'URL ou `window.__horloge.regler(30)` (mode dev).

| Script | Ce qu'il vérifie |
|---|---|
| `lot2-seance-complete.js` | Une séance de Fabien (superset compris) de bout en bout, avance automatique, écran de fin |
| `lot2-circuits-formats.js` | For Time, Time cap, Death by, Tabata, Intervalles, Superset (le cap ne bouge pas, le temps final exclut la préparation) ; V2 : « Découvrir le circuit » ouvre la section, `[data-voir]` puis `[data-pret]` lancent le chrono |
| `v2b-parcours-complet.js` | V2.3b : démarrage, exercices, repos, circuit (section, chrono, fermeture), option (« Faire l'option » / « Terminer sans l'option »), fin ; arguments d'ambiance dans l'URL du script (voir l'en-tête) ; geste retour en un appui |
| `lot2-amrap-emom-reprise.js` | Pause, rechargement en plein AMRAP, reps en plus, EMOM |
| `lot2-reprise-pastille.js` | Invitation « Reprendre votre séance en cours ? », pastille de repos, abandon |
| `lot2-prerempli-record.js` | Roue de valeur, record, commentaire, enregistrement, pré-remplissage de la séance suivante |

## Lots 3 et 4 (page Workout, Programme)
| Script | Ce qu'il vérifie |
|---|---|
| `lot3-workout-demarrer.js` | Overview d'un workout avec circuits, « Démarrer » (cercle) puis arrivée sur la séance |
| `lot4-programme-semaine-bouclee.js` | Semaine bouclée célébrée, workouts faits dans la colonne du jour, ouverture du workout (« Refaire ») et retour |
| `lot4-programme-cas-limites.js` | Programme par semaine, programme terminé, avant le début, aucun programme |
(Mêmes commandes que ci-dessus, port 5182.)

## Lots 5 et 6 (dashboard, menu, Coaching)
| Script | Ce qu'il vérifie |
|---|---|
| `lot5-dashboard-menu.js` | Dashboard sans défilement à 390×844, menu (ouverture, Échap, rubrique avec rideau), arrivée sur Coaching |
| `lot5-6-cas-limites.js` | Aucune séance prévue (dashboard + Coaching), « Payé ce mois », semaine bouclée, écran « bientôt » |
(Attention : une séance < 24 h et le clic « Continuer sur WhatsApp » ouvrent un onglet : remplacer `window.open` avant, sinon l'onglet d'origine passe en arrière-plan et les animations s'arrêtent.)

## Lots 7 et 8 (questionnaires, suivi)
| Script | Ce qu'il vérifie |
|---|---|
| `lot7-questionnaire-hebdo-reprise-photo.js` | Bilan hebdo (Fabien) : roue des nombres, choix multiple, quitter puis reprendre à la même question, photo compressée (≤ 1280 px), fin, mesure créée pour le suivi |
| `lot7-checkin-curseur-alerte.js` | Check-in quotidien (Thomas) : curseur au pouce + vibration, émojis, avance automatique, douleur 9 -> message « Corentin est prévenu » |
| `lot8-suivi-lea-complet.js` | Suivi de Léa (tous les modules) : 2e mesure de poids, carte du corps (zone, intensité > 6, courbe de la zone, dos), habitude, photo de repas, calories |
| `lot78-mouvement-reduit-modules.js` | Mouvement réduit : aucun élément décalé / invisible ; Thomas (aucun module) : pas de rubrique Nutrition |
(Mêmes commandes que ci-dessus, port 5182 ; les scripts remettent le stockage à zéro eux-mêmes.)
## Lot 9 (connexion, profil, PWA)
La session de démo automatique n'existe plus : les scripts des lots 2 à 6 ouvrent maintenant eux-mêmes une session (fonction `seed('fabien.vincent')` en tête de script : ouvre le compte et enregistre le consentement dans le localStorage). Principe :
`localStorage.setItem('cdc-coaching/1:session', 'client-fabien-vincent')` puis enregistrer le consentement dans le profil
(`consentementLe` + `preferences.consentement = { version: '2026-10-v1', sante: true }` dans `cdc-coaching/1`), ou passer par `/connexion`.
| Script | Ce qu'il vérifie |
|---|---|
| `lot9-connexion-profil.js` | Accueil public, instructions d'installation, erreur de connexion, consentement (cases décochées), piège de focus du menu, Profil (unité, code, retrait du consentement, export), déconnexion, connexion coach |
| `lot9-hors-connexion.js` | À lancer sur `VITE_MODE_DEMO=1 npm run build` (la démo est refusée en production sans cette variable) + `npm run preview` (port 5182) : service worker actif, manifeste et icônes, dashboard et séance en mode avion, pastille « Hors connexion » |
| `lot78-sante-refusee-habitudes-coach.js` | Santé refusée : Suivi / Questionnaires -> « Santé désactivée » ; le coach définit la liste d'habitudes, le client la voit |
(Les scripts lots 7-8 posent eux-mêmes le consentement santé du client de démo.)
