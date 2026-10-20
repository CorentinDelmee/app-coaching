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
| `lot2-circuits-formats.js` | For Time, Time cap, Death by, Tabata, Intervalles, Superset (le cap ne bouge pas, le temps final exclut la préparation) |
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

## Lot 9 (connexion, profil, PWA)
La session de démo automatique n'existe plus : les scripts des lots 2 à 6 ouvrent maintenant eux-mêmes une session (fonction `seed('fabien.vincent')` en tête de script : ouvre le compte et enregistre le consentement dans le localStorage). Principe :
`localStorage.setItem('cdc-coaching/1:session', 'client-fabien-vincent')` puis enregistrer le consentement dans le profil
(`consentementLe` + `preferences.consentement = { version: '2026-10-v1', sante: true }` dans `cdc-coaching/1`), ou passer par `/connexion`.
| Script | Ce qu'il vérifie |
|---|---|
| `lot9-connexion-profil.js` | Accueil public, instructions d'installation, erreur de connexion, consentement (cases décochées), piège de focus du menu, Profil (unité, code, retrait du consentement, export), déconnexion, connexion coach |
| `lot9-hors-connexion.js` | À lancer sur `npm run build` + `npm run preview` (port 5182) : service worker actif, manifeste et icônes, dashboard et séance en mode avion, pastille « Hors connexion » |
