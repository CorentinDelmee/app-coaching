/* M2 « Carnet » — navigation, accueil, menu, coaching, programme, workout, questionnaire.
   Une fonction par transition : ouvrirCarte / fermerCarte / ouvrirMenu / fermerMenu / choisirRubrique /
   basculerVue / ouvrirQuestionnaire / qAller. Les durées sont dans DUREE, les courbes dans EASE (outils.js). */
'use strict';

const S = { w2Fait: false, questFait: false, w3Jour: null, vue: 'semaine', placement: false };
const Nav = { pile: [], occupe: false, z: 10 };
const C_ANNEAU = 2 * Math.PI * 48;
const COCHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="trait" pathLength="1" d="M5 12.5l4.5 4.5L19 7"/></svg>';

/* =============== Navigation générique =============== */
const SANS_MENU = ['e-seance', 'e-circuit', 'e-fin', 'e-quest'];
function setChrome(id) { $('#btn-menu').classList.toggle('cache', SANS_MENU.includes(id)); }
function topId() { const t = Nav.pile[Nav.pile.length - 1]; return t ? t.id : 'e-dash'; }

/* La carte touchée devient la page : clip-path depuis son rectangle + le titre voyage (voler). */
function ouvrirCarte(id, { carte, src, dst, rayon = 26, auReveal } = {}) {
  if (Nav.occupe) return;
  Nav.occupe = true;
  const e = $('#' + id), rev = $$('.rev', e);
  const bg = getComputedStyle(carte).backgroundColor;
  e.style.zIndex = ++Nav.z; e.classList.add('visible');
  $$('.defile', e).forEach(d => { d.scrollTop = 0; });
  if (rev.length) gsap.set(rev, { opacity: 0 });
  const voile = document.createElement('div'); voile.className = 'voile'; voile.style.background = bg; e.appendChild(voile);
  Nav.pile.push({ id, mode: 'carte', carte, src, dst, rayon });
  setChrome(id);
  if (src && dst) voler(src, dst, { duree: DUREE.page });
  const fin = () => { gsap.set(e, { clearProps: 'clipPath,opacity' }); voile.remove(); Nav.occupe = false; };
  const reveler = () => { revealer(rev); if (auReveal) auReveal(); };
  if (RM) {
    gsap.fromTo(e, { opacity: 0 }, { opacity: 1, duration: .3, onComplete: fin });
    gsap.to(voile, { opacity: 0, duration: .3 }); reveler(); return;
  }
  gsap.set(e, { clipPath: clipDepuis(carte, rayon) });
  gsap.timeline({ onComplete: fin })
    .to(e, { clipPath: CLIP_PLEIN, duration: DUREE.page, ease: EASE.entree })
    .to(voile, { opacity: 0, duration: .4, ease: 'power1.out' }, DUREE.page - .45)
    .add(reveler, DUREE.page - .3);
}

/* Retour : la page redevient la carte (plus rapide que l'aller, sortie asymétrique). */
function fermerCarte(top, cb) {
  Nav.occupe = true;
  const e = $('#' + top.id), rev = $$('.rev', e);
  const voile = document.createElement('div'); voile.className = 'voile'; voile.style.background = getComputedStyle(top.carte).backgroundColor; voile.style.opacity = 0; e.appendChild(voile);
  const fin = () => {
    e.classList.remove('visible'); gsap.set(e, { clearProps: 'clipPath,opacity' }); voile.remove();
    if (top.src) top.src.style.visibility = '';
    Nav.occupe = false; setChrome(topId()); if (cb) cb();
  };
  if (rev.length) gsap.to(rev, { opacity: 0, duration: .2, ease: 'power2.out' });
  if (RM) { gsap.to(e, { opacity: 0, duration: .3, onComplete: fin }); if (top.src) top.src.style.visibility = ''; return; }
  gsap.to(voile, { opacity: 1, duration: .3 });
  if (top.dst && top.src) voler(top.dst, top.src, { duree: DUREE.retour, delai: .12, montrerSrc: true });
  gsap.fromTo(e, { clipPath: CLIP_PLEIN }, { clipPath: () => clipDepuis(top.carte, top.rayon), duration: DUREE.retour, delay: .12, ease: EASE.entree, onComplete: fin });
}

/* Page ouverte depuis le menu : retour par glissement + légère profondeur. */
function fermerPousse(top) {
  Nav.occupe = true;
  const e = $('#' + top.id), dash = $('#e-dash');
  gsap.to($$('.rev', e), { opacity: 0, duration: .2 });
  const fin = () => { e.classList.remove('visible'); gsap.set(e, { clearProps: 'transform,opacity' }); gsap.set(dash, { clearProps: 'transform,opacity' }); Nav.occupe = false; setChrome(topId()); };
  if (RM) { gsap.to(e, { opacity: 0, duration: .3, onComplete: fin }); return; }
  gsap.fromTo(dash, { xPercent: -16, opacity: .45 }, { xPercent: 0, opacity: 1, duration: DUREE.retour, ease: EASE.sortie });
  gsap.to(e, { xPercent: 100, duration: DUREE.retour, ease: EASE.entree, onComplete: fin });
}

