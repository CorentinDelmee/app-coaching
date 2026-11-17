# Maquette V2 consolidée — système de design (app client)

Source de vérité du style pour la mise à jour de l'app Vue. Décisions et justifications : `NOTES.md`.
Base **M5 « Profondeur »** enrichie de M1, M2 et M4 selon `RETOURS-MAQUETTES-V1.md`.

**Direction en 3 mots** : profondeur · net · énergique.
**Références retenues** : uniquement les maquettes V1 (le brief les impose) — M5 (style, menu, pages),
M1 (lisibilité de séance, sélecteur, couleur de circuit), M2 (chronos, check-in, circuits), M4 (rebonds
mesurés, temps total, détail des circuits). La bibliothèque `bibliotheque/design-md/` n'a pas été rouverte :
la V2 consolide un style déjà choisi par Corentin, elle n'en invente pas un nouveau.

## Couleurs (variables CSS, `assets/style.css` en tête de fichier)
| Rôle | Variable | Valeur |
|---|---|---|
| Accent jaune (fonds, boutons, aplat) | `--jaune` / `--accent` | `#FFD43B` |
| Texte posé sur le jaune (toujours) | `--encre` / `--accent-texte` | `#1A1B1E` |
| Accent utilisé comme trait/texte sur le fond | `--accent-lisible` | clair : `#1B1D20` (jamais de jaune sur clair) · sombre / bleu : `#FFD43B` |
| Texte de l'aplat du dashboard | `--aplat-texte` | foncé `#1A1B1E` (reco) ou blanc |
| Validé | `--ok` / `--ok-texte` | `#46D9A8` / `#0F2A22` |

| Ambiance (`html[data-ambiance]`) | fond | fond-profond | surface | surface-2 | texte | texte-doux | repos (fond / texte) | prépa (fond / texte) |
|---|---|---|---|---|---|---|---|---|
| `clair` (défaut) | `#E3E5E8` | `#D2D5DA` | `#FFFFFF` | `#EEF0F2` | `#1B1D20` | `#565B62` | `#CFE0F2` / `#16233D` | `#1B1D20` / `#F1F2EF` |
| `sombre` | `#202224` | `#16181A` | `#2B2E31` | `#363A3E` | `#F1F2EF` | `#A4A8AA` | `#2A3F6B` / `#E8EEFA` | `#F1F2EF` / `#1B1D20` |
| `bleu` (bleu profond) | `#141B33` | `#0B1024` | `#1F2A4D` | `#2A3866` | `#EAF0FF` | `#9DAAD0` | `#31508F` / `#F2F6FF` | `#EAF0FF` / `#141B33` |

Teintes de carte / page (M5) : `data-teinte="accent | inverse | surface | encre | aplat"` posent `--tb` (fond) et `--tf` (texte).
Phases de chrono : préparation = `prep`, travail = jaune + encre, repos = `repos`. La section circuit = teinte `inverse`.

## Typographie (M5)
- Titres : **Syne 500** (jamais plus de 600). Texte : **Albert Sans** 400-700. Chiffres d'interface : **Syne**.
- Chronos et compteurs d'effort : `--font-chrono` = **Barlow Semi Condensed 600** (reco), Inter Tight 600 ou Azeret Mono 500 (toutes à chiffres tabulaires vérifiés).
- Toutes les tailles passent par `--e` (1 ou 1,2 en Grand affichage) ; chronos par `--e-chrono` (1 ou 1,12).
- Échelle : étiquette 12 (capitales +0,12 em) · texte 15-17 · titre de bloc 22 · titre de page 36-42 · nom d'exercice 36-42 · valeurs de série 38 · champ 92 · sélecteur 108 · chrono jusqu'à 124 · compteur de tours 96-150.

## Mise en page
Mobile d'abord (390 × 844), cadre centré sur ordinateur. Marges 16-20 px, rayons 28 (cartes, pages) / 22 (lignes, boutons) / 14 (étiquettes).
Zones à toucher ≥ 48 px (`--cible`). Action principale dans le tiers bas, toujours visible (collante en Grand affichage).
Séance : **une page entière par exercice ou circuit**, pas de cartes. Overview : **une section par bloc** (A, B, C, Option).

## Mouvement
Constantes uniques dans `assets/noyau.js` : `T` (durées) et `E` (courbes).
- Navigations (carte → page, menu, rubrique) 0,85 s `expo.inOut` : elles expliquent d'où l'on vient (M5).
- Actions fréquentes (valider une série → repos) : cercle 0,5 s `expo.out` depuis le bouton touché.
- Glissement entre exercices 0,7 s (M2), titres en lignes masquées, contenu en cascade 60-70 ms.
- Rebonds M4 « avec mesure » : `back.out(1.4)` (ressort) / `back.out(1.7)` (pastilles) ; appui en CSS : 100 ms à l'enfoncement, 320 ms rebondi au relâchement.
- Changement de couleur d'écran (circuit, phases du chrono) : **balayage** de bas en haut, jamais de fondu jaune/encre (couleur kaki).
- Seulement `transform`, `opacity`, `clip-path` (+ trait SVG des anneaux, assumé). `prefers-reduced-motion` : fondus courts, plus de déplacement.

## Composants clés (fichier)
Menu push-back (`noyau.js`), aplat + message d'accueil (`ecrans.js`), encart exercice et sections de bloc (`ecrans.js`, `v2.css`),
page exercice / série / sélecteur / chrono (`seance.js`), section circuit (`circuit.js`), check-in (`checkin.js`),
profil (ambiance + Grand affichage, `ecrans.js`), panneau de comparaison (`config.js`).
