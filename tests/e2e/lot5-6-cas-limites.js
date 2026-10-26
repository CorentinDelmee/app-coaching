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
  await seed('thomas.bernard');
  // Thomas a désormais une séance (démo Google Agenda) : on la retire pour tester le cas « aucune séance prévue »
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('cdc-coaching/1'));
    const t = s.profils.find(p => p.identifiant === 'thomas.bernard').id;
    s.seancesCoaching = s.seancesCoaching.filter(x => x.clientId !== t);
    localStorage.setItem('cdc-coaching/1', JSON.stringify(s));
    // ... et on vide le faux agenda Google (sinon la synchro lui rend sa séance)
    localStorage.setItem('cdc-coaching/1:agenda', JSON.stringify({ syncToken: 'vide', evenements: {}, derniereSynchro: Date.now() }));
  });
  await page.goto('http://localhost:5182/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SP + 'thomas-d.png' });
  log.push('scroll ' + await page.evaluate(() => { const a = document.querySelector('.accueil'); return a.scrollHeight + '/' + a.clientHeight; }));
  await page.goto('http://localhost:5182/coaching');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: SP + 'thomas-c.png' });
  log.push(await page.evaluate(() => document.querySelector('.carte-vide')?.textContent.replace(/\s+/g,' ') + ' | ' + document.querySelector('.stat-accent')?.textContent.replace(/\s+/g,' ')));
  // semaine bouclée sur le dashboard de Fabien
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('cdc-coaching/1'));
    const f = s.profils.find(p => p.identifiant === 'fabien.vincent').id;
    const base = s.realisations.find(r => r.clientId === f);
    const d = new Date(); const pad = n => String(n).padStart(2, '0');
    const j = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    for (const w of ['w-fabien-2', 'w-fabien-3']) if (!s.realisations.some(r => r.workoutId === w && r.date === j)) s.realisations.push({ ...base, id: 'test-' + w, workoutId: w, date: j, termineLe: Date.now() });
    localStorage.setItem('cdc-coaching/1', JSON.stringify(s));
    localStorage.setItem('cdc-coaching/1:session', f);
  });
  await page.goto('http://localhost:5182/');
  await page.waitForTimeout(2400);
  await page.screenshot({ path: SP + 'fabien-bouclee.png' });
  await page.goto('http://localhost:5182/bientot/suivi');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: SP + 'bientot.png' });
  log.push('errs ' + JSON.stringify(errs));
  return log.join('\n');
}
