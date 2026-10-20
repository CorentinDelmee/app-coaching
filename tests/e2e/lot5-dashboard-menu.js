async page => {
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5182/');
  await page.evaluate(() => { localStorage.removeItem('cdc-coaching/seance-en-cours'); localStorage.setItem('cdc-coaching/1:session', 'client-fabien-vincent'); });
  await page.reload();
  await page.waitForTimeout(500);
  await page.screenshot({ path: SP + 'd-0.png' });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: SP + 'd-1.png' });
  log.push(await page.evaluate(() => { const a = document.querySelector('.accueil'); return 'scroll ' + a.scrollHeight + '/' + a.clientHeight; }));
  // menu
  await page.click('.btn-menu');
  await page.waitForTimeout(350);
  await page.screenshot({ path: SP + 'm-1.png' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SP + 'm-2.png' });
  log.push('expanded ' + await page.getAttribute('.btn-menu', 'aria-expanded'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  log.push('after esc hidden=' + await page.evaluate(() => document.querySelector('.menu-app').hidden));
  // menu -> Coaching
  await page.click('.btn-menu');
  await page.waitForTimeout(1300);
  await page.click('.m-item:has-text("Coaching")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: SP + 'm-balai.png' });
  await page.waitForTimeout(2200);
  log.push(page.url());
  await page.screenshot({ path: SP + 'c-1.png' });
  log.push('errs ' + JSON.stringify(errs));
  return log.join('\n');
}
