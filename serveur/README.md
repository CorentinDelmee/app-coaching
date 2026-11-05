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
| `RATE_LIMIT_PER_MIN` | Requêtes par minute (120) de l'API à clé ; ne s'applique pas à `/api/app/*` (limiteur propre par IP réelle). |
| `DB_FILE` | Base SQLite (VPS). Défini -> magasin SQLite + API de l'app `/api/app/*` (avec `SESSION_SECRET`). Interdit avec `DEMO_SYNC=1`. |
| `SESSION_SECRET` | ≥ 32 car. : signature HMAC du cookie de session (12 h). |
| `APP_ORIGIN` | Origine exacte de l'app (ex. `https://app.domaine.fr`) : exigée en `Origin` sur toute requête non-GET (CSRF). |
| `FICHIERS_DIR` | Dossier des photos/PDF (`/var/lib/app-coaching/fichiers`). |
| `RESA_API_URL`, `RESA_ADMIN_KEY` | API réservation (`http://127.0.0.1:5311`) et sa clé admin (≥ 32 car.). |
| `PROXY_KEY` | ≥ 32 car. (hex). Caddy l'envoie en `X-Proxy-Cle` ; seulement alors l'IP réelle = dernière valeur de `X-Forwarded-For` (limites de connexion). Sinon : adresse de connexion. |
| `NODE_ENV=production` | Refus de démarrer si `DB_FILE`, `FICHIERS_DIR`, `APP_ORIGIN`, `RESA_API_URL`, `COACH_API_KEY`, `SESSION_SECRET`, `RESA_ADMIN_KEY`, `PROXY_KEY` manque. |

Plafonds par client : 5000 lignes, 64 Ko par ligne (coach compris), 200 fichiers et 200 Mo → 413 `quota`. Connexion : seuls les échecs comptent (IP+compte 5, compte 50, IP 30 / 15 min), journalisés avec une empreinte de l'identifiant. Cookie `__Host-sid` en production.

Premier compte coach : `DB_FILE=… npm run coach:creer <identifiant>` (saisie masquée ; relancer = changer le code et révoquer les sessions).
| `VITE_API_URL`, `VITE_API_KEY` | Côté app (démo) : adresse du serveur ; clé pour l'écran coach « Vidéos ». |

## Brancher Claude
**Claude Code** : copier `serveur/mcp.json.exemple` en `.mcp.json` à la racine du projet et remplacer `REMPLACER_PAR_VOTRE_CLE` (ne jamais commiter la vraie clé : `.mcp.json` est à garder hors Git).
**Claude Desktop** : même bloc `mcpServers` dans `claude_desktop_config.json` (chemin absolu vers `serveur/mcp.mjs`).
Le transport est **stdio** (le serveur est lancé par Claude, aucun port ouvert). Streamable HTTP : non fourni en V1 (l'API REST couvre l'accès HTTP).

## Brancher Claude Code en distant (sur la base du VPS)
Le même `serveur/mcp.mjs`, lancé avec `COACH_API_URL`, n'ouvre **aucune base locale** : il lit la liste des outils sur
`GET <COACH_API_URL>/outils` (à chaque demande de Claude : un outil ajouté côté serveur apparaît après mise en ligne, sans rien changer ici)
et transmet chaque appel à `POST <COACH_API_URL>/outils/<nom>`. Il faut seulement le dépôt cloné et `npm ci` sur la machine de Claude.
1. Récupérer la clé (`COACH_API_KEY` de `/etc/app-coaching.env`) et la mettre dans un fichier **hors de tout dépôt Git**, lisible par toi seul :
   ```
   ssh root@IP "sed -n 's/^COACH_API_KEY=//p' /etc/app-coaching.env" > ~/.config/app-coaching/cle-coach.txt && chmod 600 ~/.config/app-coaching/cle-coach.txt
   ```
   (créer le dossier avant : `mkdir -p ~/.config/app-coaching`). Ne jamais coller la clé dans une conversation ni dans `.mcp.json`.
2. `.mcp.json` à la racine du dossier depuis lequel Claude Code est lancé (aucun secret dedans ; chemins **absolus**, à adapter : `echo $HOME` donne le début) :
   ```json
   {
     "mcpServers": {
       "coaching-coach": {
         "command": "node",
         "args": ["/Users/corentin/Documents/REXV2/Projets/app-coaching/serveur/mcp.mjs"],
         "env": {
           "COACH_API_URL": "https://delmeecorentin.fr/api/coach",
           "COACH_API_KEY_FILE": "/Users/corentin/.config/app-coaching/cle-coach.txt"
         }
       }
     }
   }
   ```
   Adresse : `https://<domaine>/api/coach` en mode sous-chemin (chez Corentin), `https://app.<domaine>/api/coach` en mode domaine propre.
   Sous Windows : `"args": ["C:\\Users\\coren\\Documents\\REXV2\\Projets\\app-coaching\\serveur\\mcp.mjs"]`, `"COACH_API_KEY_FILE": "C:\\Users\\coren\\.config\\app-coaching\\cle-coach.txt"`.
