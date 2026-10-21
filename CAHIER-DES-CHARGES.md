# Cahier des charges — Corentin Delmée Coaching (app)

> Référence du projet. Brief validé par Corentin le 2026-10-20 (pas de re-validation demandée).
> Toute évolution de périmètre passe par `suivi.json` (décision) avant d'être faite.

## 1. Objectif
Une application de coaching **à moi** (PWA installable) qui remplace My PT Hub (52 €/mois)
pour 10-15 clients (domicile et salle), à **0 €/mois** : Vue 3 + Vite + Supabase gratuit (UE) + Netlify.

## 2. Contexte et contraintes
- Nom affiché : **« Corentin Delmée Coaching »**. Hébergement : Netlify, sous-domaine `*.netlify.app`.
- Projet indépendant du site `coaching-domicile`. Le site aura plus tard une page « L'app » qui
  renvoie vers l'adresse de l'app → l'app a sa **page d'accueil / d'installation** propre.
- Couleurs et typos dans des **variables CSS** (design tokens) faciles à aligner avec le site.
  Ne pas réutiliser les polices du site.
- **Mobile d'abord** (au pouce, gros éléments), puis ordinateur (surtout pour le coach).
- **Couche de données abstraite** : un adaptateur *local* (données factices, localStorage)
  fonctionne sans compte ; un adaptateur *Supabase* prend le relais dès que `.env` contient les clés
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Schéma SQL + règles RLS + procédure fournis.
- Données factices : 2-3 clients dont **Fabien Vincent** (programme 3 séances/semaine),
  80 exercices courants (sans vidéo, Corentin complète les liens).
- **Import / export JSON** propre et documenté des exercices, séances et programmes (pour une
  automatisation future par REX/Claude). Format versionné (`"format": "cdc-coaching/1"`).
- RGPD (données de santé : douleurs, poids, nutrition) : serveur UE, **consentement explicite**
  au premier lancement, page Confidentialité. Le `juriste-admin` liste les obligations sans
  déclarer « conforme ».
- Aucun secret dans Git. Pas de service payant. Aucune mise en ligne faite par REX.

## 3. Connexion
- Le coach crée le compte client dans son tableau de bord → génération d'un **identifiant**
  (ex. `fabien.vincent`) + **code** (6 caractères lisibles) à transmettre (bouton copier /
  partager / WhatsApp avec message pré-rempli).
- Le client reste connecté (session persistante). Il peut changer son code dans Profil.
- Lien magique par e-mail : option, seulement si simple avec Supabase (V1 : non obligatoire).
- Le coach se connecte avec son propre compte (rôle `coach`). Un client ne voit **que ses données**.
- Mode local : écran de connexion avec comptes de démo (client « fabien.vincent », coach).

## 4. App client

### 4.1 Dashboard (accueil)
- Pas ou peu de scroll sur un téléphone 390×844 ; lisible en un coup d'œil, très animé.
- Affiche : **aujourd'hui** (workout prévu / fait), **cette semaine** (x/N séances du programme),
  **prochaine séance de coaching** (jour, heure, lieu), **mon programme**, **questionnaires à
  remplir** (pastille).
- Menu qui s'ouvre avec une belle animation : 5-6 grandes rubriques
  (Accueil, Programme, Coaching, Questionnaires, Suivi, Profil).
- Comportement visible : s'il n'y a pas de séance de coaching prévue → carte « Aucune séance
  prévue — m'écrire » ; si tout est fait cette semaine → état « Semaine bouclée » célébré.

### 4.2 Page Coaching (transition carte → page, élément partagé)
- « Votre séance : **mardi 21 octobre, 18 h 30, à domicile** ».
- Boutons **Modifier** / **Annuler** → ouvrent WhatsApp avec message pré-rempli. Rappel visible :
  « Annulation gratuite jusqu'à 24 h avant ». Si < 24 h : avertissement avant d'ouvrir WhatsApp.
- Mot sympa du coach (texte libre saisi par le coach, sinon message par défaut).
- Bouton « M'envoyer un mot » (WhatsApp).
- « C'est votre **3e** séance du mois » ; nombre de séances de la semaine et du mois.
- Récap payé ce mois : nb séances réalisées × tarif du client (35 € domicile après crédit
  d'impôt, 50 € salle — tarif paramétrable par client par le coach). Séances annulées non comptées.
- Le coach saisit les séances à la main (date, heure, lieu, statut : prévue / faite / annulée).
  Synchro Google Agenda : plus tard.

### 4.3 Programme
- Titre : « Programme Fabien Vincent ». Calendrier en colonnes, **vue semaine par défaut**,
  bascule **vue mois**.
- Le programme contient N workouts/semaine (Workout 1, 2, 3…). Le client les place lui-même en
  les validant (« fait le jeudi »). Le coach peut aussi **fixer des jours**.
- Historique des semaines passées (lui et le coach).
- Deux modes : **répété** (mêmes workouts chaque semaine, le client progresse seul grâce au
  pré-remplissage) ou **par semaine** (workouts différents semaine 1, 2, 3…).
- Comportement visible : workouts non placés listés en « À faire cette semaine » ; workout fait
  = coche + date ; semaine en cours mise en avant.

### 4.4 Page Workout
- Overview complète qui défile : blocs, exercices (nom, vidéo, séries × répétitions/poids, repos),
  circuits (format + durée), consignes du coach. Bouton **Démarrer** toujours accessible.

### 4.5 Séance en cours — cœur de l'app, priorité absolue de qualité
- Un exercice plein écran à la fois : vidéo (lien YouTube, intégrée ou ouverte), séries, consignes.
- **Slide horizontal** vers l'exercice suivant, **automatique** quand toutes les séries sont
  validées (avec un court délai et la possibilité de rester). Swipe manuel possible.
- Toucher une série → elle **s'agrandit** (transition d'élément partagé) avec ses champs.
- Toucher une valeur → **grand sélecteur** (roue/glissement vertical, inertie, crans), gros
  chiffre + unité, « Valider » → retour animé à la série.
