# Retours de Corentin sur les maquettes de l'app client (V1)

> 21 octobre 2026. À ranger dans `Projets/app-coaching/`. Ce document guide la maquette consolidée (V2),
> puis la mise à jour de l'app. Il est reporté dans CAHIER-DES-CHARGES.md (§ Design + journal).
> « M1 » à « M5 » = les 5 maquettes de la session du 20/10, dans l'ordre de la page index
> (M1 = « Atelier »).

---

## 1. Décision générale

- **Base : M5** (style préféré de Corentin), enrichie des points forts de M1, M2 et M4.
- **M3 : abandonnée.**
- **Couleur d'accent : jaune.** ⚠️ Le texte posé sur le jaune doit rester foncé ; le jaune ne sert pas de couleur de texte sur fond clair, faute de contraste. Vérifier le contraste partout.
- **Ambiances : clair, sombre et bleu profond (celles de M5).** Corentin aime les trois et le client choisit la sienne dans son profil. Par défaut : clair.

---

## 2. Ce qu'on garde, maquette par maquette

### M5 — la base
- Le style général, les polices, la mise en page.
- **Menu : parfait** (le menu et son animation). C'est aussi le menu à garder pour toute l'app.
- Toutes les animations des menus.
- **Page Coaching** (« Prochain coaching ») : on garde.
- **Programme : parfait.**
- Overview du workout : bien, à deux corrections près (voir §3).

### M1 — Atelier
- Très lisible et propre : la lisibilité de M1 sert de référence pour toutes les pages de séance.
- Les **transitions au démarrage de la séance**, très réussies.
- Le **chrono** et son **petit son de fin** : top. En revanche, la **police des chiffres du chrono n'est pas bonne**, voir §3.
- **L'animation de choix des répétitions et des charges** (grand sélecteur qu'on fait glisser) : exactement ce que Corentin voulait. **À garder telle quelle.**
- Les **étiquettes AMRAP / EMOM** : propres.
- Le **changement de couleur de l'écran quand un circuit est lancé** : à garder.
- Les **animations du questionnaire** : tops (à fusionner avec celles de M2, voir plus bas).
- L'aplat de couleur sur le dashboard : bonne idée. Avec le jaune, garder un texte foncé et vérifier qu'il reste lisible.
- Moins réussis :
  - « Bonjour Fabien » n'est pas convaincant, le message d'accueil du dashboard est à retravailler ;
  - l'encart des exercices (« Goblet Squat… ») ne convainc qu'à moitié.

### M2
- **Transitions entre les exercices** pendant la séance, et quand on choisit un exercice depuis l'overview : très bien, à reprendre.
- **Animation du timer** : le décompte des chiffres est top, avec la **petite phrase au-dessus**
  (« Respire », « Repos »… et « Tiens bon » pendant le temps de travail). À garder.
- **Check-in : c'est le modèle.** On reprend :
  - les petits bruits et effets ;
  - l'animation des chiffres, qui passent au-dessus ou en dessous quand on change de valeur ;
  - l'animation d'humeur.

  La police de M2 est **trop peu lisible** : on applique ces animations avec les polices de M5.
- **Circuits : parfaits dans M2.** On reprend l'animation « Découvrir le circuit » et l'idée de « faire l'option » (voir §4, question 1).

### M4
- Les **effets un peu rebondis**, mais avec mesure : légers, jamais excessifs.
- Le **compteur de temps total de la séance** en haut de l'écran pendant la séance.
- La façon de **présenter l'EMOM en option**, mieux affichée que dans les autres maquettes.
- Les **circuits plus détaillés** (le niveau de détail de M4).

---

## 3. Ce qu'on change

1. **Séance : une page entière par exercice ou par bloc**, pas de cartes (les cartes de M5 ne conviennent pas).
2. **Overview du workout : des sections par bloc** (Bloc A, Bloc B, Bloc C…), clairement séparées.
3. **Circuits**, dans l'overview comme dans la séance. On mélange :
   - le déroulé de M2 (« Découvrir le circuit », faire l'option) ;
   - le niveau de détail et l'affichage de l'option de M4 ;
   - le changement de couleur de M1 au lancement ;
   - **un circuit qui démarre ouvre une nouvelle section, qui se referme à la fin.**

   Les timers et les circuits de M5 ne sont pas retenus.
4. **Timers** : l'animation du décompte et les petites phrases viennent de M2, le son de fin vient de M1, le temps total en haut vient de M4. **Proposer 2-3 polices de chiffres** pour le chrono, à comparer dans le panneau de réglages (celle de M1 ne convient pas).
5. **Message d'accueil du dashboard** : remplacer « Bonjour Fabien » par quelque chose de plus réussi. Proposer 2-3 versions.
6. **Encart exercice** dans l'overview : à retravailler (voir l'avis sur l'encart de M1 au §2).

---

## 4. Accessibilité et réglages client (à mettre dans l'app finale)

- **Le client choisit son ambiance** : clair, sombre ou bleu profond.
- **Mode « Grand affichage »** : Corentin a plusieurs clients qui ne voient pas bien sans leurs lunettes.
  - Un réglage simple (interrupteur ou 2-3 tailles) qui grossit tout : textes, chiffres, boutons, chronos.
  - Le zoom du téléphone doit aussi fonctionner : ne jamais le bloquer.
- Garder des contrastes forts, et des zones à toucher larges.

### Questions à trancher (REX décide en provisoire et note dans DECISIONS)
1. « Faire l'option » (M2) : bien comprendre ce que la maquette fait aujourd'hui (exercice ou circuit
   optionnel ?) et le garder tel quel.
2. Dashboard en aplat jaune : texte foncé (recommandé) ou blanc ? Montrer les deux dans le panneau de réglages.

---

## 5. Bug à corriger

- **Programme → récap de la semaine** : toucher le workout d'un autre jour ramène toujours au workout du **jour actuel**. Il doit ouvrir **le workout de ce jour-là**, tel qu'il a été enregistré (séance faite : ce qui a été réalisé ; séance à venir : le template).
- Ajouter un test qui reproduit le bug.
