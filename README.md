# Corentin Delmée Coaching — l'app

Application de coaching (PWA installable) : programme, séance guidée, coaching, questionnaires, suivi ; tableau de bord coach.

## Lancer
- Windows : double-clic sur `lancer.cmd` (installe si besoin puis ouvre le navigateur).
- Sinon : `npm install` puis `npm run dev` → http://localhost:5173

Sans fichier `.env`, l'app tourne en **mode local** avec des données de démo (aucun compte nécessaire).

Comptes de démo : client `fabien.vincent` / `DEMO2024` ; coach `corentin` / `COACH2026` (espace coach : `/coach`).
Pour revoir le consentement ou repartir de zéro : vider les données du site dans le navigateur.
Pour Supabase : copier `.env.example` en `.env` et remplir les clés (voir `MISE-EN-ROUTE.md`).

## Maquettes
`design/index.html` (5 maquettes, M1 « Atelier » retenue en provisoire), vidéo du parcours final : `design/app-finale/`.

## Tester
- `npx vitest run` : tests de la logique métier.
- `npm run build` : build de production dans `dist/`.

## Format d'échange
Import / export JSON versionné `cdc-coaching/1` : voir `docs/FORMAT-JSON.md`.
