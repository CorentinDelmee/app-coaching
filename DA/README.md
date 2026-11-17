# Direction artistique — Corentin Delmée Coaching

> Référence pour **tout ce qu'on crée ensuite** : écran de l'app, visuel réseaux, document client, page web.
> Tirée du **rendu réel** de l'app (relevé dans Chrome le 2026-11-17), pas des anciennes maquettes.
> Planche visuelle : **`DA/index.html`** (double-clic). Valeurs : **`DA/tokens.json`** (source unique) → `DA/tokens.css` (`node DA/outils/generer-tokens.mjs`).
> Contrôle : `node DA/outils/concordance.mjs` (tokens.json ↔ feuilles de l'app). Écarts relevés : `DA/ECARTS.md`.

## 1. Personnalité en 5 phrases
1. **Un jaune pâle et lumineux, posé en aplat, jamais en texte sur fond clair** (en sombre et bleu, il peut servir de texte d'accent, 12 : 1) : c'est la signature ; il désigne la chose à faire maintenant (la séance du jour, le bouton principal).
2. **De grands titres légers** (Syne 400-500, serrés) sur un texte calme et très lisible (Albert Sans) : présents sans crier.
3. **Des cartes douces et généreuses** (rayons 20-28 px) sur un fond neutre — **perle froide côté client, lin chaud côté coach** — avec de la profondeur (ombres longues, pages qui reculent).
4. **Anthracite, jamais noir pur** ; un seul accent, des couleurs d'état sobres, des pastels uniquement pour classer (groupes musculaires).
5. **Le mouvement emmène quelque part** : la carte devient la page, le bouton s'ouvre en cercle ; le doigt est servi en 100 ms, rien ne saute.

## 2. À faire / à ne pas faire
| À faire | À ne pas faire |
|---|---|
| Jaune en **aplat** avec texte `#26230A` dessus (12 : 1) | Jaune en texte ou en trait sur fond clair (1,04 : 1 sur la perle) |
| Un seul élément jaune « héros » par écran / visuel | Plusieurs aplats jaunes qui se disputent |
| Titres Syne 400-500, interlettrage négatif | Syne en gras (> 600), titres en capitales |
| Anthracite `#1B1D20` (client) / `#23252B` (coach) | Noir pur `#000`, gris neutres froids sur le lin |
| Rayons 20-28 px, cartes sur fond teinté | Coins carrés, bordures épaisses, cartes blanches sur fond blanc |
| Capitales seulement pour les étiquettes 12 px espacées (+.14 em) | Capitales pour les titres ou les boutons |
| Phases de séance : jaune = effort, bleu ciel = repos, inverse = préparation | Rouge/vert « feu tricolore » pour les phases |
| Pastel + encre de la même famille + nom écrit (muscles) | Couleur seule pour porter une information |
| Animer `transform` / `opacity` ; texte jamais sous .9 d'opacité en entrée | Fondu jaune ↔ encre (donne du kaki), animer hauteur/ombre/flou |

## 3. Palette (contrastes WCAG mesurés)
**Marque** — jaune `#F2E27A` · texte sur jaune `#26230A` (**12,0**) · encre `#1A1B1E` + crème `#F1F2EF` (**15,3**) · validé `#46D9A8` + `#0F2A22` (**8,6**).

**Client — 3 ambiances** (choix dans le Profil ; clair par défaut)
| Rôle | Clair (perle) | Sombre (graphite) | Bleu profond |
|---|---|---|---|
| fond / surface / surface-2 | `#E3E5E8` / `#FFFFFF` / `#EEF0F2` | `#202224` / `#2B2E31` / `#363A3E` | `#141B33` / `#1F2A4D` / `#2A3866` |
| texte sur fond | `#1B1D20` **13,4** | `#F1F2EF` **14,2** | `#EAF0FF` **14,9** |
| texte-doux sur surface | `#565B62` **6,8** (5,4 sur fond) | `#A4A8AA` **5,7** (4,78 sur surface-2) | `#97A4CC` **5,7** (4,58 sur surface-2) |
| accent en texte | encre (jamais jaune) | jaune **12,1** | jaune |
| repos (fond / chiffres) | `#CFE0F2` / `#16233D` **11,6** | `#2A3F6B` / `#E8EEFA` **8,9** | `#31508F` / `#F2F6FF` **7,3** |
| préparation | `#1B1D20` / `#F1F2EF` **15,0** | inverse | inverse |

**Coach — Studio** (lin) : fond `#F4F1EC`, surface `#FFFFFF`, surface-2 `#EDE8E0`, encre `#23252B` (**13,6**), texte `#2B2D33` (**12,2**), doux `#5C5F66` (**5,7** / 6,4 sur blanc).
États (texte / fond) : validé `#1B6B4C`/`#DDF3E9` **5,6** · alerte `#A23B2A`/`#FBE4DE` **5,4** (blanc sur alerte **6,6**) · proposé par Claude `#7A5A00`/`#FFF1C2` **5,7**.
Muscles (pastel / encre, toutes ≥ 6,2) : jambes `#F7D9C4/#7A3412` · dos `#CFE3F5/#18476E` · pecs `#F5D0D6/#7E2234` · épaules `#E3D6F5/#4B2C7A` · bras `#D3EEDB/#1C5C35` · gainage `#F3E7B8/#5E4A00` · mobilité `#CDEDEC/#135955` · cardio `#F9D5B8/#7C3A05`.

**Règle d'usage des neutres** : ce que voit un **client** (app, PDF, visuel réseaux, site) = perle ; ce que voit le **coach** (Studio, outils internes) = lin.

## 4. Typographie
| Rôle | Police | Taille relevée | Détail |
|---|---|---|---|
| Display (« Fabien ? ») | Syne 400 | 54-68 px | interligne .98, −.045 em |
| Titre de page / d'exercice | Syne 400-500 | 36-42 px (client) · 34-56 px (Studio, 40 tél.) | interligne 1.02, −.03 à −.05 em |
| Titre de carte / bloc | Syne 400-500 | 20-21 px | −.02 em |
| Grands chiffres (date, KPI) | Syne 500 | 30-56 px | chiffres tabulaires |
| Chrono | Barlow Semi Condensed 600 | 112-124 px | provisoire (Inter Tight / Azeret Mono possibles) |
| Texte | Albert Sans 400 | 16 px client / 15 px Studio | interligne 1.4-1.45 |
| Bouton | Albert Sans 600 | 18 px (client, 68 px de haut) / 15 px (Studio, 44 px) | |
| Étiquette | Albert Sans 500-600 | 12 px | CAPITALES, +.14 em (client) / +.1 em (Studio) |
Grand affichage (client) : toutes les tailles × 1,2 (`--e`). Plancher : **12 px**. Polices auto-hébergées dans `DA/polices/` (licence OFL).

## 5. Grille et espacements
Échelle unique **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40** (`--esp-*` client, `--st-e-*` Studio). Gouttière 16 px téléphone (20 px tableau de bord client ; 16-40 px Studio ordinateur).
Texte ≥ 16 px du bord d'un bouton, ≥ 12 px d'une carte ou d'un champ ; 8 px entre deux boutons ; cibles ≥ 48 px client, 44 px Studio.
Client : mobile d'abord (390 px), cadre centré sur ordinateur, action principale pleine largeur dans le tiers bas. Studio : barre latérale 248 px (> 900 px), barre d'onglets flottante encre en bas (≤ 900 px), panneau d'édition **à côté** (440 px) ou feuille plein écran.
Rayons : 28 cartes/pages/panneau · 22 boutons client · 20 cartes Studio · 14 boutons/champs Studio · 15 puces · pilule = moitié de la hauteur.
Ombres : client longues et douces (`0 34px 60px` couleur `--ombre`) ; Studio en 3 niveaux (repos très léger, survol, panneau).

## 6. Composants signature
- **Carte du jour** (client) : aplat jaune pleine largeur, rayon 28, étiquette « AUJOURD'HUI », titre Syne 40+, puces « ≈ 40 min · 6 exercices » sur jaune assombri, rond encre avec flèche, numéro géant en contour (« W2 ») en décor.
- **Tuiles du tableau de bord** : grille 2 colonnes, rayon 28, une tuile encre (Coaching : date géante Syne), anneau d'assiduité SVG (trait jaune sur gris).
- **Bouton principal** : client = aplat jaune 68 px, rayon 22, Albert Sans 600 18 px ; doux (surface-2) ; contour (filet 2 px). Studio = 44 px, rayon 14, jaune / encre / blanc à filet.
- **Bouton rond** 52 px (retour, menu) : surface, icône 22 px.
- **Puces** : surface-2 ou pastel du muscle, 13 px 600, rayon pilule ; puce d'état Studio = point coloré + libellé (« ● Douleur »).
- **Onglets segmentés** (Semaine / Mois) : fond surface, onglet actif = aplat jaune qui **glisse**.
- **Écran de séance** : une page par exercice ; titre Syne 30 px ; puces de consigne ; lignes de série (surface, rayon 22, numéro dans un rond jaune pour la série en cours, cadre encre 2,5 px) ; bouton « Valider la série » jaune en bas ; repos = écran bleu ciel plein, phrase « Respirez. », chrono Barlow 112 px dans un anneau qui se vide.
- **Carte d'exercice** (Studio) : média 4:3 teinté du muscle (photo, miniature YouTube ou figure animée), puce « À valider », nom + « ● muscle ».
- **Graphiques** : SVG maison, traits arrondis, jaune pour la valeur, gris (filet) pour la piste, courbe qui se dessine (`stroke-dashoffset`).

## 7. Iconographie
Tracés maison sur grille 24 × 24, **trait arrondi** (bouts et angles ronds), `currentColor`, pas de remplissage sauf « lecture » et points.
Client : trait **2,2 px**, affichées à 18-22 px (plus franches, lisibles en salle). Studio : trait **1,8 px**, 20 px (outil de bureau, plus fin).
Une nouvelle icône = mêmes règles, ajoutée dans `src/components/Icone.vue` ou `src/coach/studio/IconeSt.vue`. Pas d'icônes de bibliothèque mélangées, pas d'emoji.

## 8. Mouvement
| Quoi | Durée | Courbe |
|---|---|---|
| Appui (s'enfoncer à .97) | 100 ms, relâche 320 ms rebondie | `--ressort` `cubic-bezier(.34,1.45,.64,1)` |
| Carte → page, menu (client) | 850 ms | expo.inOut : on voit d'où l'on vient |
| Série validée → repos | 500 ms, cercle depuis le bouton | expo.out |
| Changement de phase / circuit | balayage de bas en haut | jamais de fondu |
| Page Studio qui entre (aucune sortie) | 240 ms, 6 px (onglet) ou 20 px (plus profond) | `cubic-bezier(.16,1,.3,1)` |
| Panneau / feuille / élément partagé (Studio) | 420-500 ms | Vaul `cubic-bezier(.32,.72,0,1)` |
| Chargeur | après 250 ms d'attente, visible ≥ 400 ms | CSS seul |
Seulement `transform` / `opacity` (+ tracé SVG). Texte qui entre : opacité depuis .9 au minimum. `prefers-reduced-motion` : plus de déplacement (Studio : 1 ms partout ; client : fondus courts).
Pendant une série : aucune animation lourde. Vidéos/réseaux : même grammaire (aplat qui s'ouvre en cercle, titres qui montent par ligne masquée).

## 9. Voix des textes
- **Client : vouvoiement**, phrases courtes et chaleureuses, verbe d'action : « Prêt, Fabien ? », « Votre séance guidée pas à pas, même sans réseau », « Respirez. », « Tenez bon. », « Valider la série 1 ».
- **Coach (Studio) : tutoiement** (c'est Corentin qui lit) : « Bonsoir Corentin. », « Ta journée », « 80 mouvements dans ta bibliothèque », « Vérifie qu'elle montre la bonne exécution ».
- Prénom du client en titre ; chiffres concrets (« ≈ 40 min », « 2 séances à faire ») ; pas de jargon anglais côté client sauf « Workout » (nom de séance établi) ; pas de points d'exclamation en série, pas d'emoji.
- Vocabulaire fixé : « Rendez-vous » = coaching dans l'agenda ; « Séance » = contenu d'entraînement.

## 10. Créer un nouvel élément — checklist en 10 points
Pour **un écran**, **un visuel réseaux**, **un PDF / document client** ou **une page web** :
1. **Qui le voit ?** Client → fond perle `#E3E5E8`, vouvoiement. Coach → lin `#F4F1EC`, tutoiement.
2. **Importer `DA/tokens.css`** (ou les tokens de l'app) : aucune couleur, taille ou durée écrite en dur.
3. **Un seul héros jaune** (aplat, texte `#26230A`) : l'action ou l'information principale. Rien d'autre en jaune.
4. **Titre en Syne 400-500**, interlettrage −.03 à −.045 em ; texte en Albert Sans ; étiquettes 12 px capitales espacées.
5. **Cartes rayon 20-28**, gouttière 16 px (téléphone) ou multiple de 8 ; espacements uniquement sur l'échelle 4-8-12-16-20-24-32-40.
6. **Contraste ≥ 4,5 : 1** pour tout texte (≥ 3 : 1 au-dessus de 24 px), mesuré dans chaque ambiance concernée ; plancher 12 px.
7. **Cibles ≥ 48 px** (client) / 44 px (coach), action principale en bas et pleine largeur sur téléphone.
8. **Icônes** maison, trait arrondi (2,2 client / 1,8 coach), `currentColor` ; images : vraies photos de Corentin ou des exercices, jamais de banque d'images « fitness » génériques.
9. **Mouvement** (si animé) : transform/opacity, appui 100 ms, navigation qui montre d'où l'on vient, `prefers-reduced-motion` respecté.
10. **Contrôle final** : capture à 390 px et 1366 px (ou au format cible : 1080 × 1080, A4), comparer à `DA/index.html` côte à côte, `node DA/outils/concordance.mjs` si les tokens ont bougé.
Spécifique — **visuel réseaux** : gabarit `DA/gabarits/reseaux-carre.html` (1080 × 1080), texte ≥ 40 px, marge 72 px. **Document client** : `DA/gabarits/document-client.html` (A4, impression en PDF par le navigateur), fond blanc à l'impression, perle en en-tête. **Partage d'une séance** : `DA/gabarits/carte-seance.html` (1080 × 1350). **Page web** : mêmes tokens que le client ; titre display Syne 54-68 px, sections en cartes perle/blanc, un CTA jaune.

## Doutes à trancher (Corentin)
- **Logo** : l'icône de l'app est encore le « CD » framboise de M1 ; le Studio a un rond jaune sur carré encre. Recommandation : un seul signe, **rond jaune sur carré encre** (déjà dans le Studio, cohérent avec le jaune), décliné en icône PWA. Rien n'est changé tant que tu n'as pas choisi.
- **Police du chrono** : Barlow Semi Condensed reste provisoire (Inter Tight / Azeret Mono disponibles).
- **Deux neutres** (perle client / lin coach) : gardés comme règle ; l'alternative serait de passer le client en lin pour une marque unique et plus chaude.
