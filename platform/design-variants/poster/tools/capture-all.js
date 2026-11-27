// node tools/capture-all.js [filter] : every screen at 390x844 in EN and KO, home/done/ranking also at 360x780, a few JA, into captures/<screen>-<lang>-<width>.png
const { chromium } = require('playwright'); const path = require('path');
const out = path.join(__dirname, '..', 'captures'), filter = process.argv[2];
const S = [ ['login', 'login.html'], ['login-code', 'login.html?state=code'], ['first-run', 'first-run.html'], ['first-run-2', 'first-run.html?step=2'], ['first-run-3', 'first-run.html?step=3'],
  ['home', 'home.html', 1], ['home-partial', 'home.html?state=partial', 1], ['home-drag', 'home.html', 0, 'drag'], ['home-hint', 'home.html', 0, 'hint'], ['home-undo', 'home.html', 0, 'undo'], ['home-finishing', 'home.html?state=partial', 0, 'fin'],
  ['home-empty', 'home.html?state=empty'], ['home-loading', 'home.html?state=loading'], ['home-error', 'home.html?state=error'], ['home-offline', 'home.html?state=offline'], ['home-hold', 'home.html?state=hold'],
  ['home-list', 'home-list.html?state=partial'], ['done', 'done.html', 1], ['done-saving', 'done.html?state=saving'], ['results', 'results.html'], ['results-empty', 'results.html?state=empty'],
  ['ranking', 'ranking.html', 1], ['ranking-lastweek', 'ranking.html?state=lastweek'], ['staking', 'staking.html'], ['staking-review', 'staking.html?state=review'], ['stakes', 'stakes.html'], ['stakes-empty', 'stakes.html?state=empty'],
  ['wallet', 'wallet.html'], ['wallet-deposit', 'wallet.html?state=deposit'], ['wallet-withdraw', 'wallet.html?state=withdraw'], ['wallet-loading', 'wallet.html?state=loading'], ['wallet-offline', 'wallet.html?state=offline'],
  ['convert', 'convert.html'], ['convert-wait', 'convert.html?state=wait'], ['profile', 'profile.html'], ['invite', 'invite.html'], ['hold', 'hold.html'], ['index', 'index.html'] ];
const FULL = ['done', 'results', 'ranking', 'stakes', 'wallet', 'profile', 'invite', 'hold', 'index', 'staking', 'login', 'home-list'];
(async () => {
  const b = await chromium.launch();
  async function shot(name, url, lang, w, h, act, full) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('ERR', name, lang, e.message));
    await pg.goto('http://localhost:8856/' + url + (url.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(700);
    if (act === 'hint') { const c = await pg.$('.card[data-pos="0"]'); const r = await c.boundingBox(); await pg.evaluate(([x, y]) => { const el = document.querySelector('.card[data-pos="0"]'); const f = (t, dx) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x + dx, clientY: y, isPrimary: true })); f('pointerdown', 0); f('pointermove', -30); f('pointermove', -85); }, [r.x + r.width / 2, r.y + r.height / 2]); await pg.waitForTimeout(250); }
    if (act === 'drag') { const c = await pg.$('.card[data-pos="0"]'); const r = await c.boundingBox(); await pg.evaluate(([x, y]) => { const el = document.querySelector('.card[data-pos="0"]'); const f = (t, dx) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x + dx, clientY: y, isPrimary: true })); f('pointerdown', 0); f('pointermove', 30); f('pointermove', 90); f('pointermove', 150); }, [r.x + r.width / 2, r.y + r.height / 2]); await pg.waitForTimeout(200); }
    if (act === 'undo') { await pg.evaluate(() => window.__deck.commit('r')); await pg.waitForTimeout(700); }
    if (act === 'fin') { await pg.evaluate(() => { __deck.commit('r'); }); await pg.waitForTimeout(450); await pg.evaluate(() => { __deck.commit('l'); }); await pg.waitForTimeout(450); await pg.evaluate(() => { __deck.commit('r'); }); await pg.waitForTimeout(600); }
    if (full) { const H = await pg.evaluate(() => document.documentElement.scrollHeight); await pg.setViewportSize({ width: w, height: Math.max(h, H) }); await pg.waitForTimeout(250); }
    await pg.screenshot({ path: path.join(out, name + (full ? '-full' : '') + '-' + lang + '-' + w + '.png') }); await ctx.close();
  }
  const jobs = [];
  for (const [name, url, small, act] of S) { if (filter && !name.startsWith(filter)) continue;
    for (const lang of ['en', 'ko']) { jobs.push([name, url, lang, 390, 844, act]); if (small) jobs.push([name, url, lang, 360, 780, act]); if (FULL.includes(name)) jobs.push([name, url, lang, 390, 844, act, true]); }
    if (['home', 'done', 'ranking', 'login', 'wallet'].includes(name)) jobs.push([name, url, 'ja', 390, 844, act]); }
  for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map(j => shot(...j)));
  await b.close(); console.log(jobs.length + ' captures');
})();
