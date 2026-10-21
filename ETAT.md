# ÉTAT — app-coaching

- **V2 (2026-10-21, mode absent)** : retours maquettes dans `RETOURS-MAQUETTES-V1.md` (reportés CDC §7.1). Étape 1 bug récap semaine ✅ (3726753). Étape 2 maquette V2 `design-v2/` ✅ (1750410, notes : `design-v2/NOTES.md`). Puis étape 3 application à l'app, étape 4 tests + revue animations.
- **Statut V1** : V1 construite et testée en mode local (2026-10-20, mode absent). Lots 1 à 12 faits. Détail par lot : `docs/ETAT-historique-lots.md`.
- **Lancer** : double-clic `lancer.cmd` → comptes démo `fabien.vincent` / `DEMO2024`, coach `corentin` / `COACH2026` (`/coach`).
- **Design** : M1 « Atelier » appliquée en provisoire (décision D3 dans `DECISIONS.html`) ; autres maquettes dans `design/`.
- **Tests** : `npx vitest run` (334+ verts) ; scénarios navigateur `tests/e2e/` ; audit sécurité `docs/AUDIT-SECURITE.md` (aucun critique, importants corrigés).
- **Décisions provisoires** : `A-VALIDER.md` + `DECISIONS.html`.

## Reste à faire (humain)
Voir `TABLEAU-DE-BORD.html` : mise en route Supabase + Netlify (`MISE-EN-ROUTE.md`), numéro WhatsApp dans `.env`, tâches RGPD (`docs/RGPD-CHECKLIST.md`), recette à 2 comptes avant tout vrai client, essai sur vrai téléphone.

## Points fragiles connus
- Jamais testé contre un vrai Supabase (adaptateur, Edge Functions, schéma) ni sur un vrai téléphone (fluidité clip-path Android moyen, vibrations iOS, invite d'installation).
- Exercices de démo sans lien vidéo.
- Mineurs non corrigés : à 390 px l'onglet actif coach est coupé ; après avoir quitté une séance, le geste retour demande 2 appuis (retombe d'abord sur le workout).
