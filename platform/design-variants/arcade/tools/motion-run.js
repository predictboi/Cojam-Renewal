// node tools/motion-run.js [video|stills|perf|all]
// Scripted runs of the motion round against the preview server on port 8855.
//   video : records five flows at 390 x 844 with Playwright recordVideo into captures/video/*.webm (convert with tools/motion-mp4.sh)
//   stills: PNG frames of key moments, taken mid animation by pausing every running animation at a set time (device scale 2)
//   perf  : frame intervals during a scripted 2 second drag of the front card, driven from requestAnimationFrame, at CPU throttle 1x and 4x
// Every page is watched for page errors; the run prints them at the end.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const BASE = 'http://localhost:8855/', OUT = path.join(__dirname, '..', 'captures', 'video');
const mode = process.argv[2] || 'all', errors = [];
fs.mkdirSync(OUT, { recursive: true });

function watch(pg, name) { pg.on('pageerror', e => errors.push(name + ': ' + e.message)); }
const sleep = (pg, ms) => pg.waitForTimeout(ms);
// a finger: pointer events on the front card, in small steps, so the video shows the drag as it is
async function down(pg, x, y) { await pg.evaluate(([x, y]) => { const c = document.querySelector('.qcard[data-pos="0"]'); window.__c = c; c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 5, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true })); }, [x, y]); }
async function move(pg, x, y) { await pg.evaluate(([x, y]) => window.__c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 5, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true })), [x, y]); }
async function up(pg, x, y) { await pg.evaluate(([x, y]) => window.__c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 5, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true })), [x, y]); }
async function glide(pg, x0, x1, y, ms) { const n = Math.max(4, Math.round(ms / 16)); for (let i = 1; i <= n; i++) { const k = i / n, e = 1 - Math.pow(1 - k, 2); await move(pg, x0 + (x1 - x0) * e, y + Math.sin(k * 3) * 4); await sleep(pg, 14); } }
async function swipe(pg, dir, opt = {}) { const y = opt.y || 330, x0 = 195; await down(pg, x0, y); await glide(pg, x0, x0 + dir * 165, y, opt.ms || 420); if (opt.hold) await sleep(pg, opt.hold); await up(pg, x0 + dir * 165, y); }

async function ctxFor(b, name, lang, video) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: video ? 1 : 2, isMobile: true, hasTouch: true, recordVideo: video ? { dir: OUT, size: { width: 390, height: 844 } } : undefined });
  const pg = await ctx.newPage(); watch(pg, name);
  await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
  pg.__go = async (url) => { await pg.goto(BASE + url + (url.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); };
  return { ctx, pg };
}
async function finish(ctx, pg, name) { const v = pg.video(); await ctx.close(); if (v) { const p = await v.path(); fs.renameSync(p, path.join(OUT, name + '.webm')); console.log('video', name + '.webm'); } }

