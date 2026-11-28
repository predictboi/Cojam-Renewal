// node tools/shot.js <page[?query]> <out.png> [width] [height] [waitMs] [--full] [--js "code"]
// One capture from the preview server (port 8856): touch on, device scale 2, fonts loaded, motion settled.
const { chromium } = require('playwright');
(async () => {
  const a = process.argv.slice(2), [page, out] = a, w = +a[2] || 390, h = +a[3] || 844, wait = +a[4] || 900;
  const full = a.includes('--full'), js = a.includes('--js') ? a[a.indexOf('--js') + 1] : null;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('http://localhost:8856/' + page, { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  if (js) await pg.evaluate(js);
  await pg.waitForTimeout(wait);
  if (full) { const H = await pg.evaluate(() => document.documentElement.scrollHeight); await pg.setViewportSize({ width: w, height: Math.max(h, H) }); await pg.waitForTimeout(200); }
  await pg.screenshot({ path: out });
  if (errs.length) console.log('ERRORS ' + page + ': ' + errs.join(' | '));
  await b.close();
})();
