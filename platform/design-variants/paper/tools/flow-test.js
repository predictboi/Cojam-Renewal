// node tools/flow-test.js : plays the day on the card view by touch swipe, tap and key, uses Undo once, and checks that the fifth pick leads to day done.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
  await pg.goto('http://localhost:8851/home.html?state=fresh', { waitUntil: 'networkidle' });
  const log = [];
  const count = async () => (await pg.locator('#cnt').textContent()).trim();
  async function swipe(dir) {
    const box = await pg.locator('.qcard[data-pos="0"]').boundingBox(); const x = box.x + box.width / 2, y = box.y + 120;
    await pg.evaluate(([x, y, d]) => { const c = document.querySelector('.qcard[data-pos="0"]'); const ev = (t, dx) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 3, clientX: x + dx, clientY: y, pointerType: 'touch', isPrimary: true })); ev('pointerdown', 0); ev('pointermove', 14 * d); ev('pointermove', 90 * d); ev('pointermove', 170 * d); ev('pointerup', 170 * d); }, [x, y, dir]);
    await pg.waitForTimeout(500);
  }
  // flick thresholds (review B): a short quick flick counts, a slow short drag springs back, a mostly downward drag never picks
  async function gesture(dx, dy, ms) { const box = await pg.locator('.qcard[data-pos="0"]').boundingBox(); const x = box.x + box.width / 2, y = box.y + 120, steps = Math.max(2, Math.round(ms / 16));
    await pg.evaluate(([x, y]) => { window.__g = document.querySelector('.qcard[data-pos="0"]'); window.__g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 4, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true })); }, [x, y]);
    for (let i = 1; i <= steps; i++) { await pg.evaluate(([x, y]) => window.__g.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 4, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true })), [x + dx * i / steps, y + dy * i / steps]); await pg.waitForTimeout(16); }
    await pg.evaluate(([x, y]) => window.__g.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 4, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true })), [x + dx, y + dy]); await pg.waitForTimeout(500); }
  await gesture(80, 0, 400); log.push('slow short drag (80 px in 400 ms): count ' + await count() + ' (expected 0, it springs back)');
  await gesture(160, 150, 300); log.push('mostly downward drag (160 across, 150 down): count ' + await count() + ' (expected 0)');
  await gesture(80, 4, 96); log.push('short quick flick (80 px in 96 ms): count ' + await count() + ' (expected 1)');
  await pg.locator('#undo').click(); await pg.waitForTimeout(500);
  // keyboard: after an arrow key pick, Undo has the focus and its fuse waits; the pick is still held after 3.6 s
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(3600);
  log.push('arrow key pick: focus on ' + await pg.evaluate(() => document.activeElement && document.activeElement.id) + ', Undo still offered after 3.6 s: ' + (await pg.locator('#undo').count() === 1));
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500); log.push('Enter on Undo: count ' + await count());
  await swipe(1); log.push('after swipe right: ' + await count());
  await pg.locator('#undo').click(); await pg.waitForTimeout(500); log.push('after undo: ' + await count() + ', front card q' + await pg.locator('.qcard[data-pos="0"]').getAttribute('data-q'));
  await swipe(-1); log.push('after swipe left: ' + await count());
  await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap(); await pg.waitForTimeout(600); log.push('after tap: ' + await count());
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(600); log.push('after key: ' + await count());
  await swipe(1); log.push('after 4th: ' + await count());
  // the fifth pick opens the day done page at once; its Undo is still open there
  await swipe(1); await pg.waitForURL(/done\.html/, { timeout: 5000 }); log.push('after 5th: url ' + pg.url().split('/').pop().replace(/undo=\d+/, 'undo=N'));
  await pg.waitForSelector('#undo-last'); await pg.screenshot({ path: 'captures/done-undo-en-390.png' });
  await pg.locator('#undo-last').tap(); await pg.waitForURL(/home\.html/, { timeout: 5000 }); await pg.waitForTimeout(600);
  log.push('after undo on done: back on home, count ' + await count() + ', front card q' + await pg.locator('.qcard[data-pos="0"]').getAttribute('data-q'));
  await swipe(-1); await pg.waitForURL(/done\.html/, { timeout: 5000 }); await pg.waitForSelector('#undo-last');
  const y0 = await pg.locator('#day5').evaluate(e => e.getBoundingClientRect().top);
  await pg.locator('h1').tap(); await pg.waitForTimeout(250); await pg.screenshot({ path: 'captures/done-saving-en-390.png' });   // a tap anywhere means finish now
  await pg.waitForSelector('#hero.is-paid');
  const seen = await pg.evaluate(() => new Promise(res => { const out = new Set(), f = document.querySelector('#done-fig'); const t = setInterval(() => out.add(f.textContent), 16); setTimeout(() => { clearInterval(t); res([...out]); }, 1600); }));
  const nums = seen.map(x => +x.replace(/\D/g, '')), mono = nums.every((v, i) => i === 0 || v >= nums[i - 1]) && nums.every(v => v <= 100);
  log.push('figure values seen while paying: ' + nums.length + ' steps from ' + nums[0] + ' to ' + nums[nums.length - 1] + ', never above 100 and never going down: ' + mono);
  await pg.waitForTimeout(1200); const y1 = await pg.locator('#day5').evaluate(e => e.getBoundingClientRect().top);
  log.push('layout shift of the boxes row between Undo phase and settled page: ' + Math.round(y1 - y0) + ' px');
  log.push('reward: ' + (await pg.locator('#seal').textContent()).trim() + ', points ' + (await pg.locator('#pts-val').textContent()) + ', dateline: ' + (await pg.locator('#dl-flip').textContent()).trim().replace(/\d\d:\d\d:\d\d/, 'hh:mm:ss'));
  await pg.screenshot({ path: 'captures/done-moment-en-390.png' });
  await pg.goto('http://localhost:8851/home.html', { waitUntil: 'networkidle' }); await pg.waitForTimeout(500);
  log.push('home after the day: dateline "' + (await pg.locator('.dateline-live').textContent()).trim().replace(/\d\d:\d\d:\d\d/, 'hh:mm:ss') + '"');
  console.log(log.join('\n')); if (errs.length) console.log('ERRORS', errs);
  await b.close();
})();
