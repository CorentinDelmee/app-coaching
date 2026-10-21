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
  const out = [];
  // les chiffres en roulette (V2) portent leur valeur dans .sr-seul : on lit celle-là quand elle existe
  const txt = (s) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return undefined; const v = e.querySelector('.sr-seul'); return (v || e).textContent.trim(); }, s);
  await page.goto('http://localhost:5182/');
  await page.evaluate(() => { localStorage.clear(); });
  await seed('fabien.vincent');
  await page.goto('http://localhost:5182/seance/w-fabien-1?nouvelle=1&vitesse=40');
  await page.waitForTimeout(1800);
  // série 1 du squat : poids +5 kg (10 crans de 0,5)
  await page.locator('.panel:not([inert]) .rang').nth(0).click(); await page.waitForTimeout(1300);
  await page.locator('.detail [data-champ="poids"]').click(); await page.waitForTimeout(1300);
  await page.evaluate(() => { const r = document.querySelector('.roue'); r.scrollTo({ top: r.scrollTop + 104 * 10, behavior: 'instant' }); });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Valider', exact: true }).click(); await page.waitForTimeout(1700);
  out.push('series: ' + await page.evaluate(() => [...document.querySelectorAll('.detail .champ .v')].map(x => x.textContent).join('/')));
  await page.getByRole('button', { name: 'Fermer' }).first().click(); await page.waitForTimeout(900);
  out.push('lignes: ' + await page.evaluate(() => [...document.querySelectorAll('.panel[data-i="0"] .rang .rg-v')].map(r => r.textContent.replace(/\s+/g,'')).join(' ')));
  const action = page.locator('.panel:not([inert]) [data-action]');
  for (let n = 0; n < 40; n++) {
    if (await page.locator('.fin:not([hidden])').count()) break;
    await action.first().click();
    for (let k = 0; k < 60; k++) { await page.waitForTimeout(120); const busy = await page.evaluate(() => { const c = document.querySelector('.chrono'); return !!c && !c.hidden; }); if (!busy) break; }
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(3600);
  await page.screenshot({ path: SP + '70-fin-record.png' });
  out.push('fin: ' + await page.evaluate(() => [...document.querySelectorAll('.fin .st')].map(s => s.textContent.replace(/\s+/g, ' ').trim()).join(' | ')));
  await page.getByRole('button', { name: 'Laisser un mot' }).click();
  await page.locator('.fin textarea').fill('Genou droit un peu sensible');
  await page.getByRole('button', { name: 'Valider ma séance' }).click();
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('cdc-coaching/1')); const x = d.realisations[d.realisations.length - 1]; const t = d.templates.find(t => t.id === x.clientId); return { commentaire: x.commentaire, nb: d.realisations.length, tpl: t.valeurs['w-fabien-1']['w1-b1'].map(s => s && s.poids), dateOk: x.date, vol: x.volume, circuits: x.circuits }; });
  out.push('realisation: ' + JSON.stringify(r));
  await page.goto('http://localhost:5182/seance/w-fabien-1');
  await page.waitForTimeout(1800);
  out.push('prerempli: ' + await page.evaluate(() => [...document.querySelectorAll('.panel[data-i="0"] .rang .rg-v')].map(r => r.textContent.replace(/\s+/g,'')).join(' ')));
  return out.join('\n');
}
