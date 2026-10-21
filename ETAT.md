# ÉTAT — app-coaching

- **V2 (2026-10-21, mode absent)** : ✅ terminée. Bug récap semaine corrigé ; maquette `design-v2/` ; V2 appliquée à l'app (3 ambiances + Grand affichage dans le profil, séance page par page, circuits en section, option facultative, check-in M2) ; testeur : validé ; revue animations faite ; mineurs corrigés (370 tests verts). Choix ouverts (police chrono, accueil, texte aplat) : `src/config/apparence.js` (D4-D7 provisoires). Captures : `docs/captures-v2/final/`. Reste : essai sur vrai téléphone.
- **Statut V1** : V1 construite et testée en mode local (2026-10-20, mode absent). Lots 1 à 12 faits. Détail par lot : `docs/ETAT-historique-lots.md`.
- **Lancer** : double-clic `lancer.cmd` → comptes démo `fabien.vincent` / `DEMO2024`, coach `corentin` / `COACH2026` (`/coach`).
- **Design** : maquette V2 appliquée partout sauf Suivi / Questionnaires (liste) / Bientôt, qui ne prennent que les tokens (choix ouverts : `src/config/apparence.js`, dont `adresse` vous/tu des phrases de chrono) ; autres maquettes dans `design/`.
- **Tests** : `npx vitest run` (334+ verts) ; scénarios navigateur `tests/e2e/` ; audit sécurité `docs/AUDIT-SECURITE.md` (aucun critique, importants corrigés).
- **Décisions provisoires** : `A-VALIDER.md` + `DECISIONS.html`.

## Reste à faire (humain)
Voir `TABLEAU-DE-BORD.html` : mise en route Supabase + Netlify (`MISE-EN-ROUTE.md`), numéro WhatsApp dans `.env`, tâches RGPD (`docs/RGPD-CHECKLIST.md`), recette à 2 comptes avant tout vrai client, essai sur vrai téléphone.

## Points fragiles connus
- Jamais testé contre un vrai Supabase (adaptateur, Edge Functions, schéma) ni sur un vrai téléphone (fluidité clip-path Android moyen, vibrations iOS, invite d'installation).
- Exercices de démo sans lien vidéo.
- Lot V2.5 (mineurs) corrigé : contrastes pied d'accueil et bouton chrono en pause, toast qui laisse passer les taps, sortie de séance et `retour` des pages animées en vrai retour, horodatages futurs bornés à la reprise, résultat de circuit laissé affiché (plus d'avance auto), onglet coach recentré. Reste : le tableau de bord de Thomas défile (872 px pour 844) ; le bandeau « Exercice suivant » recouvre visuellement le bouton (taps transmis seulement).
- Sons (Web Audio) et vibrations de la V2 jamais entendus sur un vrai téléphone ; bilan d'AMRAP avec − / + (pas le grand sélecteur de la maquette) ; l'option est un circuit : seul le dernier bloc d'une séance a « Terminer sans l'option ».
