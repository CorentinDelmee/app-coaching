# app-coaching sur le VPS (SQLite) + gestion des réservations — contrat commun (REX, 2026-11-02)

Décision de Corentin : **plus de Supabase**. Le back-end de l'app vit sur le VPS de pc-seniors (Node 24, Caddy, systemd),
base **SQLite** (`node:sqlite`, `DatabaseSync`, comme `Projets/pc-seniors/dashboard/server/db.js`), connexion par
identifiant + code et **cookie de session** (modèle : `pc-seniors/dashboard/server/app.js` l. 40-190 et `lib.js` :
hachage scrypt, cookie `HttpOnly; SameSite=Strict; Secure` en production, version de session pour révoquer).
L'espace coach `/coach` gagne un écran **« Réservations »** qui pilote les réservations du site vitrine
(dépôt `Projets/coaching-domicile`, API `reservation/`, contrat `reservation/CONTRAT.md`).

## Architecture
```
navigateur (app PWA, app.<domaine>) ──/api/app/*──> serveur app-coaching (127.0.0.1:5405, serveur/)
                                                     ├─ SQLite /var/lib/app-coaching/app.db
                                                     ├─ MCP (inchangé, même couche service)
                                                     └─ /api/app/reservations/* ──(clé RESA_ADMIN_KEY, 127.0.0.1)──> API réservation 127.0.0.1:5311 /api/resa/admin/*
site vitrine (domaine) ──/api/resa/{creneaux,reserver}──> API réservation (publique via Caddy)
routine Claude 20 h ──/api/resa/synchro/* (clé SYNC_KEY, HTTPS)──> API réservation
```

## Serveur app-coaching (`serveur/`)
- Magasin SQLite à côté du magasin fichier JSON (qui reste pour les tests/démo) : `serveur/src/magasin-sqlite.js`,
  schéma `serveur/schema.sql` = traduction de `supabase/schema.sql` (14 tables, mêmes colonnes, `id` texte UUID,
  JSON en TEXT). Migration au démarrage (`CREATE TABLE IF NOT EXISTS` + `user_version`).
- Table `comptes` (identifiant unique minuscule, hash scrypt, role `coach`|`client`, `profil_id`, `sv` version de session,
  `archive`). Création du 1er coach : `npm run coach:creer <identifiant>` (saisie masquée, comme passwd.js de pc-seniors).
- **Règles d'accès = les policies RLS de `supabase/schema.sql`**, appliquées côté serveur : le coach lit/écrit tout ;
  un client ne lit/écrit que ses lignes (`client_id` = son profil) ; un client ne peut changer ni son rôle, ni son tarif,
  ni ses modules ; entités inconnues refusées (liste blanche).
