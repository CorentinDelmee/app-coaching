> **État au 2026-11-06 : TERMINÉ côté serveur et src/data (le lot écran peut appeler `data.exercices.*`).**
> - Fait : routes `/api/app/exercices` (liste, détail, POST, PATCH, photo POST/DELETE, `/fichiers` avec ETag/304), vue client sans `notesPrivees`/`utiliseDans*`, outils MCP (`creer_exercice`, `modifier_exercice`, `lister_exercices` acceptent la fiche Studio), `data.exercices.{recherche,detail,mettreAJour,envoyerPhoto,retirerPhoto}` en adaptateurs api et local, démo de 24 fiches (liens YouTube de `serveur/donnees/bibliotheque-videos.json`).
> - Testé : tests Vitest (615 verts), migration sur 181 exercices hérités, test HTTP réel curl sur le port 5415.
> - Précisions (pas de changement de forme) : `lienVideo` est enregistré sous la forme `https://www.youtube.com/watch?v=<id>` ; une ancienne valeur `lienVideo: null` est renvoyée comme champ absent ; `PUT /e/exercices/:id` reste tolérant (anciens liens non YouTube, descriptions longues) ; l'adaptateur api traduit 409 en `ErreurData('EXISTE')` ; la photo en mode local est une data-URL (`photo.url`).

# Contrat — exercices enrichis (refonte coach « Studio ») — 2026-11-05

Lot serveur (`studio-exo-serveur`). Le lot écran n'appelle QUE `data.exercices.*` (voir « src/data »), jamais `fetch`.
Base des routes : `/api/app` (cookie de session, same-origin). Erreurs : `{ "erreur": "<code>" }` (codes : `invalide` 400, `non_connecte` 401, `interdit` 403, `introuvable` 404, `existe_deja` 409, `trop_gros` 413, `type_refuse` 415, `origine_refusee` 403 pour tout non-GET sans Origin).

## Forme JSON exacte d'un exercice (vue COACH)
```json
{
  "id": "ex-squat-gobelet",
  "nom": "Squat gobelet",
  "description": "texte court (existant)",
  "categories": ["jambes"],
  "lienVideo": "https://www.youtube.com/watch?v=mKREc_xl_j8",
  "categorie": "Renforcement",
  "musclesPrincipaux": ["jambes"],
  "musclesSecondaires": ["gainage"],
  "materiel": ["Haltères"],
  "niveau": "debutant",
  "consignes": "texte",
  "erreursFrequentes": "texte",
  "varianteFacile": "texte",
  "varianteDifficile": "texte",
  "tempo": "3-1-1",
  "reposConseille": 60,
  "notesPrivees": "texte (coach seulement)",
  "photo": { "id": "p-3fa9c01b22de", "url": "/api/app/fichiers?chemin=_exercices%2Fp-3fa9c01b22de.webp" },
  "video": { "url": "https://www.youtube.com/watch?v=…", "titre": "…", "chaine": "…", "duree": 20, "statut": "valide" },
  "utiliseDans": 3,
  "utiliseDansProgrammes": 2
}
```
- **Champs existants conservés** : `id`, `nom`, `description?`, `categories[]`, `lienVideo?` (reste la source de la vidéo ; `categories` = tags historiques, `categorie` = la catégorie unique du Studio).
- **Tous les nouveaux champs sont facultatifs** (absents = non renseignés) ; une chaîne vide `""` est acceptée en PATCH et efface le champ. `photo`/`video` valent `null` quand il n'y en a pas.
- Limites (validation zod stricte, clés inconnues refusées) : `nom` 1-120 · `description` ≤ 1000 · `categories` ≤ 10 × 1-40 · `categorie` 1-40 · `musclesPrincipaux` ≤ 6 × 1-40 · `musclesSecondaires` ≤ 10 × 1-40 · `materiel` ≤ 10 × 1-40 · `niveau` ∈ `debutant | intermediaire | confirme` · `consignes`, `erreursFrequentes`, `notesPrivees` ≤ 2000 · `varianteFacile`, `varianteDifficile` ≤ 500 · `tempo` ≤ 20 (ex. « 3-1-1 ») · `reposConseille` entier 0-600 (secondes) · `lienVideo` lien YouTube ≤ 300.
- **Champs calculés / gérés par le serveur, jamais acceptés en écriture** : `photo` (routes photo), `video` (dérivée de `lienVideo` + bibliothèque : `statut` `propose|valide`, `titre/chaine/duree` si connus sinon `null`), `utiliseDans` (nb de séances/workouts distincts qui contiennent l'exercice, blocs simples et supersets), `utiliseDansProgrammes` (nb de programmes dont un workout contient l'exercice). Envoyés dans un PATCH → 400.
- **Vue CLIENT** (client connecté qui voit un exercice, dans sa séance) : mêmes champs **sans** `notesPrivees`, `utiliseDans`, `utiliseDansProgrammes`. La photo est lisible par tous les connectés.

