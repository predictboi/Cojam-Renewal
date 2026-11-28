// node tools/capture-all.js [filter]   -> captures/<screen>-<lang>-<width>.png (animations settled)
const { chromium } = require('playwright'); const path = require('path');
const out = path.join(__dirname, '..', 'captures');
const S = [['login','login.html'],['login-code','login.html?state=code'],['first-run','first-run.html'],['first-run-2','first-run.html?state=2'],['first-run-3','first-run.html?state=3'],
 ['home','home.html'],['home-fresh','home.html?state=fresh'],['home-offline','home.html?state=offline'],['home-loading','home.html?state=loading'],['home-empty','home.html?state=empty'],['home-error','home.html?state=error'],['home-hold','home.html?state=hold'],
 ['home-list','home-list.html'],['done','done.html'],['done-saving','done.html?state=saving'],['results','results.html'],['results-empty','results.html?state=empty'],['ranking','ranking.html'],['ranking-last','ranking.html?state=last'],
 ['staking','staking.html'],['staking-review','staking.html?state=review'],['stakes','stakes.html'],['stakes-empty','stakes.html?state=empty'],['wallet','wallet.html'],['wallet-deposit','wallet.html?state=deposit'],['wallet-withdraw','wallet.html?state=withdraw'],['wallet-offline','wallet.html?state=offline'],
 ['convert','convert.html'],['convert-wait','convert.html?state=wait'],['convert-ok','convert.html?state=ok'],['profile','profile.html'],['invite','invite.html'],['hold','hold.html'],['index','index.html']];
(async () => {
  const f = process.argv[2]; const b = await chromium.launch();
  for (const [w, h, langs, only] of [[390, 844, ['en', 'ko']], [360, 780, ['en', 'ko'], ['home', 'done', 'ranking']], [390, 844, ['ja'], ['home', 'done', 'ranking', 'staking', 'wallet', 'results']]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    for (const lang of langs) for (const [name, page] of S) {
      if (only && !only.includes(name)) continue; if (f && !name.startsWith(f)) continue;
      const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('PAGEERROR', name, lang, e.message));
      await pg.goto('http://localhost:8858/' + page + (page.includes('?') ? '&' : '?') + 'lang=' + lang);
      await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(name === 'home-fresh' ? 2600 : 1100);
      const fit = /^(home|staking-review|wallet-deposit|wallet-withdraw)/.test(name) && !/list/.test(name);
      if (!fit) { const H = await pg.evaluate(() => document.documentElement.scrollHeight); if (H > h) { await pg.setViewportSize({ width: w, height: H }); await pg.waitForTimeout(250); } }   // fixed bars stay at the bottom of a tall capture
      await pg.screenshot({ path: path.join(out, `${name}-${lang}-${w}.png`) });
      await pg.close();
    }
    await ctx.close();
  }
  await b.close();
})();