- « Valider la série » → **chrono de repos automatique** (anneau/compte à rebours, +15 s / passer).
- Série en temps de travail : « Lancer la série » → chrono de travail, **son à la fin**, puis repos
  automatique.
- Petit bouton latéral pour revoir l'**overview** de la séance à tout moment (tiroir).
- **Circuits** (AMRAP, EMOM, For Time, Time cap, Death by, Tabata, intervalles, superset) :
  1. écran d'explication (« AMRAP — objectif : faire le plus de tours possible en 12 min ») ;
  2. overview des exercices du circuit avec vidéos accessibles ;
  3. chrono plein écran adapté au format.
  Comportement visible par format :
  - **AMRAP** : compte à rebours de la durée, bouton « +1 tour » géant, compteur de tours ; à la fin
    saisie des répétitions en plus.
  - **EMOM** : minute en cours / total, compte à rebours de la minute, exercice de la minute.
  - **For Time** : chrono qui **monte** ; « Terminé » arrête ; si time cap atteint → fin avec « cap ».
  - **Time cap** : chrono qui monte jusqu'au cap affiché (le cap ne descend pas).
  - **Death by** : minute N = N répétitions ; « Échec » termine et enregistre la dernière minute réussie.
  - **Tabata** : 8 × (20 s travail / 10 s repos), tour x/8, phase en couleur.
  - **Intervalles** : travail/repos paramétrables × tours.
  - **Superset** : exercices A/B enchaînés, repos après le passage complet.
  - Le temps de **préparation** (compte à rebours 10 s) n'est jamais inclus dans le temps final.
- Fin : « **Bravo, séance terminée** » (récompense animée : durée, volume, séries, records) →
  « **Valider ma séance** » → poids et répétitions réalisés enregistrés dans le **template du
  client** : pré-remplis à la prochaine séance. Commentaire facultatif (alerte coach).
- **Wake Lock** (écran allumé), vibration si dispo, son (Web Audio). Fonctionne **hors connexion**
  (séance en cours sauvegardée localement, synchronisée au retour du réseau). Reprise si l'app est
  fermée en pleine séance.

### 4.6 Questionnaires
- Quotidiens, hebdo, ponctuels. Une question par écran, transitions, jamais barbant.
- Types : curseur 0-10, choix unique/multiple, émojis, nombre (avec unité), texte, photo.
- Modèles par défaut : **check-in quotidien** (sommeil, énergie, stress, douleur, faim, hydratation)
  et **hebdo** (poids, mensurations, bilan de la semaine).
- Signalés sur le dashboard ; fin = petite célébration.

### 4.7 Suivi
- Poids et mensurations : graphiques dans le temps.
- Nutrition selon modules activés par le coach pour chaque client : habitudes à cocher, photos de
  repas, check-in avec calories.
- **Carte du corps** des douleurs : zone + intensité 0-10, courbe par zone.
- Pas de photos de progression en V1.

### 4.8 Profil
- Infos, changer son code, préférences (son, vibration, unité), consentement, export de mes
  données (JSON), déconnexion.

### 4.9 Accueil / installation (public)
- Page propre : présentation, bouton **« Installer l'application »** (beforeinstallprompt ;
  instructions iOS « Partager → Sur l'écran d'accueil »), bouton « Se connecter ».

## 5. Champs des exercices (choisis par le coach pour chaque exercice dans une séance)
Poids (kg), répétitions, fourchette de répétitions, max de répétitions, poids du corps, RPE, tempo,
% du 1RM, temps de repos, temps de travail / durée, durée totale ; cardio : temps de travail,
résistance, niveau (facile/moyen/difficile), BPM, BPM max. **Champs personnalisés**. Pour chaque
champ : **modifiable par le client** oui/non.

## 6. Tableau de bord coach (une seule direction de design, propre et efficace)
- Clients : créer (identifiant + code générés), réglages par client (tarif, lieu par défaut,
  modules nutrition), archiver.
