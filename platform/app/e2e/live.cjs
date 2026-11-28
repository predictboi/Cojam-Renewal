// Live walk: the PWA against the REAL local API (no mock adapter), at 390x844 in EN and KO.
// Setup (see platform/app/README or the report):
//   service postgresql start
//   cd platform/api && npm run dev:seed && DEV_CHAIN=stub ALLOWED_ORIGINS=http://localhost:4181 npx tsx --env-file=.env src/server/main.ts
//   cd platform/app && npm run build:devapi && npx vite preview --mode devapi --port 4181
//   node e2e/live.cjs [en|ko|all]
// Each language starts from a fresh seed (npm run dev:seed in platform/api). Captures go to captures/live/<lang>/.
// Every API call is logged; any 4xx/5xx the walk did not expect counts as a failure.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = 'http://localhost:' + (process.env.APP_PORT || 4181);
const API = process.env.API_URL || 'http://localhost:8080';
const OUT = path.join(__dirname, '..', 'captures', 'live');
const API_DIR = path.join(__dirname, '..', '..', 'api');
const LANGS = (process.argv[2] || 'all') === 'all' ? ['en', 'ko'] : [process.argv[2]];
const DEV_USER = 'minji';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const psql = (q) => execSync(`psql "${process.env.DATABASE_URL || 'postgres://cojam:cojam@localhost:5432/cojam_dev'}" -At -c ${JSON.stringify(q)}`, { encoding: 'utf8' }).trim();

const results = [];
const ok = (name, cond, extra) => { results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : String(extra).slice(0, 400)]); if (!cond) console.log('FAIL', name, extra === undefined ? '' : String(extra).slice(0, 400)); };

async function apiGet(p) { const r = await fetch(API + p, { headers: { 'x-dev-user': DEV_USER } }); return r.json(); }

