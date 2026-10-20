# Audit de sécurité — app-coaching (lot 11) — 2026-10-20

Auditeur : agent `auditeur-securite`. Périmètre : code et documents du dépôt (lecture seule, aucun fichier modifié hors ce rapport, aucun serveur lancé). Le projet Supabase réel n’existe pas encore : ce qui dépend de ses réglages (rate limits, CAPTCHA, MFA) est une **hypothèse à vérifier**. Aucun test d’attaque réel n’a pu être exécuté sur la RLS (pas de base) : revue par lecture du SQL. Le test d’isolation de MISE-EN-ROUTE §11.A reste **indispensable** avant tout vrai client.

Légende : [FAIT] constaté dans le dépôt · [EST.] estimation · [HYP.] hypothèse non vérifiée.

## Verdict

- **Isolation entre clients (point n°1) : correcte sur le papier.** Aucun défaut permettant à un client de lire ou d’écrire les données d’un autre n’a été trouvé dans `schema.sql`. Aucun problème critique.
- 4 problèmes importants (à corriger avant les vrais clients), 8 mineurs.
- Dépendances : `npm audit --omit=dev` = 0 vulnérabilité [FAIT]. Aucun secret dans le dépôt, l’historique Git ni `dist/` [FAIT].

## 1. Point n°1 — un client ne voit que ses données (revue de `supabase/schema.sql`)

| Contrôle | Résultat |
|---|---|
| RLS activée sur les 14 tables (l.126-139) | OK. Aucune policy pour le rôle `anon` : la clé anon seule ne lit rien. Toutes les policies sont `to authenticated`. |
| Tables client (realisations, templates_client, reponses, mesures, douleurs, nutrition) l.175-197 | OK : `using` ET `with check` sur `client_id = auth.uid()`. Un client ne peut ni lire, ni insérer, ni déplacer une ligne vers un autre `client_id` (le `with check` couvre aussi l’UPDATE). |
| Tables en lecture seule client (workouts, programmes, seances_coaching, mots_du_coach) l.157-167 | OK : seulement `select` sur `client_id = auth.uid()` ; écriture réservée au coach. |
| `alertes_vues` l.200 | OK : coach seul. |
| `questionnaires` l.170 | OK : `client_id is null` ou le sien ; écriture coach seul. |
| `profiles` l.144-149 | OK : un client lit et modifie uniquement sa ligne ; pas de policy INSERT/DELETE pour lui. Un `upsert` client est refusé par la RLS INSERT avant le conflit. |
| Trigger `proteger_profil` l.105-122 | OK : BEFORE UPDATE, remet `role`, `identifiant`, `tarif`, `lieu_defaut`, `modules`, `archive`, `cree_le` à l’ancienne valeur si l’appelant n’est pas coach. **Un client ne peut pas se donner le rôle coach** : INSERT impossible, UPDATE du rôle neutralisé. `id` est verrouillé par le `with check (id = auth.uid())`. |
| `is_coach()` l.99-102 | OK : `security definer`, `set search_path = public`, `stable`, lit `auth.uid()` (non falsifiable côté client), exclut les coachs archivés. Voir M1 (durcissement). |
| Écrire au nom d’un autre `client_id` | Impossible (with check). Cas limite des ids : voir M4. |
| Bucket `photos` l.205-215 | Privé [FAIT]. Policies par `(storage.foldername(name))[1] = auth.uid()::text` : un client ne lit/écrit/supprime que son dossier ; pas de policy UPDATE client (pas d’écrasement) ; coach tout. OK. Limites de taille/type : voir M7. |
| Insertion de profil à l’inscription | Aucun trigger sur `auth.users` : un nouveau compte n’a **aucun profil** tant que le coach n’en crée pas un (`api.creerClient`, `commun.js:73-83`). Pas d’auto-attribution de rôle possible. |

### Inscriptions publiques laissées activées : que peut faire un inconnu ?

Il obtient la clé anon (visible dans le bundle, normal), appelle `signUp` et reçoit une session `authenticated` **sans profil**. Avec ce jeton (lecture du SQL) :
- Lit : `exercices` (`using (true)`, l.152) et les `questionnaires` à `client_id null` (modèles). Aucune donnée de client.
- Écrit : rien dans les tables (les FK `references profiles` bloquent les inserts ; les tables coach exigent `is_coach()`). **Sauf** des fichiers dans `photos/<son uid>/` (M7).
- Ne peut pas : appeler l’Edge Function avec succès (403, voir §2), lister les autres profils, se créer un profil.
- Peut en revanche **savoir quels identifiants existent** (I2).

