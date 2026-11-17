# Brief commun — correctifs « mouvement et chargement » (2026-11-15)

Demande de Corentin (coach, mot pour mot) : « revoir les animations et les transitions entre menus et entre pages, que ça soit fluide
et propre. […] Actuellement j'ai l'impression qu'il y a des transitions mais pas fluides ou qui transitionnent puis saccadent. Parfois
ça ne charge pas directement car ça attend les informations de la bdd, donc un petit loader personnalisé ne serait peut-être pas de refus. »
Il utilise surtout l'app sur **téléphone** (PWA installée). En production, chaque lecture = un aller-retour au VPS (`GET /api/app/e/<entite>`
renvoie la collection entière).

## Ce que l'audit a montré (390×844 tactile, CPU ×4, latence 500 ms par lecture)
- **La page attend la base avant d'exister** : fiche client = rien pendant 1,1 s après le tap, puis la feuille glisse ; éditeur de séance =
  squelette encore là à 2,2 s (lectures en série) ; Programmes = zone vide 1,5 s ; app client : écran gris 1,6 s au retour sur l'accueil.
- **« Transitionne puis saccade »** : l'ancienne transition `out-in` (fondu de sortie, puis entrée) jouait sur une page vide ; le contenu
  arrivait ensuite d'un coup, sans forme préparée → sauts (`layout-shift`) : Agenda 0,28, Aujourd'hui 0,12, Clients 0,02.
- Chaque écran attendait `rafraichir()` (5 collections + agenda, en série) avant de s'afficher.

## Déjà fait dans le socle (commité par REX/frontend-senior, NE PAS MODIFIER)
`src/data/cache.js` + `src/data/index.js` (`lectureRapide`, `attente`), `src/lib/chargement.js`, `src/components/Chargeur.vue` + `chargeur.css`,
`src/coach/CoachLayout.vue` (plus de `out-in`, entrée de page CSS selon le sens, chargeur en haut), `src/coach/studio/layout.css`,
`tokens.css`, `mouvement.js`, `src/coach/store.js` (`rafraichir` rapide et en parallèle), `src/router/*` (défilement, navigation = attente).
**Règles complètes : `src/coach/studio/LISEZMOI.md`, section « Mouvement et chargement ». Lis-la en entier avant de coder.**

