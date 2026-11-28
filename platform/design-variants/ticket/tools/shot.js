// node tools/shot.js <page?query> <out.png> [width] [height] [waitMs] [--full]
const { chromium } = require('playwright');
(async () => {
  const [page, out, w = 390, h = 844, wait = 900] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('PAGEERROR', e.message)); pg.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await pg.goto('http://localhost:8858/' + page); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(+wait);
  await pg.screenshot({ path: out, fullPage: process.argv.includes('--full') });
  await b.close();
})();
