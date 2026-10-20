async page => {
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:5182/');
  await page.evaluate(() => {
    localStorage.removeItem('cdc-coaching/seance-en-cours');
    const s = JSON.parse(localStorage.getItem('cdc-coaching/1'));
    const f = s.profils.find(p => p.identifiant === 'fabien.vincent').id;
    const base = s.realisations.find(r => r.clientId === f);
    const today = new Date(); const pad = n => String(n).padStart(2, '0');
    const j = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
    for (const w of ['w-fabien-2', 'w-fabien-3']) {
      if (!s.realisations.some(r => r.workoutId === w && r.date === j)) s.realisations.push({ ...base, id: 'test-' + w, workoutId: w, date: j, termineLe: Date.now() });
    }
    localStorage.setItem('cdc-coaching/1', JSON.stringify(s));
  });
  await page.goto('http://localhost:5182/programme');
  await page.waitForTimeout(700);
  await page.screenshot({ path: SP + 'b-1.png' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: SP + 'b-2.png' });
  log.push(await page.evaluate(() => [...document.querySelectorAll('.a-faire h3')].map(h => h.textContent).join(',') + ' | ' + (document.querySelector('.boucle')?.textContent || 'pas de bannière')));
  // colonne mardi
  log.push(await page.evaluate(() => document.querySelector('.col.auj').textContent.replace(/\s+/g, ' ')));
  // ouvrir workout fait aujourd'hui depuis la puce
  await page.click('.col.auj .chip-w >> nth=0');
  await page.waitForTimeout(400);
  await page.screenshot({ path: SP + 'b-w-trans.png' });
  await page.waitForTimeout(1800);
  log.push(page.url() + ' | ' + await page.evaluate(() => document.querySelector('.dock-bas .gros').textContent + ' | ' + document.querySelector('.hero-meta').textContent));
  await page.screenshot({ path: SP + 'b-w.png' });
  // retour
  await page.click('.w-tete .rond');
  await page.waitForTimeout(250);
  await page.screenshot({ path: SP + 'b-retour.png' });
  await page.waitForTimeout(1500);
  log.push(page.url());
  log.push('errs ' + JSON.stringify(errs));
  return log.join(' || ');
}