Conclusion : le compromis documenté (MISE-EN-ROUTE §3.2) est acceptable pour la confidentialité des données, à condition de traiter I2 et M7.

## 2. Edge Function `reinitialiser-code` (`supabase/functions/reinitialiser-code/index.ts`)

OK dans l’ensemble : jeton obligatoire (l.22-23), vérifié par `admin.auth.getUser` (l.28), rôle `coach` non archivé relu en base avec la clé service (l.32-33), cible forcée à `role = client` (l.45 : le coach ne peut pas être réinitialisé par cette voie), code 6-72 caractères (l.41), clé service lue dans l’environnement serveur (l.21), jamais renvoyée. « Verify JWT » à laisser activé. Réserves : pas de journal ni de limitation d’appels (M5) ; CORS `*` sans incidence (le jeton est la barrière).

## 3. `src/data/adapters/supabase.js` et garde de navigation

- [FAIT] Aucun filtrage de sécurité côté client : `tout()` fait un `select` complet sans filtre `client_id` (l.59), `un()` idem (l.64). Le filtrage réel est la RLS ; les filtres de `lister` (`commun.js:31`) ne servent qu’à l’affichage. Bon principe.
- [FAIT] `src/router/garde.js` ne fait que de l’UX (client hors de `/coach`, consentement). Un client qui la contourne n’obtient rien de plus : toutes les requêtes passent par la RLS, et son `role` (lu dans `profiles`) n’est pas modifiable par lui (trigger).
- `connecter` (l.81-91) : refuse un compte sans profil ou archivé **dans l’app seulement** (voir I1).
- `creerCompte` (l.115-121) : `signUp` avec la clé anon sur un client sans session. Pas de clé service dans le navigateur, conforme à la décision du 20/10.

## PROBLÈMES CRITIQUES

Aucun.

## PROBLÈMES IMPORTANTS

### I1. Un client archivé garde un accès complet à ses données par l’API
- Où : `schema.sql` l.157-197 (policies `client_id = auth.uid()` sans test d’archivage) ; `supabase.js:86` (le refus d’un archivé n’existe que dans l’app) ; `is_coach()` l.101 exclut seulement les coachs archivés.
- Scénario : un client quitte le coaching, Corentin l’archive. Son compte Auth reste valide : avec son identifiant et son code (ou un jeton déjà stocké) il lit et écrit encore ses lignes via `/rest/v1/...`. Problème pour la fin de relation et le droit à l’effacement. Ne touche pas aux autres clients.
- Correction : fonction `est_client_actif()` (security definer, `search_path = public`) = `exists(select 1 from profiles where id = auth.uid() and not archive)` ajoutée aux `using`/`with check` des policies client ; et/ou bannir le compte (Edge Function, `auth.admin.updateUserById(id, { ban_duration })`) à l’archivage.

### I2. Énumération des identifiants clients par `signUp` public
- Où : inscriptions publiques activées (MISE-EN-ROUTE §3.2) + e-mail technique prévisible `prenom.nom@clients.cdc-coaching.invalid` (`identifiants.js:41`).
- Scénario : un inconnu appelle `signUp` avec `jean.dupont@clients...invalid` ; l’erreur « User already registered » révèle que Jean Dupont est client du coach (information sensible). Il peut aussi « squatter » un identifiant futur et faire échouer la création du client (déni de service mineur). [EST.] Faisabilité forte (prénom.nom devinable) ; seule limite : le rate limit par IP de Supabase [HYP. ~30 inscriptions/connexions par 5 min, à vérifier].
- Correction (par ordre de préférence) : (a) créer les clients par l’Edge Function (`auth.admin.createUser`) puis **désactiver les inscriptions publiques** : supprime I2, le résidu M7 et les comptes parasites ; (b) à défaut, CAPTCHA Supabase (Turnstile/hCaptcha, gratuit) sur sign-up et sign-in ; (c) rendre l’identifiant technique non devinable (suffixe aléatoire dans l’e-mail technique).

