# Brief commun — mission du 26/10/2026 (17 h → 21 h), app-coaching

**Lire en entier avant de commencer.** Corentin est absent : aucune question, décide raisonnablement,
note chaque décision en une ligne dans ton rapport final (REX la reporte dans `DECISIONS.md`).
Lis d'abord `CLAUDE.md`, `ETAT.md`, puis en extraits `DECISIONS.md`, `RETOURS-MAQUETTES-V1.md`.

## Demande de Corentin (3 chantiers, menés en parallèle par 3 agents)
A. **Alignement exact sur la maquette M5** (`design/m5/` : `index.html`, `assets/style.css`, `assets/app.js`,
   `assets/ecrans.js`, `DESIGN.md`) : homepage et toutes ses interactions, menu (structure, icônes,
   comportement), **le même jaune** (valeur exacte du code M5), la couleur de surbrillance en fond.
   Tokens de design M5 extraits dans un fichier unique appliqué partout ; captures avant/après.
B. **Synchronisation Google Agenda → app client** : un événement « Coaching Fabien Vincent » dans l'agenda
   du coach apparaît dans la case « Coaching » de l'app du client Fabien Vincent.
C. **Back-end + serveur MCP** pour que Claude crée des séances pour un client, avec bibliothèque
   d'exercices et vidéos de démonstration.

## Règles Git (impératives)
- Chaque développeur travaille dans **son propre worktree** :
  `git -C C:/Users/coren/Documents/REXV2/Projets/app-coaching worktree add ../app-coaching-<lot> -b <lot>`
  (soit `C:/Users/coren/Documents/REXV2/Projets/app-coaching-<lot>`), puis `npm ci` dedans.
- **Commite au fur et à mesure dans ta branche** (petits commits en français). **Jamais** de `git stash`
  (pile partagée entre worktrees), `--amend`, `reset --hard`, `rebase`, `push`, ni de commit sur `main`.
  REX fusionne les branches.
- Ne touche que ce que ta mission demande ; si tu dois toucher un fichier partagé (`App.vue`, routeur,
  accueil client), fais-le en ajout minimal et signale-le dans ton rapport (risque de conflit).
- Les tests existants (`npx vitest run`) doivent rester verts dans ta branche.

## Règles générales
- Aucun identifiant réel : placeholders + mode démo. Si l'écriture de `.env.example` est refusée,
  documente les variables dans un `.md` (ex. `docs/VARIABLES-ENV.md`).
- Serveurs : uniquement **ton port attribué** ; arrête-les **par PID** avant ton rapport
  (jamais `taskkill /IM node.exe`).
- Scripts temporaires : `C:\Users\coren\AppData\Local\Temp\claude\C--Users-coren-Documents-REXV2\20c28d14-058c-4898-be24-3155c928cb18\scratchpad\<ton-nom>\`.
- Chrome : `C:\Program Files\Google\Chrome\Application\chrome.exe` (headless pour captures) ; ou playwright si dispo.
- Tester avant de déclarer fini (tests unitaires + passage navigateur pour ce qui a une interface).
- Rapport final : **15 lignes max** (branche, commits, ce qui marche, comment tester, limites, décisions).
