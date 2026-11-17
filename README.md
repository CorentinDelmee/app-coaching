# Corentin Delmée Coaching — l'app

Application de coaching (PWA installable) : programme, séance guidée, coaching, questionnaires, suivi ; tableau de bord coach.

## Lancer
- Windows : double-clic sur `lancer.cmd` (installe si besoin puis ouvre le navigateur).
- Sinon : `npm install` puis `npm run dev` → http://localhost:5173

Sans fichier `.env`, l'app tourne en **mode local** avec des données de démo (aucun compte nécessaire).

Comptes de démo : client `fabien.vincent` / `DEMO2024` ; coach `corentin` / `COACH2026` (espace coach : `/coach`).
Pour revoir le consentement ou repartir de zéro : vider les données du site dans le navigateur.
Back-end : sur le VPS, voir `docs/contrats/CONTRAT-VPS.md` (`VITE_BACKEND=api` dans `.env`).

## Apparence et dossiers
- Apparence : `DA/README.md` + `DA/tokens.json` (direction artistique de référence) ; maquettes historiques dans `archives/maquettes/`.
- `docs/` rangé par thème (`contrats/`, `audits/`, `rgpd/`, `briefs/`, `captures/`) ; `archives/` = historique (Supabase, livraison du 26/10, anciennes maquettes).

## Tester
- `npx vitest run` : tests de la logique métier.
- `npm run build` : build de production dans `dist/`.

## Format d'échange
Import / export JSON versionné `cdc-coaching/1` : voir `docs/contrats/FORMAT-JSON.md`.
