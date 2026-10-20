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
