# Audit performance / accessibilité / PWA — 26/10/2026 (après alignement M5)

Méthode : build de prod (build démo `VITE_MODE_DEMO=1` posé hors du projet pour pouvoir se connecter), Chrome headless, Lighthouse mobile (4G simulée, CPU ×4), axe-core (WCAG 2.2 AA) dans les 3 ambiances sur `/`, `/programme`, `/profil`, `/coaching`, `/suivi`, `/questionnaires` et menu ouvert, scripts Puppeteer pour le jank. Aucun fichier du projet modifié. Mesures = faits ; les « ms réels » divisent par 4 les mesures ralenties (estimation).

## Scores Lighthouse mobile (fait)
| Page | Perf | A11y | Bonnes pratiques | SEO |
|---|---|---|---|---|
| `/bienvenue` (public) | 97 | 100 | 100 | 82 |
| `/` tableau de bord connecté | 90 | 89 | 100 | 82 |
`/` : FCP/LCP 2,8 s, TBT 110 ms, CLS 0,014, TTI 3,5 s. Public : FCP 2,1 s, TBT 0, CLS 0,026.

## Poids (fait)
- Au démarrage (local) : ~523 Ko bruts / ~175 Ko gzip (index 195, runtime-core 62, data 53, CSS 49 + 36). Pages en chargement différé (Seance 57 Ko, Suivi 28 Ko…). Aucune image bitmap dans l'app : seules les icônes PWA (36 Ko au total).
- Polices : Syne 35 Ko + Albert Sans 32 Ko chargées partout ; Barlow 23 Ko ; Inter Tight 45 Ko et Azeret 11 Ko seulement si choisies. `font-display: swap` partout. Pas de preload.
- supabase-js (`dist-*.js`, 214 Ko / 55 gz) n'est chargé qu'en mode Supabase : bien isolé.
- Précache SW : 73 fichiers, 1,1 Mo (dont les 2 polices de chrono non utilisées).

## Mouvement, CPU ×4, 390 px (fait)
| Action | Médiane image | Tâche longue | Recalculs de style / mise en page |
|---|---|---|---|
| Entrée du tableau de bord | 7,6 ms | 0 (max image 46 ms) | 178 / 95 |
| Ouverture du menu | 7,6 ms | 1 × 64 ms | 211 / 12 |
| Fermeture du menu | 7,6 ms | 0 (1 image 68 ms) | 102 / 15 |
| Clic carte Programme | 7,6 ms | 1 × 136 ms (≈ 34 ms réels : chargement du chunk + montage) | 256 / 14 |
| Clic carte du jour | 8 ms | 1 × 101 ms | 251 / 26 |
| Rubrique du menu (Profil) | 7,6 ms | 0 | 105 / 15 |
Verdict : pas de jank visible. Les animations GSAP du menu, des cartes et de la page qui recule n'animent que x, y, z, scale, rotation, opacity (composite-only). Pas de `transition: all`, ni `backdrop-filter`/`filter` animé. Seuls écarts non composités, petits : `strokeDashoffset` de l'anneau et texte du compteur (`src/anim/titres.js:55-58`, `Accueil.vue` compteur), tolérables.

## PWA (fait)
Manifeste complet (nom, id, scope, standalone, 192/512/maskable, thème). Service worker actif ; hors ligne testé en mode avion, session connectée : `/`, `/programme`, `/profil`, `/suivi`, `/seance/w-fabien-1` s'affichent, pastille « Hors connexion » présente. Rien à corriger. Détail : `theme-color` fixe `#E3E5E8` dans le manifeste (inévitable) ; la balise meta suit l'ambiance (`apparence.js:24`).

