# ÉTAT — app-coaching

- **Statut** : V1 construite et testée en mode local (2026-10-20, mode absent). Lots 1 à 12 faits. Détail par lot : `docs/ETAT-historique-lots.md`.
- **Lancer** : double-clic `lancer.cmd` → comptes démo `fabien.vincent` / `DEMO2024`, coach `corentin` / `COACH2026` (`/coach`).
- **Design** : M1 « Atelier » appliquée en provisoire (décision D3 dans `DECISIONS.html`) ; autres maquettes dans `design/`.
- **Tests** : `npx vitest run` (334+ verts) ; scénarios navigateur `tests/e2e/` ; audit sécurité `docs/AUDIT-SECURITE.md` (aucun critique, importants corrigés).
- **Décisions provisoires** : `A-VALIDER.md` + `DECISIONS.html`.

## Reste à faire (humain)
Voir `TABLEAU-DE-BORD.html` : mise en route Supabase + Netlify (`MISE-EN-ROUTE.md`), numéro WhatsApp dans `.env`, tâches RGPD (`docs/RGPD-CHECKLIST.md`), recette à 2 comptes avant tout vrai client, essai sur vrai téléphone.

## Points fragiles connus
- Jamais testé contre un vrai Supabase (adaptateur, Edge Functions, schéma) ni sur un vrai téléphone (fluidité clip-path Android moyen, vibrations iOS, invite d'installation).
- Exercices de démo sans lien vidéo.
