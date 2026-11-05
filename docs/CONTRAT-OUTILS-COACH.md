# Contrat — automatisation côté coach (outils Claude / API coach) — 2026-11-05

**But (Corentin)** : en un message vocal, Claude (REX) gère tout comme un coach : clients, programmes, séances, exercices + vidéos,
questionnaires, réservations, suivi. **Accès par API** (clé coach), jamais par le serveur. **Créations et modifications appliquées
directement ; suppressions/archivages toujours en 2 temps** (`src/outils/confirmer.js`). Échéance des lots : **dernier commit poussé à 21 h 15**.

## Architecture
- Un outil = `def(description, schemaZodStrict, run, { mutation })` (`serveur/src/outils/def.js`), même forme que `serveur/src/outils.js`.
  Exposé tel quel par l'API REST et par le serveur MCP (`appeler()` valide, journalise, renvoie `{ ok, donnees | code, erreur }`).
- **Un fichier par lot**, déjà branché : `serveur/src/outils/<lot>.js` exporte `outils<Lot>(ctx)` → `{ nom_outil: def(...) }`.
  `ctx = { service, backend, biblio, config, now, fetchFn }` (voir `serveur/src/assembler.js`). Avec SQLite : `backend.db` et les méthodes du magasin
  (`serveur/src/magasin-sqlite.js`) — **réutiliser les mêmes fonctions et règles que les routes coach de l'app** (`serveur/src/app-http.js`,
  `/api/app/*`), pour que l'app et Claude produisent exactement les mêmes données (formes dans `docs/CONTRAT-VPS.md`).
- Aucune table nouvelle sans nécessité ; si une migration est indispensable : fonction `migrer<Lot>(db)` idempotente appelée depuis TON module.
- Désigner un client : `client` = nom, identifiant ou id (résolution comme `service.chercherClient` ; homonymes → erreur code `AMBIGU` qui liste les choix).
- Réponses : objets JSON simples ; toute création renvoie l'`id` ; listes bornées (`limite`, défaut 50, max 200) ; dates `AAAA-MM-JJ`, heures `HH:MM` Europe/Paris.
- Erreurs : `throw new ErreurService(message, code)` (voir `service.js`) avec un message en français qui dit quoi corriger.
- Descriptions d'outils en français, précises (Claude les lit pour choisir) : dire ce qui est créé, ce qui est obligatoire, les valeurs possibles.
- Textes libres du coach (notes, consignes) : conservés tels quels (limite de longueur raisonnable), jamais interprétés comme HTML.

