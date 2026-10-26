# Synchronisation Google Agenda -> appli client

> **Ce que REX peut faire pour toi le jour J**
> Tu n'as que 3 choses à faire toi-même : (1) créer le projet Google et copier l'ID client + le secret (étapes 2 à 4 ci-dessous, clics dans la console Google),
> (2) cliquer « Autoriser » une fois avec ton compte Google (étape 7), (3) coller ces deux valeurs à REX. Tout le reste, REX le lance avec la CLI Supabase
> (connectée une fois par `supabase login` puis `supabase link --project-ref <PROJECT_REF>`) :
> ```
> supabase db push                                                        # tables + règles de sécurité (ou coller la migration dans le SQL Editor)
> supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... CRON_SECRET=... WEBHOOK_SECRET=... STATE_SECRET=... APP_ORIGIN=https://<URL-DE-L-APP> GOOGLE_REDIRECT_URI=https://<PROJECT_REF>.supabase.co/functions/v1/google-agenda-connexion
> supabase functions deploy sync-google-agenda --no-verify-jwt
> supabase functions deploy google-agenda-connexion --no-verify-jwt
> curl -s -X POST -H "x-state-secret: <STATE_SECRET>" "https://<PROJECT_REF>.supabase.co/functions/v1/google-agenda-connexion?action=demarrer"   # donne {"url": "..."} à ouvrir
> ```
> Puis REX exécute le modèle de planification (étape 8). Les valeurs réelles ne sont jamais écrites dans Git.

Principe : dans **votre** Google Agenda, vous créez un événement intitulé `Coaching Fabien Vincent`. Dans les 15 minutes,
la séance apparaît dans la case **Coaching** de l'appli de Fabien (jour, heure, lieu). Modifier l'heure, changer le titre
ou supprimer l'événement met l'appli à jour de la même façon.

L'appli lit votre agenda en **lecture seule** (`calendar.events.readonly`). Elle ne peut rien écrire ni supprimer chez Google.

## Règles du titre

| Titre dans Google Agenda | Résultat |
|---|---|
| `Coaching Fabien Vincent` (casse, accents, espaces, tirets ignorés ; `Vincent Fabien` marche aussi) | Séance attribuée à Fabien |
| `Coaching Marc Dupont` alors que deux clients portent ce nom | **Alerte « ambigu »**, rien n'est attribué |
| `Coaching Marc Dupont #md2` (ou `#md2` dans la description) | Attribué au client lié à l'identifiant `md2` |
| `Coaching Jean Inconnu` | **Alerte « nom inconnu »** dans Coach > Agenda Google |
| `Coaching` seul | **Alerte « sans nom »** |
| Tout autre titre (« Dentiste »…) | Ignoré |
| Événement supprimé ou statut « annulé » | La séance disparaît de l'appli |

Les identifiants courts se déclarent dans la table `agenda_alias` (Supabase > Table Editor : `tag` = `md2`, `client_id` = id du client).
Ce qui ne marche pas est visible dans **Coach > Agenda Google > À corriger** ; rien n'est jamais attribué « au hasard ».

## Essayer sans compte Google (mode démo)

`npm run dev`, puis **/coach** (compte coach de démo) > **Agenda Google** : un faux agenda montre tous les cas (normaux, ordre inversé,
inconnu, homonymes, identifiant court). **Synchroniser maintenant** applique ensuite des changements (heure modifiée, annulation, titre corrigé, nouvel événement).
Côté client, connectez-vous en `fabien.vincent` ou `thomas.bernard` : la case Coaching de l'accueil et la page Coaching montrent les séances.
Réinitialiser la démo remet le faux agenda à zéro. Captures : `docs/captures-agenda/`.

## Mise en route avec le vrai Google Agenda

