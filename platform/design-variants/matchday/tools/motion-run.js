// node tools/motion-run.js [stills|video] : mid animation stills and the three screen videos (KO, 390x844) into captures/ and captures/video/.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const out = path.join(__dirname, '..', 'captures'), vdir = path.join(out, 'video'), base = 'http://localhost:8857/';
const what = process.argv[2] || 'all';
const sleep = (pg, ms) => pg.waitForTimeout(ms);
// a drag over time, so the card follows like a thumb: from 0 to dist in `ms`, optional release
async function drag(pg, dir, dist, ms, release = true) {
  const box = await pg.locator('.fx[data-pos="0"]').boundingBox(); const x = box.x + box.width / 2, y = box.y + 150;
  const ev = (t, dx) => pg.evaluate(([t, x, y, dx]) => { const c = document.querySelector('.fx[data-pos="0"]') || document.querySelector('.fx[data-pos="-1"]'); c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, clientX: x + dx, clientY: y, pointerType: 'touch', isPrimary: true })); }, [t, x, y, dx]);
  await ev('pointerdown', 0); const n = Math.max(4, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { const p = i / n, e = 1 - Math.pow(1 - p, 2); await ev('pointermove', dir * dist * e); await sleep(pg, 12); }
  if (release) await ev('pointerup', dir * dist);
}
async function ctxFor(b, lang, video) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: video ? 1 : 2, isMobile: true, hasTouch: true, recordVideo: video ? { dir: vdir, size: { width: 390, height: 844 } } : undefined });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  await pg.goto(base + 'index.html?lang=' + lang, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready);
  return { ctx, pg };
}
async function save(ctx, pg, name) { const v = pg.video(); await ctx.close(); const p = await v.path(); fs.renameSync(p, path.join(vdir, name + '.webm')); console.log('video', name); }

(async () => {
  const b = await chromium.launch(); fs.mkdirSync(vdir, { recursive: true });
  if (what !== 'video') for (const lang of ['en', 'ko']) {
    const { ctx, pg } = await ctxFor(b, lang, false);
    await pg.goto(base + 'home.html?state=partial', { waitUntil: 'networkidle' }); await sleep(pg, 900);
    await drag(pg, 1, 96, 300, false); await sleep(pg, 120); await pg.screenshot({ path: path.join(out, `home-drag-${lang}-390.png`) });
    await pg.goto(base + 'home.html?state=partial', { waitUntil: 'networkidle' }); await sleep(pg, 900);
    await drag(pg, -1, 96, 300, false); await sleep(pg, 120); await pg.screenshot({ path: path.join(out, `home-drag-left-${lang}-390.png`) });
    await pg.goto(base + 'home.html?state=partial', { waitUntil: 'networkidle' }); await sleep(pg, 900);
    await drag(pg, 1, 170, 220); await sleep(pg, 900); await pg.screenshot({ path: path.join(out, `home-undo-${lang}-390.png`) });
    await pg.goto(base + 'home.html?state=last', { waitUntil: 'networkidle' }); await sleep(pg, 900);
    await drag(pg, 1, 170, 220); await sleep(pg, 800); await pg.screenshot({ path: path.join(out, `home-finishing-${lang}-390.png`) });
    for (const t of [330, 620, 1000, 1500, 2050, 2420]) { // the reward moment, frame by frame
      await pg.goto(base + 'done.html?state=moment', { waitUntil: 'commit' }); await pg.waitForSelector('.ft'); await sleep(pg, t);
      await pg.screenshot({ path: path.join(out, `done-moment-${String(t).padStart(4, '0')}-${lang}-390.png`) });
    }
    await ctx.close(); console.log('stills', lang);
  }
  if (what !== 'stills') {
    // 1. swipe with Undo
    let { ctx, pg } = await ctxFor(b, 'ko', true);
    await pg.goto(base + 'home.html', { waitUntil: 'networkidle' }); await sleep(pg, 1300);
    await drag(pg, 1, 60, 350, false); await drag(pg, 1, 0, 10); await sleep(pg, 700);   // a hesitant drag that springs back
    await drag(pg, 1, 175, 380); await sleep(pg, 1300);
    await pg.locator('#undo').tap(); await sleep(pg, 1200);
    await drag(pg, -1, 175, 380); await sleep(pg, 3800);
    await pg.locator('.fx[data-pos="0"] .side.r').tap(); await sleep(pg, 1500);
    await save(ctx, pg, 'swipe-undo-ko');
    // 2. five picks through the reward moment to done
    ({ ctx, pg } = await ctxFor(b, 'ko', true));
    await pg.goto(base + 'home.html', { waitUntil: 'networkidle' }); await sleep(pg, 1200);
    for (const d of [1, -1, 1, 1, -1]) { await drag(pg, d, 175, 300); await sleep(pg, 750); }
    await pg.waitForURL(/done\.html/, { timeout: 8000 }); await sleep(pg, 4200);
    await pg.mouse.wheel(0, 500); await sleep(pg, 1200);
    await save(ctx, pg, 'five-picks-reward-ko');
    // 3. results and ranking reveals
    ({ ctx, pg } = await ctxFor(b, 'ko', true));
    await pg.goto(base + 'home.html?state=partial', { waitUntil: 'networkidle' }); await sleep(pg, 800);
    await pg.locator('.tab[href^="results"]').tap(); await sleep(pg, 2200);
    await pg.mouse.wheel(0, 420); await sleep(pg, 1000);
    await pg.locator('.tab[href^="ranking"]').tap(); await sleep(pg, 2400);
    await pg.mouse.wheel(0, 700); await sleep(pg, 1400);
    await save(ctx, pg, 'results-ranking-ko');
  }
  await b.close();
})();