function retour() {
  if (Nav.occupe || !Nav.pile.length) return;
  const top = Nav.pile.pop();
  if (top.mode === 'carte') fermerCarte(top); else fermerPousse(top);
}

/* Revient à l'accueil depuis n'importe où (menu « Accueil », fin de séance). */
function versAccueil() {
  if (!Nav.pile.length) return;
  const top = Nav.pile.pop();
  Nav.pile.forEach(p => $('#' + p.id).classList.remove('visible'));
  Nav.pile = [];
  if (top.mode === 'carte') fermerCarte(top); else fermerPousse(top);
}
function toutFermerSansAnim() {
  Nav.pile.forEach(p => $('#' + p.id).classList.remove('visible')); Nav.pile = [];
  ['e-seance', 'e-circuit', 'e-fin', 'e-quest'].forEach(i => $('#' + i).classList.remove('visible'));
  rendreTitres(); setChrome('e-dash');
}
document.addEventListener('click', e => { if (e.target.closest('[data-retour]')) retour(); });

/* =============== Menu =============== */
const Menu = { ouvert: false };
function rubriqueCourante() {
  const id = topId();
  return { 'e-dash': 'dash', 'e-programme': 'programme', 'e-coaching': 'coaching', 'e-quest': 'quest', 'e-avenir': S.avenir || 'suivi' }[id] || 'dash';
}
function ouvrirMenu() {
  if (Menu.ouvert || Nav.occupe) return;
  Menu.ouvert = true;
  const m = $('#menu'), b = $('#btn-menu');
  $$('.mot', m).forEach(x => { x.style.visibility = ''; });
  const cur = rubriqueCourante();
  $$('#menu a').forEach(a => a.classList.toggle('ici', a.dataset.r === cur));
  $('#menu-pastille').style.display = S.questFait ? 'none' : '';
  b.classList.add('sur-menu'); b.setAttribute('aria-expanded', 'true'); m.setAttribute('aria-hidden', 'false');
  m.style.display = 'flex';
  const c = cercleDepuis(b, 24);
  if (RM) { gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: .25 }); return; }
  gsap.killTweensOf([m, '.menu .mot']);
  gsap.fromTo(m, { clipPath: c.depart }, { clipPath: c.plein, duration: DUREE.menu, ease: EASE.entree });
  gsap.fromTo('#menu .mot', { yPercent: 115 }, { yPercent: 0, duration: 1.1, stagger: .07, delay: .32, ease: EASE.sortie });
  gsap.fromTo('#menu .mn, #menu .pastille-m, #menu a.ici .pt, #menu .menu-pied, #menu .menu-haut', { opacity: 0 }, { opacity: 1, duration: .5, stagger: .03, delay: .5 });
}
function fermerMenu(cb, { duree = .7 } = {}) {
  if (!Menu.ouvert) { if (cb) cb(); return; }
  Menu.ouvert = false;
  const m = $('#menu'), b = $('#btn-menu');
  b.classList.remove('sur-menu'); b.setAttribute('aria-expanded', 'false'); m.setAttribute('aria-hidden', 'true');
  const fin = () => { m.style.display = 'none'; gsap.set(m, { clearProps: 'clipPath,opacity' }); if (cb) cb(); };
  if (RM) { gsap.to(m, { opacity: 0, duration: .2, onComplete: fin }); return; }
  const c = cercleDepuis(b, 24);
  gsap.to('#menu .mn, #menu .pastille-m, #menu .pt, #menu .menu-pied, #menu .menu-haut', { opacity: 0, duration: .2 });
  gsap.to(m, { clipPath: c.depart, duration: duree, ease: EASE.entree, onComplete: fin });
}
$('#btn-menu').addEventListener('click', () => { if (Menu.ouvert) fermerMenu(); else ouvrirMenu(); });

/* Page ouverte depuis une rubrique du menu : le mot du menu voyage jusqu'au titre de la page. */
function ouvrirDepuisMenu(id, { src, dst, auReveal } = {}) {
  Nav.occupe = true;
  Nav.pile.forEach(p => $('#' + p.id).classList.remove('visible'));
  const e = $('#' + id), rev = $$('.rev', e);
  Nav.pile = [{ id, mode: 'menu' }];
  e.style.zIndex = ++Nav.z; e.classList.add('visible');
  $$('.defile', e).forEach(d => { d.scrollTop = 0; });
  if (rev.length) gsap.set(rev, { opacity: 0 });
  rendreTitres();
  setChrome(id);
  const memeTexte = src && dst && src.textContent.trim().toLowerCase() === dst.textContent.trim().toLowerCase();
  if (memeTexte) voler(src, dst, { duree: DUREE.page, delai: .08 });
  else if (dst) { dst.style.visibility = ''; gsap.fromTo(dst, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, delay: .45, ease: EASE.sortie, clearProps: 'transform,opacity' }); }
  fermerMenu(() => { Nav.occupe = false; }, { duree: .8 });
  gsap.delayedCall(RM ? .15 : .55, () => { revealer(rev); if (auReveal) auReveal(); });
}

