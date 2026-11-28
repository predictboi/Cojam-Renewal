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
  const ub = await pg.locator('#undo-last').boundingBox(); log.push('Undo on day done: right edge ' + Math.round(390 - ub.x - ub.width) + ' px from the right, ' + Math.round(844 - ub.y - ub.height) + ' px from the bottom (bottom right, as on the deck); focus on ' + await pg.evaluate(() => document.activeElement && document.activeElement.id));
  await pg.locator('.pick').first().tap(); await pg.waitForTimeout(300); log.push('tap on the list during the Undo window: Undo still there: ' + (await pg.locator('#undo-last').count() === 1));
  const during = await pg.evaluate(() => { const f = document.querySelector('#done-fig'), s = getComputedStyle(f), b = document.querySelector('.pg .btn-primary'); return f.textContent + ' ' + (s.color === 'rgb(87, 79, 67)' ? 'grey' : s.color === 'rgb(18, 76, 196)' ? 'blue' : s.color) + ', primary "' + b.textContent.trim() + '"'; });
  await pg.locator('#hero h1').tap(); await pg.waitForTimeout(250); await pg.screenshot({ path: 'captures/done-saving-en-390.png' });   // a tap on the headline area means finish now
  await pg.waitForSelector('#hero.is-paid');
  const seen = await pg.evaluate(() => new Promise(res => { const out = new Set(), f = document.querySelector('#done-fig'); const t = setInterval(() => out.add(f.textContent), 16); setTimeout(() => { clearInterval(t); res([...out]); }, 1600); }));
  const after = await pg.evaluate(() => { const f = document.querySelector('#done-fig'), s = getComputedStyle(f), b = document.querySelector('.pg .btn-primary'); return f.textContent + ' ' + (s.color === 'rgb(87, 79, 67)' ? 'grey' : s.color === 'rgb(18, 76, 196)' ? 'blue' : s.color) + ', primary "' + b.textContent.trim() + '"'; });
  log.push('day done figure during the Undo window: ' + during + '; after: ' + after + '; values seen while paying: ' + seen.join(' '));
  await pg.waitForTimeout(1200); const y1 = await pg.locator('#day5').evaluate(e => e.getBoundingClientRect().top);
  log.push('layout shift of the boxes row between Undo phase and settled page: ' + Math.round(y1 - y0) + ' px');
  log.push('reward: ' + (await pg.locator('#seal').textContent()).trim() + ', points ' + (await pg.locator('#pts-val').textContent()) + ', dateline: ' + (await pg.locator('#dl-flip').textContent()).trim().replace(/\d\d:\d\d:\d\d/, 'hh:mm:ss'));
  await pg.screenshot({ path: 'captures/done-moment-en-390.png' });
  await pg.goto('http://localhost:8851/home.html', { waitUntil: 'networkidle' }); await pg.waitForTimeout(500);
  log.push('home after the day: dateline "' + (await pg.locator('.dateline-live').textContent()).trim().replace(/\d\d:\d\d:\d\d/, 'hh:mm:ss') + '"');
  // money: a conversion and a withdrawal are reviewed, and the wallet shows them afterwards (one mock ledger)
  const bal = async () => (await pg.locator('#ct-fig').textContent()).replace(/[^0-9.]/g, '');
  await pg.goto('http://localhost:8851/wallet.html', { waitUntil: 'networkidle' }); const ct0 = +(await bal());
  await pg.goto('http://localhost:8851/convert.html', { waitUntil: 'networkidle' }); await pg.locator('#go').tap(); await pg.waitForSelector('#tx-confirm');
  log.push('convert review says: "' + (await pg.locator('#tx-note').textContent()).trim() + '"'); await pg.locator('#tx-confirm').tap(); await pg.waitForSelector('[data-tx="done"]', { timeout: 15000 }); await pg.locator('[data-tx="done"]').tap(); await pg.waitForURL(/wallet\.html/);
  const ct1 = +(await bal()); log.push('after converting 1,000P: wallet ' + ct0 + ' -> ' + ct1 + ' CT, points ' + (await pg.locator('#pt-fig').textContent()));
  await pg.goto('http://localhost:8851/withdraw.html', { waitUntil: 'networkidle' }); await pg.locator('#to').fill('0x52908400098527886E0F7030069857D2E4169EE7'); await pg.locator('#amt').fill('0.0000001'); await pg.waitForTimeout(200);
  log.push('withdraw 0.0000001: action disabled ' + (await pg.locator('#go').isDisabled()) + ', label "' + (await pg.locator('#go').textContent()).trim() + '"');
  await pg.locator('#amt').fill('250'); await pg.locator('#go').tap(); await pg.locator('#tx-check').check(); await pg.locator('#tx-confirm').tap(); await pg.waitForSelector('[data-tx="done"]', { timeout: 15000 });
  log.push('withdraw success rows: ' + (await pg.locator('#sheet .rows dt').allTextContents()).join(', ') + '; form cleared: ' + ((await pg.locator('#amt').inputValue()) === ''));
  await pg.locator('[data-tx="done"]').tap(); await pg.waitForURL(/wallet\.html/); log.push('after withdrawing 250 CT: wallet ' + ct1 + ' -> ' + (await bal()) + ' CT');
  await pg.goto('http://localhost:8851/stakes.html', { waitUntil: 'networkidle' }); await pg.locator('[data-wd]').first().tap(); await pg.waitForSelector('#tx-confirm'); log.push('unlocked stake withdraw is reviewed: ' + (await pg.locator('#sheet .rows dt').allTextContents()).join(', '));
  // review F: the withdrawn stake reaches the wallet, closes for the session and the head follows; the focus stays in the sheet; the finished day counts in the week
  const walletBefore = +(ct1 - 250).toFixed(4); const wdText = (await pg.locator('#tx-confirm').textContent()).replace(/[^0-9.]/g, '');
  await pg.locator('#tx-confirm').focus(); await pg.keyboard.press('Enter'); const foc = [];
  for (let i = 0; i < 8; i++) { await pg.waitForTimeout(450); foc.push(await pg.evaluate(() => document.activeElement === document.body ? 'BODY' : (document.activeElement.getAttribute('data-tx') || document.activeElement.tagName))); }
  await pg.waitForSelector('[data-tx="done"]', { timeout: 15000 }); await pg.waitForTimeout(200); foc.push(await pg.evaluate(() => document.activeElement.getAttribute('data-tx') || document.activeElement.tagName));
  log.push('focus during the stake withdrawal: ' + [...new Set(foc)].join(', ') + ' (never BODY: ' + (foc.indexOf('BODY') < 0) + ')');
  await pg.locator('[data-tx="done"]').tap(); await pg.waitForTimeout(400);
  log.push('stakes head after withdrawing ' + wdText + ' CT: staked ' + (await pg.locator('#total .fig').textContent()) + ', count ' + (await pg.locator('#sw .mtabs-n').textContent()) + ', rows ' + (await pg.locator('[data-stake]').count()));
  await pg.reload({ waitUntil: 'networkidle' }); log.push('after a reload: rows ' + (await pg.locator('[data-stake]').count()) + ', withdraw buttons ' + (await pg.locator('[data-wd]').count()));
  await pg.goto('http://localhost:8851/wallet.html', { waitUntil: 'networkidle' }); log.push('wallet after the stake withdrawal: ' + walletBefore + ' -> ' + (await bal()) + ' CT, staked ' + (await pg.locator('#staked').textContent()).trim());
  await pg.goto('http://localhost:8851/ranking.html', { waitUntil: 'networkidle' }); log.push('ranking own bar after the finished day: ' + (await pg.locator('#pin').innerText()).replace(/\s+/g, ' '));
  await pg.goto('http://localhost:8851/profile.html', { waitUntil: 'networkidle' }); log.push('profile figures: ' + (await pg.locator('.stats--3').innerText()).replace(/\s+/g, ' '));
  await pg.goto('http://localhost:8851/results.html', { waitUntil: 'networkidle' }); log.push('results this week: ' + (await pg.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 130) + '; tab badges: "' + (await pg.locator('.tb').innerText()).replace(/\s+/g, ' ') + '"');
  // a typed mixed case address with a wrong checksum is refused; Enter in the amount field runs the action
  await pg.goto('http://localhost:8851/withdraw.html', { waitUntil: 'networkidle' }); await pg.locator('#to').fill('0x52908400098527886e0F7030069857D2E4169EE7'); await pg.locator('#amt').fill('10'); await pg.waitForTimeout(200);
  log.push('wrong checksum: "' + (await pg.locator('#to-msg').textContent()).trim() + '", action disabled ' + (await pg.locator('#go').isDisabled()));
  await pg.locator('#to').fill('0x52908400098527886E0F7030069857D2E4169EE7'); await pg.locator('#amt').focus(); await pg.keyboard.type('abc'); const junk = await pg.locator('#amt').inputValue(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  log.push('typing "abc" into the amount leaves "' + junk + '"; Enter opens the review: ' + ((await pg.locator('#tx-confirm').count()) === 1));
  // a keyboard pick: Undo holds the pick while it has the focus, but only up to 10 seconds after the pick
  const kp = await b.newPage({ viewport: { width: 390, height: 844 } }); await kp.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
  await kp.goto('http://localhost:8851/home.html?state=fresh', { waitUntil: 'networkidle' }); await kp.waitForTimeout(600); await kp.keyboard.press('ArrowRight'); const k0 = Date.now(); await kp.waitForTimeout(600);
  const said = await kp.locator('#live').textContent(); const at5 = await kp.waitForTimeout(4400).then(() => kp.locator('#undo').count());
  await kp.waitForFunction(() => !document.querySelector('#undo'), null, { timeout: 9000 }); log.push('keyboard pick: announced "' + said + '"; Undo still there at 5 s: ' + (at5 === 1) + '; final after ' + ((Date.now() - k0) / 1000).toFixed(1) + ' s'); await kp.close();
  console.log(log.join('\n')); if (errs.length) console.log('ERRORS', errs);
  await b.close();
})();