async function videos(b) {
  // (a) swipe, stamp, Undo
  { const { ctx, pg } = await ctxFor(b, 'a', 'ko', true); await pg.__go('home.html?state=fresh'); await sleep(pg, 900);
    await swipe(pg, 1, { ms: 620, hold: 520 }); await sleep(pg, 1300);            // slow drag right: the proof grows, presses in at the threshold, the sheet is thrown
    await pg.locator('#undo').tap(); await sleep(pg, 1100);                       // Undo: the sheet is pulled back
    await down(pg, 195, 640); await glide(pg, 195, 120, 640, 380); await glide(pg, 120, 195, 640, 300); await up(pg, 190, 640); await sleep(pg, 800);   // held low, let go under the threshold: it flicks back
    await swipe(pg, -1, { ms: 300 }); await sleep(pg, 900);                       // a quick swipe left
    await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap(); await sleep(pg, 3600);   // a tap: the stamp lands, then the throw; the fuse runs out
    await finish(ctx, pg, 'a-swipe-sticker-undo-ko'); }
  // (b) five picks through the extra edition to the done page, KO and EN
  for (const lang of ['ko', 'en']) { const { ctx, pg } = await ctxFor(b, 'b-' + lang, lang, true); await pg.__go('home.html?state=fresh'); await sleep(pg, 800);
    await swipe(pg, 1, { ms: 330 }); await sleep(pg, 650); await swipe(pg, -1, { ms: 330 }); await sleep(pg, 650);
    await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap(); await sleep(pg, 750);
    await swipe(pg, 1, { ms: 330 }); await sleep(pg, 650); await swipe(pg, 1, { ms: 330 }); await sleep(pg, 1300);
    await pg.locator('#finish').tap(); await pg.waitForURL(/done\.html/); await sleep(pg, 4200);
    await finish(ctx, pg, 'b-five-picks-capsule-reward-' + lang); }
  // (c) results: stamps land, totals count up, a row opens like a clipping
  { const { ctx, pg } = await ctxFor(b, 'c', 'ko', true); await pg.__go('wallet.html'); await sleep(pg, 500); await pg.locator('.tb a').nth(1).tap(); await pg.waitForURL(/results\.html/); await sleep(pg, 2200);
    await pg.locator('button.rrow').first().tap(); await sleep(pg, 1200); await pg.mouse.wheel(0, 520); await sleep(pg, 1600); await pg.locator('button.rrow').nth(4).tap(); await sleep(pg, 1400);
    await finish(ctx, pg, 'c-results-stickers-ko'); }
  // (d) ranking: the table sets, prizes roll, the own bar comes up, the week turns
  { const { ctx, pg } = await ctxFor(b, 'd', 'ko', true); await pg.__go('results.html'); await sleep(pg, 600); await pg.locator('.tb a').nth(2).tap(); await pg.waitForURL(/ranking\.html/); await sleep(pg, 2200);
    await pg.locator('.seg-btn').nth(1).tap(); await sleep(pg, 1800); await pg.locator('.seg-btn').nth(0).tap(); await sleep(pg, 1800); await pg.locator('#pin').tap(); await sleep(pg, 1500);
    await finish(ctx, pg, 'd-ranking-podium-ko'); }
  // (e) staking: the figure rolls while typing, the review sheet rises, the stamp on success
  { const { ctx, pg } = await ctxFor(b, 'e', 'ko', true); await pg.__go('ranking.html'); await sleep(pg, 500); await pg.locator('.tb a').nth(3).tap(); await pg.waitForURL(/stakes\.html/); await sleep(pg, 900);
    await pg.locator('.mtabs a').first().tap(); await pg.waitForURL(/staking\.html/); await sleep(pg, 900);
    await pg.locator('#amt').fill(''); await pg.locator('#amt').pressSequentially('1200', { delay: 260 }); await sleep(pg, 700);
    await pg.locator('#period button').nth(2).tap(); await sleep(pg, 900);
    await pg.locator('#go').tap(); await sleep(pg, 1500); await pg.locator('#tx-confirm').tap(); await sleep(pg, 7600);
    await finish(ctx, pg, 'e-staking-review-success-ko'); }
}

