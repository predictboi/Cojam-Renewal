// node tools/capture-all.js : every screen at 390 x 844 in EN and KO, plus home, done and ranking at 360 x 780, into captures/<screen>-<lang>-<width>.png
// Also a few named states (suffix after the screen name). Preview server on port 8851. Animations settled before each capture.
const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, '..', 'captures');
const SCREENS = [
  ['gate', 'gate.html?state=android'], ['gate-ios', 'gate.html?state=ios'], ['gate-invited', 'gate.html?state=invited'], ['gate-desktop', 'gate.html?state=desktop'],
  ['login', 'login.html'], ['login-code', 'login.html?state=code'], ['first-run', 'first-run.html'], ['first-run-2', 'first-run.html?state=2'], ['first-run-3', 'first-run.html?state=3'],
  ['home', 'home.html?state=fresh'], ['home-partial', 'home.html?state=partial'], ['home-drag', 'home.html?state=fresh', 'drag'], ['home-undo', 'home.html?state=fresh', 'pick'],
  ['home-slow', 'home.html?state=slow'], ['home-otherdevice', 'home.html?state=otherdevice'], ['home-noimage', 'home.html?state=noimage'],
  ['home-hold', 'home.html?state=hold'], ['home-empty', 'home.html?state=empty'], ['home-loading', 'home.html?state=loading'], ['home-error', 'home.html?state=error'],
  ['home-list', 'home-list.html?state=fresh'], ['home-list-sample', 'home-list.html'],
  ['done', 'done.html'], ['results', 'results.html'], ['results-open', 'results.html?state=open'], ['results-empty', 'results.html?state=empty'], ['ranking', 'ranking.html'], ['ranking-lastweek', 'ranking.html?state=lastweek'], ['ranking-hold', 'ranking.html?state=hold'],
  ['staking', 'staking.html'], ['staking-info', 'staking.html', 'info'], ['staking-review', 'staking.html?state=review'], ['staking-success', 'staking.html?state=success'], ['staking-failed', 'staking.html?state=failed'], ['staking-hold', 'staking.html?state=hold'],
  ['stakes', 'stakes.html'], ['stakes-empty', 'stakes.html?state=empty'], ['stakes-hold-nokaia', 'stakes.html?state=hold-nokaia'],
  ['wallet', 'wallet.html'], ['wallet-info', 'wallet.html', 'info'], ['wallet-hold', 'wallet.html?state=hold'],
  ['convert', 'convert.html'], ['convert-hold', 'convert.html?state=hold'], ['deposit', 'deposit.html'], ['withdraw', 'withdraw.html?state=filled'], ['withdraw-nokaia', 'withdraw.html?state=nokaia'], ['withdraw-review', 'withdraw.html?state=review'],
  ['profile', 'profile.html'], ['profile-code', 'profile.html?state=code-valid'], ['profile-hold', 'profile.html?state=hold'], ['invite', 'invite.html'], ['invite-hold', 'invite.html?state=hold'],
  ['system-blocked', 'system.html?state=blocked'], ['system-maintenance', 'system.html?state=maintenance'], ['system-offline', 'system.html?state=offline'], ['system-update', 'system.html?state=update'], ['system-notfound', 'system.html?state=notfound']
];
const SMALL = ['home', 'home-partial', 'done', 'ranking', 'wallet', 'staking', 'gate'];
(async () => {
  const b = await chromium.launch();
  async function shot(name, url, lang, w, h, act) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
    await pg.goto('http://localhost:8851/' + url + (url.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(1500);   // stamps have landed, rows have set, figures have stopped rolling
    if (act === 'drag') {   // the card held past the commit threshold: the stamp is solid, the answer button hot
      const box = await pg.locator('.qcard[data-pos="0"]').boundingBox();
      await pg.evaluate(([x, y, w]) => { const c = document.querySelector('.qcard[data-pos="0"]'); const ev = (t, dx) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 7, clientX: x + dx, clientY: y, pointerType: 'touch', isPrimary: true })); ev('pointerdown', 0); ev('pointermove', 20); ev('pointermove', w * 0.42); }, [box.x + box.width / 2, box.y + box.height / 2, box.width]);
      await pg.waitForTimeout(350);
    }
    if (act === 'info') { await pg.locator('.qbtn').first().tap(); await pg.waitForTimeout(600); }
    if (act === 'pick') { await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').click(); await pg.waitForTimeout(700); }
    await pg.screenshot({ path: path.join(out, name + '-' + lang + '-' + w + '.png') });
    const bad = await pg.evaluate(() => (document.body.innerText.match(/\[[a-z]+\.[a-z0-9.]+\]/g) || []).join(' '));
    if (errs.length || bad) console.log(name, lang, w, errs.join(' | '), bad);
    await ctx.close();
  }
  for (const [name, url, act] of SCREENS) for (const lang of ['en', 'ko']) await shot(name, url, lang, 390, 844, act);
  for (const [name, url, act] of SCREENS) if (SMALL.includes(name)) for (const lang of ['en', 'ko']) await shot(name, url, lang, 360, 780, act);
  for (const [name, url] of [['home', 'home.html?state=fresh'], ['home-list', 'home-list.html?state=fresh'], ['done', 'done.html'], ['ranking', 'ranking.html'], ['results', 'results.html'], ['wallet', 'wallet.html'], ['staking', 'staking.html'], ['stakes', 'stakes.html'], ['invite', 'invite.html'], ['profile', 'profile.html'], ['login', 'login.html'], ['first-run', 'first-run.html'], ['gate', 'gate.html?state=ios']]) await shot(name, url, 'ja', 390, 844);
  await b.close();
})();
