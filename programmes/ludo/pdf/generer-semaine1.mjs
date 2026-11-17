// Génère le PDF des 5 séances de la semaine 1 de Ludo.
// Usage : node programmes/ludo/pdf/generer-semaine1.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const prog = JSON.parse(readFileSync(join(ici, '..', 'programme.json'), 'utf8'));
const semaine = prog.semaines[0];
const VIDEOS = JSON.parse(readFileSync(join(ici, 'videos.json'), 'utf8'));
function media(nomBrut) {
  const v = VIDEOS[nomBrut];
  if (!v) return '';
  return `<a class="vignette" href="${esc(v.url)}"><img src="miniatures/${v.id}.jpg" alt=""><span class="play"></span></a>`;
}
function lien(nomBrut) {
  const v = VIDEOS[nomBrut];
  return v ? `<a class="lien" href="${esc(v.url)}">▶&nbsp;Vidéo</a>` : '';
}
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtRepos = (s) => (!s ? '—' : s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ' ' + (s % 60) : ''}` : `${s} s`);
const fmtRpe = (r) => (r == null ? '—' : String(r).replace('.', ','));

// Noms affichés : on garde le nom de l'app, en plus lisible.
const NOMS = {
  'Walking - Treadmill': 'Marche inclinée sur tapis',
  'Abs Weel': 'Roue abdominale (Abs Wheel)',
  'Rameur': 'Rameur',
};
function nomAffiche(nom) {
  if (NOMS[nom]) return { nom: NOMS[nom], machine: false };
  const m = nom.match(/^Danse&Fitness\s*-?\s*(.+)$/);
  if (m) return { nom: m[1].replace(/\s+\//g, ' / ').replace(/LegCurl/g, 'Leg Curl').replace(/ButterFly/g, 'Butterfly').replace(/ChestPress/g, 'Chest Press').replace(/Calves Raises/g, 'Calf Raises'), machine: true };
  return { nom, machine: false };
}

const debut = new Date(prog.debut + 'T12:00:00');
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const dateDe = (jour) => {
  const d = new Date(debut);
  d.setDate(d.getDate() + JOURS.indexOf(jour));
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

function cases(n) {
  return `<div class="cases">${Array.from({ length: n }, () => '<span></span>').join('')}</div>`;
}

function ligne(e, { dansSuperset = false, repos } = {}) {
  const { nom, machine } = nomAffiche(e.nom);
  const cardio = e.tempsTravail && !e.reps;
  return `<tr class="${cardio ? 'cardio' : ''}">
    <td class="ex"><div class="exw">${media(e.nom)}<div class="txt"><div class="nom">${esc(nom)}${machine ? '<span class="tag">machine</span>' : ''}</div>
      <div class="consigne">${esc(e.consignes || '')} ${lien(e.nom)}</div></div></div></td>
    ${cardio
      ? `<td colspan="5" class="num duree">${Math.round(e.tempsTravail / 60)} min · zone 2</td><td class="charges"></td>`
      : `<td class="num">${e.series}</td><td class="num">${esc(e.reps)}</td><td class="num">${fmtRpe(e.rpe)}</td>
         <td class="num mono">${esc(e.tempo || '—')}</td><td class="num">${dansSuperset ? '<span class="enchaine">↓</span>' : fmtRepos(repos ?? e.repos)}</td>
         <td class="charges">${e.rpe ? cases(e.series) : ''}</td>`}
  </tr>`;
}

function bloc(b, lettre) {
  if (b.exercice) {
    return `<tbody class="bloc seul">${ligne(b.exercice).replace('<div class="nom">', `<div class="nom"><span class="lettre">${lettre}</span>`)}</tbody>`;
  }
  if (b.superset) {
    const { exercices, repos } = b.superset;
    const echauf = repos === 0;
    const titre = echauf
      ? `Activation épaules + gainage · ${exercices[0].series} tours sans repos · fait partie de l'échauffement`
      : `${exercices.length === 2 ? 'Superset' : 'Triset'} · enchaîne les ${exercices.length} exercices, puis ${fmtRepos(repos)} de repos · ${exercices[0].series} tours`;
    if (echauf) {
      const cartes = exercices.map((e) => `<div class="carte-act">${media(e.nom)}<div class="txt"><div class="nom">${esc(nomAffiche(e.nom).nom)}</div>
        <div class="dose">${e.series} × ${esc(e.reps)} · <span class="mono">${esc(e.tempo)}</span></div>
        <div class="consigne">${esc(e.consignes)} ${lien(e.nom)}</div></div></div>`).join('');
      return `<tbody class="bloc echauf"><tr class="tete"><td colspan="7"><span class="lettre">${lettre}</span><span class="type">${titre}</span></td></tr>
        <tr><td colspan="7" class="act"><div class="grille-act">${cartes}</div></td></tr></tbody>`;
    }
    const lignes = exercices
      .map((e, i) => ligne(e, { dansSuperset: i < exercices.length - 1 || echauf, repos }).replace('<tr class="', `<tr class="ss `))
      .join('');
    return `<tbody class="bloc${echauf ? ' echauf' : ''}"><tr class="tete"><td colspan="7"><span class="lettre">${lettre}</span><span class="type">${titre}</span></td></tr>${lignes}</tbody>`;
  }
  if (b.circuit) {
    const c = b.circuit;
    const e = c.exercices[0];
    return `<tbody class="bloc"><tr class="tete"><td colspan="7"><span class="lettre">${lettre}</span><span class="type">${esc(c.nom)}</span></td></tr>
      <tr class="cardio"><td class="ex"><div class="exw">${media(e.nom)}<div class="txt"><div class="nom">${esc(nomAffiche(e.nom).nom)}</div><div class="consigne">${esc(e.consignes)} ${lien(e.nom)}</div></div></div></td>
      <td colspan="5" class="num duree">${c.tours} × (${c.travail} s fort / ${c.repos} s facile)</td><td class="charges"></td></tr></tbody>`;
  }
  return '';
}

