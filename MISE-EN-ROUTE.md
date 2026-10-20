# Mise en route — Corentin Delmée Coaching (PWA)

> Document écrit pour Corentin, à suivre dans l'ordre. Durée totale : environ 2 h 30 la première fois (voir le récapitulatif à la fin).
> Rien n'a été créé, publié ou payé à ta place : tous les comptes et toutes les mises en ligne sont à toi.
> Les noms de menus Supabase et Netlify sont ceux connus à la date d'écriture (20/10/2026) : leurs sites bougent de temps en temps. Si un libellé a changé, cherche le mot-clé en gras.
> Légende : [FAIT] vérifié dans le dépôt · [À VÉRIFIER] dépend du site du fournisseur, à confirmer à l'écran.

## Vue d'ensemble

```
Ton PC ──► npm run build ──► dossier dist/ ──► Netlify Drop ──► https://ton-nom.netlify.app  (l'app, fichiers statiques)
                                                                       │
                                                                       ▼
                                                           Supabase (région UE) : comptes, données, photos
```

- L'app est un site statique (Netlify). Les données vont directement du téléphone vers Supabase.
- Sans fichier `.env`, l'app tourne en **mode local** (données factices dans le navigateur). Avec `.env`, elle parle à Supabase.
- Les clients se connectent avec un **identifiant** (ex. `fabien.vincent`) et un **code** de 6 caractères. En coulisses l'app les transforme en e-mail technique `fabien.vincent@clients.cdc-coaching.invalid` + mot de passe. Le client n'a jamais d'e-mail à gérer. [FAIT : `src/domain/identifiants.js`]

