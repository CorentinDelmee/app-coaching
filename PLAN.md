# PLAN — Corentin Delmée Coaching (app)

> Référence : `CAHIER-DES-CHARGES.md` (CDC). Ce plan le découpe en lots ; il n'ajoute aucune fonctionnalité.
> Mode absent : choix techniques notés dans `DECISIONS.md`.

## Stack
**Vue 3 + Vite + vue-router + vite-plugin-pwa + Vitest, @supabase/supabase-js, GSAP, graphiques en SVG maison** :
Vue est connu de Corentin, c'est la stack éprouvée de `minuteur-intervalles` (PWA, moteur pur testable),
Supabase gratuit en UE derrière un adaptateur, GSAP pour le niveau d'animation exigé, aucun serveur payant.
Tests navigateur : playwright-cli (ou Chrome headless piloté par CDP en secours).

## Conventions communes à tous les lots
- **Logique métier = fonctions pures** dans `src/domain/` et `src/engine/`, sans Vue ni DOM, horloge
  injectée (`now` en paramètre, jamais `Date.now()` dans le moteur). Testées par Vitest dans `tests/unit/`.
- **Toute lecture/écriture passe par `src/data/`** (interface unique) ; les vues n'importent jamais
  `localStorage` ni Supabase directement.
- Dates : jours en `AAAA-MM-JJ` heure locale (Europe/Paris), semaine du **lundi au dimanche**, poids stockés en kg.
- Textes de l'interface en français, nombres au format FR (`12,5 kg`, `18 h 30`).
- **Lots UI** : avant de coder, **lire `design/RECOMMANDATION.md` et le `DESIGN.md` de la maquette retenue**
  (et appliquer : `DESIGN.md` > skill `impeccable` > `animate`/`mobile-native` > `gsap-*`). Aucun choix
  esthétique n'est figé dans ce plan : il décrit le comportement, la maquette décrit l'apparence.