### I3. Force du code client : 6 caractères, tentatives non limitées par compte
- Où : `identifiants.js:25-38` (alphabet 31 caractères, 6 car. = environ 887 millions de combinaisons, 29,7 bits) ; `commun.js:68` et `identifiants.js:45` (minimum 6 pour un code choisi par le client : `123456` accepté) ; MISE-EN-ROUTE §3.2 point 4.
- Scénario : l’identifiant est devinable (I2). L’attaquant essaie des codes. Supabase limite par adresse IP, pas par compte [HYP., à vérifier dans Authentication → Rate Limits] : une attaque répartie sur plusieurs IP, ou visant les codes choisis par les clients (mots courants), est réaliste. Le générateur est de bonne qualité (`crypto.getRandomValues`, sans biais) ; le risque est la longueur et les codes choisis à la main. Conséquence : lecture des données de santé d’**un** client (pas de tous).
- Correction : (1) générer 10 caractères (environ 50 bits, affichés en 2 groupes `K7M2Q-X9RTB`) ; (2) imposer 10 caractères minimum au changement de code (`validerNouveauCode`, `changerCode`) et régler « Minimum password length » Supabase ; (3) CAPTCHA (I2) ; (4) imposer le changement du code au premier accès ([FAIT] aujourd’hui seulement suggéré). Compte coach : phrase de passe de 16+ caractères et MFA TOTP Supabase si disponible [HYP.], c’est la clé de toutes les données.

