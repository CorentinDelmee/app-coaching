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
  await page.goto('http://localhost:5182/seance/w-fabien-circuits?nouvelle=1');
  await page.waitForTimeout(1800);
  const vers = async (i) => { await page.locator('.se-barre button').last().click(); await page.waitForTimeout(900); await page.locator('.tiroir li button').nth(i).click(); await page.waitForTimeout(1300); };
  const lancer = async () => {
    await page.locator('.panel:not([inert]) [data-action]').click(); await page.waitForTimeout(900);
    await page.locator('.panel:not([inert]) [data-action]').click(); await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Commencer maintenant' }).click(); await page.waitForTimeout(1400);
  };
  const txt = (s) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim(), s);
  const valider = async () => { await page.getByRole('button', { name: 'Valider le circuit' }).click(); await page.waitForTimeout(1500); };
  const resultat = () => page.evaluate(() => document.querySelector('.panel:not([inert]) .circuit-fait')?.textContent?.trim());

  // 2 Death by
  await vers(2); await lancer();
  await page.evaluate(() => window.__horloge.regler(60));
  await page.waitForTimeout(2300);
  await page.evaluate(() => window.__horloge.regler(1));
  await page.screenshot({ path: SP + '24-deathby.png' });
  out.push('deathby: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-sous') + ' / ' + await txt('.ch-temps'));
  await page.getByRole('button', { name: 'Échec', exact: true }).click(); await page.waitForTimeout(500);
  out.push('deathby fin: ' + await txt('.ch-temps') + ' ' + await txt('.ch-petit'));
  await valider(); out.push('panel: ' + await resultat());

  // 3 Tabata
  await vers(3); await lancer();
  await page.screenshot({ path: SP + '25-tabata-travail.png' });
  out.push('tabata: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-sous') + ' / ' + await txt('.ch-temps'));
  await page.evaluate(() => window.__horloge.regler(1)); await page.waitForTimeout(100);
  await page.evaluate(() => window.__horloge.regler(5)); await page.waitForTimeout(3000); await page.evaluate(() => window.__horloge.regler(1));
  await page.screenshot({ path: SP + '26-tabata-repos.png' });
  out.push('tabata+: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-sous') + ' / ' + await txt('.ch-temps'));
  await page.evaluate(() => window.__horloge.regler(80)); await page.waitForTimeout(3500); await page.evaluate(() => window.__horloge.regler(1));
  await page.screenshot({ path: SP + '27-tabata-fin.png' });
  out.push('tabata fin: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-temps') + ' ' + await txt('.ch-petit'));
  await valider(); out.push('panel: ' + await resultat());

  // 4 Intervalles 5 x 40/20
  await vers(4); await lancer();
  out.push('interv: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-sous') + ' / ' + await txt('.ch-temps'));
  await page.evaluate(() => window.__horloge.regler(80)); await page.waitForTimeout(4500); await page.evaluate(() => window.__horloge.regler(1));
  out.push('interv fin: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-temps') + ' ' + await txt('.ch-petit'));
  await valider(); out.push('panel: ' + await resultat());

  // 5 Superset
  await vers(5); await lancer();
  await page.screenshot({ path: SP + '28-superset.png' });
  out.push('superset: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-temps'));
  await page.getByRole('button', { name: 'Suivant', exact: true }).click(); await page.waitForTimeout(300);
  out.push('superset B: ' + await txt('.ch-temps'));
  await page.getByRole('button', { name: 'Passage fini' }).click(); await page.waitForTimeout(500);
  await page.screenshot({ path: SP + '29-superset-repos.png' });
  out.push('superset repos: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-temps'));
  await page.getByRole('button', { name: 'Passer le repos' }).click(); await page.waitForTimeout(400);
  out.push('superset 2: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-temps'));
  for (const n of ['Suivant', 'Passage fini', 'Passer le repos', 'Suivant', 'Passage fini']) { await page.getByRole('button', { name: n, exact: true }).click(); await page.waitForTimeout(250); }
  out.push('superset fin: ' + await txt('.ch-phase') + ' / ' + await txt('.ch-temps') + ' ' + await txt('.ch-petit'));
  await valider(); out.push('panel: ' + await resultat());
  return out.join(' || ');
}
