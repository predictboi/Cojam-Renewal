// node capture.js [filter]   Captures every screen of concept D into captures/<screen>-<lang>-<width>.png, animations settled.
// Needs the preview server: python3 -m http.server 8854 -d platform/design-variants/clean
const { chromium } = require('playwright');
const path = require('path');
const BASE = 'http://localhost:8854/';
// [name, file, state, full page?]
const SHOTS = [
  ['index', 'index.html', '', true],
  ['login', 'login.html', '', false], ['login-code', 'login.html', 'code', false], ['login-bademail', 'login.html', 'bademail', false], ['login-setup', 'login.html', 'setup', false],
  ['first-run-1', 'first-run.html', '1', false], ['first-run-2', 'first-run.html', '2', false], ['first-run-3', 'first-run.html', '3', false], ['first-run-code', 'first-run.html', 'code', false],
  ['home', 'home.html', 'fresh', false], ['home-partial', 'home.html', 'partial', false], ['home-armed', 'home.html', 'armed', false], ['home-undo', 'home.html', 'undo', false], ['home-finishing', 'home.html', 'finishing', false],
  ['home-loading', 'home.html', 'loading', false], ['home-empty', 'home.html', 'empty', false], ['home-error', 'home.html', 'error', false], ['home-offline', 'home.html', 'offline', false], ['home-hold', 'home.html', 'hold', false],
  ['home-list', 'home-list.html', 'fresh', true], ['home-list-partial', 'home-list.html', 'partial', true], ['home-list-finishing', 'home-list.html', 'finishing', true],
  ['done', 'done.html', 'results', true], ['done-top', 'done.html', 'results', false], ['done-saving', 'done.html', 'saving', false],
  ['results', 'results.html', '', true], ['results-empty', 'results.html', 'empty', false], ['results-loading', 'results.html', 'loading', false], ['results-error', 'results.html', 'error', false],
  ['ranking', 'ranking.html', '', true], ['ranking-top', 'ranking.html', '', false], ['ranking-top10', 'ranking.html', 'top10', false], ['ranking-unranked', 'ranking.html', 'unranked', false], ['ranking-lastweek', 'ranking.html', 'lastweek', false], ['ranking-hold', 'ranking.html', 'hold', false],
  ['staking', 'staking.html', '', true], ['staking-top', 'staking.html', '', false], ['staking-empty', 'staking.html', 'empty', false], ['staking-above', 'staking.html', 'above', false], ['staking-review', 'staking.html', 'review', false], ['staking-success', 'staking.html', 'success', false], ['staking-hold', 'staking.html', 'hold', false],
  ['stakes', 'stakes.html', '', true], ['stakes-claimable', 'stakes.html', 'claimable', true], ['stakes-empty', 'stakes.html', 'empty', false], ['stakes-loading', 'stakes.html', 'loading', false],
  ['wallet', 'wallet.html', '', true], ['wallet-top', 'wallet.html', '', false], ['wallet-zero', 'wallet.html', 'zero', false], ['wallet-loading', 'wallet.html', 'loading', false], ['wallet-error', 'wallet.html', 'error', false], ['wallet-hold', 'wallet.html', 'hold', true],
  ['convert', 'convert.html', '', false], ['convert-wait', 'convert.html', 'wait', false], ['convert-success', 'convert.html', 'success', false],
  ['deposit', 'deposit.html', '', true], ['withdraw', 'withdraw.html', '', false], ['withdraw-review', 'withdraw.html', 'review', false],
  ['profile', 'profile.html', '', true], ['profile-logout', 'profile.html', 'logout', false],
  ['invite', 'invite.html', '', true], ['invite-top', 'invite.html', '', false], ['invite-empty', 'invite.html', 'empty', true],
  ['hold', 'hold.html', '', true]
];
const SMALL = /^(home|home-partial|home-armed|home-undo|home-finishing|done|done-top|ranking|ranking-top)$/;
(async () => {
  const filter = process.argv[2] ? new RegExp(process.argv[2]) : null;
  const b = await chromium.launch();
  const sizes = [[390, 844, ['en', 'ko', 'ja']], [360, 780, ['en', 'ko']]];
  for (const [w, h, langs] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    for (const [name, file, state, full] of SHOTS) {
      if (filter && !filter.test(name)) continue;
      if (w === 360 && !SMALL.test(name)) continue;
      for (const lang of langs) {
        if (lang === 'ja' && !/^(home|done|ranking|staking|wallet|login|invite)$/.test(name)) continue;
        errs.length = 0;
        await pg.setViewportSize({ width: w, height: h });
        await pg.goto(BASE + 'index.html'); await pg.evaluate(() => sessionStorage.clear());
        await pg.goto(BASE + file + '?lang=' + lang + (state ? '&state=' + state : ''));
        await pg.evaluate(() => document.fonts.ready);
        await pg.waitForTimeout(name === 'login-setup' ? 500 : 1500);
        if (full) { const H = await pg.evaluate(() => document.documentElement.scrollHeight); if (H > h) { await pg.setViewportSize({ width: w, height: H }); await pg.waitForTimeout(250); } }   // a tall viewport keeps the sticky dock at the end of the page
        await pg.screenshot({ path: path.join(__dirname, 'captures', `${name}-${lang}-${w}.png`) });
        if (errs.length) console.log('PAGE ERROR', name, lang, errs.join(' | '));
        if (file === 'home.html' || file === 'home-list.html') { const sh = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight); if (file === 'home.html' && sh > 0) console.log('HOME SCROLLS', name, lang, w, sh); }
      }
    }
    await ctx.close();
  }
  await b.close();
})();