// one still: load the page, optionally act, then freeze every running animation at `at` ms after the trigger and take the frame
async function still(b, name, lang, url, at, act) {
  const { ctx, pg } = await ctxFor(b, name, lang, false);
  if (!act) await pg.addInitScript((at) => { document.addEventListener('DOMContentLoaded', () => setTimeout(() => { document.getAnimations().forEach(a => a.pause()); window.__frozen = true; }, at)); }, at);
  await pg.__go(url);
  if (act) { await sleep(pg, 700); await act(pg); await sleep(pg, at); await pg.evaluate(() => document.getAnimations().forEach(a => a.pause())); }
  else await pg.waitForFunction(() => window.__frozen === true);
  await pg.screenshot({ path: path.join(OUT, name + '.png') }); console.log('still', name + '.png');
  await ctx.close();
}
async function stills(b) {
  await still(b, 'frame-01-sticker-growing-ko', 'ko', 'home.html?state=fresh', 60, async pg => { await down(pg, 195, 330); await glide(pg, 195, 270, 330, 200); });
  await still(b, 'frame-02-sticker-slapped-ko', 'ko', 'home.html?state=fresh', 90, async pg => { await down(pg, 195, 330); await glide(pg, 195, 345, 330, 260); });
  await still(b, 'frame-03-tap-sticker-throw-ko', 'ko', 'home.html?state=fresh', 260, async pg => { await pg.locator('.qcard[data-pos="0"] .choice[data-dir="l"]').tap(); });
  await still(b, 'frame-04-undo-flying-back-ko', 'ko', 'home.html?state=fresh', 110, async pg => { await swipe(pg, 1, { ms: 260 }); await sleep(pg, 700); await pg.locator('#undo').tap(); });
  await still(b, 'frame-05-undo-fuse-ko', 'ko', 'home.html?state=fresh', 1300, async pg => { await swipe(pg, 1, { ms: 260 }); });
  await still(b, 'reward-1-capsule-drops-ko', 'ko', 'done.html?state=moment', 260);
  await still(b, 'reward-2-capsule-wobbles-ko', 'ko', 'done.html?state=moment', 720);
  await still(b, 'reward-3-lid-flies-jam-jumps-ko', 'ko', 'done.html?state=moment', 1080);
  await still(b, 'reward-4-coin-sticker-slapped-ko', 'ko', 'done.html?state=moment', 1290);
  await still(b, 'reward-5-fifth-sticker-and-paid-ko', 'ko', 'done.html?state=moment', 1560);
  await still(b, 'reward-6-settled-ko', 'ko', 'done.html?state=moment', 3200);
  await still(b, 'reward-4-coin-sticker-slapped-en', 'en', 'done.html?state=moment', 1290);
  await still(b, 'frame-10-results-stickers-landing-ko', 'ko', 'results.html', 330);
  await still(b, 'frame-12-ranking-podium-rising-ko', 'ko', 'ranking.html', 420);
  await still(b, 'frame-13-ranking-avatars-dropping-ko', 'ko', 'ranking.html', 700);
  await still(b, 'frame-14-staking-review-rising-ko', 'ko', 'staking.html', 140, async pg => { await pg.locator('#go').tap(); });
  await still(b, 'frame-15-staking-success-sticker-ko', 'ko', 'staking.html?state=success', 1060);
}

// frame intervals while the front card is dragged for 2 seconds, driven from requestAnimationFrame inside the page
async function perf(b) {
  const rows = [];
  for (const variant of ['layers', 'no-layers']) for (const rate of [1, 4]) {
    const { ctx, pg } = await ctxFor(b, 'perf', 'ko', false);
    const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await pg.__go('home.html?state=fresh'); await sleep(pg, 900);
    if (variant === 'no-layers') await pg.addStyleTag({ content: '.qtint, .qstamp, .deck-lift, .qcard { will-change: auto !important; }' });
    await sleep(pg, 300);
    const r = await pg.evaluate(() => new Promise(res => {
      const c = document.querySelector('.qcard[data-pos="0"]'), ev = (t, x) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9, clientX: x, clientY: 330, pointerType: 'touch', isPrimary: true }));
      const ts = []; let t0 = 0; ev('pointerdown', 195);
      function f(now) { if (!t0) t0 = now; ts.push(now); const k = (now - t0) / 2000; if (k >= 1) { ev('pointerup', 195); const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b); const q = p => d[Math.min(d.length - 1, Math.floor(d.length * p))]; return res({ frames: d.length, avg: d.reduce((a, b) => a + b, 0) / d.length, p50: q(0.5), p95: q(0.95), max: d[d.length - 1], over20: d.filter(x => x > 20).length, over34: d.filter(x => x > 34).length }); }
        ev('pointermove', 195 + Math.sin(k * Math.PI * 6) * 170); requestAnimationFrame(f); }   // back and forth across both thresholds: stamps arm and disarm, the wash switches side
      requestAnimationFrame(f);
    }));
    rows.push({ variant, cpu: rate + 'x', frames: r.frames, avg: +r.avg.toFixed(2), p50: +r.p50.toFixed(2), p95: +r.p95.toFixed(2), max: +r.max.toFixed(2), over20ms: r.over20, over34ms: r.over34 });
    await ctx.close();
  }
  console.table(rows); fs.writeFileSync(path.join(OUT, 'perf-drag.json'), JSON.stringify(rows, null, 2));
}

(async () => {
  const b = await chromium.launch();
  if (mode === 'video' || mode === 'all') await videos(b);
  if (mode === 'stills' || mode === 'all') await stills(b);
  if (mode === 'perf' || mode === 'all') await perf(b);
  await b.close();
  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
