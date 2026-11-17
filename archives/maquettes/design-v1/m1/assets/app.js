/* M1 « Atelier » — démarrage, réglages d'apparence (ambiance + accent, mémorisés), accélérateur ×10, mise à l'échelle. */
(function () {
  'use strict';
  const M1 = window.M1, A = M1.anim, $ = M1.$, $$ = M1.$$;
  const racine = document.documentElement;

  const AMBIANCES = [['sombre', 'Sombre', '#25221F'], ['clair', 'Clair', '#F4EEE3'], ['aplat', 'Aplat', null]];
  const ACCENTS = [['framboise', 'Framboise', '#E5486A'], ['lagon', 'Lagon', '#2FB8B0'], ['citron', 'Citron', '#D8E04A'],
    ['sauge', 'Sauge', '#9DC08B'], ['lilas', 'Lilas', '#A99BEA'], ['corail', 'Corail rosé', '#F28C86']];
  let reg = { ambiance: 'sombre', accent: 'framboise' };
  try { reg = Object.assign(reg, JSON.parse(localStorage.getItem('m1-reglages') || '{}')); } catch (e) { /* ok */ }

  function appliquer() {
    const acc = ACCENTS.find(a => a[0] === reg.accent) || ACCENTS[0];
    racine.dataset.ambiance = reg.ambiance;
    racine.style.setProperty('--couleur', acc[2]);
    const amb = AMBIANCES.find(a => a[0] === reg.ambiance);
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = amb[2] || acc[2];
    $$('#r-ambiances button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === reg.ambiance)));
    $$('#r-accents button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === reg.accent)));
    try { localStorage.setItem('m1-reglages', JSON.stringify(reg)); } catch (e) { /* ok */ }
  }
  function panneau() {
    $('#r-ambiances').innerHTML = AMBIANCES.map(a => '<button type="button" data-v="' + a[0] + '" aria-pressed="false">' + a[1] + '</button>').join('');
    $('#r-accents').innerHTML = ACCENTS.map(a => '<button type="button" data-v="' + a[0] + '" aria-pressed="false"><span class="pastille-c" style="background:' + a[2] + '"></span>' + a[1] + '</button>').join('');
    $('#r-ambiances').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { reg.ambiance = b.dataset.v; appliquer(); } });
    $('#r-accents').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { reg.accent = b.dataset.v; appliquer(); } });
    $('#btn-reglages').addEventListener('click', (e) => { e.stopPropagation(); const p = $('#reglages'); p.hidden = !p.hidden; });
    document.addEventListener('pointerdown', (e) => { const p = $('#reglages'); if (!p.hidden && !p.contains(e.target) && !e.target.closest('#btn-reglages')) p.hidden = true; });
    $('#btn-x10').addEventListener('click', () => {
      const on = $('#btn-x10').getAttribute('aria-pressed') !== 'true';
      $('#btn-x10').setAttribute('aria-pressed', String(on)); M1.horloge.regler(on ? 10 : 1);
    });
  }
  function echelle() {
    const k = window.innerWidth >= 500 ? Math.min(1, (window.innerHeight - 40) / 844) : 1;
    racine.style.setProperty('--echelle', k);
  }

  panneau(); appliquer(); echelle();
  window.addEventListener('resize', echelle);

  const demarrer = () => {
    M1.initVues(); M1.seance.init();
    A.entreeAccueil();
    document.body.dataset.pret = '1';
  };
  // on attend les polices (au plus 1,2 s) pour que la première animation parte sur les bonnes largeurs
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1200))]).then(demarrer);
})();
