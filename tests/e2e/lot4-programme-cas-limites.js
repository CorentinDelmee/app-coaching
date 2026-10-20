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
  await page.goto('http://localhost:5182/');
  // Léa : programme par semaine de 4 semaines
  await seed('lea.martin');
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
  // aucun programme : on retire celui de Fabien (le coach, lui, n'a pas cet écran)
  await seed('fabien.vincent');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cdc-coaching/1')); s.programmes = s.programmes.filter((p) => p.clientId !== 'client-fabien-vincent'); localStorage.setItem('cdc-coaching/1', JSON.stringify(s)); });
  await page.goto('http://localhost:5182/programme');
  await page.waitForTimeout(2000);
  log.push('AUCUN ' + await page.evaluate(() => document.querySelector('.vide-prog')?.textContent.replace(/\s+/g,' ')));
  await page.screenshot({ path: SP + 'aucun.png' });
  log.push('errs ' + JSON.stringify(errs));
  return log.join('\n');
}
