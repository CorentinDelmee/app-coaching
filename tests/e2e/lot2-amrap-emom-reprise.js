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
  await page.evaluate(() => localStorage.clear());
  await seed('fabien.vincent');
  await page.goto('http://localhost:5182/seance/w-fabien-3?nouvelle=1');
  await page.waitForTimeout(1800);
  const vers = async (i) => { await page.locator('.se-barre button').last().click(); await page.waitForTimeout(900); await page.locator('.tiroir li button').nth(i).click(); await page.waitForTimeout(1300); };
  await vers(2);
  await page.locator('.panel:not([inert]) [data-action]').click(); await page.waitForTimeout(900);
  await page.click('[data-voir]'); await page.waitForTimeout(1000); await page.click('[data-pret]'); await page.waitForTimeout(1200); // section du circuit : Voir les exercices, puis Je suis prêt
  await page.getByRole('button', { name: 'Commencer maintenant' }).click(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '+1 tour' }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: '+1 tour' }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Pause', exact: true }).click(); await page.waitForTimeout(400);
  const t1 = await txt('.ch-temps');
  await page.waitForTimeout(1500);
  const t2 = await txt('.ch-temps');
  out.push('pause: ' + await txt('.ch-phrase') + ' ' + t1 + ' -> ' + t2);
  await page.screenshot({ path: SP + '90-pause.png' });
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click(); await page.waitForTimeout(500);
  // rechargement en plein AMRAP
  await page.reload(); await page.waitForTimeout(2300);
  out.push('reprise amrap: ' + await txt('.ch-phrase') + ' ' + await txt('.ch-temps') + ' tours ' + await txt('.ch-tours b'));
  await page.screenshot({ path: SP + '91-reprise-amrap.png' });
  // fin de l'AMRAP : on accélère
  await page.evaluate(() => window.__horloge.regler(80)); await page.waitForTimeout(6500); await page.evaluate(() => window.__horloge.regler(1));
  await page.screenshot({ path: SP + '92-amrap-fin.png' });
  out.push('fin amrap: ' + await txt('.ch-phrase') + ' ' + await txt('.ch-temps') + ' ' + await txt('.reps-plus'));
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Une de plus' }).click();
  await page.getByRole('button', { name: 'Valider le circuit' }).click(); await page.waitForTimeout(1600);
  out.push('panel: ' + await txt('.panel:not([inert]) .circuit-fait') + ' | toast: ' + await txt('.toast-suite'));
  await page.waitForTimeout(3600);
  out.push('suite auto: ' + await txt('.se-titre'));
  // EMOM
  await page.locator('.panel:not([inert]) [data-action]').click(); await page.waitForTimeout(900);
  await page.click('[data-voir]'); await page.waitForTimeout(1000); await page.click('[data-pret]'); await page.waitForTimeout(1200); // section du circuit : Voir les exercices, puis Je suis prêt
  await page.getByRole('button', { name: 'Commencer maintenant' }).click(); await page.waitForTimeout(1300);
  await page.screenshot({ path: SP + '93-emom.png' });
  out.push('emom: ' + await txt('.ch-phrase') + ' / ' + await txt('.ch-sous') + ' / ' + await txt('.ch-temps') + ' / ' + await txt('.ch-petit'));
  await page.evaluate(() => window.__horloge.regler(30)); await page.waitForTimeout(3400);
  await page.screenshot({ path: SP + '94-emom-minute.png' });
  out.push('emom +: ' + await txt('.ch-phrase') + ' / ' + await txt('.ch-sous'));
  await page.waitForTimeout(8000); await page.evaluate(() => window.__horloge.regler(1));
  out.push('emom fin: ' + await txt('.ch-phrase') + ' ' + await txt('.ch-temps') + ' ' + await txt('.ch-petit'));
  return out.join(' || ');
}
