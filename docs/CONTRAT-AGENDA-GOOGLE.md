# Contrat — Google Agenda → app coaching (2026-11-12)

Demande de Corentin : « voir mes coachings dans l'application ; les coachings passés
"Coaching Nom du client" marqués dans les coachings passés de la fiche client ; le client
voit les coachings qui arrivent dans son app ».
Choix de Corentin : (1) réutiliser l'accès Google de l'API réservation (coaching-domicile/reservation),
(2) les coachings passés deviennent de vraies séances de coaching « faites » en base.

## A. API réservation (dépôt coaching-domicile, dossier reservation/)

- Scope ajouté : `https://www.googleapis.com/auth/calendar.events.readonly` (en plus des scopes actuels).
  Le jeton actuel ne l'a pas : Corentin doit ré-autoriser une fois (procédure écrite dans
  reservation/deploiement/LISEZMOI.md, courte, chemins complets).
- Nouvelle route admin (même garde `x-resa-admin-key` que les autres routes admin) :

`GET /api/resa/admin/evenements?depuis=<ISO>&jusqua=<ISO>`
- période ≤ 400 jours, `depuis < jusqua`, sinon 400 `{"erreur":"periode_invalide"}`
- appelle Calendar v3 `events.list` sur l'agenda principal, `singleEvents=true`, `orderBy=startTime`,
  `showDeleted=true`, toutes les pages (maxResults 2500), filtre `q` NON utilisé (on filtre côté app).
- 200 :
```json
{ "evenements": [
  { "id": "g5o7vd..._20261113T103000Z", "titre": "Coaching Guillaume",
    "debut": "2026-11-13T11:30:00+01:00", "fin": "2026-11-13T12:30:00+01:00",
    "journee": false, "lieu": "Danse & Fitness Rambouillet", "annule": false,
    "maj": "2026-10-15T21:45:02Z" } ] }
```
  - événement « journée entière » : `debut`/`fin` = `"2026-11-13"` (date seule), `journee: true`.
  - `status == "cancelled"` → `annule: true` (titre peut être vide).
  - `lieu` : `""` si absent. Jamais la description ni les invités (données perso inutiles).
- 503 `{"erreur":"google_lecture_non_autorisee"}` si le jeton n'a pas le scope (403 insufficientPermissions de Google)
  ou n'existe pas ; 502 `{"erreur":"google_indisponible"}` pour les autres échecs Google.
- Aucune écriture, aucun cache obligatoire.

## B. App coaching (serveur/ + src/)

- La synchro tourne dans le service (au démarrage + toutes les 15 min) et sur `POST /api/app/agenda/synchroniser`
  (coach seulement ; synchrone, renvoie le bilan). Fenêtre : du **2026-01-01** à aujourd'hui + 90 jours
  (les jours < aujourd'hui − 400 j sont ignorés ; découper en appels ≤ 400 jours).
- Événement retenu si le titre commence par « Coaching » (insensible casse/accents). Reconnaissance du/des client(s) :
  nom complet, prénom seul s'il est unique parmi les clients (actifs ET archivés), plusieurs clients
  (« Christine et Didier », « Didier Christine »), parenthèses (« Coaching (Caroline  Mion) »), mots en trop
  (« (domicile) », « Ownsport »). Règles existantes à réutiliser/étendre : src/domain/agendaGoogle.js.
  Prénom partagé par 2 clients ou nom inconnu → **à attribuer** (jamais deviné).
- Alias : quand le coach attribue un événement (« Coaching Christine » → client X), l'alias (titre normalisé → client(s))
  est retenu et appliqué aux synchros suivantes.
- Pour chaque (événement, client) attribué : une séance de coaching en base, clé unique `google:<id événement>:<clientId>`,
  statut `faite` si fin < maintenant, sinon `prevue` ; heure/date/durée/lieu mis à jour si l'événement change ;
  événement annulé ou disparu → séance future supprimée (une séance passée déjà `faite` n'est jamais supprimée,
  elle est marquée annulée seulement si l'événement est annulé). Une séance modifiée à la main par le coach
  (note, statut) n'est pas écrasée sur ces champs.
- Pas de doublon côté client : la séance Google ne doit apparaître qu'une fois (base OU flux Google, pas les deux).
- Visible : fiche client (coachings passés + à venir), Aujourd'hui/Agenda coach, Accueil client (prochain coaching),
  outil MCP `consulter_agenda`. Écran Agenda : bilan dernière synchro, liste « à attribuer » avec choix du client.
- Si l'API réservation renvoie 503 `google_lecture_non_autorisee` : message clair dans l'écran Agenda
  (« Autorisation Google à renouveler ») et rien n'est supprimé.
