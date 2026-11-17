# Ménage du 2026-11-17 — points à trancher

Rien de ce qui suit n'a été modifié sur le fond : regroupé seulement. Une ligne par point, recommandation en fin de ligne.

1. **Deux audits de sécurité** : `docs/audits/AUDIT-SECURITE.md` (lot 11, 20/10, époque Supabase) et `docs/audits/AUDIT-SECURITE-26-10.md` (+ revues récentes dans `docs/audits/`). → Reco : archiver le premier après avoir vérifié qu'aucun point ouvert ne vaut encore pour le VPS.
2. **ETAT en double** : `ETAT.md` (16 Ko, remonte au 26/10) et `archives/ETAT-historique-lots.md`. → Reco : garder dans `ETAT.md` les 2-3 dernières entrées et verser le reste dans l'historique.
3. **Guide agenda Supabase** (`archives/GOOGLE-AGENDA-supabase.md`) encore cité comme « Secrets à créer » dans `ETAT.md` et des tâches de `suivi.json`. → Reco : fermer ces tâches (remplacé par l'API réservation du VPS).
4. **MISE-EN-ROUTE (Supabase/Netlify)** archivé, mais encore cité par plusieurs tâches de `suivi.json` / `TABLEAU-DE-BORD.html`. → Reco : marquer ces tâches abandonnées puis régénérer les pages.
5. **`docs/rgpd/RGPD-CHECKLIST.md`** parle encore de Supabase (3 mentions). → Reco : la mettre à jour pour le VPS (hébergeur, sauvegardes chiffrées).
6. **Sources d'apparence multiples** : `DA/`, `archives/maquettes/design-v1/RECOMMANDATION.md` + `m5/`, `design-v2/DESIGN.md`, `design-coach/d3/DESIGN.md` ; les commentaires de `src/styles/tokens.css` et `src/coach/studio/tokens.css` pointent vers les archives. → Reco : `DA/` seule référence ; vérifier sa concordance avec les deux `tokens.css`.
7. **`docs/import-depart/`** (80 exercices de départ, format de l'époque Supabase) : sans doute dépassé par l'import MyPTHub (181 exercices). → Reco : archiver.
8. **Test sauté** `tests/unit/agenda-google.test.js` (compare la copie archivée `archives/supabase/functions/_shared/agendaGoogle.js`) et `tests/unit/securite-fonctions.test.js` qui importe encore du code archivé. → Reco : déplacer les fonctions encore utiles dans `serveur/` ou retirer ces tests ; à décider par un développeur.
9. **`serveur/src/store.js`** garde un magasin Supabase « non testé ». → Reco : le retirer lors d'un lot serveur.
10. **10 liens cassés préexistants** : vidéos `.webm` des maquettes v1 (ignorées par Git, donc absentes d'un clone). → Reco : rien à faire (normal).
11. **`données clients/`** (non suivi, données santé) présent sur le Mac. → Reco : vérifier si encore utile, sinon le supprimer à la main (non touché par le ménage).
