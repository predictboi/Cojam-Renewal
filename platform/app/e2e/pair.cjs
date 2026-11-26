// Side by side capture: the app (mock build on APP port) and the design prototype (on DESIGN port).
// node e2e/pair.cjs <appPath> <designFile> <name> [lang] [width]
const { chromium } = require('playwright');
const [appPath, designFile, name, lang = 'en', W = '390'] = process.argv.slice(2);
const APP = 'http://localhost:' + (process.env.APP_PORT || 4180), DES = 'http://localhost:' + (process.env.DESIGN_PORT || 8822);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +W, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errs = [];
  const p1 = await ctx.newPage(); p1.on('pageerror', (e) => errs.push('app: ' + e.message)); p1.on('console', (m) => { if (m.type() === 'error') errs.push('app console: ' + m.text()); });
  const sep = appPath.includes('?') ? '&' : '?';
  await p1.goto(APP + appPath + sep + 'standalone=1&lang=' + lang); await p1.waitForTimeout(+(process.env.WAIT || 1800));
  await p1.screenshot({ path: 'captures/pair-' + name + '-app-' + lang + '.png', fullPage: !!process.env.FULL });
  const p2 = await ctx.newPage();
  const sep2 = designFile.includes('?') ? '&' : '?';
  await p2.goto(DES + '/' + designFile + sep2 + 'lang=' + lang); await p2.waitForTimeout(+(process.env.WAIT || 1800));
  await p2.screenshot({ path: 'captures/pair-' + name + '-design-' + lang + '.png', fullPage: !!process.env.FULL });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
