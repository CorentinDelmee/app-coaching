# M4 « Ressort » — objets physiques au doigt

**Idée** : tout est un objet qu'on manipule (on le tire, il rebondit un peu, il se transforme) ; la signature est **l'îlot persistant**, une pastille qui vit au-dessus de toutes les pages et se métamorphose (rendez-vous, bouton Démarrer, pastille de séance, repos, plein écran).
**3 mots** : tactile, élastique, électrique.

## Typographie (Google Fonts)
Titres **Sora** 300-500 (jamais plus), texte **DM Sans** 400-600, chiffres **Sora** tabulaires (`tnum` vérifié : `1111` = `0000`).
Échelle : 11,5 micro-étiquettes capitales (+0,09 em) · 13,5 secondaire · 16 texte · 19-23 titres de carte · 30 titre de page · 34-44 gros titres/chiffres de série · 62 champ de détail · 104 sélecteur · 96-104 chronos.

## Palette (variables CSS, `data-ambiance` + `data-accent` sur `<html>`)
`--fond --surface --surface-2 --surface-3 --texte --texte-doux --filet --accent --accent-texte --accent-fort --ilot --phase-prep --phase-repos --scrim --alerte --font-titre --font-texte --font-chiffres`.
- **Ardoise** (défaut) : fond `#1C1F27`, surfaces `#262A35`, texte `#EEF0F5`. **Clair** : fond `#E8EBF1`, cartes blanches. **Nuit profonde** : dégradé bleu nuit vers violet, cartes translucides, flou (`backdrop-filter`) seulement sur la feuille ouverte et le panneau.
- Accents : lime `#C8F25A` (défaut), bleu électrique, violet, menthe, rose, ambre doux ; `--accent-texte` = encre foncée ; `--accent-fort` = accent assombri en ambiance claire (texte et anneaux lisibles).
- Phases du chrono : préparation = bleu ardoise, travail = accent plein, repos/fin = bleu profond.

## Principes de mouvement
- **Une seule variable `p` (1 = à l'origine, 0 = ouvert) pilote tout** dans `M4.coque` : clip-path (forme + rayon), couleur, fondu de la « peau » de la carte, fondu du contenu, vol des éléments partagés (titre), recul de la page de dessous. Ouvrir, fermer et glisser le doigt utilisent le même rendu : tout est interruptible.
- Ressort `ressort(0.12)` (rebond 12 %) pour les pages et l'îlot, `0.07` pour les feuilles et glissements, `0.22` pour les « pop » (pastilles, chiffres). Fermetures : `cubic-bezier(.32,.72,0,1)` (Vaul), 0,5 s. Entrées de contenu : `power4.out`, stagger 45-70 ms. Appui : `scale .97` (propriété `scale`, sans conflit avec GSAP).
- La page de dessous recule (scale .94, voile, rayon 34). Rien n'apparaît de nulle part : carte, bouton, rangée, valeur ou îlot sont toujours l'origine.
- Gestes : `M4.geste` (vélocité sur les 110 derniers ms) pour fermer une page (elle rétrécit vers sa carte au rythme du doigt) et tirer les feuilles à accroches ; Draggable + Inertia pour le swipe entre exercices (retour élastique, un seul cran à la fois), la roue du sélecteur (crans magnétiques, vibration à chaque cran) et le curseur 0-10.
- Animé : `transform`, `opacity`, `clip-path` ; exceptions mesurées (peinture sans mise en page) : anneaux `stroke-dashoffset`, fond de l'îlot et du chrono.
- `prefers-reduced-motion` : fondus de 0,2 s, aucun déplacement ni rebond ; gestes tactiles conservés.

## Transitions (fonction JS)
| Transition | Fonction |
|---|---|
| Carte → page (Coaching, Programme, Overview, Questionnaire, Suivi, Profil) et retour, glisser pour fermer | `M4.nav.ouvrir(nom, élément)` / `M4.nav.fermer()` / `coque.geste()` (ecrans.js) |
| Bouton Menu → feuille, tuile → page | `menuCoque.ouvrir/fermer`, `nav.ouvrir(nom, tuile, {depuisMenu})` |
| Îlot : rdv → Démarrer → séance → repos → plein écran | `M4.ilot.aller(état)` (ilot.js) |
| Îlot Démarrer → séance plein écran | `demarrer()` (seance.js) |
| Swipe entre exercices, auto-avance + « Rester ici » | `allerA(i)`, `demarrerAuto()`, `annulerAuto()` |
| Rangée de série → détail → sélecteur → retour | `ouvrirDetail()`, `M4.selecteur.ouvrir()/valider()` |
| Valider → barre qui devient chrono de repos, +15 s, passer | `validerSerie()`, `afficherFace()`, `demarrerRepos()`, `finRepos()` |
| Série au temps / AMRAP : bouton → chrono plein écran | `lancerChrono()`, `tickChrono()`, `fermerChrono()` |
| Tiroir de séance à accroches | `tiroir.ouvrir(1)` / `tiroir.fermer()` |
| Fin → carte « Cette semaine » (2/3 animé) | `ouvrirFin()`, `M4.majAccueil(true)` |
| Programme semaine ↔ mois (GSAP Flip), W3 qui voyage | `basculer(vue)` |
| Questionnaire : question suivante, curseur, célébration | `afficher(i, dir)`, `finir()` |

## Décisions prises seul (mode absent)
Pages en `clip-path` + vol manuel du titre plutôt que Flip sur width/height (règle « transform/opacity » du brief) ; Flip réservé au calendrier. Le repos vit dans l'îlot ET dans la barre du pouce. EMOM : présent dans l'overview seulement. Séance au temps : préparation 5 s ; AMRAP : 10 s non comptées. Pas de vidéo (pas de ffmpeg, installation refusée) : planches de transitions au ralenti dans `captures/transition-*.png`.

## Revue `review-animations` (constats restants)
| Gravité | Constat | Statut |
|---|---|---|
| Moyen | Pages et feuilles à 0,5-0,66 s : au-dessus de 300 ms, justifié (navigation qui explique d'où on vient) ; à raccourcir à 0,45 s si trop lent à l'usage | Ouvert |
| Moyen | Le clip-path plein écran repeint toute la page à chaque image : à mesurer sur un vrai téléphone moyen (alternative : coque en `scale` + contre-échelle du contenu) | À mesurer |
| Moyen | Sélecteur : 9 `gsap.set` par image pendant le glissement (rotateX, scale, opacity) ; léger sur mobile, à surveiller sur 400 valeurs | Ouvert |
| Faible | Anneaux de chrono animés par `stroke-dashoffset` (peinture, pas de mise en page) | Accepté |
| Faible | Vibrations absentes sur iOS Safari ; bips Web Audio nécessitent un premier toucher | Limite connue |
| Corrigé | `ease-in` sur la pastille qui disparaît, scale(0), hover non filtré, tap pendant l'ouverture, origine mesurée sur une page encore reculée | Fait |

## Limites connues
Pas de reprise de séance après fermeture ni hors ligne (maquette). Suivi et Profil : écran « bientôt ». Une seule séance démo ; « Rejouer » recharge la page. Les liens vidéo ouvrent une recherche YouTube.
