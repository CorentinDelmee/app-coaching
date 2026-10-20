async page => {
  const SP = 'captures/';
  const out = [];
  const txt = (s) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim(), s);
  await page.goto('http://localhost:5182/seance/w-fabien-1?nouvelle=1');
  await page.waitForTimeout(1800);
  await page.locator('.panel:not([inert]) [data-action]').click();
  await page.waitForTimeout(3000);
  out.push('repos: ' + await txt('.ch-temps'));
  // ferme l'app (retour à l'accueil par URL) : invitation à reprendre
  await page.goto('http://localhost:5182/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SP + '40-reprise-invite.png' });
  out.push('invite: ' + await page.evaluate(() => document.querySelector('.reprise')?.textContent?.replace(/\s+/g, ' ').trim()));
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await page.waitForTimeout(2500);
  out.push('apres reprise: ' + await txt('.ch-phase') + ' ' + await txt('.ch-temps') + ' ' + page.url());
  await page.screenshot({ path: SP + '41-reprise.png' });
  // pastille : on réduit le repos
  await page.getByRole('button', { name: 'Réduire le repos' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SP + '42-pastille.png' });
  out.push('pastille: ' + await txt('.pastille'));
  await page.locator('.pastille').click();
  await page.waitForTimeout(1200);
  out.push('rouvert: ' + await txt('.ch-temps'));
  await page.getByRole('button', { name: 'Passer', exact: true }).click();
  await page.waitForTimeout(1200);
  out.push('chrono ferme: ' + await page.evaluate(() => { const c = document.querySelector('.chrono'); return !c || c.hidden; }));
  // abandonner sur la page d'accueil
  await page.goto('http://localhost:5182/');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Abandonner', exact: true }).click();
  await page.waitForTimeout(800);
  out.push('apres abandon: ' + await page.evaluate(() => localStorage.getItem('cdc-coaching/seance-en-cours')));
  return out.join(' || ');
}
