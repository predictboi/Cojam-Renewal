// node tools/flow-test.js : plays the day on the card view by touch swipe, tap and key, uses Undo once, and checks that the fifth pick leads to day done.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
  await pg.goto('http://localhost:8855/home.html?state=fresh', { waitUntil: 'networkidle' });
  const log = [];
  const count = async () => (await pg.locator('#cnt').textContent()).trim();
  async function swipe(dir) {
    const box = await pg.locator('.qcard[data-pos="0"]').boundingBox(); const x = box.x + box.width / 2, y = box.y + 120;
    await pg.evaluate(([x, y, d]) => { const c = document.querySelector('.qcard[data-pos="0"]'); const ev = (t, dx) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 3, clientX: x + dx, clientY: y, pointerType: 'touch', isPrimary: true })); ev('pointerdown', 0); ev('pointermove', 14 * d); ev('pointermove', 90 * d); ev('pointermove', 170 * d); ev('pointerup', 170 * d); }, [x, y, dir]);
    await pg.waitForTimeout(500);
  }
  await swipe(1); log.push('after swipe right: ' + await count());
  await pg.locator('#undo').click(); await pg.waitForTimeout(500); log.push('after undo: ' + await count() + ', front card q' + await pg.locator('.qcard[data-pos="0"]').getAttribute('data-q'));
  await swipe(-1); log.push('after swipe left: ' + await count());
  await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap(); await pg.waitForTimeout(600); log.push('after tap: ' + await count());
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(600); log.push('after key: ' + await count());
  await swipe(1); log.push('after 4th: ' + await count());
  await swipe(1); log.push('after 5th: ' + await count() + ', finish button: ' + await pg.locator('#finish').count());
  await pg.screenshot({ path: 'captures/home-finishing-en-390.png' });
  await pg.locator('#finish').click(); await pg.waitForURL(/done\.html/, { timeout: 5000 });
  log.push('url: ' + pg.url().split('/').pop());
  await pg.waitForTimeout(400); await pg.screenshot({ path: 'captures/done-saving-en-390.png' });
  await pg.waitForTimeout(2200); log.push('reward: ' + (await pg.locator('#reward').textContent()).trim() + ', points ' + (await pg.locator('#pts-val').textContent()));
  await pg.screenshot({ path: 'captures/done-moment-en-390.png' });
  console.log(log.join('\n')); if (errs.length) console.log('ERRORS', errs);
  await b.close();
})();
