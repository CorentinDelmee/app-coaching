/* questionnaire.js — check-in du jour : une question par écran, curseur 0-10 à crans,
   échelle d'émojis, choix, compteur ; fin = célébration puis retour à la carte. */
(function () {
  const M4 = window.M4, $ = M4.$, $$ = M4.$$, E = M4.E, clamp = M4.clamp;
  const scene = $('#q-scene'), barre = $('#q-barre'), suite = $('#q-suite'), fete = $('#q-fete');
  const Q = [
    { t: 'Comment as-tu dormi cette nuit ?', type: 'curseur', v: 7, g: 'Très mal', d: 'Très bien' },
    { t: 'Quel est ton niveau d’énergie ?', type: 'curseur', v: 6, g: 'À plat', d: 'En pleine forme' },
    { t: 'Et ton humeur du jour ?', type: 'emoji', opts: ['😞', '😕', '😐', '🙂', '😄'] },
    { t: 'Une douleur à signaler ?', type: 'choix', opts: ['Aucune', 'Légère, ça passe', 'Gênante', 'Forte, j’en parle à Corentin'] },
    { t: 'Combien de verres d’eau depuis ce matin ?', type: 'pas', v: 3, unite: 'verres' }
  ];
  let n = 0, rep = [], occupe = false, auto = null;

  function creer(i) {
    const q = Q[i], el = document.createElement('div');
    el.className = 'q-q';
    let h = '<h3 class="q-t">' + q.t + '</h3>';
    if (q.type === 'curseur') h += '<div class="q-curseur"><span class="q-val">' + q.v + '</span><div class="q-piste"><div class="q-rail"><i></i></div><div class="q-pouce" role="slider" aria-valuemin="0" aria-valuemax="10" aria-valuenow="' + q.v + '" tabindex="0"></div></div><div class="q-etiq"><span>' + q.g + '</span><span>' + q.d + '</span></div></div>';
    if (q.type === 'emoji') h += '<div class="q-emojis">' + q.opts.map((o, k) => '<button data-k="' + k + '" aria-label="Humeur ' + (k + 1) + ' sur 5">' + o + '</button>').join('') + '</div>';
    if (q.type === 'choix') h += '<div class="q-choix">' + q.opts.map((o, k) => '<button data-k="' + k + '">' + o + '</button>').join('') + '</div>';
    if (q.type === 'pas') h += '<div class="q-pas"><button data-d="-1" aria-label="Un verre de moins">−</button><div><span class="q-val">' + q.v + '</span><small>' + q.unite + '</small></div><button data-d="1" aria-label="Un verre de plus">+</button></div>';
    el.innerHTML = h;
    return el;
  }
  function brancher(el, i) {
    const q = Q[i];
    if (q.type === 'curseur') {
      const piste = $('.q-piste', el), pouce = $('.q-pouce', el), fill = $('.q-rail i', el), val = $('.q-val', el);
      requestAnimationFrame(() => {
        const L = piste.clientWidth, pas = L / 10;
        let cur = rep[i] != null ? rep[i] : q.v;
        const pose = v => { gsap.set(pouce, { x: v * pas }); gsap.set(fill, { scaleX: v / 10 }); };
        const set = v => {
          if (v === cur) return; cur = v; rep[i] = v; val.textContent = v; pouce.setAttribute('aria-valuenow', v); M4.vibre(5);
          gsap.fromTo(val, { y: -16, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' });
        };
        pose(cur); val.textContent = cur; rep[i] = cur;
        Draggable.create(pouce, {
          type: 'x', bounds: { minX: 0, maxX: L }, inertia: true, edgeResistance: 0.8,
          snap: { x: v => Math.round(v / pas) * pas },
          onPress() { gsap.to(pouce, { scale: 1.18, duration: 0.3, ease: E.ressortVif }); },
          onRelease() { gsap.to(pouce, { scale: 1, duration: 0.45, ease: E.ressortVif }); },
          onDrag() { const v = clamp(Math.round(this.x / pas), 0, 10); gsap.set(fill, { scaleX: this.x / L }); set(v); },
          onThrowUpdate() { const v = clamp(Math.round(this.x / pas), 0, 10); gsap.set(fill, { scaleX: this.x / L }); set(v); }
        });
        pouce.addEventListener('keydown', e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const v = clamp(cur + (e.key === 'ArrowRight' ? 1 : -1), 0, 10); gsap.to(pouce, { x: v * pas, duration: 0.25 }); gsap.to(fill, { scaleX: v / 10, duration: 0.25 }); set(v); }
        });
        piste.addEventListener('click', e => {                 // toucher le rail : le pouce y va
          if (e.target === pouce) return;
          const r = piste.getBoundingClientRect(), v = clamp(Math.round((e.clientX - r.left) / pas), 0, 10);
          gsap.to(pouce, { x: v * pas, duration: M4.D(0.5), ease: E.ressort }); gsap.to(fill, { scaleX: v / 10, duration: M4.D(0.5), ease: E.ressort }); set(v);
        });
      });
    }
    if (q.type === 'emoji' || q.type === 'choix') {
      el.addEventListener('click', e => {
        const b = e.target.closest('button[data-k]'); if (!b) return;
        $$('button', el).forEach(x => x.classList.toggle('on', x === b));
        rep[i] = +b.dataset.k; M4.vibre(10);
        gsap.fromTo(b, { scale: 0.9 }, { scale: q.type === 'emoji' ? 1.08 : 1, duration: 0.5, ease: E.ressortVif });
        suite.disabled = false; suite.style.opacity = 1;
        clearTimeout(auto); auto = setTimeout(() => { if (n === i) suivant(); }, 650);
      });
    }
    if (q.type === 'pas') {
      let v = rep[i] != null ? rep[i] : q.v; rep[i] = v;
      const val = $('.q-val', el);
      el.addEventListener('click', e => {
        const b = e.target.closest('button[data-d]'); if (!b) return;
        v = clamp(v + (+b.dataset.d), 0, 12); rep[i] = v; val.textContent = v; M4.vibre(8);
        gsap.fromTo(val, { scale: 1.2 }, { scale: 1, duration: 0.5, ease: E.ressortVif });
        gsap.fromTo(b, { scale: 0.88 }, { scale: 1, duration: 0.45, ease: E.ressortVif });
      });
    }
  }
  function afficher(i, dir) {
    const el = creer(i); scene.appendChild(el); brancher(el, i);
    const sortant = scene.children.length > 1 ? scene.children[0] : null;
    const W = scene.clientWidth;
    if (sortant) gsap.to(sortant, { xPercent: -45 * dir, opacity: 0, scale: 0.94, duration: M4.D(0.45), ease: 'power3.out', onComplete: () => sortant.remove() });
    gsap.fromTo(el, { xPercent: M4.reduit() ? 0 : 70 * dir, opacity: 0 }, { xPercent: 0, opacity: 1, duration: M4.D(0.8), ease: E.ressortDoux, clearProps: 'transform' });
    if (!M4.reduit()) gsap.from($$('.q-t,.q-curseur,.q-emojis button,.q-choix button,.q-pas', el), { y: 28, opacity: 0, duration: 0.7, stagger: 0.05, delay: 0.12, ease: E.sortie, clearProps: 'transform,opacity' });
    gsap.to(barre, { scaleX: (i + 1) / Q.length, duration: M4.D(0.8), ease: E.ressort });
    $('#q-compte').textContent = 'Question ' + (i + 1) + ' sur ' + Q.length;
    $('span', suite).textContent = i === Q.length - 1 ? 'Terminer' : 'Continuer';
    const besoin = Q[i].type === 'emoji' || Q[i].type === 'choix';
    suite.disabled = besoin && rep[i] == null; suite.style.opacity = suite.disabled ? 0.4 : 1;
    M4.ilot.texte('#ic-q-n', (i + 1) + '/' + Q.length);
  }
  function suivant() {
    if (occupe || suite.disabled) return;
    clearTimeout(auto);
    if (n >= Q.length - 1) return finir();
    n++; afficher(n, 1);
  }
  suite.addEventListener('click', suivant);

  function finir() {
    occupe = true;
    const r = suite.getBoundingClientRect(), a = M4.app.getBoundingClientRect();
    fete.hidden = false;
    const cx = r.left - a.left + r.width / 2, cy = r.top - a.top + r.height / 2;
    gsap.set(fete, { clipPath: 'circle(0px at ' + cx + 'px ' + cy + 'px)' });
    gsap.to(fete, { clipPath: 'circle(150% at ' + cx + 'px ' + cy + 'px)', duration: M4.D(0.9), ease: 'expo.inOut', onComplete: () => gsap.set(fete, { clearProps: 'clipPath' }) });
    if (!M4.reduit()) {
      gsap.from('.fete-rond', { scale: 0.3, rotate: -50, duration: 1, delay: 0.55, ease: E.ressortVif });
      gsap.from('#q-fete h3,#q-fete p,#q-retour', { y: 40, opacity: 0, duration: 0.8, stagger: 0.08, delay: 0.65, ease: E.sortie });
      const box = document.createElement('div'); box.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
      fete.appendChild(box); setTimeout(() => M4.confettis(box, 300, 26), 600);
    }
    M4.son.bip(784, 0.12, 0.14); setTimeout(() => M4.son.bip(1046, 0.22, 0.14), 130); M4.vibre([20, 40, 20]);
  }
  $('#q-retour').addEventListener('click', () => { M4.nav.fermer(); setTimeout(() => M4.pastilleDisparait(), M4.reduit() ? 200 : 480); });

  M4.hooks.quest = function () {                         // (ré)initialisation à chaque ouverture
    occupe = false;
    $$('.q-q', scene).forEach(x => x.remove());
    fete.querySelectorAll('div').forEach(d => { if (!d.classList.contains('fete-rond')) d.remove(); });
    if (M4.etat.questFait) { fete.hidden = false; return; }
    fete.hidden = true; n = 0; rep = [];
    gsap.set(barre, { scaleX: 0.2 });
    afficher(0, 1);
  };
})();
