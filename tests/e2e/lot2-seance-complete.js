async page => {
  // Session démo : ouvre le compte (et enregistre le consentement) comme après /connexion, sans repasser par l'écran (voir README).
  const seed = async (compte) => {
    await page.goto('http://localhost:5182/bienvenue');
    // les données de démo ne se créent qu'au premier accès avec une session : on en pose une bidon puis on recharge
    if (await page.evaluate(() => !localStorage.getItem('cdc-coaching/1'))) {
      await page.evaluate(() => localStorage.setItem('cdc-coaching/1:session', 'amorce'));
      await page.reload();
    }
    await page.evaluate((c) => {
      const s = JSON.parse(localStorage.getItem('cdc-coaching/1'));
      const p = s.profils.find((x) => x.identifiant === c);
      p.consentementLe = Date.now();
      p.preferences = { ...p.preferences, consentement: { version: '2026-10-v1', sante: true } };
      localStorage.setItem('cdc-coaching/1', JSON.stringify(s));
      localStorage.setItem('cdc-coaching/1:session', p.id);
    }, compte);
  };
  await seed('fabien.vincent');
  const SP = 'captures/';
  const log = [];
  await page.goto('http://localhost:5182/seance/w-fabien-2?nouvelle=1&vitesse=30');
  await page.waitForTimeout(1800);
  const action = page.locator('.panel:not([inert]) [data-action]');
  for (let n = 0; n < 40; n++) {
    const fin = await page.locator('.fin:not([hidden])').count();
    if (fin) break;
    const t = (await action.first().textContent()).trim();
    log.push(t);
    await action.first().click();
    // attend la fin d'un éventuel chrono (repos) puis de l'avance automatique
    for (let k = 0; k < 40; k++) {
      await page.waitForTimeout(150);
      const busy = await page.evaluate(() => { const c = document.querySelector('.chrono'); return !!c && !c.hidden; });
      if (!busy) break;
    }
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(3500);
  await page.screenshot({ path: SP + '07-fin.png' });
  const stats = await page.evaluate(() => [...document.querySelectorAll('.fin .st')].map(s => s.textContent.replace(/\s+/g, ' ').trim()));
  return log.join(' / ') + ' ## ' + JSON.stringify(stats);
}
