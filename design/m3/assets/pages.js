/* M3 « Tableau » — écrans : accueil, menu-store, pages (coaching, programme, workout, questionnaire).
   Une fonction par transition : ouvrirDepuis(), retour(), ouvrirMenu(), fermerMenu(), choisirRubrique(),
   basculerVue(), placerW3(), qAller(), qFin(). */
(function (M3) {
  'use strict';
  var $ = M3.$, $$ = M3.$$, T = M3.T, E = M3.E, D = M3.D;
  var etat = M3.etat = { semaine: 1, w2Fait: false, w3Place: false, checkin: false };
  var pile = M3.pile = [];            // pages ouvertes : {id, origine}
  var occupe = false;
  var FALLBACK = { coaching: '#c-coaching', programme: '#c-programme', workout: '#c-aujourdhui', questionnaire: '#c-quest' };

  /* =============== Réglages en direct =============== */
  var AMBIANCES = ['sombre', 'clair', 'craie'];
  var ACCENTS = [['jaune', 'Jaune surligneur'], ['vert', 'Vert fluo doux'], ['cyan', 'Cyan'], ['rose', 'Rose fluo'], ['craie', 'Blanc craie'], ['rouge', 'Rouge signal']];
  var THEME = { sombre: '#262624', clair: '#F4F2EB', craie: '#23322B' };
  function appliquerAmbiance(a) {
    if (AMBIANCES.indexOf(a) < 0) a = 'sombre';
    document.documentElement.dataset.ambiance = a;
    $$('#reg-amb button').forEach(function (b) { b.classList.toggle('on', b.dataset.a === a); });
    $('meta[name=theme-color]').setAttribute('content', THEME[a]);
    try { localStorage.setItem('m3.ambiance', a); } catch (e) { }
  }
  function appliquerAccent(c) {
    if (!ACCENTS.some(function (x) { return x[0] === c; })) c = 'jaune';
    var s = document.documentElement.style;
    s.setProperty('--accent', 'var(--c-' + c + ')');
    s.setProperty('--phase-repos', c === 'cyan' ? 'var(--c-vert)' : 'var(--c-cyan)');
    s.setProperty('--phase-alerte', c === 'rouge' ? 'var(--c-rose)' : 'var(--c-rouge)');
    $$('#reg-acc button').forEach(function (b) { b.classList.toggle('on', b.dataset.c === c); });
    try { localStorage.setItem('m3.accent', c); } catch (e) { }
  }
  function initReglages() {
    var acc = $('#reg-acc');
    ACCENTS.forEach(function (a) {
      var b = document.createElement('button'); b.className = 'sw'; b.dataset.c = a[0]; b.title = a[1]; b.setAttribute('aria-label', a[1]);
      b.style.background = 'var(--c-' + a[0] + ')'; acc.appendChild(b);
    });
    var g = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    appliquerAmbiance(g('m3.ambiance') || 'sombre'); appliquerAccent(g('m3.accent') || 'jaune');
    $('#reg-amb').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) appliquerAmbiance(b.dataset.a); });
    acc.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) appliquerAccent(b.dataset.c); });
    $('#reg-btn').addEventListener('click', function () {
      var p = $('#reg-pan'), ouvert = p.style.display === 'block';
      p.style.display = ouvert ? 'none' : 'block'; this.setAttribute('aria-expanded', !ouvert);
    });
    $('#reg-x10').addEventListener('click', function () { M3.setVitesse(M3.vitesse() > 1 ? 1 : 10); });
    $('#reg-rejouer').addEventListener('click', function () { $('#reg-pan').style.display = 'none'; M3.entreeAccueil(); });
    $$('.x10').forEach(function (b) { b.addEventListener('click', function () { M3.setVitesse(M3.vitesse() > 1 ? 1 : 10); }); });
  }

  /* =============== Accueil =============== */
  function majAccueil() {
    M3.flap($('#fl-semaine'), etat.semaine + '/3', null);
    $$('#segs i').forEach(function (s, i) { s.classList.toggle('f', i < etat.semaine); });
    var c = $('#c-aujourdhui');
    c.querySelector('.etq').textContent = etat.w2Fait ? "Aujourd'hui · fait" : "Aujourd'hui · prévu";
    $('#auj-cta').textContent = etat.w2Fait ? 'Revoir la séance' : 'Voir la séance';
    $('#auj-petit').innerHTML = etat.w2Fait ? '<span class="fait-tag">FAIT ✓ BRAVO FABIEN</span>' : '≈ 50 min · 5 exercices · AMRAP 8 min';
    $('#pastille').style.display = etat.checkin ? 'none' : 'flex';
    $('#q-nom').textContent = etat.checkin ? 'Check-in fait' : 'Check-in du jour';
    $('#q-petit').textContent = etat.checkin ? '✓ Merci Fabien' : '5 questions · 1 min';
    var bq = $('#menu .badge'); if (bq) bq.style.display = etat.checkin ? 'none' : 'flex';
  }
  M3.majAccueil = majAccueil;

  M3.entreeAccueil = function () {   // coupes franches : chaque case se découvre en volet, les chiffres roulent
    majAccueil();
    var nom = $('#h-nom'), cases = $$('#grille .case'), rm = M3.rm();
    var tl = gsap.timeline();
    if (rm) { tl.fromTo(['#e-accueil .acc'], { opacity: 0 }, { opacity: 1, duration: T.fondu }); return tl; }
    tl.add(M3.entreeLettres(nom), 0.05);
    tl.fromTo(cases, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.6, stagger: 0.1, ease: E.sec, clearProps: 'clipPath' }, 0.1);
    cases.forEach(function (c, i) {
      var kids = Array.prototype.slice.call(c.children).filter(function (k) { return !k.classList.contains('pastille'); });
      tl.fromTo(kids, { x: -26, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: E.sec, clearProps: 'transform,opacity' }, 0.3 + i * 0.1);
    });
    tl.fromTo('#pastille', { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: E.sec, clearProps: 'transform,opacity' }, 0.9);
    tl.fromTo('#btn-menu', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: E.sec, clearProps: 'transform,opacity' }, 0.1);
    M3.flap($('#fl-semaine'), '0/3', null); M3.flap($('#fl-semaine'), etat.semaine + '/3', 'asc');
    $$('#segs i b').forEach(function (b, i) { if (i < etat.semaine) { b.parentNode.classList.remove('f'); tl.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: E.sec, clearProps: 'transform', onComplete: function () { b.parentNode.classList.add('f'); } }, 0.7); } });
    return tl;
  };
  M3.afficherBoutonMenu = function (oui) { $('#btn-menu').classList.toggle('cache', !oui); };

  /* Semaine mise à jour après la séance : le compteur roule, la case se remplit. */
  M3.maj2sur3 = function () {
    etat.semaine = 2; etat.w2Fait = true;
    $('#c-aujourdhui .etq').textContent = "Aujourd'hui · fait";
    $('#auj-cta').textContent = 'Revoir la séance';
    $('#auj-petit').innerHTML = '<span class="fait-tag">FAIT ✓ BRAVO FABIEN</span>';
    var tl = gsap.timeline({ delay: 0.5 });
    tl.add(function () { M3.flap($('#fl-semaine'), '2/3', 'asc'); M3.bip(660, 0.08, 0.08); });
    var seg = $$('#segs i')[1];
    tl.fromTo(seg.querySelector('b'), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: E.sec, clearProps: 'transform', onComplete: function () { seg.classList.add('f'); } }, 0);
    tl.fromTo('#c-semaine', { scale: 0.96 }, { scale: 1, duration: 0.5, ease: E.sec, clearProps: 'transform' }, 0);
    tl.fromTo('#c-semaine', { backgroundColor: 'transparent' }, { duration: 0 }, 0);
    tl.fromTo('#c-aujourdhui .fait-tag', { xPercent: -120 }, { xPercent: 0, duration: 0.5, ease: E.sec }, 0.1);
    $('#c-semaine').style.outline = '0';
  };

  /* =============== Transition carte → page (clip-path depuis la carte touchée) =============== */
  M3.ouvrirDepuis = function (origine, id) {
    if (occupe) return; occupe = true;
    var e = $('#e-' + id);
    if (PREP[id]) PREP[id]();
    e.style.display = 'block'; e.style.zIndex = 10 + pile.length + 1;
    var entree = { id: id, origine: origine, tl: null }; pile.push(entree);
    var r = M3.rel(origine), titre = $('.titre-cin', e), ins = $$('[data-in]', e);
    var tl = gsap.timeline({ onComplete: function () { gsap.set(e, { clearProps: 'clipPath,opacity' }); } });
    entree.tl = tl;
    var fin = M3.rm() ? 0.2 : T.page;
    tl.add(function () { occupe = false; }, fin + 0.02);   // on peut déjà re-toucher dès que la page est ouverte
    if (M3.rm()) { tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: T.fondu }, 0); if (ENTREE[id]) ENTREE[id](tl, 0); return tl; }
    tl.fromTo(e, { clipPath: M3.ins(r) }, { clipPath: M3.PLEIN, duration: T.page, ease: E.coupe }, 0);
    tl.fromTo($$('.ph > *, .q-haut > *', e), { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, ease: E.sec, clearProps: 'transform,opacity' }, 0.35);
    if (titre) tl.add(M3.entreeLettres(titre), 0.32);
    if (ins.length) tl.fromTo(ins, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.55, stagger: T.cascade + 0.02, ease: E.sec, clearProps: 'clipPath' }, 0.42);
    var bb = $('.barre-bas', e); if (bb) tl.fromTo(bb, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: E.sec, clearProps: 'transform' }, 0.5);
    if (ENTREE[id]) ENTREE[id](tl, 0.55);
    return tl;
  };

  M3.retour = function (cb) {
    if (occupe || !pile.length) return; occupe = true;
    var cur = pile.pop(), e = $('#e-' + cur.id), o = cur.origine;
    if (cur.tl) { cur.tl.progress(1); cur.tl.kill(); }
    var vis = function (n) { return n && n.isConnected && n.getClientRects().length > 0; };
    if (!vis(o) && !pile.length && FALLBACK[cur.id]) o = $(FALLBACK[cur.id]);
    var fin = function () { e.style.display = 'none'; gsap.set(e, { clearProps: 'clipPath,opacity' }); occupe = false; if (LEAVE[cur.id]) LEAVE[cur.id](); cb && cb(); };
    if (M3.rm() || !vis(o)) return gsap.to(e, { opacity: 0, duration: 0.2, onComplete: fin });
    var r = M3.rel(o);
    var tl = gsap.timeline({ onComplete: fin });
    tl.to(e.children, { opacity: 0, duration: 0.18, ease: 'none' }, 0);
    tl.fromTo(e, { clipPath: M3.PLEIN }, { clipPath: M3.ins(r), duration: T.pageRetour, ease: E.coupe }, 0.08);
    return tl;
  };

  /* =============== Menu : un store qui tombe depuis le bouton =============== */
  var RUB = [
    { id: 'accueil', t: 'Accueil', fond: 'var(--c-craie)' },
    { id: 'programme', t: 'Programme', fond: 'var(--accent)' },
    { id: 'coaching', t: 'Coaching', fond: 'var(--c-cyan)' },
    { id: 'questionnaire', t: 'Questionnaires', fond: 'var(--c-rose)', badge: true },
    { id: 'suivi', t: 'Suivi', fond: 'var(--c-vert)' },
    { id: 'profil', t: 'Profil', fond: 'var(--surface-2)', texte: true }
  ];
  var menuOuvert = false, menuTl = null;
  function batirMenu() {
    var m = $('#menu'); m.innerHTML = '<div class="m-haut" style="background:var(--fond)"><span class="etq">Où va-t-on ?</span></div>';
    RUB.forEach(function (r, i) {
      var b = document.createElement('button'); b.className = 'm-bande' + (r.texte ? ' b-texte' : ''); b.style.background = r.fond; b.dataset.r = r.id;
      b.innerHTML = '<span class="n">0' + (i + 1) + '</span><span class="t">' + r.t + '</span>' + (r.badge ? '<span class="badge">1</span>' : '');
      m.appendChild(b);
    });
    m.addEventListener('click', function (e) { var b = e.target.closest('.m-bande'); if (b) M3.choisirRubrique(b); });
  }
  function icone(ouvert) {   // trois barres → croix (transform seulement)
    var s = $$('#btn-menu span'), d = M3.rm() ? 0 : 0.35;
    if (ouvert) { gsap.to(s[0], { y: 0, rotation: 45, duration: d, ease: E.sec }); gsap.to(s[1], { scaleX: 0, duration: d * 0.6, ease: E.sec }); gsap.to(s[2], { y: 0, rotation: -45, duration: d, ease: E.sec }); }
    else { gsap.to(s[0], { y: -10, rotation: 0, duration: d, ease: E.sec }); gsap.to(s[1], { scaleX: 1, duration: d, ease: E.sec }); gsap.to(s[2], { y: 10, rotation: 0, duration: d, ease: E.sec }); }
  }
  function courantRub() { var p = pile[pile.length - 1]; return p ? p.id : 'accueil'; }
  M3.ouvrirMenu = function () {
    if (occupe) return; occupe = true; menuOuvert = true;
    var m = $('#menu'), parts = $$('.m-haut, .m-bande', m), cur = courantRub();
    $$('.m-bande', m).forEach(function (b) { var ici = b.dataset.r === cur; var x = b.querySelector('.fl-ici'); if (ici && !x) { x = document.createElement('span'); x.className = 'fl-ici'; x.textContent = 'ICI'; b.insertBefore(x, b.querySelector('.badge')); } if (!ici && x) x.remove(); });
    m.style.display = 'flex'; $('#btn-menu').setAttribute('aria-expanded', 'true'); icone(true);
    var tl = menuTl = gsap.timeline({ onComplete: function () { occupe = false; } });
    tl.add(function () { occupe = false; }, 0.55);   // on peut choisir dès que les bandes sont tombées
    if (M3.rm()) return tl.fromTo(m, { opacity: 0 }, { opacity: 1, duration: T.fondu });
    tl.fromTo(parts, { scaleY: 0 }, { scaleY: 1, duration: T.menu, stagger: T.menuStagger, ease: E.sec, transformOrigin: '50% 0%' }, 0);
    tl.fromTo($$('.m-bande .t, .m-bande .n', m), { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.02, ease: E.sec }, 0.12);
    return tl;
  };
  M3.fermerMenu = function (cb) {
    if (!menuOuvert) return; menuOuvert = false; occupe = true; if (menuTl) menuTl.progress(1);
    var m = $('#menu'), parts = $$('.m-haut, .m-bande', m).reverse();
    $('#btn-menu').setAttribute('aria-expanded', 'false'); icone(false);
    var fin = function () { m.style.display = 'none'; gsap.set(parts, { clearProps: 'all' }); occupe = false; cb && cb(); };
    if (M3.rm()) return gsap.to(m, { opacity: 0, duration: T.fondu, onComplete: function () { fin(); gsap.set(m, { opacity: 1 }); } });
    return gsap.to(parts, { scaleY: 0, duration: 0.38, stagger: 0.045, ease: E.sec, transformOrigin: '50% 0%', onComplete: fin });
  };
  M3.choisirRubrique = function (bande) {
    if (menuTl) menuTl.progress(1);
    if (occupe) return;
    var id = bande.dataset.r, cur = courantRub();
    if (id === cur) return M3.fermerMenu();
    if (id === 'accueil') {      // le store remonte et révèle l'accueil
      pile.splice(0).forEach(function (p) { $('#e-' + p.id).style.display = 'none'; });
      return M3.fermerMenu();
    }
    occupe = true; menuOuvert = false;
    var m = $('#menu'), autres = $$('.m-bande, .m-haut', m).filter(function (b) { return b !== bande; });
    // la bande choisie reste : les autres se replient, puis la bande devient la page
    var tl = gsap.timeline();
    tl.to(autres, { scaleY: 0, duration: 0.3, stagger: { each: 0.03, from: 'edges' }, ease: E.sec, transformOrigin: '50% 50%' });
    tl.add(function () {
      occupe = false;
      var anciennes = pile.splice(0), page = $('#e-' + id);
      var t2 = M3.ouvrirDepuis(bande, id);
      page.style.zIndex = 75;
      occupe = true;
      t2.add(function () {
        anciennes.forEach(function (p) { if (p.id !== id) $('#e-' + p.id).style.display = 'none'; });
        gsap.set(page, { clearProps: 'clipPath,opacity' }); page.style.zIndex = 11;
        m.style.display = 'none'; gsap.set($$('.m-haut, .m-bande', m), { clearProps: 'all' });
        $('#btn-menu').setAttribute('aria-expanded', 'false'); icone(false);
      }, (M3.rm() ? 0.2 : T.page) + 0.03);
    });
  };

  /* =============== Coaching =============== */
  function moinsDe24h() { return false; /* maquette : la séance est dans 7 jours */ }
  function whatsapp(action) {
    var txt = action + ' ma séance de coaching du mardi 27 octobre à 18 h 30. Merci !';
    var url = 'https://wa.me/?text=' + encodeURIComponent(txt);
    var go = function () { M3.toast('WhatsApp s\'ouvre avec ton message…'); setTimeout(function () { window.open(url, '_blank', 'noopener'); }, 700); };
    if (moinsDe24h()) M3.confirmer('Moins de 24 h', 'La séance a lieu dans moins de 24 h : elle sera facturée.', 'Continuer', 'Garder ma séance', go); else go();
  }
  function initCoaching() {
    $('#b-modif').onclick = function () { whatsapp('Je voudrais modifier'); };
    $('#b-annul').onclick = function () { whatsapp('Je voudrais annuler'); };
    $('#b-mot').onclick = function () {
      M3.toast('WhatsApp s\'ouvre…'); setTimeout(function () { window.open('https://wa.me/?text=' + encodeURIComponent('Salut Corentin, un petit mot avant la séance :'), '_blank', 'noopener'); }, 700);
    };
  }
  function entreeCoaching(tl, t) {
    var h = $('#fl-heure'), s = $('#fl-seances'), eu = $('#fl-euros');
    M3.flap(h, '00H00', null); M3.flap(s, '0E', null); M3.flap(eu, '000 €', null);
    tl.add(function () { M3.flap(h, '18H30', 'asc'); M3.flap(s, '4E', 'asc'); }, t + 0.1);
    var o = { v: 0 }, dernier = '';
    tl.to(o, { v: 105, duration: 1.1, ease: 'power3.out', onUpdate: function () { var x = ('00' + Math.round(o.v)).slice(-3) + ' €'; if (x !== dernier) { M3.flap(eu, x, 'asc'); dernier = x; } } }, t + 0.2);
  }

  /* =============== Workout : overview =============== */
  function fmtSerie(x) {
    if (x.type === 'temps') return x.series + ' × ' + x.duree + ' s';
    return x.series + ' × ' + x.reps + (x.parJambe ? ' / jambe' : '') + ' · ' + x.kg + ' kg';
  }
  function ligneExo(x, i) {
    var det = '<em>' + fmtSerie(x) + '</em> · repos ' + x.repos + ' s' + (x.prec ? '<br>préc. ' + x.prec.reps + ' × ' + x.prec.kg + ' kg' : '');
    return '<div class="exo-l" data-exo="' + i + '"><span class="i">' + (i + 1) + '</span><div class="tx"><b>' + x.nom + '</b><span>' + det + '</span></div><a class="vid" href="' + x.video + '" target="_blank" rel="noopener" aria-label="Voir la vidéo : ' + x.nom + '">▶</a></div>';
  }
  function bloc(nomb, liste) {
    return '<div class="titre-bloc"><b>' + nomb + '</b><span class="etq">' + liste.length + ' exo' + (liste.length > 1 ? 's' : '') + '</span></div>' + liste.map(function (x) { return ligneExo(x, D.exos.indexOf(x)); }).join('');
  }
  function circuitL(c, option) {
    return '<div class="titre-bloc"><b>' + (option ? 'Option' : 'Circuit') + '</b><span class="etq">' + c.kind + ' ' + c.minutes + ' min</span></div><div class="circuit-l" data-circ="' + c.id + '"><div class="entete"><b>' + c.kind + ' ' + c.minutes + '\'</b><span class="etq">' + c.expl.replace(/^Faites/, 'Fais').replace(/^Chaque/, 'Chaque') + '</span></div>' +
      c.exos.map(function (x, i) { return '<div class="exo-l"><span class="i">' + (i + 1) + '</span><div class="tx"><b>' + x.nom + '</b><span>' + x.note + '</span></div><a class="vid" href="' + x.video + '" target="_blank" rel="noopener" aria-label="Voir la vidéo : ' + x.nom + '">▶</a></div>'; }).join('') + '</div>';
  }
  M3.htmlBlocs = function () {
    var g = function (b) { return D.exos.filter(function (x) { return x.bloc === b; }); };
    return bloc('Échauffement', g('Échauffement')) + bloc('Bloc A', g('Bloc A')) + bloc('Bloc B', g('Bloc B')) + circuitL(D.amrap) + circuitL(D.emom, true);
  };
  function prepWorkout() {
    $('#wk-defile').innerHTML =
      '<span class="etq" data-in>Programme Force &amp; cardio · semaine 3</span>' +
      '<h1 class="titre-cin" style="font-size:96px;margin:2px 0 10px">Workout 2</h1>' +
      '<div class="puces" data-in><span class="puce">≈ 50 min</span><span class="puce">5 exercices</span><span class="puce">AMRAP 8 min</span></div>' +
      '<div class="bloc acc-bloc" data-in><span class="etq">Consigne du coach</span><p class="cit" style="margin-top:6px">' + D.coach.consigne + '</p></div>' +
      '<div data-in>' + M3.htmlBlocs() + '</div>';
    $('#b-demarrer').textContent = etat.w2Fait ? '▸ Refaire la séance' : '▸ Démarrer';
  }

  /* =============== Programme =============== */
  var JOURS = [['L', 19], ['M', 20], ['M', 21], ['J', 22], ['V', 23], ['S', 24], ['D', 25]];
  function tuile(j) {
    var n = j[1];
    if (n === 19) return '<div class="tuile fait" aria-label="Workout 1 fait lundi 19"><span class="ck">✓</span><span class="vert">Haut du corps</span><span class="w">W1</span></div>';
    if (n === 20) return '<button class="tuile ' + (etat.w2Fait ? 'fait' : 'prevu') + '" id="tuile-w2" aria-label="Workout 2, aujourd\'hui"><span class="ck">' + (etat.w2Fait ? '✓' : '▸') + '</span><span class="vert">Bas du corps + circuit</span><span class="w">W2</span></button>';
    if (n === 22 && etat.w3Place) return '<div class="tuile place" id="tuile-w3"><span class="ck">·</span><span class="vert">Full body</span><span class="w">W3</span></div>';
    return '';
  }
  function rendreSemaine() {
    var h = '<div class="semaine-tete" data-in><div><span class="etq">Semaine en cours</span><div class="gros" style="margin-top:4px">19 — 25 oct.</div></div><span class="etq">' + (etat.semaine) + '/3 faits</span></div><div class="cols" data-in>';
    JOURS.forEach(function (j) {
      h += '<div class="col' + (j[1] === 20 ? ' auj' : '') + '" data-n="' + j[1] + '"><div class="jr"><b>' + j[0] + '</b><span>' + j[1] + '</span></div><div class="corps">' + tuile(j) + '</div></div>';
    });
    $('#vue-sem').innerHTML = h + '</div>';
    var t = $('#tuile-w2'); if (t) t.onclick = function () { M3.ouvrirDepuis(t, 'workout'); };
  }
  function rendreMois() {
    var h = '<div class="mois-tete" data-in>' + ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="mois">';
    // 28 sept. → 1er nov. 2026 (le 1er octobre est un jeudi)
    var jours = [];
    for (var i = 28; i <= 30; i++) jours.push({ n: i, hors: true });
    for (var k = 1; k <= 31; k++) jours.push({ n: k });
    jours.push({ n: 1, hors: true });
    var faits = { 5: 'W1', 7: 'W2', 9: 'W3', 12: 'W1', 14: 'W2', 16: 'W3', 19: 'W1' };
    jours.forEach(function (j, idx) {
      var cl = 'jour', m = '', n = j.n;
      if (j.hors) cl += ' hors';
      else {
        if (n >= 19 && n <= 25) cl += ' semaine-en-cours';
        if (faits[n]) { cl += ' fait'; m = faits[n] + ' ✓'; }
        if (n === 20) { cl = 'jour auj'; m = etat.w2Fait ? 'W2 ✓' : 'W2'; }
        if (n === 22 && etat.w3Place) { cl += ' prog'; m = 'W3'; }
      }
      h += '<div class="' + cl + '"><span class="d">' + n + '</span><span class="m">' + m + '</span></div>';
    });
    h += '</div><div class="legende etq"><span><i style="background:var(--c-vert)"></i>Fait</span><span><i style="background:var(--accent)"></i>Aujourd\'hui</span><span><i style="border-style:dashed"></i>Placé</span></div>';
    $('#vue-mois').innerHTML = h;
  }
  function rendreListe() {
    var h = '<div class="titre-bloc" data-in><b>Fait</b><span class="etq">1 séance</span></div>' +
      '<div class="ligne fait-l" data-in><span class="w">W1</span><div class="tx"><b>Haut du corps</b><span class="etq">Fait lun. 19 oct.</span></div><span class="go">✓</span></div>';
    h += '<div class="titre-bloc" data-in><b>À faire cette semaine</b><span class="etq">' + (3 - etat.semaine - (etat.w3Place ? 0 : 0)) + ' restant' + '</span></div>';
    h += etat.w2Fait ? '<div class="ligne fait-l" data-in><span class="w">W2</span><div class="tx"><b>Bas du corps + circuit</b><span class="etq">Fait aujourd\'hui · mar. 20 oct.</span></div><span class="go">✓</span></div>'
      : '<button class="ligne" id="ligne-w2" data-in><span class="w">W2</span><div class="tx"><b>Bas du corps + circuit</b><span class="etq">Prévu aujourd\'hui · mar. 20 oct.</span></div><span class="go">VOIR</span></button>';
    h += etat.w3Place ? '<div class="ligne" data-in><span class="w">W3</span><div class="tx"><b>Full body</b><span class="etq">Placé jeudi 22 oct.</span></div><span class="go">JEU.</span></div>'
      : '<div class="ligne" data-in><span class="w">W3</span><div class="tx"><b>Full body</b><span class="etq">Pas encore placé</span></div><button class="go" id="place-w3" aria-label="Placer le workout 3 jeudi">PLACER JEU.</button></div>';
    $('#liste-faire').innerHTML = h;
    var l = $('#ligne-w2'); if (l) l.onclick = function () { M3.ouvrirDepuis(l, 'workout'); };
    var p = $('#place-w3'); if (p) p.onclick = function () { placerW3(p); };
  }
  var vue = 'sem';
  M3.basculerVue = function (vers) {
    if (vers === vue || occupe) return; occupe = true;
    var sem = $('#vue-sem'), mois = $('#vue-mois'), liste = $('#liste-faire');
    $('#t-sem').classList.toggle('on', vers === 'sem'); $('#t-mois').classList.toggle('on', vers === 'mois');
    $('#t-sem').setAttribute('aria-selected', vers === 'sem'); $('#t-mois').setAttribute('aria-selected', vers === 'mois');
    gsap.to('#seg-ind', { xPercent: vers === 'mois' ? 100 : 0, duration: M3.rm() ? 0 : 0.4, ease: E.sec });
    var sort = vers === 'mois' ? sem : mois, entre = vers === 'mois' ? mois : sem;
    var fin = function () { vue = vers; occupe = false; };
    if (vers === 'mois') rendreMois();
    var sel = vers === 'mois' ? '.col' : '.jour';
    if (M3.rm()) { sort.style.display = 'none'; entre.style.display = 'block'; gsap.fromTo(entre, { opacity: 0 }, { opacity: 1, duration: T.fondu, onComplete: fin }); return; }
    var tl = gsap.timeline({ onComplete: fin });
    tl.to(liste, { opacity: 0, duration: 0.15 }, 0);
    tl.fromTo($$(sel, sort), { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.34, stagger: { each: 0.035, from: 'end' }, ease: E.sec }, 0);
    tl.add(function () {
      sort.style.display = 'none'; entre.style.display = 'block';
      gsap.set($$('.col', sem), { clearProps: 'clipPath' });
    });
    var cibles = vers === 'mois' ? $$('.jour', mois) : $$('.col', sem);
    tl.fromTo(cibles, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.42, stagger: vers === 'mois' ? { grid: [5, 7], from: 'start', amount: 0.5 } : { each: 0.045 }, ease: E.sec, clearProps: 'clipPath' });
    tl.fromTo(liste, { opacity: 0 }, { opacity: 1, duration: 0.25 }, '>-0.15');
    tl.add(function () { $('#prog-defile').scrollTop = 0; }, '<');
  };
  function placerW3(btn) {   // la ligne « W3 » vole jusqu'à la colonne jeudi
    if (occupe) return; occupe = true;
    var dest = $('.col[data-n="22"] .corps'), r1 = M3.rel(btn), r2 = M3.rel(dest);
    if (vue === 'mois') { etat.w3Place = true; rendreMois(); rendreListe(); occupe = false; M3.toast('W3 placé jeudi 22 oct.'); return; }
    var c = document.createElement('div'); c.className = 'tuile place';
    c.style.cssText = 'position:absolute;z-index:85;left:' + r1.left + 'px;top:' + r1.top + 'px;width:' + r1.w + 'px;height:' + r1.h + 'px;background:var(--accent);color:var(--accent-texte);display:flex;align-items:center;justify-content:center;font:600 22px var(--font-titre)';
    c.textContent = 'W3'; M3.tel.appendChild(c);
    var fin = function () { c.remove(); etat.w3Place = true; rendreSemaine(); rendreListe(); occupe = false; if (!M3.rm()) gsap.fromTo('#tuile-w3', { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.35, ease: E.sec, clearProps: 'clipPath' }); M3.toast('W3 placé jeudi 22 oct.'); };
    if (M3.rm()) return fin();
    gsap.to(c, { x: r2.left + 6 - r1.left, y: r2.top + 6 - r1.top, scaleX: Math.max(0.1, (r2.w - 12) / r1.w), scaleY: Math.max(0.1, (r2.h - 12) / r1.h), transformOrigin: '0 0', duration: 0.7, ease: E.coupe, onComplete: fin });
  }
  function prepProgramme() {
    vue = 'sem'; $('#vue-sem').style.display = 'block'; $('#vue-mois').style.display = 'none';
    $('#t-sem').classList.add('on'); $('#t-mois').classList.remove('on'); gsap.set('#seg-ind', { xPercent: 0 });
    rendreSemaine(); rendreListe(); $('#prog-defile').scrollTop = 0;
  }
  function entreeProgramme(tl, t) {
    var cols = $$('#vue-sem .col');
    if (!M3.rm()) tl.fromTo(cols, { yPercent: 6, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: E.sec, clearProps: 'transform,opacity' }, t);
  }

  /* =============== Questionnaire =============== */
  var qi = 0, qRep = {}, qEnCours = false, qBusy = false;
  function prepQuestionnaire() {
    qi = 0; qRep = {}; qEnCours = false; qBusy = false;
    $('#q-fin').style.display = 'none'; $('#q-zone').innerHTML = ''; $('#q-zone').style.display = 'block';
    $('#q-prog').innerHTML = D.questions.map(function () { return '<i><b></b></i>'; }).join('');
    qMaj();
    var p = qPanneau(0); $('#q-zone').appendChild(p); p.style.display = 'flex';
  }
  function qMaj() {
    $('#q-compte').textContent = 'Check-in · ' + (qi + 1) + '/' + D.questions.length;
    $$('#q-prog i b').forEach(function (b, i) { gsap.to(b, { scaleX: i < qi ? 1 : (i === qi ? 0.35 : 0), duration: M3.rm() ? 0 : 0.5, ease: E.sec }); });
  }
  function qPanneau(i) {
    var q = D.questions[i], p = document.createElement('div'); p.className = 'q-pan'; p.style.display = 'none';
    var h = '<span class="etq">Question ' + (i + 1) + ' sur ' + D.questions.length + '</span><h2 class="titre-cin" aria-label="' + q.titre + '">' + q.titre + '</h2>';
    var dernier = i === D.questions.length - 1;
    if (q.type === 'curseur') {
      h += '<span class="etq aide">' + q.aide + '</span><div class="cur-val"><span class="num flap-q"></span><span class="etq">/ 10</span></div><div class="cur">' + Array.apply(null, Array(11)).map(function (_, k) { return '<button aria-label="' + k + '"><b></b><span>' + k + '</span></button>'; }).join('') + '</div>';
      h += '<div class="q-fin-bas"><button class="btn q-suiv">' + (dernier ? 'Terminer' : 'Suivant') + '</button></div>';
    } else {
      h += '<div style="height:14px"></div><div class="choix ' + (q.type === 'emojis' ? 'emojis' : '') + '">' + q.choix.map(function (c, k) {
        return '<button data-k="' + k + '"><b></b>' + (q.type === 'emojis' ? '<em>' + c[0] + '</em><span>' + c[1] + '</span>' : '<span>' + c[0] + '</span><small>' + c[1] + '</small>') + '</button>';
      }).join('') + '</div>';
      h += '<div class="q-fin-bas"><button class="btn q-suiv" disabled>' + (dernier ? 'Terminer' : 'Suivant') + '</button></div>';
    }
    p.innerHTML = h;
    var t = $('h2', p); M3.motsDans(t); t.style.overflow = 'hidden'; $$('.mot', t).forEach(function (m) { m.style.overflow = 'hidden'; m.style.verticalAlign = 'top'; });
    $('.q-suiv', p).onclick = function () { qSuivant(); };
    if (q.type === 'curseur') {
      var val = $('.flap-q', p), btns = $$('.cur button', p), v = q.defaut, wrap = $('.cur', p);
      var poser = function (n, anim) {
        qRep[q.id] = n;
        M3.flap(val, ('0' + n).slice(-2), anim ? (n > v ? 'asc' : 'desc') : null);
        btns.forEach(function (b, k) { b.classList.toggle('on', k <= n); gsap.to($('b', b), { scaleY: k <= n ? 1 : 0, duration: anim && !M3.rm() ? 0.22 : 0, ease: E.sec }); });
        if (anim && n !== v) M3.cran();
        v = n;
      };
      var viser = function (e) { var r = wrap.getBoundingClientRect(), k = Math.max(0, Math.min(10, Math.floor((e.clientX - r.left) / r.width * 11))); if (k !== v) poser(k, true); };
      var bas = false;
      wrap.addEventListener('pointerdown', function (e) { bas = true; wrap.setPointerCapture(e.pointerId); viser(e); });
      wrap.addEventListener('pointermove', function (e) { if (bas) viser(e); });
      wrap.addEventListener('pointerup', function () { bas = false; }); wrap.addEventListener('pointercancel', function () { bas = false; });
      wrap.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') poser(Math.min(10, v + 1), true); if (e.key === 'ArrowLeft') poser(Math.max(0, v - 1), true); });
      p._init = function () { M3.flap(val, '00', null); v = 0; gsap.delayedCall(0.35, function () { poser(q.defaut, true); }); };
      btns.forEach(function (b, k) { b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poser(k, true); } }); });
    } else {
      $$('.choix button', p).forEach(function (b) {
        b.onclick = function () {
          if (b.classList.contains('on') || qEnCours) return;
          $$('.choix button', p).forEach(function (o) { o.classList.remove('on'); gsap.to($('b', o), { scaleX: 0, duration: M3.rm() ? 0 : 0.2, ease: E.sec, transformOrigin: '100% 50%' }); });
          b.classList.add('on'); gsap.fromTo($('b', b), { scaleX: 0 }, { scaleX: 1, duration: M3.rm() ? 0 : 0.3, ease: E.sec, transformOrigin: '0% 50%' });
          qRep[q.id] = +b.dataset.k; $('.q-suiv', p).disabled = false; M3.cran();
          qEnCours = true; setTimeout(function () { qEnCours = false; qSuivant(); }, 520);   // un geste : on passe à la suite
        };
      });
    }
    return p;
  }
  function qSuivant() {
    if (qBusy) return;
    var cur = $('#q-zone .q-pan:last-child'); if (!cur) return;
    if (qi >= D.questions.length - 1) return qFin();
    qi++; qMaj(); qBusy = true;
    var nxt = qPanneau(qi); $('#q-zone').appendChild(nxt);
    M3.whip(cur, nxt, 1, function () { cur.remove(); qBusy = false; });
    var t = $('h2', nxt); if (!M3.rm()) gsap.from($$('.mot i', t), { yPercent: 100, duration: 0.6, stagger: 0.06, delay: 0.25, ease: E.sec });
    if (nxt._init) nxt._init();
    if (!M3.rm() && !$('.cur', nxt)) gsap.from($$('.choix button', nxt), { x: 40, opacity: 0, duration: 0.5, stagger: 0.06, delay: 0.25, ease: E.sec });
  }
  M3.fete = function (cont, n) {      // barres de couleur qui tombent, coupes franches
    var cs = ['--c-jaune', '--c-vert', '--c-cyan', '--c-rose', '--c-craie', '--c-rouge'], H = M3.tel.offsetHeight;
    cont.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var b = document.createElement('i'); b.style.left = (i / n * 100) + '%'; b.style.width = (100 / n) + '%'; b.style.height = (60 + Math.random() * 160) + 'px';
      b.style.background = 'var(' + cs[i % cs.length] + ')'; b.style.border = '3px solid var(--encre)'; cont.appendChild(b);
    }
    if (M3.rm()) return;
    gsap.fromTo($$('i', cont), { y: -260 }, { y: H + 60, duration: function () { return 0.7 + Math.random() * 0.7; }, delay: function () { return Math.random() * 0.45; }, ease: 'power2.in', onComplete: function () { cont.innerHTML = ''; } });
  };
  function qFin() {
    var zone = $('#q-zone'), fin = $('#q-fin'), vol = M3.volets;
    $('#q-compte').textContent = 'Check-in · fait';
    $$('#q-prog i b').forEach(function (b) { gsap.to(b, { scaleX: 1, duration: M3.rm() ? 0 : 0.4, stagger: 0.05, ease: E.sec }); });
    vol(function () {
      zone.style.display = 'none'; fin.style.display = 'flex';
      var f = $('#fl-qfin'); M3.flap(f, '0/5', null);
      var c = $('#q-fin-t'); c._l = null; gsap.delayedCall(0.3, function () { M3.entreeLettres(c); M3.flap(f, '5/5', 'asc'); });
    }, { rapide: true });
    gsap.delayedCall(0.9, function () { M3.bip(660, 0.1, 0.1); setTimeout(function () { M3.bip(990, 0.18, 0.1); }, 120); M3.fete(feteQ(), 12); });
  }
  function feteQ() {
    var c = $('#fete-q'); if (!c) { c = document.createElement('div'); c.id = 'fete-q'; c.className = 'barres-fete'; $('#e-questionnaire').appendChild(c); }
    return c;
  }
  function initQuestionnaire() {
    $('#q-retour').onclick = function () {
      etat.checkin = true;
      M3.retour(function () {
        majAccueil();
        if (!M3.rm()) { gsap.fromTo('#pastille', { scale: 1 }, { scale: 0, duration: 0.01 }); gsap.fromTo('#c-quest', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: E.sec, clearProps: 'clipPath' }); gsap.set('#pastille', { clearProps: 'transform' }); }
        M3.bip(880, 0.1, 0.08);
      });
    };
  }

  /* =============== Tables de préparation / entrée / sortie par page =============== */
  var PREP = { workout: prepWorkout, programme: prepProgramme, questionnaire: prepQuestionnaire };
  var ENTREE = { coaching: entreeCoaching, programme: entreeProgramme, questionnaire: function (tl, t) { var p = $('#q-zone .q-pan'); if (p && p._init) tl.add(p._init, t); if (p && !M3.rm()) tl.fromTo($$('.mot i', p), { yPercent: 100 }, { yPercent: 0, duration: 0.6, stagger: 0.06, ease: E.sec }, t - 0.1); } };
  var LEAVE = { questionnaire: function () { var f = $('#fete-q'); if (f) f.innerHTML = ''; } };

  /* =============== Branchements =============== */
  M3.initPages = function () {
    initReglages(); batirMenu(); initCoaching(); initQuestionnaire(); icone(false);
    $$('[data-ouvre]').forEach(function (b) { b.addEventListener('click', function () { M3.ouvrirDepuis(b, b.dataset.ouvre); }); });
    $$('[data-retour]').forEach(function (b) { b.addEventListener('click', function () { M3.retour(); }); });
    $('#btn-menu').addEventListener('click', function () { if (occupe) return; menuOuvert ? M3.fermerMenu() : M3.ouvrirMenu(); });
    $('#t-sem').onclick = function () { M3.basculerVue('sem'); };
    $('#t-mois').onclick = function () { M3.basculerVue('mois'); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (menuOuvert) M3.fermerMenu(); else if ($('#e-seance').style.display !== 'block') M3.retour(); } });
    $('#b-demarrer').addEventListener('click', function () { M3.demarrerSeance(); });
  };
  M3.occupe = function (v) { if (v !== undefined) occupe = v; return occupe; };
})(window.M3);
