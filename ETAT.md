# ÉTAT — app-coaching
- **2026-11-07 — « Rester connecté » EN LIGNE (89e3d3c)** : case cochée par défaut à la connexion, session 30 jours prolongée à chaque usage ; décochée = 12 h, cookie de navigateur. 785 tests verts ; écran vu à 390 px. Les sessions ouvertes avant gardent leurs 12 h : se reconnecter une fois.
- **2026-11-07 — IMPORT NOTION FAIT EN PRODUCTION (90e5494)** : 29 clients complétés depuis le récap Notion (notes privées, fiche.notion, contact, lieu), 12 comptes créés (codes dans /var/lib/app-coaching/import/codes-notion.txt, à transmettre puis supprimer, avec notion.md), archivage aligné sur Notion sauf exceptions (Muriel Darmon active, Sylvain archivé ; Denis et Didier réactivés). Sauvegarde : /var/lib/app-coaching/app.db.avant-import-notion-2026-11-07T01-19-34-269Z.db. Ré-essai : 29 « déjà à jour ».
- **2026-11-06 soir — STUDIO TERMINÉ SUR MAIN (c27ea4a), VALIDÉ PAR CORENTIN, EN LIGNE le 2026-11-06 14 h 10 sur https://delmeecorentin.fr/app/ (1ee1808, sauvegarde juste avant ; migrations versions OK : 181 exercices, 25 profils en version 1)** : anciens écrans supprimés (banc 263/263 après nettoyage) ; toutes les pages coach en Studio ; 775 tests verts ; banc `node tests/e2e/studio/banc.mjs` 263/263 ; 4 audits sécurité + contre-audits (0 critique/important restant) ; concurrence optimiste (version + 409) dans les 5 éditeurs, outils MCP avec version, profil client protégé. Aucun worktree ni agent en cours. Attend : décisions D10-D13. Déploiement depuis le Mac : `ssh root@2.24.51.205 "bash /opt/app-coaching/deployer.sh"` (clé du Mac autorisée). Consommation : ~25 agents (Opus pour fondations/écrans/audits/revue, Sonnet pour tests/correctifs), ~4 M tokens, ~7 h.
- **2026-11-05 23 h 45 — REFONTE COACH « STUDIO » EN COURS (REPRENDRE ICI, sur le Mac)** : Corentin a choisi la direction d3 « Studio » (design-coach/index.html compare d1/d2/d3 ; référence design-coach/d3/ : DESIGN.md, TEST.md, captures). PC éteint pendant 2 lots, sauvegardés en WIP :
  - branche `studio-l0` (fondations : src/coach/studio/ tokens, CoachLayout Studio, PanneauLateral, IndicateurSauvegarde, useSauvegardeAuto, VignetteExercice, LecteurVideo, transitionPartagee ; état en tête de src/coach/studio/LISEZMOI.md) ;
  - branche `studio-exo-serveur` (exercices enrichis : contrat docs/CONTRAT-EXERCICES-STUDIO.md, champs muscles/matériel/niveau/consignes/erreurs/variantes/tempo/repos/notes privées, photo, utiliseDans, outils coach ; état en tête du contrat).
  Reprise : `git fetch` puis finir ces 2 branches (agents neufs qui lisent l'état), fusionner dans main, puis 4 écrans en parallèle sur la base L0 : Aujourd'hui, Exercices (panneau à côté + vol de vignette, vidéo/photo), Clients (+ fiche), Programmes/séances (éditeur glisser-déposer) ; ensuite testeur vrais clics 1366×690 et 390×844 + auditeur (photo envoyée, CSP i.ytimg.com / youtube-nocookie) + contre-audit ; mise en ligne avec l'accord de Corentin.
  Mac : brancher le MCP coach (serveur/README.md § « Brancher Claude Code en distant » ; clé dans ~/.config/app-coaching/cle-coach.txt via ssh, jamais affichée). Les exports MyPTHub (santé) sont sur le PC seulement (C:\Users\coren\.config\app-coaching\import-mypthub\) et sur le serveur (/var/lib/app-coaching/import/) : à supprimer quand Corentin aura validé l'import (Corentin : « tout est niquel » → supprimer à la reprise). studio-exo-serveur : contrat + serveur/src/exercices.js seulement (jamais testé) ; routes, photo, outils, src/data et tests restent à faire.
- **2026-11-05 22 h 30 — clients MyPTHub importés** : 24 clients (20 archivés), mesures, PAR-Q/bilans, 50 séances, 3 programmes, 181 exercices ; sauvegarde /var/lib/app-coaching/app.db.avant-import-mypthub-*.db ; codes à transmettre (/var/lib/app-coaching/import/codes-mypthub.txt, puis le supprimer). Validé par Corentin.
- **2026-11-05 — adresse réglable (APP_BASE/APP_SCOPE)** : build, manifeste, SW (allowlist limitée à APP_BASE), lien d'invitation, deployer.sh (mode sous-chemin : fragment Caddy dans /etc/caddy/sites/<domaine>.d/ + redirection app.<domaine>) ; migration vers delmeecorentin.fr/app/ : deploiement/LISEZMOI.md § 3 bis (site d'abord, puis app en 2 passages). Pas encore déployé. À voir : en Chrome headless le SW échoue à s'installer (« Cache.put : Entry already exists »), aussi avec APP_BASE=/ (antérieur à ce lot).
- **2026-11-05 soir — APP EN LIGNE** sur https://app.delmeecorentin.fr (35c6e76 + 0a3941c pour l’installeur). DATA_DIR=/var/lib/app-coaching/data ajouté (le service ne pouvait pas écrire la bibliothèque dans le clone, lecture seule). Reste : compte coach (npm run coach:creer, terminal interactif), installation sur téléphone, BACKUP_AGE_RECIPIENT (sauvegardes chiffrées) ; bibliotheque.json (data/) pas encore dans la sauvegarde de nuit.

