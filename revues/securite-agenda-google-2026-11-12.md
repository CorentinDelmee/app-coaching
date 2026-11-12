# Audit sécurité — synchro Google Agenda (2026-11-12)

Périmètre : app-coaching `main...agenda-google` ; coaching-domicile/reservation 33af062. Auditeur Opus, lecture seule (rapport écrit par REX).

## Critiques
Aucun.

## Importants
1. Titre/lieu Google fuient chez le client : `serveur/src/agenda-synchro.js:146` stocke `titre`, `lieuTexte`, `synchro`, `googleId` dans la séance ; `pourLecteur` (`app-http.js:283-289`) ne filtre pas `seancesCoaching` → `GET /api/app/entites/seancesCoaching` contourne le retrait du titre (`app-http.js:592`). Ex. « Coaching Christine (relance paiement) ».
2. Mauvaise attribution : les séances passées « faites » restent chez l'ancien client (`disparition` :102-103 ne supprime que le futur) et comptent dans « Payé ce mois » (`src/domain/coaching.js:40-44`). Correctif : au changement de client, supprimer aussi les passées non modifiées à la main.
3. Titre devenu ambigu (2e « Guillaume » créé) → séances futures supprimées, notes comprises (:124, :135, :103). Correctif : garder l'attribution précédente, seulement signaler.
4. Séance Google supprimée par le coach/MCP (`outils/suivi.js:161`) recréée 15 min plus tard. Marque de suppression ou documentation (« annulée » seul tient).
5. Double comptage : anti-doublon (`jumelle` :109-110, :145) seulement à la création, ±15 min ; séance manuelle saisie après la synchro = 2 séances payées. Coaching passé non annulé = « faite » même si absent.

## Mineurs
6. Tout l'agenda privé (400 j, perso compris) transite de l'API résa vers l'app (`reservation/lib/google.mjs:94-112`) : filtrer « Coaching » côté résa ; la clé RESA_ADMIN_KEY prend de la valeur.
7. Regex cassée `reservation/lib/app.mjs:418` : `/ (dd:dd)$/` au lieu de `/ (\d\d:\d\d)$/`.
8. Pagination sans plafond (`google.mjs:98-112`) ; l'app abandonne à 20 s par tranche (`agenda-synchro.js:56`).
9. Scope `calendar.events.readonly` = tous les agendas ; `calendar.events.owned.readonly` à vérifier.
10. Le client reçoit `lieuTexte` (peut être l'adresse de l'autre client d'une séance à deux) ; vieilles lignes `seances_agenda` sans date jamais purgées (:158).

## Sain
Routes coach seulement (403), client ne voit que ses événements attribués, SQL paramétré, entrées bornées, réseau hors transaction puis `BEGIN IMMEDIATE`, une synchro à la fois, échec = rien effacé, champs manuels préservés, `fields` sans description/invités, journaux sans noms, clé admin à temps constant, admin en 404 depuis Internet, jeton jamais affiché.
