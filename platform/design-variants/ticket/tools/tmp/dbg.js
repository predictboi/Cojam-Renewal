const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); pg.on('console', m => console.log(m.text()));
  await pg.goto('http://localhost:8858/home.html?state=fresh&lang=en'); await pg.waitForTimeout(2600);
  await pg.evaluate(() => { const el = document.getElementById('deck'); ['pointerdown','pointermove','pointerup','pointercancel'].forEach(t => el.addEventListener(t, e => console.log(t, Math.round(e.clientX), Math.round(e.timeStamp)), true)); });
  const cdp = await ctx.newCDPSession(pg);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  async function drag(x0, y0, x1, y1, ms) { const n = Math.max(4, Math.round(ms / 16)); await touch('touchStart', x0, y0); for (let i = 1; i <= n; i++) { await touch('touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await pg.waitForTimeout(ms / n); } await touch('touchEnd'); }
  await drag(250, 400, 140, 400, 90); await pg.waitForTimeout(500);
  await b.close();
})();