## Ta mission sur TON écran (et seulement tes fichiers)
1. **Mesure avant** (temps réel, jamais `--virtual-time-budget`) : copie `…/scratchpad/mouvement/mesurer.mjs` et `sonde.mjs` dans ton dossier
   de scratchpad, garde le harnais (390×844 isMobile hasTouch, CPU ×4, latence de démo `localStorage['cdc-coaching/1:latence'] = '500'`),
   remplace les scénarios par ceux de ton écran (ouvrir, revenir, changer d'onglet interne, ouvrir/fermer feuilles et panneaux). `--film` produit
   une planche (une image / 100 ms) : **regarde-la** pour voir ce que le doigt voit.
2. **Afficher tout de suite** : le cadre de la page (titre, actions, filtres) est rendu sans attendre ; la zone de données a un **squelette à la
   forme exacte du contenu** (mêmes hauteurs, même nombre probable d'éléments, mêmes marges) ; à l'arrivée, le contenu remplace le squelette
   **sans animation et sans saut** (`layout-shift` ≈ 0). Une feuille / un panneau s'ouvre **au tap**, avec son squelette, pas après la lecture.
3. **Lecture rapide** des listes et tableaux de bord : `lectureRapide(cle, entites, charger, appliquer)` (voir LISEZMOI). Clé préfixée par
   ton écran (`clients:liste`, `clients:fiche:<id>`…), `entites` = TOUTES les entités lues par `charger`. `charger` fait ses lectures en
   **parallèle** (`Promise.all`) et renvoie une valeur brute ; `appliquer` met l'écran à jour (appelé depuis le cache puis frais).
4. **Éditeurs** (objet modifié avec `{ version }` / `useSauvegardeAuto`) : l'objet édité est **lu frais** (`attente(data.x.lire(id))`),
   jamais depuis le cache ; `s.suivreVersion` seulement sur la lecture fraîche ; si tu affiches un cache en attendant, les champs d'édition
   restent inactifs (ou en squelette) jusqu'à la lecture fraîche. Ne change rien au fonctionnement des conflits (409).
5. **Animations** : uniquement `transform`/`opacity` ; pas de fondu < .9 sur du texte ; pas de cascade rejouée quand la liste se met à jour
   (clé stable `:key="x.id"`, animation d'entrée seulement au premier affichage, pas sur un rafraîchissement) ; une `<Transition>` Vue OU GSAP
   par élément, jamais les deux ; GSAP nettoyé au démontage ; `mouvementReduit()` respecté ; jamais rejouer un tap dans la page d'arrivée.
6. **Mesure après** (même script) + planche avant / après. Copie 1 planche avant + 1 après (JPEG ≤ 150 Ko chacune) dans
   `docs/captures/mouvement/<ton-ecran>/` (`avant-<scenario>.jpg`, `apres-<scenario>.jpg`) et un `mesures.json` (avant/après par scénario :
   perdues, pire image, longues tâches, sauts, fin DOM).

## Interdits
- Pas de changement de couleur, typo, espacement (sauf ce qu'exige un squelette), ni de fonctionnement métier.
- Ne touche **que** tes fichiers (liste dans ta consigne). Fichiers racine de `src/coach/studio/`, `src/data/`, `src/router/`, `src/components/Chargeur.vue`,
  `CoachLayout.vue`, `store.js`, `DECISIONS.md`, `ETAT.md`, `LISEZMOI.md` : **interdits** (signale un besoin dans ton rapport).
- Git : `git -C /Users/corentindelmee/Documents/REXV2/Projets/app-coaching add -- <chemins précis>` puis `git commit -m "…" -- <chemins précis>` ;
  jamais `-A`, jamais `--amend`, jamais `stash`, jamais `push`, jamais `reset`. D'autres agents commitent en même temps : si `index.lock` existe,
  attends 3 s et réessaie. Message de commit en français, préfixe `mouvement (<écran>) : …`, terminé par la ligne
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Serveur : `npx vite --port <TON PORT> --strictPort --host 127.0.0.1` lancé en arrière-plan, **PID noté et arrêté (`kill <PID>`) avant ton rapport**.
  Chrome : `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (playwright-core global : voir `chargerPlaywright` dans `tests/e2e/studio/banc.mjs`).
- Scripts temporaires : `/private/tmp/claude-501/-Users-corentindelmee-Documents-REXV2/7d6e82c9-8e39-4968-958e-bacf37fe3f79/scratchpad/mouvement/<ton-ecran>/`.
  Jamais de `node -e` avec des backticks : écris un fichier puis lance-le.
- Le Mac est chargé (d'autres sessions) : compare les images perdues avant/après **dans la même minute**, et fie-toi surtout aux sauts, à la fin DOM et aux planches.

## Vérifications obligatoires avant ton rapport
- `npx vitest run` : tout vert (865 aujourd'hui) ; ajoute un test unitaire si tu crées une fonction pure.
- Banc de ton écran : `node tests/e2e/studio/banc.mjs --only=<ecran> --port=<TON PORT + 100> --out=<ton dossier scratchpad>/banc` : 0 fail.
- Planche 390 px après **et** une capture 1366×690 (ordinateur) sans régression.
- `git status --short` : aucun fichier à toi non commité.

## Rapport (court, dans ton message final)
Causes trouvées · ce qui a changé · chiffres avant/après (tableau) · commits (identifiants) · tests et banc · **doutes et failles**
(surtout : données de cache qui pourraient être éditées, saut restant, tap rejoué) · tokens et durée.
