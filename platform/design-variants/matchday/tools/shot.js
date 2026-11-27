// node tools/shot.js "<page?query>" <out.png> [width] [height] [waitMs] [--full] : one capture from the local preview (port 8857).
const { chromium } = require('playwright');
(async () => {
  const [page, out, w = 390, h = 844, wait = 1600] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('PAGEERROR', page, e.message));
  await pg.goto('http://localhost:8857/' + page, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(+wait);
  await pg.screenshot({ path: out, fullPage: process.argv.includes('--full') }); await b.close();
})();