## Outils par lot (noms fixés : pas de doublon)
| Lot | Fichier | Outils |
|---|---|---|
| 1 transport | (pas d'outil) | route publique `/api/coach/*`, MCP distant, Caddy, doc |
| 2 clients | `clients.js` | `creer_client` (identifiant + code d'accès initial renvoyé UNE fois), `modifier_client`, `fiche_client` (profil, objectifs, programme actif, prochaines séances, dernières mesures, alertes), `archiver_client` (2 temps), `reactiver_client`, `nouveau_code_client` |
| 3 programmes | `programmes.js` | `lister_programmes`, `voir_programme`, `creer_programme` (plusieurs semaines, séances par jour, notes du coach), `modifier_programme`, `supprimer_programme` (2 temps), `dupliquer_seance`, `noter_programme` (ajoute le texte dicté par le coach dans les notes) |
| 4 exercices + vidéos | `bibliotheque.js` (+ module YouTube existant) | `lister_exercices`, `creer_exercice`, `modifier_exercice`, `supprimer_exercice` (2 temps), `valider_video` ; et **`chercher_video_exercice` modifié** : vidéos **≤ 30 s obligatoire, ≤ 20 s préférée**, intégrables, en français d'abord |
| 5 questionnaires | `questionnaires.js` | `lister_questionnaires`, `voir_questionnaire`, `creer_questionnaire`, `modifier_questionnaire`, `supprimer_questionnaire` (2 temps), `envoyer_questionnaire` (à un client), `lire_reponses` |
| 6 réservations | `reservations.js` | `lister_reservations`, `annuler_reservation` (2 temps), `deplacer_reservation`, `lister_blocages`, `bloquer_creneau`, `debloquer_creneau` (via l'API réservation : `RESA_API_URL` + `RESA_ADMIN_KEY`, comme `/api/app/reservations/*`) |
| 7 suivi | `suivi.js` | `suivi_client` (mesures, douleurs, nutrition, séances faites, check-ins sur une période), `alertes`, `ecrire_mot_du_coach`, `planifier_seance_coaching`, `modifier_seance_coaching`, `supprimer_seance_coaching` (2 temps) |
Outils historiques (`creer_seance`, `modifier_seance`, `ajouter_exercice`, `supprimer_seance`, `rattacher_video`, `consulter_agenda`, `lister_seances`,
`lister_clients`, `chercher_client`) : inchangés sauf correction indispensable signalée dans le rapport.

## Lot 1 — transport (le seul à toucher aux routes, à Caddy et au MCP)
- Route publique **`/api/coach/`** : `GET /api/coach/sante`, `GET /api/coach/outils` (liste + schémas JSON), `POST /api/coach/outils/<nom>`.
  Auth `Authorization: Bearer <COACH_API_KEY>` en temps constant ; échecs limités par IP réelle (X-Proxy-Cle) : 10 / 15 min puis 429 ;
  corps ≤ 1 Mo ; `Cache-Control: no-store` ; journal `acteur = api-coach`. Les autres routes REST historiques ne sont pas exposées par Caddy.
- Caddy : `handle /api/coach/*` → 127.0.0.1:5405 dans **les deux** modèles (`app-coaching-chemin.caddy`, `app-coaching.caddy`).
- MCP distant : `serveur/mcp.mjs` avec `COACH_API_URL=https://<domaine>/api/coach` → liste les outils depuis l'API et transmet chaque appel
  (aucune base locale) ; clé lue dans `COACH_API_KEY` ou dans le fichier `COACH_API_KEY_FILE` ; sans URL : mode local actuel.
- Doc : `serveur/README.md` (brancher Claude Code en distant) et `deploiement/LISEZMOI.md`.

## Tests (chaque lot)
- `tests/unit/outils-<lot>.test.js` (Vitest) : magasin SQLite sur fichier temporaire (voir les tests existants du magasin), au moins :
  création → lecture → modification ; erreurs de validation ; suppression en 2 temps (sans jeton rien n'est supprimé ; mauvais jeton refusé) ;
  un client A ne voit pas les données d'un client B quand l'outil vise A. Les tables des autres lots existeront après fusion : pas de test « défensif ».
- `npx vitest run` complet vert dans ton worktree avant le dernier commit (n'afficher que les échecs).

## Règles de travail
- Worktree : `git -C Projets/app-coaching worktree add .worktrees/<lot> -b outils-<lot>` (depuis C:\Users\coren\Documents\REXV2),
  `node_modules` en jonction (`cmd //c mklink //J node_modules ..\..\node_modules` dans le worktree). Ne touche QUE ton fichier d'outils, ton fichier de test
  et (si ton lot le dit) ton module ; jamais `outils.js`, `assembler.js`, `def.js`, `confirmer.js` (sauf lot 1 pour les routes/MCP).
- Commits avec chemins précis, jamais --amend/stash ; pousse ta branche (`git push -u origin outils-<lot>`), **jamais main** (REX fusionne et déploie).
- Port local : 547<n° du lot>. Arrête tes processus (PID vérifiés) avant ton rapport. Scripts temporaires : scratchpad `app-chemin/<lot>/`.
- Rapport ≤ 10 lignes : outils livrés (noms), commit, tests, limites, ce que REX doit faire (variables, clé YouTube…).