function choisirRubrique(r) {
  if (Nav.occupe) return;
  const mot = $(`#menu a[data-r="${r}"] .mot`);
  const cur = rubriqueCourante();
  if (r === cur) { fermerMenu(); return; }
  if (r === 'dash') { Nav.occupe = true; fermerMenu(() => { Nav.occupe = false; }); versAccueilSousMenu(); return; }
  if (r === 'programme') ouvrirDepuisMenu('e-programme', { src: mot, dst: $('#pr-titre'), auReveal: animProgramme });
  else if (r === 'coaching') ouvrirDepuisMenu('e-coaching', { src: mot, dst: $('#co-titre'), auReveal: animCoaching });
  else if (r === 'quest') { Nav.occupe = true; fermerMenu(() => { Nav.occupe = false; }); ouvrirQuestionnaire('menu'); }
  else {
    S.avenir = r;
    $('#av-titre').textContent = r === 'suivi' ? 'Suivi' : 'Profil';
    $('#av-kicker').textContent = r === 'suivi' ? 'Poids · mensurations · douleurs' : 'Infos · préférences · export';
    $('#av-texte').textContent = r === 'suivi' ? 'Ton poids, tes mensurations et la carte des douleurs arrivent dans une prochaine version.' : 'Tes infos, ton code et tes préférences arrivent dans une prochaine version.';
    ouvrirDepuisMenu('e-avenir', { src: mot, dst: $('#av-titre'), auReveal: () => tracer($('#av-trait'), { duree: 1.2, delai: .2 }) });
  }
}
function versAccueilSousMenu() {
  if (!Nav.pile.length) return;
  const top = Nav.pile.pop(); Nav.pile.forEach(p => $('#' + p.id).classList.remove('visible')); Nav.pile = [];
  const e = $('#' + top.id);
  setChrome('e-dash');
  const fin = () => { e.classList.remove('visible'); gsap.set(e, { clearProps: 'all' }); rendreTitres(); };
  gsap.to(e, { xPercent: RM ? 0 : 100, opacity: RM ? 0 : 1, duration: .8, delay: .1, ease: EASE.entree, onComplete: fin });
}
$('#menu-liste').addEventListener('click', e => { const a = e.target.closest('a[data-r]'); if (a) choisirRubrique(a.dataset.r); });

/* =============== Accueil =============== */
function setAnneau(n, { anim = false, delai = 0 } = {}) {
  const p = $('#ring-p'), cible = C_ANNEAU * (1 - n / 3);
  p.style.strokeDasharray = C_ANNEAU;
  $('#sem-anneau').classList.toggle('plein', n >= 3);
  if (!anim) { p.style.strokeDashoffset = cible; return; }
  gsap.to(p, { strokeDashoffset: cible, duration: RM ? .3 : 1.5, delay: delai, ease: EASE.sortie });
}
function majDash({ anim = false } = {}) {
  const n = S.w2Fait ? 2 : 1, hero = $('#carte-hero');
  hero.classList.toggle('fait', S.w2Fait);
  $('#h-kicker').textContent = S.w2Fait ? 'Aujourd’hui · terminée' : 'Aujourd’hui · ≈ 50 min';
  $('#h-suite').textContent = S.w2Fait ? 'Bien joué, Fabien.' : '+ circuit AMRAP';
  $('#h-meta').innerHTML = S.w2Fait ? 'Prochain : Workout 3<br>Full body' : 'Workout 2<br>5 exercices · 1 circuit';
  $('#h-go').innerHTML = S.w2Fait ? '<svg viewBox="0 0 24 24">' + '<path d="M5 12.5l4.5 4.5L19 7"/></svg>' : '<svg viewBox="0 0 24 24"><use href="#i-fleche"/></svg>';
  $('#d-sem-txt').textContent = n === 1 ? 'séance faite' : 'séances faites';
  if (!anim) { $('#d-sem-n').textContent = n; $('#d-sem-n').dataset.val = n; setAnneau(n); }
  $('#h-apercu').style.display = S.w2Fait ? 'none' : '';
  $('#pastille').style.display = S.questFait ? 'none' : '';
  $('#qq-txt').textContent = S.questFait ? 'fait ce matin ✓' : 'du jour · 1 min';
  $('#qq-kick').textContent = S.questFait ? 'Fait' : 'À remplir';
}
function entreeDash() {
  const n = S.w2Fait ? 2 : 1;
  lignes($('.d-salut h1'), { delai: .1 });
  revealer($$('.d-haut > *, #e-dash .carte'), { delai: .3, y: 70, stagger: .1, duree: 1.15 });
  setAnneau(0); $('#ring-p').style.strokeDashoffset = C_ANNEAU;
  setAnneau(n, { anim: true, delai: .9 });
  rouler($('#d-sem-n'), n, { delai: .85 });
  if (!RM) gsap.fromTo('#h-go', { scale: .4, rotate: -90 }, { scale: 1, rotate: 0, duration: 1.1, delay: .9, ease: 'back.out(1.8)', clearProps: 'transform' });
}
/* Retour de séance : le rideau de fin se referme sur l'anneau, qui passe à 2/3 avec un petit rebond. */
function animerSemaineMiseAJour() {
  const ring = $('#sem-anneau');
  majDash({ anim: true });
  setAnneau(1); $('#ring-p').style.strokeDashoffset = C_ANNEAU * (1 - 1 / 3);
  $('#d-sem-n').dataset.val = 1; $('#d-sem-n').textContent = 1;
  gsap.delayedCall(RM ? 0 : .15, () => {
    rouler($('#d-sem-n'), 2, { duree: 1.4 });
    setAnneau(2, { anim: true });
    if (!RM) gsap.fromTo(ring, { scale: 1 }, { scale: 1.12, duration: .35, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'transform' });
    revealer($('#carte-hero'), { y: 20, duree: .9 });
  });
}

