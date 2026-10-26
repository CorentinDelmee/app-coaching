# Serveur coach : API REST + serveur MCP (Claude crée les séances)

Donne une séance à Claude (« voici la séance de Fabien pour jeudi : … ») : Claude retrouve le client, crée la séance
(séries, reps, repos, tempo, charge, circuits AMRAP/EMOM/For time, supersets) et rattache une vidéo à chaque exercice.
La séance utilise **le format existant de l'app** (`docs/FORMAT-JSON.md`) : elle s'affiche telle quelle côté client.

```
Claude (MCP stdio) ─┐
                    ├─> couche service unique (serveur/src/service.js) ─> magasin (fichier JSON | Supabase)
API REST (HTTP) ────┘        validation = celle de l'app (src/data/commun.js)
```

## Lancer (démo, sans compte)
1. Créer `serveur/.env` (ignoré par Git) :
   ```
   COACH_API_KEY=<une longue phrase secrète d'au moins 32 caractères>
   DEMO_SYNC=1
   ```
2. `npm run serveur` lance l'API sur `http://127.0.0.1:5405` (127.0.0.1 uniquement). Les données démo sont créées dans `serveur/data/` (ignoré par Git).
3. App reliée au serveur : dans `.env` de l'app, `VITE_API_URL=http://127.0.0.1:5405` (et `VITE_API_KEY=<même clé>` pour l'écran coach « Vidéos »), puis `npm run dev`.
   Connecte-toi en tant que Fabien : la séance créée par Claude apparaît dans son programme (l'app recopie l'état du serveur, `src/data/synchro-api.js`).
4. Test de bout en bout : `node serveur/tests/e2e-seance.mjs` (MCP + API) ou `… --navigateur` (+ app sur 5406 et captures `tmp/captures-mcp/`, ignoré par Git ; `--captures-doc` pour mettre à jour `docs/captures-mcp/`).
   Ports modifiables : variables `E2E_PORT_API`, `E2E_PORT_APP`, `E2E_PORT_CHROME` (défauts 5405, 5406, 5407).
   Tests unitaires : `npx vitest run`.

## Variables d'environnement
| Variable | Rôle |
|---|---|
| `COACH_API_KEY` | **Obligatoire** (32 car. min). Sans elle, tout est refusé (REST 401, MCP ne démarre pas). |
| `PORT_API` | Port de l'API (5405). |
| `DATA_DIR` | Dossier des données (`serveur/data`) : `etat.json`, `bibliotheque.json`, `journal.jsonl`. |
| `DEMO_SYNC` | `1` = expose `GET /demo/etat` sans clé (exercices, séances, programmes fictifs ; ni comptes ni séances de coaching) pour l'app en mode démo. **Le serveur refuse de démarrer si `SUPABASE_URL` est aussi défini.** |
| `JOURNAL_RETENTION_DAYS` | Durée de conservation du journal `journal.jsonl` (défaut 90 jours ; purge au démarrage). |
| `CORS_ORIGINS` | Origines autorisées du navigateur (défaut : `localhost:5406`, `5173`). |
| `YOUTUBE_API_KEY` | Clé API YouTube Data v3 pour la recherche automatique de vidéos (sinon : bibliothèque locale seulement). |
| `YOUTUBE_CHAINES_RECONNUES` | Chaînes favorisées par le score, séparées par des virgules. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Production : stockage Supabase avec la clé **service** (côté serveur seulement). |
| `RATE_LIMIT_PER_MIN` | Requêtes par minute (120). |
| `VITE_API_URL`, `VITE_API_KEY` | Côté app (démo) : adresse du serveur ; clé pour l'écran coach « Vidéos ». |

## Brancher Claude
**Claude Code** : copier `serveur/mcp.json.exemple` en `.mcp.json` à la racine du projet et remplacer `REMPLACER_PAR_VOTRE_CLE` (ne jamais commiter la vraie clé : `.mcp.json` est à garder hors Git).
**Claude Desktop** : même bloc `mcpServers` dans `claude_desktop_config.json` (chemin absolu vers `serveur/mcp.mjs`).
Le transport est **stdio** (le serveur est lancé par Claude, aucun port ouvert). Streamable HTTP : non fourni en V1 (l'API REST couvre l'accès HTTP).