Prérequis : Node.js installé (c'est le cas, LTS installé le 17/10/2026), une adresse e-mail, ~2 h 30. Pas de carte bancaire nécessaire (offres gratuites). Pense à activer la double authentification sur chaque compte créé (voir `docs/RGPD-CHECKLIST.md`, tâche 7).

---

## Étape 1 — Créer le projet Supabase (région UE) — 10 min

1. Va sur https://supabase.com puis **Start your project** / **Sign in**. Crée un compte (le plus simple : « Continue with GitHub », ou e-mail + mot de passe fort). **Active la double authentification** : avatar en bas à gauche → **Account preferences** → **Security** → Multi-factor authentication [À VÉRIFIER].
2. Dans le tableau de bord : **New project** (choisis l'organisation créée par défaut, « Personal » ou ton prénom).
3. Remplis :
   - **Name** : `cdc-coaching`
   - **Database Password** : clique **Generate a password**, copie-le dans ton gestionnaire de mots de passe (tu n'en auras presque jamais besoin, mais il n'est pas récupérable).
   - **Region** : **Central EU (Frankfurt)** ou **West EU (Paris)**. **Ne choisis rien hors UE.** La région ne se change plus ensuite : note-la pour le registre RGPD.
   - **Pricing plan** : Free.
4. **Create new project**. Attends 1 à 2 minutes que l'état passe à « Healthy » / le tableau de bord s'affiche.

## Étape 2 — Créer les tables et les règles de sécurité — 5 min

1. Menu de gauche : **SQL Editor** → **+ New query** (ou « New SQL snippet »).
2. Sur ton PC, ouvre le fichier `supabase\schema.sql` du projet (Bloc-notes ou VS Code), **Ctrl+A**, **Ctrl+C**.
3. Colle dans l'éditeur, clique **Run** (ou Ctrl+Entrée).
4. Attendu : « Success. No rows returned ». Si tu vois `already exists`, c'est que le script a déjà été lancé : ne le relance pas (voir Dépannage).
5. Vérifie : menu **Table Editor** → tu dois voir `profiles`, `exercices`, `workouts`, `programmes`, `realisations`, `templates_client`, `seances_coaching`, `mots_du_coach`, `questionnaires`, `reponses`, `mesures`, `douleurs`, `entrees_nutrition`, `alertes_vues`. Chaque table doit afficher un petit badge **RLS enabled** (sécurité activée). [FAIT : RLS activée sur les 14 tables dans `schema.sql`]

Ce script crée aussi le dossier de photos privé `photos` (voir étape 5).

## Étape 3 — Réglages d'authentification — 10 min

Menu de gauche : **Authentication** (icône de personne) puis, selon l'interface, **Sign In / Providers** (ou **Providers**) [À VÉRIFIER].

1. Clique sur **Email** pour le déplier :
   - **Confirm email** : **désactive** (OFF). Obligatoire : les e-mails des clients sont fictifs (`.invalid`), aucun message ne pourra jamais être lu. Sans ça, la création d'un client par l'app échoue ou crée un compte inutilisable.
   - **Minimum password length** (si présent) : laisse 6 (les codes font 6 caractères).
   - **Save**.
2. **Inscriptions publiques (« Allow new users to sign up »)** — à laisser **activée** (c'est un compromis assumé) :
   - Pourquoi : l'app crée un client en appelant `signUp` avec la clé publique (décision du 20/10/2026, pas de clé secrète dans le navigateur). Si tu désactives les inscriptions, **la création de clients dans l'app ne marchera plus**.
   - Ce que ça permet à un inconnu qui trouverait la clé publique (elle est visible dans le code de l'app) : créer un compte Supabase vide. Ce compte **n'a pas de profil** (seul le coach peut en créer un, règle RLS `profiles_coach_ecriture`), donc l'app le refuse à la connexion, et il ne lit aucune donnée de client (toutes les tables sont filtrées sur `client_id = auth.uid()`). [FAIT : `schema.sql` et `supabase.js`]
   - Résidu connu : un tel compte pourrait lire la bibliothèque d'exercices (non sensible) et déposer des fichiers dans son propre dossier de photos (consommation du stockage gratuit, 1 Go [À VÉRIFIER]). Risque faible à 10-15 clients.
   - Pour supprimer ce compromis plus tard : faire créer les clients par une Edge Function (même mécanisme que l'étape 8, avec `auth.admin.createUser`), puis désactiver les inscriptions. Demande-le à REX si tu veux le faire.
3. **Authentication → URL Configuration** : **Site URL** = l'adresse Netlify de l'étape 9 (tu pourras y revenir ; sans importance tant qu'aucun e-mail n'est envoyé).
4. (Option sécurité) **Authentication → Rate Limits** : laisse les valeurs par défaut ; Supabase limite déjà les tentatives de connexion répétées. Le code à 6 caractères reste le point faible : encourage chaque client à le changer dans Profil.

## Étape 4 — Créer ton compte coach — 10 min

Le premier compte coach ne peut pas être créé par l'app (il n'y a personne pour le créer) : on le fait à la main.

1. **Authentication → Users → Add user → Create new user** [À VÉRIFIER pour le libellé exact].
   - **Email** : `corentin@clients.cdc-coaching.invalid`
   - **Password** : ton code de coach. Choisis-le **long** (12 caractères ou plus, mot de passe fort : c'est la clé de toutes les données). Le champ de connexion de l'app n'impose pas de longueur maximale.
   - Coche **Auto Confirm User** si la case existe.
   - **Create user**.
2. Dans la liste, repère la ligne `corentin@...` et note son **UID** (copie-le, c'est un long identifiant du type `3f2b...`).
3. **SQL Editor → + New query**, colle ceci en remplaçant `COLLE-L-UID-ICI` (garde les apostrophes) puis **Run** :

```sql
insert into profiles (id, role, identifiant, nom, archive, preferences, cree_le)
values (
  'COLLE-L-UID-ICI',
  'coach',
  'corentin',
  'Corentin Delmée',
  false,
  '{"son": true, "vibration": true, "unite": "kg"}'::jsonb,
  (extract(epoch from now()) * 1000)::bigint
);
```

   Attendu : « Success. 1 row affected » (ou équivalent). C'est ce profil `role = 'coach'` qui donne tous les droits : la fonction `is_coach()` du schéma le lit.
4. Vérifie : **Table Editor → profiles** → une ligne, `role` = `coach`, `identifiant` = `corentin`.

Plus tard, tes clients ne verront jamais cette page : tu les crées depuis l'app (Espace coach → Clients → Nouveau client).

## Étape 5 — Photos : vérifier le dossier privé — 3 min

Le script de l'étape 2 a déjà créé le bucket `photos` en **privé**. Vérifie seulement :

1. Menu **Storage** → tu vois un bucket `photos`.
2. À côté du nom, il ne doit **pas** y avoir de mention « Public ». S'il y en a une : ⋮ à droite du bucket → **Edit bucket** → décoche **Public bucket** → **Save**.

Chaque client ne peut accéder qu'à son sous-dossier `<son identifiant technique>/…` ; toi, tu accèdes à tout. [FAIT : politiques `photos_*` dans `schema.sql`]

## Étape 6 — Récupérer l'adresse et la clé, remplir `.env` — 10 min

1. Dans Supabase : **Project Settings** (roue crantée en bas à gauche) → **API** (ou **Data API** / **API Keys**) [À VÉRIFIER, l'écran a changé plusieurs fois].
   - **Project URL** : du type `https://abcdefghij.supabase.co` → c'est `VITE_SUPABASE_URL`.
   - **anon public** (clé « legacy ») ou **publishable key** (`sb_publishable_...`) → c'est `VITE_SUPABASE_ANON_KEY`. Cette clé est **publique par conception** (elle finit dans le code de l'app), la sécurité repose sur les règles RLS.
   - **NE JAMAIS** copier la clé **service_role** / **secret** dans `.env`, dans Git, ni dans un message. Elle ouvre tout.
2. Sur ton PC, dans le dossier `Projets\app-coaching`, copie `.env.example` en `.env` (clic droit → Copier, Coller, renomme en `.env` ; si Windows refuse le nom, enregistre depuis le Bloc-notes avec « Type : Tous les fichiers »). Ouvre-le et mets :

```
VITE_SUPABASE_URL=https://TON-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=ta-cle-anon-ou-publishable
VITE_COACH_WHATSAPP=33612345678
```

   - `VITE_COACH_WHATSAPP` : ton numéro au format international **sans** `+` ni espaces (06 12 34 56 78 devient `33612345678`). Cette ligne n'est pas dans `.env.example` : ajoute-la. Sans elle, le bouton WhatsApp ouvre WhatsApp sans contact choisi.
   - Pas d'espaces autour du `=`, pas de guillemets.
   - `.env` est ignoré par Git : il ne partira jamais sur GitHub. [FAIT : `.gitignore`]

## Étape 7 — Vérifier en local — 10 min

1. Double-clique **`lancer.cmd`** (dans `Projets\app-coaching`). Il installe ce qu'il faut la première fois, lance le serveur et ouvre le navigateur (http://localhost:5173). Si le navigateur ne s'ouvre pas, va à cette adresse. Ne ferme pas la fenêtre noire tant que tu testes.
2. Tu dois voir l'écran de connexion **sans** les comptes de démo `DEMO24` / `COACH7` (ils n'apparaissent qu'en mode local). Si tu les vois, `.env` n'est pas lu : vérifie son nom (`.env` et pas `.env.txt`), sa place (à la racine du projet), puis ferme `lancer.cmd` et relance.
3. Connecte-toi : identifiant `corentin`, code = celui choisi à l'étape 4. Va dans l'espace coach (`/coach`).
4. Crée un client de test : **Clients → Nouveau client**. L'app affiche **une seule fois** son identifiant et son code : note-les. Si tu vois une erreur du type « Email signups are disabled » ou « Email not confirmed » : reprends l'étape 3.
5. Vérifie dans Supabase : **Authentication → Users** (un nouvel utilisateur `…@clients.cdc-coaching.invalid`) et **Table Editor → profiles** (une ligne `client`).
6. Pour arrêter : ferme la fenêtre noire.

## Étape 8 — Importer les exercices et les questionnaires de départ — 10 min

**Exercices (80)** — via l'import JSON de l'app :
1. Fichier prêt : **`docs\import-depart.json`** (80 exercices, **aucun** client fictif ni programme ni séance). Il a été généré par `node docs\generer-import-depart.mjs` à partir des données de démo ; tu peux le relancer pour le régénérer. [FAIT : validé par `preparerImport`, rapport « Exercices : 80 ajoutés »]
2. Dans l'app (en local ou en ligne), connecté en coach : **Espace coach → Import / export** → **Fichier JSON** → choisis `docs\import-depart.json`.
3. Attendu : « Exercices : 80 ajoutés ». Vérifie dans **Espace coach → Exercices**. Relancer l'import ne crée pas de doublons (rapprochement par identifiant).
4. Pas de « modèles de séance » prêts : les données de démo n'en contiennent pas (les séances fictives appartiennent toutes à des clients fictifs). Tu les crées toi-même dans le constructeur. Le fichier `workouts` est volontairement vide.

**Questionnaires par défaut (Check-in du jour, Bilan de la semaine)** — l'import JSON ne les gère pas, donc par SQL (ils s'afficheront à tous les clients) :

**SQL Editor → + New query**, colle et **Run** :

```sql
insert into questionnaires (id, client_id, data) values ('q-checkin-quotidien', null, '{"id":"q-checkin-quotidien","clientId":null,"nom":"Check-in du jour","frequence":"quotidien","questions":[{"cle":"sommeil","libelle":"Comment as-tu dormi ?","type":"curseur","min":0,"max":10,"etiquettes":["Très mal","Très bien"]},{"cle":"energie","libelle":"Ton niveau d''énergie aujourd''hui ?","type":"emojis","choix":["😫","😕","😐","🙂","🤩"]},{"cle":"stress","libelle":"Ton niveau de stress ?","type":"curseur","min":0,"max":10,"etiquettes":["Zen","Au maximum"]},{"cle":"douleur","libelle":"Une douleur aujourd''hui ? (0 = aucune)","type":"curseur","min":0,"max":10,"etiquettes":["Aucune","Insupportable"]},{"cle":"faim","libelle":"Ta faim aujourd''hui ?","type":"choixUnique","choix":["Pas faim","Normale","Très faim"]},{"cle":"hydratation","libelle":"Combien as-tu bu d''eau ?","type":"nombre","unite":"L","min":0,"max":10,"pas":0.25}]}'::jsonb)
on conflict (id) do update set data = excluded.data;
insert into questionnaires (id, client_id, data) values ('q-bilan-hebdo', null, '{"id":"q-bilan-hebdo","clientId":null,"nom":"Bilan de la semaine","frequence":"hebdo","questions":[{"cle":"poids","libelle":"Ton poids ce matin","type":"nombre","unite":"kg","min":20,"max":300,"pas":0.1},{"cle":"tourDeTaille","libelle":"Tour de taille","type":"nombre","unite":"cm","min":30,"max":250,"pas":0.5},{"cle":"tourDeHanches","libelle":"Tour de hanches","type":"nombre","unite":"cm","min":30,"max":250,"pas":0.5},{"cle":"ressenti","libelle":"Ton ressenti sur la semaine","type":"emojis","choix":["😫","😕","😐","🙂","🤩"]},{"cle":"objectifs","libelle":"Qu''est-ce qui s''est bien passé ?","type":"choixMultiple","choix":["Séances faites","Alimentation","Sommeil","Motivation","Récupération"]},{"cle":"difficulte","libelle":"Séances de la semaine","type":"choixUnique","choix":["Trop faciles","Bien dosées","Trop dures"]},{"cle":"bilan","libelle":"Ton bilan en quelques mots","type":"texte","optionnel":true},{"cle":"photo","libelle":"Une photo de ta semaine (facultatif)","type":"photo","optionnel":true}]}'::jsonb)
on conflict (id) do update set data = excluded.data;
```

(Même texte que les questionnaires de démo ; tu pourras les modifier ensuite dans **Espace coach → Questionnaires**. Les régénérer : `node docs\generer-import-depart.mjs --sql`.) Vérifie : **Table Editor → questionnaires** → 2 lignes.

## Étape 9 — Mise en ligne avec Netlify Drop — 20 min

Les variables du `.env` sont **intégrées au code au moment du build** (Vite les lit et les écrit dans les fichiers de `dist/`). Conséquences : (1) le `.env` doit être rempli **avant** `npm run build` ; (2) Netlify n'a besoin d'aucune variable d'environnement avec le Drop (on n'envoie que des fichiers déjà construits) ; (3) si tu changes l'URL, la clé ou le numéro WhatsApp, il faut **refaire un build et un nouveau Drop**. L'adresse et la clé `anon` sont publiques de toute façon ; ne mets **jamais** la clé service dans `.env`.

1. Ouvre un terminal dans le dossier du projet : explorateur Windows → dossier `app-coaching` → clic dans la barre d'adresse → tape `cmd` → Entrée.
2. Lance (`npm.cmd` et non `npm`, à cause du blocage PowerShell connu) :
   ```
   npm.cmd run build
   ```
   Attendu : « built in … » sans erreur rouge et un dossier **`dist`** mis à jour. Contrôle rapide : dans `dist`, tu dois voir `index.html`, `sw.js`, `_headers`, `_redirects`, un dossier `assets`.
3. Optionnel mais conseillé avant d'envoyer : `npm.cmd run preview` puis ouvre l'adresse affichée et reconnecte-toi (c'est le vrai build, connecté à Supabase). `Ctrl+C` pour arrêter.
4. Va sur https://app.netlify.com/drop. **Important** : sans compte, le site déposé est temporaire (supprimé au bout d'environ 1 h [À VÉRIFIER]). Crée donc d'abord un compte gratuit (**Sign up**, e-mail ou GitHub, avec double authentification), puis reviens sur la page **Drop** ou, une fois connecté : **Sites → Add new site → Deploy manually** [À VÉRIFIER].
5. Glisse le **dossier `dist`** (le dossier entier, pas son contenu, pas un zip) dans la zone « Drag and drop your site output folder here ».
6. Netlify donne une adresse du type `https://magnifique-nom-123abc.netlify.app`. Le déploiement est fini en quelques secondes.
7. **Renommer le sous-domaine** : ouvre ton site → **Site configuration** (ou **Site settings**) → **Site details** → **Change site name** → par exemple `corentin-coaching` → **Save**. L'adresse devient `https://corentin-coaching.netlify.app`. (Un nom déjà pris est refusé : essaie `corentin-delmee-coaching`.)
8. **Mettre à jour plus tard** : site → **Deploys** → glisse le nouveau dossier `dist` dans la zone « Drag and drop » en bas de la page ; l'adresse reste la même. Les fichiers `_headers` et `_redirects` livrés avec l'app s'appliquent seuls : toutes les adresses retombent sur l'app (page rechargée sur `/coach`, pas d'erreur 404) et `sw.js` / `index.html` ne sont jamais mis en cache trop longtemps (les mises à jour arrivent chez les clients). [FAIT : `public/_headers`, `public/_redirects`]
9. HTTPS est actif automatiquement (cadenas). Rien à configurer.
10. Retourne dans Supabase → **Authentication → URL Configuration** et mets la **Site URL** sur ton adresse Netlify finale.
11. Pas de domaine personnalisé pour l'instant (hors périmètre). Si tu en achètes un plus tard : Netlify → **Domain management** → **Add a domain**.

### Installer l'app sur un téléphone

- **iPhone (Safari obligatoire)** : ouvre l'adresse dans Safari → bouton **Partager** (carré avec une flèche vers le haut) → **Sur l'écran d'accueil** → **Ajouter**. Ouvre ensuite l'app depuis l'icône (pas depuis Safari).
- **Android (Chrome)** : ouvre l'adresse → menu **⋮** → **Installer l'application** (ou **Ajouter à l'écran d'accueil**) → **Installer**.
- Envoie ce lien et ces consignes à tes clients avec leur identifiant et leur code (le message peut être préparé depuis l'écran du client, qui propose la copie du texte à transmettre).

## Étape 10 — Réinitialiser le code d'un client — 25 min (une seule fois) puis 10 s par oubli

**Le problème.** Si un client oublie son code, il faut changer le mot de passe d'un *autre* compte. Supabase l'interdit depuis le navigateur sauf avec la clé « service_role », qui ne doit **jamais** se trouver dans l'app. La solution propre : une petite fonction qui tourne chez Supabase (« Edge Function »), qui contient la clé en sécurité, et qui vérifie que c'est bien **toi** (le coach) qui demande. Elle est déjà écrite : **`supabase\functions\reinitialiser-code\index.ts`**.

Ce qu'elle fait, dans l'ordre : vérifie le jeton de connexion de l'appelant, vérifie dans `profiles` qu'il est `coach` (et non archivé), vérifie que la cible est un `client` (jamais le coach), exige un code de 6 à 72 caractères, puis change le mot de passe. La clé service vient de l'environnement de la fonction (Supabase la fournit tout seul, tu n'as rien à copier).

### Déploiement (CLI Supabase via `npx`, sans installation globale)

Dans un terminal ouvert dans le dossier du projet (voir étape 9.1) :

```
npx.cmd supabase login
```
→ une page de navigateur s'ouvre, valide la connexion (le jeton est stocké sur ton PC, pas dans le projet). La première fois, `npx` propose de télécharger le paquet `supabase` : réponds `y`.

```
npx.cmd supabase link --project-ref TON-REF
```
`TON-REF` = les lettres avant `.supabase.co` dans ton Project URL (ex. `abcdefghij`). Il peut demander le mot de passe de base (celui de l'étape 1) : colle-le, ou appuie sur Entrée pour passer. Si une erreur dit qu'il manque `supabase\config.toml`, lance d'abord `npx.cmd supabase init` (réponds « n » aux questions sur VS Code / IntelliJ), puis refais `link`.

```
npx.cmd supabase functions deploy reinitialiser-code
```
Attendu : « Deployed Functions on project … ». Si le message parle de Docker, ajoute `--use-api` à la commande. [À VÉRIFIER selon la version de la CLI]

Vérifie dans Supabase : menu **Edge Functions** → `reinitialiser-code` listée comme « Active ». Laisse l'option **Verify JWT** activée (par défaut).

Aucun secret à enregistrer : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux fonctions hébergées [À VÉRIFIER dans la doc Supabase « Edge Functions → Environment Variables »]. Si la fonction répond une erreur 500 « Changement impossible » et que les logs (Edge Functions → reinitialiser-code → **Logs**) parlent d'une clé manquante, c'est que cette variable n'est pas fournie : dans ce cas ajoute-la par **Edge Functions → Secrets** sous un autre nom et préviens REX pour adapter le code.

### À brancher dans le front (par le développeur, hors de ce lot)

Aujourd'hui `reinitialiserCode` dans `src/data/adapters/supabase.js` (lignes ~118-121) lève une erreur « NON_SUPPORTE ». Il faudra le remplacer par un appel à la fonction. Signature à conserver : `reinitialiserCode(identifiant, code)` (appelée par `src/data/commun.js`, qui génère le code et l'affiche une fois dans `ClientView.vue`). Proposition de remplacement :

```js
async reinitialiserCode(identifiant, code) {
  const c = await sb()
  const { data, error } = await c.functions.invoke('reinitialiser-code', { body: { identifiant, code } })
  if (error) {
    let message = error.message
    try { message = (await error.context.json()).erreur || message } catch { /* corps illisible */ }
    throw echec(new Error(message))
  }
  if (!data?.ok) throw new ErreurData('VALIDATION', data?.erreur || 'Réinitialisation impossible')
}
```

Le SDK ajoute tout seul le jeton du coach connecté. Rien d'autre à changer (pas de clé, pas de variable `.env` en plus). Tant que ce branchement n'est pas fait, la **procédure manuelle** ci-dessous fonctionne.

### Procédure manuelle (secours, sans fonction)

1. Dans l'app, ouvre la fiche du client et note son **identifiant** (ex. `fabien.vincent`).
2. Supabase → **Authentication → Users** → cherche `fabien.vincent@clients.cdc-coaching.invalid` → clique les **⋯** de la ligne (ou ouvre l'utilisateur) → **Send password recovery** n'est **pas** utilisable (l'e-mail est fictif) → utilise plutôt **Update password** / **Reset password** s'il est proposé [À VÉRIFIER : selon la version du tableau, ce choix n'existe pas toujours].
3. Si l'option n'existe pas : supprime l'utilisateur (⋯ → **Delete user**) et recrée-le avec **Add user → Create new user** (même e-mail technique, nouveau code, **Auto Confirm User**) ; puis, dans le **SQL Editor**, remets la bonne ligne de profil. **Attention : supprimer l'utilisateur supprime en cascade son profil et toutes ses données** (règle `on delete cascade`). **Ne le fais donc pas** pour un client qui a un historique : déploie plutôt la fonction.
4. Communique le nouveau code au client et rappelle-lui de le changer dans Profil.

## Étape 11 — Vérifications après mise en ligne — 40 min

Fais-les depuis l'adresse Netlify, avec un vrai téléphone si possible.

**A. Isolation des clients (le test le plus important)**
1. Dans l'app (coach), crée **deux** clients de test : `Test Un` et `Test Deux` (identifiants `test.un`, `test.deux`). Note leurs codes.
2. Dans le coach, donne un petit programme à chacun (ou ajoute une séance de coaching et un mot du coach) avec des textes différents reconnaissables.
3. Fenêtre de navigation privée n°1 : connecte-toi en `test.un`. Il ne doit voir **que** ses données. Fais un check-in du jour (douleur 5).
4. Fenêtre privée n°2 (ou un autre navigateur) : connecte-toi en `test.deux`. Il ne doit voir ni le programme, ni le check-in, ni le nom de `test.un`.
5. Test « dur » (contourne l'app) : connecté en `test.un`, ouvre la console du navigateur (**F12 → Console**) et colle, en remplaçant `URL` et `CLE` par ceux de ton `.env` :
   ```js
   const k = Object.keys(localStorage).find(x => x.endsWith('-auth-token'));
   const t = JSON.parse(localStorage[k]).access_token;
   for (const table of ['profiles','reponses','realisations','programmes','seances_coaching','mesures','douleurs']) {
     fetch('URL/rest/v1/' + table + '?select=*', { headers: { apikey: 'CLE', Authorization: 'Bearer ' + t } })
       .then(r => r.json()).then(d => console.log(table, d.length, d.map(x => x.client_id ?? x.id)));
   }
   ```
   **Attendu** : pour chaque table, uniquement des lignes dont l'identifiant est celui de `test.un` (0 ou plus de lignes, jamais de ligne d'un autre). Si tu vois les données de `test.deux`, **arrête tout, ne donne aucun accès aux vrais clients** et préviens REX (règles RLS à corriger).
6. Toujours en `test.un` : `…/rest/v1/profiles` ne doit renvoyer **qu'un** profil (le sien). Essaie aussi d'ouvrir `/coach` : l'app doit te renvoyer à l'accueil.
7. Supprime ces comptes de test à la fin : dans l'app (archiver) puis, pour une suppression complète, Supabase → **Authentication → Users → Delete user** (supprime aussi leurs données par cascade).

**B. Connexion et sécurité de base**
- Mauvais code → message d'erreur générique, pas de connexion.
- Adresse en `http://` → redirigée vers `https://` (cadenas présent).
- Rechargement sur une page profonde (ex. `/coach/clients`) → pas de page 404 Netlify.
- Le code des clients n'apparaît nulle part dans l'URL ni dans la page.

**C. Hors connexion**
1. Sur le téléphone, ouvre l'app installée, connecté, charge l'écran Workout.
2. Passe en mode avion. Relance l'app : elle s'ouvre, le workout est consultable.
3. Fais une séance et termine-la : elle est mise en file d'attente locale.
4. Désactive le mode avion : la séance part toute seule ; vérifie-la côté coach (Espace coach → séances du client).

**D. Installation et mises à jour**
- iPhone et Android : installation réussie (étape 9), icône sur l'écran d'accueil, plein écran sans barre du navigateur.
- Refais un `npm.cmd run build` et un Drop après un changement mineur : après une ou deux ouvertures, l'app installée affiche la nouvelle version (c'est le rôle du `no-cache` sur `sw.js`).

**E. Rapide : le reste**
- WhatsApp : bouton « M'envoyer un mot » / Modifier / Annuler ouvre bien WhatsApp avec **ton** numéro.
- Photo de repas / bilan (pour un client test avec le module activé) : l'envoi marche, et dans Supabase **Storage → photos** le fichier est dans un dossier au nom de l'identifiant technique du client.
- Reset de code (après branchement du front, étape 10) : le client se reconnecte avec le nouveau code, l'ancien est refusé.

## Étape 12 — Sauvegarde mensuelle — 15 min par mois

À mettre au calendrier (1er du mois). L'offre gratuite de Supabase ne fournit pas de sauvegardes téléchargeables automatiquement et peut mettre un projet inactif en pause [À VÉRIFIER sur la page Pricing / Database → Backups]. Mets l'export dans un dossier **chiffré ou protégé par mot de passe** et supprime les anciens (durée de conservation : `docs/RGPD-CHECKLIST.md` §4).

1. **Toutes les données en un fichier** : SQL Editor → nouvelle requête :
   ```sql
   select jsonb_pretty(jsonb_build_object(
     'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from profiles t),
     'exercices', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from exercices t),
     'workouts', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from workouts t),
     'programmes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from programmes t),
     'realisations', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from realisations t),
     'templates_client', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from templates_client t),
     'seances_coaching', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from seances_coaching t),
     'mots_du_coach', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from mots_du_coach t),
     'questionnaires', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from questionnaires t),
     'reponses', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from reponses t),
     'mesures', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from mesures t),
     'douleurs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from douleurs t),
     'entrees_nutrition', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from entrees_nutrition t),
     'alertes_vues', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from alertes_vues t)
   )) as sauvegarde;
   ```
   Dans les résultats, clique la cellule `sauvegarde` → copie la valeur → colle dans un fichier `sauvegarde-AAAA-MM.json`. (Si le résultat est tronqué à l'écran, fais l'export table par table : **Table Editor** → la table → **Export** → **Download CSV**.)
2. **Comptes** : les e-mails et mots de passe ne sont pas inclus (volontaire). En cas de reconstruction, les clients se recréent avec un nouveau code (profils déjà dans la sauvegarde).
3. **Photos** : Storage → `photos` → télécharge les dossiers utiles (pas d'export global en un clic) ; à faire seulement si les photos comptent pour toi.
4. **Bibliothèque** : Espace coach → Import / export → Exporter (JSON des exercices, séances, programmes) : se réimporte directement.
5. **Projet en pause** : Supabase suspend les projets gratuits très peu utilisés [À VÉRIFIER : délai]. Avec des clients actifs ce n'est pas un risque ; en cas de pause, bouton **Restore project** dans le tableau de bord.

## Que faire si ça casse

| Symptôme | Cause probable | Action |
|---|---|---|
| L'app affiche les comptes de démo `DEMO24` / `COACH7` | `.env` absent ou build fait sans `.env` | Remplis `.env`, relance `npm.cmd run build`, refais le Drop |
| « Identifiant ou code incorrect » pour tout le monde | URL/clé fausse, ou compte sans profil | Vérifie `.env` ; **Authentication → Users** (existe ?) et **Table Editor → profiles** (ligne présente ?) |
| Création d'un client en erreur « signups not allowed » | Inscriptions publiques désactivées | Réactive-les (étape 3.2) |
| Client créé mais ne peut pas se connecter, « Email not confirmed » | Confirmation e-mail encore active | Désactive **Confirm email** (étape 3.1) ; pour les comptes déjà créés : Users → ⋯ → **Confirm user** si proposé |
| `schema.sql` : erreur `already exists` | Script déjà lancé en partie | Ne relance pas à moitié. Sur un projet **sans donnée utile** : Settings → Database → supprime/recrée le projet, ou demande à REX un script de remise à zéro. |
| Un client voit des données qui ne sont pas les siennes | Règles RLS cassées | Coupe l'accès (change le code du client / mets le site hors ligne : Netlify → **Deploys → Stop auto publishing** ou supprime le site), note l'incident (procédure violation : `docs/RGPD-CHECKLIST.md` §9, **72 h** pour la CNIL), prévient REX |
| Page blanche après une mise à jour | Ancienne version en cache (service worker) | Recharge fort (Ctrl+Maj+R) ; sur téléphone : ferme complètement l'app et rouvre, sinon supprime l'icône et réinstalle |
| `npm` bloqué dans PowerShell | Stratégie d'exécution Windows | Utilise `npm.cmd`, ou `lancer.cmd` |
| `npm.cmd` introuvable | Node pas dans le PATH de ce terminal | Ferme et rouvre le terminal ; sinon réinstalle Node LTS |
| Photos refusées / « new row violates row-level security » | Bucket ou politiques absents | Storage → `photos` existe et est privé ; relance seulement la partie « STORAGE » de `schema.sql` si absent |
| Réinitialisation de code : « Réservé au coach » (403) | Tu n'es pas connecté en coach, ou profil sans `role = coach` | Vérifie la ligne de `profiles` (étape 4) |
| Réinitialisation de code : erreur 404 / « Function not found » | Fonction non déployée | Refais `npx.cmd supabase functions deploy reinitialiser-code` |
| Mot de passe coach oublié | — | Supabase → **Authentication → Users** → ⋯ sur ta ligne → mettre à jour/réinitialiser le mot de passe ; sinon créer un nouvel utilisateur coach (étape 4) et supprimer l'ancien |
| Clé service exposée par erreur | — | Supabase → Project Settings → API → **régénère** le secret/JWT ; Edge Function à redéployer ; préviens REX |
| Perte de données | — | Restaure depuis ta dernière sauvegarde mensuelle (étape 12) : demande à REX un script d'import des fichiers JSON |

---

## Tâches à faire par Corentin (récapitulatif)

| # | Tâche | Durée | Quand |
|---|---|---|---|
| 1 | Créer le compte et le projet Supabase en région UE (Francfort ou Paris), double authentification | 10 min | Étape 1 |
| 2 | Exécuter `supabase\schema.sql` dans le SQL Editor | 5 min | Étape 2 |
| 3 | Régler l'authentification : confirmation e-mail OFF, inscriptions laissées ON | 10 min | Étape 3 |
| 4 | Créer le compte coach (Auth) et lui donner le rôle `coach` (requête SQL) | 10 min | Étape 4 |
| 5 | Vérifier que le dossier photos est privé | 3 min | Étape 5 |
| 6 | Copier URL + clé anon dans `.env`, ajouter ton numéro WhatsApp | 10 min | Étape 6 |
| 7 | Tester en local avec `lancer.cmd` (connexion coach, client de test) | 10 min | Étape 7 |
| 8 | Importer `docs\import-depart.json` + coller le SQL des 2 questionnaires | 10 min | Étape 8 |
| 9 | Créer le compte Netlify, `npm.cmd run build`, Drop de `dist`, renommer le site | 20 min | Étape 9 |
| 10 | Installer l'app sur ton iPhone et/ou Android | 5 min | Étape 9 |
| 11 | Déployer la fonction de réinitialisation de code (`npx.cmd supabase …`) | 25 min | Étape 10 |
| 12 | Demander le branchement front de `reinitialiserCode` (REX / développeur) | 2 min | Étape 10 |
| 13 | Recette en ligne : isolation de 2 comptes, hors connexion, installation | 40 min | Étape 11 |
| 14 | Mettre un rappel mensuel et faire la première sauvegarde | 15 min puis 15 min/mois | Étape 12 |
| 15 | Tâches RGPD déjà listées : DPA Supabase/Netlify, registre, relecture juridique, politique mineurs (`docs/RGPD-CHECKLIST.md` §A) | 3 à 5 h | Avant le premier vrai client |

Total mise en ligne (tâches 1 à 14) : environ 2 h 30. **Ne donne aucun accès à un vrai client avant la tâche 13 (test d'isolation) et la tâche 15 (RGPD, au minimum consentement validé et page Confidentialité complétée).**

## Fichiers livrés avec ce document

- `docs\import-depart.json` : 80 exercices prêts à importer (généré par `docs\generer-import-depart.mjs`).
- `supabase\functions\reinitialiser-code\index.ts` : Edge Function de réinitialisation de code (non déployée).
- Existants : `supabase\schema.sql`, `public\_headers`, `public\_redirects`, `lancer.cmd`, `docs\RGPD-CHECKLIST.md`.
