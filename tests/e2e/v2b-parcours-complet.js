async page => {
  // Lot V2.3b : parcours complet d'une séance à 390×844 (Workout 3 de Fabien : 2 exercices, AMRAP, option EMOM).
  // Changer PREFS / TAG pour une autre ambiance : { ambiance: 'sombre' } (ou 'bleu'), { grand: true } pour le Grand affichage.
  const PREFS = {};
  const TAG = 'v2b-clair';
  const BASE = 'http://localhost:5182';
  const SP = 'captures/';
  const log = [];
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));

  // Session démo (voir README) + préférences d'apparence
  await page.goto(BASE + '/bienvenue');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cdc-coaching/1:session', 'amorce'); });
  await page.reload();
  await page.evaluate((pr) => {
    const s = JSON.parse(localStorage.getItem('cdc-coaching/1'));
    const p = s.profils.find((x) => x.identifiant === 'fabien.vincent');
    p.consentementLe = Date.now();
    p.preferences = { ...p.preferences, consentement: { version: '2026-10-v1', sante: true }, ...pr };
    localStorage.setItem('cdc-coaching/1', JSON.stringify(s));
    localStorage.setItem('cdc-coaching/1:session', p.id);
  }, PREFS);
  const push = (p) => page.evaluate((p) => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(p), p);
  const act = () => page.locator('.panel:not([inert]) [data-action]').first();
  const busy = () => page.evaluate(() => [...document.querySelectorAll('.chrono')].some((c) => !c.hidden));
  const attendreChrono = async () => { for (let k = 0; k < 80; k++) { await page.waitForTimeout(150); if (!(await busy())) break; } await page.waitForTimeout(900); };

  // 1. Dashboard -> overview -> démarrage depuis un exercice (arrive sur l'exercice touché)
  await page.goto(BASE + '/?vitesse=30');
  await page.waitForTimeout(2500);
  await push('/workout/w-fabien-3?retour=%2F');
  await page.waitForTimeout(2300);
  await page.screenshot({ path: SP + TAG + '-01-overview.png' });
  await page.locator('.ex-go').nth(1).click();
  await page.waitForTimeout(3500);
  log.push('depuis overview : ' + (await page.textContent('.se-titre')).replace(/\s+/g, ' '));
  await page.screenshot({ path: SP + TAG + '-02-exercice.png' });
  await page.locator('.se-barre button[aria-label^="Quitter"]').click();
  await page.getByText('Abandonner la séance').click();
  await page.waitForTimeout(2500);
  await page.goBack();
  await page.waitForTimeout(1500);
  log.push('un seul retour -> ' + page.url().replace(BASE, ''));

  // 2. Séance complète depuis le début
  await push('/workout/w-fabien-3?retour=%2F');
  await page.waitForTimeout(2200);
  await page.getByText(/Démarrer|Commencer|Reprendre/).first().click();
  await page.waitForTimeout(3500);
  let premierRepos = true;
  for (let n = 0; n < 40; n++) {
    const t = (await act().textContent()).trim();
    if (t === 'Découvrir le circuit') break;
    await act().click();
    if (premierRepos) { await page.waitForTimeout(900); await page.screenshot({ path: SP + TAG + '-03-repos.png' }); log.push('phrase repos : ' + await page.textContent('.chrono:not([hidden]) .ch-phrase')); premierRepos = false; }
    await attendreChrono();
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: SP + TAG + '-04-circuit-page.png' });
  await page.evaluate(() => window.__horloge && window.__horloge.regler(1));
  await act().click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: SP + TAG + '-05-decouvrir.png' });
  await page.click('[data-voir]');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: SP + TAG + '-06-exercices.png' });
  await page.click('[data-pret]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SP + TAG + '-07-preparation.png' });
  await page.getByText('Commencer maintenant').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SP + TAG + '-08-amrap.png' });
  await page.evaluate(() => window.__horloge.regler(40));
  for (let k = 0; k < 80; k++) { await page.waitForTimeout(250); if (await page.getByText('Valider le circuit').count()) break; }
  await page.evaluate(() => window.__horloge.regler(1));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SP + TAG + '-09-bilan.png' });
  await page.getByText('Valider le circuit').first().click({ force: true });
  await page.waitForTimeout(4500);
  log.push('page suivante : ' + (await act().textContent()).trim() + ' / ' + (await page.locator('.panel:not([inert]) [data-passer]').textContent()).trim());
  await page.screenshot({ path: SP + TAG + '-10-option.png' });

  // 3. L'option (EMOM facultatif) : on la fait
  await act().click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: SP + TAG + '-11-option-section.png' });
  await page.click('[data-voir]');
  await page.waitForTimeout(1300);
  await page.click('[data-pret]');
  await page.waitForTimeout(1500);
  await page.getByText('Commencer maintenant').first().click();
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__horloge.regler(25));
  for (let k = 0; k < 120; k++) { await page.waitForTimeout(250); if (await page.getByText('Valider le circuit').count()) break; }
  await page.evaluate(() => window.__horloge.regler(1));
  await page.waitForTimeout(1000);
  await page.getByText('Valider le circuit').first().click({ force: true });
  await page.waitForTimeout(4500);
  log.push('après l\'option : ' + (await act().textContent()).trim());
  await act().click();
  await page.waitForTimeout(2800);
  await page.screenshot({ path: SP + TAG + '-12-fin.png' });
  log.push('écran de fin : ' + await page.locator('.fin:not([hidden])').count());
  await page.getByText('Valider ma séance').click();
  await page.waitForTimeout(4000);
  log.push('après validation : ' + page.url().replace(BASE, ''));
  log.push('erreurs : ' + JSON.stringify(errs));
  return log.join(' | ');
}
