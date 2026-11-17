# Écarts entre le rendu, le code et la doc (relevé du 2026-11-17)

Méthode : app lancée en local (adaptateur local, données factices), Chrome piloté par Playwright, `getComputedStyle` sur tous les éléments
visibles de 7 écrans client (clair, sombre, bleu, 390 et 1366 px) et 6 écrans coach Studio (clair, 390 et 1366 px), soit 54 relevés,
0 erreur console, 0 débordement horizontal. Puis comparaison avec `src/styles/tokens.css`, `src/coach/studio/tokens.css` et les docs historiques.
**Rien n'a été corrigé dans `src/`** : cette liste sert à trancher et à planifier les retouches.

Gravité : **A** = visible par un client ou contraire à une règle de la charte · **B** = dette qui fera dériver les prochains éléments · **C** = ménage.

## A — visibles

1. **L'icône de l'app ne correspond plus à la marque.** `scripts/sources-icones/monogramme.svg` (icône PWA, favicon, écran d'accueil du téléphone)
   = monogramme « CD » **framboise `#E5486A` + crème sur brun `#25221F`** : vestige de la maquette M1 « Atelier » (octobre), abandonnée pour M5/Studio.
   L'app, elle, est jaune `#F2E27A` + encre. Et le Studio a une 3e marque (carré encre + rond jaune, « Studio coach », `layout.css .st-marque`).
   → 3 signes pour une seule marque. À trancher (voir README, « Doutes »).
2. **Séries « à venir » de la séance à 55 % d'opacité** (`src/components/seance/PanneauExercice.vue:104`, `.rang.avenir`) :
   3,80 : 1 sur blanc et 3,66 : 1 sur surface-2 en clair (4,31 en sombre sur surface-2, 4,20 en bleu). Les chiffres 30 px passent (gros texte ≥ 3 : 1),
   mais le numéro de série (15 px) et l'unité « kg » sont **sous 4,5 : 1**. Lisible pour un adulte, limite pour un senior en salle.
3. **Texte Studio sous 12 px** : 11,5 px (160 occurrences relevées : méta des cartes, puces), 11 px (30), 10,5 px (6). Le client ne descend jamais sous 12 px.
   Pour un outil utilisé « entre deux séances » sur téléphone, plancher conseillé : 12 px.
4. **Contrastes justes (passent, mais sans marge)** : texte-doux sur surface-2 = 4,78 : 1 (sombre) et **4,58 : 1 (bleu)**. Toute animation d'opacité
   ou tout texte plus fin les fera passer sous 4,5. Ne rien poser de plus pâle sur surface-2 dans ces ambiances.

## B — dette qui fait dériver

5. **Deux systèmes de neutres** (assumé à la refonte, jamais écrit comme règle) : client = perle **froide** (`#E3E5E8`, encre `#1B1D20` / `#1A1B1E`),
   Studio = lin **chaud** (`#F4F1EC`, encre `#23252B`, texte `#2B2D33`). Même jaune des deux côtés, déclaré deux fois (`--jaune` et `--st-jaune`).
   La DA en fait une règle : **perle = ce que voit le client ; lin = ce que voit le coach** (README). Les documents et visuels destinés aux clients prennent la perle.
6. **Couleurs en dur hors tokens (~45)** : Studio ≈ 30 (`#fff` ×15 pour le texte sur encre ; `#C9C6BF` toast et carte Claude ; `#FFFBEA`/`#E8DDAA`/`#FBF6E8` notes privées ;
   `#A9A59E` créneau passé ; `#45484F` puce neutre ; `#7A2A1D`, `#4D3900` gras d'encarts ; `#6B6E75` placeholder ; `#E3DDD3` survol) + 33 `rgba()` ;
   client 7 (`accueil.css` ×4, `chargeur.css` reprend les valeurs **Studio** `#23252B`/`#F2E27A` en dur, `ConfigManquante.vue`).
   Manquent des tokens : `--st-sur-encre` (#fff), `--st-prive` (fond des notes privées), `--st-doux-2` (gris sur encre).
7. **Espacements hors échelle 4/8/12/16/20/24/32/40** relevés au rendu : `gap` 6 px (184 occurrences Studio), 10 px (52 Studio, 36 client), 14 px, 9 px, 5 px.
   La règle du 15/11 (LISEZMOI Studio) dit « remplacés au fil des retouches » : encore majoritaires sur les petites rangées.
8. **Rayons hors échelle** : 13 px (185 occurrences Studio, puces et filtres), 12, 11, 9, 7 px ; client 12, 14, 18, 9, 6, 4 px. Les tokens ne prévoient pas de rayon « pilule ».
   La DA ajoute la règle : pilule = `999px` (ou hauteur / 2).
9. **Pas d'échelle de tailles dans le Studio** : 22 tailles de texte différentes relevées (10,5 → 56 px), aucune variable. Graisse 650 (non standard) sur 160 libellés.
10. **Durées de mouvement en double** : `--d-*` / `--ease-*` de `tokens.css` ne sont lues par **aucun** CSS ; les valeurs vivantes sont dans `src/anim/constantes.js` (GSAP)
    et en dur dans `base.css` (`.32s var(--ressort)`, `.1s`). Ressort client `.34, 1.45, .64, 1` vs Studio `.34, 1.4, .64, 1` : quasi-doublon.
11. **Icônes : deux jeux, deux traits.** Client `Icone.vue` (24 × 24, trait 2,2 px, bouts ronds ; rendu 18-22 px, jusqu'à 3,2 px apparent), Studio `IconeSt.vue`
    (24 × 24, trait 1,8 px, 20 px). Cohérent avec les deux ambiances (client plus « gras », coach plus fin) mais non documenté. Pas de bibliothèque : tracés maison.

## C — ménage

12. **Tokens client jamais lus** (définis dans `tokens.css`, aucun `var()` ailleurs) : `--d-appui`, `--d-rapide`, `--d-base`, `--d-page`, `--d-menu`, `--ease-sortie`,
    `--t-page`, `--t-page-grand`, `--t-texte`, `--lh-texte`, `--ls-titre`, `--esp-5`, `--esp-6`, `--esp-8`, `--esp-10`, `--r-col`, `--r-jour`, `--ombre-col`,
    `--ombre-flottant`, `--surbrillance-serie`, `--accent-doux`, `--ph-prep-fg`, `--ph-travail-fg` (23). Gardés dans `tokens.json` parce qu'ils décrivent la direction.
13. **Alias en double** : `--rayon` = `--r-carte` ; `--couleur` = `--accent` (« ancien nom ») ; `--accent-doux` = `--surbrillance` ; `--ph-*` = `--prep-*` / `--repos-*`.
14. **Docs périmées** : `archives/maquettes/design-v2/DESIGN.md` annonce le jaune `#FFD43B` et l'encre `#1A1B1E` sur le jaune (rendu : `#F2E27A` / `#26230A`)
    et texte-doux bleu `#9DAAD0` (rendu : `#97A4CC`) ; il dit « titres Syne 500 » alors que les titres client sont rendus en **Syne 400** (titre de séance 42 px,
    tableau de bord) et 500 dans le Studio ; `src/anim/constantes.js` se présente encore comme « direction M1 Atelier ».
    → `DA/` fait foi désormais ; les docs de `archives/` restent l'historique.
15. **Rubriques « Suivi » et « Questionnaires » du client** : redirigées vers `/bientot/…` dans la démo (données de santé désactivées) ; captures faites sur la page « Bientôt ».
16. **Captures ignorées par Git** : la règle `captures/` du `.gitignore` racine couvre `DA/captures/` ; les JPEG de la DA ont été ajoutés avec `git add -f`
    (1,4 Mo). Si on régénère les captures, refaire `git add -f -- DA/captures/*.jpg`, ou ajouter `!DA/captures/` au `.gitignore` (REX).