## 2026-11-04 — domaine réel aligné (delmeecorentin.fr)
- deploiement/ (installer par défaut, LISEZMOI), vite.config, consentement (plus de mention Supabase), suivi.json (4 tâches Supabase/Netlify abandonnées), public/_headers (Netlify) supprimé : Caddy porte les en-têtes.

## 2026-11-03 (REPRENDRE ICI) — back-end VPS TERMINÉ côté code
- Serveur SQLite + auth (cookie __Host-sid, échecs seuls comptés, X-Proxy-Cle) + /api/app/* avec règles RLS côté serveur + quotas + relais réservations + fichiers + agenda ; 481 tests, e2e MCP 10/10 ; audit (0 critique) + correctifs + contre-audit ; test de bout en bout avec le site validé. Front aligné, écran Réservations vu à l'écran (docs/captures-reservations/).
- 2026-11-03 après-midi : D9 tranchée par Corentin (VPS commun, coût) ; l'API réservation crée l'événement Google en direct (plus de routine 20 h) : libellés de l'écran Réservations, démo et docs/CONTRAT-VPS.md alignés ; 482 tests ; re-test de bout en bout avec le site validé.
- Reste : tâches de Corentin dans deploiement/LISEZMOI.md (clé age sur le Mac, copie des sauvegardes hors VPS, DNS app., installation) ; coach:creer ne marche qu'en vrai terminal (pas en stdin redirigé) ; vérifier sur le VPS systemd-analyze verify, UnsetEnvironment, header_up Caddy.

## 2026-11-02 — back-end sur le VPS (SQLite), Supabase retiré
- Décision de Corentin : back-end sur le VPS commun de pc-seniors, SQLite + cookie de session comme pc-seniors ; écran coach « Réservations » pour les réservations du site coaching-domicile. Contrat : docs/CONTRAT-VPS.md. D9 ouverte : héberger les données santé sur un VPS à Corentin seul (reco).
- 3 agents (serveur, adaptateur front, écran Réservations) + déploiement lancés, arrêtés à l'échéance : état précis ci-dessous / dans les commits du 2026-11-02. Ensuite : finir, testeur + auditeur (contrôle d'accès client A/B en priorité).
- Serveur (commit f1e76f0) : FAIT schema.sql + magasin-sqlite.js (30 tests verts, e2e MCP 10/10). PAS FAIT : auth (cookie, scrypt, limite, coach:creer), endpoints /api/app/*, règles d'accès RLS côté serveur (attention : alertesVues réservé au coach), CSRF, fichiers, relais réservations, refus de démarrer, DB_FILE dans npm run serveur. À trancher : limiteur 120/min par IP à écarter pour /api/app (IP réelle via X-Forwarded-For) ; format des réponses à aligner avec src/data/adapters/api.js.
- Front données : FAIT et ALIGNÉ sur les formes exactes du contrat (items/item/evenements/derniereSynchro/reservations/blocages/blocage) ; AgendaView affiche b.message ; démo avec synchro_etat ; tests verts.
- Écran Réservations (/coach/reservations) : lit synchro_etat, VU à l'écran (375 et 1280, 0 débordement, 0 erreur console) : captures dans docs/captures-reservations/.
- Déploiement (commit 1b91226) : deploiement/ prêt (service, caddy, installer, deployer, sauvegarde) ; suppose coach:creer et GET /api/app/moi.

## 2e vague 26/10 (19 h 25 → 20 h) — sécurité et accessibilité
- **Audit sécurité** : 2 critiques (démo) et 8 importants corrigés, fusionnés dans `main` : nonce et PKCE pour Google, 3 secrets distincts (`CRON_SECRET`, `WEBHOOK_SECRET`, `STATE_SECRET`), `APP_ORIGIN` pour le CORS, jeton Google dans le Vault Supabase (migration), clé API de 32 caractères minimum. Build de production refusé si `VITE_API_KEY` est défini.
- **Audit performance et accessibilité** : performance 90 (Lighthouse mobile), PWA OK ; correctifs d'accessibilité fusionnés (`1d07c26`). Aucune branche non fusionnée.
- **Tests** : 436 verts (journal de mission, 19 h 33). Remplace les 421 annoncés plus haut.
- **Secrets à créer** (humain, jamais dans le code ni le chat) : voir `docs/GOOGLE-AGENDA.md` et `TABLEAU-DE-BORD.html`.

## Mission 26/10/2026 (mode absent) — fait, testé en démo
- **Alignement M5** : accueil, menu, jaune `#F2E27A` (texte `#26230A`), surbrillance, tokens. Écarts volontaires : `docs/ECARTS-M5.md`. Comparaison : `docs/captures-m5/comparaison.html`.
- **Google Agenda → app client** (démo) : espace coach `/coach` → « Agenda Google » → « Synchroniser maintenant » ; la séance « Coaching Fabien Vincent » apparaît dans la case Coaching de Fabien. Guide : `docs/GOOGLE-AGENDA.md` (encadré jour J).
- **Back-end + serveur MCP** : API REST + MCP (`serveur/README.md`). Claude crée une séance pour un client, avec vidéos. Bout en bout : `node serveur/tests/e2e-seance.mjs --navigateur`.
- **Bibliothèque** : 51 exercices avec vidéos YouTube proposées (`livraison-26-10/bibliotheque-videos.md`), à valider dans l'écran coach « Vidéos ».
- **Tests** : 421 verts annoncés (mission) ; testeur indépendant validé agenda, MCP et test final.
- **Limites** : jamais testé contre un vrai Google, un vrai Supabase ni un vrai téléphone. Bibliothèque en fichier JSON. Séance Google affichée seulement si aucune séance plus proche.
- **Comment tester** : `lancer.cmd` (app, `fabien.vincent` / `DEMO2024`) ; serveur : `npm run serveur` (clé `COACH_API_KEY` dans `serveur/.env`) ; MCP : `npm run mcp`.
- Synthèse : `livraison-26-10/README.md`.

## Reste à faire (humain)
Voir `TABLEAU-DE-BORD.html` : Google Cloud + OAuth, `COACH_API_KEY` + `.mcp.json`, validation des vidéos, essai sur vrai téléphone, Supabase + Netlify (`MISE-EN-ROUTE.md`), WhatsApp dans `.env`, RGPD (`docs/RGPD-CHECKLIST.md`), recette à 2 comptes avant tout vrai client.

## Statut précédent
- **V2 (2026-10-21)** : terminée et testée en local. Maquette `design-v2/`, choix D4-D7 provisoires (`src/config/apparence.js`). Captures : `docs/captures-v2/final/`.
- **V1** : lots 1 à 12 faits. Détail : `docs/ETAT-historique-lots.md`.
- **Lancer** : double-clic `lancer.cmd` ; coach `corentin` / `COACH2026` (`/coach`).
- **Décisions provisoires** : `A-VALIDER.md` + `DECISIONS.html`.
- **Tests** : `npx vitest run`, scénarios navigateur `tests/e2e/`, audit `docs/AUDIT-SECURITE.md`.

## Points fragiles connus
- Jamais testé contre un vrai Supabase ni sur un vrai téléphone (fluidité Android moyen, vibrations iOS, sons).
- Exercices de démo sans lien vidéo ; vidéos de la bibliothèque non visionnées.
- Tableau de bord de Thomas : défilement de 28 px (872 px pour 844).
