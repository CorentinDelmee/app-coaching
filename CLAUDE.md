# app-coaching — Corentin Delmée Coaching (PWA)

Référence : `CAHIER-DES-CHARGES.md`. Plan : `PLAN.md`. Passation : `ETAT.md`. Décisions : `DECISIONS.md`.

## Stack
Vue 3 + Vite + vue-router + vite-plugin-pwa + Vitest, @supabase/supabase-js, GSAP, graphiques SVG maison.
Sans `.env` → adaptateur **local** (données factices, localStorage). Avec `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) → Supabase.

## Commandes (préfixer `export PATH="/c/Program Files/nodejs:$PATH";` si `npm` est introuvable)
- Lancer : `npm run dev` (port 5173) — ou double-clic `lancer.cmd`
- Tests unitaires : `npx vitest run`
- Build : `npm run build` → `dist/` (Netlify Drop) ; aperçu : `npm run preview`

## Structure
- `src/domain/` règles métier pures · `src/engine/` moteurs séance/circuits (horloge injectée) · `src/data/` interface + adaptateurs
- `src/views/` écrans · `src/styles/tokens.css` design tokens · `src/assets/fonts/` polices auto-hébergées
- `supabase/schema.sql` schéma + RLS · `tests/unit/` Vitest · `tests/e2e/` scripts navigateur · `design/` maquettes (ne pas modifier hors tâche design)

## Conventions
- Logique métier sans Vue ni `Date.now()` : `now` passé en paramètre, testée par Vitest.
- Les vues passent toujours par `src/data/` (jamais localStorage/Supabase en direct).
- Apparence : `design/RECOMMANDATION.md` + `DESIGN.md` de la maquette retenue. Animations transform/opacity, `prefers-reduced-motion` respecté.
- Textes en français. Aucun secret dans Git (`.env` ignoré).
- Git : un commit par tâche testée, `git add` de chemins précis, jamais d'amend, jamais de push.