3. Vérifier : `curl -s -H "Authorization: Bearer $(cat ~/.config/app-coaching/cle-coach.txt)" https://delmeecorentin.fr/api/coach/sante` → `{"ok":true,"outils":N}` ;
   dans Claude Code, `/mcp` doit montrer `coaching-coach` connecté avec ses outils.

Règles : `COACH_API_KEY_FILE` passe avant `COACH_API_KEY` ; HTTPS obligatoire (http seulement vers 127.0.0.1) ; une clé fausse fait échouer la liste avec « HTTP 401 ».
Changer la clé : la modifier dans `/etc/app-coaching.env`, `systemctl restart app-coaching`, puis réécrire le fichier local.

### Route `/api/coach/*` (seule partie de l'API à clé exposée sur Internet, par Caddy)
`GET /api/coach/sante` · `GET /api/coach/outils` (nom, description, `mutation`, schéma JSON d'entrée) · `POST /api/coach/outils/<nom>` (corps = arguments ;
réponse = données de l'outil, ou `{ erreur, code }` avec 400 `VALIDATION`, 404 `OUTIL_INCONNU`, 409 `AMBIGU`…).
Tout exige `Authorization: Bearer <COACH_API_KEY>` (temps constant). **10 échecs d'authentification en 15 min depuis une IP réelle → 429** pour cette IP
(même avec la bonne clé, jusqu'à la fin de la fenêtre) ; 120 requêtes/min par IP ; corps ≤ 1 Mo (413) ; `Cache-Control: no-store` ; journal acteur `api-coach`.
L'IP réelle vient de `X-Forwarded-For` seulement si Caddy a ajouté `X-Proxy-Cle` (= `PROXY_KEY`). Une requête relayée par Caddy vers une autre route
(`/api/outils`, `/api/clients`…) reçoit 404 : les routes REST historiques ne servent qu'en local (127.0.0.1).

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
(durée, chaîne reconnue, vues, titre pertinent) avec justification ; repli sur la bibliothèque locale sinon.
**Règle des vidéos courtes** : > 30 s refusée, ≤ 20 s favorisée, intégrable et publique seulement ; requête en français puis anglais en repli (2 recherches au plus par exercice, ≈ 202 unités de quota sur 10 000/jour). Outils : `lister_exercices`, `creer_exercice` (recherche auto d'une vidéo « proposée »), `modifier_exercice`, `supprimer_exercice` (2 temps), `valider_video`.

## Sécurité
- Clé API en `Authorization: Bearer`, lue dans l'environnement, comparée à temps constant (empreintes SHA-256) ; refus par défaut.
- Écoute **127.0.0.1 uniquement** ; limitation de débit (120/min) ; corps limité à 256 Ko (1 Mo sur `/api/coach/*`) ; validation zod stricte de tous les arguments ; liens vidéo : YouTube seulement.
- Journal `serveur/data/journal.jsonl` : une ligne par action (quand, acteur `rest`/`mcp-stdio`/`api-coach`, outil, client, résultat) ; ne contient jamais la clé.
- Suppression : confirmation obligatoire par jeton à usage unique.
- Limite connue (démo) : la clé `VITE_API_KEY` de l'écran « Vidéos » est visible dans le navigateur (toute variable `VITE_*` est copiée en clair dans le bundle).
  Garde-fou : `npm run build` (production) **échoue** si `VITE_API_KEY` est défini. Utiliser pour la démo une clé **distincte** de celle de production, uniquement en `npm run dev`.
  Cible production (à faire, non implémenté) : l'écran « Vidéos » appelle une Edge Function Supabase avec le JWT de la session du coach ; la fonction vérifie `role = 'coach'` (comme `sync-google-agenda`) puis agit avec la clé service côté serveur, sans jamais exposer de clé.

## Passage en production (Supabase)
1. Appliquer `supabase/schema.sql` (tables de l'app).
2. Sur le serveur uniquement : `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (clé « service_role », jamais dans l'app ni dans Git). Le serveur utilise alors le même format de lignes que l'adaptateur de l'app (**non testé sans projet Supabase réel**).
3. Ne pas définir `DEMO_SYNC` ; l'app utilise son adaptateur Supabase (les séances créées par le serveur sont lues normalement, avec les règles RLS).
4. La bibliothèque vidéos reste en fichier JSON (`DATA_DIR`) ; à migrer vers une table si le serveur est hébergé sans disque persistant.