### I4. En-têtes de sécurité absents (CSP, HSTS, frame-ancestors, etc.)
- Où : `public/_headers` ne contient que deux règles `Cache-Control` ; `index.html` n’a pas de CSP.
- Scénario : sans CSP, une faille XSS future (ou un lien `javascript:`, M2) pourrait lire le jeton de session en `localStorage` et appeler Supabase au nom de la victime ; sans `frame-ancestors`, l’app peut être mise dans une iframe (clickjacking) ; sans HSTS, première visite en `http://` interceptable.
- Correction : remplacer `public/_headers` par (à tester en `npm run preview`/Netlify ; remplacer `XXXX` par la référence du projet Supabase) :

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://XXXX.supabase.co; font-src 'self'; connect-src 'self' https://XXXX.supabase.co wss://XXXX.supabase.co; frame-src https://www.youtube-nocookie.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
/sw.js
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
```
  Notes : `style-src` avec `unsafe-inline` est nécessaire (Vue/GSAP posent des styles en ligne) ; `script-src` limité à `self` suffit car `index.html` n’a aucun script en ligne [FAIT] ; l’iframe YouTube passe par `youtube-nocookie.com` [FAIT `video.js:21`] avec `referrerpolicy` déjà posé (`Seance.vue:707`) ; aucune police ni CDN externe [FAIT]. Si une valeur de la CSP bloque une fonction (ex. caméra pour les photos), l’assouplir au cas par cas. Vérifier ensuite sur securityheaders.com.

## PROBLÈMES MINEURS

- **M1. Durcissement des fonctions SQL** — `schema.sql:99-119`. Les fonctions `security definer` sont exécutables par `anon`/`public` par défaut (`rpc/is_coach` renvoie `false`, sans danger). Ajouter `revoke execute on function is_coach() from public, anon;` puis `grant execute ... to authenticated;` et `set search_path = public, pg_temp`. Note de fonctionnement : le trigger remet aussi `role/tarif/archive` pour une modification faite dans l’éditeur SQL (où `auth.uid()` est nul) : modifier un tarif en SQL n’aura silencieusement **aucun effet** ; passer par l’app, ou ajouter la condition `current_user in ('postgres', 'service_role')` à celle du trigger.
- **M2. Lien vidéo non filtré (`javascript:`)** — `modele.js:112` (`lienVideo` = chaîne libre), `video.js:28` (tout lien non YouTube devient `type: lien`), `Workout.vue:139,158`, `Seance.vue:505,710` (`:href`, `window.open`). Scénario : un import JSON piégé ou une saisie du coach avec `javascript:…` exécute du script au clic dans l’origine de l’app (vol de session). Seul le coach écrit `exercices` : risque faible. Correction : n’accepter que `https?:` dans `videoDe` (sinon `aucune`).
- **M3. XSS : revue propre** — un seul `v-html` (`Confidentialite.vue:30`), alimenté par `markdownVersHtml` qui échappe `& < > "` avant toute mise en forme et n’autorise que des liens `https?:` (`markdown.js:3-10`) ; la source est un fichier du dépôt, pas une saisie utilisateur. Les textes saisis par le coach ou le client sont affichés en interpolation Vue (échappée) [FAIT : aucun autre `v-html`/`innerHTML`, hormis `transitions.js:37` qui vide un élément]. Rien à corriger.
- **M4. Ids de lignes globaux** — toutes les tables ont `id text primary key`. Un client peut tenter d’insérer une ligne avec l’id d’un autre client : cela échoue (aucun écrasement, la RLS UPDATE bloque) mais l’erreur diffère, d’où une sonde d’existence d’un id. Les ids sont des UUID aléatoires [FAIT `commun.js:15`], non devinables ; les `templates_client` ont id = client_id. Aucune fuite pratique. Optionnel : clé primaire `(client_id, id)`.
- **M5. Edge Function sans limitation ni journal** — `index.ts`. Un coach compromis peut réinitialiser tous les codes sans trace. Ajouter une table de journal (qui, quand, quel client).
- **M6. Données de santé en clair dans le navigateur** — `localStorage` : session Supabase (jeton), file d’attente hors connexion avec les séances non envoyées (`supabase.js:10,139-147`) et séance en cours (`seanceEnCours.js`). Risque : appareil partagé/volé non verrouillé, ou XSS (I4). Chiffrer en local est peu utile (la clé serait dans la même page). Recommandation proportionnée : (a) CSP (I4) ; (b) vider la file à la déconnexion : aujourd’hui `deconnecter()` (`Profil.vue:106-111`) n’efface que la séance en cours, **pas** `cdc-coaching/1:file` ; (c) ne jamais mettre douleurs/mesures/nutrition dans la file locale (seules les séances y sont [FAIT]) ; (d) consigne aux clients : verrouiller leur téléphone. Le service worker ne met en cache que les fichiers statiques (`vite.config.js:33-37`), aucune réponse d’API : [FAIT] bon point.
- **M7. Photos : fonctionnalité pas encore codée** — [FAIT] aucun `upload`, `createSignedUrl` ni traitement d’image dans `src/` ; seuls le bucket privé et ses policies existent. À respecter au développement : (a) bucket avec `file_size_limit` (ex. 2 Mo) et `allowed_mime_types` (jpeg/png/webp) ; (b) redimensionner/recompresser via `canvas` avant envoi, ce qui **retire l’EXIF** (GPS, modèle de téléphone) ; (c) nom de fichier aléatoire `<uid>/<uuid>.jpg` ; (d) affichage par URL signée courte (`createSignedUrl`, 60-300 s), jamais `getPublicUrl` ; (e) suppression des photos avec « Supprimer mes données » et à la suppression du client (aujourd’hui `supprimerMesDonneesSante` ne touche que 4 tables, `commun.js:178`). Tant que (a) manque, un inconnu inscrit (§1) peut remplir le Go gratuit de stockage dans son propre dossier.
- **M8. RGPD de base** — Collecté : nom, identifiant, tarif, lieu, séances, douleurs, mesures, nutrition, photos, réponses, préférences ; stocké chez Supabase (UE à choisir) et en `localStorage`. Consentement explicite recueilli (`consentement.js`) mais **non vérifié côté serveur** : la RLS ne teste ni `consentement_le` ni `modules` (un client peut écrire des données de santé sans consentement ni module activé). Export client complet [FAIT `Profil.vue:93`, `commun.js:158`] ; effacement partiel : seulement douleurs, mesures, nutrition, réponses ; pas d’effacement du compte ni des photos, pas de « supprimer définitivement un client » côté coach [FAIT : absent]. À faire avant le 1er vrai client (déjà dans `docs/RGPD-CHECKLIST.md`) : DPA Supabase/Netlify, registre, durée de conservation, procédure de violation 72 h, relecture de `page-confidentialite.md` (vérifier que les marqueurs `[À COMPLÉTER]` sont remplis). Option : `check (pg_column_size(data) < 100000)` sur les tables `data jsonb` pour borner les abus d’écriture.

## Autres vérifications demandées

