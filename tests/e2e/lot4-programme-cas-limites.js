async page => {
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:5182/');
  // Léa : programme par semaine de 4 semaines
  await page.evaluate(() => { localStorage.setItem('cdc-coaching/1:session', 'client-lea-martin'); });
  await page.goto('http://localhost:5182/programme');
  await page.waitForTimeout(2200);
  log.push('LEA ' + await page.evaluate(() => document.querySelector('.p-entete').textContent.replace(/\s+/g,' ') + ' | ' + [...document.querySelectorAll('.ligne-w .wt')].map(x => x.textContent.replace(/\s+/g,' ')).join(' ; ')));
  await page.screenshot({ path: SP + 'lea-1.png' });
  // avancer jusqu'à la fin
  for (let i = 0; i < 6; i++) {
    const dis = await page.getAttribute('[aria-label="Semaine suivante"]', 'disabled');
    if (dis !== null) break;
    await page.click('[aria-label="Semaine suivante"]');
    await page.waitForTimeout(900);
    log.push(await page.evaluate(() => document.querySelector('.nav-titre').textContent.replace(/\s+/g,' ') + ' => ' + (document.querySelector('.vide-prog h2')?.textContent || 'workouts:' + document.querySelectorAll('.ligne-w').length)));
  }
  await page.screenshot({ path: SP + 'lea-fin.png' });
  // avant le début
  await page.goto('http://localhost:5182/programme?semaine=2026-09-07');
  await page.waitForTimeout(2000);
  log.push('AVANT ' + await page.evaluate(() => document.querySelector('.vide-prog')?.textContent.replace(/\s+/g,' ')));
  // aucun programme : le coach (pas de programme)
  await page.evaluate(() => { localStorage.setItem('cdc-coaching/1:session', 'coach-corentin'); });
  await page.goto('http://localhost:5182/programme');
  await page.waitForTimeout(2000);
  log.push('AUCUN ' + await page.evaluate(() => document.querySelector('.vide-prog')?.textContent.replace(/\s+/g,' ')));
  await page.screenshot({ path: SP + 'aucun.png' });
  await page.evaluate(() => { localStorage.setItem('cdc-coaching/1:session', 'client-fabien-vincent'); });
  log.push('errs ' + JSON.stringify(errs));
  return log.join('\n');
}
