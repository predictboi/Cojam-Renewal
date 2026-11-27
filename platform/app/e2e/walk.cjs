// Mock mode walk through of the PWA (build with `npm run build:mock`, serve with `npx vite preview --port 4180`).
// 1. Opens every screen and its main states at 390x844 in EN and KO: no page errors, no console errors, no horizontal
//    overflow; a capture of each goes to captures/<lang>/<screen>-<state>.png.
// 2. Plays the primary flow by touch (CDP touch events): swipe, Undo, five picks, day done.
// Run: node e2e/walk.cjs [en|ko|all] (APP_PORT=4180)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const B = 'http://localhost:' + (process.env.APP_PORT || 4180);
const OUT = path.join(__dirname, '..', 'captures');
const LANGS = (process.argv[2] || 'all') === 'all' ? ['en', 'ko'] : [process.argv[2]];
const W = 390, H = 844;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SCREENS = [
  ['gate', '/gate', ['', 'android', 'ios', 'ios-other', 'inapp', 'desktop', 'installed', 'invited', 'invited-ios']],
  ['login', '/login', ['', 'typo', 'unsupported', 'toomany', 'code', 'wrong', 'expired', 'tries', 'busy', 'walletfail', 'devicefail', 'refused-used', 'refused-many', 'offline']],
  ['first-run', '/welcome', ['', '2', '3', 'code-valid', 'code-unknown', 'code-own', 'code-linked', 'code-offline']],
  ['home', '/', ['fresh', 'noimage', 'imagetop', 'partial', 'syncing', 'slow', 'failed', 'reconnect', 'reconnectfail', 'otherdevice', 'loading', 'empty', 'closed', 'error', 'offline', 'hold']],
  ['list', '/list', ['fresh', 'syncing', 'slow', 'failed', 'reconnect', 'otherdevice', 'loading', 'empty', 'closed', 'error', 'offline', 'hold']],
  ['done', '/done', ['moment', 'saving', 'results', 'zero', 'welcome', 'offline']],
  ['results', '/results', ['', 'loading', 'empty', 'nowaiting', 'noset', 'error', 'offline']],
  ['ranking', '/ranking', ['', 'top10', 'unranked', 'winner', 'short', 'lastweek', 'sent', 'loading', 'error', 'offline', 'hold']],
  ['staking', '/staking', ['', 'empty', 'below', 'above', 'zero', 'big', 'paused', 'full', 'fullnone', 'max20', 'loading', 'review', 'signing', 'steps', 'sending', 'slow', 'success', 'failed', 'error', 'offline', 'hold']],
  ['stakes', '/stakes', ['', 'claimable', 'claim', 'loading', 'empty', 'error', 'offline', 'hold', 'hold-nokaia']],
  ['wallet', '/wallet', ['', 'new', 'zero', 'loading', 'error', 'offline', 'hold']],
  ['convert', '/convert', ['', 'step', 'above', 'min', 'short', 'wait', 'cap', 'capglobal', 'paused', 'signing', 'success', 'failed', 'loading', 'offline', 'hold']],
  ['deposit', '/deposit', ['', 'arrived', 'loading', 'error', 'offline']],
  ['withdraw', '/withdraw', ['', 'filled', 'bad', 'sum', 'own', 'contract', 'nokaia', 'review', 'signing', 'success', 'failed', 'loading', 'offline']],
  ['profile', '/profile', ['', 'nameerror', 'notset', 'otherdevice', 'logout', 'session', 'hold', 'code-open', 'code-valid', 'code-unknown', 'code-own', 'code-linked']],
  ['invite', '/invite', ['', 'empty', 'loading', 'error', 'offline', 'copied', 'hold']],
  ['system', '/system', ['maintenance', 'update', 'offline', 'notfound', 'blocked']],
];

const results = [];
const ok = (name, cond, extra) => { results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : String(extra)]); };