- Bibliothèque d'exercices (nom, description, lien vidéo, catégories) — 80 exercices de départ.
- Constructeur de séances par blocs (exercice, superset, circuit + format), champs par exercice.
- Programmes multi-semaines (modes répété / par semaine), jours fixés optionnels.
- Modèles à dupliquer d'un client à l'autre.
- Constructeur de questionnaires.
- Saisie des séances de coaching (date, heure, lieu, statut).
- Vue client : calendrier, séances faites, poids/charges réalisés, réponses aux questionnaires, courbes.
- **Alertes** : pas de check-in depuis 3 jours, douleur > 6, séance commentée.
- Import / export JSON.

## 7. Design — priorité de qualité n°1
- Effet waouh partout : transitions de pages, de sections, de rubriques ; éléments partagés
  (carte → page, série → détail, valeur → sélecteur) ; micro-animations sur chaque bouton,
  validation, chrono ; fin de séance qui récompense. Fluide sur téléphone (60 fps, transform/opacity).
- Mieux vaut moins de fonctions secondaires finies qu'une app plate.
- `prefers-reduced-motion` respecté (animations réduites, pas supprimées sans repère).
- Recherche d'inspiration sérieuse avant les maquettes (note : référence → ce qu'on reprend, pourquoi).
- Inspiration interne : `coaching-domicile/design-v2` M1, M2, surtout **M3** (transition
  « Quel est votre objectif » qui part de l'icône touchée). M4, M5 : non. Couleurs à revoir.
  Leçons de goût : anthracite plutôt que noir pur, titres moins gras, pas noir + orange.
- 4-5 maquettes de l'app client, chacune avec **sa propre identité** (polices, mise en page, style
  d'animation), transitions réelles, panneau accent/ambiance, page index comparative, captures et
  vidéos mobiles, revue des animations avant présentation. Une recommandée en provisoire.

### 7.1 Direction V2 (retours de Corentin du 21/10/2026 — référence : `RETOURS-MAQUETTES-V1.md`)
- **Base M5** (style, polices, mise en page, **menu et ses animations pour toute l'app**, page Coaching,
  Programme), enrichie de M1, M2, M4. **M3 abandonnée.**
- **Accent jaune** ; texte toujours foncé sur le jaune, jamais de jaune en texte sur fond clair (contraste vérifié partout).
- **Ambiances clair / sombre / bleu profond** (celles de M5), au choix du client dans son profil ; défaut : clair.
- **Séance** : une page entière par exercice ou par bloc (pas de cartes) ; lisibilité de M1 ; transitions de
  démarrage de M1 ; transitions entre exercices de M2 ; sélecteur glissant reps/charges de M1 **tel quel** ;
  étiquettes AMRAP/EMOM de M1 ; temps total de séance en haut (M4) ; effets rebondis légers (M4).
- **Timers** : décompte animé + petite phrase (« Respire », « Repos », « Tiens bon ») de M2, son de fin de M1,
  2-3 polices de chiffres à comparer (pas celle de M1).
- **Overview workout** : sections par bloc (A, B, C…) ; encart exercice retravaillé.
- **Circuits** : déroulé M2 (« Découvrir le circuit », option), détail et affichage de l'option/EMOM de M4,
  changement de couleur d'écran de M1 ; un circuit qui démarre ouvre une nouvelle section qui se referme à la fin.
- **Check-in** : modèle M2 (sons, chiffres qui passent dessus/dessous, humeur) avec les polices de M5 + animations du questionnaire M1.
- **Dashboard** : aplat jaune (texte foncé recommandé, blanc à comparer) ; message d'accueil à remplacer (2-3 versions).
- **Accessibilité** : mode « Grand affichage » dans le profil (textes, chiffres, boutons, chronos) ; zoom du
  téléphone jamais bloqué ; contrastes forts, zones à toucher larges.

## 8. Hors périmètre V1
Synchro Google Agenda, paiement en ligne, photos de progression, messagerie interne (WhatsApp à la
place), notifications push, publication sur les stores, nom de domaine.

## 9. Définition de « fini » (ce soir)
1. Maquettes comparables + une recommandée appliquée.
2. App client complète en mode local, au niveau d'animation de la maquette, séance en cours
   irréprochable ; PWA installable, séance hors connexion.
3. Tableau de bord coach fonctionnel en local.
4. Tests unitaires (logique métier pure) + tests navigateur mobile (playwright) verts ; audit
   sécurité (droits RLS) ; revue finale des animations.
5. `supabase/schema.sql` + `MISE-EN-ROUTE.md` (Supabase, clés, Netlify) ; `lancer.cmd`.
6. Tout commité ; ETAT.md et suivi à jour.

## 10. Journal
- 2026-10-21 — Retours de Corentin sur les 5 maquettes V1 (`RETOURS-MAQUETTES-V1.md`) : base M5 + M1/M2/M4,
  M3 abandonnée, accent jaune, 3 ambiances au choix, mode « Grand affichage » (→ §7.1). Bug signalé :
  récap de la semaine du Programme qui ouvre toujours le workout du jour.