function seance(s, i) {
  const [jourTitre, sousTitre] = s.nom.split(' — ');
  const [echauf, ...reste] = s.consignes.split(/(?<=\.)\s+(?=Focus)/);
  const lettres = 'ABCDEFGHIJ';
  return `<section id="p${i + 1}" class="page seance">
    <header class="bandeau">
      <div class="num-seance">Séance ${i + 1}<span>/5</span></div>
      <div class="titres"><div class="date">${esc(dateDe(s.jour))}</div><h2>${esc(sousTitre)}</h2></div>
      <div class="duree-tot">60-70 min<br><small>cardio compris</small></div>
    </header>
    <div class="consignes-seance">
      <p><strong>Échauffement.</strong> ${esc(echauf.replace(/^Échauffement\s*/, ''))}</p>
      ${reste.length ? `<p>${esc(reste.join(' '))}</p>` : ''}
    </div>
    <table>
      <thead><tr><th class="ex">Exercice</th><th>Séries</th><th>Reps</th><th>RPE</th><th>Tempo</th><th>Repos</th><th class="charges">Charges (kg)</th></tr></thead>
      ${s.blocs.map((b, k) => bloc(b, lettres[k])).join('')}
    </table>
    <footer class="pied"><span>Ludo · Hypertrophie &amp; sèche · Semaine 1 / 12</span><span>Note tes charges à chaque série · douleur articulaire = on arrête et on prévient Corentin</span></footer>
  </section>`;
}

const fin = new Date(debut); fin.setDate(fin.getDate() + 4);
const periode = `${debut.getDate()} au ${fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

const couverture = `<section id="p0" class="page couverture">
  <div class="haut">
    <div class="sur">Programme individuel · Semaine 1</div>
    <h1>Ludo</h1>
    <div class="objectif">Hypertrophie &amp; sèche<br>12 semaines</div>
    <div class="periode">Du ${periode}</div>
  </div>
  <div class="semaine">
    ${semaine.seances.map((s, i) => `<div class="jour"><div class="j">${s.jour.slice(0, 3)}</div><div class="n">${i + 1}</div><div class="t">${esc(s.nom.split(' — ')[1])}</div></div>`).join('')}
    <div class="jour repos"><div class="j">sam · dim</div><div class="n">—</div><div class="t">Repos</div></div>
  </div>
  <div class="grille">
    <div class="carte jaune"><h3>Cette semaine : trouver tes charges</h3>
      <p>Semaine 1 du bloc « Volume ». Prends des charges qui te laissent <strong>3 répétitions en réserve</strong> (RPE 7). Note-les : ce sont tes repères pour les semaines suivantes.</p></div>
    <div class="carte"><h3>RPE</h3>
      <p class="rpe"><b>10</b> échec · <b>9</b> encore 1 rep · <b>8</b> encore 2 reps · <b>7</b> encore 3 reps</p></div>
    <div class="carte"><h3>Tempo, ex. 3-0-1-0</h3>
      <p>Descente en <b>3 s</b> · pause en bas <b>0 s</b> · montée en <b>1 s</b> · pause en haut <b>0 s</b>.</p></div>
    <div class="carte"><h3>Superset / triset</h3>
      <p>Enchaîne les exercices du bloc sans pause (<b>↓</b>), puis prends le repos indiqué. Si les postes sont loin : fais-les à la suite, repos 90 s.</p></div>
    <div class="carte"><h3>Progression</h3>
      <p>Haut de la fourchette sur <b>toutes</b> les séries au RPE demandé ? La séance suivante : +2,5 kg haut du corps, +5 kg bas du corps, +1 cran en machine, +1 kg en isolation. Sinon, ajoute des reps.</p></div>
    <div class="carte"><h3>Épaules</h3>
      <p>Lundi, mercredi, jeudi : ne saute pas le bloc d'activation. Amplitude contrôlée sur les poussées, jamais de développé nuque. Shoulder Press machine : 8 reps minimum, RPE 8 maximum.</p></div>
    <div class="carte"><h3>À côté des séances</h3>
      <p>8 000 pas par jour · protéines 2 à 2,4 g/kg/jour · 7 à 9 h de sommeil · pesée à jeun 3-4 fois dans la semaine.</p></div>
  </div>
  <div class="signature">Ton coach, Corentin</div>
