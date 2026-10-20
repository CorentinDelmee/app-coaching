# ÉTAT — app-coaching

- **Mode** : absent (Corentin parti jusqu'au soir du 2026-10-20) — décisions appliquées en provisoire, listées dans `suivi.json` et `A-VALIDER.md`.
- **Phase** : lot 1 VALIDÉ ; lot 2 (séance en cours) FAIT, à tester par le testeur ; maquette M1 « Atelier » appliquée en provisoire (design/RECOMMANDATION.md).
- **Référence** : CAHIER-DES-CHARGES.md

## Lot 2 — FAIT (à valider par le testeur)
Séance complète portée en Vue avec les animations de la maquette M1 : `src/views/Seance.vue` (orchestration), `src/components/seance/*`
(exercice, série ouverte, roue, chronos de série et de circuit, tiroir, bandeau, fin), `src/anim/` (transitions GSAP), `src/domain/seanceUi.js`
et `circuitsUi.js` (libellés purs, testés), `src/lib/` (horloge, sons, Wake Lock, séance sauvegardée, session de démo), tokens et polices dans `src/styles/` et `src/assets/fonts/`.
- Routes de démo (session Fabien automatique en mode local) : `/demo/seance` (superset), `/demo/temps` (série au temps), `/demo/finishers` (AMRAP + EMOM), `/demo/circuits` (les 6 autres formats) ; générique `/seance/:workoutId` (`?nouvelle=1` repart de zéro, `?vitesse=30` accélère le temps).
- Tests : `npx vitest run` (237 verts) ; scénarios navigateur dans `tests/e2e/` (voir son README).
- Reste pour plus tard : essai sur un vrai téléphone Android moyen (fluidité du clip-path animé), sons/vibrations sur appareil, vidéo YouTube réelle (aucun exercice de démo n'a de lien), lien « Démarrer » de la page Workout (lot 3) qui réutilisera `ouvrirPage`/`ouvrirCercle` avec le bouton d'origine.

## Lots 3 et 4 — FAITS (à valider par le testeur)
- Page Workout `/workout/:workoutId` (`src/views/Workout.vue`, `src/domain/workoutUi.js`) : en-tête d'accent, blocs, superset, circuits (format + durée), consigne du coach (absente si vide), vidéo YouTube intégrée, bouton collant Démarrer / Refaire / Reprendre, cercle d'accent vers `/seance/:workoutId`.
- Programme `/programme` (`src/views/Programme.vue`, `src/domain/calendrierUi.js`) : colonnes de semaine, bascule mois animée, navigation semaines, À faire / Fait / Historique, jours fixés par le coach, semaine bouclée célébrée, programme terminé, aucun programme.
- Transitions entre routes : `src/anim/passage.js`, `src/composables/usePageAnimee.js`. Styles : `src/styles/ecrans.css`. Accès provisoire par les liens de l'accueil (lot 5 les remplace).
- Tests : `npx vitest run` (276 verts) ; scénarios navigateur `tests/e2e/lot3-*`, `lot4-*`.
- Reste : essai sur vrai téléphone ; vidéos réelles (aucun lien dans la démo) ; au retour d'un workout la page Programme rejoue son entrée (fondu) après la fermeture ; lot 5 (dashboard/menu) rebranchera les entrées.

## Lots 5 et 6 — FAITS (à valider par le testeur)
- Dashboard `/` (`src/views/Accueil.vue`, `src/domain/accueil.js`) : aujourd'hui / cette semaine (anneau + compteur) / coaching / programme / questionnaires (pastille seulement s'il y en a). Sans défilement à 390×844. Cas : aucune séance (carte « Aucune séance prévue — M'écrire »), semaine bouclée (carte héros + confettis), workout fait. Liens discrets /demo et /coach en mode local.
- Menu 6 rubriques (`src/components/MenuApp.vue`, global dans `App.vue`) : cercle depuis le bouton, rideau d'accent entre rubriques, Échap, pastille Questionnaires. Questionnaires / Suivi / Profil -> `/bientot/:rubrique` (`Bientot.vue`).
- Coaching `/coaching` (`src/views/Coaching.vue`) : séance, Modifier/Annuler (WhatsApp, feuille d'avertissement < 24 h), mot du coach (défaut si absent), « M'envoyer un mot », rang du mois (« 1re »), compteurs semaine/mois, « Payé ce mois : 2 × 35 € = 70 € ».
- WhatsApp : `src/lib/coach.js`, variable `VITE_COACH_WHATSAPP` (à ajouter dans `.env.example` : REX n'a pas le droit de le modifier ; noté dans CLAUDE.md).
- Correctif : au retour d'une page refermée dans sa carte, la page d'arrivée n'est plus rejouée (`marquerRetour` / `consommerRetour`).
- Tests : `npx vitest run` (282 verts) ; `tests/e2e/lot5-*`.
- Reste : essai téléphone réel ; menu : pas de piège de focus ; Questionnaires (lot 7), Suivi, Profil.

## Lot suivant
**Lots 7 (Questionnaires), 8 et suivants** selon PLAN.md.
