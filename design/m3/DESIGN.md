# M3 « Tableau » — app client Corentin Delmée Coaching

**Idée** : le tableau blanc du box devenu app. Filets épais, cases, chiffres géants, et un mouvement mécanique : volets, compteurs split-flap, whip-pan.
**3 mots** : brut · cinétique · lisible de loin. Ouvrir : `index.html` (serveur statique, port 4103 pendant la conception).

## Polices (Google Fonts)
Titres `--font-titre` Big Shoulders Display 500-600 (condensée, jamais 800+) · texte `--font-texte` Barlow 400/500 · chiffres et étiquettes `--font-chiffres` JetBrains Mono (tabulaires).
Échelle : chrono 150-176 px (empilé MIN / SEC = 40 % de la hauteur) · titres d'écran 64-118 px · nom d'exercice 88 px · valeurs de série 36 px, valeur en détail 124 px · texte 17-19 px · étiquettes mono 12 px, majuscules, +0,1 em.

## Palette (variables, `assets/style.css`)
- Ambiances (`html[data-ambiance]`) : `sombre` ardoise (`--fond #262624`, `--texte #F2F0EA`) · `clair` tableau blanc (`#F4F2EB`, encre `#1B1B19`) · `craie` vert tableau (`#23322B`, `#F1EEE2`). Aussi `--surface`, `--surface-2`, `--texte-doux`, `--filet`.
- Accent (`--accent`, texte `--accent-texte` = encre) : jaune surligneur `#F2E300` (défaut), vert fluo doux `#8BF0A8`, cyan `#4FD8F0`, rose fluo `#FF5FC8`, blanc craie `#F2F0E6`, rouge signal `#FF4A3D`. Pas d'orange, pas de noir pur.
- Phases des chronos : préparation craie, travail = accent, repos cyan (vert si l'accent est cyan), 3 dernières secondes rouge (rose si l'accent est rouge).
- Filets `--ep: 3px`. Boutons : bordure 3 px, ombre dure 5 px qui s'écrase à l'appui, 72 px de haut, pleine largeur en bas.

## Principes de mouvement (constantes `M3.T` / `M3.E` dans `moteur.js`)
- Mouvements secs : `power4.out` partout, `power4.inOut` pour les ouvertures de page (0,78 s) ; `steps(n)` pour les compteurs ; aucun rebond, aucune ease-in sur les entrées.
- Seulement `transform`, `opacity`, `clip-path`. Pas de `filter`. Le « flou de mouvement » du whip-pan = `scaleX 1,28` + opacité 0,35 + filet d'accent qui traverse.
- Signature : **volets** (6 bandes alternées accent / encre qui glissent), **compteur split-flap** (chaque chiffre est une colonne 0-9 qui roule par crans, sens montant ou descendant), **typographie cinétique** (lettres qui montent, mots d'exercice qui entrent par la droite), **store** du menu (bandes qui tombent en cascade, tout vient du bouton).
- Tout vient de l'élément touché : carte → page (clip-path depuis le rectangle), ligne de série → détail, valeur → sélecteur, bande du menu → page. Retour = le chemin inverse, plus rapide (0,62 s).
- `prefers-reduced-motion` : fondus de 0,18 s, compteurs sans crans, pas de déplacement ; l'information reste.
- Temps : `performance.now()` × vitesse de démo (bouton « ×10 », aussi dans le panneau Aa). Aucun comptage de ticks.

## Transitions et fonctions (`assets/`)
| Transition | Fonction | Fichier |
|---|---|---|
| Entrée de l'accueil (volets, lettres, flaps) | `entreeAccueil()` | pages.js |
| Carte → page, page → carte | `ouvrirDepuis(el, id)`, `retour()` | pages.js |
| Menu store, bande → page | `ouvrirMenu()`, `fermerMenu()`, `choisirRubrique()` | pages.js |
| Semaine ⇄ mois (colonnes qui se replient, jours qui se déplient) | `basculerVue(v)` | pages.js |
| W3 qui vole vers sa colonne | `placerW3()` | pages.js |
| Questions (whip-pan), fin, barres de fête | `qSuivant()`, `qFin()`, `M3.fete()` | pages.js |
| Volets entre écrans | `M3.volets(cb, {label, fini})` | moteur.js |
| Whip-pan horizontal | `M3.whip(sortant, entrant, dir)` | moteur.js |
| Compteur split-flap | `M3.flap(el, "07", 'desc')`, `flapMontee()` | moteur.js |
| Chrono sur l'horloge | `M3.creerChrono({duree, onTick, onFin})` | moteur.js |
| Démarrer / quitter la séance | `demarrerSeance()`, `sortirSeance()` | seance.js |
| Exercice suivant (whip-pan, auto + « Rester ici ») | `montrerEtape()`, `proposerSuite()` | seance.js |
| Série → détail, détail → série | `ouvrirSerie()`, `fermerSerie()` | seance.js |
| Valeur → grand sélecteur (roue + crans) | `M3.ouvrirSelecteur({...})` | seance.js |
| Repos, travail, préparation, AMRAP, EMOM | `ouvrirChrono()`, `fermerChrono()`, `lancerRepos()`, `lancerTravail()`, `lancerCircuit()` | seance.js |
| Tiroir d'overview (tirable au doigt) | `ouvrirTiroir()`, `fermerTiroir()` | seance.js |
| Fin de séance, retour 2/3 | `finSeance()`, `M3.maj2sur3()` | seance.js, pages.js |

## Revue `review-animations` (constats restants)
| Constat | Gravité | Décision |
|---|---|---|
| `clip-path` animé (pages, séries, sélecteur) : repeint à chaque image | faible | autorisé par le brief ; fluide en test, à mesurer sur un vieux téléphone |
| Menu : `scaleY` des bandes écrase le texte pendant la chute | voulu | effet « store » ; le texte arrive en `x`/`opacity` par-dessus |
| Compteur flap = 20 nœuds par chiffre | faible | max ~8 chiffres animés en même temps ; `will-change` seulement sur les colonnes |
| Entrées longues (page Coaching ≈ 1,9 s avec compteurs) | faible | l'écran est utilisable dès 0,8 s (verrou relâché à l'ouverture) |
| Barres de fête de la même couleur que le fond quand l'accent est jaune | cosmétique | à varier dans la version Vue |
| Pas de `will-change` permanent hors panneau courant | ok | — |

## Limites connues
- Pas de vidéo `parcours.webm` : ffmpeg absent du PC (non installé, pas de téléchargement). Captures intermédiaires fournies (`*a-*.png`).
- Wake Lock demandé mais non vérifié sur iOS ; vibration absente sur iOS Safari ; bips Web Audio après le premier toucher.
- Séance non sauvegardée hors connexion (maquette) ; le sélecteur à la souris est émulé (glisser + molette).
- Sélecteur de charge : le séparateur décimal en police mono est large (« 16 , 5 »).
- Questionnaire : les réponses ne sont pas stockées. Suivi et Profil : écrans « à venir ».
- Testé : Chrome 155 (390×844, bureau, mouvement réduit). Non testé sur iPhone réel.
