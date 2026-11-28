// node tools/flow-test.js : scripted touch test of the deck (real touch events through CDP): small drag, vertical drag, swipe, Undo, five picks, the finishing panel, the reward moment and its skip.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8856/home.html?lang=ko', { waitUntil: 'networkidle' }); await pg.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(pg); let fail = 0;
  const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fail++; };
  const st = () => pg.evaluate(() => window.__deck.state());
  async function swipe(x0, y0, dx, dy, steps, ms) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / steps, y: y0 + dy * i / steps }] }); await pg.waitForTimeout(ms / steps); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(450);
  }
  const box = await (await pg.$('.card[data-pos="0"]')).boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await swipe(cx, cy, 60, 0, 8, 400); ok('slow short drag (60px) springs back', (await st()).ptr === 0);
  await swipe(cx, cy, 8, -160, 8, 200); ok('vertical drag never commits', (await st()).ptr === 0);
  await swipe(cx, cy, 190, 10, 10, 300); let s = await st(); ok('swipe right past 35% commits right', s.ptr === 1 && s.made.q1 === 'r', JSON.stringify(s));
  ok('undo bar shows', await pg.$('#undo') !== null);
  await pg.tap('#undo'); await pg.waitForTimeout(500); s = await st(); ok('Undo returns card 1', s.ptr === 0 && !s.made.q1 && s.held === 0);
  const t0 = await pg.evaluate(() => getComputedStyle(document.querySelector('.card[data-pos="0"]')).visibility); ok('card 1 visible again', t0 === 'visible');
  await swipe(cx, cy, -100, 0, 3, 60); s = await st(); ok('fast fling left (100px) commits left', s.ptr === 1 && s.made.q1 === 'l', JSON.stringify(s));
  await pg.waitForTimeout(3200); ok('undo window closes after 3 s', await pg.$('#undo') === null);
  await pg.tap('.choice-r'); await pg.waitForTimeout(100); await pg.tap('.choice-r'); await pg.waitForTimeout(350); s = await st(); ok('double tap inside 400 ms answers one card only', s.ptr === 2, 'ptr ' + s.ptr);
  await pg.waitForTimeout(300); await pg.tap('.choice-l'); await pg.waitForTimeout(500); await pg.tap('.choice-r'); await pg.waitForTimeout(500);
  await swipe(cx, cy, 200, 0, 10, 250); s = await st(); ok('five picks made', s.ptr === 5, JSON.stringify(s.made));
  ok('finishing panel shows', await pg.$('#fin') !== null);
  await pg.tap('#undo'); await pg.waitForTimeout(500); s = await st(); ok('Undo on the fifth pick removes the finishing panel', s.ptr === 4 && await pg.$('#fin') === null);
  await pg.tap('.choice-r'); await pg.waitForTimeout(500);
  await pg.tap('#fin-now'); await pg.waitForURL(/done\.html\?moment=1/, { timeout: 4000 }).catch(() => {}); ok('Finish now opens day done with the reward moment', /done\.html\?moment=1/.test(pg.url()), pg.url());
  await pg.waitForTimeout(400); ok('reward moment is playing', await pg.$('.win.is-play') !== null);
  const tiles = await pg.$$eval('.tile', els => els.map(e => e.classList.contains('t-l') ? 'l' : 'r').join('')); ok('composition shows the picks just made (l r l r r)', tiles === 'lrlrr', tiles);
  await pg.touchscreen.tap(200, 500); await pg.waitForTimeout(150); ok('a tap skips the reward moment', await pg.$('.win.is-play') === null);
  // auto finish path
  await pg.goto('http://localhost:8856/home.html?state=partial&lang=en', { waitUntil: 'networkidle' });
  for (let i = 0; i < 3; i++) { await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(450); }
  s = await st(); ok('arrow keys pick', s.ptr === 5);
  await pg.waitForURL(/done\.html/, { timeout: 5000 }).catch(() => {}); ok('without Finish now the day closes by itself after 3 s', /done\.html/.test(pg.url()));
  await pg.waitForTimeout(2800); ok('reward moment ends by itself', await pg.$('.win.is-play') === null);
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
