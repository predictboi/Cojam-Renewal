// node tools/flow-test.js : plays the day on the card view by touch swipe, tap and key, uses Undo, and checks that the fifth pick leads to day done and the reward.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8857/home.html', { waitUntil: 'networkidle' });
  const log = [], ok = (n, c) => { log.push((c ? 'PASS ' : 'FAIL ') + n); console.log(log[log.length - 1]); };
  const front = () => pg.locator('.fx[data-pos="0"]').getAttribute('data-q', { timeout: 1000 }).catch(() => null);
  const done = () => pg.locator('.pips i.done').count();
  async function swipe(dir, dist = 170) {
    const box = await pg.locator('.fx[data-pos="0"]').boundingBox(); const x = box.x + box.width / 2, y = box.y + 140;
    await pg.evaluate(([x, y, d, dist]) => {
      const c = document.querySelector('.fx[data-pos="0"]');
      const ev = (t, dx) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 3, clientX: x + dx, clientY: y, pointerType: 'touch', isPrimary: true }));
      ev('pointerdown', 0); ev('pointermove', 14 * d); ev('pointermove', dist * d / 2); ev('pointermove', dist * d); ev('pointerup', dist * d);
    }, [x, y, dir, dist]);
    await pg.waitForTimeout(500);
  }
  await swipe(1, 30); ok('short drag springs back, nothing picked', await done() === 0 && await front() === 'q1');
  await swipe(1); ok('swipe right picks q1', await done() === 1 && await front() === 'q2');
  ok('undo bar shows', await pg.locator('#undo').count() === 1);
  await pg.locator('#undo').tap(); await pg.waitForTimeout(500); ok('undo brings q1 back', await done() === 0 && await front() === 'q1');
  await swipe(-1); ok('swipe left picks q1', await done() === 1);
  await pg.locator('.fx[data-pos="0"] .side.r').tap(); await pg.waitForTimeout(600); ok('tap right picks q2', await done() === 2 && await front() === 'q3');
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(600); ok('arrow key picks q3', await done() === 3);
  await pg.waitForTimeout(3300); ok('undo window closes after 3 s', await pg.locator('#undo').count() === 0);
  await swipe(1); await swipe(1); ok('fifth pick shows the end panel', await pg.locator('.endp').count() === 1 && await done() === 5);
  await pg.locator('.endp #undo').tap(); await pg.waitForTimeout(500); ok('undo on the fifth pick restores q5', await front() === 'q5' && await done() === 4);
  await swipe(-1); await pg.locator('#finish').tap(); await pg.waitForURL(/done\.html/, { timeout: 5000 });
  ok('finish leads to day done', true);
  await pg.waitForTimeout(900); ok('reward moment is playing', await pg.locator('.ft').count() === 1);
  await pg.waitForTimeout(2600); ok('reward moment ends by itself', await pg.locator('.ft').count() === 0);
  ok('points show 1,350', (await pg.locator('#bug-n').textContent()) === '1,350');
  ok('final score is 3 left, 2 right', (await pg.locator('.final-score .fd').textContent()).replace(/\D/g, '') === '32');
  await pg.goto('http://localhost:8857/done.html?state=moment'); await pg.waitForTimeout(500); await pg.locator('.ft-skip').tap(); await pg.waitForTimeout(600);
  ok('reward moment can be skipped', await pg.locator('.ft').count() === 0);
  console.log(errs.length ? 'PAGE ERRORS ' + errs.join(' | ') : 'no page errors');
  await b.close();
})();
