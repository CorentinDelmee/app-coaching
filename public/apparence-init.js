// Exécuté avant le premier affichage (script classique, bloquant, autorisé par la CSP « script-src 'self' ») :
// pose l'ambiance et le Grand affichage mémorisés pour éviter tout flash. Même clé que src/lib/apparence.js.
(function () {
  try {
    var a = JSON.parse(localStorage.getItem('cdc-apparence') || 'null') || {}
    var fonds = { clair: '#E3E5E8', sombre: '#202224', bleu: '#141B33' }
    if (fonds[a.ambiance]) {
      document.documentElement.setAttribute('data-ambiance', a.ambiance)
      var m = document.querySelector('meta[name="theme-color"]')
      if (m) m.setAttribute('content', fonds[a.ambiance])
    }
    if (a.grand === true) document.documentElement.setAttribute('data-grand', 'oui')
  } catch (e) { /* stockage indisponible : ambiance par défaut */ }
})()
