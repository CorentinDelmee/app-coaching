/* Maquette V2 — UN SEUL objet de configuration pour tout ce qui varie (panneau de comparaison + profil client).
   Transposition Vue : CONFIG = le store « préférences » (src/data, persistance par client),
   appliquerConfig() = un watcher qui pose les attributs data-* sur <html> (les variables CSS font le reste). */
(function () {
  'use strict';
  var REX = window.REX = window.REX || {};

  /* Valeurs par défaut = recommandations (voir NOTES.md). */
  var DEFAUT = {
    ambiance: 'clair',        // clair | sombre | bleu            -> html[data-ambiance]
    aplat: 'fonce',           // fonce | blanc (texte de l'aplat) -> html[data-aplat]
    chrono: 'barlow',         // barlow | inter | azeret           -> html[data-chrono]
    accueil: 'pret',          // pret | semaine | jour             -> texte du dashboard
    grand: false,             // Grand affichage                   -> html[data-grand] (--e = 1.2)
    son: true, vibration: true
  };

  /* Choix proposés dans le panneau ; « reco » = pré-sélection recommandée. */
  var OPTIONS = {
    ambiance: [
      { v: 'clair', nom: 'Clair', reco: true }, { v: 'sombre', nom: 'Sombre' }, { v: 'bleu', nom: 'Bleu profond' }
    ],
    aplat: [
      { v: 'fonce', nom: 'Texte foncé', reco: true }, { v: 'blanc', nom: 'Texte blanc' }
    ],
    chrono: [
      { v: 'barlow', nom: 'Barlow Semi Condensed', famille: "'Barlow Semi Condensed'", graisse: 600, reco: true },
      { v: 'inter', nom: 'Inter Tight', famille: "'Inter Tight'", graisse: 600 },
      { v: 'azeret', nom: 'Azeret Mono', famille: "'Azeret Mono'", graisse: 500 }
    ],
    accueil: [
      { v: 'pret', nom: '« Prêt, Fabien ? »', reco: true },
      { v: 'semaine', nom: '« Plus que 2 séances… »' },
      { v: 'jour', nom: '« Jour de jambes »' }
    ],
    grand: [
      { v: false, nom: 'Non', reco: true }, { v: true, nom: 'Oui' }
    ]
  };

  /* Messages d'accueil : ils s'adaptent à l'état (séance faite, semaine bouclée). Vouvoiement (comme l'app). */
  var ACCUEIL = {
    pret:    { avant: { p: '{date}', h: 'Prêt,<br>{prenom}&nbsp;?' },
               apres: { p: '{date}', h: 'Bien joué,<br>{prenom}.' },
               boucle: { p: '{date}', h: 'Semaine<br>bouclée&nbsp;!' } },
    semaine: { avant: { p: '{prenom} · {date}', h: 'Plus que {reste} séances pour boucler la semaine.', long: true },
               apres: { p: '{prenom} · {date}', h: 'Plus qu’une séance pour boucler la semaine.', long: true },
               boucle: { p: '{prenom} · {date}', h: 'Semaine bouclée. Respect.', long: true } },
    jour:    { avant: { p: '{date} · Workout 2', h: 'Jour de<br>jambes, {prenom}.' },
               apres: { p: '{date}', h: 'Jambes faites.<br>Bravo.' },
               boucle: { p: '{date}', h: 'Semaine<br>bouclée&nbsp;!' } }
  };

  /* Petites phrases du chrono (M2), au vouvoiement comme le reste de l'app. Variante tutoiement prête. */
  var PHRASES = {
    vous: { prep: 'Préparez-vous.', travail: 'Tenez bon.', repos: 'Respirez.', reposFin: 'On y retourne.', fin: 'Temps !', go: 'Go !' },
    tu:   { prep: 'Prépare-toi.',  travail: 'Tiens bon.',  repos: 'Respire.',  reposFin: 'On y retourne.', fin: 'Temps !', go: 'Go !' }
  };

  var CLE = 'rex-maquette-v2';
  var CONFIG = REX.CONFIG = Object.assign({}, DEFAUT);
  try { Object.assign(CONFIG, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) { /* stockage indisponible */ }
  // Paramètres d'URL (captures) : ?ambiance=sombre&grand=1&chrono=inter&accueil=jour&aplat=blanc
  try {
    var q = new URLSearchParams(location.search);
    ['ambiance', 'aplat', 'chrono', 'accueil'].forEach(function (k) { if (q.get(k)) CONFIG[k] = q.get(k); });
    if (q.get('grand')) CONFIG.grand = q.get('grand') === '1';
  } catch (e) { /* ignore */ }

  REX.OPTIONS = OPTIONS; REX.ACCUEIL = ACCUEIL; REX.PHRASES = PHRASES.vous; REX.DEFAUT = DEFAUT;

  var ecouteurs = [];
  REX.surConfig = function (fn) { ecouteurs.push(fn); };

  REX.appliquerConfig = function () {
    var r = document.documentElement;
    r.dataset.ambiance = CONFIG.ambiance;
    r.dataset.aplat = CONFIG.aplat;
    r.dataset.chrono = CONFIG.chrono;
    r.dataset.grand = CONFIG.grand ? 'oui' : 'non';
    var fond = getComputedStyle(r).getPropertyValue('--fond').trim();
    var m = document.querySelector('meta[name="theme-color"]'); if (m && fond) m.setAttribute('content', fond);
    try { localStorage.setItem(CLE, JSON.stringify(CONFIG)); } catch (e) { /* ignore */ }
    ecouteurs.forEach(function (fn) { fn(CONFIG); });
    majPanneau();
  };
  REX.regler = function (cle, val) { CONFIG[cle] = val; REX.appliquerConfig(); };

  /* ---------- Panneau de comparaison (construit depuis OPTIONS) ---------- */
  var TITRES = { ambiance: 'Ambiance', aplat: 'Texte de l’aplat jaune', chrono: 'Police des chiffres du chrono', accueil: 'Message d’accueil', grand: 'Grand affichage' };
  function construirePanneau() {
    var p = document.getElementById('panneau'); if (!p) return;
    var h = '<p class="pn-titre">Comparer <small>★ = recommandé</small></p>';
    Object.keys(OPTIONS).forEach(function (cle) {
      h += '<p class="etiq">' + TITRES[cle] + '</p><div class="pn-choix" data-cle="' + cle + '">';
      OPTIONS[cle].forEach(function (o) {
        var style = o.famille ? ' style="font-family:' + o.famille.replace(/"/g, '&quot;') + ';font-weight:' + o.graisse + '"' : '';
        var ech = o.famille ? '<b class="pn-ech"' + style + '>1:30</b>' : '';
        h += '<button data-v="' + o.v + '" aria-pressed="false">' + ech + '<span>' + o.nom + (o.reco ? ' ★' : '') + '</span></button>';
      });
      h += '</div>';
    });
    h += '<button class="pn-reset" id="pn-reset">Revenir aux recommandations</button>';
    p.innerHTML = h;
    p.addEventListener('click', function (e) {
      if (e.target.closest('#pn-reset')) { Object.assign(CONFIG, DEFAUT); REX.appliquerConfig(); return; }
      var b = e.target.closest('.pn-choix button'); if (!b) return;
      var cle = b.parentNode.dataset.cle, v = b.dataset.v;
      if (cle === 'grand') v = v === 'true';
      REX.regler(cle, v);
    });
  }
  function majPanneau() {
    var p = document.getElementById('panneau'); if (!p) return;
    Array.prototype.forEach.call(p.querySelectorAll('.pn-choix'), function (g) {
      var cle = g.dataset.cle;
      Array.prototype.forEach.call(g.children, function (b) { b.setAttribute('aria-pressed', String(String(CONFIG[cle]) === b.dataset.v)); });
    });
  }
  REX.initPanneau = function () {
    construirePanneau();
    var btn = document.getElementById('btn-reglages'), p = document.getElementById('panneau');
    btn.addEventListener('click', function () {
      var ouvrir = p.hidden; p.hidden = !ouvrir; btn.setAttribute('aria-expanded', String(ouvrir));
      if (ouvrir && !REX.REDUIT && window.gsap) gsap.fromTo(p, { opacity: 0, y: 12, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .3, ease: 'expo.out', clearProps: 'transform' });
    });
    REX.appliquerConfig();
  };
})();
