async page => {
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:5182/workout/w-fabien-3');
  await page.waitForTimeout(2200);
  await page.evaluate(() => { document.querySelector('.defile').scrollTop = 420; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: SP + 'w3-circuits.png' });
  // Démarrer : captures en cours de transition
  await page.click('.dock-bas .gros');
  await page.waitForTimeout(250);
  await page.screenshot({ path: SP + 'lancement-1.png' });
  await page.waitForTimeout(450);
  await page.screenshot({ path: SP + 'lancement-2.png' });
  await page.waitForTimeout(1800);
  log.push(page.url());
  await page.screenshot({ path: SP + 'seance-apres.png' });
  log.push('errs ' + JSON.stringify(errs));
  return log.join(' || ');
}
