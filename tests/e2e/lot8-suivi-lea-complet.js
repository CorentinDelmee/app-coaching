async page => {
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5182/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cdc-coaching/1:session', 'client-lea-martin'); });
  await page.goto('http://localhost:5182/suivi');
  await page.waitForTimeout(2500);
  log.push('lea: single point note: ' + await page.evaluate(() => document.querySelector('.sm-note')?.innerText));
  await page.screenshot({ path: SP + 'l-1.png' });
  // ajouter un poids
  await page.click('.sm-ajout'); await page.waitForTimeout(1300);
  await page.screenshot({ path: SP + 'l-roue.png' });
  await page.click('.roue-couche .gros'); await page.waitForTimeout(1500);
  log.push('after poids: note=' + await page.evaluate(() => document.querySelector('.sm-note')?.innerText) + ' pts=' + await page.evaluate(() => document.querySelectorAll('.crb-pt').length));
  // zone
  await page.evaluate(() => document.querySelector('.defile').scrollTo(0, 560)); await page.waitForTimeout(1500);
  await page.click('[data-zone="genou-droite"]', { force: true }); await page.waitForTimeout(1000);
  await page.screenshot({ path: SP + 'l-zone.png' });
  log.push('zone status: ' + await page.evaluate(() => document.querySelector('.fz-statut')?.innerText));
  const r = await page.locator('.cd-rail').boundingBox();
  await page.mouse.click(r.x + r.width * 0.8, r.y + 36); await page.waitForTimeout(600);
  await page.screenshot({ path: SP + 'l-zone8.png' });
  log.push('alerte txt: ' + await page.evaluate(() => document.querySelector('.fz-alerte')?.innerText));
  await page.click('.feuille .gros'); await page.waitForTimeout(1500);
  await page.screenshot({ path: SP + 'l-zone-apres.png' });
  log.push('store douleur: ' + await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('cdc-coaching/1')).douleurs.filter(d => d.clientId.includes('lea')))));
  // rouvrir la zone : courbe + statut
  await page.click('[data-zone="genou-droite"]', { force: true }); await page.waitForTimeout(1500);
  await page.screenshot({ path: SP + 'l-zone-2.png' });
  log.push('zone status 2: ' + await page.evaluate(() => document.querySelector('.fz-statut')?.innerText) + ' courbe pts ' + await page.evaluate(() => document.querySelectorAll('.feuille .crb-pt').length));
  await page.keyboard.press('Escape');
  await page.click('.scrim', { force: true, position: { x: 100, y: 100 } }); await page.waitForTimeout(800);
  // dos
  await page.click('.bascule button >> text=Dos'); await page.waitForTimeout(1200);
  await page.screenshot({ path: SP + 'l-dos.png' });
  await page.evaluate(() => document.querySelector('.defile').scrollTo(0, 99999)); await page.waitForTimeout(1200);
  await page.screenshot({ path: SP + 'l-nut.png' });
  // habitude
  await page.click('.hab-case >> nth=0'); await page.waitForTimeout(700);
  log.push('habitude: ' + await page.evaluate(() => document.querySelector('.hab').className));
  // photo repas
  const buf = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1800; const x = c.getContext('2d'); const g = x.createLinearGradient(0,0,2400,1800); g.addColorStop(0,'#e83'); g.addColorStop(1,'#3a6'); x.fillStyle = g; x.fillRect(0,0,2400,1800); const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .9)); return Array.from(new Uint8Array(await b.arrayBuffer())); });
  await page.setInputFiles('.repas >> nth=1 >> input', { name: 'r.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(buf) });
  await page.waitForTimeout(1500);
  log.push('photo repas: ' + await page.evaluate(() => { const i = document.querySelector('.repas.pris img'); return i ? Math.round(i.src.length / 1024) + 'KB' : 'none'; }));
  // kcal
  await page.click('.nu-kcal'); await page.waitForTimeout(1300); await page.click('.roue-couche .gros'); await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('.defile').scrollTo(0, 99999)); await page.waitForTimeout(800);
  await page.screenshot({ path: SP + 'l-nut2.png' });
  log.push('kcal: ' + await page.textContent('.nu-kcal-val') + ' courbe ' + await page.evaluate(() => document.querySelectorAll('.nutrition .crb-pt').length));
  return log.join('\n') + '\nerrs ' + JSON.stringify(errs);
}
