// node tools/flow-test.js   scripted touch test: swipe, Undo, guards, five picks, reward, done
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8858/home.html?state=fresh&lang=en'); await pg.waitForTimeout(2600);
  const cdp = await ctx.newCDPSession(pg);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  async function drag(x0, y0, x1, y1, ms) { const n = Math.max(4, Math.round(ms / 16)); await touch('touchStart', x0, y0); for (let i = 1; i <= n; i++) { await touch('touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await pg.waitForTimeout(ms / n); } await touch('touchEnd'); }
  const S = () => pg.evaluate(() => ({ minis: [...document.querySelectorAll('#tray .slot')].map(s => { const m = s.querySelector('.mini'); return m ? (m.classList.contains('l') ? 'l' : 'r') : '-'; }).join(''), undo: !document.getElementById('undo') || !document.getElementById('undo').hidden, front: (document.querySelector('.card[data-pos="0"]') || {}).dataset ? document.querySelector('.card[data-pos="0"]').dataset.q : null, tape: !!document.querySelector('.tape'), finish: !!document.getElementById('finish'), strip: !!document.getElementById('strip') }));
  const res = []; const ok = (name, cond, s) => { res.push((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(s))); };
  let s;
  await drag(195, 400, 360, 405, 500); await pg.waitForTimeout(700); s = await S(); ok('slow swipe right past 35% picks right', s.minis === 'r----' && s.undo && s.front === 'q2', s);
  await pg.tap('#undo'); await pg.waitForTimeout(700); s = await S(); ok('Undo returns the ticket, taped', s.minis === '-----' && s.front === 'q1' && s.tape && !s.undo, s);
  await drag(195, 400, 240, 402, 400); await pg.waitForTimeout(600); s = await S(); ok('short slow drag springs back', s.minis === '-----' && s.front === 'q1', s);
  await drag(195, 300, 215, 520, 300); await pg.waitForTimeout(500); s = await S(); ok('vertical drag never picks', s.minis === '-----', s);
  await drag(260, 400, 120, 400, 60); await pg.waitForTimeout(700); s = await S(); ok('fling left picks left', s.minis === 'l----' && s.front === 'q2', s);
  await pg.waitForTimeout(3100); s = await S(); ok('Undo closes after 3 s', !s.undo, s);
  const r = await pg.evaluate(() => { const q = document.querySelector('.card[data-pos="0"] .ans--r').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }); await touch('touchStart', r[0], r[1]); await touch('touchEnd'); await pg.waitForTimeout(150); await touch('touchStart', r[0], r[1]); await touch('touchEnd'); await pg.waitForTimeout(800); s = await S(); ok('double tap answers one card only', s.minis === 'lr---' && s.front === 'q3', s);
  await pg.tap('.card[data-pos="0"] .ans--l'); await pg.waitForTimeout(800);
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(800); s = await S(); ok('tap and arrow key pick', s.minis === 'lrlr-' && s.front === 'q5', s);
  await drag(195, 400, 370, 400, 300); await pg.waitForTimeout(900); s = await S(); ok('fifth pick shows the finishing panel with Undo', s.minis === 'lrlrr' && s.finish && s.undo, s);
  await pg.tap('#undo'); await pg.waitForTimeout(700); s = await S(); ok('Undo on the fifth pick cancels finishing', s.minis === 'lrlr-' && !s.finish && s.front === 'q5', s);
  await drag(195, 400, 20, 400, 300); await pg.waitForTimeout(900); await pg.tap('#fin-btn'); await pg.waitForTimeout(200); s = await S(); ok('Finish now starts the print', s.strip, s);
  await pg.waitForTimeout(2600);
  const d = await pg.evaluate(() => ({ pts: document.querySelector('#pts-n .sr') ? document.querySelector('#pts-n .sr').textContent : document.getElementById('pts-n').textContent, after: getComputedStyle(document.getElementById('after')).visibility, stamp: getComputedStyle(document.getElementById('stamp')).opacity, rows: document.querySelectorAll('#strip-in .srow').length }));
  ok('reward ends on done: 5 rows, stamp, 1,350P', d.pts === '1,350' && d.after === 'visible' && d.stamp === '1' && d.rows === 5, d);
  // skip
  await pg.goto('http://localhost:8858/done.html?state=play&lang=en'); await pg.waitForTimeout(500); await pg.tap('h1'); await pg.waitForTimeout(150);
  const k = await pg.evaluate(() => getComputedStyle(document.getElementById('after')).visibility + getComputedStyle(document.getElementById('stamp')).opacity);
  ok('reward is skippable with a tap', k === 'visible1', k);
  // list view
  await pg.goto('http://localhost:8858/home-list.html?state=last&lang=en'); await pg.waitForTimeout(600); await pg.tap('.lopen .ans--r'); await pg.waitForTimeout(500);
  s = await S(); ok('list view fifth pick shows finishing', s.minis === 'rlrrr' && s.finish, s);
  console.log(res.join('\n')); if (errs.length) console.log('ERRORS', errs); await b.close();
})();
