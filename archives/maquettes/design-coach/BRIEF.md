# Brief commun — refonte de l'espace coach (2026-11-05, 23 h)

## Demande de Corentin (ses mots)
« Refonte de l'app côté coach. Sur les exercices : une preview de la vidéo ou la possibilité de mettre une photo. Quand on clique sur
un exercice je ne veux pas les informations en haut de la page mais **à côté**, pour pouvoir le modifier directement. Peut-être quelques
informations en plus sur les exercices. Globalement une refonte complète niveau design et animation côté coach : quelque chose de
**professionnel, pro, et sympa à utiliser** niveau UX, inspire-toi si besoin. » Il a aussi dit : « il faudra revoir l'UX de l'app côté coach
**sur téléphone** ».

## Qui / contexte
Corentin, coach sportif indépendant (coaching à domicile, Rambouillet). ~5-30 clients, beaucoup de seniors et d'adultes actifs.
Il utilise l'espace coach sur **ordinateur ET téléphone** (entre deux séances). Il dicte aussi à Claude (REX) qui remplit l'app par API :
l'interface doit rendre lisible ce que Claude a fait (ex. vidéo « proposée » à valider).
App existante : Vue 3, `src/coach/` (routes : clients, fiche client, alertes, exercices, bibliothèque vidéos, séances + éditeur,
programmes + éditeur, questionnaires + éditeur, agenda, réservations, données). Charte actuelle : `src/styles/tokens.css`
(Syne titres ≤ 600, Albert Sans texte, accent jaune #F2E27A avec texte foncé dessus, jamais de jaune en texte sur fond clair).
Goûts connus (memoire) : rejette « trop sage, pas de waouh », noir pur, titres trop gras ; aime anthracite plutôt que noir, mouvement qui
« emmène quelque part », brut/fonctionnel très lisible pour les outils.
Inspiration : `C:\Users\coren\Documents\REXV2\bibliotheque\design-md\` (lire 2-3 systèmes pertinents, ex. Linear, Stripe, Apple, Notion,
Airbnb ; s'inspirer sans copier les marques). Skills : impeccable, animate, mobile-native.

## À livrer (chaque direction, dans SON dossier `design-coach/<dX>/`)
Une maquette HTML **statique et cliquable** (`index.html` + `assets/`, aucune dépendance réseau sauf polices auto-hébergées copiées depuis
`src/assets/fonts/` ; GSAP autorisé en copie locale si utile), avec **données factices inventées** (jamais de vrais clients) :
1. **Exercices** (écran prioritaire) : liste/grille avec vignette (image de la vidéo YouTube ou photo), recherche, filtres (muscles,
   matériel, catégorie, « vidéo à valider »). Clic sur un exercice → **panneau latéral d'édition** (pas en haut de page) : aperçu vidéo
   lisible sur place (lecteur ou vignette + lecture), ajout/remplacement de **photo** (glisser-déposer), statut vidéo proposé/validé,
   champs modifiables en direct (sauvegarde auto visible) : nom, catégorie, muscles principaux/secondaires, matériel, niveau,
   consignes d'exécution, erreurs fréquentes, variantes (plus facile / plus dur), tempo et repos conseillés, notes privées,
   « utilisé dans N séances ». Sur téléphone : le panneau devient une feuille plein écran (bottom sheet) glissable.
2. **Navigation coach** complète (ordinateur : barre latérale ; téléphone : barre du bas ou équivalent) + **tableau de bord** du jour
   (séances du jour, alertes, check-ins, réservations, actions rapides).
3. **Clients** (liste + fiche client : aperçu, programme, suivi/courbes, réponses, notes privées) — même logique liste + panneau ou page.
4. **Éditeur de séance / programme** (au moins un écran crédible : semaines, séances par jour, blocs exercice/circuit/superset,
   glisser-déposer).
5. Animations soignées et utiles (ouverture du panneau, transitions de liste, feedback de sauvegarde), `prefers-reduced-motion` respecté.
6. `DESIGN.md` (tokens, typo, composants, mouvement, règles) et `LISEZMOI.md` (3 lignes : l'idée de la direction).
7. Captures : `captures/` (1280×800 et 390×844 de chaque écran principal) via Chrome headless ou playwright-cli.

## Contrôles obligatoires avant de rendre
Pas de débordement horizontal à 390 px ; contraste ≥ 4,5:1 (texte) ; cibles tactiles ≥ 44 px ; navigation clavier sur la liste
d'exercices et le panneau (Échap ferme, flèches haut/bas changent d'exercice) ; 0 erreur console ; ouvrir le résultat à l'écran
(captures) et corriger ce qui ne va pas avant de rendre.

## Règles
Travailler UNIQUEMENT dans ton dossier `design-coach/<dX>/` (ne touche pas à `src/`, ni aux autres dossiers). Pas de Git (REX commite).
Port local : 5481 (d1), 5482 (d2), 5483 (d3) ; arrête tes processus (PID vérifiés) avant ton rapport. Préfixe CSS propre.
**Échéance : rendu à 23 h 50.** Rapport ≤ 8 lignes : idée, écrans faits, contrôles, limites.
