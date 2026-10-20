async page => {
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:5182/');
  await page.evaluate(() => localStorage.setItem('cdc-coaching/1:session', 'client-thomas-bernard'));
  await page.goto('http://localhost:5182/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SP + 'thomas-d.png' });
  log.push('scroll ' + await page.evaluate(() => { const a = document.querySelector('.accueil'); return a.scrollHeight + '/' + a.clientHeight; }));
  await page.goto('http://localhost:5182/coaching');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: SP + 'thomas-c.png' });
  log.push(await page.evaluate(() => document.querySelector('.carte-vide')?.textContent.replace(/\s+/g,' ') + ' | ' + document.querySelector('.recap-calc').textContent.replace(/\s+/g,' ')));
  // semaine bouclée sur le dashboard de Fabien
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('cdc-coaching/1'));
    const f = s.profils.find(p => p.identifiant === 'fabien.vincent').id;
    const base = s.realisations.find(r => r.clientId === f);
    const d = new Date(); const pad = n => String(n).padStart(2, '0');
    const j = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    for (const w of ['w-fabien-2', 'w-fabien-3']) if (!s.realisations.some(r => r.workoutId === w && r.date === j)) s.realisations.push({ ...base, id: 'test-' + w, workoutId: w, date: j, termineLe: Date.now() });
    localStorage.setItem('cdc-coaching/1', JSON.stringify(s));
    localStorage.setItem('cdc-coaching/1:session', f);
  });
  await page.goto('http://localhost:5182/');
  await page.waitForTimeout(2400);
  await page.screenshot({ path: SP + 'fabien-bouclee.png' });
  await page.goto('http://localhost:5182/bientot/suivi');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: SP + 'bientot.png' });
  log.push('errs ' + JSON.stringify(errs));
  return log.join('\n');
}
