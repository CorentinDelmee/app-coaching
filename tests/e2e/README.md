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
