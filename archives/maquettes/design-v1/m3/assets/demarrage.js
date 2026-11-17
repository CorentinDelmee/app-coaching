/* Démarrage : branche les écrans puis joue l'entrée de l'accueil quand les polices sont prêtes. */
(function (M3) {
  M3.initPages(); M3.initSeance();
  var lance = false, go = function () { if (lance) return; lance = true; M3.entreeAccueil(); };
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); setTimeout(go, 1500); } else go();
})(window.M3);
