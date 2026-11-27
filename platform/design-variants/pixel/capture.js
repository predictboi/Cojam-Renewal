/* Captures every screen of the Pixel concept. Run from the repository root with the preview on port 8853:
   python3 -m http.server 8853 -d platform/design-variants/pixel   then   node platform/design-variants/pixel/capture.js
   Files: captures/<screen>-<lang>-<width>.png (the viewport), plus <screen>-full-<lang>-<width>.png for screens that scroll. */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'captures');
const SCREENS = [
  ['index', 'index.html', 'full'],
  ['login', 'login.html'], ['login-error', 'login.html?state=error'], ['login-code', 'login.html?state=code'], ['login-setup', 'login.html?state=setup'],
  ['first-run', 'first-run.html?step=1'], ['first-run-code', 'first-run.html?step=1&state=code'], ['first-run-2', 'first-run.html?step=2'], ['first-run-3', 'first-run.html?step=3'],
  ['home', 'home.html?still=1'], ['home-partial', 'home.html?state=partial'], ['home-armed', 'home.html?still=1', 'drag'], ['home-undo', 'home.html?still=1', 'pick'], ['home-finishing', 'home.html?state=finishing'],
  ['home-loading', 'home.html?state=loading'], ['home-empty', 'home.html?state=empty'], ['home-error', 'home.html?state=error'], ['home-offline', 'home.html?state=offline'], ['home-hold', 'home.html?state=hold'],
  ['home-list', 'home-list.html', 'full'], ['home-list-partial', 'home-list.html?state=partial', 'full'], ['home-list-finishing', 'home-list.html?state=finishing', 'full'],
  ['done', 'done.html', 'full'], ['done-saving', 'done.html?state=saving'],
  ['results', 'results.html', 'full'], ['results-empty', 'results.html?state=empty'], ['results-loading', 'results.html?state=loading'], ['results-error', 'results.html?state=error'],
  ['ranking', 'ranking.html', 'full'], ['ranking-last', 'ranking.html?state=last'], ['ranking-none', 'ranking.html?state=none'], ['ranking-loading', 'ranking.html?state=loading'], ['ranking-hold', 'ranking.html?state=hold'],
  ['staking', 'staking.html', 'full'], ['staking-error', 'staking.html?state=error'], ['staking-zero', 'staking.html?state=zero'], ['staking-review', 'staking.html?state=review'], ['staking-hold', 'staking.html?state=hold'],
  ['stakes', 'stakes.html', 'full'], ['stakes-empty', 'stakes.html?state=empty'], ['stakes-loading', 'stakes.html?state=loading'],
  ['wallet', 'wallet.html', 'full'], ['wallet-loading', 'wallet.html?state=loading'], ['wallet-error', 'wallet.html?state=error'], ['hold', 'wallet.html?state=hold', 'full'],
  ['convert', 'convert.html'], ['convert-wait', 'convert.html?state=wait'], ['convert-short', 'convert.html?state=short'],
  ['profile', 'profile.html', 'full'], ['invite', 'invite.html', 'full'], ['invite-empty', 'invite.html?state=empty']
];
const SMALL = ['home', 'done', 'ranking'];
(async () => {
  const b = await chromium.launch(); const only = process.argv[2];
  async function shot(name, url, mode, lang, w, h) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8853/' + url + (url.includes('?') ? '&' : '?') + 'lang=' + lang);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2400);   /* reward and teach animations settle */
    if (mode === 'drag' || mode === 'pick') {
      const box = await p.locator('.qcard.is-front').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await p.mouse.move(cx, cy); await p.mouse.down(); for (let i = 1; i <= 15; i++) await p.mouse.move(cx + i * 10, cy, { steps: 2 });
      await p.waitForTimeout(150); if (mode === 'pick') { await p.mouse.up(); await p.waitForTimeout(700); }
    }
    await p.screenshot({ path: path.join(OUT, `${name}-${lang}-${w}.png`) });
    if (mode === 'full') {
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      if (H > h + 8) { await p.setViewportSize({ width: w, height: H }); await p.waitForTimeout(250); await p.screenshot({ path: path.join(OUT, `${name}-full-${lang}-${w}.png`) }); }
    }
    await c.close(); if (errs.length) console.log(name, lang, w, 'page errors:', errs.join(' | '));
  }
  for (const [name, url, mode] of SCREENS) {
    if (only && !name.startsWith(only)) continue;
    for (const lang of ['en', 'ko']) await shot(name, url, mode, lang, 390, 844);
    if (name === 'home' || name === 'done' || name === 'ranking' || name === 'wallet' || name === 'staking') await shot(name, url, mode, 'ja', 390, 844);
    if (SMALL.includes(name)) for (const lang of ['en', 'ko']) await shot(name, url, mode === 'full' ? '' : mode, lang, 360, 780);
  }
  await b.close(); console.log('captures written to', OUT);
})();
