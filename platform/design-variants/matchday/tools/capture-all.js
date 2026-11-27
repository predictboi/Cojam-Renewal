// node tools/capture-all.js [filter] : every screen at 390x844 in EN and KO (full page), home, done and ranking also at 360x780, home in JA. Animations settled.
const { chromium } = require('playwright'); const path = require('path'); const pages = require('./pages');
const out = path.join(__dirname, '..', 'captures'); const filter = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  async function shot(name, page, lang, w, h) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ' ' + lang + ': ' + e.message));
    await pg.goto('http://localhost:8857/' + page + (page.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(1700);
    const sheet = await pg.locator('.sheet').count();
    if (!sheet && !/^home($|-)/.test(name)) { const H = await pg.evaluate(() => document.documentElement.scrollHeight); if (H > h) { await pg.setViewportSize({ width: w, height: H }); await pg.waitForTimeout(250); } } // long screens: the whole page, tab bar at the end
    await pg.screenshot({ path: path.join(out, `${name}-${lang}-${w}.png`) });
    await ctx.close();
  }
  for (const [name, page] of pages) {
    if (filter && !name.includes(filter)) continue;
    for (const lang of ['en', 'ko']) await shot(name, page, lang, 390, 844);
    if (['home', 'home-partial', 'done', 'ranking'].includes(name)) for (const lang of ['en', 'ko']) await shot(name, page, lang, 360, 780);
    if (['home', 'done', 'ranking', 'results', 'index'].includes(name)) await shot(name, page, 'ja', 390, 844);
    if (name === 'index') for (const w of [360, 440]) await shot(name, page, 'ko', w, 780);
  }
  await b.close(); console.log(errs.length ? 'PAGE ERRORS\n' + errs.join('\n') : 'no page errors');
})();