$('#carte-hero').addEventListener('click', () => ouvrirCarte('e-workout', { carte: $('#carte-hero'), src: $('#h-titre'), dst: $('#wk-titre'), rayon: 30, auReveal: animWorkout }));
$('#carte-coaching').addEventListener('click', () => ouvrirCarte('e-coaching', { carte: $('#carte-coaching'), src: $('#cc-titre'), dst: $('#co-titre'), auReveal: animCoaching }));
$('#carte-prog').addEventListener('click', () => ouvrirCarte('e-programme', { carte: $('#carte-prog'), src: $('#pg-titre'), dst: $('#pr-titre'), auReveal: animProgramme }));
$('#carte-quest').addEventListener('click', () => { if (!S.questFait) ouvrirQuestionnaire('carte'); else toast('Check-in déjà fait aujourd’hui'); });
$('#carte-semaine').addEventListener('click', () => ouvrirCarte('e-programme', { carte: $('#carte-semaine'), src: $('#d-sem-n'), dst: $('#pr-titre'), auReveal: animProgramme }));

/* =============== Coaching =============== */
const SEANCE_COACH = new Date('2026-10-27T18:30:00'), MAINTENANT = new Date('2026-10-20T10:00:00');
function wa(txt) { return 'https://wa.me/?text=' + encodeURIComponent(txt); }
function initCoaching() {
  $('#co-modif').href = wa('Salut Corentin, c’est Fabien. Je voudrais déplacer notre séance du mardi 27 octobre à 18 h 30.');
  $('#co-annul').href = wa('Salut Corentin, c’est Fabien. Je dois annuler notre séance du mardi 27 octobre à 18 h 30.');
  $('#co-mot-btn').href = wa('Salut Corentin, c’est Fabien. ');
  const heures = (SEANCE_COACH - MAINTENANT) / 36e5;
  ['#co-modif', '#co-annul'].forEach(s => $(s).addEventListener('click', ev => {
    if (heures < 24 && !confirm('Moins de 24 h avant la séance : l’annulation n’est plus gratuite. Continuer ?')) ev.preventDefault();
  }));
}
function animCoaching() {
  rouler($('#co-n'), 4, { delai: .25 });
  rouler($('#co-eur'), 105, { delai: .4, duree: 1.6 });
  lignes($('#co-mot'), { delai: .3, duree: 1.1, stagger: .12 });
}