- Endpoints (JSON, `Cache-Control: no-store`, CSRF : `Origin` = `APP_ORIGIN` exigé sur toute requête non-GET) :
  - `POST /api/app/connexion {identifiant, code}` → 200 `{utilisateur}` + cookie ; 401 générique ; limite 5 essais / 15 min / IP+identifiant.
  - `POST /api/app/deconnexion` · `GET /api/app/moi` (200 `{utilisateur}` ou 401) · `POST /api/app/code {ancien, nouveau}`.
  - `POST /api/app/comptes {identifiant, code, profil}` (coach) · `POST /api/app/comptes/:identifiant/code {code}` (coach).
  - `GET /api/app/e/:entite` · `GET /api/app/e/:entite/:id` · `PUT /api/app/e/:entite/:id` (objet complet, crée ou remplace)
    · `DELETE /api/app/e/:entite/:id`. Codes : 400 invalide, 401, 403, 404.
  - Fichiers : `POST /api/app/fichiers?chemin=…` (corps binaire, ≤ 5 Mo, types image/jpeg|png|webp|pdf),
    `GET /api/app/fichiers?chemin=…` (contrôle d'accès identique à l'entité propriétaire), `DELETE`. Stockage `/var/lib/app-coaching/fichiers/`, chemins normalisés (pas de `..`).
  - Agenda : `GET /api/app/agenda/evenements`, `GET /api/app/agenda/derniere-synchro` (lus en base) ;
    `POST /api/app/agenda/synchroniser` → 202 `{"message":"La synchronisation se fait chaque soir à 20 h."}`.
  - Réservations (**coach uniquement**, relais vers l'API réservation, aucune donnée gardée ici) :
    `GET /api/app/reservations?statut=a_venir|passees|annulees` · `POST /api/app/reservations/:id/annuler` ·
    `GET /api/app/reservations/blocages` · `POST /api/app/reservations/blocages {debut, fin, motif}` · `DELETE /api/app/reservations/blocages/:id` ·
    `GET /api/app/reservations/regles` · `PUT /api/app/reservations/regles {…regles.json}`. Erreur de l'API réservation → 502 `{erreur:"reservation_indisponible"}`.
- Variables : `NODE_ENV`, `PORT=5405`, `HOST=127.0.0.1`, `DB_FILE`, `FICHIERS_DIR`, `SESSION_SECRET` (≥ 32 car.),
  `APP_ORIGIN`, `COACH_API_KEY` (MCP/REST existants), `RESA_API_URL=http://127.0.0.1:5311`, `RESA_ADMIN_KEY` (≥ 32 car.).
  Refus de démarrer en production si l'une manque.

## Front app-coaching (`src/`)
- Nouvel adaptateur `src/data/adapters/api.js` : même interface que `adapters/supabase.js` (tout, un, ecrire, supprimer,
  connecter, deconnecter, utilisateurCourant, changerCode, creerCompte, reinitialiserCode, fichiers.*, agenda.*,
  et le reste de l'objet supabase), `fetch` same-origin `credentials: 'same-origin'`.
- `src/data/index.js` : `VITE_BACKEND=api` → adaptateur api ; sinon adaptateur local (démo) ; Supabase **retiré**
  (adaptateur, dépendance `@supabase/supabase-js`, mentions dans l'UI de config). `supabase/` reste comme archive.
- `src/data/index.js` expose aussi `data.reservations` : `{ liste(statut), annuler(id), blocages(), bloquer(debut, fin, motif),
  debloquer(id), regles(), ecrireRegles(r) }` — en démo locale, données factices en mémoire.
- Écran coach **« Réservations »** (`src/coach/`, route ajoutée dans `src/coach/routes.js`) : onglets À venir / Passées / Annulées
  (date, heure, prénom NOM, commune, adresse, téléphone cliquable, e-mail), annuler (confirmation en 2 temps, sans `confirm()`),
  blocages (créneau ou journée entière, liste, débloquer), règles (plages par jour, durée, tampon, délai minimal, horizon, max/jour,
  fermetures), tout au style existant de l'app (tokens, DESIGN.md retenu).

## API réservation (dépôt coaching-domicile, `reservation/`) — voir son CONTRAT.md mis à jour
- Plus de Google côté serveur. SQLite `/var/lib/coaching-resa/resa.db` : réservations, blocages, occupé (importé par la routine), règles.
- `/api/resa/admin/*` : header `X-Resa-Admin-Key` = `RESA_ADMIN_KEY`, **jamais exposé par Caddy** (404 public), appelé seulement depuis 127.0.0.1.
- `/api/resa/synchro/*` : header `Authorization: Bearer <SYNC_KEY>`, exposé via Caddy (la routine est dans le cloud).
- Notification ntfy à chaque réservation : `NTFY_URL` (sujet secret long), texte sans nom ni téléphone.

## Règles de travail
Chacun ne touche que ses fichiers ; `git add <chemins>` + `git commit -- <chemins>` ; jamais amend, stash, push, reset.
Ports de test : API réservation 5321 · serveur app 5425 · app Vite 5426 · testeurs 5431-5439. Arrêter ses processus par PID.
Scripts temporaires : `/private/tmp/claude-501/-Users-corentindelmee-Documents-REXV2/d3561a92-4377-4a37-8032-00cfef8af835/scratchpad/<agent>/`.
Commit en français terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Rapport ≤ 15 lignes + tokens et durée.

## Formes JSON exactes (ajout REX 2026-11-03, font foi pour les 3 côtés)
**API réservation `/api/resa/admin/*` (déjà codée, lib/app.mjs)** :
- Réservation : `{id, debut, fin, prenom, nom, email, telephone, adresse, commune, statut: "a_venir"|"annulee", cree_le, annulee_le, google_event_id, synchro_etat: "a_creer"|"cree"|"a_supprimer"|"supprime"}` (debut/fin ISO avec décalage Paris, cree_le/annulee_le ISO UTC ou null).
- Blocage : `{id, debut, fin, motif}`.
- `GET reservations?statut=…` → `{reservations:[…]}` · `POST reservations/:id/annuler` → `{ok:true, reservation}` ·
  `GET blocages` → `{blocages:[…]}` · `POST blocages {debut, fin, motif}` → 201 `{ok:true, blocage}` · `DELETE blocages/:id` → `{ok:true}` ·
  `GET regles` → objet règles · `PUT regles` → objet règles nettoyé.
- Le relais app-coaching n'envoie **jamais** `X-Forwarded-For`, `Forwarded`, `X-Real-IP` (refusé par l'API).

**Serveur app-coaching `/api/app/*`** : le relais renvoie le corps de l'API réservation **tel quel** (mêmes formes ci-dessus).
- `GET /api/app/moi`, `POST /api/app/connexion` → `{utilisateur:{id, identifiant, role, profil_id}}`.
- `GET /api/app/e/:entite` → `{items:[…]}` · `GET /api/app/e/:entite/:id` → `{item}` · `PUT` → `{item}` · `DELETE` → `{ok:true}`.
- `POST /api/app/comptes` → 201 `{id}` · `POST /api/app/comptes/:identifiant/code` → `{ok:true}` · `POST /api/app/code` → `{ok:true}`.
- `GET /api/app/agenda/evenements` → `{evenements:[…]}` · `GET /api/app/agenda/derniere-synchro` → `{derniereSynchro: ISO|null}` ·
  `POST /api/app/agenda/synchroniser` → 202 `{message}`.
- Erreurs : `{erreur: "<code>"}` avec le statut HTTP.
**Écran Réservations** : lit `synchro_etat` (a_creer → « sera ajouté ce soir à 20 h », cree → « dans l'agenda », a_supprimer → « sera retiré ce soir », supprime → rien).
