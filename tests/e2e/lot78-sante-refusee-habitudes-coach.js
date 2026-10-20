async page => {
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // 1. Fabien refuse les données de santé : Questionnaires et Suivi -> « Santé désactivée »
  await page.goto('http://localhost:5182/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cdc-coaching/1:session', 'client-fabien-vincent'); });
  await page.reload(); await page.waitForTimeout(700);
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('cdc-coaching/1')); const p = d.profils.find((x) => x.id === 'client-fabien-vincent'); p.consentementLe = Date.now(); p.preferences = { ...p.preferences, consentement: { version: '2026-10-v1', sante: false } }; localStorage.setItem('cdc-coaching/1', JSON.stringify(d)); });
  for (const chemin of ['/suivi', '/questionnaires', '/questionnaires/q-bilan-hebdo']) {
    await page.goto('http://localhost:5182' + chemin); await page.waitForTimeout(1800);
    log.push(chemin + ' -> ' + new URL(page.url()).pathname + ' | ' + await page.evaluate(() => document.querySelector('h1')?.innerText.replace(/\n/g, ' ')));
  }
  await page.screenshot({ path: SP + 'refus.png' });
  // 2. Le coach définit les habitudes de Fabien, le client les voit
  await page.evaluate(() => { localStorage.setItem('cdc-coaching/1:session', 'coach-corentin'); });
  await page.goto('http://localhost:5182/coach/clients/client-fabien-vincent'); await page.waitForTimeout(1500);
  log.push('coach url ' + new URL(page.url()).pathname);
  await page.click('text=Réglages').catch(() => {});
  await page.waitForTimeout(500);
  await page.fill('textarea', 'Marcher 8000 pas\nPas de sucre le soir\nMarcher 8000 pas');
  await page.click('button:has-text("Enregistrer")'); await page.waitForTimeout(800);
  await page.screenshot({ path: SP + 'coach-habitudes.png' });
  log.push('profil modules: ' + await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('cdc-coaching/1')).profils.find((x) => x.id === 'client-fabien-vincent').modules)));
  await page.evaluate(() => { localStorage.setItem('cdc-coaching/1:session', 'client-fabien-vincent'); const d = JSON.parse(localStorage.getItem('cdc-coaching/1')); const p = d.profils.find((x) => x.id === 'client-fabien-vincent'); p.preferences.consentement.sante = true; localStorage.setItem('cdc-coaching/1', JSON.stringify(d)); });
  await page.goto('http://localhost:5182/suivi'); await page.waitForTimeout(1500);
  log.push('habitudes client: ' + await page.evaluate(() => [...document.querySelectorAll('.hab-nom')].map((e) => e.innerText.split('\n')[0]).join(' | ')));
  return log.join('\n') + '\nerrs ' + JSON.stringify(errs);
}