/* =============== Programme : semaine ⇄ mois (GSAP Flip) =============== */
const JL = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const FAITS = { 5: 'W1', 7: 'W2', 9: 'W3', 12: 'W1', 14: 'W2', 16: 'W3', 19: 'W1' };
const WTITRE = { W1: 'Haut du corps', W2: 'Bas du corps', W3: 'Full body' };
function construireCal() {
  const cal = $('#cal'); $$('.jour', cal).forEach(j => j.remove());
  for (let i = 0; i < 35; i++) {
    const d = new Date(2026, 8, 28 + i), num = d.getDate(), mois = d.getMonth();
    const hors = mois !== 9, sc = i >= 21 && i <= 27, auj = i === 22;
    const w = (!hors && FAITS[num]) || (auj ? 'W2' : (S.w3Jour === i ? 'W3' : null));
    const fait = !hors && !!FAITS[num];
    const el = document.createElement('div');
    el.className = 'jour' + (hors ? ' hors' : '') + (sc ? ' sc' : '') + (auj ? ' auj' : '') + (fait ? ' fait' : '');
    el.dataset.i = i; el.dataset.flipId = 'j' + i;
    let m = '';
    if (fait) m = `<span class="jc">${COCHE}</span><span class="jw">${w}</span><span class="jlib">${WTITRE[w]}</span>`;
    else if (auj) m = `<span class="jp"></span><span class="jw">W2</span><span class="jlib">${S.w2Fait ? 'fait' : 'à faire'}</span>`;
    else if (w) m = `<span class="jw">${w}</span><span class="jlib">${WTITRE[w]}</span>`;
    el.innerHTML = `<span class="jl">${JL[i % 7]}</span><span class="jn">${num}</span><span class="jm">${m}</span>`;
    if (auj && S.w2Fait) { el.classList.add('fait'); el.classList.remove('auj'); el.querySelector('.jm').innerHTML = `<span class="jc">${COCHE}</span><span class="jw">W2</span><span class="jlib">fait</span>`; }
    cal.appendChild(el);
  }
  cal.appendChild($('#sem-cadre'));
  construireListeW();
}
function construireListeW() {
  const l = $('#pr-liste');
  const w2 = S.w2Fait
    ? `<li class="ligne-w"><span class="wn">W2</span><span class="wt"><span class="vt">Bas du corps</span><p>Fait aujourd’hui</p></span><span class="etat">${COCHE}</span></li>`
    : `<li><button class="ligne-w" id="ligne-w2"><span class="wn">W2</span><span class="wt"><span class="vt" id="lw2-titre">Bas du corps</span><p>Aujourd’hui · ≈ 50 min</p></span><span class="etat"><span class="pt-auj"></span>Aujourd’hui</span></button></li>`;
  const w3 = S.w3Jour != null
    ? `<li class="ligne-w"><span class="wn">W3</span><span class="wt"><span class="vt">Full body</span><p>Prévu ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][S.w3Jour % 7]} ${new Date(2026, 8, 28 + S.w3Jour).getDate()} oct.</p></span><span class="etat">Placé</span></li>`
    : `<li class="ligne-w"><span class="wn">W3</span><span class="wt"><span class="vt">Full body</span><p>Pas encore placé</p></span><button class="mini-btn" id="placer-w3">${S.placement ? 'Choisis un jour' : 'Placer'}</button></li>`;
  l.innerHTML = `<li class="ligne-w"><span class="wn">W1</span><span class="wt"><span class="vt">Haut du corps</span><p>Fait lundi 19 oct.</p></span><span class="etat">${COCHE}</span></li>` + w2 + w3;
  $$('.etat svg', l).forEach(s => { s.style.strokeDasharray = 1; s.style.strokeDashoffset = 0; });
}
function animProgramme() {
  const cal = $('#cal');
  const marques = $$('.jour.sc .jm, .cal .jour.sc .jn', cal);
  $$('.jc path', cal).forEach(p => tracer(p, { duree: .7, delai: .5 }));
  $$('.etat path', $('#pr-liste')).forEach(p => tracer(p, { duree: .7, delai: .7 }));
  if (!RM) gsap.fromTo($$('.jour.sc', cal), { yPercent: 8, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, stagger: .06, ease: EASE.sortie, clearProps: 'transform,opacity' });
  void marques;
}
function placerSem() {
  const cadre = $('#sem-cadre');
  if (S.vue !== 'mois') { gsap.set(cadre, { opacity: 0 }); return; }
  const r = $('.jour[data-i="21"]', $('#cal'));
  gsap.set(cadre, { y: r.offsetTop - 4, height: r.offsetHeight + 8 });
  gsap.to(cadre, { opacity: 1, duration: .5 });
}
function basculerVue(v) {
  if (S.vue === v || Nav.occupe) return;
  S.vue = v;
  const cal = $('#cal'), pion = $('#pion');
  $$('#bascule button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  gsap.to(pion, { xPercent: v === 'mois' ? 100 : 0, duration: .6, ease: EASE.sortie });
  gsap.set($('#sem-cadre'), { opacity: 0 });
  $('#cal-titre').textContent = v === 'mois' ? 'Octobre 2026' : 'Semaine du 19 octobre';
  $('#cal-sous').textContent = v === 'mois' ? 'S1 3/3 · S2 3/3 · S3 en cours' : '3 séances / sem.';
  const bascule = () => {
    const suivants = $$('.afaire, .histo');
    const etat = Flip.getState([...$$('.jour', cal), ...suivants]);
    cal.classList.toggle('semaine', v === 'semaine'); cal.classList.toggle('mois', v === 'mois');
    cal.style.height = cal.offsetHeight + 'px';
    Flip.from(etat, {
      duration: RM ? .01 : .95, ease: EASE.entree, absolute: '.jour', scale: true, nested: false,
      onEnter: els => gsap.fromTo(els, { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: .7, ease: EASE.sortie, stagger: { each: .015, from: 'start' } }),
      onLeave: els => gsap.to(els, { opacity: 0, scale: .6, duration: .4 }),
      onComplete: () => {
        cal.style.height = '';
        gsap.to($$('.jour > *', cal), { opacity: 1, duration: .5, stagger: { each: .004 }, clearProps: 'opacity' });
        placerSem();
      },
    });
  };
  if (RM) { bascule(); return; }
  gsap.to($$('.jour > *', cal), { opacity: 0, duration: .18, onComplete: bascule });
}
$('#bascule').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) basculerVue(b.dataset.v); });
$('#pr-liste').addEventListener('click', e => {
  if (e.target.closest('#ligne-w2')) {
    ouvrirCarte('e-workout', { carte: $('#ligne-w2'), src: $('#lw2-titre'), dst: $('#wk-titre'), rayon: 8, auReveal: animWorkout });
  } else if (e.target.closest('#placer-w3')) {
    S.placement = !S.placement;
    $$('#cal .jour').forEach(j => { const i = +j.dataset.i; j.classList.toggle('dispo', S.placement && i > 22 && i <= 27 && !j.querySelector('.jw')); });
    $('#placer-w3').textContent = S.placement ? 'Choisis un jour' : 'Placer';
    if (S.placement) { if (S.vue !== 'semaine') basculerVue('semaine'); toast('Touche le jour où tu veux faire le W3'); }
  }
});
$('#cal').addEventListener('click', e => {
  const j = e.target.closest('.jour.dispo'); if (!j) return;
  S.w3Jour = +j.dataset.i; S.placement = false;
  const etat = Flip.getState('.jour', { props: 'opacity' });
  construireCal();
  const cell = $(`.jour[data-i="${S.w3Jour}"] .jm`);
  if (cell && !RM) gsap.from(cell, { scale: .3, opacity: 0, y: 30, duration: .9, ease: 'back.out(1.8)' });
  void etat; vibrer(12); toast('W3 placé — bien vu');
});

