/* Panneau de réglage en direct : 3 ambiances + 6 accents, mémorisés (localStorage). Bouton ×10 pour la démo. */
'use strict';
(function () {
  const CLE = 'm2.reglages', html = document.documentElement;
  const COULEURS_THEME = { clair: '#F4EEE4', sombre: '#1F1E1C', sauge: '#D2DAC7' };
  let r = { amb: 'clair', acc: 'prusse' };
  try { r = Object.assign(r, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) { /* ignore */ }
  function appliquer() {
    html.dataset.ambiance = r.amb; html.dataset.accent = r.acc;
    document.querySelectorAll('[data-amb]').forEach(b => b.classList.toggle('on', b.dataset.amb === r.amb));
    document.querySelectorAll('[data-acc]').forEach(b => b.classList.toggle('on', b.dataset.acc === r.acc));
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = COULEURS_THEME[r.amb];
    try { localStorage.setItem(CLE, JSON.stringify(r)); } catch (e) { /* ignore */ }
  }
  appliquer();
  const panneau = document.getElementById('reg');
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-amb]'); if (a) { r.amb = a.dataset.amb; appliquer(); }
    const c = e.target.closest('[data-acc]'); if (c) { r.acc = c.dataset.acc; appliquer(); }
    if (e.target.closest('[data-reg]')) {
      const ouvert = panneau.style.display === 'block';
      panneau.style.display = ouvert ? 'none' : 'block';
      if (!ouvert) gsap.fromTo(panneau, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'expo.out' });
    } else if (!e.target.closest('#reg')) panneau.style.display = 'none';
    const x = e.target.closest('[data-x10]'); if (x) Horloge.x10(Horloge.vitesse === 1);
  });
})();
