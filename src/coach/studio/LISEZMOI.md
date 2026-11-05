# Studio (refonte coach d3) — fondations LOT 0

État au 23:39 (WIP, interrompu : PC éteint) :
- Fait : tokens.css (limités à .st-app), navigation.js (liste nav + estActif/compte), IconeSt.vue, medias.js (muscleDe, miniatureYoutube, mediaDe), useSauvegardeAuto.js, toast.js + ToastSt.vue, IndicateurSauvegarde.vue, Puce.vue, Filtres.vue, LecteurVideo.vue ; CSP : img-src https://i.ytimg.com ajouté aux 2 fragments Caddy.
- Reste : CoachLayout.vue (barre latérale + barre du bas + « Plus », pont clair pour les anciennes vues .coach), AujourdhuiView.vue + redirection /coach -> aujourdhui, PanneauLateral.vue, VignetteExercice.vue, transitionPartagee.js (FLIP par rAF, contre-échelle anti-étirement).
- Reste : tests Vitest (useSauvegardeAuto, medias, navigation), build, captures 1280×800 et 390×844, documentation complète de chaque composant ici.
- Rien n'est encore branché : l'app actuelle est inchangée (aucun import des nouveaux fichiers).
