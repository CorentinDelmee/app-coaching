/* d1 « Atelier » — maquette cliquable de l'espace coach. Vanilla JS, aucune dépendance. */
(() => {
  const D = window.AT_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduit = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 900px)');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const exById = (id) => D.exercices.find((e) => e.id === id);
  const ICO = {
    x: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15"/></svg>',
    up: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 12 5-5 5 5"/></svg>',
    down: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>',
    check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
    grip: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7.5" cy="5" r=".9"/><circle cx="12.5" cy="5" r=".9"/><circle cx="7.5" cy="10" r=".9"/><circle cx="12.5" cy="10" r=".9"/><circle cx="7.5" cy="15" r=".9"/><circle cx="12.5" cy="15" r=".9"/></svg>',
    plus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>',
    img: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 15 4-4 3 3 2-2 3 3"/></svg>',
    spark: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
    bell: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a5 5 0 0 0-5 5v3l-1.5 3h13L15 11V8a5 5 0 0 0-5-5ZM8 17a2 2 0 0 0 4 0"/></svg>',
    msg: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h12v9H8l-4 3z"/></svg>',
    cal: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v4M13 2v4"/></svg>',
    play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z"/></svg>',
    easy: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M6 11l4 4 4-4"/></svg>',
    hard: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M6 9l4-4 4 4"/></svg>'
  };

  /* ---------- Vignettes : « image de vidéo » dessinée (pas de réseau) ---------- */
  const POSES = {
    squat: 'M80 37 L76 58 M76 58 L96 62 L92 88 M76 58 L90 66 L84 88 M79 43 L103 46', h: [80, 30],
    lunge: 'M80 30 L80 56 M80 56 L100 64 L100 88 M80 56 L66 72 L50 86 M80 36 L74 52',
    push: 'M44 60 L112 76 L124 86 M50 61 L52 76 M30 76 H80 M34 76 V88 M76 76 V88',
    pull: 'M90 32 L92 60 M92 60 L86 88 M92 60 L100 88 M90 40 L72 46 L48 44 M48 44 L18 44',
    hinge: 'M62 44 L96 54 M96 54 L98 88 M96 54 L90 88 M66 46 L70 72 M62 72 H78',
    plank: 'M42 64 L124 76 M46 66 L46 82 L60 82 M124 76 L128 86',
    bridge: 'M44 84 L84 62 M84 62 L104 70 L106 88 M50 84 L66 86',
    march: 'M80 26 L80 54 M80 54 L96 58 L94 78 M80 54 L78 88 M80 32 L94 44 M80 32 L66 46',
    balance: 'M80 26 L80 54 M80 54 L80 88 M80 54 L94 62 L88 74 M80 34 L58 40 M80 34 L102 40',
    press: 'M80 36 L80 62 M80 40 L66 30 L66 12 M80 40 L94 30 L94 12 M80 62 L100 62 L100 88 M60 12 H72 M88 12 H100',
    rotate: 'M50 60 L100 60 M50 60 L50 88 M100 60 L100 88 M58 60 L70 34',
    step: 'M80 26 L80 54 M80 54 L96 58 L96 70 M80 54 L76 88 M90 70 H130 V88',
    deadbug: 'M50 82 L100 82 M58 82 L64 50 M94 82 L104 62 L120 62 M74 82 L80 52'
  };
  const HEADS = { squat: [80, 30], lunge: [80, 23], push: [36, 57], pull: [90, 25], hinge: [56, 40], plank: [34, 62], bridge: [36, 82], march: [80, 19], balance: [80, 19], press: [80, 29], rotate: [76, 30], step: [80, 19], deadbug: [42, 80] };
  const HUE = { Force: 32, Cardio: 12, Gainage: 210, Mobilité: 155, Équilibre: 265 };
  function thumbSVG(ex) {
    const h = HUE[ex.cat] ?? 30;
    const [hx, hy] = HEADS[ex.pose] || [80, 26];
    const gid = 'g' + ex.id + Math.random().toString(36).slice(2, 6);
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="${gid}" cx="65%" cy="30%" r="85%"><stop offset="0" stop-color="hsl(${h} 16% 38%)"/><stop offset="1" stop-color="hsl(${h} 10% 16%)"/></radialGradient></defs><rect width="160" height="100" fill="url(#${gid})"/><path d="M0 88.5 H160" stroke="rgba(241,239,232,.18)" stroke-width="1"/><g fill="none" stroke="#EFEBE0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="${POSES[ex.pose] || POSES.squat}"/><circle cx="${hx}" cy="${hy}" r="6" fill="#EFEBE0" stroke="none"/></g></svg>`;
  }
  function thumb(ex, cls = '') {
    if (ex.photo) return `<span class="at-thumb ${cls}"><img src="${ex.photo}" alt=""></span>`;
    if (ex.video === 'aucune') return `<span class="at-thumb at-thumb-none ${cls}">${thumbSVG({ ...ex, cat: '' })}</span>`;
    return `<span class="at-thumb ${cls}">${thumbSVG(ex)}<span class="at-thumb-d">${ex.dur}</span></span>`;
  }
  const ST_LBL = { validee: 'Vidéo validée', proposee: 'À valider', aucune: 'Sans vidéo' };
  const stBadge = (ex) => ex.video === 'aucune' && ex.photo ? '<span class="at-st at-st-photo">Photo</span>' : `<span class="at-st at-st-${ex.video}">${ST_LBL[ex.video]}</span>`;

  /* ---------- Toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#at-toast');
    t.innerHTML = ICO.check + esc(msg);
    t.classList.add('at-show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('at-show'), 2400);
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-toast]'); if (b) toast(b.dataset.toast); });

  /* ---------- Router ---------- */
  const VUES = ['aujourdhui', 'exercices', 'clients', 'programmes'];
  function route() {
    let v = (location.hash.replace('#/', '') || 'aujourdhui').split('?')[0];
    const alias = { alertes: 'aujourdhui', agenda: 'aujourdhui', questionnaires: 'aujourdhui' };
    const real = alias[v] || v;
    const vue = VUES.includes(real) ? real : 'aujourdhui';
    closeAll(true);
    $$('.at-view').forEach((s) => s.classList.toggle('at-on', s.dataset.view === vue));
    $$('[data-route]').forEach((a) => {
      const match = a.hasAttribute('data-alias') ? a.getAttribute('href') === '#/' + v : a.dataset.route === vue && !alias[v];
      if (match) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (alias[v]) toast('Écran hors maquette : affiché sur « Aujourd\'hui »');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- Aujourd'hui ---------- */
  function renderDash() {
    $('#at-timeline').innerHTML = D.seancesJour.map((s) => `<li class="at-tl" data-etat="${s.etat}">
      <span class="at-tl-h">${s.h}<small>${s.fin}</small></span><span class="at-tl-dot" aria-hidden="true"></span>
      <span class="at-tl-b"><b>${esc(s.client)}</b><span>${esc(s.titre)} · ${esc(s.lieu)}</span></span>
      <span class="at-tl-tag">${s.etat === 'fait' ? 'Terminée' : s.etat === 'prochaine' ? 'Dans 38 min' : ''}</span></li>`).join('');
    $('#at-alerts').innerHTML = [
      ['Thomas R.', 'Douleur au genou signalée au check-in', 'Voir', 'hot'],
      ['Bernard M.', 'Aucun check-in depuis 9 jours', 'Relancer', 'hot'],
      ['Nadia B.', 'Questionnaire de départ reçu', 'Lire', '']
    ].map(([n, t, a, k]) => `<li class="at-row"><span class="at-ico-dot ${k ? 'at-hot' : ''}">${ICO.bell}</span><span class="at-row-b"><b>${n}</b><span>${t}</span></span><a class="at-btn at-btn-ghost" href="#/clients">${a}</a></li>`).join('');
    $('#at-rexfeed').innerHTML = [
      ['4 vidéos proposées', 'Fente arrière, Soulevé de terre roumain, Tirage, Dead bug', '#/exercices?f=proposee', 'Valider'],
      ['Séance « Force haut du corps » S3', 'Créée pour Mireille L. d\'après ta dictée de 8 h 12', '#/programmes', 'Relire']
    ].map(([n, t, h, a]) => `<li class="at-row"><span class="at-ico-dot at-rexi">${ICO.spark}</span><span class="at-row-b"><b>${n}</b><span>${t}</span></span><a class="at-btn at-btn-primary" href="${h}">${a}</a></li>`).join('');
    $('#at-checkins').innerHTML = D.clients.slice(0, 4).map((c) => `<li class="at-row"><span class="at-av" style="--h:${c.h}">${c.nom.split(' ').map((p) => p[0]).join('')}</span><span class="at-row-b"><b>${esc(c.nom)}</b><span>Forme ${c.forme.at(-1)}/10 · Sommeil ${6 + (c.id % 3)} h · ${esc(c.dernier)}</span></span></li>`).join('');
    $('#at-resa').innerHTML = [
      ['Sophie G.', 'Ven. 7 nov. · 10:00 · Domicile', true],
      ['Nouveau contact : Paul A.', 'Lun. 10 nov. · 17:30 · Bilan offert', true],
      ['Jean-Paul V.', 'Mar. 11 nov. · 09:00 · confirmée', false]
    ].map(([n, t, c]) => `<li class="at-row"><span class="at-ico-dot">${ICO.cal}</span><span class="at-row-b"><b>${n}</b><span>${t}</span></span>${c ? '<button type="button" class="at-btn at-btn-ghost" data-confirm>Confirmer</button>' : ''}</li>`).join('');
    $('#at-resa').addEventListener('click', (e) => {
      const b = e.target.closest('[data-confirm]'); if (!b) return;
      b.outerHTML = `<span class="at-st at-st-validee">Confirmée</span>`; toast('Réservation confirmée, le client est prévenu');
    });
  }

  /* ---------- Exercices ---------- */
  const F = { q: '', cat: new Set(), proposee: false, muscle: '', mat: '', layout: 'rows' };
  let selEx = null;
  const allMuscles = [...new Set(D.exercices.flatMap((e) => e.prim))].sort((a, b) => a.localeCompare(b, 'fr'));
  const allMat = [...new Set(D.exercices.flatMap((e) => e.mat))].sort((a, b) => a.localeCompare(b, 'fr'));
  const cats = ['Force', 'Gainage', 'Mobilité', 'Cardio', 'Équilibre'];
  function filtered() {
    const q = F.q.trim().toLowerCase();
    return D.exercices.filter((e) => (!q || [e.nom, e.cat, ...e.prim, ...e.sec, ...e.mat].join(' ').toLowerCase().includes(q))
      && (!F.cat.size || F.cat.has(e.cat)) && (!F.proposee || e.video === 'proposee')
      && (!F.muscle || e.prim.includes(F.muscle) || e.sec.includes(F.muscle)) && (!F.mat || e.mat.includes(F.mat)));
  }
  function renderFilters() {
    const nProp = D.exercices.filter((e) => e.video === 'proposee').length;
    $('#at-filters').innerHTML = `<button type="button" class="at-chip" data-f="proposee" aria-pressed="${F.proposee}">Vidéo à valider <i>${nProp}</i></button><span class="at-chip-sep" aria-hidden="true"></span>`
      + cats.map((c) => `<button type="button" class="at-chip" data-cat="${c}" aria-pressed="${F.cat.has(c)}">${c}</button>`).join('')
      + `<span class="at-chip-sep" aria-hidden="true"></span><select class="at-chip at-chip-sel ${F.muscle ? 'at-set' : ''}" data-sel="muscle" aria-label="Muscle"><option value="">Muscle</option>${allMuscles.map((m) => `<option ${m === F.muscle ? 'selected' : ''}>${m}</option>`).join('')}</select>`
      + `<select class="at-chip at-chip-sel ${F.mat ? 'at-set' : ''}" data-sel="mat" aria-label="Matériel"><option value="">Matériel</option>${allMat.map((m) => `<option ${m === F.mat ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
  }
  function exRow(e, i) {
    return `<div class="at-ex" role="option" id="at-ex-${e.id}" data-id="${e.id}" aria-selected="${selEx === e.id}" style="--i:${i}" tabindex="-1">
      ${thumb(e)}
      <span class="at-ex-n"><b>${esc(e.nom)}</b><span>${e.cat} · ${e.niv}</span></span>
      <span class="at-ex-m"><b>${e.prim.join(', ')}</b>${e.sec.length ? ' · ' + e.sec.join(', ') : ''}</span>
      <span class="at-ex-mat">${e.mat.join(', ')}</span>
      ${stBadge(e)}
      <span class="at-ex-u"><b>${e.usage}</b>séances</span></div>`;
  }
  function renderList(animate = true) {
    const list = filtered();
    const el = $('#at-exlist');
    el.classList.toggle('at-grid', F.layout === 'grid');
    el.innerHTML = list.length ? list.map(exRow).join('') : '<p class="at-empty">Aucun exercice ne correspond. <button type="button" class="at-btn at-btn-ghost" data-reset>Effacer les filtres</button></p>';
    $('#at-result').textContent = `${list.length} exercice${list.length > 1 ? 's' : ''}${list.length !== D.exercices.length ? ' sur ' + D.exercices.length : ''} · 106 autres dans la bibliothèque complète`;
    if (animate && !reduit.matches) {
      $$('.at-ex', el).slice(0, 14).forEach((r, i) => r.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: i * 18, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' }));
    }
    el.setAttribute('aria-activedescendant', selEx ? 'at-ex-' + selEx : '');
  }
  function bindExercices() {
    $('#at-q').addEventListener('input', (e) => { F.q = e.target.value; renderList(); });
    $('#at-filters').addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]'); const p = e.target.closest('[data-f]');
      if (c) { F.cat.has(c.dataset.cat) ? F.cat.delete(c.dataset.cat) : F.cat.add(c.dataset.cat); }
      else if (p) F.proposee = !F.proposee; else return;
      renderFilters(); renderList();
    });
    $('#at-filters').addEventListener('change', (e) => { const s = e.target.closest('[data-sel]'); if (!s) return; F[s.dataset.sel] = s.value; renderFilters(); renderList(); });
    $('#at-exlist').addEventListener('click', (e) => {
      if (e.target.closest('[data-reset]')) { Object.assign(F, { q: '', proposee: false, muscle: '', mat: '' }); F.cat.clear(); $('#at-q').value = ''; renderFilters(); renderList(); return; }
      const r = e.target.closest('.at-ex'); if (r) openEx(+r.dataset.id);
    });
    $('#at-exlist').addEventListener('keydown', (e) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'Enter' || e.key === ' ') { if (kbEx) openEx(kbEx); return; }
      stepEx(e.key === 'ArrowDown' ? 1 : -1, !!selEx);
    });
    $$('[data-layout]').forEach((b) => b.addEventListener('click', () => {
      F.layout = b.dataset.layout; $$('[data-layout]').forEach((x) => x.setAttribute('aria-pressed', x === b)); renderList();
    }));
    $('#at-new-ex').addEventListener('click', () => {
      const id = Math.max(...D.exercices.map((e) => e.id)) + 1;
      D.exercices.unshift({ id, nom: 'Nouvel exercice', cat: 'Force', pose: 'squat', prim: [], sec: [], mat: [], niv: 'Débutant', video: 'aucune', dur: '', usage: 0, tempo: '', repos: '', consignes: '', erreurs: '', facile: '', dur_var: '', notes: '', photo: null, maj: 'à l\'instant', par: 'Corentin' });
      renderFilters(); renderList(); openEx(id); setTimeout(() => { const n = $('#at-panel .at-name'); n && (n.focus(), n.select()); }, 60);
    });
  }
  let kbEx = null;
  function stepEx(dir, open) {
    const ids = filtered().map((e) => e.id); if (!ids.length) return;
    const cur = open ? selEx : kbEx;
    let i = ids.indexOf(cur); i = i < 0 ? (dir > 0 ? 0 : ids.length - 1) : Math.min(ids.length - 1, Math.max(0, i + dir));
    kbEx = ids[i];
    if (open) openEx(ids[i], true);
    $$('#at-exlist .at-ex').forEach((r) => r.classList.toggle('at-kb', +r.dataset.id === kbEx && !open));
    const row = $('#at-ex-' + ids[i]); row && row.scrollIntoView({ block: 'nearest' });
    $('#at-exlist').setAttribute('aria-activedescendant', 'at-ex-' + ids[i]);
  }

  /* ---------- Panneau (ordinateur) / feuille (téléphone) ---------- */
  let lastFocus = null;
  // Ordinateur : 1) colonnes secondaires en fondu, 2) la liste prend sa largeur finale (pas d'animation de mise en page),
  // 3) le panneau glisse (transform + opacity). Téléphone : la feuille monte.
  const panelT = new Map();
  function openPanel(splitSel, panelSel) {
    const split = $(splitSel), panel = $(panelSel);
    if (split.classList.contains('at-shown')) return;
    clearTimeout(panelT.get(splitSel));
    lastFocus = document.activeElement;
    panel.inert = false;
    const montre = () => { split.classList.add('at-open'); panel.offsetWidth; split.classList.add('at-shown'); requestAnimationFrame(() => split.classList.remove('at-pre')); };
    if (mobile.matches) {
      montre(); const s = $('#at-scrim'); s.hidden = false; s.offsetWidth; s.classList.add('at-show'); document.body.style.overflow = 'hidden';
    } else if (reduit.matches || split.classList.contains('at-open')) montre();
    else { split.classList.add('at-pre'); panelT.set(splitSel, setTimeout(montre, 150)); }
  }
  function closePanel(splitSel, panelSel, instant) {
    const split = $(splitSel), panel = $(panelSel);
    if (!split.classList.contains('at-open') && !split.classList.contains('at-pre')) return;
    clearTimeout(panelT.get(splitSel));
    split.classList.remove('at-shown', 'at-pre');
    panel.style.transform = '';
    panel.inert = true;
    const s = $('#at-scrim'); s.classList.remove('at-show');
    document.body.style.overflow = '';
    const done = () => { if (!split.classList.contains('at-shown')) { split.classList.remove('at-open'); s.hidden = true; } };
    if (instant || reduit.matches) done(); else panelT.set(splitSel, setTimeout(done, mobile.matches ? 430 : 220));
    if (splitSel === '#at-split-ex') { selEx = null; $$('#at-exlist .at-ex').forEach((r) => r.setAttribute('aria-selected', 'false')); }
    else { selCl = null; $$('#at-clist .at-cl').forEach((r) => r.setAttribute('aria-selected', 'false')); }
    if (!instant && lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function closeAll(instant) { closePanel('#at-split-ex', '#at-panel', instant); closePanel('#at-split-cl', '#at-cpanel', instant); }
  $('#at-scrim').addEventListener('click', () => closeAll());

  // Feuille glissable (téléphone) : poignée + en-tête
  function sheetDrag(panelSel, splitSel) {
    const panel = $(panelSel);
    let y0 = null, dy = 0, t0 = 0;
    panel.addEventListener('pointerdown', (e) => {
      if (!mobile.matches || !e.target.closest('.at-grip, .at-ph') || e.target.closest('button, input')) return;
      y0 = e.clientY; dy = 0; t0 = performance.now(); panel.classList.add('at-dragging'); panel.setPointerCapture(e.pointerId);
    });
    panel.addEventListener('pointermove', (e) => {
      if (y0 === null) return; dy = Math.max(0, e.clientY - y0);
      panel.style.transform = `translateY(${dy}px)`;
      $('#at-scrim').style.opacity = String(1 - Math.min(1, dy / 500));
    });
    const end = () => {
      if (y0 === null) return; y0 = null; panel.classList.remove('at-dragging'); $('#at-scrim').style.opacity = '';
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 140 || v > 0.6) closePanel(splitSel, panelSel); else panel.style.transform = '';
    };
    panel.addEventListener('pointerup', end); panel.addEventListener('pointercancel', end);
  }

  // Sauvegarde automatique : « Enregistrement… » puis coche dessinée
  let saveT;
  function saving(el) {
    if (!el) return;
    el.dataset.state = 'saving'; el.querySelector('span').textContent = 'Enregistrement';
    clearTimeout(saveT);
    saveT = setTimeout(() => { el.dataset.state = 'ok'; el.querySelector('span').textContent = 'Enregistré'; el.querySelector('svg').getBoundingClientRect(); }, 650);
  }

  function tagField(key, label, list, secondary) {
    return `<div class="at-f at-f-full"><span id="at-l-${key}">${label}</span><div class="at-tags" data-tags="${key}" role="group" aria-labelledby="at-l-${key}">
      ${list.map((t) => `<span class="at-tag ${secondary ? 'at-tag-sec' : ''}">${esc(t)}<button type="button" aria-label="Retirer ${esc(t)}" data-rm="${esc(t)}">${ICO.x}</button></span>`).join('')}
      <input type="text" placeholder="Ajouter…" aria-label="Ajouter : ${label}" list="at-dl-muscles"></div></div>`;
  }
  function videoBlock(e) {
    if (e.video === 'aucune') return `<div class="at-video">${e.photo ? `<img src="${e.photo}" alt="Photo de l'exercice ${esc(e.nom)}">` : `<div class="at-vnone">Pas encore de vidéo.<br>Colle un lien YouTube ou ajoute une photo.</div>`}</div>
      <div class="at-urlrow"><label class="at-sr" for="at-url">Lien YouTube</label><input class="at-in" id="at-url" placeholder="https://youtu.be/…" inputmode="url"><button class="at-btn at-btn-ghost" type="button" data-addvideo>Ajouter</button></div>`;
    return `<div class="at-video" id="at-video">${thumbSVG(e)}<span class="at-yt">${e.yt ? 'YouTube · ' + esc(e.chaine || '') : 'Aperçu'} · ${e.dur}</span>
        <button class="at-play" type="button" aria-label="Lire l'aperçu de la vidéo">${ICO.play}</button>
        <div class="at-vbar"><span id="at-vt">0:00</span><span class="at-vprog"><i></i></span><span>${e.dur}</span></div></div>
      ${e.video === 'proposee' ? `<div class="at-proposal" id="at-proposal"><span class="at-ico-dot at-rexi">${ICO.spark}</span><b>Vidéo proposée par Claude</b><span>Trouvée ${e.maj} · chaîne « ${esc(e.chaine || '—')} » · ${e.dur}</span>
        <div class="at-proposal-a"><button class="at-btn at-btn-ok" type="button" data-validate>${ICO.check}Valider la vidéo</button><button class="at-btn at-btn-ghost" type="button" data-replace>Remplacer</button></div></div>`
      : `<p class="at-validated">${ICO.check}Vidéo validée — visible par tes clients</p>`}`;
  }
  function renderEx(e) {
    return `<header class="at-ph"><span class="at-ph-t">Exercice</span><span class="at-saved" id="at-saved" data-state="ok"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg><span>Enregistré</span></span>
      <button class="at-icon-btn" type="button" data-prev aria-label="Exercice précédent (flèche haut)">${ICO.up}</button><button class="at-icon-btn" type="button" data-next aria-label="Exercice suivant (flèche bas)">${ICO.down}</button><button class="at-icon-btn" type="button" data-close aria-label="Fermer (Échap)">${ICO.x}</button></header>
      <div class="at-pb at-swap">
        <div><label class="at-sr" for="at-name">Nom de l'exercice</label><input class="at-name" id="at-name" data-k="nom" value="${esc(e.nom)}"><p class="at-byline">Modifié ${e.maj} par ${e.par} · ${e.cat}</p></div>
        ${videoBlock(e)}
        <label class="at-drop" id="at-drop"><span class="at-drop-img">${e.photo ? `<img src="${e.photo}" alt="">` : ICO.img}</span><span><b>${e.photo ? 'Remplacer la photo' : 'Ajouter une photo'}</b><span>Glisse une image ici ou choisis un fichier (JPG, PNG)</span></span><input type="file" accept="image/*" aria-label="${e.photo ? 'Remplacer la photo' : 'Ajouter une photo'}"></label>
        <div class="at-usage"><b>${e.usage}</b><span>séances utilisent<br>cet exercice</span><a class="at-link" href="#/programmes">Voir</a></div>

        <div class="at-sec"><h3 class="at-sec-t">Classement</h3>
          <div class="at-fields">
            <div class="at-f"><label for="at-cat">Catégorie</label><select class="at-in" id="at-cat" data-k="cat">${cats.map((c) => `<option ${c === e.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
            <div class="at-f at-f-full"><span id="at-l-niv">Niveau</span><div class="at-levels" role="group" aria-labelledby="at-l-niv">${['Débutant', 'Intermédiaire', 'Avancé'].map((n) => `<button type="button" data-niv="${n}" aria-pressed="${n === e.niv}">${n}</button>`).join('')}</div></div>
            ${tagField('prim', 'Muscles principaux', e.prim)}
            ${tagField('sec', 'Muscles secondaires', e.sec, true)}
            ${tagField('mat', 'Matériel', e.mat, true)}
          </div></div>

        <div class="at-sec"><h3 class="at-sec-t">Exécution</h3>
          <div class="at-fields">
            <div class="at-f at-f-full"><label for="at-cons">Consignes <small>— une par ligne, lues par le client</small></label><textarea class="at-in" id="at-cons" data-k="consignes" rows="4">${esc(e.consignes)}</textarea></div>
            <div class="at-f at-f-full"><label for="at-err">Erreurs fréquentes</label><textarea class="at-in" id="at-err" data-k="erreurs" rows="3">${esc(e.erreurs)}</textarea></div>
            <div class="at-f"><label for="at-tempo">Tempo conseillé</label><input class="at-in" id="at-tempo" data-k="tempo" value="${esc(e.tempo)}"></div>
            <div class="at-f"><label for="at-repos">Repos conseillé</label><input class="at-in" id="at-repos" data-k="repos" value="${esc(e.repos)}"></div>
          </div></div>

        <div class="at-sec"><h3 class="at-sec-t">Variantes</h3>
          <div class="at-variants"><label class="at-var"><span>${ICO.easy}Plus facile</span><input data-k="facile" value="${esc(e.facile)}" placeholder="Ex. appui au mur"></label><label class="at-var"><span>${ICO.hard}Plus dur</span><input data-k="dur_var" value="${esc(e.dur_var)}" placeholder="Ex. tempo lent"></label></div></div>

        <div class="at-sec"><h3 class="at-sec-t">Notes privées</h3>
          <div class="at-f"><label class="at-sr" for="at-notes">Notes privées (jamais visibles par le client)</label><textarea class="at-in at-private" id="at-notes" data-k="notes" rows="3" placeholder="Visible par toi seul">${esc(e.notes)}</textarea></div></div>
      </div>`;
  }
  function openEx(id, swap) {
    const e = exById(id); if (!e) return;
    selEx = id; kbEx = id;
    $$('#at-exlist .at-ex').forEach((r) => { r.setAttribute('aria-selected', +r.dataset.id === id); r.classList.remove('at-kb'); });
    $('#at-exlist').setAttribute('aria-activedescendant', 'at-ex-' + id);
    const inner = $('#at-panel-in');
    inner.innerHTML = renderEx(e);
    inner.scrollTop = 0;
    if (!swap) openPanel('#at-split-ex', '#at-panel');
    if (!swap) setTimeout(() => { inner.setAttribute('tabindex', '-1'); inner.focus({ preventScroll: true }); }, 40);
    bindPanel(e);
  }
  let panelAbort = null; // un seul jeu d'écouteurs : ceux de la fiche précédente sont retirés
  function bindPanel(e) {
    panelAbort?.abort(); panelAbort = new AbortController(); const opt = { signal: panelAbort.signal };
    const p = $('#at-panel-in'); const sv = $('#at-saved');
    const refreshRow = () => { const r = $('#at-ex-' + e.id); if (r) { const tmp = document.createElement('div'); tmp.innerHTML = exRow(e, 0); tmp.firstElementChild.setAttribute('aria-selected', 'true'); r.replaceWith(tmp.firstElementChild); } };
    p.addEventListener('input', (ev) => {
      const k = ev.target.dataset.k; if (!k) return;
      e[k] = ev.target.value; e.maj = 'à l\'instant'; e.par = 'Corentin'; saving(sv);
      if (k === 'nom' || k === 'cat') refreshRow();
    }, opt);
    p.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.closest('[data-close]')) return closePanel('#at-split-ex', '#at-panel');
      if (t.closest('[data-prev]')) return stepEx(-1, true);
      if (t.closest('[data-next]')) return stepEx(1, true);
      const niv = t.closest('[data-niv]');
      if (niv) { e.niv = niv.dataset.niv; $$('[data-niv]', p).forEach((b) => b.setAttribute('aria-pressed', b === niv)); saving(sv); refreshRow(); return; }
      const rm = t.closest('[data-rm]');
      if (rm) { const box = rm.closest('[data-tags]'); const k = box.dataset.tags; e[k] = e[k].filter((x) => x !== rm.dataset.rm); rm.parentElement.remove(); saving(sv); refreshRow(); box.querySelector('input').focus(); return; }
      if (t.closest('.at-play') && e.yt) { const v = $('#at-video'); v.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${e.yt}?autoplay=1&rel=0&modestbranding=1" title="Vidéo : ${esc(e.nom)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`; return; }
      if (t.closest('.at-play')) { const v = $('#at-video'); v.classList.add('at-playing'); let s = 0; const tick = setInterval(() => { if (!document.contains(v)) return clearInterval(tick); s++; $('#at-vt').textContent = '0:' + String(s).padStart(2, '0'); if (s >= 12) clearInterval(tick); }, 1000); return; }
      if (t.closest('[data-validate]')) {
        e.video = 'validee'; saving(sv);
        const box = $('#at-proposal');
        const swapIt = () => { box.outerHTML = `<p class="at-validated">${ICO.check}Vidéo validée — visible par tes clients</p>`; };
        if (reduit.matches) swapIt(); else box.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 160, easing: 'ease-out' }).onfinish = swapIt;
        refreshRow(); renderFilters(); if (F.proposee) renderList(); toast('Vidéo validée pour « ' + e.nom + ' »'); return;
      }
      if (t.closest('[data-replace]')) { e.video = 'aucune'; openEx(e.id, true); refreshRow(); renderFilters(); $('#at-url')?.focus(); return; }
      if (t.closest('[data-addvideo]')) { if (!$('#at-url').value.trim()) { $('#at-url').focus(); return; } e.video = 'validee'; e.dur = '0:45'; openEx(e.id, true); refreshRow(); renderFilters(); toast('Vidéo ajoutée'); }
    }, opt);
    p.addEventListener('keydown', (ev) => {
      const box = ev.target.closest('[data-tags]');
      if (!box || ev.key !== 'Enter' || ev.target.tagName !== 'INPUT') return;
      ev.preventDefault(); const v = ev.target.value.trim(); if (!v) return;
      const k = box.dataset.tags; if (!e[k].includes(v)) e[k].push(v);
      const s = document.createElement('span'); s.className = 'at-tag' + (k !== 'prim' ? ' at-tag-sec' : ''); s.innerHTML = `${esc(v)}<button type="button" aria-label="Retirer ${esc(v)}" data-rm="${esc(v)}">${ICO.x}</button>`;
      box.insertBefore(s, ev.target); ev.target.value = ''; saving(sv); refreshRow();
    }, opt);
    // Photo : glisser-déposer ou fichier
    const drop = $('#at-drop');
    const setPhoto = (file) => {
      if (!file || !file.type.startsWith('image/')) return toast('Choisis une image (JPG, PNG)');
      const r = new FileReader(); r.onload = () => { e.photo = r.result; openEx(e.id, true); refreshRow(); toast('Photo ajoutée'); }; r.readAsDataURL(file);
    };
    drop.querySelector('input').addEventListener('change', (ev) => setPhoto(ev.target.files[0]));
    ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (ev) => { ev.preventDefault(); drop.classList.add('at-over'); }));
    ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (ev) => { ev.preventDefault(); drop.classList.remove('at-over'); }));
    drop.addEventListener('drop', (ev) => setPhoto(ev.dataTransfer.files[0]));
  }

  /* ---------- Clavier global ---------- */
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable]');
    if (e.key === 'Escape') {
      if ($('#at-split-ex').classList.contains('at-shown') || $('#at-split-cl').classList.contains('at-shown')) { e.preventDefault(); closeAll(); }
      return;
    }
    if (typing) return;
    if (e.key === '/') {
      const v = $('.at-view.at-on'); const s = v && $('input[type="search"]', v);
      if (s) { e.preventDefault(); s.focus(); } else if (e.target.closest('.at-cmd') === null) { e.preventDefault(); location.hash = '#/exercices'; setTimeout(() => $('#at-q').focus(), 30); }
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.target.closest('.at-list')) {
      if ($('#at-split-ex').classList.contains('at-shown')) { e.preventDefault(); stepEx(e.key === 'ArrowDown' ? 1 : -1, true); }
      else if ($('#at-split-cl').classList.contains('at-shown')) { e.preventDefault(); stepCl(e.key === 'ArrowDown' ? 1 : -1, true); }
    }
  });
  $('[data-action="search"]').addEventListener('click', () => { location.hash = '#/exercices'; setTimeout(() => $('#at-q').focus(), 30); });

  /* ---------- Clients ---------- */
  let selCl = null, kbCl = null, tabCl = 'apercu', qc = '', fc = '';
  const ini = (n) => n.split(/[\s-]/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2);
  const ST_CL = { actif: 'Actif', attention: 'À relancer', nouveau: 'Nouveau' };
  const clFiltered = () => D.clients.filter((c) => (!qc || (c.nom + c.objectif + c.prog).toLowerCase().includes(qc)) && (!fc || c.statut === fc));
  function renderCl() {
    $('#at-cfilters').innerHTML = [['', 'Tous', D.clients.length], ['attention', 'À relancer', 1], ['nouveau', 'Nouveaux', 1]].map(([k, l, n]) => `<button type="button" class="at-chip" data-fc="${k}" aria-pressed="${fc === k}">${l} <i>${n}</i></button>`).join('');
    $('#at-clist').innerHTML = clFiltered().map((c) => `<div class="at-cl" role="option" id="at-cl-${c.id}" data-id="${c.id}" aria-selected="${selCl === c.id}" tabindex="-1">
      <span class="at-av" style="--h:${c.h}">${ini(c.nom)}</span>
      <span class="at-cl-n"><b>${esc(c.nom)}</b><span>${c.age} ans · ${esc(c.objectif)}</span></span>
      <span class="at-cl-p">${esc(c.prog)}<br><span>Semaine ${c.sem} · ${esc(c.dernier)}</span></span>
      <span class="at-bar" style="--v:${c.assid}">Assiduité ${c.assid} %<i></i></span>
      <span class="at-st at-st-${c.statut}">${ST_CL[c.statut]}</span></div>`).join('');
  }
  const fr = (n, d) => n.toFixed(d).replace(".", ",");
  function chart(vals, label, unit, dec) {
    const W = 300, H = 110, min = Math.min(...vals), max = Math.max(...vals), pad = (max - min) * 0.25 || 1;
    const x = (i) => 8 + (i * (W - 16)) / (vals.length - 1), y = (v) => 10 + (H - 30) * (1 - (v - (min - pad)) / (max - min + 2 * pad));
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const last = vals.at(-1), diff = last - vals[0];
    return `<div class="at-chart"><h3>${label}<span>${fr(last, dec)}${unit === "/10" ? "" : " "}${unit} · ${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fr(Math.abs(diff), dec)} en 7 sem.</span></h3>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} : de ${vals[0]} à ${last} ${unit}"><defs><linearGradient id="at-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F2E27A" stop-opacity=".55"/><stop offset="1" stop-color="#F2E27A" stop-opacity="0"/></linearGradient></defs>
      ${[0, 1, 2].map((g) => `<line class="at-grid-l" x1="0" x2="${W}" y1="${10 + g * 40}" y2="${10 + g * 40}"/>`).join('')}
      <polygon class="at-area" points="${x(0)},${H - 20} ${pts} ${x(vals.length - 1)},${H - 20}"/>
      <polyline class="at-line" points="${pts}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:0"/>
      ${vals.map((v, i) => `<circle class="at-pt ${i === vals.length - 1 ? 'at-pt-last' : ''}" cx="${x(i)}" cy="${y(v)}" r="${i === vals.length - 1 ? 4.5 : 3}"/>`).join('')}
      ${vals.map((v, i) => `<text x="${x(i)}" y="${H - 4}" text-anchor="middle">S${i + 1}</text>`).join('')}</svg></div>`;
  }
  function clTab(c) {
    if (tabCl === 'apercu') return `<div class="at-mini"><div><span>Assiduité</span><b>${c.assid} %</b></div><div><span>Semaine</span><b>${c.sem}/8</b></div><div><span>Forme</span><b>${c.forme.at(-1)}/10</b></div></div>
      ${c.alerte ? `<div class="at-proposal" style="background:var(--at-hot-bg);color:var(--at-hot)"><span class="at-ico-dot at-hot">${ICO.bell}</span><b>${esc(c.alerte)}</b><span>Signalé au dernier check-in</span></div>` : ''}
      <div class="at-sec"><h3 class="at-sec-t">Prochaine séance</h3><div class="at-usage"><b>Mer.</b><span>11:30 · ${esc(c.prog)}<br>Force bas du corps · 45 min</span><a class="at-link" href="#/programmes">Ouvrir</a></div></div>
      ${chart(c.forme, 'Forme ressentie', '/10', 0)}`;
    if (tabCl === 'programme') return `<div class="at-sec"><h3 class="at-sec-t" style="border:0;padding:0">${esc(c.prog)} · semaine ${c.sem}</h3><div class="at-weekline">${Array.from({ length: 8 }, (_, i) => `<i class="${i + 1 < c.sem ? 'at-done' : i + 1 === c.sem ? 'at-now' : ''}">S${i + 1}</i>`).join('')}</div></div>
      <ul class="at-rows">${['Lun · Force bas du corps · faite', 'Mer · Équilibre & mobilité · aujourd\'hui', 'Ven · Force haut du corps · prévue'].map((s) => `<li class="at-row"><span class="at-ico-dot">${ICO.cal}</span><span class="at-row-b"><b>${s.split(' · ')[1]}</b><span>${s.split(' · ')[0]} · ${s.split(' · ')[2]}</span></span></li>`).join('')}</ul>
      <a class="at-btn at-btn-primary" href="#/programmes">Modifier le programme</a>`;
    if (tabCl === 'suivi') return `${chart(c.poids, 'Poids', 'kg', 1)}${chart(c.forme, 'Forme ressentie', '/10', 0)}`;
    if (tabCl === 'reponses') return `<div>${[['Objectif principal', c.objectif], ['Douleurs ou blessures', c.id === 1 ? 'Genou droit opéré en 2019, gêne en descente d\'escalier' : 'Aucune signalée'], ['Disponibilités', 'Lundi, mercredi, vendredi matin'], ['Matériel à la maison', 'Chaise, élastiques, haltères 2 kg']].map(([q, r]) => `<div class="at-answer"><span>${q}</span><b>${esc(r)}</b></div>`).join('')}</div>`;
    return `<div class="at-f"><label for="at-cnotes">Notes privées <small>— jamais visibles par le client</small></label><textarea class="at-in at-private" id="at-cnotes" rows="8" data-cn>${c.id === 1 ? 'Très motivée. Préfère qu\'on l\'appelle avant la séance. Fille kiné : peut relayer les consignes.' : ''}</textarea></div>`;
  }
  function renderClPanel(c, swap) {
    $('#at-cpanel-in').innerHTML = `<header class="at-ph"><span class="at-ph-t">Fiche client</span><span class="at-saved" id="at-csaved" data-state="ok"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg><span>Enregistré</span></span>
      <button class="at-icon-btn" type="button" data-prev aria-label="Client précédent">${ICO.up}</button><button class="at-icon-btn" type="button" data-next aria-label="Client suivant">${ICO.down}</button><button class="at-icon-btn" type="button" data-close aria-label="Fermer (Échap)">${ICO.x}</button></header>
      <div class="at-tabs" role="tablist" aria-label="Sections de la fiche">${[['apercu', 'Aperçu'], ['programme', 'Programme'], ['suivi', 'Suivi'], ['reponses', 'Réponses'], ['notes', 'Notes privées']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tabCl === k}">${l}</button>`).join('')}</div>
      <div class="at-pb ${swap ? 'at-swap' : ''}"><div class="at-chead"><span class="at-av" style="--h:${c.h}">${ini(c.nom)}</span><div><h2>${esc(c.nom)}</h2><p>${c.age} ans · ${esc(c.objectif)}</p></div></div>
      <div class="at-head-actions"><button class="at-btn at-btn-ghost" type="button" data-toast="Message WhatsApp prêt">${ICO.msg}Message</button><a class="at-btn at-btn-ghost" href="#/programmes">${ICO.cal}Planifier</a></div>
      <div role="tabpanel" style="display:grid;gap:16px">${clTab(c)}</div></div>`;
    if (!reduit.matches) $$('#at-cpanel .at-line').forEach((l) => l.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 700, easing: 'cubic-bezier(.23,1,.32,1)' }));
  }
  function openCl(id, swap) {
    const c = D.clients.find((x) => x.id === id); if (!c) return;
    selCl = id; kbCl = id;
    $$('#at-clist .at-cl').forEach((r) => r.setAttribute('aria-selected', +r.dataset.id === id));
    $('#at-clist').setAttribute('aria-activedescendant', 'at-cl-' + id);
    renderClPanel(c, true); $('#at-cpanel-in').scrollTop = 0;
    if (!swap) openPanel('#at-split-cl', '#at-cpanel');
  }
  function stepCl(dir, open) {
    const ids = clFiltered().map((c) => c.id); if (!ids.length) return;
    let i = ids.indexOf(open ? selCl : kbCl); i = i < 0 ? 0 : Math.min(ids.length - 1, Math.max(0, i + dir));
    kbCl = ids[i];
    if (open) openCl(ids[i], true);
    $$('#at-clist .at-cl').forEach((r) => r.classList.toggle('at-kb', +r.dataset.id === kbCl && !open));
    $('#at-cl-' + ids[i])?.scrollIntoView({ block: 'nearest' });
    $('#at-clist').setAttribute('aria-activedescendant', 'at-cl-' + ids[i]);
  }
  function bindClients() {
    $('#at-qc').addEventListener('input', (e) => { qc = e.target.value.toLowerCase(); renderCl(); });
    $('#at-cfilters').addEventListener('click', (e) => { const b = e.target.closest('[data-fc]'); if (b) { fc = b.dataset.fc; renderCl(); } });
    $('#at-clist').addEventListener('click', (e) => { const r = e.target.closest('.at-cl'); if (r) openCl(+r.dataset.id); });
    $('#at-clist').addEventListener('keydown', (e) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) return; e.preventDefault();
      if (e.key === 'Enter' || e.key === ' ') { if (kbCl) openCl(kbCl); return; }
      stepCl(e.key === 'ArrowDown' ? 1 : -1, !!selCl);
    });
    $('#at-cpanel').addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return closePanel('#at-split-cl', '#at-cpanel');
      if (e.target.closest('[data-prev]')) return stepCl(-1, true);
      if (e.target.closest('[data-next]')) return stepCl(1, true);
      const t = e.target.closest('[data-tab]'); if (t) { tabCl = t.dataset.tab; renderClPanel(D.clients.find((c) => c.id === selCl), true); $(`#at-cpanel [data-tab="${tabCl}"]`).focus(); }
    });
    $('#at-cpanel').addEventListener('keydown', (e) => {
      const t = e.target.closest('[data-tab]'); if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const tabs = $$('#at-cpanel [data-tab]'); const i = tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1); const n = tabs[(i + tabs.length) % tabs.length]; n.click();
    });
    $('#at-cpanel').addEventListener('input', (e) => { if (e.target.matches('[data-cn]')) saving($('#at-csaved')); });
  }

  /* ---------- Programme / éditeur de séance ---------- */
  const P = D.programme;
  let jourSel = 0, semSel = P.active;
  const TYPE_LBL = { exercice: 'Exercice', superset: 'Superset', circuit: 'Circuit' };
  function renderWeeks() {
    $('#at-weeks').innerHTML = Array.from({ length: P.semaines }, (_, i) => `<button type="button" class="at-week" role="tab" aria-selected="${i + 1 === semSel}" data-sem="${i + 1}">S${i + 1}<small>${i + 1 < P.active ? 'faite' : i + 1 === P.active ? 'en cours' : i === 3 ? 'décharge' : 'prévue'}</small></button>`).join('');
    const dates = ['3', '4', '5', '6', '7', '8', '9'];
    $('#at-days').innerHTML = P.jours.map((j, i) => P.seances[i]
      ? `<button type="button" class="at-day at-has" data-jour="${i}" aria-pressed="${i === jourSel}"><span>${j} ${dates[i]}</span><b>${P.seances[i]}</b><small>${i === jourSel ? nbEx() + ' ex. · ' + dureeSeance() : '5 ex. · 40'} min</small></button>`
      : `<button type="button" class="at-day" data-jour="${i}" data-empty aria-label="Ajouter une séance le ${j}"><span>${j} ${dates[i]}</span><span class="at-day-add">+ Séance</span></button>`).join('');
  }
  function itemRow(it) {
    const e = exById(it.ex);
    return `<div class="at-item">${thumb(e)}<span class="at-item-n"><b>${esc(e.nom)}</b><span>${it.note ? esc(it.note) + ' · ' : ''}${e.repos !== '—' ? 'repos ' + e.repos : e.cat}</span></span>
      <label>Séries<input value="${esc(it.s)}" inputmode="numeric" data-prog></label><label>Rép.<input value="${esc(it.r)}" data-prog></label></div>`;
  }
  const nbEx = () => P.blocs.reduce((n, b) => n + b.items.length, 0);
  const dureeSeance = () => 20 + nbEx() * 4;
  function renderBlocks() {
    $('#at-blocks').innerHTML = P.blocs.map((b) => `<li class="at-block" data-id="${b.id}" data-type="${b.type}">
      <div class="at-block-h"><button type="button" class="at-handle" aria-label="Déplacer le bloc ${TYPE_LBL[b.type]} (Alt + flèches)">${ICO.grip}</button><span class="at-btype">${TYPE_LBL[b.type]}</span>
      <span class="at-btitle">${b.type === 'circuit' ? (b.tours || 2) + ' tours · repos 60 s entre les tours' : b.type === 'superset' ? 'Enchaîner sans repos · 90 s après la paire' : ''}</span>
      <button type="button" class="at-icon-btn" data-delb aria-label="Supprimer le bloc">${ICO.x}</button></div>
      ${b.items.map(itemRow).join('')}</li>`).join('');
    $('#at-sess-n').textContent = nbEx();
    $('#at-sess-dur').textContent = dureeSeance();
    const carte = document.querySelector(`#at-days [data-jour="${jourSel}"] small`); if (carte) carte.textContent = nbEx() + ' ex. · ' + dureeSeance() + ' min';
  }
  function renderLib(q = '') {
    $('#at-lib').innerHTML = D.exercices.filter((e) => !q || e.nom.toLowerCase().includes(q.toLowerCase())).map((e) => `<li draggable="true" data-ex="${e.id}">${thumb(e)}<span>${esc(e.nom)}<small>${e.prim.join(', ') || e.cat}</small></span><button type="button" class="at-icon-btn" data-addex="${e.id}" aria-label="Ajouter ${esc(e.nom)} à la séance">${ICO.plus}</button></li>`).join('');
  }
  // FLIP : les blocs glissent vers leur nouvelle place
  function flip(mutate) {
    const els = $$('#at-blocks .at-block'); const first = new Map(els.map((el) => [el.dataset.id, el.getBoundingClientRect().top]));
    mutate();
    if (reduit.matches) return;
    $$('#at-blocks .at-block').forEach((el) => {
      const f = first.get(el.dataset.id); if (f === undefined || el.classList.contains('at-drag')) return;
      const d = f - el.getBoundingClientRect().top; if (Math.abs(d) < 1) return;
      el.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.23,1,.32,1)' });
    });
  }
  const progSaved = () => saving($('#at-prog-saved'));
  function addBlock(type, exId) {
    const pick = (n) => D.exercices.filter((e) => e.video !== 'aucune').slice(n, n + (type === 'circuit' ? 3 : type === 'superset' ? 2 : 1)).map((e) => ({ ex: e.id, s: '3', r: '10' }));
    const b = { id: 'b' + Date.now(), type, tours: 3, items: exId ? [{ ex: exId, s: '3', r: '10' }] : pick(Math.floor(Math.random() * 6)) };
    P.blocs.push(b); renderBlocks(); progSaved();
    const el = $(`#at-blocks [data-id="${b.id}"]`); el.classList.add('at-new'); el.scrollIntoView({ block: 'nearest', behavior: reduit.matches ? 'auto' : 'smooth' });
  }
  function bindProgramme() {
    $('#at-weeks').addEventListener('click', (e) => { const b = e.target.closest('[data-sem]'); if (!b) return; semSel = +b.dataset.sem; renderWeeks(); $('#at-sess-day').textContent = `${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][jourSel]} · Semaine ${semSel}`; });
    $('#at-days').addEventListener('click', (e) => {
      const d = e.target.closest('[data-jour]'); if (!d) return;
      const i = +d.dataset.jour;
      if (d.hasAttribute('data-empty')) { P.seances[i] = 'Nouvelle séance'; progSaved(); }
      jourSel = i; renderWeeks();
      $('#at-sess-t').textContent = P.seances[i];
      $('#at-sess-day').textContent = `${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][i]} · Semaine ${semSel}`;
      const s = $('.at-session'); if (!reduit.matches) s.animate([{ opacity: .4, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' });
    });
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => addBlock(b.dataset.add)));
    $('#at-ql').addEventListener('input', (e) => renderLib(e.target.value));
    $('#at-lib').addEventListener('click', (e) => { const b = e.target.closest('[data-addex]'); if (b) { addBlock('exercice', +b.dataset.addex); toast('Ajouté à la séance'); } });
    $('#at-lib').addEventListener('dragstart', (e) => { const li = e.target.closest('[data-ex]'); if (li) e.dataTransfer.setData('text/plain', li.dataset.ex); });
    const bl = $('#at-blocks');
    bl.addEventListener('dragover', (e) => { e.preventDefault(); bl.classList.add('at-dropping'); });
    bl.addEventListener('dragleave', (e) => { if (!bl.contains(e.relatedTarget)) bl.classList.remove('at-dropping'); });
    bl.addEventListener('drop', (e) => { e.preventDefault(); bl.classList.remove('at-dropping'); const id = +e.dataTransfer.getData('text/plain'); if (id) addBlock('exercice', id); });
    bl.addEventListener('input', (e) => { if (e.target.matches('[data-prog]')) progSaved(); });
    bl.addEventListener('click', (e) => {
      const d = e.target.closest('[data-delb]'); if (!d) return;
      const id = d.closest('.at-block').dataset.id; const el = d.closest('.at-block');
      const rm = () => flip(() => { P.blocs = P.blocs.filter((b) => b.id !== id); renderBlocks(); });
      progSaved();
      if (reduit.matches) rm(); else el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.97)' }], { duration: 150, easing: 'ease-out' }).onfinish = rm;
    });
    // Alt + flèches : réordonner au clavier
    bl.addEventListener('keydown', (e) => {
      const h = e.target.closest('.at-handle'); if (!h || !e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault(); const id = h.closest('.at-block').dataset.id; const i = P.blocs.findIndex((b) => b.id === id); const j = i + (e.key === 'ArrowDown' ? 1 : -1);
      if (j < 0 || j >= P.blocs.length) return;
      flip(() => { const [b] = P.blocs.splice(i, 1); P.blocs.splice(j, 0, b); renderBlocks(); }); progSaved();
      $(`#at-blocks [data-id="${id}"] .at-handle`).focus();
    });
    // Glisser à la poignée (souris + tactile), avec FLIP
    let drag = null;
    // Coordonnées « page » : le défilement automatique près des bords est compté dans le déplacement
    const place = () => {
      const y = drag.cy + scrollY; drag.el.style.transform = `translateY(${y - drag.y0}px) scale(1.01)`;
      const others = $$('#at-blocks .at-block').filter((x) => x !== drag.el);
      const mid = drag.el.getBoundingClientRect().top + drag.el.offsetHeight / 2;
      let idx = others.findIndex((x) => mid < x.getBoundingClientRect().top + x.offsetHeight / 2); if (idx < 0) idx = others.length;
      const cur = P.blocs.findIndex((x) => x.id === drag.id);
      if (idx !== cur) {
        const before = drag.el.getBoundingClientRect().top - (y - drag.y0);
        flip(() => { const [x] = P.blocs.splice(cur, 1); P.blocs.splice(idx, 0, x); const ref = others[idx]; ref ? bl.insertBefore(drag.el, ref) : bl.appendChild(drag.el); });
        drag.el.style.transform = '';
        drag.y0 += drag.el.getBoundingClientRect().top - before;
        drag.el.style.transform = `translateY(${y - drag.y0}px) scale(1.01)`;
      }
    };
    const auto = () => {
      if (!drag) return;
      const bord = 72, bas = innerHeight - (mobile.matches ? 90 : 0);
      const v = drag.cy < bord ? -Math.ceil((bord - drag.cy) / 6) : drag.cy > bas - bord ? Math.ceil((drag.cy - (bas - bord)) / 6) : 0;
      if (v) { const avant = scrollY; scrollBy(0, v); if (scrollY !== avant) place(); }
      drag.raf = requestAnimationFrame(auto);
    };
    bl.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('.at-handle'); if (!h || e.button > 0) return;
      e.preventDefault(); const el = h.closest('.at-block');
      drag = { el, id: el.dataset.id, y0: e.clientY + scrollY, cy: e.clientY }; el.classList.add('at-drag'); h.setPointerCapture(e.pointerId);
      drag.raf = requestAnimationFrame(auto);
    });
    bl.addEventListener('pointermove', (e) => { if (!drag) return; drag.cy = e.clientY; place(); });
    const end = () => {
      if (!drag) return; cancelAnimationFrame(drag.raf); const el = drag.el; drag = null;
      const t = el.style.transform; el.style.transform = '';
      if (!reduit.matches && t) el.animate([{ transform: t }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.23,1,.32,1)' });
      el.classList.remove('at-drag'); progSaved();
    };
    bl.addEventListener('pointerup', end); bl.addEventListener('pointercancel', end);
  }

  /* ---------- Démarrage ---------- */
  const dl = document.createElement('datalist'); dl.id = 'at-dl-muscles';
  dl.innerHTML = [...new Set(D.exercices.flatMap((e) => [...e.prim, ...e.sec, ...e.mat]))].map((m) => `<option value="${m}">`).join('');
  document.body.appendChild(dl);
  // Panneaux : jamais « hidden » (pré-rendus pour une 1re ouverture fluide), inertes tant qu'ils sont fermés
  for (const id of ['#at-panel', '#at-cpanel']) { const p = $(id); p.hidden = false; p.inert = true; }
  $('#at-panel-in').innerHTML = renderEx(D.exercices[0]);
  renderDash(); renderFilters(); renderList(false); bindExercices(); renderCl(); bindClients(); renderWeeks(); renderBlocks(); renderLib(); bindProgramme();
  sheetDrag('#at-panel', '#at-split-ex'); sheetDrag('#at-cpanel', '#at-split-cl');
  // Lien « Valider » du tableau de bord : filtre « à valider »
  window.addEventListener('hashchange', () => { if (location.hash.includes('f=proposee')) { F.proposee = true; renderFilters(); renderList(); } });
  route();
  if (location.hash.includes('f=proposee')) { F.proposee = true; renderFilters(); renderList(false); }
  // Paramètres de capture : ?ex=1 ouvre une fiche, ?cl=1 une fiche client
  const qs = new URLSearchParams(location.search);
  if (qs.get('ex')) openEx(+qs.get('ex'));
  if (qs.get('cl')) { tabCl = qs.get('tab') || 'apercu'; openCl(+qs.get('cl')); }
})();
