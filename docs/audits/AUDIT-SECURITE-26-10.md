# Audit de sécurité indépendant — 26/10/2026

Périmètre : ajouts du jour (serveur MCP / API REST, synchronisation Google Agenda).
Rapport reçu tel quel ; statut de correction dans la branche `securite-26-10` en dernière colonne.

## Critique
1. `serveur/src/service.js:369-373` + `serveur/src/rest.js:125` : `GET /demo/etat` public quand `DEMO_SYNC=1`, renvoie exercices/workouts/programmes/seancesCoaching de tous les clients sans authentification. Demandé : ne renvoyer que des données de démo, retirer `seancesCoaching`, refuser de démarrer si `DEMO_SYNC=1` et `SUPABASE_URL` défini.
2. `src/coach/views/BibliothequeVideosView.vue:9` : `VITE_API_KEY` embarquée dans le bundle. Demandé : avertissement bloquant au build de production, doc (clé de démo distincte ; en production, session coach JWT via Edge Function).

## Important
3. `google-agenda-connexion/index.ts:189-192` : `state` = horodatage signé rejouable 15 min, comparaison non constante, pas de PKCE. Demandé : nonce stocké et consommé + PKCE S256 + temps constant.
4. Même fichier l.192, 201-204 et `sync-google-agenda/index.ts:112` : `CRON_SECRET` sert à 3 usages. Demandé : `CRON_SECRET`, `WEBHOOK_SECRET`, `STATE_SECRET`.
5. `sync-google-agenda/index.ts:85-90` (`egal` sort tôt si longueurs différentes) et connexion `!==` : helper commun HMAC/SHA-256 à temps constant dans `_shared/`.
6. Connexion l.204 : pas de limitation sur `?action=demarrer` ; erreurs Google renvoyées telles quelles (`sync-google-agenda/index.ts:170`). Demandé : message générique, détail en log.
7. CORS `*` des Edge Functions : restreindre à l'origine de l'app (`APP_ORIGIN`).
8. Jeton de rafraîchissement en clair dans `google_agenda_secret` : chiffrement (Vault/pgsodium) ou doc claire.
9. `seances_agenda.data` jsonb : ne stocker que les champs nécessaires ; `on delete set null` (l.240) -> `cascade` pour l'effacement d'un client.
11. `serveur/src/rest.js:72-75` : corps trop gros -> `req.destroy()`.

## Mineur
Clé minimale 32 caractères ; journal JSONL avec rotation/purge (défaut 90 jours) ; vérifier que `markdownVersHtml` (`src/views/Confidentialite.vue:30`) échappe le HTML ; mention dans la page de confidentialité du transit des données vers Claude (MCP), Google et Supabase.
