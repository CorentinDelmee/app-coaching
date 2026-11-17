/* d3 « Studio » — maquette statique cliquable. Aucune dépendance. */
(function () {
  'use strict';
  var D = window.ST_DATA, EX = D.EX = D.EXERCICES;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobile = window.matchMedia('(max-width: 900px)');
  var EASE = 'cubic-bezier(.32,.72,0,1)';
  var nomMuscle = {}; D.MUSCLES.forEach(function (m) { nomMuscle[m.id] = m.nom; });
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Figure animée (aperçu du mouvement) ---------- */
  function figure(mv) {
    var couche = mv === 'pompe' || mv === 'gainage';
    var corps = couche
      ? '<g class="tout"><circle class="tete" cx="22" cy="58" r="7"/><path class="os" d="M29 62 L80 72"/><g class="bras"><path class="os" d="M34 63 L34 84"/></g><path class="os" d="M80 72 L88 86"/></g>'
      : '<g class="tout"><g class="haut"><circle class="tete" cx="50" cy="20" r="7.5"/><path class="os" d="M50 30 L50 62"/><g class="bras"><path class="os" d="M50 38 L42 56 M50 38 L58 56"/></g></g><g class="bas"><path class="os" d="M50 62 L43 89 M50 62 L57 89"/></g></g>';
    return '<svg class="st-fig" data-mv="' + mv + '" viewBox="0 0 100 100" aria-hidden="true"><path class="sol" d="M14 93 H86"/>' + corps + '</svg>';
  }
  function media(e) {
    var img = e.photo ? '<img src="' + e.photo + '" alt="">' : figure(e.mv);
    var statut = e.video === 'propose' ? '<span class="st-puce st-puce--propose"><i></i>À valider</span>' : (e.video === 'aucune' && !e.photo ? '<span class="st-puce st-puce--neutre">Sans vidéo</span>' : '');
    var lecture = e.video !== 'aucune' ? '<span class="st-lecture"><svg><use href="#i-play"/></svg></span><span class="st-duree">' + e.duree + '</span>' : '';
    return img + statut + lecture;
  }

  /* ---------- Toast ---------- */
  var toastT;
  function toast(txt, action) {
    var t = $('#st-toast');
    t.innerHTML = esc(txt) + (action ? ' <button type="button">' + esc(action.label) + '</button>' : '');
    if (action) t.querySelector('button').onclick = function () { action.fn(); t.classList.remove('is-vu'); };
    t.classList.add('is-vu'); clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('is-vu'); }, 3200);
  }
  document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-toast]'); if (b) toast(b.dataset.toast); });

  /* ---------- Exercices : filtres ---------- */
  var etat = { q: '', muscle: null, propose: false, materiel: '', categorie: '', affichage: 'grille', liste: EX, ouvert: null };
  function compteProposes() { var n = EX.filter(function (e) { return e.video === 'propose'; }).length; $$('[data-n-propose]').forEach(function (s) { s.textContent = n; s.hidden = !n; }); return n; }
  function rendreFiltres() {
    var h = '<button type="button" class="st-filtre" aria-pressed="' + (!etat.muscle && !etat.propose) + '" data-f="tous">Tous <span class="st-n">' + EX.length + '</span></button>';
    h += '<button type="button" class="st-filtre st-filtre--propose" aria-pressed="' + etat.propose + '" data-f="propose"><span class="st-dot" style="background:#E0B400"></span>Vidéo à valider <span class="st-n">' + compteProposes() + '</span></button>';
    D.MUSCLES.forEach(function (m) {
      var n = EX.filter(function (e) { return e.muscle === m.id; }).length;
      h += '<button type="button" class="st-filtre" data-m="' + m.id + '" data-f="' + m.id + '" aria-pressed="' + (etat.muscle === m.id) + '"><span class="st-dot"></span>' + m.nom + ' <span class="st-n">' + n + '</span></button>';
    });
    $('#st-filtres').innerHTML = h;
  }
  (function () {
    var cats = {}; EX.forEach(function (e) { cats[e.categorie] = 1; });
    $('#st-categorie').insertAdjacentHTML('beforeend', Object.keys(cats).map(function (c) { return '<option>' + c + '</option>'; }).join(''));
    $('#st-materiel').insertAdjacentHTML('beforeend', D.MATERIELS.map(function (c) { return '<option>' + c + '</option>'; }).join(''));
  })();
  $('#st-filtres').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-f]'); if (!b) return;
    var f = b.dataset.f;
    if (f === 'tous') { etat.muscle = null; etat.propose = false; }
    else if (f === 'propose') etat.propose = !etat.propose;
    else etat.muscle = etat.muscle === f ? null : f;
    rendreFiltres(); rendreGrille(true);
  });
  $('#st-q').addEventListener('input', function () { etat.q = this.value; rendreGrille(true); });
  $('#st-materiel').addEventListener('change', function () { etat.materiel = this.value; rendreGrille(true); });
  $('#st-categorie').addEventListener('change', function () { etat.categorie = this.value; rendreGrille(true); });
  $$('[data-affichage]').forEach(function (b) {
    b.addEventListener('click', function () {
      etat.affichage = b.dataset.affichage;
      $$('[data-affichage]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      rendreGrille(true);
    });
  });
  function normal(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function filtrer() {
    var q = normal(etat.q.trim());
    return EX.filter(function (e) {
      if (etat.muscle && e.muscle !== etat.muscle && e.secondaires.indexOf(etat.muscle) < 0) return false;
      if (etat.propose && e.video !== 'propose') return false;
      if (etat.materiel && e.materiel !== etat.materiel) return false;
      if (etat.categorie && e.categorie !== etat.categorie) return false;
      if (q && normal(e.nom + ' ' + nomMuscle[e.muscle] + ' ' + e.materiel + ' ' + e.categorie).indexOf(q) < 0) return false;
      return true;
    });
  }
  function carteHTML(e) {
    return '<li><button type="button" class="st-carte" data-m="' + e.muscle + '" data-id="' + e.id + '" aria-current="' + (etat.ouvert === e.id) + '">' +
      '<div class="st-carte-media">' + media(e) + '</div>' +
      '<div class="st-carte-corps"><p class="st-carte-nom">' + esc(e.nom) + '</p><div class="st-carte-meta"><span class="st-dot"></span>' + nomMuscle[e.muscle] + ' · ' + e.materiel + '</div>' +
      '</div><div class="st-carte-fin">' + (e.video === 'propose' ? '<span class="st-puce st-puce--propose"><i></i>À valider</span>' : '') + '<span class="st-puce st-puce--neutre">' + e.niveau + '</span></div></button></li>';
  }
  function rendreGrille(anime) {
    var g = $('#st-grille');
    etat.liste = filtrer();
    g.classList.toggle('is-liste', etat.affichage === 'liste');
    var max = etat.liste.length;
    g.innerHTML = etat.liste.map(carteHTML).join('') || '<li class="st-vide" style="grid-column:1/-1;min-height:140px">Aucun exercice ne correspond. Essaie un autre mot ou retire un filtre.</li>';
    $('#st-compte').innerHTML = '<span><b>' + max + '</b> exercice' + (max > 1 ? 's' : '') + (max < EX.length ? ' sur ' + EX.length : '') + '</span>';
    if (anime && !reduit.matches) {
      $$('.st-carte', g).slice(0, 16).forEach(function (c, i) {
        c.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: i * 18, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      });
    }
  }

  /* appui long (téléphone) : l'aperçu s'anime sans ouvrir */
  var appui = null, appuiLong = false;
  $('#st-grille').addEventListener('pointerdown', function (ev) {
    var c = ev.target.closest('.st-carte'); if (!c || ev.pointerType === 'mouse') return;
    appuiLong = false;
    appui = setTimeout(function () { appuiLong = true; c.classList.add('is-joue'); if (navigator.vibrate) navigator.vibrate(8); }, 380);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
    $('#st-grille').addEventListener(t, function () { clearTimeout(appui); $$('.st-carte.is-joue').forEach(function (c) { c.classList.remove('is-joue'); }); }, true);
  });
  $('#st-grille').addEventListener('contextmenu', function (ev) { if (ev.target.closest('.st-carte')) ev.preventDefault(); });
  $('#st-grille').addEventListener('click', function (ev) {
    var c = ev.target.closest('.st-carte'); if (!c) return;
    if (appuiLong) { appuiLong = false; return; }
    ouvrir(+c.dataset.id, c);
  });

  /* ---------- Panneau d'édition ---------- */
  var pan = $('#st-panneau'), voile = $('#st-voile'), zone = $('#st-ex-zone');
  function trouve(id) { for (var i = 0; i < EX.length; i++) if (EX[i].id === id) return EX[i]; }
  function panHTML(e) {
    var jM = D.MUSCLES.map(function (m) { return '<button type="button" class="st-jeton" data-m="' + m.id + '" data-principal="' + m.id + '" aria-pressed="' + (e.muscle === m.id) + '">' + m.nom + '</button>'; }).join('');
    var jS = D.MUSCLES.map(function (m) { return '<button type="button" class="st-jeton" data-m="' + m.id + '" data-second="' + m.id + '" aria-pressed="' + (e.secondaires.indexOf(m.id) > -1) + '">' + m.nom + '</button>'; }).join('');
    var mat = D.MATERIELS.map(function (m) { return '<option' + (m === e.materiel ? ' selected' : '') + '>' + m + '</option>'; }).join('');
    var niv = D.NIVEAUX.map(function (n) { return '<button type="button" data-niveau="' + n + '" aria-pressed="' + (e.niveau === n) + '">' + n + '</button>'; }).join('');
    var statut = e.video === 'propose' ? '<span class="st-puce st-puce--propose"><i></i>Vidéo proposée par Claude</span>' : e.video === 'valide' ? '<span class="st-puce st-puce--ok"><i></i>Vidéo validée</span>' : '<span class="st-puce st-puce--neutre">Aucune vidéo</span>';
    return '<div class="st-pan-poignee" aria-hidden="true"></div>' +
      '<div class="st-pan-media" data-m="' + e.muscle + '" id="st-pan-media">' + (e.photo ? '<img src="' + e.photo + '" alt="Photo de l\'exercice">' : figure(e.mv)) +
        '<div class="st-pan-barre"><button type="button" class="st-btn st-btn--rond" data-act="fermer" aria-label="Fermer (Échap)"><svg><use href="#i-fermer"/></svg></button>' +
        '<button type="button" class="st-btn st-btn--rond" data-act="prec" aria-label="Exercice précédent (flèche haut)"><svg><use href="#i-haut"/></svg></button>' +
        '<button type="button" class="st-btn st-btn--rond" data-act="suiv" aria-label="Exercice suivant (flèche bas)"><svg><use href="#i-bas"/></svg></button>' +
        '<span class="st-sauve" id="st-sauve" aria-live="polite"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Enregistré</span></div>' +
        (e.video !== 'aucune' ? '<button type="button" class="st-btn st-lire" data-act="lire"><svg width="14" height="14"><use href="#i-play"/></svg>Lire l\'aperçu · ' + e.duree + '</button>' : '') +
      '</div>' +
      '<div class="st-pan-defile">' +
        '<div><label class="st-sr" for="st-pan-nom">Nom de l\'exercice</label><textarea id="st-pan-nom" class="st-nom-champ" rows="1" data-champ="nom">' + esc(e.nom) + '</textarea>' +
        '<div class="st-statut">' + statut + '<span class="st-puce st-puce--m" data-m="' + e.muscle + '">' + nomMuscle[e.muscle] + '</span>' + (normal(e.categorie) === normal(nomMuscle[e.muscle]) ? '' : '<span class="st-puce st-puce--neutre">' + e.categorie + '</span>') + '</div></div>' +
        (e.video === 'propose' ? '<div class="st-valider"><p><b>Claude a proposé cette vidéo</b> hier à 22 h 14 (YouTube, ' + e.duree + '). Vérifie qu\'elle montre la bonne exécution.</p><button type="button" class="st-btn st-btn--encre" data-act="valider">Valider</button></div>' : '') +
        '<div class="st-chiffres"><label class="st-chiffre"><span>Tempo</span><input data-champ="tempo" value="' + e.tempo + '"></label><label class="st-chiffre"><span>Repos (s)</span><input data-champ="repos" inputmode="numeric" value="' + e.repos + '"></label><div class="st-chiffre"><span>Niveau</span><b>' + e.niveau.slice(0, 5) + '.</b></div></div>' +
        '<div class="st-utilise"><b>' + e.seances + '</b> séance' + (e.seances > 1 ? 's' : '') + ' utilisent cet exercice<a href="#/programme" class="st-btn st-btn--fantome" style="margin-left:auto">Voir</a></div>' +
        '<section class="st-section"><h3>Média</h3>' +
          '<div class="st-champ"><label for="st-yt">Lien de la vidéo YouTube</label><input id="st-yt" data-champ="yt" value="' + (e.video === 'aucune' ? '' : 'https://youtu.be/exemple' + e.id) + '" placeholder="Coller un lien YouTube"></div>' +
          '<div class="st-depot" id="st-depot"><svg><use href="#i-photo"/></svg><div><b>' + (e.photo ? 'Remplacer la photo' : 'Ajouter une photo') + '</b><br>Glisse une image ici ou <label for="st-fichier">choisis un fichier</label></div><input type="file" id="st-fichier" accept="image/*" class="st-sr"></div></section>' +
        '<section class="st-section"><h3>Classement</h3>' +
          '<div class="st-champ"><span class="st-lab">Muscle principal</span><div class="st-jetons">' + jM + '</div></div>' +
          '<div class="st-champ"><span class="st-lab">Muscles secondaires</span><div class="st-jetons">' + jS + '</div></div>' +
          '<div class="st-deux"><div class="st-champ"><label for="st-mat">Matériel</label><select id="st-mat" data-champ="materiel">' + mat + '</select></div>' +
          '<div class="st-champ"><label for="st-cat">Catégorie</label><input id="st-cat" data-champ="categorie" value="' + e.categorie + '"></div></div>' +
          '<div class="st-champ"><span class="st-lab">Niveau</span><div class="st-niveau">' + niv + '</div></div></section>' +
        '<section class="st-section"><h3>Exécution</h3>' +
          '<div class="st-champ"><label for="st-cons">Consignes d\'exécution</label><textarea id="st-cons" data-champ="consignes">' + esc(e.consignes) + '</textarea></div>' +
          '<div class="st-champ"><label for="st-err">Erreurs fréquentes</label><textarea id="st-err" data-champ="erreurs">' + esc(e.erreurs) + '</textarea></div>' +
          '<div class="st-deux"><div class="st-champ"><label for="st-fac">Plus facile</label><input id="st-fac" data-champ="facile" value="' + esc(e.facile) + '"></div>' +
          '<div class="st-champ"><label for="st-dur">Plus dur</label><input id="st-dur" data-champ="dur" value="' + esc(e.dur) + '"></div></div></section>' +
        '<section class="st-section"><h3>Notes privées</h3><div class="st-champ"><label for="st-notes" class="st-sr">Notes privées</label><textarea id="st-notes" class="st-prive" data-champ="notes" placeholder="Visible par toi seul : ex. éviter avec Bernard (genou).">' + esc(e.notes) + '</textarea></div></section>' +
      '</div>';
  }
  function ytId(u) { var r = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})(?![\w-])/.exec(u || ''); return r ? r[1] : null; }
  var courant = null, sauveT;
  function sauver() {
    var s = $('#st-sauve'); if (!s) return;
    s.className = 'st-sauve is-encours'; s.innerHTML = '<i></i>Enregistrement…';
    clearTimeout(sauveT);
    sauveT = setTimeout(function () {
      s.className = 'st-sauve is-ok';
      s.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Enregistré';
      majCarte(courant);
    }, 650);
  }
  function majCarte(e) {
    var c = $('.st-carte[data-id="' + e.id + '"]'); if (!c) return;
    var li = c.parentNode, tmp = document.createElement('div'); tmp.innerHTML = carteHTML(e);
    li.replaceWith(tmp.firstChild);
  }
  pan.addEventListener('input', function (ev) {
    var f = ev.target.dataset.champ; if (!f || !courant) return;
    courant[f] = f === 'repos' ? +ev.target.value || 0 : ev.target.value; sauver();
  });
  pan.addEventListener('change', function (ev) { if (ev.target.id === 'st-fichier' && ev.target.files[0]) photo(ev.target.files[0]); });
  pan.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b || !courant) return;
    var a = b.dataset.act;
    if (a === 'fermer') fermer();
    else if (a === 'prec') voisin(-1);
    else if (a === 'suiv') voisin(1);
    else if (a === 'lire' && ytId(($('#st-yt') || {}).value)) {
      /* vraie vidéo : lecteur youtube-nocookie chargé seulement au clic */
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + ytId($('#st-yt').value) + '?autoplay=1&rel=0';
      f.title = 'Vidéo : ' + courant.nom; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
      $('#st-pan-media').appendChild(f); b.remove();
    }
    else if (a === 'lire') { var m = $('#st-pan-media'); var j = m.classList.toggle('is-joue'); b.lastChild.textContent = j ? 'Pause · aperçu en lecture' : 'Lire l\'aperçu · ' + courant.duree; }
    else if (a === 'valider') {
      courant.video = 'valide'; var box = b.closest('.st-valider');
      box.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: reduit.matches ? 1 : 220, easing: 'ease-out' }).onfinish = function () { remplirPanneau(courant, false); };
      majCarte(courant); rendreFiltres(); sauver(); toast('Vidéo validée', { label: 'Annuler', fn: function () { courant.video = 'propose'; remplirPanneau(courant, false); majCarte(courant); rendreFiltres(); } });
    } else if (b.dataset.principal) {
      courant.muscle = b.dataset.principal; $$('[data-principal]', pan).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      $('#st-pan-media').dataset.m = courant.muscle; sauver();
    } else if (b.dataset.second) {
      var i = courant.secondaires.indexOf(b.dataset.second);
      if (i > -1) courant.secondaires.splice(i, 1); else courant.secondaires.push(b.dataset.second);
      b.setAttribute('aria-pressed', i < 0); sauver();
    } else if (b.dataset.niveau) {
      courant.niveau = b.dataset.niveau; $$('[data-niveau]', pan).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); sauver();
    }
  });
  ['dragenter', 'dragover'].forEach(function (t) { pan.addEventListener(t, function (ev) { var d = $('#st-depot'); if (!d) return; ev.preventDefault(); d.classList.add('is-survol'); }); });
  pan.addEventListener('dragleave', function (ev) { var d = $('#st-depot'); if (d && !pan.contains(ev.relatedTarget)) d.classList.remove('is-survol'); });
  pan.addEventListener('drop', function (ev) { ev.preventDefault(); var f = ev.dataTransfer.files[0]; $('#st-depot').classList.remove('is-survol'); if (f && /^image\//.test(f.type)) photo(f); });
  function photo(f) {
    courant.photo = URL.createObjectURL(f);
    var m = $('#st-pan-media'), img = new Image(); img.src = courant.photo; img.alt = 'Photo de l\'exercice';
    var fig = $('.st-fig', m); if (fig) fig.remove(); var old = $('img', m); if (old) old.remove();
    m.insertBefore(img, m.firstChild);
    if (!reduit.matches) img.animate([{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
    sauver(); toast('Photo ajoutée');
  }
  function remplirPanneau(e, cascade) {
    pan.dataset.m = e.muscle; pan.innerHTML = panHTML(e);
    if (!cascade) $$('.st-pan-defile > *', pan).forEach(function (x) { x.style.animation = 'none'; });
  }

  function ouvrir(id, carte, sansAnim) {
    var e = trouve(id); if (!e) return;
    var dejaOuvert = !!courant;
    var depart = carte ? $('.st-carte-media', carte).getBoundingClientRect() : null;
    courant = e; etat.ouvert = id;
    $$('.st-carte[aria-current="true"]').forEach(function (c) { c.setAttribute('aria-current', 'false'); });
    if (carte) carte.setAttribute('aria-current', 'true');
    remplirPanneau(e, !dejaOuvert);
    pan.hidden = false;
    if (history.replaceState) history.replaceState(null, '', '#/exercices/' + id);
    var anim = !reduit.matches && !sansAnim;
    if (mobile.matches) {
      document.body.style.overflow = 'hidden';
      voile.classList.add('is-vu');
      if (!dejaOuvert) {
        pan.classList.add('is-glisse', 'is-vu'); void pan.offsetHeight;
        var cible = $('#st-pan-media').getBoundingClientRect();
        pan.classList.remove('is-vu'); void pan.offsetHeight; pan.classList.remove('is-glisse');
        requestAnimationFrame(function () { pan.classList.add('is-vu'); });
        if (anim && depart) volant(e, depart, cible, 500);
      }
    } else {
      zone.classList.add('is-ouvert'); zone.parentNode.classList.add('is-panneau');
      if (anim && depart && !dejaOuvert) {
        volant(e, depart, $('#st-pan-media').getBoundingClientRect(), 520);
        pan.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
      } else if (anim && dejaOuvert) {
        $('#st-pan-media').animate([{ opacity: .4 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      }
      if (carte) carte.scrollIntoView({ block: 'nearest', behavior: anim ? 'smooth' : 'auto' });
    }
    if (!dejaOuvert) setTimeout(function () { var f = $('[data-act="fermer"]', pan); if (f) f.focus({ preventScroll: true }); }, 30);
  }
  /* élément partagé : la vignette s'envole vers l'en-tête du panneau */
  function volant(e, a, b, duree) {
    var m = $('#st-pan-media'), v = document.createElement('div');
    v.className = 'st-volant'; v.dataset.m = e.muscle;
    v.innerHTML = e.photo ? '<img src="' + e.photo + '" alt="" style="width:100%;height:100%;object-fit:cover">' : figure(e.mv);
    v.style.cssText = 'left:' + b.left + 'px;top:' + b.top + 'px;width:' + b.width + 'px;height:' + b.height + 'px';
    document.body.appendChild(v);
    m.style.visibility = 'hidden';
    v.style.transformOrigin = '0 0';
    var sc = a.width / b.width, dy = a.top - b.top + (a.height - b.height * sc) / 2; /* échelle uniforme : pas d'étirement, centré sur la vignette */
    var k = v.animate([
      { transform: 'translate(' + (a.left - b.left) + 'px,' + dy + 'px) scale(' + sc + ')', borderRadius: (20 / sc) + 'px', opacity: 0 },
      { opacity: 1, offset: .22 },
      { transform: 'none', opacity: 1, borderRadius: mobile.matches ? '26px 26px 0 0' : '28px 28px 0 0' }
    ], { duration: duree, easing: EASE, fill: 'both' });
    k.onfinish = function () { m.style.visibility = ''; v.remove(); };
  }
  function fermer() {
    if (!courant) return;
    var id = courant.id; courant = null; etat.ouvert = null;
    var fin = function () { pan.hidden = true; zone.classList.remove('is-ouvert'); zone.parentNode.classList.remove('is-panneau'); var c = $('.st-carte[data-id="' + id + '"]'); if (c) { c.setAttribute('aria-current', 'false'); c.focus({ preventScroll: true }); } };
    if (history.replaceState) history.replaceState(null, '', '#/exercices');
    if (mobile.matches) {
      pan.classList.remove('is-vu'); voile.classList.remove('is-vu'); pan.style.transform = '';
      document.body.style.overflow = '';
      setTimeout(fin, reduit.matches ? 0 : 480);
    } else if (!reduit.matches) {
      pan.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(20px)' }], { duration: 200, easing: 'ease-in' }).onfinish = fin;
    } else fin();
  }
  function voisin(d) {
    var l = etat.liste, i = -1;
    for (var k = 0; k < l.length; k++) if (courant && l[k].id === courant.id) i = k;
    var n = l[Math.max(0, Math.min(l.length - 1, i + d))]; if (!n || n === courant) return;
    var c = $('.st-carte[data-id="' + n.id + '"]');
    ouvrir(n.id, c);
  }
  voile.addEventListener('click', function () { if (courant) fermer(); if (clientCourant) fermerFiche(); });

  /* feuille basse glissable (téléphone) */
  function glissable(el, surFermer) {
    var y0 = null, dy = 0, t0 = 0;
    el.addEventListener('pointerdown', function (ev) {
      if (!mobile.matches || !ev.target.closest('.st-pan-poignee, .st-pan-media, .st-fiche-tete')) return;
      if (ev.target.closest('button, input, a')) return;
      y0 = ev.clientY; dy = 0; t0 = Date.now(); el.classList.add('is-glisse'); el.setPointerCapture(ev.pointerId);
    });
    el.addEventListener('pointermove', function (ev) {
      if (y0 === null) return; dy = Math.max(0, ev.clientY - y0);
      el.style.transform = 'translateY(' + dy + 'px)'; voile.style.opacity = String(1 - dy / 600);
    });
    function fin() {
      if (y0 === null) return; y0 = null; el.classList.remove('is-glisse'); voile.style.opacity = '';
      var v = dy / Math.max(1, Date.now() - t0);
      el.style.transform = '';
      if (dy > 140 || v > .6) surFermer();
    }
    el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
  }
  glissable(pan, fermer);

  /* clavier : / cherche, flèches haut/bas changent d'exercice, Échap ferme */
  document.addEventListener('keydown', function (ev) {
    if (vue !== 'exercices') { if (ev.key === 'Escape' && clientCourant) fermerFiche(); return; }
    var champ = ev.target.closest('input, textarea, select');
    if (ev.key === '/' && !champ) { ev.preventDefault(); $('#st-q').focus(); return; }
    if (ev.key === 'Escape') { if (courant) { ev.preventDefault(); fermer(); } else if (ev.target === $('#st-q')) { $('#st-q').value = ''; etat.q = ''; rendreGrille(); } return; }
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && (!champ || ev.target === $('#st-q'))) {
      var d = ev.key === 'ArrowDown' ? 1 : -1;
      if (courant) { ev.preventDefault(); voisin(d); return; }
      var cartes = $$('.st-carte'), i = cartes.indexOf(document.activeElement);
      if (!cartes.length) return; ev.preventDefault();
      var cols = etat.affichage === 'liste' ? 1 : Math.max(1, Math.round($('#st-grille').clientWidth / cartes[0].offsetWidth));
      var n = cartes[i < 0 ? 0 : Math.max(0, Math.min(cartes.length - 1, i + d * cols))]; n.focus();
    }
    if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && !champ && !courant && document.activeElement.classList.contains('st-carte')) {
      var cs = $$('.st-carte'), j = cs.indexOf(document.activeElement), dd = ev.key === 'ArrowRight' ? 1 : -1;
      if (cs[j + dd]) { ev.preventDefault(); cs[j + dd].focus(); }
    }
  });

  /* ---------- Tableau de bord ---------- */
  function rendreAccueil() {
    var S = [['8 h 30', 'Bernard Lefèvre', 'Équilibre · 45 min · à domicile', 'mobilite'], ['10 h 00', 'Sophie Garnier', 'Renfo dos · 60 min', 'dos'], ['14 h 00', 'Hélène Marchal', 'Remise en forme S3 · J2', 'jambes', 1], ['17 h 30', 'Julien Perrot', 'Fractionné côtes · 50 min', 'cardio'], ['19 h 00', 'Cours collectif', 'Mobilité douce · 8 inscrits', 'gainage']];
    $('#st-timeline').innerHTML = S.map(function (s) { return '<li class="st-seance' + (s[4] ? ' is-maintenant' : '') + '" data-m="' + s[3] + '"><time>' + s[0] + '</time><span class="st-barre"></span><div><b>' + s[1] + '</b><small>' + s[2] + '</small></div><a class="st-btn st-btn--fantome" href="#/clients">Ouvrir</a></li>'; }).join('');
    var props = EX.filter(function (e) { return e.video === 'propose'; }).slice(0, 3);
    $('#st-claude').innerHTML = props.map(function (e) { return '<li data-m="' + e.muscle + '"><i>' + figure(e.mv) + '</i><div>' + esc(e.nom) + '<small>Vidéo proposée · à valider</small></div></li>'; }).join('') + '<li><i style="background:#3A3D44"></i><div>Séance « Hélène S3 J2 » créée<small>à partir de ta dictée de 21 h 40</small></div></li>';
    $('#st-alertes').innerHTML = [['mobilite', 'BL', 'Bernard : douleur genou', 'Signalée hier après la séance'], ['epaules', 'MR', 'Monique : 12 jours sans séance', 'Proposer un créneau'], ['pecs', 'PV', 'Pierre : bilan à prévoir', 'Fin du cycle 1']].map(function (a) { return '<li><span class="st-av" data-m="' + a[0] + '" style="--t:36px">' + a[1] + '</span><div>' + a[2] + '<small>' + a[3] + '</small></div><span class="st-puce st-puce--alerte"><i></i></span></li>'; }).join('');
    $('#st-checkins').innerHTML = [['dos', 'SG', 'Sophie Garnier', 'Sommeil bon, motivée', '8/10'], ['gainage', 'CD', 'Claire Dumas', 'Un peu raide le matin', '6/10'], ['bras', 'KB', 'Karim Benali', 'Semaine chargée', '5/10']].map(function (a) { return '<li><span class="st-av" data-m="' + a[0] + '" style="--t:36px">' + a[1] + '</span><div>' + a[2] + '<small>' + a[3] + '</small></div><span class="st-humeur">' + a[4] + '</span></li>'; }).join('');
    $('#st-resa').innerHTML = [['bras', 'KB', 'Karim Benali', 'Ven. 6 nov. · 9 h 00'], ['jambes', 'NL', 'Nadia Lopez (essai)', 'Sam. 7 nov. · 10 h 30']].map(function (a) { return '<li><span class="st-av" data-m="' + a[0] + '" style="--t:36px">' + a[1] + '</span><div>' + a[2] + '<small>' + a[3] + '</small></div><button type="button" class="st-btn" data-toast="Réservation confirmée (maquette)">Confirmer</button></li>'; }).join('');
  }

  /* ---------- Clients ---------- */
  var fiche = $('#st-fiche'), clientCourant = null;
  function anneau(p) { var c = 2 * Math.PI * 26; return '<svg viewBox="0 0 56 56" aria-hidden="true"><circle class="fond" cx="28" cy="28" r="26"/><circle class="val" cx="28" cy="28" r="26" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg>'; }
  function rendreClients() {
    $('#st-cl-sous').textContent = D.CLIENTS.length + ' clients suivis · 3 demandent ton attention';
    $('#st-clients').innerHTML = D.CLIENTS.map(function (c) {
      return '<li><button type="button" class="st-client" data-cl="' + c.id + '" data-m="' + c.m + '" aria-current="' + (clientCourant && clientCourant.id === c.id) + '"><span class="st-av">' + anneau(c.prog) + c.ini + '</span><div><b>' + c.nom + '</b><small>' + c.suivi + '</small><small>' + c.info + '</small></div><span class="st-puce st-puce--neutre">' + c.prog + ' %</span></button></li>';
    }).join('');
  }
  function courbe(seed) {
    var pts = [], w = 560, h = 170, n = 10;
    for (var i = 0; i < n; i++) pts.push([30 + i * (w - 50) / (n - 1), 140 - (i * 9 + ((seed * (i + 3)) % 17)) ]);
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(0) + ' ' + p[1].toFixed(0); }).join(' ');
    var lab = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];
    return '<svg class="st-courbe" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Progression de la charge sur 10 semaines, en hausse"><path class="grille" d="M30 40H550M30 90H550M30 140H550"/>' +
      '<path class="aire" d="' + d + ' L' + pts[n - 1][0].toFixed(0) + ' 150 L30 150Z"/><path class="ligne" d="' + d + '"/>' +
      pts.map(function (p, i) { return i % 3 === 0 || i === n - 1 ? '<text x="' + (p[0] - 8).toFixed(0) + '" y="165">' + lab[i] + '</text>' : ''; }).join('') + '</svg>';
  }
  var ONGLETS = ['Aperçu', 'Programme', 'Suivi', 'Réponses', 'Notes privées'];
  function contenuOnglet(c, o) {
    if (o === 0) return '<div class="st-kpis"><div class="st-kpi"><span>Assiduité</span><b>' + c.prog + ' %</b><small>+6 pts</small></div><div class="st-kpi"><span>Séances</span><b>' + (c.id * 4 + 6) + '</b></div><div class="st-kpi"><span>Forme moy.</span><b>7,2</b></div><div class="st-kpi"><span>Prochaine</span><b style="font-size:18px">Auj. 14 h</b></div></div><h3 style="margin:0 0 6px;font-size:14px;color:var(--st-doux)">Charge du assis-debout (répétitions)</h3>' + courbe(c.id + 2);
    if (o === 1) return '<p style="margin-top:0"><b>Remise en forme — 6 semaines</b> · semaine 3 sur 6</p><div class="st-kpis" style="grid-template-columns:repeat(3,1fr)"><div class="st-kpi"><span>Lundi</span><b style="font-size:17px">Jambes + équilibre</b></div><div class="st-kpi"><span>Mercredi</span><b style="font-size:17px">Haut du corps</b></div><div class="st-kpi"><span>Vendredi</span><b style="font-size:17px">Circuit doux</b></div></div><a class="st-btn st-btn--encre" href="#/programme">Ouvrir l\'éditeur</a>';
    if (o === 2) return courbe(c.id * 3) + '<p style="color:var(--st-doux)">Poids stable (−1,2 kg en 8 sem.) · tour de taille −3 cm · test 6 min de marche : 410 m → 465 m.</p>';
    if (o === 3) return [['Questionnaire de départ · 12 oct.', 'Objectif : remonter les escaliers sans s\'arrêter.'], ['Check-in · 3 nov.', 'Forme 7/10, petites courbatures aux cuisses.'], ['Check-in · 27 oct.', 'Forme 6/10, a marché 30 min deux fois.']].map(function (r) { return '<div class="st-reponse"><small>' + r[0] + '</small><p>' + r[1] + '</p></div>'; }).join('');
    return '<div class="st-champ"><label for="st-cl-notes">Visible par toi seul</label><textarea id="st-cl-notes" class="st-prive" rows="6">Préfère les séances le matin. Attention à l\'épaule gauche (ancienne tendinite). Aime qu\'on lui explique le pourquoi.</textarea></div><span class="st-sauve is-ok" style="background:var(--st-fond)"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Enregistré</span>';
  }
  function ouvrirFiche(id, sansAnim) {
    var c = D.CLIENTS[id - 1]; if (!c) return; var deja = !!clientCourant; clientCourant = c;
    fiche.dataset.m = c.m;
    fiche.innerHTML = '<div class="st-pan-poignee" aria-hidden="true"></div><div class="st-fiche-tete"><span class="st-av" data-m="' + c.m + '">' + c.ini + '</span><div><h2 id="st-fiche-nom">' + c.nom + '</h2><p>' + c.age + ' ans · ' + c.suivi + '</p></div><div class="st-actions"><button type="button" class="st-btn" data-toast="Message préparé (maquette)">Message</button><button type="button" class="st-btn st-btn--rond" data-act="fermer-fiche" aria-label="Fermer la fiche (Échap)"><svg><use href="#i-fermer"/></svg></button></div></div>' +
      '<div class="st-onglets" role="tablist">' + ONGLETS.map(function (o, i) { return '<button type="button" role="tab" aria-selected="' + (i === 0) + '" data-onglet="' + i + '">' + o + '</button>'; }).join('') + '<span class="st-souligne"></span></div><div class="st-fiche-corps" role="tabpanel" id="st-fiche-corps">' + contenuOnglet(c, 0) + '</div>';
    fiche.hidden = false; $('#st-cl-zone').classList.add('is-ouvert');
    $$('.st-client').forEach(function (b) { b.setAttribute('aria-current', +b.dataset.cl === id); });
    if (history.replaceState) history.replaceState(null, '', '#/clients/' + id);
    requestAnimationFrame(souligne);
    var anim = !reduit.matches && !sansAnim;
    if (mobile.matches) {
      document.body.style.overflow = 'hidden'; voile.classList.add('is-vu');
      if (!anim) { fiche.classList.add('is-glisse', 'is-vu'); void fiche.offsetHeight; fiche.classList.remove('is-glisse'); }
      else requestAnimationFrame(function () { fiche.classList.add('is-vu'); });
    } else if (anim) {
      fiche.animate(deja ? [{ opacity: .5 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(16px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: deja ? 240 : 460, easing: EASE });
    }
  }
  function souligne() { var s = $('.st-souligne', fiche), b = $('[aria-selected="true"]', fiche); if (s && b) { s.style.width = b.offsetWidth + 'px'; s.style.transform = 'translateX(' + b.offsetLeft + 'px)'; } }
  function fermerFiche() {
    var fin = function () { fiche.hidden = true; $('#st-cl-zone').classList.remove('is-ouvert'); var b = clientCourant && $('[data-cl="' + clientCourant.id + '"]'); clientCourant = null; rendreClients(); if (b) { var nb = $('[data-cl="' + b.dataset.cl + '"]'); if (nb) nb.focus(); } };
    if (history.replaceState) history.replaceState(null, '', '#/clients');
    if (mobile.matches) { fiche.classList.remove('is-vu'); voile.classList.remove('is-vu'); fiche.style.transform = ''; document.body.style.overflow = ''; setTimeout(fin, reduit.matches ? 0 : 480); }
    else fin();
  }
  $('#st-clients').addEventListener('click', function (ev) { var b = ev.target.closest('[data-cl]'); if (b) ouvrirFiche(+b.dataset.cl); });
  fiche.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'fermer-fiche') fermerFiche();
    if (b.dataset.onglet) {
      $$('[data-onglet]', fiche).forEach(function (x) { x.setAttribute('aria-selected', x === b); }); souligne();
      var corps = $('#st-fiche-corps'); corps.innerHTML = contenuOnglet(clientCourant, +b.dataset.onglet);
      if (!reduit.matches) corps.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  });
  glissable(fiche, fermerFiche);

  /* ---------- Éditeur de programme ---------- */
  var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  var plan = {
    0: [{ type: 'Échauffement', m: 'mobilite', items: [['Rotation thoracique', '2 × 8'], ['Marche talon-pointe', '2 × 30 s']] }, { type: 'Exercice', m: 'jambes', items: [['Assis-debout chaise', '3 × 10 · 3-1-1']] }, { type: 'Superset', m: 'dos', items: [['Rowing un bras élastique', '3 × 12'], ['Pompe au mur', '3 × 10']] }],
    2: [{ type: 'Exercice', m: 'epaules', items: [['Élévation latérale haltères', '3 × 12']] }, { type: 'Circuit × 3', m: 'gainage', items: [['Planche', '30 s'], ['Bird dog', '10 / côté'], ['Pont fessier', '15']] }],
    4: [{ type: 'Circuit × 4', m: 'cardio', items: [['Montée de marche', '40 s'], ['Jumping jack élastique', '30 s'], ['Repos', '60 s']] }, { type: 'Retour au calme', m: 'mobilite', items: [['Chat-vache', '8 respirations']] }]
  };
  var semaine = 3, jourActif = 0;
  function rendreEditeur() {
    $('#st-semaines').innerHTML = [1, 2, 3, 4, 5, 6].map(function (s) { return '<button type="button" aria-pressed="' + (s === semaine) + '" data-sem="' + s + '" aria-label="Semaine ' + s + '">S' + s + '</button>'; }).join('');
    $('#st-jours').innerHTML = JOURS.map(function (j, i) {
      var b = plan[i] || [];
      return '<section class="st-jour" data-jour="' + i + '" aria-label="' + j + '"><h3>' + j + ' <small>' + (b.length ? b.length + ' bloc' + (b.length > 1 ? 's' : '') : 'repos') + '</small></h3><div class="st-blocs">' +
        b.map(function (x, k) { return '<article class="st-blocp' + (/Circuit/.test(x.type) ? ' st-blocp--circuit' : '') + '" draggable="true" data-m="' + x.m + '" data-j="' + i + '" data-k="' + k + '"><header>' + x.type + '</header><ul>' + x.items.map(function (it) { return '<li>' + it[0] + '<span>' + it[1] + '</span></li>'; }).join('') + '</ul></article>'; }).join('') +
        '</div>' + (b.length ? '' : '<div class="st-vide">Glisse un exercice ici</div>') + '</section>';
    }).join('');
    $('#st-ed-biblio').innerHTML = EX.filter(function (e) { return e.id <= 40 && e.id % 3 === 1; }).map(function (e) { return '<li><button type="button" class="st-tirable" draggable="true" data-ex="' + e.id + '" data-m="' + e.muscle + '" style="border:0;width:100%;text-align:left"><i>' + figure(e.mv) + '</i>' + esc(e.nom) + '</button></li>'; }).join('');
  }
  var tire = null;
  document.addEventListener('dragstart', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ex], .st-blocp'); if (!t) return;
    tire = t; t.classList.add('is-tire'); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', 'x');
  });
  document.addEventListener('dragend', function () { if (tire) tire.classList.remove('is-tire'); tire = null; $$('.st-jour.is-cible').forEach(function (j) { j.classList.remove('is-cible'); }); });
  $('#st-jours').addEventListener('dragover', function (ev) { var j = ev.target.closest('.st-jour'); if (!j || !tire) return; ev.preventDefault(); $$('.st-jour.is-cible').forEach(function (x) { if (x !== j) x.classList.remove('is-cible'); }); j.classList.add('is-cible'); });
  $('#st-jours').addEventListener('drop', function (ev) { var j = ev.target.closest('.st-jour'); if (!j || !tire) return; ev.preventDefault(); deposer(+j.dataset.jour, tire); });
  function deposer(jour, t) {
    plan[jour] = plan[jour] || [];
    if (t.dataset.ex) { var e = trouve(+t.dataset.ex); plan[jour].push({ type: 'Exercice', m: e.muscle, items: [[e.nom, '3 × 10']] }); }
    else { var bl = plan[+t.dataset.j].splice(+t.dataset.k, 1)[0]; plan[jour].push(bl); }
    rendreEditeur(); var s = $('#st-pr-sauve'); s.className = 'st-sauve is-encours'; s.innerHTML = '<i></i>Enregistrement…';
    setTimeout(function () { s.className = 'st-sauve is-ok'; s.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Enregistré'; }, 600);
    toast('Ajouté à ' + JOURS[jour]);
  }
  /* téléphone / clavier : toucher un jour le rend actif, toucher un exercice l'y ajoute */
  $('#st-jours').addEventListener('click', function (ev) { var j = ev.target.closest('.st-jour'); if (j) jourActif = +j.dataset.jour; });
  $('#st-ed-biblio').addEventListener('click', function (ev) { var t = ev.target.closest('[data-ex]'); if (t) deposer(jourActif, t); });
  $('#st-semaines').addEventListener('click', function (ev) { var b = ev.target.closest('[data-sem]'); if (b) { semaine = +b.dataset.sem; rendreEditeur(); } });

  /* ---------- Routeur ---------- */
  var vue = null;
  function route() {
    var h = location.hash.replace(/^#\/?/, '') || 'accueil';
    var q = h.split('?'), parts = q[0].split('/'), v = parts[0];
    if (!document.querySelector('.st-vue[data-vue="' + v + '"]')) v = 'accueil';
    if (v !== vue) {
      if (courant) { courant = null; etat.ouvert = null; pan.hidden = true; pan.classList.remove('is-vu'); zone.classList.remove('is-ouvert'); zone.parentNode.classList.remove('is-panneau'); }
      if (clientCourant) { clientCourant = null; fiche.hidden = true; fiche.classList.remove('is-vu'); $('#st-cl-zone').classList.remove('is-ouvert'); }
      voile.classList.remove('is-vu'); document.body.style.overflow = '';
      $$('.st-vue').forEach(function (s) { s.classList.toggle('is-active', s.dataset.vue === v); });
      $$('[data-vue]').forEach(function (a) { if (a.tagName === 'A') { if (a.dataset.vue === v && !a.hasAttribute('data-faux')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); } });
      vue = v; window.scrollTo(0, 0);
    }
    if (v === 'exercices') {
      if (q[1] === 'filtre=propose') { etat.propose = true; rendreFiltres(); rendreGrille(); }
      if (!parts[1] && courant) fermer();
      if (parts[1]) { var c =$('.st-carte[data-id="' + parts[1] + '"]'); ouvrir(+parts[1], c, true); }
    }
    if (v === 'clients' && parts[1]) ouvrirFiche(+parts[1], true);
    else if (v === 'clients' && clientCourant) fermerFiche();
  }
  $$('[data-faux]').forEach(function (a) { a.addEventListener('click', function (ev) { ev.preventDefault(); toast('Écran non maquetté dans cette direction'); }); });
  window.addEventListener('hashchange', route);

  rendreFiltres(); rendreGrille(); rendreAccueil(); rendreClients(); rendreEditeur(); compteProposes();
  route();
})();
