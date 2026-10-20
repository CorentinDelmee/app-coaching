async page => {
  const entrer = async (reset, id) => {
    await page.goto('http://localhost:5182/');
    await page.evaluate(([reset, id]) => { if (reset) localStorage.clear(); localStorage.setItem('cdc-coaching/1:session', id); }, [reset, id]);
    await page.reload(); await page.waitForTimeout(700);
    // le client a déjà accepté les données de santé (sinon la garde renvoie vers /consentement)
    await page.evaluate((id) => { const d = JSON.parse(localStorage.getItem('cdc-coaching/1')); const p = d.profils.find((x) => x.id === id); p.consentementLe = Date.now(); p.preferences = { ...p.preferences, consentement: { version: '2026-10-v1', sante: true } }; localStorage.setItem('cdc-coaching/1', JSON.stringify(d)); }, id);
  };
  const SP = 'captures/';
  const log = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await entrer(true, 'client-thomas-bernard');
  await page.addInitScript(() => { window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; });
  await page.goto('http://localhost:5182/questionnaires/q-checkin-quotidien');
  await page.waitForTimeout(2300);
  await page.screenshot({ path: SP + 'c-1.png' });
  const r = await page.locator('.cd-rail').boundingBox();
  await page.mouse.move(r.x + 5, r.y + 36); await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.7, r.y + 36, { steps: 8 });
  await page.screenshot({ path: SP + 'c-drag.png' });
  await page.mouse.up();
  log.push('val ' + await page.textContent('.cd-val .v') + ' vib ' + await page.evaluate(() => window.__vib.length));
  await page.click('.qz-bas .gros'); await page.waitForTimeout(1500);
  await page.screenshot({ path: SP + 'c-2.png' });
  await page.click('.emoji >> nth=4'); await page.waitForTimeout(1900); // auto
  log.push('q3 ' + await page.textContent('.qz-q h2'));
  await page.screenshot({ path: SP + 'c-3.png' });
  await page.keyboard.press('Tab');
  await page.click('.qz-bas .gros'); await page.waitForTimeout(1400); // stress -> douleur
  log.push('q4 ' + await page.textContent('.qz-q h2'));
  const r2 = await page.locator('.cd-rail').boundingBox();
  await page.mouse.click(r2.x + r2.width * 0.85, r2.y + 36); await page.waitForTimeout(500);
  log.push('douleur ' + await page.textContent('.cd-val .v'));
  await page.screenshot({ path: SP + 'c-4.png' });
  await page.click('.qz-bas .gros'); await page.waitForTimeout(1400);
  await page.click('.choix button >> nth=1'); await page.waitForTimeout(1600);
  log.push('q6 ' + await page.textContent('.qz-q h2'));
  await page.click('.nombre-tuile'); await page.waitForTimeout(1200); await page.click('.roue-couche .gros'); await page.waitForTimeout(900);
  await page.click('.qz-bas .gros'); await page.waitForTimeout(500);
  await page.screenshot({ path: SP + 'c-fin-a.png' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: SP + 'c-fin.png' });
  log.push('fin ' + await page.evaluate(() => document.querySelector('.qz-fin').innerText.replace(/\n+/g, ' | ')));
  log.push('alertes? ' + await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('cdc-coaching/1')).reponses.filter(r => r.clientId.includes('thomas') && r.valeurs.douleur > 6).map(r => r.valeurs))));
  return log.join('\n') + '\nerrs ' + JSON.stringify(errs);
}
