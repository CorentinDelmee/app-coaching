# M1 « Atelier » — l'héritière de M3
**Idée** : l'esprit « lourd, net, chaleureux » du site, transposé en app : tout s'ouvre en **clip-path depuis l'élément touché**.
**3 mots** : lourd · net · chaleureux. Lancer : `node` serveur statique sur `design/m1/` (port 4101) ou ouvrir `index.html`.

## Polices et échelle (Google Fonts, graisses 300-500 pour les titres)
Titres/chiffres **Unbounded 400** (jamais 700) · texte **Onest 400-600** · chronos en **Onest tabulaire** (Unbounded n'a pas de chiffres tabulaires fiables).
Échelle : chrono 150/112 · sélecteur 112 · valeur de champ 96 · hero 41-48 · titre de page 34 · exercice 31 · corps 16-19 · étiquettes 12-13 (capitales, +.09em).

## Palette (variables : `--fond --surface --surface-2 --texte --texte-doux --accent --accent-texte --accent-lisible --filet`)
| Ambiance | fond | surface | texte | accent |
|---|---|---|---|---|
| sombre (défaut) | #25221F | #302C28 | #F3EDE4 | `--couleur` |
| clair | #F4EEE3 | #FBF8F2 | #26211D | `--couleur` (texte d'accent assombri) |
| aplat | `--couleur` | couleur + 14 % d'encre | #1F1B18 | encre #1F1B18 (cartes héros inversées) |
Accents : framboise #E5486A (défaut) · lagon #2FB8B0 · citron #D8E04A · sauge #9DC08B · lilas #A99BEA · corail rosé #F28C86. Texte sur accent : encre #1F1B18.
Phases du chrono : `--ph-prep|travail|repos-bg/fg` (travail = accent, repos = bleu nuit / bleu glacé, prépa = neutre). Rayons : cartes 26, boutons 22, tuiles 22-24.

## Principes de mouvement (GSAP 3.13, `anim.js` : constantes `T` et `E`)
- **Entrée lente et nette, sortie rapide** : ouverture de page 0,85 s `expo.inOut`, fermeture 0,52 s `power4.inOut` ; série/valeur 0,62 s `power3.out` (action fréquente, réponse immédiate) / 0,42 s ; cercles 0,72 s `power4.inOut` / 0,46 s.
- La page naît du **rectangle de la carte** (inset arrondi → plein écran) ; un **voile de la couleur de la carte** (avec un clone de la carte) fait le lien, puis se relève comme un rideau (clip) et le contenu monte en **cascade** (y 46, stagger 0,07, `expo.out`).
- Menu : `circle()` depuis le bouton ; choix d'une rubrique : le **rideau d'accent se relève** (bord bas arrondi) et la page arrive en cascade.
- Compteurs : `power3.out` (décélération, jamais d'arrêt net). Boutons : appui `scale(.97)` CSS + ressort `back.out(2.6)` au relâchement. Pas de `scale(0)` (sauf le trou de l'anneau de fin, volontaire).
- Chronos : horloge `performance.now()` (×10 = rebasage), anneau, pulsation + bip sur les 3 dernières secondes, fond croisé en opacité selon la phase.
- `prefers-reduced-motion` : tout devient fondu court (0,15-0,25 s), sans déplacement.

## Transitions (fonction JS)
carte → page `A.ouvrirPage` / retour `A.fermerPage` · menu `A.ouvrirMenu` / `A.fermerMenu` · rubrique `A.balayerVers` · bouton → chrono/repos/fin `A.ouvrirCercle` / `A.fermerCercle` · ligne → série, valeur → roue `A.ouvrirRect` / `A.fermerRect` · compteur `A.compter` · anneau `A.animerAnneau` · mots `A.motsMontent`.
Séance (`seance.js`) : `S.ouvrir`, `S.allerEtape` (slide + swipe), `ouvrirSerie`, `ouvrirSelecteur`/`validerSelecteur`, `lancerChrono` (repos, temps, AMRAP, EMOM), `proposerSuite` (auto-slide + « Rester ici »), `ouvrirTiroir`, `finir` (aplat → anneau → compteurs), `S.terminer` (retour dans la carte « cette semaine » → 2/3).
Vues (`vues.js`) : accueil, coaching, programme (bascule semaine ⇄ mois), workout, questionnaire (curseurs, émojis, choix), à venir (Suivi, Profil).

## Décisions (mode absent)
Sélecteur en **scroll-snap natif** (inertie + crans magnétiques gratuits, glisser souris émulé) ; ×10 sur l'horloge uniquement ; EMOM livré en plus de l'AMRAP ; tutoiement du coach, UI neutre/« votre » ; Suivi/Profil = écrans « bientôt » avec la même transition ; réglages en bas de l'écran mobile / hors cadre sur ordinateur.

## Revue `review-animations` : constats restants
| Constat | Gravité | Etat |
|---|---|---|
| Anneau de chrono animé par `stroke-dashoffset` (1 élément SVG) | faible | accepté, hors règle transform/opacité |
| Trou de l'anneau de fin part de `scale(0)` | faible | volontaire (révélation de forme) |
| Pendant une transition de page, les touchers sont ignorés (pas d'interruption fluide) | moyenne | à reprendre au portage Vue |
| clip-path animé : repaint à chaque image, 60 i/s visé mais non mesuré sur téléphone réel | moyenne | à mesurer |
| Bip Web Audio et vibration non vérifiables en headless (iOS ne vibre pas) | faible | à tester sur appareil |
| Retour par bord gauche (swipe-back) non fait ; bouton retour en haut à gauche | faible | option |
