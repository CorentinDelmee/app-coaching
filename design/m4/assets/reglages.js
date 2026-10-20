/* reglages.js — panneau de réglage en direct (ambiance, accent, ×10, rejouer) + démarrage */
(function () {
  const M4 = window.M4, $ = M4.$, $$ = M4.$$, html = document.documentElement;
  const CLE = 'm4-ressort-prefs';
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(CLE) || '{}'); } catch (e) { }
  const fonds = { sombre: '#1C1F27', clair: '#E8EBF1', nuit: '#0F1330' };

  function appliquer() {
    html.dataset.ambiance = prefs.ambiance || 'sombre';
    html.dataset.accent = prefs.accent || 'lime';
    $$('#rg-panneau [data-groupe=ambiance] button').forEach(b => b.classList.toggle('on', b.dataset.v === html.dataset.ambiance));
    $$('#rg-panneau [data-groupe=accent] button').forEach(b => b.classList.toggle('on', b.dataset.v === html.dataset.accent));
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = fonds[html.dataset.ambiance];
    try { localStorage.setItem(CLE, JSON.stringify(prefs)); } catch (e) { }
    M4.ilot && M4.ilot.rafraichir();
  }
  appliquer();

  const btn = $('#rg-btn'), pan = $('#rg-panneau');
  btn.addEventListener('click', () => {
    const ouvert = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !ouvert);
    if (!ouvert) { pan.hidden = false; gsap.fromTo(pan, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: M4.D(0.5), ease: M4.E.ressortVif }); }
    else gsap.to(pan, { scale: 0.9, opacity: 0, duration: 0.15, onComplete: () => { pan.hidden = true; } });
  });
  pan.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    prefs[b.parentNode.dataset.groupe] = b.dataset.v; appliquer();
  });
  $('#rg-vit').addEventListener('click', e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', on); M4.horloge.vitesse(on ? 10 : 1);
    M4.toast(on ? 'Chronos ×10 pour la démo' : 'Chronos en temps réel');
  });
  $('#rg-rejouer').addEventListener('click', () => location.reload());
  addEventListener('keydown', e => { if (e.key === 'Escape' && M4.nav && M4.nav.pile.length && !M4.selecteur.estOuvert()) M4.nav.fermer(); });

  /* Démarrage : on attend les polices (au plus 1,2 s) pour que l'entrée soit propre */
  M4.ilot.init();
  const go = () => { if (go.fait) return; go.fait = true; M4.majAccueil(false); M4.entreeAccueil(); };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
  setTimeout(go, 1200);
})();
