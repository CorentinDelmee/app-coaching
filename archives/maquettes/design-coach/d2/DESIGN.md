# d2 « Console » — système de design de l'espace coach

**Direction en 3 mots : dense, rapide, précis.** Un poste de pilotage : on enchaîne au clavier, on édite sans quitter la liste,
le jaune ne sert qu'à signaler (sélection, action principale, ce qui attend).

## Références retenues (inspiration, pas de copie)
- **Linear** : échelle de surfaces sans ombre (fond → s1 → s4), filets de 1 px, typo unique à graisses étroites, mono pour les identifiants.
- **Raycast** : palette de commandes (Ctrl+K) comme point d'entrée universel, raccourcis affichés à côté de chaque action.
- **Vercel** : tableaux compacts, statuts en pastilles sobres, chiffres en mono.

## Couleurs (anthracite, jamais de noir pur)
| Jeton | Valeur | Usage |
|---|---|---|
| `--cs-bg` | #16171A | fond de page |
| `--cs-s1` … `--cs-s4` | #1C1E22 / #23252A / #2B2E34 / #34373E | cartes, survol, sélection, relief |
| `--cs-line` / `-2` / `-3` | blanc 7 % / 12 % / 20 % | filets, bordures de champ, pointillés |
| `--cs-ink` / `-2` / `-3` | #EDEEF0 / #B7BBC2 / #9196A0 | texte / secondaire / méta (≥ 5,6:1 sur le fond) |
| `--cs-acc` | #F2E27A (jaune de la marque) | **signal** : action principale, sélection, en cours, focus. Texte posé dessus : `--cs-acc-ink` #26230A |
| statuts | ok #5ED6A2 · attention #EDB56A · alerte #F28B8B · info/Claude #8DB6F5 | toujours en pastille : texte coloré sur fond teinté à 12 % |

Règles : un seul aplat jaune par zone ; le bleu « info » est réservé à ce que **Claude** a fait (vidéo proposée) ;
notes privées = fond teinté jaune à 4 %.

## Typographie
- **Inter Tight** (variable, 400-600) pour toute l'interface ; 14 px de base sur ordinateur, 15 px sur téléphone.
- **Syne 500** pour les titres de page et le nom dans le panneau (lien avec la charte du site, jamais > 600).
- **Azeret Mono 500** pour les chiffres, heures, identifiants (EX-021), tempo, repos, raccourcis (`.cs-kbd`).
- Échelle : 11 (étiquette) · 12 (méta) · 13 (puces, boutons) · 14 (texte) · 20-22 (titre) · 26 (KPI mono).

## Grille, rayons, relief
- Ordinateur : barre latérale 232 px + contenu fluide ; panneau d'édition 480 px (420 px sous 1100 px) fixé à droite :
  la liste se resserre (média · nom · statut) au lieu d'être recouverte.
- Téléphone (≤ 760 px) : barre du bas à 5 entrées (bouton central jaune = palette de commandes), lignes → cartes,
  panneau → feuille plein écran glissable (tirer vers le bas > 120 px ou geste rapide = fermer).
- Rayons : 6 (lignes de nav) · 8 (boutons, champs) · 12 (cartes, palette) · 16 (haut de la feuille mobile).
- Pas d'ombre sauf éléments flottants (panneau, palette, toast). Hiérarchie par surfaces et filets.

## Composants
`cs-btn` (normal / `--acc` / `--ghost` / `--icon`), `cs-kbd` (touche), `cs-pill` (statut à point), `cs-chip` (filtre en pointillé,
plein quand actif), `cs-table` / `cs-tr` (ligne 52 px, barre jaune de 2 px à gauche = sélection), `cs-xcard` (vignette),
`cs-panel` (en-tête : id + statut + indicateur de sauvegarde ; pied : raccourcis), `cs-inline` (champ invisible qui se révèle au survol,
bordure jaune au focus), `cs-tokens` (muscles/matériel : Entrée ajoute, Retour arrière retire), `cs-levels` (niveau 1-5),
`cs-cmd` (palette), `cs-toast`, `cs-block` (éditeur : liseré bleu = circuit, orange = superset).

## Mouvement — rapide et précis, aucun effet décoratif
| Quoi | Durée | Courbe | Pourquoi |
|---|---|---|---|
| survol, appui (`scale(.97)`) | 90 ms | linéaire | réponse immédiate |
| palette de commandes, toast | 140 ms | `cubic-bezier(.16,1,.3,1)` | apparaît sous le doigt, sans attente |
| panneau / feuille, entrée de page | 200 ms | idem | le panneau glisse du bord d'où il vient |
| changement d'exercice dans le panneau | 160 ms | idem | fondu court + 3 px : on voit que le contenu a changé |
| filtrage de la liste | 200 ms, décalage 12 ms/ligne | idem | les lignes « se posent » |
| sauvegarde auto | point orange pulsé → « Enregistré » vert 450 ms → « À jour » | | la sauvegarde se voit sans bloquer |
Uniquement `transform` et `opacity` (et la colonne de padding du contenu). `prefers-reduced-motion` : toutes les durées à 1 ms.

## Clavier (affiché dans l'interface)
Ctrl+K palette · `/` recherche · `N` nouvel exercice · `S` séance · `G` puis `D/E/C/P` navigation · ↑↓ (ou J/K) changer d'exercice ·
Entrée ouvrir · Échap fermer (dans un champ : quitte le champ, 2e Échap ferme) · `V` valider la vidéo proposée.

## Règles
- Toute action principale a son raccourci visible ; toute action existe aussi à la souris et au doigt (cibles ≥ 44 px sur téléphone).
- Ce que Claude a rempli est toujours marqué (pastille bleue « À valider » + bandeau dans le panneau).
- Contraste ≥ 4,5:1 pour tout texte ; focus visible = contour jaune 2 px.
