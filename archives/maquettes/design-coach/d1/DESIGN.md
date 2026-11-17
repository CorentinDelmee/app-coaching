# DESIGN.md — d1 « Atelier » (espace coach)

**Direction en 3 mots : lumineux, précis, outillé.**
L'évolution premium de la charte de l'app client (Syne / Albert Sans, jaune #F2E27A, clair + anthracite) : coach et client restent
une même marque. Un outil de pro qu'on ouvre entre deux séances : on voit tout d'un coup d'œil, on modifie sur place, on ne perd jamais
sa liste.

## Références retenues (bibliotheque/design-md)
- **Linear** : rigueur des listes (lignes de 64 px, filets fins, une seule couleur d'accent réservée à l'action et au focus), surtitres en
  capitales espacées contre des titres resserrés, panneau latéral qui garde le contexte.
- **Stripe** : densité lisible (chiffres tabulaires, tableaux de KPI séparés par filets de 1 px, méta en gris chaud à 4,5:1 minimum).
- Rien de copié : ni police, ni couleur, ni logo de ces marques.

## Couleurs (préfixe `--at-`)
| Rôle | Valeur | Règle |
|---|---|---|
| Fond papier | `#F4F2EC` | chaud, jamais blanc pur en fond de page |
| Surface | `#FFFFFF` / `#F8F6F1` | cartes, panneau / champs secondaires |
| Anthracite | `#1E1F22` | texte, barre latérale, boutons « valider » ; jamais de noir pur |
| Texte doux | `#5D5A52` | 6,3:1 sur fond, 7:1 sur blanc |
| Méta | `#77736A` | 4,6:1 sur blanc, uniquement petites infos |
| Jaune | `#F2E27A` (survol `#E9D454`) | **uniquement** action principale, sélection, état actif ; toujours texte `#26230A` dessus (12:1) ; jamais en texte sur clair |
| Sélection | jaune 30 % dans le blanc + barre de 3 px | ligne ouverte dans le panneau |
| Validé / À valider / Alerte | `#17684D`/`#E2F1EA` · `#7A4B00`/`#FBEFD3` · `#A3321F`/`#F8E3DD` | pastilles d'état, texte ≥ 5:1 |

## Typographie
- Titres : **Syne 500** (jamais > 600), interlettrage −0,035 em ; H1 `clamp(30px, 4.2vw, 44px)` ; titre de carte 18 px ; nom dans le panneau 28 px.
- Texte : **Albert Sans** 15 px / 1,45, chiffres tabulaires partout (`tnum`).
- Surtitres : 12 px, 600, capitales, +0,12 em (la « taxonomie », à la Linear).
- KPI : Syne 500 32 px, unité en 18 px gris.

## Grille, rayons, ombres
- Ordinateur : barre latérale anthracite 248 px + contenu fluide (marges 16-40 px). Liste + panneau : `grid-template-columns: 1fr 0fr`
  → `1fr min(540px, 46 %)` (fiche client 640 px).
- Téléphone (≤ 900 px) : barre du bas 4 onglets (pastille jaune sur l'onglet actif), panneau → feuille plein écran.
- Rayons : 8 (boutons, champs) · 12 (blocs, encarts) · 18 (cartes) · 24 (panneau).
- Ombres : quasi nulles sur les cartes (1 px + 3 px), une seule vraie ombre portée : le panneau (et la feuille sur téléphone).
- Cibles tactiles ≥ 44 px partout (puces : 36 px visibles + zone étendue invisible).

## Composants
- **Ligne d'exercice** : vignette 16:10 (image de la vidéo, photo, ou dessin si rien) + durée, nom + catégorie·niveau, muscles, matériel,
  pastille d'état vidéo, « N séances ». Les colonnes se retirent par **requêtes de conteneur** quand le panneau réduit la liste.
- **Panneau d'édition** : en-tête collant (surtitre, témoin d'enregistrement, ↑ ↓ ×), nom éditable en place, aperçu vidéo lisible sur
  place, encart « Vidéo proposée par Claude » (Valider / Remplacer), dépôt de photo, usage, puis sections Classement / Exécution /
  Variantes / Notes privées (fond crème = privé).
- **Ce que Claude a fait** : icône étincelle jaune sur pastille anthracite, toujours la même (tableau de bord, encart vidéo, barre latérale).
- **Éditeur** : semaines en onglets, 7 jours (jour vide en pointillés « + Séance »), blocs Exercice / Superset (filet bleu ardoise) /
  Circuit (filet anthracite), poignée de glissement, séries/répétitions éditables en ligne, bibliothèque à droite (glisser ou +).

## Mouvement
| Quoi | Durée | Courbe | Pourquoi |
|---|---|---|---|
| Ouverture du panneau : il glisse de 28 px + fondu, **la liste se resserre** (colonne de grille animée) | 420 ms | `cubic-bezier(.32,.72,0,1)` | on garde sa liste, le panneau « pousse » au lieu de recouvrir |
| Feuille téléphone : montée, suit le doigt, se ferme au-delà de 140 px ou d'un geste vif | 420 ms | idem | geste natif |
| Changement d'exercice (↑ ↓) : contenu du panneau en fondu + 5 px | 200 ms | `cubic-bezier(.23,1,.32,1)` | sentir le changement sans attendre |
| Enregistrement auto : « Enregistrement… » puis **coche qui se dessine** + « Enregistré » | 650 ms de délai, coche 360 ms | idem | rassure sans bouton Enregistrer |
| Filtrage : lignes en cascade (18 ms d'écart, 14 max) | 220 ms | idem | la liste se reconstruit lisiblement |
| Réordonner les blocs (glisser ou Alt + flèches) : FLIP | 240 ms | idem | les voisins s'écartent |
| Appui bouton | 120 ms, scale .97 | idem | réponse immédiate |
Uniquement `transform` / `opacity` (sauf la colonne du panneau, une seule propriété de mise en page animée, sur ordinateur).
`prefers-reduced-motion` : toutes les durées à 1 ms, aucune animation JS.

## Clavier
`/` recherche · ↑ ↓ dans la liste · Entrée ouvre · ↑ ↓ panneau ouvert = exercice précédent/suivant · Échap ferme et rend le focus ·
Alt + ↑ ↓ sur une poignée = déplacer le bloc · ← → dans les onglets de la fiche client.