/* =============== Workout (overview) =============== */
const BLOCS = [['E', 'Échauffement', ['mob']], ['A', 'Bloc A', ['gob', 'fen']], ['B', 'Bloc B', ['hip', 'gai']], ['C', 'Circuit', ['amrap']], ['D', 'Option', ['emom']]];
const exoDe = id => SEQ.find(x => x.id === id);
const detExo = x => x.type === 'temps' ? `${x.series} × ${x.tps} s` : `${x.series} × ${x.reps} · ${fr(x.kg)} kg`;
const ICONE_LIRE = '<svg viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z"/></svg>';
function construireWorkout() {
  let n = 0, h = '';
  BLOCS.forEach(([lettre, nom, ids]) => {
    const exs = ids.map(exoDe);
    h += `<div class="bloc rev"><div class="bloc-t"><span class="bloc-l">${lettre}</span><span class="bloc-n">${nom}<br>${exs[0].type === 'circuit' ? exs[0].format + ' · ' + exs[0].minutes + ' min' : exs.length + ' exercice' + (exs.length > 1 ? 's' : '')}</span></div>`;
    exs.forEach(x => {
      if (x.type === 'circuit') {
        h += `<ul class="circ-liste">${x.exos.map(c => `<li><span class="nb num">${c.nb}</span><span class="nm">${c.nm}<small>${c.det || (x.format === 'AMRAP' ? 'à chaque tour' : '')}</small></span></li>`).join('')}</ul>`;
        return;
      }
      n++;
      h += `<div class="ex-l"><span class="no">${String(n).padStart(2, '0')}</span><h3>${x.nom}</h3><span class="det">${detExo(x)}</span>
        <div class="sub"><span>Repos ${mmss(x.repos)}</span>${x.par ? `<span>${x.reps} ${x.par}</span>` : ''}${x.prev ? `<span>Dernière fois ${x.prev}</span>` : ''}<a class="lien-v" href="${youtube(x.video)}" target="_blank" rel="noopener">${ICONE_LIRE} Vidéo</a></div></div>`;
    });
    h += '</div>';
  });
  $('#wk-blocs').innerHTML = h;
}
function animWorkout() {
  const m = $$('.wk-meta .num');
  rouler(m[0], '50', { delai: .2 }); rouler(m[1], '5', { delai: .3 }); rouler(m[2], '8', { delai: .4 });
}

