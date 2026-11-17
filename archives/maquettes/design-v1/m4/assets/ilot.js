/* ilot.js — l'îlot persistant : une pastille flottante qui se métamorphose.
   Son fond est un seul rectangle (clip-path) qui voyage d'un état à l'autre avec un ressort ;
   chaque état a son contenu, qui se fond au bon moment. États :
   cache · rdv · quest · seance · repos · demarrer · plein */
(function () {
  const M4 = window.M4, $ = M4.$, $$ = M4.$$;
  const fond = $('#ilot-fond');
  const cont = {};
  $$('.ic').forEach(n => { cont[n.dataset.etat] = n; });

  const R = { x: 0, y: 0, w: 0, h: 0, r: 0 };
  let cur = 'cache', tw = null;

  /* Géométrie de chaque état, relative à #app */
  function rect(e) {
    const t = M4.taille(), W = t.w, H = t.h, top = M4.sat() + 10, bas = M4.sab();
    const pill = (w, h = 44) => ({ x: (W - w) / 2, y: top, w, h, r: h / 2 });
    switch (e) {
      case 'cache': return { x: W / 2 - 20, y: top, w: 40, h: 0, r: 0 };
      case 'rdv': return pill(224);
      case 'quest': return pill(190);
      case 'seance': return pill(184);
      case 'repos': return pill(214, 52);
      case 'demarrer': return { x: 20, y: H - bas - 28 - 74, w: W - 40, h: 74, r: 37 };
      case 'plein': return { x: 0, y: 0, w: W, h: H, r: 0 };
    }
  }
  function clip() {
    const t = M4.taille();
    const h = Math.max(0, R.h);
    fond.style.clipPath = 'inset(' + R.y + 'px ' + (t.w - R.x - R.w) + 'px ' + (t.h - R.y - h) + 'px ' + R.x + 'px round ' + Math.max(0, R.r) + 'px)';
  }
  function positionner() {
    for (const k in cont) {
      const r = rect(k); if (!r) continue;
      Object.assign(cont[k].style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', borderRadius: r.r + 'px' });
    }
  }
  const couleurFond = e => M4.couleur(e === 'demarrer' ? '--accent' : e === 'plein' ? '--phase-repos' : '--ilot');
  const couleurTexte = e => M4.couleur(e === 'demarrer' ? '--accent-texte' : e === 'plein' ? '--phase-repos-texte' : '--ilot-texte');

  const ilot = M4.ilot = {
    cont,
    etat: () => cur,
    rect,
    aller(e) {
      if (e === cur) return;
      const prev = cur; cur = e;
      const cible = rect(e);
      const sortant = cont[prev], entrant = cont[e];
      if (sortant) { sortant.classList.remove('on'); gsap.to(sortant, { opacity: 0, duration: M4.T.fondRapide, overwrite: true }); }
      if (entrant) {
        entrant.classList.add('on'); entrant.style.color = couleurTexte(e);
        gsap.killTweensOf(entrant);
        gsap.fromTo(entrant, { opacity: 0, y: M4.reduit() ? 0 : 7, scale: M4.reduit() ? 1 : 0.96 }, { opacity: 1, y: 0, scale: 1, duration: M4.D(0.34), delay: M4.reduit() ? 0 : 0.17, ease: 'power3.out', overwrite: true });
      }
      if (tw) tw.kill();
      gsap.to(fond, { backgroundColor: couleurFond(e), duration: 0.3, overwrite: true });
      if (M4.reduit()) { Object.assign(R, cible); clip(); return; }
      tw = gsap.to(R, { x: cible.x, y: cible.y, w: cible.w, h: cible.h, r: cible.r, duration: e === 'plein' || prev === 'plein' ? 0.7 : M4.T.ilot, ease: M4.E.ressort, onUpdate: clip });
    },
    /* petit rebond du contenu courant (ex. +15 s) */
    pop() { const n = cont[cur]; if (n && !M4.reduit()) gsap.fromTo(n, { scale: 1.08 }, { scale: 1, duration: 0.45, ease: M4.E.ressortVif, overwrite: 'auto' }); },
    texte(id, t) { const n = $(id); if (n && n.textContent !== t) n.textContent = t; },
    /* après un changement d'ambiance ou de taille */
    rafraichir() {
      positionner(); Object.assign(R, rect(cur)); clip();
      fond.style.backgroundColor = couleurFond(cur);
      if (cont[cur]) cont[cur].style.color = couleurTexte(cur);
    },
    init() {
      positionner(); Object.assign(R, rect('cache')); clip(); fond.style.backgroundColor = couleurFond('cache');
    }
  };
  addEventListener('resize', () => ilot.rafraichir());
})();
