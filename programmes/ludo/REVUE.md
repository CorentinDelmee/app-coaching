# Revue experte indépendante — programme de Ludo (12 semaines)

> Relecteur : programmateur-musculation (pas l'auteur), le 2026-11-11. Fichiers relus : PROGRAMME.md, programme.json, notes.txt, gen.mjs, exercices-utilises.json, exercices-a-creer.json.
> Rien n'a été écrit dans l'app ; les fichiers de l'auteur ne sont pas modifiés.

## Verdict

La structure est solide et adaptée à un pratiquant avancé qui sèche : split H / Bq / Push / Pull / Bi, chaque muscle 2 fois par semaine, 3 blocs de 4 semaines avec une semaine allégée en 4e, double progression, polyarticulaires lourds en premier, machines de la salle bien utilisées (16 sur 19). **Le JSON est conforme au schéma de `creer_programme`** et reprend fidèlement la périodisation écrite (fourchettes de reps, RPE, drop sets S6-S7, changements d'exercices au bloc 3, cardio 10 → 12 → 15 min, fractionné 6 → 8 → 10 tours).
Trois points sont à corriger avant de l'envoyer à Ludo : la **durée réelle** (mardi et vendredi dépassent 70 min), la **consigne des semaines allégées** (impossible à respecter telle qu'elle est écrite) et le **décalage entre déficit et vitesse de perte** dans la nutrition.

---

## BLOQUANT (à corriger avant `creer_programme`)

### B1. Mardi et vendredi ne tiennent pas en 70 min : les durées sont sous-estimées
**Constat.** L'estimation de gen.mjs compte une série à 40 s (isolation) ou 45 s (principaux), quel que soit le tempo demandé, et 7 min d'échauffement avec 2 à 3 séries de montée en charge. Or les tempos du programme imposent des séries plus longues :
- isolation 12-15 reps en 2-0-1-1 = 4 s/rep → **~55 s** par série (et non 40 s) ;
- mollets 12-15 reps en 2-2-1-1 = 6 s/rep → **~80 s** par série ;
- squat 8-10 en 3-0-1-0 + sortie et rangement de la barre → ~50 s.
Ma propre estimation, avec ces hypothèses (échauffement 9 min ; série = reps moyennes × tempo + 10 s ; unilatéral ×2 + 15 s ; 30 s de transition dans un superset ; 90 s de changement de poste et de réglage ; +40 s par drop set ; cardio + 1 min d'installation) :

| Séance | Bloc 1 | Bloc 2 | Bloc 3 | Allégée | Auteur (B1/B2/B3) |
|---|---|---|---|---|---|
| Lundi Haut | 65 | 65 | 67 | 44-46 | 56 / 58 / 60 |
| **Mardi Bas quadri** | **76** | **74-75** | **74** | 52-54 | 62 / 64 / 62 |
| Mercredi Push | 65 | 65-67 | 66 | 47-49 | 54 / 57 / 56 |
| Jeudi Pull | 68 | 67-68 | 69 | 48-50 | 57 / 59 / 60 |
| **Vendredi Bas ischios** | **71** | **70** | **72** | 50-52 | 58 / 60 / 61 |

(Ce sont des estimations ; l'écart vient surtout des tempos et des réglages de machines.) Lundi, mercredi et jeudi tiennent ; mardi dépasse de 4 à 6 min, vendredi de 1 à 2 min, même sans attente aux machines.

**Correction proposée (dans gen.mjs, puis régénérer) :**
1. Mardi : **Hanging Leg Raises passe au lundi** dans un tri-set avec élévations latérales + curl (lundi → ~68-69 min). Mollets debout seuls au mardi : 3 séries, repos 45 s.
2. Mardi : repos du back squat **180 → 150 s** (les séries de montée en charge sont faites à l'échauffement ; 150 s suffit à 8-10 reps au RPE 8).
3. Mardi : cardio **10 min dans les 3 blocs** (marche inclinée après les jambes ; la dépense manquante est compensée par les pas). Résultat : mardi ≈ 68-69 min.
4. Vendredi : cardio **12 min au bloc 3** (comme le mardi) et repos du SDT roumain **150 → 135 s** → ≈ 68-69 min.
5. Mettre à jour le tableau du §5 et l'exemple minute par minute de PROGRAMME.md avec une méthode qui compte le tempo (sinon l'estimation ne veut rien dire puisqu'on impose le tempo).

### B2. Semaines allégées : « mêmes charges + mêmes reps + RPE 6 », c'est impossible
**Constat.** En S4, S8 et S12, le JSON garde la fourchette de reps du bloc (ex. S4 couché 2 × 8-10, S12 couché 2 × 5-7), met RPE 6 et écrit « mêmes charges que la semaine précédente, séries réduites, 3-4 reps en réserve ». Avec la charge de S3 (8-10 reps à RPE 8,5), refaire 8-10 reps donne encore RPE 8,5 environ : la consigne se contredit. Ludo verra « 8-10 reps, RPE 6 » et soit fera trop, soit ne saura pas quoi faire.
**Correction proposée (une seule règle, simple à lire) :** dans `exBloc`, pour `deload` :
- consigne : « SEMAINE ALLÉGÉE : charges −10 à −15 % par rapport à la semaine précédente, mêmes reps, 3-4 reps en réserve. » ;
- garder la fourchette de reps et RPE 6 (alors cohérents) ;
- aligner notes.txt (« Semaines allégées S4, S8, S12 : charges −10 à −15 %, environ 40 % de séries en moins, RPE 6 ») et le tableau du §3 de PROGRAMME.md.
(Autre solution possible : mêmes charges, mais reps = bas de fourchette − 3 ; je la trouve moins lisible pour le client.)

---

## IMPORTANT

### I1. Nutrition : le déficit ne correspond pas à la vitesse de perte annoncée
**Constat.** 300-500 kcal/j de déficit ≈ 0,25-0,45 kg/semaine, soit ~0,3-0,5 % du poids pour un homme de 85-95 kg (estimation : ~7 700 kcal par kg de masse grasse). Les notes annoncent 0,5-0,75 %/semaine, ce qui demande plutôt 500-750 kcal/j. Les deux chiffres ne vont pas ensemble.
**Correction proposée :** pour un pratiquant déjà sec qui veut « sécher un peu » en gardant son muscle, viser le bas : « Déficit modéré : environ 400 à 500 kcal sous ton maintien, pour perdre 0,4 à 0,6 % de ton poids par semaine. » Garder la règle d'ajustement (+150 kcal si perte > 1 %/semaine ou charges en chute) — elle est bonne.

### I2. Fêtes : les vendredis S6 et S7 tombent le 25/12 et le 01/01
**Constat.** Début lundi 16/11 → vendredi S6 = 25 décembre, vendredi S7 = 1er janvier (jours fériés, salle probablement fermée). La question 3 du §10 évoque Noël sans le dire précisément. Le vendredi porte le seul gros travail des ischios : le perdre deux semaines de suite casse le bloc 2.
**Correction proposée :** demander à Corentin les horaires de la salle les 24-26/12 et 31/12-02/01. Par défaut : séance du vendredi S6 et S7 avec `jour: "samedi"` (26/12 et 02/01). Si la salle est fermée tout le week-end : faire la séance « Bas ischios » le jeudi à la place du Pull ces deux semaines-là, et le Pull le samedi s'il le peut, sinon on le saute.

### I3. Le soulevé de terre « roumain » montre la vidéo d'un autre mouvement
**Constat.** L'exercice utilisé est « Barbell Stiff Legged Deadlifts » (vidéo « Stiff Legged Deadlift », description jambes tendues), et la consigne demande de l'exécuter en roumain. Le client verra une vidéo qui contredit la consigne. Dans la bibliothèque, « Romanian Deadlift ( Au baton ) » a bien une vidéo « Barbell RDL », mais son nom désigne l'exercice au bâton.
**Correction proposée :** créer une fiche « Soulevé de terre roumain barre » (nomAnglais « Barbell Romanian Deadlift ») dans exercices-a-creer.json, avec une vidéo d'un vrai RDL à la barre (validée par Corentin), et l'utiliser le vendredi. À défaut : garder le jambes tendues, mais écrire la consigne jambes tendues pour que la vidéo et le texte disent la même chose.

### I4. Le fractionné rameur du mercredi : la justification est fausse
**Constat.** Le §6 dit « jambes reposées depuis mardi ». C'est 24 h après squat, presse et bulgare, et le rameur sollicite surtout les jambes. Le choix reste défendable (pas de jambes jeudi, 48 h avant vendredi) mais l'argument n'est pas juste.
**Correction proposée :** reformuler : « Mercredi : 24 h après les jambes, mais rien de lourd pour les jambes le jeudi et 48 h avant le vendredi. Si les quadriceps sont encore très courbaturés, garde le même nombre de tours mais à RPE 7. » Ajouter cette option dans la consigne du circuit. En semaine allégée, prévoir 6 tours à RPE 7 (pas 8-9) pour que la semaine soit vraiment allégée.

### I5. Consigne des tractions peu claire pour le client
**Constat.** « Sinon tirage vertical machine en fin de série. » On ne comprend pas quand ni comment.
**Correction proposée :** « Si tu n'arrives plus à faire le bas de la fourchette proprement, finis la série au tirage vertical (Lat Pulldown), même nombre de reps. Au-delà du haut de la fourchette au poids du corps : ajoute un lest (ceinture ou haltère entre les pieds). »

### I6. gen.mjs ne peut plus être relancé
**Constat.** Le script lit `./ex.json` (export de la bibliothèque), absent du dossier. Toute correction de B1-B2 demande de le régénérer.
**Correction proposée :** rajouter l'export de la bibliothèque (`lister_exercices`, sans donnée client) dans `ex.json`, ou bien faire lire au script `exercices-utilises.json` pour vérifier les noms. Profiter de la régénération pour supprimer le ternaire sans effet du calcul de `series` (ligne `b === 2 && e.role === 'I' && inSS ... ? e.series : e.series`).

---

## CONFORT

- **C1. « Au moins 48 h entre deux séances du même muscle »** n'est pas vrai pour les deltoïdes latéraux (poulie le mercredi, haltères le jeudi = 24 h). Sans risque pour un petit muscle peu fatigable, mais à reformuler : « ≥ 48 h entre deux séances lourdes ; les deltoïdes latéraux font exception (isolation légère, 3×/semaine). »
- **C2. Bloc 3 « repos isolation −15 s »** : le code baisse en fait tous les repos de superset (y compris développé haltères + seal row et dips) et ceux des secondaires (120 → 105 s, 90 → 75 s). Soit écrire « repos −15 s sur les secondaires et l'isolation », soit limiter le code à l'isolation.
- **C3. S1 « 3 reps en réserve »** (PROGRAMME.md) contre « 2-3 reps en réserve » (notes.txt) : choisir un seul chiffre (3, cohérent avec RPE 7).
- **C4. Superset développé haltères + seal row** (lundi) : il faut deux bancs réglés différemment (80° et incliné bas) en même temps. Ajouter dans la consigne : « si un seul banc est libre, fais les 2 exercices à la suite, repos 90 s ». Idem élévations latérales à la poulie + pec-deck (machines éloignées ?).
- **C5. Stairmaster le jeudi** veille du SDT roumain + hip thrust : rester strictement en zone 2 (ajouter « sans brûlure dans les fessiers » à la consigne), ou mettre la marche inclinée le jeudi et le Stairmaster le lundi.
- **C6. Volume** : cohérent pour un avancé en déficit (≈ 105 séries dures par semaine, dos 17, quadriceps 16, ischios 10, pecs 11 en direct + dips). Les pecs sont le groupe le moins chargé en direct ; si Ludo veut prioriser le haut des pecs, ajouter 1 série à la presse inclinée au bloc 1 plutôt qu'un exercice de plus. Pas obligatoire.
- **C7. Noms en anglais affichés au client** (Barbell Bench Press, Pull Ups…) et **faute dans la bibliothèque** : « Abs Weel » → « Abs Wheel » (ou « Roue abdominale »). À faire par Corentin (`modifier_exercice`), car c'est la bibliothèque commune.
- **C8. Bilan S12** : ajouter dans la consigne du lundi S12 un test simple et sans risque, par exemple « 1 série au couché et au tirage vertical à la charge de S11, reps max à RPE 9 », pour mesurer les progrès en plus des photos et mensurations.
- **C9. Créatine (facultatif)** : 3-5 g/j de créatine monohydrate est le complément le mieux étudié pour garder force et muscle en sèche ; à proposer seulement si Corentin le conseille d'habitude.

---

## Vérifications faites (OK)

- **Schéma `creer_programme`** : clés de premier niveau (`client`, `nom`, `debut`, `notes`, `semaines`) autorisées ; 12 semaines × 5 séances ; blocs `exercice` / `superset` (2 exercices) / `circuit` (`format: "intervalles"`, `tours`, `travail`, `repos`) conformes ; `reps` au format « 8-10 » ou entier ; tempos au bon format ; RPE entre 6 et 9,5 ; aucune consigne d'exercice ≥ 500 caractères (aucune coupée), consignes de séance < 1 000 ; notes 3 453 caractères (< 5 000) ; cardio LISS = `series 1, reps 0, tempsTravail` (usage prévu par le schéma). `debut` 2026-11-16 est bien un lundi.
- **Le JSON reflète la périodisation** : B1 8-10 / 10-12 / 12-15, B2 6-8 / 8-10 / 10-12, B3 5-7 / 8-10 / 12-15 ; RPE 7 → 8 → 8,5 puis 8 → 8,5 → 9 (isolation +0,5) ; drop sets seulement en S6-S7 sur les exercices prévus ; exercices remplacés à partir de S9 ; séries des semaines allégées 4 → 2 et 3 → 2 (−37 % du volume de la semaine, cohérent avec « ~40 % »).
- **Fréquence et récupération** : chaque muscle 2×/semaine, couché lundi / presse inclinée mercredi (48 h), dos lundi / jeudi (72 h), jambes mardi / vendredi (72 h), lombaires chargées seulement mardi (squat) et vendredi (SDT) ; seal row et tirages en appui = peu de fatigue lombaire.
- **Ordre des exercices** : polyarticulaires lourds en premier partout, isolation en superset ensuite (antagonistes ou muscles non concurrents).
- **Cardio** : LISS en zone 2 en fin de séance + un seul fractionné court, pas quotidiens 8 000 → 10 000 : bon choix pour sécher sans gêner la récupération.
- **Nutrition** (hors I1) : protéines 2-2,4 g/kg, lipides ≥ 0,8 g/kg, suivi par moyenne hebdomadaire, ajustements par 150 kcal, pause de régime possible en S8 : repères justes et prudents.
- **Français** : pas de faute relevée dans les consignes et les notes (hormis « Abs Weel », qui vient de la bibliothèque).
