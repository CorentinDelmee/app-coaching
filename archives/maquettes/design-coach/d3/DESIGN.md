# DESIGN.md — d3 « Studio » (espace coach)

**Direction en 3 mots : visuel, chaleureux, en mouvement.** L'exercice est un objet qu'on voit bouger avant de le lire.
Préfixe CSS : `st-`. Fichiers : `index.html`, `assets/studio.css`, `assets/studio.js`, `assets/donnees.js` (factice).

## Références (inspiration, rien copié)
- **Airbnb** : grandes vignettes 4:3 en grille, cartes blanches sur fond chaud, la photo d'abord, le texte court dessous.
- **Notion** : teintes pastel par catégorie (pêche, rose, menthe…) avec texte foncé de la même famille ; ici une teinte = un groupe musculaire.
- **Apple (Fitness / Store)** : titres très grands mais légers, cartes utilitaires à rayon généreux, mouvement doux et physique.

## Couleurs
| Rôle | Valeur | Note |
|---|---|---|
| Fond « lin » | `#F4F1EC` | chaud, jamais blanc pur en fond |
| Surface | `#FFFFFF` · surface 2 `#EDE8E0` | |
| Encre (anthracite) | `#23252B` | jamais de noir pur |
| Texte doux | `#5C5F66` | 5,7:1 sur le fond, 6,4:1 sur blanc |
| Accent | `#F2E27A` + texte `#26230A` (12:1) | charte actuelle : jaune toujours en aplat, jamais en texte sur clair |
| Proposé (Claude) | `#7A5A00` sur `#FFF1C2` (5,7:1) | statut « à valider » |
| Validé | `#1B6B4C` sur `#DDF3E9` | |
| Alerte | `#A23B2A` sur `#FBE4DE` (5,4:1) | |

**Groupes musculaires** (pastel de fond / encre, toutes ≥ 6:1) : jambes `#F7D9C4/#7A3412` · dos `#CFE3F5/#18476E` ·
pectoraux `#F5D0D6/#7E2234` · épaules `#E3D6F5/#4B2C7A` · bras `#D3EEDB/#1C5C35` · gainage `#F3E7B8/#5E4A00` ·
mobilité `#CDEDEC/#135955` · cardio `#F9D5B8/#7C3A05`. Un attribut `data-m="dos"` pose `--mc`/`--mi` : vignette, puce, filtre,
pastille d'avatar, liseré de bloc dans l'éditeur, bandeau de fiche client — la couleur suit le muscle partout.

## Typographie
- Titres : **Syne 500** (jamais > 600), interlettrage −0,035em. Titre de page `clamp(34px, 5vw, 56px)`, 40 px sur téléphone ;
  nom d'exercice dans le panneau 30 px ; titres de bloc 20 px.
- Texte : **Albert Sans** 15 px / 1,45 ; méta 12,5–13,5 px ; étiquettes de section 12 px capitales espacées .1em.
- Chiffres (heures, KPI, tempo) en Syne 500 : ils donnent le caractère.

## Grille, rayons, ombres
- Ordinateur : barre latérale 248 px + contenu fluide (marges 16–40 px). Grille d'exercices `auto-fill minmax(190px)` ;
  panneau ouvert = 2 colonnes `1fr | 400–460px` (le panneau est **à côté**, collant en haut).
- Téléphone (≤ 900 px) : barre d'onglets flottante en bas (anthracite, onglet actif en aplat jaune), grille 2 colonnes,
  panneau et fiche = feuille plein écran glissable.
- Rayons : 28 (panneau, fiche) · 20 (cartes) · 14 (boutons, champs) · pilules 13–20.
- Ombres : niveau 1 (repos), niveau 2 (survol, sélection), niveau 3 (panneau, toast).
- Densité : bascule **Grandes vignettes / Liste compacte** (lignes de 76 px, 200 exercices parcourables), recherche
  sans accents, filtres muscles (avec secondaires), matériel, catégorie, « Vidéo à valider ».

## Composants
- **Carte d'exercice** : média 4:3 teinté du muscle (photo, image YouTube ou, à défaut, figure animée), puce « À valider » /
  « Sans vidéo », durée, bouton lecture ; nom (2 lignes max) + muscle · matériel.
- **Panneau d'édition** : média 16:9 + barre (fermer, précédent, suivant, état d'enregistrement), nom éditable en titre,
  statuts, encart « Claude a proposé cette vidéo » + Valider (toast avec Annuler), tempo / repos / niveau, « utilisé dans
  N séances », média (lien YouTube, dépôt de photo par glisser-déposer ou fichier), classement (muscle principal,
  secondaires en jetons colorés, matériel, catégorie, niveau segmenté), exécution (consignes, erreurs, plus facile /
  plus dur), notes privées (fond crème).
- **Sauvegarde auto** : chaque saisie → « Enregistrement… » (anneau) puis « Enregistré » avec coche qui se trace ; la carte de
  la grille se met à jour.
- **Carte client** : avatar initiales teinté + anneau de progression (assiduité), 2 lignes d'info, pourcentage.
- **Fiche client** : bandeau teinté, onglets à soulignement glissant (Aperçu, Programme, Suivi, Réponses, Notes privées),
  KPI, courbe SVG qui se dessine.
- **Éditeur** : semaines S1–S6, 7 colonnes de jours, blocs Exercice / Superset / Circuit (liseré couleur muscle, circuit en
  anthracite), bibliothèque à glisser ; au toucher : toucher un jour puis un exercice.

## Mouvement
| Quoi | Durée | Courbe | Pourquoi |
|---|---|---|---|
| Survol carte | 220 ms | ressort `cubic-bezier(.34,1.4,.64,1)` | la carte « se soulève » |
| Appui (carte, bouton, jeton) | 80–120 ms | ease-out, scale .92–.97 | réponse immédiate au doigt |
| **Élément partagé** : vignette → en-tête du panneau | 500–520 ms | `cubic-bezier(.32,.72,0,1)` | on voit où l'exercice « va » ; c'est le moment fort |
| Contenu du panneau | 420 ms, cascade 40 ms | expo-out | lecture de haut en bas |
| Feuille basse (téléphone) | 500 ms | même courbe (type Vaul) | suit le doigt, se ferme si glissée > 140 px ou vite |
| Aperçu du mouvement | 1,6 s en boucle | ease-in-out | au survol (souris) ou appui long 380 ms (doigt) |
| Filtrage | 380 ms, décalage 18 ms (16 premières cartes) | expo-out | la liste se recompose sans saut |
| Onglets fiche | 420 ms | Vaul | le soulignement glisse |
| Courbe de suivi | 1,1 s | expo-out | la progression se dessine |

Uniquement `transform` / `opacity` (et `stroke-dashoffset` pour les tracés). `prefers-reduced-motion` : animations et transitions
ramenées à 1 ms, pas d'élément partagé, pas de boucle d'aperçu.

## Règles
- La couleur d'un muscle n'est jamais le seul indice : le nom est toujours écrit à côté.
- Ce que Claude a fait est **toujours étiqueté** (« Vidéo proposée par Claude », « à partir de ta dictée de 21 h 40 »).
- Clavier : `/` recherche · ↑ ↓ changent d'exercice (panneau ouvert) ou déplacent le focus dans la grille · ← → dans la grille ·
  Échap ferme et rend le focus à la carte.
- Cibles ≥ 44 px (filtres 40 px + zone élargie à 46 px). Pas de débordement horizontal à 390 px.