(async () => {
  const browser = await chromium.launch();
  for (const lang of LANGS) {
    execSync('npm run -s dev:seed', { cwd: API_DIR, stdio: 'ignore' });
    const dir = path.join(OUT, lang);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'block', timezoneId: 'Asia/Seoul', locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
    // signed out at the start (the mock wallet keeps its state in localStorage), no install nudge
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('cjp.nudged', '1');
        if (!sessionStorage.getItem('walk.init')) { sessionStorage.setItem('walk.init', '1'); localStorage.setItem('cjm.wallet', JSON.stringify({ pk: '0x' + '11'.repeat(32), email: null, auth: false })); }
      } catch (e) {}
    });
    const pg = await ctx.newPage();
    const log = [];
    const unexpected = [];
    let errs = [];
    const allowed = new Set(); // "METHOD path status" the current step expects
    pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|jsdelivr|net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    pg.on('response', async (res) => {
      const u = res.url();
      if (!u.startsWith(API)) return;
      const req = res.request();
      if (req.method() === 'OPTIONS') return;
      const p = u.slice(API.length).split('?')[0];
      let body = '';
      if (res.status() >= 400) { try { body = await res.text(); } catch (e) {} }
      const line = req.method() + ' ' + p + ' ' + res.status() + (body ? ' ' + body.slice(0, 200) : '');
      log.push(line);
      if (res.status() >= 400 && ![...allowed].some((a) => line.startsWith(a))) unexpected.push(line);
    });
    const shot = (name) => pg.screenshot({ path: path.join(dir, name + '.png') });
    const step = async (name, fn) => {
      errs = [];
      const before = unexpected.length;
      try { await fn(); } catch (e) { ok(lang + ' ' + name + ': no exception', false, e.message.split('\n')[0] + ' at ' + pg.url()); await shot(name + '-error').catch(() => {}); }
      ok(lang + ' ' + name + ': no page or console errors', errs.length === 0, errs.join(' | '));
      ok(lang + ' ' + name + ': no unexpected API errors', unexpected.length === before, unexpected.slice(before).join(' | '));
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth).catch(() => true);
      ok(lang + ' ' + name + ': no horizontal overflow', ov);
    };
    const text = (sel) => pg.locator(sel).first().innerText().catch(() => '');
    const wait = (sel, ms = 10000) => pg.waitForSelector(sel, { timeout: ms });

    /* ---------- login bootstrap ---------- */
    await step('login', async () => {
      await pg.goto(APP + '/login?standalone=1&lang=' + lang);
      await wait('#email');
      const cap = await text('#email-cap');
      ok(lang + ' login: the caption lists the providers from GET /v1/config', /Gmail/.test(cap) && /Naver/.test(cap), cap);
      await shot('login-email');
      await pg.fill('#email', DEV_USER + '@gmail.com');
      await pg.locator('#send').tap();
      await wait('#code');
      ok(lang + ' login: POST /v1/auth/email-check answered', log.some((l) => l.startsWith('POST /v1/auth/email-check 200')));
      await shot('login-code');
      await pg.fill('#code', '123456');
      await pg.waitForURL(/\/welcome/, { timeout: 30000 });
      ok(lang + ' login: POST /v1/session then a sponsored setPlayKey', log.some((l) => l.startsWith('POST /v1/session 200')) && log.some((l) => l.startsWith('POST /v1/tx/sponsor 200')), log.filter((l) => /session|sponsor/.test(l)).join(', '));
    });

    /* ---------- first run: the invite code (EN binds it here; KO leaves it for Profile) ---------- */
    await step('first-run', async () => {
      await wait('#next');
      await sleep(600);
      await shot('first-run-1');
      if (lang === 'en') {
        // the invite code is a visible field on the first page (an older build unfolded it from a link)
        if (await pg.locator('#code-open').count()) await pg.locator('#code-open').tap();
        await pg.fill('#code', 'DEVC2AB');
        await pg.locator('#code-apply').tap();
        await pg.waitForSelector('#code-msg.is-ok', { timeout: 8000 });
        ok(lang + ' first run: lookup names the inviter', /yu\*+m/.test(await text('#code-msg')), await text('#code-msg'));
        await shot('first-run-code-valid');
        await pg.locator('#next').tap();
        await sleep(1200);
        ok(lang + ' first run: POST /v1/invite/redeem bound the code', log.some((l) => l.startsWith('POST /v1/invite/redeem 200')), log.slice(-4).join(', '));
        await pg.locator('#next').tap(); await sleep(400);
      } else {
        await pg.locator('#next').tap(); await sleep(400);
        await pg.locator('#next').tap(); await sleep(400);
      }
      await shot('first-run-3');
      await pg.locator('#next').tap();
      await pg.waitForURL((u) => new URL(u).pathname === '/', { timeout: 15000 });
      const me = await apiGet('/v1/me');
      ok(lang + ' first run: onboarded saved', me.onboarded === true, JSON.stringify(me).slice(0, 200));
    });

    /* ---------- home: five picks by touch, Undo once ---------- */
    await step('home', async () => {
      await wait('.qcard[data-pos="0"] .choice', 15000);
      await sleep(800);
      const title = await text('.qcard[data-pos="0"] h2, .qcard[data-pos="0"] .qtitle, .qcard[data-pos="0"]');
      ok(lang + ' home: the seeded day shows (a question about tomorrow)', lang === 'en' ? /tomorrow/i.test(title) : /내일/.test(title), title.slice(0, 120));
      await shot('home-fresh');
      const cdp = await ctx.newCDPSession(pg);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      const drag = async (x0, y0, dx, steps = 12) => { await touch('touchStart', x0, y0); for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + (dx * i) / steps, y0); await sleep(16); } await touch('touchEnd'); };
      const box = () => pg.evaluate(() => { const r = document.querySelector('.qcard[data-pos="0"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      const cnt = () => pg.evaluate(() => +document.querySelector('#cnt').textContent);
      let c = await box();
      await drag(c.x + c.w / 2, c.y + c.h * 0.35, c.w * 0.6); await sleep(450);
      ok(lang + ' home: a swipe picks', (await cnt()) === 1);
      await pg.locator('#undo').tap(); await sleep(500);
      ok(lang + ' home: Undo takes the pick back', (await cnt()) === 0);
      for (let i = 0; i < 5; i++) { c = await box(); await drag(c.x + c.w / 2, c.y + c.h * 0.35, (i % 2 ? -1 : 1) * c.w * 0.6); await sleep(450); }
      ok(lang + ' home: five picks', (await cnt()) === 5, await cnt());
      await shot('home-finish');
      await pg.locator('#finish').tap();
      await pg.waitForURL(/\/done/, { timeout: 5000 });
    });

    /* ---------- done: the reward lands once the five predicts are mined on the stub chain ---------- */
    await step('done', async () => {
      await pg.waitForFunction(() => document.querySelector('#done-fig.is-pop'), null, { timeout: 30000 });
      await sleep(900);
      await shot('done');
      const sponsored = log.filter((l) => l.startsWith('POST /v1/tx/sponsor 200')).length;
      ok(lang + ' done: five predicts went through /v1/tx/sponsor', sponsored >= 6, sponsored + ' sponsored');
      const today = await apiGet('/v1/today');
      ok(lang + ' done: /v1/today shows the day complete', today.completed === true && today.markets.every((m) => m.myChoice), JSON.stringify({ c: today.completed, a: today.answered }));
      if (lang === 'en') ok(lang + ' done: the welcome note names the inviter', today.inviterName === 'yu***m', today.inviterName);
    });

    /* ---------- results (badge, evidence link), ranking, wallet ---------- */
    await step('results', async () => {
      const badge = await pg.evaluate(() => { const b = document.querySelector('a[href="/results"] .badge, [data-tab="results"] .badge, .tabbar a[href="/results"] b, .tabbar a[href="/results"] span.n'); return b ? b.textContent : ''; });
      await pg.goto(APP + '/results'); await wait('.rs-day', 10000); await sleep(800);
      await shot('results');
      const btn = pg.locator('li[data-out="set"] button[data-row]').first();
      await btn.tap(); await sleep(300);
      const ev = await pg.locator('.rs-more:not([hidden]) a.linkish').count();
      ok(lang + ' results: the evidence link of a decided row', ev > 0);
      await shot('results-open');
      await sleep(600);
      const me = await apiGet('/v1/me');
      ok(lang + ' results: opening Results reset the badge (resultsSeen)', me.newResults === 0 && me.resultsSeenAt > 0, 'badge before: ' + badge + ', ' + JSON.stringify({ n: me.newResults, at: me.resultsSeenAt }));
    });
    await step('ranking', async () => {
      await pg.goto(APP + '/ranking'); await sleep(1500);
      await shot('ranking');
      ok(lang + ' ranking: the top 10 lists the seeded players', (await pg.locator('.rk-row, .rank-row, li').count()) > 5);
      const prev = pg.locator('[role="radiogroup"] button, .seg button').nth(1);
      if (await prev.count()) { await prev.tap(); await sleep(1200); await shot('ranking-lastweek'); }
    });
    await step('wallet', async () => {
      await pg.goto(APP + '/wallet'); await wait('#ct-fig'); await sleep(800);
      await shot('wallet');
      ok(lang + ' wallet: CT balance from GET /v1/wallet', /1,840/.test(await text('#ct-fig')), await text('#ct-fig'));
      const pend = await text('.wpend');
      ok(lang + ' wallet: pending hit points with the time they land', pend === '' || !/NaN|1970|Invalid/.test(pend), pend);
    });

    /* ---------- convert: too new first, then an older account with points ---------- */
    await step('convert', async () => {
      await pg.goto(APP + '/convert'); await sleep(1500);
      await shot('convert-too-new');
      psql(`UPDATE users SET registered_at = now() - interval '30 days' WHERE privy_user_id = 'dev:${DEV_USER}'`);
      psql(`INSERT INTO points_ledger (wallet, kind, amount, ranked, tx_hash, log_index) SELECT wallet, 'hits', 5000, true, '0xwalk${lang}', 0 FROM users WHERE privy_user_id = 'dev:${DEV_USER}'`);
      await pg.goto(APP + '/convert'); await wait('#amt'); await sleep(1200);
      await pg.fill('#amt', '2000'); await sleep(300);
      await shot('convert-filled');
      await pg.locator('#go').tap();
      await wait('#tx-confirm', 5000).catch(() => {});
      if (await pg.locator('#tx-confirm').count()) await pg.locator('#tx-confirm').tap();
      await pg.waitForFunction(() => /2(\.0+)?\s*CT|2 CT/.test(document.body.innerText) && document.querySelector('.sheet-root.is-open'), null, { timeout: 20000 }).catch(() => {});
      await sleep(1500);
      await shot('convert-success');
      const conv = psql(`SELECT count(*) FROM conversions c JOIN users u ON u.wallet = c.wallet WHERE u.privy_user_id = 'dev:${DEV_USER}'`);
      ok(lang + ' convert: a sponsored convert reached the stub chain', conv === '1', conv);
      psql(`UPDATE users SET registered_at = now() - interval '3 hours' WHERE privy_user_id = 'dev:${DEV_USER}'`);
    });

    /* ---------- staking: quote and stake; my stakes: withdraw the unlocked one ---------- */
    await step('staking', async () => {
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.goto(APP + '/staking'); await wait('#amt'); await sleep(1000);
      await pg.fill('#amt', '500'); await sleep(1200);
      ok(lang + ' staking: GET /v1/staking/quote answered', log.some((l) => l.startsWith('GET /v1/staking/quote 200')), log.filter((l) => /quote/.test(l)).join(', '));
      await shot('staking-quote');
      await pg.locator('#go').tap();
      await wait('#tx-confirm', 5000);
      await shot('staking-review');
      await pg.locator('#tx-confirm').tap();
      for (let i = 0; i < 40 && (await apiGet('/v1/staking/positions')).totals.open < 3; i++) await sleep(500);
      await sleep(600);
      await shot('staking-success');
      const pos = await apiGet('/v1/staking/positions');
      ok(lang + ' staking: approve and stake sponsored, the position is open', pos.positions.length === 3 && pos.totals.open === 3, JSON.stringify(pos.totals));
    });
    await step('stakes', async () => {
      await pg.goto(APP + '/stakes'); await wait('[data-stake]', 10000); await sleep(800);
      await shot('stakes');
      const wd = pg.locator('[data-wd]').first();
      ok(lang + ' stakes: the unlocked stake offers Withdraw', (await wd.count()) === 1);
      await wd.tap();
      await wait('#tx-confirm', 3000).catch(() => {});
      if (await pg.locator('#tx-confirm').count()) await pg.locator('#tx-confirm').tap();
      await sleep(4000);
      await shot('stakes-withdrawn');
      const pos = await apiGet('/v1/staking/positions');
      const closed = pos.positions.find((p) => p.closed);
      ok(lang + ' stakes: withdraw closed the position with paidWei', !!closed && BigInt(closed.paidWei) > 500n * 10n ** 18n, JSON.stringify(closed || {}).slice(0, 160));
      await pg.goto(APP + '/stakes'); await wait('[data-stake]'); await sleep(600);
      const det = pg.locator('details, .help summary, button[aria-expanded]').last();
      if (await det.count()) { await det.tap().catch(() => {}); await sleep(300); }
      await shot('stakes-closed');
      ok(lang + ' stakes: the closed stake shows the amount paid out', !/0\.00 CT|: 0\b/.test(await text('.mclosed .tiny')), await text('.mclosed .tiny'));
    });

    /* ---------- invite and profile ---------- */
    await step('invite', async () => {
      await pg.goto(APP + '/invite'); await sleep(1500);
      await shot('invite');
      ok(lang + ' invite: own code shown', /DEVA2AB/.test(await pg.locator('body').innerText()));
    });
    await step('profile', async () => {
      await pg.goto(APP + '/profile'); await wait('#name'); await sleep(800);
      await shot('profile');
      await pg.fill('#name', 'minji park'); await pg.locator('#save').tap(); await sleep(1000);
      ok(lang + ' profile: PATCH /v1/me saved the name', (await apiGet('/v1/me')).displayName === 'minji park');
      if (lang === 'ko') {
        await pg.locator('button#code-row').tap(); await wait('.sheet-root.is-open #code');
        await pg.fill('.sheet-root.is-open #code', 'DEVC2AB');
        await pg.locator('.sheet-root.is-open #code-apply').tap();
        await wait('.sheet-root.is-open #code-link:not([hidden])', 8000);
        await shot('profile-code-valid');
        await pg.locator('.sheet-root.is-open #code-link').tap(); await sleep(1500);
        await shot('profile-code-linked');
        const inv = await apiGet('/v1/invite');
        ok(lang + ' profile: the late code is linked (POST /v1/invite/redeem source profile)', inv.linkedTo && /yu/.test(inv.linkedTo.name), JSON.stringify(inv.linkedTo));
      }
      // language: switch to the other one and back (saved on the account)
      const other = lang === 'en' ? 'ko' : 'en';
      const seg = pg.locator('[role="radiogroup"] [role="radio"], .seg button').filter({ hasText: other === 'ko' ? '한국어' : 'English' }).first();
      if (await seg.count()) { await seg.tap(); await sleep(800); ok(lang + ' profile: language saved on the account', (await apiGet('/v1/me')).language === other); await shot('profile-lang'); const back = pg.locator('[role="radiogroup"] [role="radio"], .seg button').filter({ hasText: lang === 'ko' ? '한국어' : 'English' }).first(); await back.tap(); await sleep(600); }
      else ok(lang + ' profile: language control found', false);
    });

    /* ---------- account on hold (admin block through /admin/v1 with X-Dev-Admin) ---------- */
    await step('hold', async () => {
      const wallet = (await apiGet('/v1/me')).wallet;
      allowed.add('POST /v1/tx/sponsor 403 {"error":{"code":"FROZEN"'); // an account on hold gets no sponsored gas (DECISIONS)
      const r = await fetch(API + '/admin/v1/players/' + wallet + '/block', { method: 'POST', headers: { 'x-dev-admin': 'dev@cojam.app', 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'live walk' }) });
      ok(lang + ' hold: admin block answered', r.status === 200, r.status + ' ' + (await r.text()).slice(0, 120));
      for (const [name, route] of [['home', '/'], ['wallet', '/wallet'], ['staking', '/staking'], ['stakes', '/stakes'], ['invite', '/invite'], ['ranking', '/ranking'], ['profile', '/profile']]) {
        await pg.goto(APP + route); await sleep(1600);
        await shot('hold-' + name);
      }
      const inv = await apiGet('/v1/invite');
      ok(lang + ' hold: the invite code is hidden', inv.code === null && inv.available === false);
      const rk = await apiGet('/v1/ranking/week/current');
      ok(lang + ' hold: no prize rank', rk.me && rk.me.noPrize === true);
      await pg.goto(APP + '/invite'); await sleep(1200);
      ok(lang + ' hold: the invite screen hides the code', !/DEVA2AB/.test(await pg.locator('body').innerText()));
    });

    fs.writeFileSync(path.join(dir, 'api-log.txt'), log.join('\n') + '\n');
    await ctx.close();
  }
  await browser.close();
  const fails = results.filter((r) => r[0] === 'FAIL');
  console.log(results.length - fails.length + ' passed, ' + fails.length + ' failed');
  fs.writeFileSync(path.join(OUT, 'live-result.json'), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
