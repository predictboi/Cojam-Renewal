// Quick capture: node e2e/shot.cjs <url> <out.png> [width] [height]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = '1440', h = '900'] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.screenshot({ path: out, fullPage: true });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(JSON.stringify({ errs, overflow: ov }));
  await b.close();
})();