## Constats, par ordre d'impact
1. **MOYEN, lecteur d'écran : les `aria-label` des cartes cachent le contenu.** `Accueil.vue:304` (coaching) : le bouton s'annonce « Prochaine séance de coaching » sans date, heure ni lieu ; `:316` « Mon programme » sans le nom ni la semaine ; `:329` « Questionnaires » sans l'état ; `:280` (carte du jour) omet les pastilles (durée, « Fait »). Lighthouse : `label-content-name-mismatch` sur 5 cartes (A11y 89). Correction : supprimer ces `aria-label` (le texte visible suffit, les décors sont déjà `aria-hidden`) ; garder le `aria-label` seulement de `:294` en le recalant sur le texte visible (« Cette semaine : 2 sur 4 »), ou le retirer aussi.
2. **MOYEN, contraste : texte secondaire sur la surbrillance jaune en sombre et bleu.** `ecrans.css:127` (`.ligne-w .wt small`, `--texte-doux`) sur `.en-avant` (`ecrans.css:134`, jaune 22 %) : 3,11 : 1 (sombre) et 3,19 : 1 (bleu), requis 4,5. Programme, séance « à faire » en cours. Correction : `.ligne-w.en-avant .wt small { color: var(--texte); opacity: .8 }`.
3. **BAS, liens de dev visibles en démo.** `accueil.css:115-116` + `Accueil.vue:337-340` : « Séance démo / Circuits » 11 px, contraste 3,57 : 1, cible 20 px (< 24 px). Absents en production (`mode === 'local'`). Correction : `min-height: 24px`, `font-size: 12px`, `opacity: 1`, couleur `--texte`, ou les masquer hors `?dev`.
4. **BAS, structure des titres.** `Programme.vue:335/344/355` et `Questionnaires.vue:81` : h3 sans h2 intermédiaire (h1 → h3). Correction : passer en `<h2>` (même classe CSS).
5. **BAS, performance de départ.** FCP 2,8 s en 4G simulée : `index.html:15` (`apparence-init.js` synchrone, ~0,9 s estimé) et le CSS principal bloquent le rendu ; polices découvertes tard. Correction : `defer` impossible (il pose l'ambiance avant la première peinture, à garder) ; ajouter `<link rel="preload" as="font" type="font/woff2" crossorigin>` pour Syne et Albert Sans (noms hachés : passer par un petit plugin Vite ou copier les deux dans `public/fonts/` avec chemin fixe). Gain attendu : environ 0,3 à 0,5 s de LCP (estimation).
6. **BAS, précache.** `vite.config.js:36` : `globPatterns` inclut Inter Tight et Azeret (56 Ko) même si Corentin garde Barlow. À exclure quand le choix de la police du chrono est tranché.
7. **INFO, SEO** (sans effet pour une app privée) : pas de `meta description` (`index.html`), `robots.txt` renvoie le HTML. Ajouter une description d'une ligne si le site vitrine pointe vers l'app.

## Conforme (fait, testé)
- Jaune : jamais en texte sur clair (1,04 : 1 sur le fond, 1,32 sur blanc). Usage en texte uniquement sur sombre/bleu (12,1 / 12,9 : 1) ou en « texte accent sur fond foncé ». Titre actif du menu en clair : `--texte` + pastille jaune (`accueil.css:30-32`) ; texte foncé sur jaune 12 : 1.
- Axe sur les 3 ambiances et le menu ouvert : aucune autre violation de contraste ; `--texte-doux` clair 4,65 : 1 sur le fond du menu.
- Menu : `nav` nommée, `aria-expanded`/`aria-controls`, `aria-current`, page `inert` pendant l'ouverture, piège de Tab, Échap ferme, focus rendu au bouton, `hidden` quand fermé (`MenuApp.vue:200-260`). Bouton 52 px, rubriques ≥ 56 px, cartes grandes.
- Focus visible global 3 px (`base.css:23`, 13,4 : 1 en clair, jaune en sombre/bleu).
- `prefers-reduced-motion` : respecté par `mouvementReduit()` (menu, pages, cartes, parallaxe, confettis, anneau) et par le CSS (`accueil.css:159`, `base.css:47`).
- Zoom non bloqué (viewport sans `user-scalable=no`) ; `lang="fr"`.
- Serveurs arrêtés (ports 5631, 5632, 9333). Outils de mesure installés hors projet (scratchpad).
