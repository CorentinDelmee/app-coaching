# Format d'échange JSON — `cdc-coaching/1`

Ce format sert à importer / exporter la bibliothèque d'exercices, les séances (workouts) et les programmes
(par le coach dans le tableau de bord, ou par un script / REX / Claude). Il est versionné : un document dont
`format` n'est pas exactement `cdc-coaching/1` est refusé avec « Format non reconnu (attendu cdc-coaching/1) ».

## Règles
- Le document est **entièrement validé avant toute écriture** ; ce qui est invalide est rejeté avec sa raison,
  le reste est importé. Le rapport ressemble à : `Exercices : 12 ajoutés, 3 mis à jour, 1 rejeté (Exercice : le champ « nom » est obligatoire)`.
- **Exercices** : rapprochés par `id`, sinon par `nom` (sans tenir compte de la casse). Sans `id`, il est créé (`ex-` + nom simplifié).
- **Séances** : chaque `exerciceId` cité doit exister (dans le document ou déjà en base). Chaque bloc a un `id` unique dans la séance.
- **Programmes** : chaque séance citée doit exister (dans le document ou déjà en base).
- Dates `AAAA-MM-JJ`, poids en kg, temps en secondes, jours fixés `0` = lundi … `6` = dimanche.
- Un champ d'exercice (`champs`) dit ce que le client voit et s'il peut le modifier (`modifiableParClient`).
  Clés disponibles : `poids`, `reps`, `fourchetteReps`, `repsAuMax`, `poidsDuCorps`, `rpe`, `tempo`, `pourcent1rm`, `repos`,
  `tempsTravail`, `dureeTotale`, `resistance`, `niveau`, `bpm`, `bpmMax`, ou un champ personnalisé `perso:nom`.
- Formats de circuit : `amrap` (`duree` s), `emom` (`minutes`, `exercices`), `fortime` (`cap` s facultatif), `timecap` (`cap` s),
  `deathby`, `tabata`, `intervalles` (`tours`, `travail`, `repos`), `superset` (`exercices`, `tours`, `repos`). `preparation` (10 s par défaut) est modifiable.

## Structure
```
{ "format": "cdc-coaching/1", "exporteLe": "<date ISO>", "exercices": [...], "workouts": [...], "programmes": [...] }
```
Chaque liste est facultative. L'export « mes données » du client ajoute `"type": "donnees-client"`, son profil, ses réalisations, réponses, mesures, etc.

## Exemple complet
```json
{
  "format": "cdc-coaching/1",
  "exporteLe": "2026-10-20T08:00:00.000Z",
  "exercices": [
    { "id": "ex-squat", "nom": "Squat", "description": "Descendre les hanches en arrière, dos droit.", "lienVideo": "https://www.youtube.com/watch?v=exemple", "categories": ["jambes"] },
    { "id": "ex-pompes", "nom": "Pompes", "description": "Corps gainé, poitrine vers le sol.", "lienVideo": null, "categories": ["poussee"] },
    { "nom": "Planche", "categories": ["gainage"] }
  ],
  "workouts": [
    {
      "id": "w-exemple-1",
      "clientId": null,
      "nom": "Workout 1 — Bas du corps",
      "consignes": "Échauffe-toi 5 minutes.",
      "blocs": [
        {
          "type": "exercice", "id": "w1-b1", "exerciceId": "ex-squat", "repos": 120, "consignes": "Cuisses parallèles au sol.",
          "champs": [ { "cle": "poids", "modifiableParClient": true }, { "cle": "reps", "modifiableParClient": true } ],
          "series": [ { "poids": 60, "reps": 8 }, { "poids": 60, "reps": 8 }, { "poids": 60, "reps": 8 } ]
        },
        {
          "type": "exercice", "id": "w1-b2", "exerciceId": "ex-planche", "repos": 45,
          "champs": [ { "cle": "tempsTravail", "modifiableParClient": false } ],
          "series": [ { "tempsTravail": 30 }, { "tempsTravail": 30 } ]
        },
        {
          "type": "superset", "id": "w1-b3", "repos": 75,
          "exercices": [
            { "id": "w1-b3a", "exerciceId": "ex-pompes", "champs": [ { "cle": "reps", "modifiableParClient": true } ], "series": [ { "reps": 12 }, { "reps": 12 } ] },
            { "id": "w1-b3b", "exerciceId": "ex-squat", "champs": [ { "cle": "reps", "modifiableParClient": true } ], "series": [ { "reps": 15 }, { "reps": 15 } ] }
          ]
        },
        {
          "type": "circuit", "id": "w1-b4", "nom": "Finisher", "format": "amrap", "params": { "duree": 480 },
          "exercices": [ { "exerciceId": "ex-pompes", "reps": 10 }, { "exerciceId": "ex-squat", "reps": 15 } ]
        }
      ]
    }
  ],
  "programmes": [
    {
      "id": "prog-exemple", "clientId": "client-fabien-vincent", "nom": "Programme exemple", "mode": "repete",
      "debut": "2026-10-05", "workouts": ["w-exemple-1"], "joursFixes": { "w-exemple-1": 0 }
    }
  ]
}
```
Dans un programme `parSemaine`, remplacer `workouts` par `semaines` : `"semaines": [["w-a", "w-b"], ["w-c", "w-d"]]` (semaine 1, semaine 2…) et ajouter `"nbSemaines"` si besoin.