Prérequis : projet Supabase en place (`supabase/schema.sql` déjà exécuté), [CLI Supabase](https://supabase.com/docs/guides/cli) connectée au projet.
Dans tout ce qui suit, `<...>` est à remplacer ; **aucune valeur réelle ne va dans Git**.

### 1. Base de données
Exécutez dans le SQL Editor `supabase/migrations/20261026_agenda_google.sql` : tables `seances_agenda`, `agenda_alias`, `agenda_synchro`,
`google_agenda_secret`, `google_agenda_oauth` avec règles RLS (un client ne lit que ses séances attribuées ; les tables serveur ne sont lisibles par personne via l'API). Le jeton Google est **chiffré dans le Vault Supabase** (extension `supabase_vault`, activée par la migration ; si elle est refusée, l'activer dans Database > Extensions puis relancer). Seul l'événement minimal est stocké (titre, début, fin, lieu) : ni description ni invités.

### 2. Projet Google Cloud et API Calendar
1. <https://console.cloud.google.com> > sélecteur de projet > **Nouveau projet** (ex. « coaching-agenda »).
2. **API et services > Bibliothèque** > « Google Calendar API » > **Activer**.

### 3. Écran de consentement OAuth (mode test)
1. **API et services > Écran de consentement OAuth** (ou « Google Auth Platform ») > type **Externe** > nom de l'appli, votre e-mail.
2. **Champs d'application** : ajoutez `.../auth/calendar.events.readonly`.
3. **Utilisateurs test** : ajoutez **votre** adresse Google (Corentin). Laissez l'appli en mode « Test » : pas de validation Google nécessaire pour un usage personnel.
   (En mode test, le jeton expire après 7 jours : pour un usage durable, cliquez « Publier l'application » ; un seul utilisateur, aucune vérification requise pour un scope lecture seule de votre propre compte, un avertissement « appli non vérifiée » s'affichera à la connexion.)

### 4. Identifiants OAuth
1. **Identifiants > Créer des identifiants > ID client OAuth** > type **Application Web**.
2. **URI de redirection autorisé** : `https://<PROJECT_REF>.supabase.co/functions/v1/google-agenda-connexion`.
3. Notez l'ID client et le code secret client (à ne jamais coller dans le code ni dans Git).

### 5. Variables d'environnement (secrets de fonctions Supabase, pas le `.env` du front)
```
supabase secrets set GOOGLE_CLIENT_ID=...                 # ID client OAuth
supabase secrets set GOOGLE_CLIENT_SECRET=...             # secret client OAuth
supabase secrets set GOOGLE_REDIRECT_URI=https://<PROJECT_REF>.supabase.co/functions/v1/google-agenda-connexion
supabase secrets set CRON_SECRET=...                      # secret du cron (pg_cron -> sync) ; 3 secrets DISTINCTS, chacun une longue chaîne aléatoire (32+ caractères)
supabase secrets set WEBHOOK_SECRET=...                   # jeton du webhook Google (étape 9, facultatif)
supabase secrets set STATE_SECRET=...                     # connexion OAuth : autorise « démarrer » et signe le « state »
supabase secrets set APP_ORIGIN=https://<URL-DE-L-APP>    # CORS : seule cette origine web peut appeler les fonctions depuis un navigateur
supabase secrets set GOOGLE_CALENDAR_ID=primary           # optionnel : « primary » = agenda principal
```
`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux fonctions. Rien à ajouter au front : l'appli appelle la fonction avec la session du coach.

### 6. Déployer les deux fonctions
```
supabase functions deploy sync-google-agenda --no-verify-jwt
supabase functions deploy google-agenda-connexion --no-verify-jwt
```
`--no-verify-jwt` : Google et pg_cron n'envoient pas de jeton Supabase ; `sync-google-agenda` vérifie elle-même le secret ou la session du coach.
`sync-google-agenda` importe `supabase/functions/_shared/agendaGoogle.js`, **copie exacte** de `src/domain/agendaGoogle.js` (le bundler Supabase ne sort pas de `supabase/`).
Un test Vitest échoue si les deux fichiers diffèrent : après toute modification des règles, `cp src/domain/agendaGoogle.js supabase/functions/_shared/agendaGoogle.js`.

### 7. Connecter votre compte Google (une seule fois)
Le secret ne passe jamais dans une adresse web, seulement dans un en-tête. Demandez l'adresse de consentement :
```
curl -s -X POST -H "x-state-secret: <STATE_SECRET>" "https://<PROJECT_REF>.supabase.co/functions/v1/google-agenda-connexion?action=demarrer"
```
La réponse `{"url":"https://accounts.google.com/..."}` : ouvrez cette adresse dans votre navigateur (valable 10 min, à usage unique ; protégé par un nonce stocké côté serveur et PKCE S256 ; au plus 5 demandes en attente),
choisissez votre compte, acceptez l'accès **en lecture seule**. Le message « Google Agenda est connecté » confirme que le jeton de rafraîchissement
est rangé, chiffré, dans le Vault Supabase (serveur uniquement).

### 8. Planification toutes les 15 minutes (pg_cron)
Activez les extensions `pg_cron` et `pg_net` (Database > Extensions), puis exécutez le modèle `supabase/agenda-google-planification.sql.modele`
après y avoir mis votre `<PROJECT_REF>` et votre `<CRON_SECRET>` (celui-là seulement) (ne pas committer la version remplie). Le secret part dans l'en-tête `x-cron-secret`.

### 9. Option : notifications push (quasi instantané)
Google peut appeler la fonction dès qu'un événement change (`events.watch`). Une requête POST à
`https://www.googleapis.com/calendar/v3/calendars/primary/events/watch` avec un jeton d'accès, le corps
`{"id":"<UUID>","type":"web_hook","address":"https://<PROJECT_REF>.supabase.co/functions/v1/sync-google-agenda","token":"<WEBHOOK_SECRET>"}`
enregistre le canal ; la fonction reconnaît l'en-tête `x-goog-channel-token`. Le canal expire au bout de ~7 jours et doit être renouvelé :
c'est pourquoi la planification (étape 8) reste le mécanisme de base, le push n'est qu'un accélérateur facultatif.

### 10. Vérifier
1. Créez dans Google Agenda `Coaching <Nom d'un client>` demain 18 h.
2. Coach > Agenda Google > **Synchroniser maintenant** : « 1 ajoutée(s) ».
3. Connectez-vous comme ce client : la séance est dans la case Coaching.
4. Journaux : Supabase > Edge Functions > `sync-google-agenda` > Logs ; historique du cron : `select * from cron.job_run_details order by start_time desc limit 5;`.

### 11. Révoquer / arrêter
- Côté Google : <https://myaccount.google.com/permissions> > l'appli > **Supprimer l'accès**.
- Côté serveur : `select cron.unschedule('sync-google-agenda');` puis `update google_agenda_secret set sync_token = null;` puis `select vault.update_secret(id, '') from vault.secrets where name = 'google_agenda_refresh_token';` (ou supprimer le secret dans Database > Vault)..
- Pour tout effacer : `truncate seances_agenda;`.

## Comment ça marche (technique)
- `src/domain/agendaGoogle.js` (copie dans `supabase/functions/_shared/`) : règles pures et testées (`tests/unit/agenda-google.test.js`) : titre, attribution, fusion création/modif/suppression
  (identifiant d'événement + `etag`/`updated`), boucle `syncToken` avec reprise complète sur **410 Gone**.
- L'attribution est recalculée à la lecture : renommer un client ou ajouter un identifiant court corrige les alertes sans attendre.
- Local : `src/data/demo/agendaGoogle.js` (faux Google) ; Supabase : table `seances_agenda` remplie par l'Edge Function.
- Côté client, `data.seancesCoaching.lister` ajoute les séances Google futures (`source: 'google'`) à celles de l'appli : aucune vue client modifiée. Une séance native et une séance Google du même client à ±15 min ne comptent qu'une fois (la native est gardée, `googleId` ajouté). Un événement « toute la journée » s'affiche « journée », sans heure.

## Sécurité (audit du 26/10, `docs/AUDIT-SECURITE-26-10.md`)
- **3 secrets distincts** : `CRON_SECRET` (cron -> sync), `WEBHOOK_SECRET` (notifications Google), `STATE_SECRET` (connexion OAuth). Toutes les comparaisons de secrets sont en temps constant (`supabase/functions/_shared/securite.js`).
- **Connexion OAuth** : `state` = nonce aléatoire stocké en base et consommé au retour (rejeu impossible) + signature HMAC + PKCE S256.
- **Erreurs** : les réponses des fonctions sont génériques ; le détail (réponse de Google) n'est que dans les journaux Supabase.
- **CORS** : limité à `APP_ORIGIN`. Les appels du cron et de Google n'ont pas d'origine web et ne sont pas concernés.
- **Données** : jeton Google chiffré (Vault) ; événements réduits au minimum ; supprimer un client supprime ses séances (`on delete cascade`).
- **Sauvegardes** : les sauvegardes Supabase contiennent la base chiffrée par le Vault, mais l'accès au projet (clé service, tableau de bord) donne accès aux données : activer l'authentification à deux facteurs sur le compte Supabase et ne jamais partager la clé service.