- Animations : `transform`/`opacity` uniquement, 60 fps sur téléphone ; `prefers-reduced-motion` = fondus courts
  à la place des déplacements (jamais de changement d'écran sans repère visuel).
- Viewport de référence : **390 × 844** (téléphone) ; coach : 1280 × 800.
- Git : un commit par tâche testée, `git add` de chemins précis, **jamais d'amend**, jamais de push.
- Serveurs de dev : un port par agent (5173 dev principal, 5180+ pour les testeurs), arrêt par PID uniquement.

---

## Lot 1 — Données, modèle et moteur (sans interface)
**Objectif** : toute la logique de l'app existe, testée, avant le premier écran. Design-indépendant.
**Dépendances** : squelette (fait). **Parallélisable** avec la création des maquettes (déjà en cours).

### Tâches
- [x] **1.1 Modèle** (`src/domain/modele.js`, JSDoc) : `Profil` (rôle `coach|client`, identifiant, nom, tarif €,
  lieu par défaut `domicile|salle`, modules nutrition `{habitudes, photosRepas, calories}`, archivé, préférences
  son/vibration/unité, consentement daté), `Exercice` (nom, description, lienVideo, catégories), `Workout`
  (blocs : `exercice` | `superset` | `circuit{format, params}` ; chaque exercice a ses séries et ses **champs**
  CDC §5 avec `modifiableParClient`), `Programme` (mode `repete|parSemaine`, date de début, semaines, workouts/semaine,
  jours fixés optionnels), `Realisation` (workout fait : date, semaine, valeurs réalisées, durée, volume, commentaire),
  `TemplateClient` (dernières valeurs par workout/exercice/série), `SeanceCoaching` (date, heure, lieu,
  statut `prevue|faite|annulee`, tarif figé à la création), `MotDuCoach`, `Questionnaire` (modèle : fréquence
  `quotidien|hebdo|ponctuel`, questions typées), `Reponse`, `Mesure` (poids, mensurations), `Douleur` (zone, intensité 0-10),
  `EntreeNutrition`, `AlerteVue`.
  - *Acceptation* : un test valide les données factices contre le modèle (fonction `valider*` par entité :
    champ manquant → message d'erreur lisible nommant l'entité et le champ).
- [x] **1.2 Interface de données** (`src/data/index.js`) : choisit l'adaptateur — Supabase si `VITE_SUPABASE_URL`
  et `VITE_SUPABASE_ANON_KEY` sont présentes, sinon local. Expose `mode` (`'local'|'supabase'`) et des méthodes
  par entité (lister / lire / créer / modifier / archiver) + session (`connecter`, `deconnecter`, `utilisateurCourant`, `changerCode`).
  - *Acceptation* : sans `.env`, `mode === 'local'` ; une suite de **tests de contrat** (mêmes tests pour tout adaptateur)
    passe sur l'adaptateur local.
- [x] **1.3 Adaptateur local** (`src/data/adapters/local.js`) : `localStorage` (clé versionnée `cdc-coaching/1`),
  initialisé avec les données factices au premier lancement ; bouton « réinitialiser la démo » prévu côté API.
  Stockage plein → erreur typée `STOCKAGE_PLEIN` (l'UI affichera « Stockage plein sur cet appareil — non enregistré »).
  - *Acceptation* : tests de contrat verts ; données persistées entre deux instanciations ; quota simulé → `STOCKAGE_PLEIN`.
- [x] **1.4 Données factices** (`src/data/demo/`) : coach Corentin ; **Fabien Vincent** (`fabien.vincent`, domicile 35 €,
  programme répété **3 workouts/semaine** commencé il y a 3 semaines, historique réaliste, séances de coaching passées et
  1 à venir, check-ins des derniers jours dont une douleur à 7 → alerte) ; 2 autres clients (une en salle à 50 €, mode
  `parSemaine` 4 semaines ; un sans séance prévue et sans check-in depuis 4 jours → alerte) ; **80 exercices FR courants**
  sans vidéo (catégories : jambes, poussée, tirage, gainage, cardio, mobilité…) ; au moins 1 workout contenant chaque format
  de circuit et une série en temps de travail ; questionnaires par défaut **check-in quotidien** (sommeil, énergie, stress,
  douleur, faim, hydratation) et **hebdo** (poids, mensurations, bilan) avec tous les types de question.
  Dates factices **relatives à aujourd'hui** (générées au premier lancement) pour que la démo reste vivante.
  - *Acceptation* : test : 80 exercices aux noms uniques, Fabien a 3 workouts/semaine, chaque format de circuit est présent,
    les deux questionnaires couvrent les 7 types (curseur, choix unique, multiple, émojis, nombre+unité, texte, photo).
- [x] **1.5 Adaptateur Supabase** (`src/data/adapters/supabase.js`) : mêmes méthodes, inactif sans `.env`. Connexion client
  = identifiant converti en e-mail technique `identifiant@clients.cdc-coaching.invalid` + code comme mot de passe.
  Création de client par le coach via un 2e client Supabase **sans persistance de session** (`signUp`) puis insertion du profil.
  - *Acceptation* : aucun import de Supabase n'est exécuté en mode local (test) ; l'adaptateur expose exactement les mêmes
    méthodes que le local (test de comparaison des clés) ; aucune clé dans le code.
- [x] **1.6 `supabase/schema.sql`** : tables du modèle, `profiles.role`, **RLS activée sur toutes les tables** :
  un client ne lit/écrit que les lignes où `client_id = auth.uid()` (et ne lit pas les autres profils) ; le coach lit/écrit
  les lignes de ses clients ; bibliothèque d'exercices lisible par tous les connectés, modifiable par le coach seul ;
  le client ne peut pas modifier son tarif, son rôle ni ses modules. Bucket Storage privé pour les photos, mêmes règles.
  - *Acceptation* : le fichier s'exécute sans erreur dans l'ordre (vérifiable par lecture : `create table` avant `policy`) ;
    chaque table a `enable row level security` et au moins une policy (test Vitest qui parse le fichier et le vérifie).
- [x] **1.7 Moteur de séance** (`src/engine/seance.js`) — réducteur pur `(etat, action, now) → etat` :
  démarrer (pré-remplissage depuis le template client, sinon valeurs prescrites), modifier une valeur (refusée si champ non
  modifiable), valider la série → repos automatique (durée prescrite), `+15 s`, passer le repos, lancer une série en temps de
  travail → fin = signal `son` + enchaînement du repos, série suivante / exercice suivant (signal `avancerAuto` après validation
  de la dernière série, annulable « rester »), aller à un exercice (swipe), reprise après fermeture (état sérialisable),
  terminer → résumé (durée totale, volume = Σ poids × reps, séries faites, **records** = meilleure charge par exercice battue).
  - *Acceptation* : tests avec horloge simulée : repos de 90 s à t+89 s affiche 1 s, à t+90 s terminé ; `+15 s` prolonge ;
    reprise d'un état sérialisé à t+40 s donne le même affichage ; exercice sans valeur prescrite ni historique → champs vides.
- [x] **1.8 Moteur de circuits** (`src/engine/circuits.js`) — `etatChrono(format, params, evenements, now)` :
  préparation 10 s **jamais comptée** dans le temps final ; **AMRAP** (décompte, `+1 tour`, tours, reps en plus à la fin) ;
  **EMOM** (minute x/total, décompte de la minute, exercice de la minute) ; **For Time** (chrono montant, `Terminé`, cap → fin
  « cap ») ; **Time cap** (chrono montant jusqu'au cap, le cap affiché reste fixe) ; **Death by** (minute N = N reps, `Échec` →
  résultat = dernière minute réussie) ; **Tabata** (8 × 20/10, tour x/8, phase) ; **Intervalles** (travail/repos/tours paramétrables) ;
  **Superset** (A/B enchaînés, repos après le passage complet). Chaque transition de phase émet un signal (son/vibration).
  - *Acceptation* : un test par format et par cas limite : For Time terminé à 4:32 après 10 s de préparation → résultat 4:32 ;
    For Time cap 12:00 atteint → résultat « cap 12:00 » ; Death by échec en minute 7 → « 6 minutes » ; Tabata à t = 10 + 25 s →
    tour 1/8 phase repos reste 5 s ; EMOM 10 min à t = 10 + 61 s → minute 2/10 reste 59 s ; pause/reprise ne fait pas dériver.
- [x] **1.9 Enregistrement de la séance** (`src/domain/realisations.js`) : valider une séance → crée la `Realisation`, met à jour le
  `TemplateClient` (seules les valeurs réellement saisies), place le workout au jour réalisé dans le programme, crée une alerte
  si commentaire. Séance faite hors connexion → file d'attente locale rejouée plus tard (pure : `fusionnerFile`).
  - *Acceptation* : après validation de Workout 1 à 60 kg, la séance suivante de Workout 1 démarre pré-remplie à 60 kg ;
    rejouer deux fois la même file n'enregistre qu'une réalisation (identifiant unique).
- [x] **1.10 Calendrier et programme** (`src/domain/programme.js`) : semaine courante du programme, workouts de la semaine
  (mode répété / par semaine), placés vs « À faire cette semaine », x/N, jours fixés, semaine bouclée, historique des semaines.
  Au-delà de la dernière semaine d'un programme `parSemaine` → état `termine`.
  - *Acceptation* : tests : 2 workouts faits sur 3 → « 2/3 », 3/3 → `semaineBouclee: true` ; programme 4 semaines en semaine 5 → `termine`.
- [x] **1.11 Calculs coaching** (`src/domain/coaching.js`) : prochaine séance (statut `prevue`, à venir), **rang dans le mois**
  (séances non annulées du mois calendaire, triées par date/heure), nb séances semaine/mois, **payé ce mois** = Σ tarifs des séances
  `faite` du mois (annulées et prévues exclues), délai avant séance (`moinsDe24h`), messages WhatsApp pré-remplis (lien `wa.me` encodé).
  - *Acceptation* : 3 séances non annulées en octobre (dont une annulée en plus) → la 3e affiche rang 3 ; 2 faites à 35 € → 70 € ;
    séance dans 23 h → `moinsDe24h: true` ; aucune séance prévue → `null`.
- [x] **1.12 Alertes coach** (`src/domain/alertes.js`) : pas de check-in quotidien depuis **3 jours** (ou jamais, si client créé il y a
  plus de 3 jours), **douleur > 6** (check-in ou carte du corps, 7 derniers jours), **séance commentée** ; une alerte marquée vue ne revient pas.
  - *Acceptation* : tests : dernier check-in il y a 3 jours → alerte, il y a 2 jours → non ; douleur 6 → non, 7 → oui ; client archivé → aucune alerte.
- [x] **1.13 Identifiants** (`src/domain/identifiants.js`) : `prenom.nom` sans accents ni espaces, suffixe `-2` si déjà pris ;
  code de **6 caractères lisibles** (sans 0/O/1/I/L), aléatoire via `crypto.getRandomValues`.
  - *Acceptation* : « Fabien Vincent » → `fabien.vincent`, « Élodie D'Arc » → `elodie.darc` ; 1000 codes générés : longueur 6, alphabet respecté.
- [x] **1.14 Import / export JSON** (`src/domain/echange.js` + `docs/FORMAT-JSON.md`) : `{ "format": "cdc-coaching/1", "exporteLe", "exercices", "workouts", "programmes" }`
  (+ export « mes données » côté client). Import : validation complète avant écriture, rapport « 12 exercices ajoutés, 3 mis à jour, 1 rejeté (raison) ».
  - *Acceptation* : export puis import = données identiques (test aller-retour) ; format absent ou `cdc-coaching/2` → refus avec message
    « Format non reconnu (attendu cdc-coaching/1) » ; document de format avec un exemple complet.

**Critères du lot** : `npx vitest run` vert ; `npm run build` vert ; l'app affiche toujours le squelette.

---

## Lot 2 — Séance en cours (priorité absolue de qualité) `[DESIGN]`
**Objectif** : la séance complète sur téléphone, irréprochable, y compris circuits et fin de séance.
**Dépendances** : lot 1 + maquette retenue. Lire `design/RECOMMANDATION.md` et le `DESIGN.md` de la maquette retenue.

### Tâches
- [x] **2.1 Fondations UI** : tokens CSS du `DESIGN.md` dans `src/styles/tokens.css` (couleurs, typo, espacements, rayons, durées,
  courbes) ; **polices auto-hébergées** (`src/assets/fonts/`, woff2, précachées) ; utilitaires GSAP (`src/anim/`) et transitions de
  route ; en mode local, session de démo Fabien automatique tant que la connexion (lot 9) n'existe pas. Route `/seance/:workoutId`.
  - *Acceptation* : en mode avion après un premier chargement, les polices s'affichent (pas de police système de secours) ; aucune couleur
    en dur hors `tokens.css` (grep).
- [x] **2.2 Exercice plein écran** : nom, vidéo (YouTube intégré `youtube-nocookie`, ou bouton « Ouvrir la vidéo »), séries, consignes.
  Pas de lien → « Vidéo bientôt disponible » discret ; hors connexion → « Vidéo indisponible hors connexion ».
- [x] **2.3 Slide horizontal** : swipe manuel entre exercices ; après la dernière série validée → bandeau « Exercice suivant dans 3 s — Rester »
  puis slide automatique ; indicateur de progression (exercice x/N).
- [x] **2.4 Série → détail** (élément partagé) : toucher une série l'agrandit avec ses champs ; champ non modifiable affiché verrouillé
  (« fixé par le coach »).
- [x] **2.5 Grand sélecteur** : roue verticale avec inertie et crans (pas selon le champ : 0,5 kg / 1 rep / 5 s), gros chiffre + unité
  (kg ou lb selon préférence), « Valider » → retour animé ; bornes (pas de valeur négative).
- [x] **2.6 Repos automatique** : anneau + décompte, `+15 s`, « Passer » ; son + vibration à la fin ; séries en temps de travail :
  « Lancer la série » → chrono de travail → son → repos.
- [x] **2.7 Tiroir overview** : bouton latéral, liste de la séance avec séries faites cochées ; toucher un exercice y va.
- [x] **2.8 Circuits** : écran d'explication (« AMRAP — objectif : faire le plus de tours possible en 12 min »), overview du circuit avec
  vidéos, préparation 10 s, chrono plein écran par format (comportements CDC §4.5 via le moteur 1.8), saisie de fin (reps en plus, etc.).
- [x] **2.9 Fin de séance** : « Bravo, séance terminée » animé (durée, volume, séries, records — « Aucun record cette fois » si aucun),
  commentaire facultatif, « Valider ma séance » → enregistrement (1.9) → retour.
- [x] **2.10 Robustesse** : Wake Lock (réacquis au retour sur l'onglet), vibration si dispo, sons Web Audio (débloqués au premier toucher),
  état sauvegardé à chaque action ; rouvrir l'app → « Reprendre votre séance en cours ? Reprendre / Abandonner ».

**Critères d'acceptation (test navigateur 390×844, temps accéléré)** : une séance de Fabien jouée de bout en bout (séries, repos, un
circuit de chaque format) ; après validation, la séance suivante est pré-remplie ; fermeture en plein repos puis réouverture → reprise au bon
temps ; For Time affiche un chrono qui monte et le temps final exclut les 10 s de préparation ; Time cap : le cap affiché ne change pas ;
`prefers-reduced-motion` → fondus, aucune glissade ; 60 fps sur les transitions (trace de performance sans tâche longue > 50 ms).

---

## Lot 3 — Page Workout `[DESIGN]`
**Dépendances** : lot 2. Lire `design/RECOMMANDATION.md` et le `DESIGN.md` retenu.
- [ ] Overview qui défile : blocs, exercices (nom, vidéo, séries × reps/poids — valeurs pré-remplies du client si elles existent —, repos),
  circuits (format + durée), consignes du coach ; bouton **Démarrer** toujours visible (collant) → transition vers la séance.
- [ ] Workout déjà fait aujourd'hui → mention « Fait aujourd'hui » et bouton « Refaire ». Séance en cours non terminée → bouton « Reprendre ».
- *Acceptation* : à 390×844, Démarrer reste visible en bas pendant tout le défilement ; un workout sans consigne n'affiche pas de bloc vide.

## Lot 4 — Programme / calendrier `[DESIGN]`
**Dépendances** : lot 3.
- [ ] « Programme Fabien Vincent », colonnes **semaine** par défaut, bascule **mois** animée ; semaine en cours mise en avant ; navigation semaines passées (historique).
- [ ] « À faire cette semaine » : workouts non placés ; workout fait = coche + jour (« fait le jeudi ») ; jours fixés par le coach affichés comme tels.
- [ ] Mode par semaine : workouts de la semaine N ; programme terminé → « Programme terminé — votre coach prépare la suite ».
- *Acceptation* : faire un workout un jeudi le fait apparaître coché dans la colonne jeudi et disparaître de « À faire » ; semaine sans programme → « Pas de programme cette semaine ».

## Lot 5 — Dashboard + menu `[DESIGN]`
**Dépendances** : lot 4.
- [ ] Dashboard sans (ou presque) scroll à 390×844 : aujourd'hui (workout prévu/fait), cette semaine x/N, prochaine séance de coaching, mon programme,
  questionnaires à remplir (pastille avec le nombre).
- [ ] Cas visibles : aucune séance prévue → « Aucune séance prévue — m'écrire » (WhatsApp) ; semaine complète → état « Semaine bouclée » célébré ; aucun questionnaire → pas de pastille.
- [ ] Menu animé à 6 rubriques (Accueil, Programme, Coaching, Questionnaires, Suivi, Profil) ; rubriques pas encore livrées → écran « Bientôt ».
- *Acceptation* : capture 390×844 sans barre de défilement (ou < 1 écran) ; le menu s'ouvre/ferme au clavier et au toucher ; Échap le ferme.

## Lot 6 — Page Coaching `[DESIGN]` — parallélisable avec 7 et 8 (worktrees séparés)
**Dépendances** : lot 5.
- [ ] Transition carte du dashboard → page (élément partagé). « Votre séance : mardi 21 octobre, 18 h 30, à domicile ».
- [ ] Modifier / Annuler → WhatsApp pré-rempli ; rappel « Annulation gratuite jusqu'à 24 h avant » ; à moins de 24 h → avertissement
  « Moins de 24 h avant la séance : elle pourra être due. Continuer ? » avant d'ouvrir WhatsApp.
- [ ] Mot du coach (sinon message par défaut), « M'envoyer un mot », « C'est votre 3e séance du mois », séances semaine/mois, récap « Payé ce mois : 2 × 35 € = 70 € ».
- *Acceptation* : aucune séance → même carte « Aucune séance prévue — m'écrire » ; « 1re séance du mois » (pas « 1e ») ; mois sans séance faite → « Payé ce mois : 0 € ».

## Lot 7 — Questionnaires `[DESIGN]` — parallélisable
**Dépendances** : lot 5.
- [ ] Liste (quotidien / hebdo / ponctuel, à faire vs faits) ; une question par écran avec transitions ; 7 types de question ; photo compressée (≤ 1280 px).
- [ ] Fin = petite célébration ; réponse douleur > 6 → alerte coach (1.12). Questionnaire déjà rempli aujourd'hui → « Déjà fait aujourd'hui ».
- *Acceptation* : la pastille du dashboard baisse après envoi ; quitter au milieu puis revenir reprend à la question en cours ; stockage plein → message, pas de perte silencieuse.

## Lot 8 — Suivi + carte du corps `[DESIGN]` — parallélisable
**Dépendances** : lot 5.
- [ ] Graphiques SVG maison : poids et mensurations dans le temps ; une seule mesure → point unique + « Ajoutez une 2e mesure pour voir la courbe ».
- [ ] Nutrition selon modules du client : habitudes à cocher, photos de repas, check-in calories ; aucun module → rubrique masquée.
- [ ] Carte du corps (face/dos) : toucher une zone → intensité 0-10 → courbe par zone ; > 6 → alerte coach.
- *Acceptation* : graphiques lisibles à 390 px, valeurs accessibles (texte alternatif / tableau) ; zone sans donnée → « Aucune douleur notée ».

## Lot 9 — Profil, connexion, accueil/installation, PWA hors connexion `[DESIGN]`
**Dépendances** : lots 2 à 8 (remplace la session de démo automatique).
- [ ] Accueil public `/bienvenue` : présentation, « Installer l'application » (`beforeinstallprompt` ; iOS → instructions « Partager → Sur l'écran
  d'accueil » ; déjà installée → bouton masqué), « Se connecter ».
- [ ] Connexion identifiant + code, session persistante ; mode local → comptes de démo (fabien.vincent, coach) affichés ; erreur → « Identifiant ou code incorrect ».
- [ ] **Consentement explicite** au premier lancement (données de santé) ; refus → pas d'accès aux rubriques santé, explication ; page Confidentialité.
- [ ] Profil : infos, changer son code (6 caractères min, confirmation), préférences son/vibration/unité, consentement, export de mes données (JSON), déconnexion.
- [ ] PWA : manifeste + icônes (192/512/maskable), précache complet, séance faisable en mode avion, file d'attente synchronisée au retour du réseau
  avec indicateur « Hors connexion — enregistré sur l'appareil ».
- *Acceptation* : Lighthouse PWA installable ; en mode avion après une visite, ouvrir l'app → dashboard + séance jouable + validée, puis synchronisée au retour réseau.

## Lot 10 — Tableau de bord coach `[DESIGN]` (une seule direction, propre et efficace, ordinateur d'abord)
**Dépendances** : lot 1 + lot 9 (connexion coach). Les pages coach peuvent démarrer en parallèle des lots 6-8 (worktree séparé).
- [x] Clients : créer (identifiant + code générés, boutons copier / partager / WhatsApp pré-rempli), réglages (tarif, lieu, modules nutrition), archiver.
- [x] Bibliothèque d'exercices (recherche, catégories, lien vidéo) ; constructeur de séances par blocs (exercice / superset / circuit + format) et champs par exercice
  (modifiable par le client oui/non, champs personnalisés) ; programmes multi-semaines (répété / par semaine, jours fixés) ; dupliquer un modèle vers un autre client.
- [x] Constructeur de questionnaires ; saisie des séances de coaching (date, heure, lieu, statut, tarif pré-rempli) ; mot du coach.
- [x] Vue client : calendrier, séances faites, charges réalisées, réponses, courbes ; **alertes** (liste, « marquer vu ») ; import / export JSON avec rapport.
- *Acceptation* : un client créé par le coach peut se connecter avec l'identifiant/le code affichés (mode local) et voit le programme assigné ; un client ne
  peut pas ouvrir `/coach` (redirigé vers son dashboard).

## Lot 11 — Vérification finale
**Dépendances** : lots 1 à 10.
- [ ] `testeur` : parcours playwright mobile 390×844 (client) et 1280×800 (coach), mode avion, temps accéléré ; corrections par le `developpeur`.
- [ ] `auditeur-securite` : RLS de `schema.sql` (un client ne voit que ses données), secrets, dépendances, en-têtes `_headers`.
- [ ] Revue des animations (skill `review-animations`) + `performance-accessibilite` (contrastes, clavier, reduced-motion).
- *Acceptation* : rapports sans point bloquant ouvert ; `npx vitest run` et `npm run build` verts.

## Lot 12 — Mise en route
**Dépendances** : lot 11.
- [ ] `MISE-EN-ROUTE.md` : créer le projet Supabase (région UE), exécuter `schema.sql`, désactiver la confirmation e-mail, créer le compte coach,
  remplir `.env`, build, Netlify Drop (`dist/`), variables d'environnement ; `lancer.cmd` vérifié ; tâches humaines ajoutées au suivi.
- *Acceptation* : un lecteur qui suit le document pas à pas n'a besoin d'aucune autre information (relu par `relecteur`).

---

## Idées à proposer à Corentin (non planifiées)
- Bouton « réinitialiser la démo » visible dans le profil en mode local (utile pour les tests et les démonstrations à un prospect).
- Rappel visuel sur le dashboard le jour d'une séance de coaching (« C'est aujourd'hui, 18 h 30 »).