</section>`;

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Ludo — Semaine 1</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=Inter+Tight:wght@400;500;600;700&family=Azeret+Mono:wght@500&display=block" rel="stylesheet">
<style>
@page { size: A4; margin: 0; }
:root { --nuit:#141B33; --nuit2:#1E2747; --jaune:#F2E27A; --creme:#F6F6F2; --encre:#1A1B1E; --doux:#5E6370; --trait:#DADCE0; --ss:#F3F1E4; --bleu:#CFE0F2; }
* { box-sizing:border-box; margin:0; padding:0; }
html, body { background:#fff; color:var(--encre); font-family:'Inter Tight', Arial, sans-serif; font-size:9pt; line-height:1.35;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:210mm; height:297mm; padding:10mm 12mm 14mm; position:relative; overflow:hidden; page-break-after:always; }
.page:last-child { page-break-after:auto; }
h1, h2, h3, .num-seance, .lettre, .duree-tot, th { font-family:'Barlow Semi Condensed', Arial Narrow, sans-serif; }

/* Couverture */
.couverture { background:var(--nuit); color:#fff; padding:16mm 15mm; display:flex; flex-direction:column; }
.couverture .sur { text-transform:uppercase; letter-spacing:.14em; font-size:9pt; color:var(--jaune); font-weight:600; }
.couverture h1 { font-size:84pt; line-height:.95; font-weight:700; margin-top:6mm; letter-spacing:-.01em; }
.couverture .objectif { font-family:'Barlow Semi Condensed'; font-size:24pt; font-weight:500; line-height:1.1; margin-top:3mm; color:#E7E9F0; }
.couverture .periode { margin-top:5mm; display:inline-block; background:var(--jaune); color:var(--nuit); font-weight:700; padding:1.5mm 3.5mm; border-radius:2mm; font-size:10pt; align-self:flex-start; }
.semaine { display:grid; grid-template-columns:repeat(6, 1fr); gap:2.5mm; margin-top:11mm; }
.jour { background:var(--nuit2); border-radius:3mm; padding:3mm; min-height:30mm; }
.jour .j { text-transform:uppercase; font-size:7.5pt; letter-spacing:.1em; color:#AEB5CC; }
.jour .n { font-family:'Barlow Semi Condensed'; font-size:24pt; font-weight:700; color:var(--jaune); line-height:1.1; }
.jour .t { font-size:8pt; line-height:1.25; color:#fff; }
.jour.repos { background:transparent; border:1px dashed #3A4570; }
.jour.repos .n { color:#5A6488; }
.grille { display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-top:7mm; }
.carte { background:#fff; color:var(--encre); border-radius:3mm; padding:3.5mm 4mm; }
.carte.jaune { background:var(--jaune); grid-column:1 / -1; }
.carte h3 { font-size:12pt; font-weight:700; margin-bottom:1mm; color:var(--nuit); }
.carte p { font-size:8.6pt; }
.rpe b { font-family:'Azeret Mono'; }
.signature { margin-top:auto; font-family:'Barlow Semi Condensed'; font-size:13pt; color:var(--jaune); font-weight:600; }

/* Séances */
.bandeau { display:flex; align-items:center; gap:5mm; background:var(--nuit); color:#fff; border-radius:3mm; padding:4mm 5mm; }
.num-seance { font-size:22pt; font-weight:700; color:var(--jaune); white-space:nowrap; line-height:1; }
.num-seance span { font-size:12pt; color:#8E97B5; }
.titres { flex:1; }
.date::first-letter { text-transform:uppercase; } .date { font-size:8.5pt; color:#AEB5CC; letter-spacing:.04em; }
.bandeau h2 { font-size:19pt; font-weight:700; line-height:1.05; }
.duree-tot { text-align:right; font-size:14pt; font-weight:600; line-height:1; }
.duree-tot small { font-family:'Inter Tight'; font-size:7.5pt; font-weight:400; color:#AEB5CC; }
.consignes-seance { margin:3mm 0 2mm; padding:2mm 3.5mm; background:var(--creme); border-left:1.2mm solid var(--jaune); border-radius:1mm; font-size:8pt; }
.consignes-seance p + p { margin-top:1mm; }
table { width:100%; border-collapse:collapse; }
thead th { font-size:8.5pt; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--doux); text-align:center; padding:1mm 1mm 1.5mm; border-bottom:.5mm solid var(--nuit); }
th.ex { text-align:left; }
.bloc { break-inside:avoid; }
.tete td { padding:2mm 0 .8mm; border-bottom:0; }
.lettre { display:inline-flex; align-items:center; justify-content:center; width:5mm; height:5mm; border-radius:1.1mm; background:var(--nuit); color:var(--jaune); font-size:9pt; font-weight:700; vertical-align:middle; }
.seul .lettre { margin:0 2mm 0 -.5mm; vertical-align:1px; }
.seul td { padding-top:2.2mm; }
.type { margin-left:2mm; font-size:7.8pt; font-weight:600; color:var(--nuit); vertical-align:middle; }
td { padding:1.2mm 1mm; vertical-align:top; border-bottom:1px solid var(--trait); }
tr.ss td { background:var(--ss); }
.echauf tr.ss td { background:#EEF3FA; }
td.ex { width:53%; padding-left:2mm; }
.nom { font-weight:700; font-size:9.3pt; }
.tag { margin-left:1.5mm; font-size:6.3pt; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--doux); border:1px solid var(--trait); border-radius:1mm; padding:0 1mm; vertical-align:1px; background:#fff; }
.exw { display:flex; gap:2.5mm; align-items:flex-start; }
.txt { flex:1; min-width:0; }
.vignette { position:relative; flex:none; display:block; width:14mm; height:14mm; border-radius:1.5mm; overflow:hidden; background:#000; margin-top:.3mm; }
.vignette img { width:100%; height:100%; object-fit:cover; display:block; }
.play { position:absolute; left:50%; top:50%; width:6mm; height:6mm; margin:-3mm 0 0 -3mm; border-radius:50%; background:rgba(242,226,122,.95); }
.play::after { content:''; position:absolute; left:2.3mm; top:1.6mm; border-left:2.1mm solid var(--nuit); border-top:1.4mm solid transparent; border-bottom:1.4mm solid transparent; }
.lien { white-space:nowrap; font-size:7.2pt; font-weight:600; color:#2A55B8; text-decoration:none; }
.seul .lettre { margin:0 1.5mm 0 0; }
td.act { background:#EEF3FA; padding:2mm; }
.grille-act { display:grid; grid-template-columns:repeat(3, 1fr); gap:2.5mm; }
.carte-act { display:flex; gap:2mm; align-items:flex-start; }
.carte-act .vignette { width:13mm; height:13mm; }
.carte-act .nom { font-size:8.6pt; line-height:1.15; }
.dose { font-size:8pt; font-weight:600; color:var(--nuit); margin-top:.3mm; }
.carte-act .consigne { font-size:6.6pt; }
.consigne { color:var(--doux); font-size:7.2pt; line-height:1.28; margin-top:.4mm; }
td.num { text-align:center; font-weight:600; font-size:9.2pt; white-space:nowrap; }
.mono { font-family:'Azeret Mono', monospace; font-size:8pt !important; font-weight:500 !important; }
.enchaine { color:var(--doux); font-size:11pt; }
td.duree { font-weight:600; color:var(--nuit); }
tr.cardio td { background:#EDF3F9; }
td.charges { width:20%; }
.cases { display:flex; gap:1mm; flex-wrap:nowrap; }
.cases span { width:8.2mm; height:5.5mm; border:1px solid #B9BDC6; border-radius:1mm; background:#fff; }
.pied { position:absolute; left:12mm; right:12mm; bottom:7mm; display:flex; justify-content:space-between; font-size:7pt; color:var(--doux); border-top:1px solid var(--trait); padding-top:2mm; }
</style></head><body>
${couverture}
${semaine.seances.map(seance).join('\n')}
<script>
document.fonts.ready.then(() => {
  const r = [...document.querySelectorAll('.seance')].map((p) => {
    const marge = p.querySelector('.pied').getBoundingClientRect().top - p.querySelector('table').getBoundingClientRect().bottom;
    return p.id + ':' + Math.round(marge);
  });
  document.body.dataset.marges = r.join(' ');
});
</script>
</body></html>`;

const htmlPath = join(ici, 'semaine-1.html');
const pdfPath = join(ici, 'Ludo-programme-semaine-1.pdf');
writeFileSync(htmlPath, html);
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=8000', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
], { stdio: 'ignore' });
console.log('PDF :', pdfPath);
