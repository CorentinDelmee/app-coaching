# ÉTAT — app-coaching

- **V2 (2026-10-21, mode absent)** : retours maquettes dans `RETOURS-MAQUETTES-V1.md` (reportés CDC §7.1). Étape 1 bug récap semaine ✅ (3726753). Étape 2 maquette V2 `design-v2/` ✅ (1750410, notes : `design-v2/NOTES.md`). Étape 3a (socle + écrans hors séance) ✅ : tokens V2, préférences client (ambiance, Grand affichage), menu M5, dashboard, Coaching, Programme, overview Workout, Profil (voir DECISIONS.md « Lot V2.3a », captures `docs/captures-v2/`). Étape 3b (séance, circuits, check-in) ✅ : pages entières avec repères de bloc et temps total, chronos à phrase + chiffres en roulette + balayage de couleur, section de circuit, option facultative (`facultatif`), check-in M2, ouverture depuis l'overview, retour en un geste (voir DECISIONS.md « Lot V2.3b », captures `docs/captures-v2/seance/`, parcours `tests/e2e/v2b-parcours-complet.js`). **Reste étape 4** : test indépendant (testeur) + revue des animations (`review-animations`) ; mesurer le `clip-path` plein écran sur un vrai téléphone moyen.
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