- **Secrets** [FAIT] : aucun `.env` présent, `.gitignore` exclut `.env`, `.env.*`, `dist/`. Historique Git : aucun `.env`, aucun `service_role` (hors docs), aucun jeton `eyJ…`. Dans le code, la clé service n’apparaît que comme `Deno.env.get(...)` dans l’Edge Function. `dist/` actuel : aucune clé ; la seule occurrence `sb_secret` est le code de détection du SDK Supabase. **Limite** : ce `dist/` a été construit sans `.env` (mode local) ; je n’ai pas relancé `npm run build` pour ne pas écraser le travail des autres développeurs. À refaire après création du `.env` : chercher `service_role` et `sb_secret_` dans `dist/` (la clé anon/publishable y sera, c’est normal).
- **Mode local en production** : un build sans `.env` embarque les comptes de démo `corentin / COACH7` et `DEMO24` (`demo/index.js:11-14`, `store.js:6`). Si Corentin dépose par erreur un `dist/` construit sans `.env`, le site publié ouvre l’espace coach de démo (données fictives, aucune donnée réelle, mais image dégradée). MISE-EN-ROUTE §7.2 fait vérifier l’absence de ces comptes en local ; ajouter la même vérification avant le Drop, ou faire échouer `npm run build` si `VITE_SUPABASE_URL` est absent.
- **Dépendances** : `npm audit --omit=dev` : 0 vulnérabilité [FAIT, 2026-10-20]. Dépendances de développement non auditées (absentes de `dist/`).
- **Liens WhatsApp** [FAIT `coaching.js:80-88`, `logique.js:20-24`] : les messages du client contiennent seulement son nom, la date, l’heure et le lieu d’une séance : pas de donnée de santé. Le message d’accès du coach contient l’identifiant **et le code en clair** (`logique.js:22`) : acceptable pour un code provisoire si le changement est imposé (I3). Le numéro est nettoyé (`\D`) et le texte passe par `encodeURIComponent` (pas d’injection). Tous les liens externes ont `rel="noopener"`.
- **Export/suppression** : voir M7 et M8.

## Ordre de correction conseillé avant la mise en ligne

1. I4 (en-têtes, 10 min, sans risque), M6(b), M2.
2. I3 (code 10 caractères) et I2 (CAPTCHA, ou création des clients par Edge Function + inscriptions désactivées).
3. I1 (client archivé) et M1 (SQL), puis le test d’isolation de MISE-EN-ROUTE §11.A (2 comptes, requêtes REST à la main : chaque `select` ne doit renvoyer que les lignes du compte).
4. M7 avant de coder les photos ; M8 avant le premier vrai client.

Décision pour Corentin : garder les inscriptions publiques (plus simple ; CAPTCHA à gérer) ou faire créer les clients par Edge Function (plus sûr, environ un lot de travail). Recommandation : Edge Function.

## Statut des corrections (2026-10-20)

| Point | Statut | Détail |
|---|---|---|
| I1 client archivé | Corrigé | `est_actif()` dans toutes les policies client et storage (`schema.sql`) ; test unitaire. À rejouer dans le test d'isolation §11.A (archiver un client, vérifier qu'il ne lit plus rien). |
| I2 énumération par signUp | Corrigé | Clients créés par l'Edge Function `creer-client` ; inscriptions publiques à désactiver (MISE-EN-ROUTE §3.2) ; message de connexion toujours générique. Reste : désactiver le réglage chez Supabase et déployer la fonction. |
| I3 force du code | Corrigé côté app | Code généré sur 8 caractères, minimum 8 au changement, fonctions serveur alignées ; MISE-EN-ROUTE : longueur mini 8, limitation des tentatives, phrase de passe coach 16+. Reste : CAPTCHA/MFA non codés (dépendent du plan gratuit) ; changement de code imposé au premier accès non fait. |
| I4 en-têtes | Corrigé | `public/_headers` ; build vérifiée (un seul script externe, pas d'eval) ; non testé sur Netlify réel : vérifier sur securityheaders.com après la mise en ligne. |
| M1 fonctions SQL | Corrigé | revoke/grant, `search_path` fixé, trigger libre pour l'éditeur SQL. |
| M2 liens vidéo | Corrigé | `videoDe` n'accepte que http(s). |
| M3, M4 | Rien à faire | — |
| M5 journal de la fonction | Reste | Non traité. |
| M6 données locales | Corrigé | File vidée à la déconnexion, avertissement si séances non envoyées. |
| M7 photos | Reste | Consignes notées dans PLAN.md (lot 7), à appliquer au codage. |
| M8 RGPD | Reste | Voir `docs/RGPD-CHECKLIST.md`. |
| Mode local en production | Corrigé | Écran « Configuration manquante » sauf `VITE_MODE_DEMO=1`. |
