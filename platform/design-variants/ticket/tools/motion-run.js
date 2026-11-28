// node tools/motion-run.js   records the motion videos (KO, 390x844) and the mid animation stills into captures/video/
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const { execSync } = require('child_process');
const out = path.join(__dirname, '..', 'captures', 'video'); const U = 'http://localhost:8858/';
async function rec(b, name, fn) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
  const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const h = { pg, touch,
    async down(x, y) { await touch('touchStart', x, y); h.x = x; h.y = y; },
    async move(x1, y1, ms) { const n = Math.max(3, Math.round(ms / 16)), x0 = h.x, y0 = h.y; for (let i = 1; i <= n; i++) { const k = ease(i / n); await touch('touchMove', x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); await pg.waitForTimeout(ms / n); } h.x = x1; h.y = y1; },
    async up() { await touch('touchEnd'); },
    async swipe(dir, ms) { await h.down(195, 420); await h.move(195 + dir * 185, 428, ms || 320); await h.up(); } };
  await fn(h); const v = pg.video(); await ctx.close(); const p = await v.path(); const webm = path.join(out, name + '.webm'); fs.renameSync(p, webm);
  try { execSync(`ffmpeg -y -loglevel error -i "${webm}" -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart "${path.join(out, name + '.mp4')}"`); fs.unlinkSync(webm); } catch (e) { console.log('ffmpeg failed, kept webm', name); }
}
(async () => {
  const b = await chromium.launch();
  await rec(b, 'swipe-undo-ko', async h => {
    await h.pg.goto(U + 'home.html?state=fresh&lang=ko'); await h.pg.waitForTimeout(2500);
    await h.down(195, 420); await h.move(300, 424, 500); await h.pg.waitForTimeout(250); await h.move(350, 426, 300); await h.pg.waitForTimeout(450);
    await h.pg.screenshot({ path: path.join(out, 'still-mid-swipe-ko.png') });
    await h.up(); await h.pg.waitForTimeout(1300); await h.pg.tap('#undo'); await h.pg.waitForTimeout(1500);
    await h.down(195, 420); await h.move(120, 424, 350); await h.move(195, 420, 350); await h.up(); await h.pg.waitForTimeout(700);   // a change of mind springs back
    await h.swipe(-1, 300); await h.pg.waitForTimeout(3600);
  });
  await rec(b, 'five-picks-reward-ko', async h => {
    await h.pg.goto(U + 'home.html?state=fresh&lang=ko'); await h.pg.waitForTimeout(2400);
    await h.swipe(1); await h.pg.waitForTimeout(900); await h.swipe(-1); await h.pg.waitForTimeout(900);
    await h.pg.tap('.card[data-pos="0"] .ans--r'); await h.pg.waitForTimeout(900); await h.swipe(1, 260); await h.pg.waitForTimeout(900); await h.swipe(1, 300); await h.pg.waitForTimeout(1500);
    await h.pg.tap('#fin-btn'); await h.pg.waitForTimeout(4200);
  });
  await rec(b, 'results-ranking-reveal-ko', async h => {
    await h.pg.goto(U + 'results.html?lang=ko'); await h.pg.waitForTimeout(2200); await h.pg.tap('.rrow'); await h.pg.waitForTimeout(1200);
    await h.pg.tap('[href^="ranking.html"]'); await h.pg.waitForTimeout(2600); await h.pg.mouse.wheel(0, 500); await h.pg.waitForTimeout(1200);
    await h.pg.tap('[href^="staking.html"]'); await h.pg.waitForTimeout(1200); await h.pg.tap('#go'); await h.pg.waitForTimeout(1600);
  });
  // stills of the reward moment
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  for (const [i, ms] of [[1, 380], [2, 800], [3, 1230], [4, 1420], [5, 1900]]) { const pg = await ctx.newPage(); await pg.goto(U + 'done.html?state=play&lang=ko'); await pg.waitForTimeout(ms); await pg.screenshot({ path: path.join(out, `still-reward-${i}-ko.png`) }); await pg.close(); }
  await b.close();
})();