Outils : `lister_clients`, `chercher_client` (tolère casse et accents, signale les homonymes), `creer_seance`, `modifier_seance`,
`supprimer_seance` (**2 temps** : 1er appel = résumé + jeton valable 5 min, aucune suppression ; 2e appel avec le jeton = suppression),
`ajouter_exercice`, `rattacher_video`, `chercher_video_exercice`, `consulter_agenda`, `lister_seances`.
Exemple `creer_seance` : `{ "client": "Fabien Vincent", "nom": "Séance de jeudi", "date": "2026-10-29", "blocs": [ { "exercice": { "nom": "Squat", "series": 4, "reps": 8, "charge": 60, "repos": 120, "tempo": "3-1-1" } }, { "circuit": { "format": "amrap", "minutes": 8, "exercices": [ { "nom": "Burpees", "reps": 5 } ] } } ] }`.
Un client au **programme répété** (cas de Fabien) voit la séance revenir chaque semaine le jour choisi (le serveur le signale dans `note`).

## API REST (toutes les routes exigent `Authorization: Bearer <COACH_API_KEY>`, sauf `/api/sante`)
`GET /api/outils` (liste + schémas) · `POST /api/outils/<outil>` (corps = arguments) · `GET /api/clients` · `GET /api/clients/recherche?nom=` ·
`GET|POST /api/seances` · `POST /api/seances/<id>/exercices` · `PATCH /api/seances/<id>` · `DELETE /api/seances/<id>[?jeton=]` · `GET /api/agenda?client=&du=&au=` ·
`GET|POST /api/videos` · `GET /api/bibliotheque` · `POST /api/bibliotheque/<id>/valider` · `POST /api/bibliotheque/<id>/remplacer {url}`.

## Bibliothèque d'exercices et vidéos
Chaque entrée : nom, alias, muscles, vidéo YouTube (durée, chaîne, titre), justification, score, statut `propose | valide | remplace`.
Au premier lancement, `serveur/donnees/bibliotheque-videos.json` (51 exercices, liens vérifiés) est importé. Une vidéo choisie par Claude est « proposée » ;
dans le dashboard coach, **Vidéos** (`/coach/bibliotheque`) permet de la **valider** ou de la **remplacer** par un autre lien (une vidéo validée n'est jamais écrasée par Claude).
Recherche automatique (`chercher_video_exercice`, et à la création de séance pour un exercice sans vidéo) : API YouTube Data v3 si `YOUTUBE_API_KEY`, score sur 100
(durée < 2 min, chaîne reconnue, vues, titre pertinent) avec justification ; repli sur la bibliothèque locale sinon.

## Sécurité
- Clé API en `Authorization: Bearer`, lue dans l'environnement, comparée à temps constant (empreintes SHA-256) ; refus par défaut.
- Écoute **127.0.0.1 uniquement** ; limitation de débit (120/min) ; corps limité à 256 Ko ; validation zod stricte de tous les arguments ; liens vidéo : YouTube seulement.
- Journal `serveur/data/journal.jsonl` : une ligne par action (quand, acteur `rest`/`mcp-stdio`, outil, client, résultat) ; ne contient jamais la clé.
- Suppression : confirmation obligatoire par jeton à usage unique.
- Limite connue (démo) : la clé `VITE_API_KEY` de l'écran « Vidéos » est visible dans le navigateur. En production, remplacer par une session coach (Edge Function / JWT Supabase).

## Passage en production (Supabase)
1. Appliquer `supabase/schema.sql` (tables de l'app).
2. Sur le serveur uniquement : `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (clé « service_role », jamais dans l'app ni dans Git). Le serveur utilise alors le même format de lignes que l'adaptateur de l'app (**non testé sans projet Supabase réel**).
3. Ne pas définir `DEMO_SYNC` ; l'app utilise son adaptateur Supabase (les séances créées par le serveur sont lues normalement, avec les règles RLS).
4. La bibliothèque vidéos reste en fichier JSON (`DATA_DIR`) ; à migrer vers une table si le serveur est hébergé sans disque persistant.
