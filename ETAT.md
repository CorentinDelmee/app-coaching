# ÉTAT — app-coaching

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
