// node tools/motion-run.js : records the three motion videos (KO, 390x844) into captures/video/ as webm (tools/motion-mp4.sh converts), and the mid animation stills of the reward moment.
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const out = path.join(__dirname, '..', 'captures'), vid = path.join(out, 'video'), U = 'http://localhost:8856/';
(async () => {
  const b = await chromium.launch();
  async function rec(name, fn) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: vid, size: { width: 390, height: 844 } } });
    const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
    const swipe = async (dx, steps, ms, hold) => { const x0 = 195, y0 = 430;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= steps; i++) { const e = 1 - Math.pow(1 - i / steps, 2); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * e, y: y0 + 6 * e }] }); await pg.waitForTimeout(ms / steps); }
      if (hold) await pg.waitForTimeout(hold);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await fn(pg, swipe); const v = pg.video(); await ctx.close(); const p = await v.path(); fs.renameSync(p, path.join(vid, name + '.webm')); console.log('video', name);
  }
  await rec('swipe-undo-ko', async (pg, swipe) => {
    await pg.goto(U + 'home.html?lang=ko', { waitUntil: 'networkidle' }); await pg.waitForTimeout(900);
    await swipe(70, 14, 500, 250); await pg.waitForTimeout(700);          // below the threshold: hint, spring back
    await swipe(185, 18, 600, 350); await pg.waitForTimeout(1100);        // commit right
    await pg.tap('#undo'); await pg.waitForTimeout(1100);                 // Undo
    await swipe(-185, 18, 550, 300); await pg.waitForTimeout(1500);       // commit left
  });
  await rec('five-picks-reward-ko', async (pg, swipe) => {
    await pg.goto(U + 'home.html?lang=ko', { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
    await swipe(190, 14, 380, 120); await pg.waitForTimeout(650); await swipe(-190, 14, 380, 120); await pg.waitForTimeout(650);
    await pg.tap('.choice-r'); await pg.waitForTimeout(750); await swipe(-190, 14, 380, 120); await pg.waitForTimeout(650); await pg.tap('.choice-r'); await pg.waitForTimeout(1300);
    await pg.tap('#fin-now'); await pg.waitForURL(/done/); await pg.waitForTimeout(4200);
  });
  await rec('results-ranking-reveal-ko', async (pg) => {
    await pg.goto(U + 'done.html?lang=ko', { waitUntil: 'networkidle' }); await pg.waitForTimeout(500);
    await pg.tap('.tab:nth-child(2)'); await pg.waitForTimeout(2200); await pg.mouse.wheel(0, 500); await pg.waitForTimeout(900);
    await pg.tap('.tab:nth-child(3)'); await pg.waitForTimeout(2600); await pg.mouse.wheel(0, 600); await pg.waitForTimeout(1000);
    await pg.tap('.tab:nth-child(4)'); await pg.waitForTimeout(900); await pg.tap('#go'); await pg.waitForTimeout(1400); await pg.tap('[data-close]'); await pg.waitForTimeout(800);
  });
  // stills of the reward moment
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  for (const [i, ms] of [[1, 380], [2, 700], [3, 1120], [4, 1480], [5, 1900]]) {
    const pg = await ctx.newPage(); await pg.goto(U + 'done.html?lang=ko', { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready);
    await pg.goto(U + 'done.html?moment=1&lang=ko', { waitUntil: 'commit' }); await pg.waitForSelector('.win.is-play');
    const t0 = Date.now(); await pg.waitForTimeout(Math.max(0, ms - 60)); await pg.screenshot({ path: path.join(out, 'reward-frame-' + i + '-ko-390.png') }); console.log('still', i, 'asked', ms, 'ms'); await pg.close();
  }
  await b.close();
})();
