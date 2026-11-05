/* d2 « Console » — maquette cliquable, vanilla JS, aucune dépendance. */
(() => {
  const D = window.CS_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mobile = () => matchMedia('(max-width: 760px)').matches;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const client = (id) => D.clients.find((c) => c.id === id);
  const exo = (id) => D.exercices.find((e) => e.id === id);

  const ICONS = {
    home: '<path d="M3 10.5 10 4l7 6.5V17H3z"/><path d="M8 17v-4h4v4"/>',
    dumbbell: '<path d="M3 8v4M6 6v8M14 6v8M17 8v4M6 10h8"/>',
    users: '<circle cx="8" cy="7" r="3"/><path d="M2.5 17c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><path d="M13 4.2a3 3 0 0 1 0 5.6M15 12.8c1.4.6 2.3 2 2.6 4.2"/>',
    grid: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
    cal: '<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
    bell: '<path d="M5 13V9a5 5 0 0 1 10 0v4l1.5 2h-13z"/><path d="M8.5 17.5a1.8 1.8 0 0 0 3 0"/>',
    search: '<circle cx="9" cy="9" r="5.5"/><path d="m13.2 13.2 3.8 3.8"/>',
    plus: '<path d="M10 4v12M4 10h12"/>',
    x: '<path d="m5 5 10 10M15 5 5 15"/>',
    check: '<path d="m4.5 10.5 3.5 3.5 7.5-8"/>',
    up: '<path d="m6 12 4-4 4 4"/>', down: '<path d="m6 8 4 4 4-4"/>',
    video: '<rect x="2.5" y="5" width="11" height="10" rx="2"/><path d="m13.5 9 4-2.5v7l-4-2.5"/>',
    image: '<rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.5"/><path d="m3.5 15 4.5-4.5 3 3 2-2 3.5 3.5"/>',
    list: '<path d="M7 6h10M7 10h10M7 14h10M3.5 6h.01M3.5 10h.01M3.5 14h.01"/>',
    sparkle: '<path d="M10 3v4M10 13v4M3 10h4M13 10h4M5.5 5.5l2 2M12.5 12.5l2 2M14.5 5.5l-2 2M7.5 12.5l-2 2"/>',
    grip: '<circle cx="8" cy="6" r=".9"/><circle cx="12" cy="6" r=".9"/><circle cx="8" cy="10" r=".9"/><circle cx="12" cy="10" r=".9"/><circle cx="8" cy="14" r=".9"/><circle cx="12" cy="14" r=".9"/>',
    arrow: '<path d="M4 10h12M11 5l5 5-5 5"/>',
    msg: '<path d="M3.5 4.5h13v9h-8l-4 3v-3h-1z"/>',
    trend: '<path d="m3 14 4.5-4.5 3 3L17 6"/><path d="M12.5 6H17v4.5"/>',
    cmd: '<path d="M7 4.5a2.5 2.5 0 1 0 0 5h6a2.5 2.5 0 1 0 0-5v11a2.5 2.5 0 1 0 0-5H7a2.5 2.5 0 1 0 0 5z"/>',
  };
  const ic = (n, extra = '') => `<svg class="cs-i" viewBox="0 0 20 20" aria-hidden="true" ${extra}>${ICONS[n]}</svg>`;

  /* Vignette factice : « image de la vidéo » ou photo, dessinée en SVG (aucun réseau). */
  function art(e, big) {
    if (e.photo) return `<img src="${e.photo}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
    const h = e.h, photo = e.src === 'photo';
    const g = `cs-g${e.id}${big ? 'b' : ''}`;
    const figure = {
      Force: '<circle cx="80" cy="22" r="7"/><path d="M80 30v22M80 52l-10 16M80 52l12 14M66 38h28"/><path d="M62 34v8M98 34v8"/>',
      Mobilité: '<circle cx="62" cy="50" r="7"/><path d="M68 54l26 4 14 12M94 58l-6 12M70 56l-14 14"/>',
      Gainage: '<circle cx="50" cy="48" r="7"/><path d="M57 52l58 10M60 54v14M112 62v8"/>',
      Cardio: '<circle cx="84" cy="20" r="7"/><path d="M84 28l-6 22M78 50l-12 18M78 50l14 8 4 12M82 34l14 8M82 34l-14 6"/>',
      Équilibre: '<circle cx="80" cy="18" r="7"/><path d="M80 26v26M80 52v18M80 52l14 -4M66 34l14 4 14-4"/>',
    }[e.cat] || '';
    return `<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 18% ${photo ? 34 : 26}%)"/><stop offset="1" stop-color="hsl(${(h + 30) % 360} 14% ${photo ? 20 : 13}%)"/></linearGradient></defs><rect width="160" height="90" fill="url(#${g})"/><path d="M0 72h160" stroke="rgba(255,255,255,.12)"/>${photo ? '<rect x="118" y="10" width="30" height="40" rx="2" fill="rgba(255,255,255,.06)"/>' : ''}<g fill="none" stroke="rgba(255,255,255,.62)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${figure}</g></svg>`;
  }
  const thumb = (e) => e.video === 'aucune' && !e.photo
    ? `<div class="cs-thumb is-none" title="Pas de média">${ic('image')}</div>`
    : `<div class="cs-thumb">${art(e)}${e.src === 'youtube' && !e.photo ? '<span class="cs-yt"></span>' : ''}</div>`;
  const vstat = (e) => e.video === 'proposee' ? '<span class="cs-pill cs-pill--info">À valider</span>'
    : e.video === 'validee' ? '<span class="cs-pill cs-pill--ok">Validée</span>' : '<span class="cs-pill">Aucun média</span>';

  /* ===== État ===== */
  const st = { route: 'dash', q: '', cat: '', mat: '', muscle: '', aValider: false, vue: 'table', sel: null, panel: null, prog: null, week: 1 };

  /* ===== Toast ===== */
  let toastT;
  function toast(html) {
    const t = $('#cs-toast'); t.innerHTML = html; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  /* ===== Routeur ===== */
  const TITRES = { dash: 'Aujourd\'hui', exercices: 'Exercices', clients: 'Clients', programmes: 'Programmes' };
  function go(route, push = true) {
    if (push) location.hash = '#/' + route;
    else render();
  }
  function routeFromHash() { const r = location.hash.replace('#/', '') || 'dash'; return TITRES[r] ? r : 'dash'; }
  window.addEventListener('hashchange', () => render());

  function render() {
    const r = routeFromHash();
    const changed = r !== st.route; st.route = r;
    if (changed) closePanel(true);
    $$('[data-route]').forEach((a) => a.dataset.route === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    $('#cs-crumb').innerHTML = `<span class="cs-logo cs-only-m" aria-hidden="true">C</span><span class="cs-hide-m">Coach</span><span class="cs-hide-m">/</span><b>${TITRES[r]}</b>`;
    const v = $('#cs-view');
    v.innerHTML = VIEWS[r]();
    v.classList.remove('is-enter'); void v.offsetWidth; if (changed) v.classList.add('is-enter');
    AFTER[r] && AFTER[r]();
    document.title = `${TITRES[r]} · Console coach`;
  }

  /* ===== Tableau de bord ===== */
  function dash() {
    const aVal = D.exercices.filter((e) => e.video === 'proposee').length;
    const etat = { fait: '<span class="cs-pill cs-pill--ok">Fait</span>', maintenant: '<span class="cs-pill cs-pill--acc cs-pill--nodot">En cours</span>', 'a-venir': '<span class="cs-pill">À venir</span>' };
    return `
    <div class="cs-head"><div><h1 class="cs-h1">Bonjour Corentin</h1><p class="cs-sub">Jeudi 5 novembre · <span class="cs-num">5</span> séances · prochaine à <span class="cs-num">12:15</span></p></div>
      <div class="cs-top-r"><button class="cs-btn" data-act="cmd">${ic('search')} Rechercher <span class="cs-kbd">Ctrl</span><span class="cs-kbd">K</span></button><button class="cs-btn cs-btn--acc" data-act="new-seance">${ic('plus')} Nouvelle séance <span class="cs-kbd">S</span></button></div></div>
    <div class="cs-grid">
      <section class="cs-card cs-kpis" aria-label="Chiffres du jour">
        <div class="cs-kpi"><small>Séances aujourd'hui</small><b>5</b><em>1 faite · 1 en cours</em></div>
        <div class="cs-kpi"><small>Clients actifs</small><b>${D.clients.length}</b><em class="up">+1 cette semaine</em></div>
        <div class="cs-kpi"><small>Assiduité 30 j</small><b>87<span style="font-size:.6em">%</span></b><em class="up">+4 pts</em></div>
        <div class="cs-kpi"><small>Vidéos à valider</small><b style="color:var(--cs-acc)">${aVal}</b><em>proposées par Claude</em></div>
      </section>
      <section class="cs-card cs-span-7"><header class="cs-card-h"><h2 class="cs-h2">${ic('cal')} Séances du jour</h2><a class="cs-btn" href="#/programmes">Agenda</a></header>
        <ul class="cs-rows">${D.jour.map((s) => { const c = client(s.client); return `<li class="cs-row ${s.etat === 'maintenant' ? 'is-now' : ''}" data-client="${c.id}" tabindex="0"><span class="cs-time">${s.h}</span><span class="cs-avatar">${c.ini}</span><span class="cs-row-main"><b>${c.nom}</b><small>${s.titre} · ${s.lieu}</small></span>${etat[s.etat]}</li>`; }).join('')}</ul></section>
      <section class="cs-card cs-span-5"><header class="cs-card-h"><h2 class="cs-h2">${ic('bell')} Alertes <span class="cs-count is-hot">3</span></h2></header>
        <ul class="cs-rows">
          <li class="cs-row" data-client="C-04" tabindex="0"><span class="cs-pill cs-pill--bad cs-pill--nodot">Douleur</span><span class="cs-row-main"><b>Sophie Garnier</b><small>« Lombaires 6/10 après le soulevé de terre »</small></span></li>
          <li class="cs-row" data-client="C-02" tabindex="0"><span class="cs-pill cs-pill--warn cs-pill--nodot">Retard</span><span class="cs-row-main"><b>Martine Laurent</b><small>Check-in hebdo non rempli (6 j)</small></span></li>
          <li class="cs-row" data-go="exercices" data-filter="aValider" tabindex="0"><span class="cs-pill cs-pill--info cs-pill--nodot">Claude</span><span class="cs-row-main"><b>${aVal} vidéos proposées</b><small>À regarder et valider en un clic</small></span>${ic('arrow')}</li>
        </ul></section>
      <section class="cs-card cs-span-4"><header class="cs-card-h"><h2 class="cs-h2">${ic('msg')} Check-ins reçus</h2></header>
        <ul class="cs-rows">
          <li class="cs-row" data-client="C-03" tabindex="0"><span class="cs-avatar">KB</span><span class="cs-row-main"><b>Karim Benali</b><small>Forme 8/10 · sommeil 7 h</small></span><span class="cs-mono">07:12</span></li>
          <li class="cs-row" data-client="C-01" tabindex="0"><span class="cs-avatar">FM</span><span class="cs-row-main"><b>Fabien Morel</b><small>Poids 81,1 kg · genou 2/10</small></span><span class="cs-mono">06:48</span></li>
          <li class="cs-row" data-client="C-07" tabindex="0"><span class="cs-avatar">HP</span><span class="cs-row-main"><b>Hélène Petit</b><small>Raideur matinale en baisse</small></span><span class="cs-mono">hier</span></li>
        </ul></section>
      <section class="cs-card cs-span-4"><header class="cs-card-h"><h2 class="cs-h2">${ic('cal')} Réservations</h2><span class="cs-pill cs-pill--warn" style="margin-left:auto">1 à confirmer</span></header>
        <ul class="cs-rows">
          <li class="cs-row"><span class="cs-time">Ven</span><span class="cs-row-main"><b>Nouvelle : Anne Rivière</b><small>Séance découverte · 09:00</small></span><button class="cs-btn" data-act="confirm">Confirmer</button></li>
          <li class="cs-row"><span class="cs-time">Sam</span><span class="cs-row-main"><b>Claire Dubois</b><small>Déplacée 10:00 → 11:00</small></span><span class="cs-pill cs-pill--ok">OK</span></li>
        </ul></section>
      <section class="cs-card cs-span-4"><header class="cs-card-h"><h2 class="cs-h2">${ic('sparkle')} Actions rapides</h2></header>
        <div class="cs-quick">
          <button data-act="new-exo">${ic('dumbbell')}<span>Exercice</span><span class="cs-kbd">N</span></button>
          <button data-act="new-seance">${ic('list')}<span>Séance</span><span class="cs-kbd">S</span></button>
          <button data-go="clients">${ic('users')}<span>Client</span><span class="cs-kbd">G</span><span class="cs-kbd">C</span></button>
          <button data-act="cmd">${ic('search')}<span>Tout</span><span class="cs-kbd">⌃K</span></button>
        </div></section>
    </div>`;
  }

  /* ===== Exercices ===== */
  const CATS = ['Force', 'Mobilité', 'Gainage', 'Cardio', 'Équilibre'];
  const MATS = [...new Set(D.exercices.flatMap((e) => e.mat))].sort();
  const MUSCLES = [...new Set(D.exercices.flatMap((e) => [...e.mP, ...e.mS]))].sort();
  function filtered() {
    const q = st.q.trim().toLowerCase();
    return D.exercices.filter((e) => (!q || (e.nom + ' ' + e.mP.join(' ') + ' ' + e.mat.join(' ') + ' ' + e.id).toLowerCase().includes(q))
      && (!st.cat || e.cat === st.cat) && (!st.mat || e.mat.includes(st.mat)) && (!st.muscle || e.mP.includes(st.muscle) || e.mS.includes(st.muscle))
      && (!st.aValider || e.video === 'proposee'));
  }
  function exercices() {
    const aVal = D.exercices.filter((e) => e.video === 'proposee').length;
    return `
    <div class="cs-head"><div><h1 class="cs-h1">Exercices</h1><p class="cs-sub"><span class="cs-num" id="cs-nb">${D.exercices.length}</span> dans la bibliothèque · <span class="cs-num">${aVal}</span> vidéos proposées par Claude</p></div>
      <div class="cs-top-r"><div class="cs-seg" role="group" aria-label="Affichage"><button aria-pressed="${st.vue === 'table'}" data-vue="table" aria-label="Tableau">${ic('list')}</button><button aria-pressed="${st.vue === 'cards'}" data-vue="cards" aria-label="Vignettes">${ic('grid')}</button></div>
      <button class="cs-btn cs-btn--acc" data-act="new-exo">${ic('plus')} Nouvel exercice <span class="cs-kbd">N</span></button></div></div>
    <div class="cs-tools">
      <label class="cs-field">${ic('search')}<span class="cs-sr">Rechercher un exercice</span><input id="cs-q" type="search" placeholder="Rechercher nom, muscle, matériel…" value="${esc(st.q)}" autocomplete="off"><span class="cs-kbd cs-hide-m">/</span></label>
    </div>
    <div class="cs-tools cs-filters" role="group" aria-label="Filtres">
      <button class="cs-chip cs-chip--acc" data-f="aValider" aria-pressed="${st.aValider}">${ic('video')} Vidéo à valider <b>${aVal}</b></button>
      ${CATS.map((c) => `<button class="cs-chip" data-cat="${c}" aria-pressed="${st.cat === c}">${c}</button>`).join('')}
      <label class="cs-sr" for="cs-mus">Muscle</label><select id="cs-mus" class="cs-select"><option value="">Muscle : tous</option>${MUSCLES.map((m) => `<option ${st.muscle === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <label class="cs-sr" for="cs-mat">Matériel</label><select id="cs-mat" class="cs-select"><option value="">Matériel : tout</option>${MATS.map((m) => `<option ${st.mat === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
    </div>
    <div id="cs-list"></div>`;
  }
  function renderList(anim) {
    const L = filtered(); const box = $('#cs-list'); if (!box) return;
    const useCards = st.vue === 'cards';
    if (!L.length) { box.innerHTML = '<div class="cs-empty">Aucun exercice ne correspond. <button class="cs-btn" data-act="reset">Effacer les filtres</button></div>'; return; }
    box.innerHTML = useCards
      ? `<div class="cs-cards ${anim ? 'cs-list-anim' : ''}" role="listbox" aria-label="Exercices">${L.map((e, i) => `<div class="cs-xcard cs-tr-like" role="option" tabindex="${(st.sel || L[0].id) === e.id ? 0 : -1}" data-id="${e.id}" aria-selected="${st.panel === e.id}" style="--i:${i}">${thumb(e)}${e.video === 'proposee' ? '<span class="cs-pill cs-pill--info">À valider</span>' : ''}<div class="cs-xcard-b"><b>${esc(e.nom)}</b><span class="cs-meta">${e.cat} · ${e.mP.join(', ')} · <span class="cs-mono">${e.used} séances</span></span></div></div>`).join('')}</div>`
      : `<div class="cs-table" role="listbox" aria-label="Exercices"><div class="cs-thead" aria-hidden="true"><span>Média</span><span>Nom</span><span>Muscles</span><span>Matériel</span><span>Niveau</span><span>Séances</span><span>Vidéo</span></div>
        <div class="${anim ? 'cs-list-anim' : ''}">${L.map((e, i) => `<div class="cs-tr cs-tr-like" role="option" tabindex="${(st.sel || L[0].id) === e.id ? 0 : -1}" data-id="${e.id}" aria-selected="${st.panel === e.id}" style="--i:${i}">${thumb(e)}<span class="cs-name"><b>${esc(e.nom)}</b><small><span class="cs-mono">${e.id}</span> · ${e.cat}</small></span><span class="cs-muscles">${e.mP.join(', ')}${e.mS.length ? ' <span style="color:var(--cs-ink-3)">+ ' + e.mS.join(', ') + '</span>' : ''}</span><span class="cs-muscles">${e.mat.join(', ')}</span><span class="cs-mono" aria-label="Niveau ${e.niveau} sur 5">${'■'.repeat(e.niveau)}<span style="opacity:.3">${'■'.repeat(5 - e.niveau)}</span></span><span class="cs-mono">${e.used}</span>${vstat(e)}</div>`).join('')}</div></div>`;
    $('#cs-nb') && ($('#cs-nb').textContent = D.exercices.length);
  }
  function afterExercices() {
    renderList(true);
    const q = $('#cs-q');
    q.addEventListener('input', () => { st.q = q.value; renderList(false); });
    q.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowDown' || ev.key === 'Enter') { ev.preventDefault(); const f = $('.cs-tr-like'); f && (ev.key === 'Enter' ? openExo(f.dataset.id) : f.focus()); } });
    $('#cs-mus').addEventListener('change', (ev) => { st.muscle = ev.target.value; renderList(true); });
    $('#cs-mat').addEventListener('change', (ev) => { st.mat = ev.target.value; renderList(true); });
  }

  /* ===== Panneau : exercice ===== */
  let saveT, saveT2;
  function saving() {
    const s = $('#cs-save'); if (!s) return;
    s.className = 'cs-save is-saving'; s.innerHTML = '<i></i>Enregistrement…';
    clearTimeout(saveT); clearTimeout(saveT2);
    saveT = setTimeout(() => { s.className = 'cs-save is-saved'; s.innerHTML = `${ic('check')}Enregistré`; saveT2 = setTimeout(() => { s.className = 'cs-save'; s.innerHTML = '<i></i>À jour · à l\'instant'; }, 1600); }, 450);
  }
  function tokens(e, key, prim) {
    return `<div class="cs-tokens" data-tok="${key}">${e[key].map((m, i) => `<span class="cs-token ${prim ? 'is-prim' : ''}">${esc(m)}<button type="button" data-rm="${key}:${i}" aria-label="Retirer ${esc(m)}">${ic('x', 'style="width:12px;height:12px"')}</button></span>`).join('')}<input class="cs-token-add" data-add="${key}" placeholder="+ ajouter" aria-label="Ajouter (${key})" list="cs-dl-${key === 'mat' ? 'mat' : 'mus'}"></div>`;
  }
  function exoPanel(e) {
    const seances = ['Reprise force · S3 J1', 'Seniors équilibre · S6 J2', 'Full body · S7 J3', 'Dos solide · S4 J1'].slice(0, Math.min(4, Math.ceil(e.used / 5)));
    const media = e.video === 'aucune' && !e.photo
      ? `<div class="cs-media"><div class="cs-player" style="background:var(--cs-bg)"><div class="cs-ctr"><div style="text-align:center;color:var(--cs-ink-3);display:grid;gap:8px;justify-items:center">${ic('video', 'style="width:28px;height:28px"')}<span>Pas encore de vidéo</span><button class="cs-btn" data-act="ask-claude">${ic('sparkle')} Demander une vidéo à Claude</button></div></div></div></div>`
      : `<div class="cs-media"><div class="cs-player" id="cs-player"><svg class="cs-art" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art(e, true).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>${e.photo ? `<img src="${e.photo}" alt="Photo de l'exercice" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : ''}
          ${e.src === 'youtube' && !e.photo ? `<span class="cs-src cs-pill cs-pill--nodot" style="background:rgba(0,0,0,.6);color:#fff">YouTube</span><button class="cs-play" data-act="play" aria-label="Lire la vidéo">${'<svg viewBox="0 0 20 20"><path d="M5 3.5v13l11-6.5z"/></svg>'}</button><span class="cs-dur">${e.duree}</span><span class="cs-scrub"><i></i></span>` : `<span class="cs-src cs-pill cs-pill--nodot" style="background:rgba(0,0,0,.6);color:#fff">Photo</span>`}</div>
          <div class="cs-media-bar"><span class="cs-url">${e.src === 'youtube' && !e.photo ? (e.yt ? 'youtube.com/watch?v=' + e.yt : 'vidéo YouTube sans lien direct') : (e.photo ? 'photo importée' : 'photo-' + e.id.toLowerCase() + '.jpg')}</span>${vstat(e)}</div></div>`;
    return `
      <div class="cs-sec"><input class="cs-title-in" data-k="nom" value="${esc(e.nom)}" aria-label="Nom de l'exercice"></div>
      ${e.video === 'proposee' ? `<div class="cs-propose" id="cs-propose">${ic('sparkle', 'style="color:var(--cs-info)"')}<p>Vidéo proposée par Claude<small>Ajoutée hier à 22:14 · à regarder avant d'envoyer aux clients</small></p><button class="cs-btn cs-btn--acc" data-act="validate">Valider <span class="cs-kbd">V</span></button><button class="cs-btn cs-btn--ghost" data-act="reject">Refuser</button></div>` : ''}
      ${media}
      <label class="cs-drop" id="cs-drop" for="cs-file">${e.photo ? `<img src="${e.photo}" alt="">` : `<span class="cs-ph">${ic('image')}</span>`}<span>Glissez une photo ici ou <u>choisissez un fichier</u><br><small style="color:var(--cs-ink-3)">JPG, PNG ou WebP · remplace la vignette</small></span><input type="file" id="cs-file" accept="image/*" class="cs-sr"></label>
      <dl class="cs-props">
        <dt>Catégorie</dt><dd><select class="cs-inline" data-k="cat" aria-label="Catégorie">${CATS.map((c) => `<option ${c === e.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></dd>
        <dt>Muscles principaux</dt><dd>${tokens(e, 'mP', true)}</dd>
        <dt>Secondaires</dt><dd>${tokens(e, 'mS')}</dd>
        <dt>Matériel</dt><dd>${tokens(e, 'mat')}</dd>
        <dt>Niveau</dt><dd><div class="cs-levels" role="group" aria-label="Niveau">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-lvl="${n}" aria-pressed="${n === e.niveau}">${n}</button>`).join('')}</div></dd>
        <dt>Tempo</dt><dd><input class="cs-inline cs-mono" data-k="tempo" value="${esc(e.tempo)}" aria-label="Tempo conseillé"></dd>
        <dt>Repos</dt><dd><input class="cs-inline cs-mono" data-k="repos" value="${esc(e.repos)}" aria-label="Repos conseillé"></dd>
      </dl>
      <div class="cs-sec"><header>Consignes d'exécution</header><textarea class="cs-area" data-k="consignes" rows="3" aria-label="Consignes d'exécution">${esc(e.consignes)}</textarea></div>
      <div class="cs-sec"><header>Erreurs fréquentes</header><textarea class="cs-area" data-k="erreurs" rows="2" aria-label="Erreurs fréquentes">${esc(e.erreurs)}</textarea></div>
      <div class="cs-sec"><header>Variantes</header><div class="cs-variants"><label class="cs-variant"><small>${ic('down', 'style="width:12px;height:12px"')} Plus facile</small><input data-k="facile" value="${esc(e.facile)}"></label><label class="cs-variant"><small>${ic('up', 'style="width:12px;height:12px"')} Plus dur</small><input data-k="dur" value="${esc(e.dur)}"></label></div></div>
      <div class="cs-sec"><header>Notes privées <span style="text-transform:none;letter-spacing:0">· jamais visibles du client</span></header><textarea class="cs-area is-private" data-k="notes" rows="2" placeholder="Pour vous seul…" aria-label="Notes privées">${esc(e.notes)}</textarea></div>
      <div class="cs-sec"><header>Utilisé dans <span class="cs-mono" style="color:var(--cs-ink)">${e.used}</span> séances</header><div class="cs-used">${seances.map((s) => `<a href="#/programmes" class="cs-tag">${s}</a>`).join('')}${e.used > 4 ? `<span class="cs-tag">+${e.used - seances.length}</span>` : ''}</div></div>
      <datalist id="cs-dl-mus">${MUSCLES.map((m) => `<option>${m}</option>`).join('')}</datalist><datalist id="cs-dl-mat">${MATS.map((m) => `<option>${m}</option>`).join('')}</datalist>`;
  }

  function openExo(id, opts = {}) {
    const e = exo(id); if (!e) return;
    st.panel = id; st.sel = id;
    openPanel(`<span class="cs-mono">${e.id}</span>${vstat(e)}`, exoPanel(e), 'exo', opts.swap);
    $$('.cs-tr-like').forEach((r) => { r.setAttribute('aria-selected', r.dataset.id === id); r.tabIndex = r.dataset.id === id ? 0 : -1; });
    const row = $(`.cs-tr-like[data-id="${id}"]`); row && row.scrollIntoView({ block: 'nearest' });
    bindExoPanel(e);
    if (opts.focusTitle) setTimeout(() => { const t = $('.cs-title-in'); t.focus(); t.select(); }, 60);
  }
  function refreshRow(e) {
    const row = $(`.cs-tr-like[data-id="${e.id}"]`); if (!row) return;
    const b = row.querySelector('b'); b && (b.textContent = e.nom);
  }
  function bindExoPanel(e) {
    const P = $('#cs-panel-b');
    P.addEventListener('input', (ev) => {
      const k = ev.target.dataset.k; if (!k) return;
      e[k] = ev.target.value; saving(); if (k === 'nom') refreshRow(e);
    });
    P.addEventListener('change', (ev) => { if (ev.target.dataset.k === 'cat') { e.cat = ev.target.value; saving(); renderList(false); } });
    P.addEventListener('click', (ev) => {
      const lvl = ev.target.closest('[data-lvl]');
      if (lvl) { e.niveau = +lvl.dataset.lvl; $$('[data-lvl]', P).forEach((b) => b.setAttribute('aria-pressed', b === lvl)); saving(); renderList(false); return; }
      const rm = ev.target.closest('[data-rm]');
      if (rm) { const [k, i] = rm.dataset.rm.split(':'); e[k].splice(+i, 1); rerenderTokens(e, k); saving(); renderList(false); }
    });
    P.addEventListener('keydown', (ev) => {
      const add = ev.target.closest('[data-add]');
      if (add && ev.key === 'Enter' && add.value.trim()) { ev.preventDefault(); const k = add.dataset.add; e[k].push(add.value.trim()); rerenderTokens(e, k); saving(); renderList(false); $(`[data-add="${k}"]`).focus(); }
      if (add && ev.key === 'Backspace' && !add.value && e[add.dataset.add].length) { const k = add.dataset.add; e[k].pop(); rerenderTokens(e, k); saving(); $(`[data-add="${k}"]`).focus(); }
    });
    const drop = $('#cs-drop'), file = $('#cs-file');
    const take = (f) => { if (!f || !f.type.startsWith('image/')) return; const r = new FileReader(); r.onload = () => { e.photo = r.result; if (e.video === 'aucune') e.video = 'validee'; saving(); renderList(false); openExo(e.id, { swap: true }); toast(`${ic('check')} Photo ajoutée à « ${esc(e.nom)} »`); }; r.readAsDataURL(f); };
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (ev) => { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
    file.addEventListener('change', () => take(file.files[0]));
  }
  function rerenderTokens(e, k) {
    const box = $(`[data-tok="${k}"]`); const tmp = document.createElement('div'); tmp.innerHTML = tokens(e, k, k === 'mP'); box.replaceWith(tmp.firstElementChild);
  }
  function validate(ok) {
    const e = exo(st.panel); if (!e) return;
    e.video = ok ? 'validee' : 'aucune';
    toast(ok ? `${ic('check', 'style="color:var(--cs-ok)"')} Vidéo validée · visible par les clients` : `Vidéo refusée · Claude en proposera une autre`);
    renderList(false); openExo(e.id, { swap: true });
  }

  /* ===== Panneau générique (côté ordinateur, feuille glissable sur téléphone) ===== */
  let lastFocus = null, narrowT;
  function openPanel(head, body, kind, swap) {
    const p = $('#cs-panel'); const wasOpen = p.classList.contains('is-open');
    if (!wasOpen) lastFocus = document.activeElement;
    $('#cs-panel-head').innerHTML = head;
    const b = $('#cs-panel-b'); const nb = b.cloneNode(false); nb.innerHTML = body; b.replaceWith(nb);
    p.dataset.kind = kind;
    if (wasOpen && !reduce()) { nb.classList.add('is-swap'); }
    p.style.removeProperty('--cs-drag');
    p.classList.add('is-open'); p.setAttribute('aria-hidden', 'false');
    clearTimeout(narrowT);
    if (wasOpen || reduce()) document.body.classList.add('cs-has-panel');
    else narrowT = setTimeout(() => { if (p.classList.contains('is-open')) document.body.classList.add('cs-has-panel'); }, 210);
    document.body.classList.add('cs-panel-on');
    if (mobile()) { $('#cs-scrim').classList.add('is-open', 'is-sheet'); document.body.style.overflow = 'hidden'; }
    const s = $('#cs-save'); s.className = 'cs-save'; s.innerHTML = '<i></i>À jour';
    $('.cs-panel-f').hidden = kind !== 'exo';
    if (!wasOpen && !swap && mobile()) setTimeout(() => p.focus({ preventScroll: true }), 30);
  }
  function closePanel(silent) {
    const p = $('#cs-panel'); if (!p.classList.contains('is-open')) return;
    p.classList.remove('is-open'); p.setAttribute('aria-hidden', 'true');
    clearTimeout(narrowT); document.body.classList.remove('cs-has-panel', 'cs-panel-on'); document.body.style.overflow = '';
    $('#cs-scrim').classList.remove('is-open', 'is-sheet');
    st.panel = null;
    $$('.cs-tr-like').forEach((r) => r.setAttribute('aria-selected', 'false'));
    if (!silent) { const r = st.sel && $(`.cs-tr-like[data-id="${st.sel}"]`); (r || lastFocus) && (r || lastFocus).focus && (r || lastFocus).focus({ preventScroll: true }); }
  }
  function step(dir) {
    const rows = $$('.cs-tr-like'); if (!rows.length) return;
    const cur = rows.findIndex((r) => r.dataset.id === (st.panel || st.sel));
    const n = rows[Math.max(0, Math.min(rows.length - 1, cur + dir))];
    if (st.panel) openExo(n.dataset.id, { swap: true }); else { st.sel = n.dataset.id; rows.forEach((r) => r.tabIndex = r === n ? 0 : -1); n.focus(); }
  }

  /* Glisser la feuille vers le bas pour fermer (téléphone) */
  function bindSheetDrag() {
    const p = $('#cs-panel'); let y0 = null, dy = 0, t0 = 0;
    const start = (ev) => { if (!mobile() || ev.target.closest('button')) return; y0 = ev.clientY; dy = 0; t0 = performance.now(); p.classList.add('is-dragging'); ev.currentTarget.setPointerCapture(ev.pointerId); };
    const move = (ev) => { if (y0 == null) return; dy = Math.max(0, ev.clientY - y0); p.style.setProperty('--cs-drag', dy + 'px'); };
    const end = () => { if (y0 == null) return; p.classList.remove('is-dragging'); const v = dy / (performance.now() - t0); y0 = null; if (dy > 120 || v > .6) closePanel(); else p.style.setProperty('--cs-drag', '0px'); };
    ['.cs-grab', '.cs-panel-h'].forEach((s) => { const el = $(s, p); el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); });
  }

  /* ===== Clients ===== */
  const spark = (s) => { const mn = Math.min(...s), mx = Math.max(...s); return `<svg class="cs-spark" viewBox="0 0 100 24" aria-hidden="true"><path d="${s.map((v, i) => `${i ? 'L' : 'M'}${(i / (s.length - 1)) * 98 + 1} ${22 - ((v - mn) / (mx - mn || 1)) * 20}`).join(' ')}"/></svg>`; };
  const pillC = (c) => `<span class="cs-pill cs-pill--${c.statut}">${c.statutTxt}</span>`;
  function clients() {
    return `<div class="cs-head"><div><h1 class="cs-h1">Clients</h1><p class="cs-sub"><span class="cs-num">${D.clients.length}</span> actifs · <span class="cs-num">3</span> demandent votre attention</p></div><div class="cs-top-r"><button class="cs-btn cs-btn--acc" data-act="new-client">${ic('plus')} Nouveau client <span class="cs-kbd">C</span></button></div></div>
    <div class="cs-tools"><label class="cs-field">${ic('search')}<span class="cs-sr">Rechercher un client</span><input id="cs-cq" type="search" placeholder="Rechercher un client…" autocomplete="off"><span class="cs-kbd cs-hide-m">/</span></label></div>
    <div class="cs-table cs-ctable" role="listbox" aria-label="Clients"><div class="cs-thead" aria-hidden="true"><span>Client</span><span>Programme</span><span>Dernière séance</span><span>Assiduité</span><span>Tendance</span><span>Statut</span></div>
    <div id="cs-clist">${D.clients.map((c, i) => crow(c, i)).join('')}</div></div>`;
  }
  const crow = (c, i) => `<div class="cs-tr cs-tr-like" role="option" tabindex="${i ? -1 : 0}" data-id="${c.id}" data-kind="client" aria-selected="false"><span class="cs-name" style="display:flex;gap:10px;align-items:center"><span class="cs-avatar">${c.ini}</span><span style="min-width:0"><b>${c.nom}</b><small><span class="cs-num">${c.age}</span> ans · ${c.objectif}</small></span></span><span class="cs-muscles">${c.programme}</span><span class="cs-mono">${c.dernier}</span><span class="cs-mono">${c.assiduite ? c.assiduite + ' %' : '—'}</span>${spark(c.serie)}${pillC(c)}</div>`;
  function openClient(id, tab = 'apercu') {
    const c = client(id); if (!c) return;
    if (st.route !== 'clients') { location.hash = '#/clients'; setTimeout(() => openClient(id, tab), 30); return; }
    st.panel = id; st.sel = id;
    const tabs = [['apercu', 'Aperçu'], ['programme', 'Programme'], ['suivi', 'Suivi'], ['reponses', 'Réponses'], ['notes', 'Notes']];
    const mn = Math.min(...c.serie), mx = Math.max(...c.serie);
    const pts = c.serie.map((v, i) => [10 + i * (280 / (c.serie.length - 1)), 100 - ((v - mn) / (mx - mn || 1)) * 80]);
    const body = {
      apercu: `<div class="cs-stats"><div class="cs-stat"><small>Assiduité</small><b>${c.assiduite || '—'}${c.assiduite ? ' %' : ''}</b></div><div class="cs-stat"><small>Séances</small><b>${Math.round(c.assiduite / 4) || 0}</b></div><div class="cs-stat"><small>Dernière</small><b style="font-size:14px">${c.dernier}</b></div></div>
        <div class="cs-sec"><header>Objectif</header><input class="cs-inline" value="${esc(c.objectif)}" data-c="objectif" aria-label="Objectif"></div>
        <div class="cs-sec"><header>Prochaine séance</header><div class="cs-row" style="background:var(--cs-bg);border:1px solid var(--cs-line)"><span class="cs-time">Lun</span><span class="cs-row-main"><b>${c.programme.split('—')[0]}· séance suivante</b><small>10:00 · à domicile</small></span><button class="cs-btn">Ouvrir</button></div></div>
        ${c.statut === 'bad' ? '<div class="cs-propose" style="background:var(--cs-bad-s);border-color:rgba(242,139,139,.3)"><p>Douleur signalée mardi : lombaires 6/10<small>Après « Soulevé de terre roumain » · remplacer par « Pont fessier » ?</small></p><button class="cs-btn cs-btn--acc" data-act="swap-ex">Remplacer</button></div>' : ''}`,
      programme: `<div class="cs-sec"><header>${c.programme}</header>${['J1 · Bas du corps', 'J2 · Haut du corps', 'J3 · Mobilité + gainage'].map((j, i) => `<div class="cs-row" style="background:var(--cs-bg);border:1px solid var(--cs-line);margin-bottom:6px"><span class="cs-mono" style="width:22px">${i + 1}</span><span class="cs-row-main"><b>${j}</b><small>${[5, 4, 6][i]} exercices · ${[45, 40, 30][i]} min</small></span>${i === 0 ? '<span class="cs-pill cs-pill--ok">Fait</span>' : '<span class="cs-pill">À venir</span>'}</div>`).join('')}<a class="cs-btn" href="#/programmes" style="justify-self:start">${ic('list')} Ouvrir dans l'éditeur</a></div>`,
      suivi: `<div class="cs-chart"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--cs-ink-3)"><span>Mesure principale · 8 semaines</span><span class="cs-mono" style="color:var(--cs-ink)">${String(c.serie[0]).replace(".", ",")} → ${String(c.serie.at(-1)).replace(".", ",")}</span></div><svg viewBox="0 0 300 110" aria-label="Courbe de suivi"><path d="M10 100H290" stroke="rgba(255,255,255,.08)"/><path d="M10 60H290M10 20H290" stroke="rgba(255,255,255,.05)"/><path d="${pts.map((p, i) => (i ? 'L' : 'M') + p.join(' ')).join(' ')}" fill="none" stroke="#F2E27A" stroke-width="2" class="cs-line-draw"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#16171A" stroke="#F2E27A" stroke-width="1.5"/>`).join('')}</svg></div>
        <div class="cs-stats"><div class="cs-stat"><small>Forme moy.</small><b>7,4</b></div><div class="cs-stat"><small>Sommeil</small><b>6 h 50</b></div><div class="cs-stat"><small>Douleur</small><b>2/10</b></div></div>`,
      reponses: `<div class="cs-sec"><header>Check-in · lundi 2 nov.</header><div class="cs-answer"><small>Comment vous sentez-vous ?</small>Plutôt bien, un peu fatigué en fin de semaine.</div><div class="cs-answer"><small>Douleurs ?</small>${c.statut === 'bad' ? 'Bas du dos après la séance de mardi.' : 'Non.'}</div><div class="cs-answer"><small>Objectif de la semaine</small>Faire mes 2 séances seul·e.</div></div>
        <div class="cs-sec"><header>Questionnaire d'entrée</header><div class="cs-answer"><small>Antécédents</small>${c.objectif}</div></div>`,
      notes: `<div class="cs-sec"><header>Notes privées <span style="text-transform:none;letter-spacing:0">· jamais visibles du client</span></header><textarea class="cs-area is-private" rows="6" data-c="notes" aria-label="Notes privées">Préfère les séances le matin. Chien à la maison (prévoir le tapis). ${c.statut === 'bad' ? 'Éviter la flexion lombaire chargée jusqu\'à nouvel ordre.' : ''}</textarea></div>`,
    };
    openPanel(`<span class="cs-mono">${c.id}</span>${pillC(c)}`, `<div class="cs-client-head"><span class="cs-avatar">${c.ini}</span><div><h2 class="cs-h1" style="font-size:19px">${c.nom}</h2><span style="color:var(--cs-ink-3);font-size:13px"><span class="cs-num">${c.age}</span> ans · ${c.programme}</span></div></div>
      <div class="cs-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div><div id="cs-tabbody">${body[tab]}</div>`, 'client', true);
    $$('.cs-tr-like').forEach((r) => r.setAttribute('aria-selected', r.dataset.id === id));
    const P = $('#cs-panel-b');
    P.addEventListener('click', (ev) => { const t = ev.target.closest('[data-tab]'); if (t) openClient(id, t.dataset.tab); });
    P.addEventListener('input', (ev) => { if (ev.target.dataset.c) saving(); });
  }
  function afterClients() {
    const q = $('#cs-cq');
    q.addEventListener('input', () => { const v = q.value.toLowerCase(); $('#cs-clist').innerHTML = D.clients.filter((c) => c.nom.toLowerCase().includes(v)).map(crow).join(''); });
    q.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowDown') { ev.preventDefault(); $('.cs-tr-like') && $('.cs-tr-like').focus(); } if (ev.key === 'Enter') { const f = $('.cs-tr-like'); f && openClient(f.dataset.id); } });
  }

  /* ===== Éditeur de programme ===== */
  function progInit() {
    if (st.prog) return;
    st.prog = [
      { j: 'Lundi', t: 'Bas du corps', blocs: [{ type: 'Échauffement', ex: [['EX-070', '2 × 30 s'], ['EX-003', '2 × 12']] }, { type: 'Superset', ex: [['EX-014', '4 × 10'], ['EX-031', '4 × 10']] }, { type: 'Exercice', ex: [['EX-044', '3 × 12']] }] },
      { j: 'Mercredi', t: 'Haut du corps', blocs: [{ type: 'Exercice', ex: [['EX-052', '3 × 10']] }, { type: 'Circuit', tours: '3 tours', ex: [['EX-033', '12'], ['EX-008', '30 s'], ['EX-081', '15']] }] },
      { j: 'Vendredi', t: 'Mobilité + gainage', blocs: [{ type: 'Circuit', tours: '2 tours', ex: [['EX-025', '8 / côté'], ['EX-012', '40 s'], ['EX-070', '30 s']] }] },
    ];
  }
  const bclass = { Circuit: 'cs-block--circuit', Superset: 'cs-block--superset' };
  function programmes() {
    progInit();
    const total = st.prog.reduce((a, d) => a + d.blocs.reduce((b, bl) => b + bl.ex.length, 0), 0);
    return `<div class="cs-head"><div><h1 class="cs-h1">Reprise force · Fabien Morel</h1><p class="cs-sub">Programme <span class="cs-num">8</span> semaines · <span class="cs-num">3</span> séances/sem · <span class="cs-num" id="cs-total">${total}</span> exercices en semaine ${st.week}</p></div>
      <div class="cs-top-r"><span class="cs-save" id="cs-psave"><i></i>À jour</span><button class="cs-btn">${ic('users')} Assigner</button><button class="cs-btn cs-btn--acc" data-act="publish">Publier <span class="cs-kbd">Ctrl</span><span class="cs-kbd">↵</span></button></div></div>
    <div class="cs-weeks" role="group" aria-label="Semaines">${[1, 2, 3, 4, 5, 6, 7, 8].map((w) => `<button class="cs-chip" data-week="${w}" aria-pressed="${w === st.week}">S<span class="cs-num">${w}</span></button>`).join('')}<button class="cs-chip">${ic('plus')} Semaine</button></div>
    <div class="cs-editor">
      <aside class="cs-card cs-lib" aria-label="Bibliothèque"><header class="cs-card-h"><h2 class="cs-h2">${ic('dumbbell')} Bibliothèque</h2><span class="cs-mono" style="margin-left:auto;color:var(--cs-ink-3);font-size:12px">glisser →</span></header>
        <ul class="cs-rows">${D.exercices.map((e) => `<li class="cs-ex" draggable="true" data-lib="${e.id}" tabindex="0" aria-label="${esc(e.nom)} : Entrée pour ajouter au lundi">${thumb(e)}<span>${esc(e.nom)}</span><span class="cs-mono">${e.cat}</span></li>`).join('')}</ul></aside>
      <div class="cs-days">${st.prog.map((d, di) => `<section class="cs-day"><header class="cs-day-h"><b>${d.j}</b><span style="color:var(--cs-ink-3)">${d.t}</span><span class="cs-mono">~${d.blocs.reduce((a, b) => a + b.ex.length, 0) * 7} min</span></header>
        <div class="cs-blocks">${d.blocs.map((b, bi) => `<div class="cs-block ${bclass[b.type] || ''}" data-drop="${di}:${bi}"><div class="cs-block-h"><b>${b.type}</b>${b.tours ? `· ${b.tours}` : ''}<span class="cs-mono">${b.ex.length} ex.</span></div>
          ${b.ex.map(([id, dose], xi) => { const e = exo(id); return `<div class="cs-ex" draggable="true" data-pos="${di}:${bi}:${xi}" tabindex="0">${ic('grip', 'class="cs-i cs-grip"')}${thumb(e)}<span>${esc(e.nom)}</span><span class="cs-mono">${dose}</span></div>`; }).join('')}</div>`).join('')}
          <button class="cs-dropzone" data-drop="${di}:new" data-act="pick" data-day="${di}">${ic('plus', 'style="width:12px;height:12px;vertical-align:-1px"')} Ajouter un exercice <span class="cs-hint">· glisser, ou appui long au doigt</span></button></div></section>`).join('')}</div>
    </div>`;
  }
  function afterProg() {
    let drag = null;
    const V = $('#cs-view');
    V.addEventListener('dragstart', (ev) => { const el = ev.target.closest('[data-lib],[data-pos]'); if (!el) return; drag = el.dataset.lib ? { lib: el.dataset.lib } : { pos: el.dataset.pos }; el.classList.add('is-drag'); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', el.dataset.lib || el.dataset.pos); });
    V.addEventListener('dragend', (ev) => { ev.target.classList && ev.target.classList.remove('is-drag'); $$('.is-over').forEach((x) => x.classList.remove('is-over')); });
    V.addEventListener('dragover', (ev) => { const z = ev.target.closest('[data-drop]'); if (!z || !drag) return; ev.preventDefault(); $$('.is-over').forEach((x) => x !== z && x.classList.remove('is-over')); z.classList.add('is-over'); });
    V.addEventListener('drop', (ev) => { const z = ev.target.closest('[data-drop]'); if (!z || !drag) return; ev.preventDefault(); dropInto(z.dataset.drop, drag); drag = null; });
    V.addEventListener('keydown', (ev) => { const l = ev.target.closest('[data-lib]'); if (l && ev.key === 'Enter') { dropInto('0:new', { lib: l.dataset.lib }); } });
  }
  function bindTouchDrag() {
    const V = $('#cs-view'); let hold = null, ghost = null, src = null, over = null;
    const clear = () => { clearTimeout(hold); hold = null; };
    V.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse') return;
      const el = ev.target.closest('[data-pos],[data-lib]'); if (!el) return;
      const x0 = ev.clientX, y0 = ev.clientY;
      hold = setTimeout(() => {
        src = el; el.classList.add('is-drag'); navigator.vibrate && navigator.vibrate(10);
        ghost = el.cloneNode(true); ghost.className = 'cs-ex cs-ghost'; ghost.style.width = el.offsetWidth + 'px';
        document.body.appendChild(ghost); move(x0, y0); document.body.classList.add('cs-dragging');
      }, 280);
      const cancelIfScroll = (e2) => { if (!src && (Math.abs(e2.clientX - x0) > 8 || Math.abs(e2.clientY - y0) > 8)) clear(); };
      V.addEventListener('pointermove', cancelIfScroll, { once: false });
      const up = () => { clear(); V.removeEventListener('pointermove', cancelIfScroll); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); finish(); };
      document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });
    const move = (x, y) => {
      ghost.style.transform = `translate(${x - 24}px, ${y - 24}px)`;
      const z = document.elementFromPoint(x, y)?.closest('[data-drop]');
      if (z !== over) { over && over.classList.remove('is-over'); over = z; z && z.classList.add('is-over'); }
    };
    document.addEventListener('touchmove', (ev) => { if (!src) return; ev.preventDefault(); const t = ev.touches[0]; move(t.clientX, t.clientY); }, { passive: false });
    const finish = () => {
      if (!src) return;
      const s = src, z = over; src = null; over = null;
      ghost.remove(); ghost = null; s.classList.remove('is-drag'); document.body.classList.remove('cs-dragging');
      $$('.is-over').forEach((x) => x.classList.remove('is-over'));
      if (z) dropInto(z.dataset.drop, s.dataset.lib ? { lib: s.dataset.lib } : { pos: s.dataset.pos });
    };
  }
  function dropInto(target, drag) {
    const [di, bi] = target.split(':');
    let item;
    if (drag.lib) item = [drag.lib, '3 × 10'];
    else { const [a, b, c] = drag.pos.split(':').map(Number); item = st.prog[a].blocs[b].ex.splice(c, 1)[0]; if (!st.prog[a].blocs[b].ex.length) st.prog[a].blocs.splice(b, 1); }
    const day = st.prog[+di];
    if (bi === 'new' || !day.blocs[+bi]) day.blocs.push({ type: 'Exercice', ex: [item] }); else day.blocs[+bi].ex.push(item);
    render();
    const s = $('#cs-psave'); s.className = 'cs-save is-saved'; s.innerHTML = `${ic('check')}Enregistré`;
    const flashed = $$(`.cs-ex[data-pos^="${di}:"]`).filter((x) => exo(item[0]) && x.textContent.includes(exo(item[0]).nom)).pop();
    flashed && flashed.animate([{ background: 'rgba(242,226,122,.18)' }, { background: 'transparent' }], { duration: reduce() ? 1 : 700, easing: 'ease-out' });
  }

  const VIEWS = { dash, exercices, clients, programmes };
  const AFTER = { exercices: afterExercices, clients: afterClients, programmes: afterProg };

  /* ===== Palette de commandes ===== */
  let cmdItems = [], cmdIdx = 0, cmdPick = null;
  function cmdSource(q) {
    const items = [];
    const add = (group, label, icon, run, hint = '', keys = '') => items.push({ group, label, icon, run, hint, keys });
    if (cmdPick != null) {
      D.exercices.forEach((e) => add('Ajouter à ' + st.prog[cmdPick].j, e.nom, 'dumbbell', () => dropInto(cmdPick + ':new', { lib: e.id }), e.cat));
    } else {
      add('Actions', 'Nouvel exercice', 'plus', newExo, '', 'N');
      add('Actions', 'Nouvelle séance', 'plus', () => go('programmes'), '', 'S');
      add('Actions', 'Valider les vidéos proposées', 'video', () => { st.aValider = true; go('exercices'); }, `${D.exercices.filter((e) => e.video === 'proposee').length} en attente`);
      add('Aller à', 'Aujourd\'hui', 'home', () => go('dash'), '', 'G D');
      add('Aller à', 'Exercices', 'dumbbell', () => go('exercices'), '', 'G E');
      add('Aller à', 'Clients', 'users', () => go('clients'), '', 'G C');
      add('Aller à', 'Programmes', 'list', () => go('programmes'), '', 'G P');
      D.clients.forEach((c) => add('Clients', 'Ouvrir ' + c.nom.split(' ')[0] + ' ' + c.nom.split(' ').slice(1).join(' '), 'users', () => openClient(c.id), c.programme));
      D.exercices.forEach((e) => add('Exercices', e.nom, 'dumbbell', () => { if (st.route !== 'exercices') { location.hash = '#/exercices'; setTimeout(() => openExo(e.id), 30); } else openExo(e.id); }, e.cat + (e.video === 'proposee' ? ' · à valider' : '')));
    }
    const n = q.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    return n ? items.filter((i) => n.split(/\s+/).every((w) => norm(i.label + ' ' + i.hint).includes(w))) : items.filter((i) => i.group !== 'Exercices' || cmdPick != null).slice(0, 40);
  }
  function cmdRender() {
    const q = $('#cs-cmd-q').value; cmdItems = cmdSource(q); cmdIdx = Math.min(cmdIdx, Math.max(0, cmdItems.length - 1));
    let g = ''; const ul = $('#cs-cmd-list');
    ul.innerHTML = cmdItems.length ? cmdItems.map((it, i) => { const head = it.group !== g ? `<li class="cs-cmd-group" role="presentation">${it.group}</li>` : ''; g = it.group; return `${head}<li class="cs-cmd-item" role="option" id="cs-co-${i}" data-i="${i}" aria-selected="${i === cmdIdx}">${ic(it.icon)}<span>${esc(it.label)}</span><small>${esc(it.hint)}</small>${it.keys ? it.keys.split(' ').map((k) => `<span class="cs-kbd">${k}</span>`).join('') : ''}</li>`; }).join('') : '<li class="cs-empty">Rien trouvé. <span class="cs-kbd">↵</span> pour créer l\'exercice « ' + esc(q) + ' »</li>';
    $('#cs-cmd-q').setAttribute('aria-activedescendant', cmdItems.length ? 'cs-co-' + cmdIdx : '');
  }
  function cmdOpen(pick = null) {
    cmdPick = pick; cmdIdx = 0;
    $('#cs-cmd-q').value = ''; $('#cs-cmd-q').placeholder = pick != null ? 'Chercher un exercice à ajouter…' : 'Tapez une commande, un client, un exercice…';
    cmdRender();
    $('#cs-cmd').classList.add('is-open'); $('#cs-scrim').classList.add('is-open'); $('#cs-cmd').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#cs-cmd-q').focus(), 10);
  }
  function cmdClose() {
    $('#cs-cmd').classList.remove('is-open'); $('#cs-cmd').setAttribute('aria-hidden', 'true');
    if (!$('#cs-panel').classList.contains('is-open') || !mobile()) $('#cs-scrim').classList.remove('is-open');
  }
  const cmdIsOpen = () => $('#cs-cmd').classList.contains('is-open');
  function cmdRun(i) { const it = cmdItems[i]; const q = $('#cs-cmd-q').value; cmdClose(); if (it) it.run(); else if (q.trim() && cmdPick == null) newExo(q.trim()); }

  function newExo(nom) {
    const n = D.exercices.length + 1;
    const e = { id: 'EX-' + String(100 + n), nom: typeof nom === 'string' ? nom : 'Nouvel exercice', cat: 'Force', mP: [], mS: [], mat: [], niveau: 2, video: 'aucune', src: '', duree: '', consignes: '', erreurs: '', facile: '', dur: '', tempo: '2-0-2', repos: '60 s', notes: '', used: 0, h: Math.round(Math.random() * 360) };
    D.exercices.unshift(e);
    st.q = ''; st.cat = ''; st.mat = ''; st.muscle = ''; st.aValider = false;
    const doit = () => { renderList(false); const r = $(`.cs-tr-like[data-id="${e.id}"]`); r && r.classList.add('is-new'); openExo(e.id, { focusTitle: true }); };
    if (st.route !== 'exercices') { location.hash = '#/exercices'; setTimeout(doit, 40); } else doit();
  }

  /* ===== Clavier global ===== */
  let gPending = 0;
  const typing = (el) => el && (el.matches('input, textarea, select, [contenteditable]'));
  document.addEventListener('keydown', (ev) => {
    const k = ev.key;
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'k') { ev.preventDefault(); cmdIsOpen() ? cmdClose() : cmdOpen(); return; }
    if (cmdIsOpen()) {
      if (k === 'Escape') { ev.preventDefault(); cmdClose(); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') { ev.preventDefault(); cmdIdx = (cmdIdx + (k === 'ArrowDown' ? 1 : -1) + cmdItems.length) % Math.max(1, cmdItems.length); $$('.cs-cmd-item').forEach((x) => x.setAttribute('aria-selected', +x.dataset.i === cmdIdx)); const s = $(`#cs-co-${cmdIdx}`); s && s.scrollIntoView({ block: 'nearest' }); $('#cs-cmd-q').setAttribute('aria-activedescendant', 'cs-co-' + cmdIdx); }
      else if (k === 'Enter') { ev.preventDefault(); cmdRun(cmdIdx); }
      else if (k === 'Tab') ev.preventDefault();
      return;
    }
    if (k === 'Escape') { if (typing(ev.target) && ev.target.closest('#cs-panel')) { ev.target.blur(); $('#cs-panel').focus(); return; } if ($('#cs-panel').classList.contains('is-open')) { ev.preventDefault(); closePanel(); } return; }
    if (typing(ev.target)) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (gPending && Date.now() - gPending < 900) { gPending = 0; const m = { d: 'dash', e: 'exercices', c: 'clients', p: 'programmes' }[k.toLowerCase()]; if (m) { ev.preventDefault(); go(m); } return; }
    if (k === 'g') { gPending = Date.now(); return; }
    if (k === '/') { const f = $('#cs-q, #cs-cq'); if (f) { ev.preventDefault(); f.focus(); f.select(); } return; }
    if (k === 'n' || k === 'N') { ev.preventDefault(); newExo(); return; }
    if (k === 's' || k === 'S') { ev.preventDefault(); go('programmes'); return; }
    if ((k === 'v' || k === 'V') && st.panel && exo(st.panel) && exo(st.panel).video === 'proposee') { validate(true); return; }
    const onList = st.route === 'exercices' || st.route === 'clients';
    if (onList && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'j' || k === 'k')) {
      ev.preventDefault();
      if (st.route === 'clients') { const rows = $$('.cs-tr-like'); const cur = rows.findIndex((r) => r.dataset.id === (st.panel || st.sel)); const n = rows[Math.max(0, Math.min(rows.length - 1, cur + (k === 'ArrowDown' || k === 'j' ? 1 : -1)))]; if (!n) return; st.sel = n.dataset.id; rows.forEach((r) => r.tabIndex = r === n ? 0 : -1); n.focus(); if (st.panel) openClient(n.dataset.id); return; }
      step(k === 'ArrowDown' || k === 'j' ? 1 : -1); return;
    }
    if (k === 'Enter') { const r = ev.target.closest && ev.target.closest('.cs-tr-like'); if (r) { ev.preventDefault(); r.dataset.kind === 'client' ? openClient(r.dataset.id) : openExo(r.dataset.id); return; } const cr = ev.target.closest && ev.target.closest('[data-client],[data-go]'); if (cr) { ev.preventDefault(); cr.click(); } }
  });

  /* ===== Clics globaux ===== */
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const row = t.closest('.cs-tr-like');
    if (row && !t.closest('button, a')) { row.dataset.kind === 'client' ? openClient(row.dataset.id) : (st.panel === row.dataset.id && !mobile() ? closePanel() : openExo(row.dataset.id, { swap: !!st.panel })); return; }
    const a = t.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'cmd') cmdOpen();
      if (act === 'new-exo') newExo();
      if (act === 'new-seance') go('programmes');
      if (act === 'new-client') toast('Nouveau client · formulaire non maquetté');
      if (act === 'validate') validate(true);
      if (act === 'reject') validate(false);
      if (act === 'ask-claude') toast(`${ic('sparkle', 'style="color:var(--cs-info)"')} Demande envoyée à Claude · la vidéo arrivera « à valider »`);
      if (act === 'play') { const p = $('#cs-player'); const e = exo(st.panel); p.classList.add('is-playing'); if (e && e.yt) { const f = document.createElement('iframe'); f.className = 'cs-iframe'; f.src = `https://www.youtube-nocookie.com/embed/${e.yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1`; f.title = 'Vidéo : ' + e.nom; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; p.appendChild(f); } else p.classList.add('is-anim'); }
      if (act === 'reset') { st.q = ''; st.cat = ''; st.mat = ''; st.muscle = ''; st.aValider = false; render(); }
      if (act === 'confirm') { a.outerHTML = '<span class="cs-pill cs-pill--ok">Confirmée</span>'; toast(`${ic('check')} Réservation confirmée · e-mail envoyé`); }
      if (act === 'publish') toast(`${ic('check')} Programme publié · Fabien est prévenu`);
      if (act === 'swap-ex') toast(`${ic('check')} Remplacé dans la prochaine séance`);
      if (act === 'pick') { cmdOpen(+a.dataset.day); }
      return;
    }
    const v = t.closest('[data-vue]'); if (v) { st.vue = v.dataset.vue; $$('[data-vue]').forEach((b) => b.setAttribute('aria-pressed', b === v)); renderList(true); return; }
    const f = t.closest('[data-f]'); if (f) { st.aValider = !st.aValider; f.setAttribute('aria-pressed', st.aValider); renderList(true); return; }
    const c = t.closest('[data-cat]'); if (c) { st.cat = st.cat === c.dataset.cat ? '' : c.dataset.cat; $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === st.cat)); renderList(true); return; }
    const w = t.closest('[data-week]'); if (w) { st.week = +w.dataset.week; render(); return; }
    const cl = t.closest('[data-client]'); if (cl) { openClient(cl.dataset.client); return; }
    const g = t.closest('[data-go]'); if (g && !t.closest('a[href]')) { if (g.dataset.filter === 'aValider') st.aValider = true; go(g.dataset.go); return; }
    const ci = t.closest('.cs-cmd-item'); if (ci) { cmdRun(+ci.dataset.i); return; }
  });
  $('#cs-cmd-q').addEventListener('input', () => { cmdIdx = 0; cmdRender(); });
  $('#cs-scrim').addEventListener('click', () => { if (cmdIsOpen()) cmdClose(); else closePanel(); });
  $('#cs-close').addEventListener('click', () => closePanel());
  $('#cs-prev').addEventListener('click', () => step(-1));
  $('#cs-next').addEventListener('click', () => step(1));

  bindSheetDrag();
  bindTouchDrag();
  // Ouverture directe pour les captures : #/exercices?ex=EX-021 n'est pas utilisé ; on lit ?open=
  const params = new URLSearchParams(location.search);
  if (params.get('vue')) st.vue = params.get('vue');
  render();
  if (params.get('open')) { const id = params.get('open'); setTimeout(() => id.startsWith('C-') ? openClient(id, params.get('tab') || 'apercu') : openExo(id), 50); }
  if (params.get('cmd')) setTimeout(() => cmdOpen(), 50);
})();
