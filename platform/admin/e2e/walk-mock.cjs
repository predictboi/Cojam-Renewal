// Mock walk: every screen and state of the hub at 1440x900 and 1280x800. Checks console errors and horizontal
// overflow, writes captures to captures/mock/, and side by side captures (app | prototype) of the eight main screens
// to captures/compare/ with the pixel difference. Needs the mock dev server (npm run dev:mock, default :5190) and the
// design served from platform/design (python3 -m http.server 8812 -d platform/design).
//   APP=http://localhost:5190 PROTO=http://localhost:8812/admin node e2e/walk-mock.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP = process.env.APP || 'http://localhost:5190';
const PROTO = process.env.PROTO || 'http://localhost:8812/admin';
const S = [
  ['signin', '/signin', 'signin.html', ['sending', 'code', 'wrongcode', 'expired', 'notallowed', 'failed', 'idle']],
  ['dashboard', '/', 'index.html', ['calm', 'loading', 'error']],
  ['rewards', '/rewards', 'rewards.html', ['none', 'editing', 'invalid', 'review', 'connect', 'wrongwallet', 'signing', 'failed', 'proposed', 'ready', 'cancel', 'loading', 'error']],
  ['questions', '/questions', 'questions.html', ['scheduled', 'edit', 'short', 'noimage', 'regen', 'swap', 'cancel', 'void', 'emptyqueue', 'loading', 'error']],
  ['answers', '/answers', 'answers.html', ['correct', 'after', 'sign', 'compensate', 'compensated', 'void', 'late', 'rerun', 'waiting', 'corrected', 'empty', 'loading', 'error']],
  ['ranking', '/ranking', 'ranking.html', ['last', 'ready', 'waiting', 'sending', 'failed', 'lowreserve', 'capped', 'empty', 'loading', 'error']],
  ['system', '/system', 'system.html', ['failing', 'maintenance', 'maint', 'adddomain', 'domainerror', 'disabledomain', 'addadmin', 'loading', 'error']],
  ['players', '/players', 'players.html', ['detail', 'block', 'blockerror', 'clear', 'blocked', 'unblock', 'unblockfail', 'invites', 'search', 'noresult', 'empty', 'loading', 'error']],
];
const out = path.join(__dirname, '..', 'captures');
fs.mkdirSync(path.join(out, 'mock'), { recursive: true });
fs.mkdirSync(path.join(out, 'compare'), { recursive: true });

(async () => {
  const b = await chromium.launch();
  const problems = [];
  let n = 0;
  for (const [w, h] of [[1440, 900], [1280, 800]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    let errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    for (const [name, route, , states] of S) {
      const variants = ['', ...states.map((s) => 'state=' + s), ...(name === 'signin' ? [] : ['env=kairos', 'role=viewer']), ...(name === 'system' || name === 'rewards' ? ['role=owner'] : [])];
      for (const v of variants) {
        errs = [];
        await page.goto(APP + route + (v ? '?' + v : ''), { waitUntil: 'networkidle' });
        await page.waitForTimeout(250);
        const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const file = path.join(out, 'mock', `${name}${v ? '-' + v.replace(/[=&]/g, '-') : ''}-${w}.png`);
        await page.screenshot({ path: file, fullPage: true });
        n++;
        if (errs.length || ov > 0) problems.push({ page: name, v, w, errs, overflow: ov });
      }
    }
    await ctx.close();
  }
  // under 900 px: the "Open the admin on a computer" message
  const small = await b.newPage({ viewport: { width: 820, height: 900 } });
  await small.goto(APP + '/', { waitUntil: 'networkidle' });
  const phone = await small.evaluate(() => getComputedStyle(document.querySelector('.phone')).display !== 'none' && getComputedStyle(document.querySelector('.main')).display === 'none');
  await small.screenshot({ path: path.join(out, 'mock', 'phone-820.png') });
  // side by side: app | prototype, default state of the eight main screens at 1440
  const cmp = [];
  const pa = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const pb = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const [name, route, file] of S) {
    await pa.goto(APP + route, { waitUntil: 'networkidle' }); await pb.goto(PROTO + '/' + file, { waitUntil: 'networkidle' });
    await pa.waitForTimeout(300); await pb.waitForTimeout(300);
    const A = path.join(out, 'compare', name + '-app.png'), B = path.join(out, 'compare', name + '-proto.png');
    await pa.screenshot({ path: A, fullPage: true }); await pb.screenshot({ path: B, fullPage: true });
    cmp.push(name);
  }
  await b.close();
  console.log(JSON.stringify({ captures: n, problems, phoneMessageUnder900: phone, compared: cmp }, null, 1));
})();
