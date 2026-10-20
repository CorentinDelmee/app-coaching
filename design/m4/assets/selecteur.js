/* selecteur.js — le grand sélecteur : une roue verticale (Draggable + Inertia),
   crans magnétiques, valeurs voisines estompées, gros chiffre en haut.
   La feuille naît de la valeur touchée et y retourne en la mettant à jour. */
(function () {
  const M4 = window.M4, $ = M4.$, clamp = M4.clamp;
  const ov = $('#ov-sel'), feu = $('#f-sel'), roue = $('#roue'), liste = $('#roue-liste');
  const gros = $('#sel-val'), unite = $('#sel-unite');
  const PAS_PX = 64;                         // hauteur d'un cran
  let cfg = null, valeurs = [], idx = 0, y0 = 0, drag = null, coque = null;

  const fmt = v => (Number.isInteger(v) ? String(v) : String(v).replace('.', ','));

  function maj() {
    const y = gsap.getProperty(liste, 'y'), f = (y0 - y) / PAS_PX, k = clamp(Math.round(f), 0, valeurs.length - 1);
    if (k !== idx) { idx = k; M4.vibre(6); }
    gros.textContent = fmt(valeurs[k]);
    const items = liste.children, a = Math.max(0, k - 4), b = Math.min(items.length - 1, k + 4);
    for (let i = a; i <= b; i++) {
      const d = i - f, ad = Math.abs(d);
      gsap.set(items[i], { rotateX: -d * 24, scale: 1 - Math.min(0.4, ad * 0.12), opacity: Math.max(0.1, 1 - ad * 0.34) });
    }
  }
  function creerRoue() {
    const { min, max, pas } = cfg;
    valeurs = [];
    for (let v = min; v <= max + 1e-9; v += pas) valeurs.push(Math.round(v / pas) * pas);
    liste.innerHTML = valeurs.map(v => '<div class="r-i">' + fmt(v) + '</div>').join('');
    idx = Math.max(0, valeurs.findIndex(v => Math.abs(v - cfg.valeur) < 1e-6));
    y0 = roue.clientHeight / 2 - PAS_PX / 2;
    const bornes = { minY: y0 - (valeurs.length - 1) * PAS_PX, maxY: y0 };
    gsap.set(liste, { y: y0 - idx * PAS_PX });
    if (!drag) {
      drag = Draggable.create(liste, {
        type: 'y', inertia: true, edgeResistance: 0.9, bounds: bornes, minimumMovement: 3,
        snap: { y: v => y0 - Math.round((y0 - v) / PAS_PX) * PAS_PX },
        onDrag: maj, onThrowUpdate: maj, onThrowComplete: maj
      })[0];
    } else { drag.applyBounds(bornes); drag.update(); }
    maj();
  }
  function allerA(i) {
    i = clamp(i, 0, valeurs.length - 1);
    gsap.to(liste, { y: y0 - i * PAS_PX, duration: M4.D(0.35), ease: 'power3.out', onUpdate: () => { drag.update(); maj(); } });
  }
  roue.addEventListener('wheel', e => { e.preventDefault(); allerA(idx + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  liste.addEventListener('click', e => {                 // toucher une valeur voisine la ramène au centre
    const el = e.target.closest('.r-i'); if (!el || drag.isThrowing) return;
    allerA(Array.prototype.indexOf.call(liste.children, el));
  });

  function getCoque() {
    if (coque) return coque;
    const scrim = ov.querySelector('.ov-scrim');
    coque = M4.coque(feu, {
      origine: () => M4.rel(cfg.source),
      source: () => cfg.source, masquer: '.val b',
      couleurDebut: () => getComputedStyle(cfg.source).backgroundColor,
      rayonDebut: () => parseFloat(getComputedStyle(cfg.source).borderTopLeftRadius) || 24,
      contenu: ['.sel-sur', '.roue', '#sel-valider'],
      vols: () => [{ el: gros, depuis: () => M4.rel(cfg.source.querySelector('.val b') || cfg.source.querySelector('.val') || cfg.source) }],
      montrer() { ov.hidden = false; ov.classList.add('actif'); },
      cacher() { ov.classList.remove('actif'); ov.hidden = true; },
      surP(p) { scrim.style.opacity = 1 - clamp(p, 0, 1); }
    });
    coque.geste($('.f-poignee', feu));
    scrim.addEventListener('click', () => coque.fermer());
    return coque;
  }

  M4.selecteur = {
    /* cfg : { sur, valeur, min, max, pas, unite, source (élément touché), onValide(v) } */
    ouvrir(c) {
      cfg = c; const co = getCoque();
      if (co.etat !== 'ferme') return;
      $('#sel-sur').textContent = c.sur; unite.textContent = c.unite;
      gros.textContent = fmt(c.valeur);
      ov.hidden = false;                                  // mesurer la roue avant d'animer
      ov.classList.add('actif');
      creerRoue();
      co.ouvrir(() => { creerRoue(); });
    },
    valider() {
      const v = valeurs[idx];
      cfg.onValide(v);
      coque.fermer(() => {
        const val = cfg.source.querySelector('.val');
        if (val && !M4.reduit()) gsap.fromTo(val, { scale: 1.16 }, { scale: 1, duration: M4.T.pop + 0.1, ease: M4.E.ressortVif });
      });
    },
    estOuvert: () => coque && coque.etat !== 'ferme'
  };
  $('#sel-valider').addEventListener('click', () => M4.selecteur.valider());
})();