/* =============== Questionnaire (check-in du jour) =============== */
const QS = [
  { t: 'curseur', q: 'Comment as-tu <em>dormi</em> cette nuit&nbsp;?', aide: 'De 0 (très mal) à 10 (parfaitement).', b: ['Très mal', 'Parfait'], def: 7 },
  { t: 'curseur', q: 'Quelle est ton <em>énergie</em> ce matin&nbsp;?', aide: 'De 0 (à plat) à 10 (en pleine forme).', b: ['À plat', 'Pleine forme'], def: 6 },
  { t: 'emoji', q: 'Et ton <em>humeur</em>&nbsp;?', aide: 'Choisis celle qui te ressemble.', o: [['😞', 'Bof'], ['😕', 'Un peu bas'], ['😐', 'Neutre'], ['🙂', 'Plutôt bien'], ['😄', 'Au top']] },
  { t: 'choix', q: 'Une <em>douleur</em> quelque part&nbsp;?', aide: 'Choisis ce qui s’en approche le plus.', o: ['Aucune', 'Légère, ça passe', 'Gênante', 'Forte'] },
  { t: 'choix', q: 'Combien as-tu <em>bu</em> hier&nbsp;?', aide: 'Eau, thé, tisanes : tout compte.', o: ['Moins d’1 litre', '1 à 2 litres', 'Plus de 2 litres'] },
];
const Q = { i: 0, rep: [], occupe: false, mode: 'carte' };
function ouvrirQuestionnaire(mode) {
  Q.i = 0; Q.rep = []; Q.mode = mode; $('#q-scene').innerHTML = '';
  $('#q-barre').style.transform = 'scaleX(0)';
  const apres = () => qAller(0, true);
  if (mode === 'carte') {
    ouvrirCarte('e-quest', { carte: $('#carte-quest'), src: $('#qq-titre'), dst: $('#q-titre'), auReveal: apres });
    gsap.set('#q-fermer, #q-pos, .q-prog', { opacity: 0 });
    gsap.to('#q-fermer, #q-pos, .q-prog', { opacity: 1, duration: .6, delay: RM ? 0 : .7 });
  } else {
    // depuis le menu : le panneau se déplie depuis le haut
    const e = $('#e-quest'); toutFermerSansAnim();
    Nav.pile = [{ id: 'e-quest', mode: 'menu' }]; e.style.zIndex = ++Nav.z; e.classList.add('visible'); setChrome('e-quest');
    $('#q-titre').style.visibility = '';
    gsap.fromTo(e, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: CLIP_PLEIN, duration: .9, ease: EASE.entree, delay: .2, clearProps: 'clipPath', onComplete: () => {} });
    gsap.delayedCall(.9, apres);
  }
}
$('#q-fermer').addEventListener('click', () => { if (Q.occupe) return; fermerQuestionnaire(); });
function fermerQuestionnaire() {
  const top = Nav.pile[Nav.pile.length - 1];
  if (!top) return;
  if (top.mode === 'carte') retour();
  else { Nav.pile.pop(); const e = $('#e-quest'); gsap.to(e, { yPercent: RM ? 0 : 100, opacity: RM ? 0 : 1, duration: .8, ease: EASE.entree, onComplete: () => { e.classList.remove('visible'); gsap.set(e, { clearProps: 'all' }); setChrome('e-dash'); rendreTitres(); } }); }
}
function qEcran(i) {
  const q = QS[i], el = document.createElement('div'); el.className = 'q-ecran';
  let zone = '';
  if (q.t === 'curseur') zone = `<div class="curs-val num"><span class="cv"></span><small>/10</small></div><div class="curs"><div class="curs-ligne"></div><div class="curs-ticks">${'<i></i>'.repeat(11)}</div><div class="curs-pion"></div></div><div class="curs-bornes"><span>${q.b[0]}</span><span>${q.b[1]}</span></div>`;
  else if (q.t === 'emoji') zone = `<div class="emojis">${q.o.map((o, k) => `<button data-k="${k}" aria-label="${o[1]}">${o[0]}</button>`).join('')}</div><p class="emoji-l">&nbsp;</p>`;
  else zone = `<div class="choix">${q.o.map((o, k) => `<button data-k="${k}"><span>${o}</span><span class="coche">${COCHE}</span></button>`).join('')}</div>`;
  el.innerHTML = `<div class="q-n num">${String(i + 1).padStart(2, '0')}</div><h2 class="q-q serif">${q.q}</h2><p class="q-aide">${q.aide}</p><div class="q-zone">${zone}</div><div class="q-bas"><button class="btn gros" ${q.t === 'curseur' ? '' : 'disabled'}>${i === QS.length - 1 ? 'Terminer' : 'Continuer'}</button></div>`;
  return el;
}
function qAller(i, premiere) {
  const scene = $('#q-scene'), ancien = $('.q-ecran', scene);
  const el = qEcran(i); scene.appendChild(el);
  Q.i = i; Q.occupe = true;
  $('#q-pos').textContent = (i + 1) + ' / ' + QS.length;
  gsap.to('#q-barre', { scaleX: (i + 1) / QS.length, duration: RM ? .2 : 1, ease: RM ? 'none' : 'back.out(2.2)' });
  if (ancien && !RM) {
    gsap.to(ancien, { xPercent: -28, opacity: 0, scale: .94, duration: .6, ease: 'power3.inOut', onComplete: () => ancien.remove() });
    gsap.fromTo(el, { xPercent: 100 }, { xPercent: 0, duration: .85, ease: EASE.entree, clearProps: 'transform' });
  } else if (ancien) ancien.remove();
  const qq = $('.q-q', el);
  gsap.delayedCall(premiere || RM ? 0 : .35, () => {
    lignes(qq, { duree: 1, stagger: .1 });
    revealer([$('.q-aide', el), $('.q-zone', el), $('.q-bas', el)], { y: 30, delai: .2, stagger: .08 });
    if (!RM) gsap.fromTo($('.q-n', el), { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: .55, duration: 1.1, ease: EASE.sortie, clearProps: 'transform' });
    Q.occupe = false;
  });
  const btn = $('.q-bas .btn', el), q = QS[i];
  const pret = v => { Q.rep[i] = v; btn.disabled = false; };
  btn.addEventListener('click', () => { if (i === QS.length - 1) qFin(); else qAller(i + 1); });
  if (q.t === 'curseur') qCurseur(el, q, pret);
  if (q.t === 'emoji') qEmoji(el, pret);
  if (q.t === 'choix') qChoix(el, pret);
}
function qCurseur(el, q, pret) {
  const zone = $('.curs', el), pion = $('.curs-pion', el), cv = $('.cv', el);
  let v = q.def, rect = null;
  const W = () => zone.clientWidth;
  const aller = (nv, { anim = true } = {}) => {
    if (nv !== v) { rouler(cv, nv, { duree: .5, sens: nv > v ? 1 : -1, stagger: 0 }); Son.tick(); vibrer(6); v = nv; }
    gsap.to(pion, { x: v / 10 * W(), duration: anim ? .4 : 0, ease: 'back.out(2.2)', overwrite: true });
    pret(v);
  };
  cv.textContent = v; cv.dataset.val = v; gsap.set(pion, { x: v / 10 * W() });
  const depuisX = cx => Math.round(Math.max(0, Math.min(1, (cx - rect.left) / rect.width)) * 10);
  zone.addEventListener('pointerdown', e => { rect = zone.getBoundingClientRect(); zone.setPointerCapture(e.pointerId); gsap.to(pion, { scale: 1.18, duration: .25, ease: EASE.sortie }); aller(depuisX(e.clientX)); });
  zone.addEventListener('pointermove', e => { if (zone.hasPointerCapture(e.pointerId)) aller(depuisX(e.clientX)); });
  const lacher = () => gsap.to(pion, { scale: 1, duration: .35, ease: 'back.out(2)' });
  zone.addEventListener('pointerup', lacher); zone.addEventListener('pointercancel', lacher);
  rouler(cv, v, { duree: 1.4, delai: .5 });
  pret(v);
}
function qEmoji(el, pret) {
  const bs = $$('.emojis button', el), lab = $('.emoji-l', el);
  bs.forEach(b => b.addEventListener('click', () => {
    const k = +b.dataset.k;
    bs.forEach(x => { x.classList.toggle('on', x === b); gsap.to(x, { scale: x === b ? 1.45 : .85, y: x === b ? -8 : 0, duration: .55, ease: x === b ? 'back.out(2.2)' : EASE.sortie }); });
    lab.textContent = QS[2].o[k][1]; gsap.fromTo(lab, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: EASE.sortie });
    Son.tick(); vibrer(8); pret(k);
  }));
}
function qChoix(el, pret) {
  const bs = $$('.choix button', el);
  bs.forEach(b => b.addEventListener('click', () => {
    bs.forEach(x => x.classList.toggle('on', x === b));
    tracer($('path', b), { duree: .45 });
    Son.tick(); vibrer(8); pret(+b.dataset.k);
  }));
}
/* Fin : petite célébration (trait qui se dessine, rayons, merci) puis retour avec la pastille qui disparaît */
function qFin() {
  S.questFait = true; Q.occupe = true;
  const scene = $('#q-scene'), ancien = $('.q-ecran', scene);
  const el = document.createElement('div'); el.className = 'q-ecran celeb';
  let rayons = '';
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; rayons += `<line class="rayon" x1="${100 + Math.cos(a) * 78}" y1="${100 + Math.sin(a) * 78}" x2="${100 + Math.cos(a) * 96}" y2="${100 + Math.sin(a) * 96}"/>`; }
  el.innerHTML = `<svg class="celeb-svg" viewBox="0 0 200 200"><circle class="cercle" cx="100" cy="100" r="62" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>${rayons}<path class="coche" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="M72 102 l19 19 l38 -42"/></svg><h2 class="serif">Merci, <em>Fabien.</em></h2><p>Check-in du jour enregistré. Corentin le lira avant ta séance.</p><div class="q-bas" style="width:100%;margin-top:34px"><button class="btn gros" id="q-retour">Retour à l’accueil</button></div>`;
  scene.appendChild(el);
  if (ancien) gsap.to(ancien, { xPercent: -28, opacity: 0, scale: .94, duration: .6, ease: 'power3.inOut', onComplete: () => ancien.remove() });
  gsap.to('#q-barre', { scaleX: 1, duration: .8, ease: 'back.out(2)' });
  $('#q-pos').textContent = 'terminé';
  const tl = gsap.timeline({ delay: RM ? 0 : .4, onComplete: () => { Q.occupe = false; } });
  if (RM) { tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .3 }); $$('.cercle,.coche', el).forEach(p => { p.style.strokeDashoffset = 0; }); return; }
  tl.fromTo(el, { xPercent: 100 }, { xPercent: 0, duration: .8, ease: EASE.entree, clearProps: 'transform' }, 0)
    .to($('.cercle', el), { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, .5)
    .to($('.coche', el), { strokeDashoffset: 0, duration: .6, ease: 'power2.out' }, 1.2)
    .fromTo($$('.rayon', el), { scale: .6, opacity: 0, transformOrigin: '100px 100px' }, { scale: 1, opacity: 1, duration: .5, stagger: .03, ease: 'back.out(2)' }, 1.5)
    .add(() => { lignes($('h2', el), { duree: 1 }); vibrer([20, 40, 20]); }, 1.2)
    .fromTo($$('p, .q-bas', el), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .1, ease: EASE.sortie }, 1.7);
  $('#q-retour', el).addEventListener('click', () => {
    fermerQuestionnaire();
    gsap.delayedCall(RM ? .3 : 1.0, () => {
      majDash();
      if (!RM) gsap.fromTo('#qq-txt', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: EASE.sortie, clearProps: 'all' });
    });
  });
}

/* =============== Démarrage =============== */
function initEcrans() {
  initCoaching(); construireCal(); construireWorkout(); majDash(); setAnneau(S.w2Fait ? 2 : 1);
  $('#cal').classList.add('semaine');
  const d = $('#d-date'); if (d) d.textContent = 'Mardi 20 octobre · S3/8';
  entreeDash();
}
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { initEcrans(); document.documentElement.classList.add('pret'); });