## Routes (toutes connectées ; écritures = coach seulement)
| Méthode + chemin | Rôle | Réponse |
|---|---|---|
| `GET /exercices?q=&categorie=&muscle=&materiel=&niveau=&video=&limite=&decalage=` | coach + client | `200 { "items": [exercice], "total": n }` |
| `GET /exercices/:id` | coach + client | `200 { "item": exercice }` · 404 |
| `POST /exercices` corps = champs (nom obligatoire, `id` facultatif) | coach | `201 { "item": exercice }` · 409 si l'id existe |
| `PATCH /exercices/:id` corps = seulement les champs à changer (fusion) | coach | `200 { "item": exercice }` · 400 · 404 |
| `POST /exercices/:id/photo` corps brut `image/jpeg \| image/png \| image/webp` | coach | `200 { "item": exercice }` (ancienne photo supprimée) |
| `DELETE /exercices/:id/photo` | coach | `200 { "item": exercice }` |
| `POST /exercices/:id/valider-video` (sans corps) | coach | `200 { "item": exercice }` avec `video.statut: "valide"` · 403 client · 404 · 409 `sans_video` (pas de lien YouTube) · 503 bibliothèque indisponible. Côté data : `data.exercices.validerVideo(id)` renvoie cet exercice. |
| `GET /fichiers?chemin=_exercices/<id-photo>.<ext>` (= `photo.url`) | coach + client | image ; `ETag`, `Cache-Control: private, max-age=86400`, 304 sur `If-None-Match` |
- Chaque filtre texte (`q`, `categorie`, `muscle`, `materiel`) est limité à **120 caractères** (400 `invalide` au-delà).
- Filtres de la liste (tous facultatifs, combinables) : `q` (nom/description, sans accents ni casse) · `categorie` (égalité sur `categorie` ou présence dans `categories`) · `muscle` (dans principaux OU secondaires) · `materiel` (présence) · `niveau` · `video` ∈ `aucune | propose | valide` · `limite` 1-500 (défaut 500) · `decalage` ≥ 0. Tri : nom croissant. Les exercices archivés ne sont pas listés. Client : mêmes filtres.
- Les routes génériques `PUT/DELETE /e/exercices/:id` continuent de marcher (coach) mais valident aussi avec le même schéma ; `photo` y est conservée côté serveur. `DELETE` supprime aussi le fichier photo.
- **Photo** : formats JPG/PNG/WebP, type vérifié par signature (pas l'extension), **3 Mo max** (413 au-delà, 415 pour un autre type ou une signature fausse). **Aucun redimensionnement serveur** : l'écran réduit avant l'envoi (≤ 1600 px de large, WebP/JPEG ~0,8 → ~200 Ko). Stockage : `<fichiersDir>/_exercices/p-<hex12>.<ext>`.
- Validation de vidéo (statut `valide`) : inchangée, par l'outil `valider_video` (Claude) ; l'écran affiche le statut et `lienVideo` se modifie par PATCH (le serveur le rattache en `propose` si le lien est nouveau).

## src/data (le lot écran appelle ceci)
`data.exercices` garde `lister / lire / creer / modifier / archiver` existants ; ajouts (COACH et lecture client) :
- `await data.exercices.recherche({ q, categorie, muscle, materiel, niveau, video, limite, decalage })` → `{ items, total }` (api : `GET /exercices?…` ; local : même filtrage en mémoire).
- `await data.exercices.detail(id)` → exercice enrichi ou `null` (inclut `utiliseDans` pour le coach).
- `await data.exercices.mettreAJour(id, patch)` → exercice (api : PATCH ; local : fusion). Le champ `lienVideo` y est accepté.
- `await data.exercices.envoyerPhoto(id, blob)` → exercice ; `await data.exercices.retirerPhoto(id)` → exercice.
- `creer(obj)` accepte les nouveaux champs. En mode local la photo est stockée en data-URL (`photo.url`).
