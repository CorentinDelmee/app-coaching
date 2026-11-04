# ÉTAT — app-coaching

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