(async () => {
  const b = await chromium.launch();
  for (const lang of LANGS) {
    fs.mkdirSync(path.join(OUT, lang), { recursive: true });
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
    const pg = await ctx.newPage();
    let errs = [];
    pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|jsdelivr|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    // the first visit sets the standalone override (non production builds) and the language
    await pg.goto(B + '/?standalone=1&lang=' + lang); await sleep(800);
    for (const [name, route, states] of process.env.FLOW_ONLY ? [] : SCREENS) {
      for (const st of states) {
        errs = [];
        let url = route;
        if (name === 'system') url = '/system/' + st;
        else if (st) url += '?state=' + st;
        await pg.goto(B + url); await sleep(st === 'moment' ? 2600 : 1300);
        const ov = await pg.evaluate(() => {
          const w = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
          const bad = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && !e.closest('.qcard, .deck, .gate-demo, .burst, .sheet-root:not(.is-open), .toasts, [aria-hidden="true"]') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map((e) => e.tagName + '.' + e.className);
          return { sw, w, bad };
        });
        const label = lang + ' ' + name + (st ? ':' + st : '');
        ok(label + ' no errors', errs.length === 0, errs.join(' | '));
        ok(label + ' no horizontal overflow', ov.sw <= ov.w && ov.bad.length === 0, JSON.stringify(ov));
        await pg.screenshot({ path: path.join(OUT, lang, name + (st ? '-' + st : '') + '.png') });
      }
    }

    /* ---------- the primary flow by touch ---------- */
    const cdp = await ctx.newCDPSession(pg);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    async function drag(x0, y0, dx, steps = 12) { await touch('touchStart', x0, y0); for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + (dx * i) / steps, y0); await sleep(16); } await touch('touchEnd'); }
    const front = () => pg.evaluate(() => { const c = document.querySelector('.qcard[data-pos="0"]'); return c ? +c.dataset.q : 0; });
    const cnt = () => pg.evaluate(() => +document.querySelector('#cnt').textContent);
    const box = () => pg.evaluate(() => { const r = document.querySelector('.qcard[data-pos="0"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    errs = [];
    try {
    await pg.goto(B + '/?state=fresh'); await pg.waitForSelector('.qcard[data-pos="0"] .choice', { timeout: 8000 }).catch(() => {}); await sleep(800);
    ok(lang + ' flow: fresh deck shows question 1 in front', (await front()) === 1, await front());
    let c = await box();
    await drag(c.x + c.w / 2, c.y + c.h * 0.35, c.w * 0.25);           // short drag: springs back
    await sleep(500);
    ok(lang + ' flow: a short drag does not pick', (await front()) === 1 && (await cnt()) === 0);
    await drag(c.x + c.w / 2, c.y + c.h * 0.35, c.w * 0.6);            // right: Yes
    await sleep(450);
    ok(lang + ' flow: a swipe past 35% picks and the next card shows at once', (await front()) === 2 && (await cnt()) === 1, (await front()) + '/' + (await cnt()));
    ok(lang + ' flow: Undo is offered under the deck', await pg.locator('#undo').isVisible());
    await pg.locator('#undo').tap(); await sleep(500);
    ok(lang + ' flow: Undo brings question 1 back to the front', (await front()) === 1 && (await cnt()) === 0, (await front()) + '/' + (await cnt()));
    const held = await pg.evaluate(() => new Promise((r) => { const q = indexedDB.open('cojam-app'); q.onsuccess = () => { const tx = q.result.transaction('outbox'); const g = tx.objectStore('outbox').getAll(); g.onsuccess = () => r(g.result.length); }; }));
    ok(lang + ' flow: the undone pick left nothing in the outbox', held === 0, held);
    for (let i = 0; i < 5; i++) {
      c = await box();
      await drag(c.x + c.w / 2, c.y + c.h * 0.35, (i % 2 ? -1 : 1) * c.w * 0.6);
      await sleep(420);
    }
    // the fifth pick opens day done at once; the Undo of that pick lives there (Daily Paper flow, MOTION.md section 2)
    await pg.waitForURL(/\/done/, { timeout: 4000 }).catch(() => {});
    const outbox = () => pg.evaluate(() => new Promise((r) => { const q = indexedDB.open('cojam-app'); q.onsuccess = () => { const tx = q.result.transaction('outbox'); const g = tx.objectStore('outbox').getAll(); g.onsuccess = () => r(g.result.map((x) => x.state)); }; }));
    const picked = await outbox();
    ok(lang + ' flow: five picks counted', picked.length === 5 && (await pg.evaluate(() => document.querySelectorAll('#day5 i.is-done, #day5 i.is-pend').length)) === 5, picked.length);
    ok(lang + ' flow: the fifth pick opens day done with its Undo', /\/done/.test(pg.url()) && await pg.locator('#undo-last').isVisible(), pg.url());
    await pg.screenshot({ path: path.join(OUT, lang, 'flow-finish.png') });
    const states = await outbox();
    ok(lang + ' flow: the earlier picks left their window and are being sent, the newest is held', states.length === 5 && states.filter((s) => s === 'held').length >= 1 && states.some((s) => s !== 'held'), states.join(','));
    // "finish now": a tap on the headline area ends the Undo window at once
    await pg.locator('#hero h1').tap();
    await sleep(300);
    ok(lang + ' flow: Finish now opens day done', /\/done/.test(pg.url()) && !(await pg.locator('#undo-last').count()), pg.url());
    await sleep(500);
    ok(lang + ' flow: day done waits for the fifth pick before the reward', (await pg.locator('#reward').innerText()).length > 0);
    await pg.waitForFunction(() => document.querySelector('#hero.is-paid'), null, { timeout: 8000 }).catch(() => {});
    ok(lang + ' flow: +100P pops once the picks are mined', await pg.evaluate(() => !!document.querySelector('#hero.is-paid')));
    await sleep(600);
    await pg.screenshot({ path: path.join(OUT, lang, 'flow-done.png') });
    const mined = await pg.evaluate(() => new Promise((r) => { const q = indexedDB.open('cojam-app'); q.onsuccess = () => { const tx = q.result.transaction('outbox'); const g = tx.objectStore('outbox').getAll(); g.onsuccess = () => r(g.result.map((x) => x.state + ':' + x.nonce)); }; }));
    ok(lang + ' flow: five transactions, nonces 0 to 4 in pick order, all mined', mined.join(',') === ['mined:0', 'mined:1', 'mined:2', 'mined:3', 'mined:4'].join(','), mined.join(','));
    // back to home: the finished panel links to day done
    await pg.goto(B + '/'); await sleep(1200);
    ok(lang + ' flow: home after the day shows the finished panel', await pg.locator('.home-fin').count() === 1);
    ok(lang + ' flow: no errors during the flow', errs.length === 0, errs.join(' | '));
    } catch (e) {
      ok(lang + ' flow: completed without an exception', false, e.message.split('\n')[0] + ' at ' + pg.url());
      await pg.screenshot({ path: path.join(OUT, lang, 'flow-error.png') }).catch(() => {});
    }
    await ctx.close();
  }
  await b.close();
  const fails = results.filter((r) => r[0] === 'FAIL');
  for (const r of results) if (r[0] === 'FAIL' || process.env.VERBOSE) console.log(r.join('  '));
  console.log(results.length - fails.length + ' passed, ' + fails.length + ' failed');
  fs.writeFileSync(path.join(OUT, 'walk-result.json'), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
