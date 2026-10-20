# Décisions prises sans Corentin

- 2026-10-20 Nom du dossier : `app-coaching`.
- 2026-10-20 Stack : Vue 3 + Vite + vite-plugin-pwa + Vitest ; Supabase (UE) derrière une couche de données avec adaptateur local (brief).
- 2026-10-20 Versions : Vite 8, vue-router 5, vite-plugin-pwa 2, Vitest 5 (dernières stables à l'installation, Node 24).
- 2026-10-20 `base: '/'` + `public/_redirects` (SPA) + `public/_headers` no-cache sur sw.js/index.html : app servie à la racine d'un sous-domaine Netlify.
- 2026-10-20 Graphiques en SVG maison (pas de librairie) : 2-3 courbes simples, poids minimal, hors connexion garanti.
- 2026-10-20 Connexion Supabase : identifiant converti en e-mail technique `identifiant@clients.cdc-coaching.invalid`, code = mot de passe ; création du client par le coach via `signUp` sur un 2e client Supabase sans persistance (pas de clé service ni de fonction serveur).
- 2026-10-20 Tarif figé sur chaque séance de coaching à sa création (pré-rempli avec le tarif du client) : changer le tarif ne réécrit pas les mois passés.
- 2026-10-20 Rang « nième séance du mois » = séances non annulées du mois calendaire triées par date/heure ; « payé ce mois » = séances `faite` uniquement.
- 2026-10-20 Semaine du lundi au dimanche, dates locales Europe/Paris, poids stockés en kg (conversion lb à l'affichage).
- 2026-10-20 Adaptateur local sur localStorage (clé `cdc-coaching/1`), photos compressées ≤ 1280 px ; quota plein → message visible.
- 2026-10-20 Données factices générées relativement à la date du premier lancement (démo toujours « vivante »).
- 2026-10-20 Ordre des lots imposé par le chef d'orchestre (12 lots, séance en cours en premier lot UI) ; lots 6-7-8 parallélisables seulement en worktrees séparés.
