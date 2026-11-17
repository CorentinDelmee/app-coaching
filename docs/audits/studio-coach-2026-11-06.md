# Revue avocat du diable — refonte coach Studio (2026-11-06)

Personas suivis dans le code : Corentin à 7 h sur téléphone, le dimanche soir sur Mac, un nouveau client invité, Corentin qui dicte à Claude (MCP) écran ouvert.

## Bloquant
- **B1** Écriture MCP / deuxième appareil effacée par la sauvegarde auto des éditeurs (objet entier renvoyé, aucune version). → lot `conflits` : version + 409 + état « Modifié ailleurs » + rafraîchissement au retour sur l'onglet.
- **B2** Fiche exercice : `construirePatch` renvoie l'ancienne valeur d'un champ changé par Claude dès qu'on tape ailleurs. → correctifs-exercices.

## Important
- **I1** Noter une séance faite à 7 h : ~6 gestes ; rendez-vous Google/site impossibles à marquer faits. → proposition : bouton « Faite » sur les rendez-vous passés d'Aujourd'hui (décision Corentin).
- **I2** « Relancer » sans numéro du client (WhatsApp non enregistré à l'invitation, format 06 invalide). → bug, à corriger (numéro au format 33… dans le profil, repris de MyPTHub).
- **I3** Pas de séance modèle réutilisable depuis l'éditeur de programme. → proposition : section « Modèles » + duplication vers plusieurs clients (décision Corentin).
- **I4** `:key` du cadre recrée l'écran à chaque changement d'adresse (Clients, création de questionnaire). → correctifs-l0 + correctifs-agq. **I4 bis** nouveau questionnaire incomplet perdu sans prévenir → correctifs-agq.
- **I5** Lien collé par le coach affiché « proposé par Claude ». → lot `conflits` (serveur).
- **I6** « Séance » a trois sens. → décision REX : « Rendez-vous » (agenda, coaching), « Séance » (contenu d'entraînement) ; « Ajouter un rendez-vous » en tête d'Aujourd'hui.
- **I7** Pas de notification push vers les clients (frein n° 1 pour quitter MyPTHub). → proposition (décision Corentin).
- **I8** Couleurs et initiales d'avatar différentes selon l'écran. → une seule fonction partagée.

## Confort
- C1 Aujourd'hui : « Nouveau client » ouvre le formulaire, check-in → onglet Réponses, réservations cliquables, doublon site + Google possible.
- C2 Éditeur de programme : 8 colonnes ne tiennent pas à 1366 px ; toast qui couvre les colonnes.
- C3 Textes : « Envoyé à » → « Pour » ; vouvoiement / tutoiement mélangés ; « Workout 1 » importés ; menu « Vidéos » et doublons « Séances » / « Réservations ».
- C4 « Nouvel exercice » créé dès le clic. → correctifs-exercices.
- C5 Composants en double (calendrier, courbe), AujourdhuiView provisoire et ~17 anciennes vues : nettoyage en un commit après validation.
