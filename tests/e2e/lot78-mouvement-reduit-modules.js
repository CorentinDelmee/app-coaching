async page => {
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://localhost:5182/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cdc-coaching/1:session', 'client-lea-martin'); });
  const verif = async (nom, sel) => log.push(nom + ' : ' + await page.evaluate((s) => { const bad = []; document.querySelectorAll(s).forEach((e) => { const c = getComputedStyle(e); if (c.opacity !== '1' || (c.transform !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(c.transform))) bad.push((e.className.baseVal ?? e.className) + ':' + c.opacity + ':' + c.transform); }); return bad.length + ' decales ' + bad.slice(0, 4).join(' | '); }, sel));
  await page.goto('http://localhost:5182/suivi'); await page.waitForTimeout(1500);
  await verif('suivi', '[data-c], .crb-trace, .crb-pt, .crb-ligne, .zone, .hab');
  await page.evaluate(() => document.querySelector('.defile').scrollTo(0, 700)); await page.waitForTimeout(800);
  await verif('suivi scroll', '.zone, .crb-pt, .repas');
  await page.screenshot({ path: SP + 'rm-suivi.png' });
  await page.goto('http://localhost:5182/questionnaires'); await page.waitForTimeout(1200);
  await verif('liste', '[data-c], .ligne-w');
  await page.evaluate(() => { localStorage.setItem('cdc-coaching/1:session', 'client-thomas-bernard'); });
  await page.goto('http://localhost:5182/questionnaires/q-checkin-quotidien'); await page.waitForTimeout(1200);
  await verif('quest', '[data-c], .qz-q, .qz-q h2, .qz-q [data-qc], .mot > span');
  await page.click('.qz-bas .gros'); await page.waitForTimeout(700);
  await verif('quest 2', '.qz-q, .qz-q [data-qc]');
  log.push('nb questions dom ' + await page.evaluate(() => document.querySelectorAll('.qz-q').length));
  await page.screenshot({ path: SP + 'rm-quest.png' });
  // thomas : aucun module -> pas de nutrition
  await page.goto('http://localhost:5182/suivi'); await page.waitForTimeout(1200);
  log.push('thomas nutrition présent ? ' + await page.evaluate(() => !!document.querySelector('#sv-nut')) + ' ; titres: ' + await page.evaluate(() => [...document.querySelectorAll('.bloc-suivi h2')].map(h => h.innerText).join(',')));
  log.push('thomas poids vide: ' + await page.evaluate(() => document.querySelector('.sm-vide')?.innerText));
  await page.screenshot({ path: SP + 'rm-thomas.png' });
  return log.join('\n') + '\nerrs ' + JSON.stringify(errs);
}
