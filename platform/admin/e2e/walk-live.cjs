// Live walk against a real local API (DEV_CHAIN=stub, AUTH_DEV_BYPASS=1, seeded with npm run dev:seed) and the admin
// dev server started with VITE_DEV_ADMIN. Drives the UI for every write the brief lists, then checks the audit log.
//   APP=http://localhost:5192 API=http://localhost:8091 node e2e/walk-live.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP = process.env.APP || 'http://localhost:5192';
const API = process.env.API || 'http://localhost:8091';
const H = { 'x-dev-admin': process.env.DEV_ADMIN || 'dev@cojam.app' };
const out = path.join(__dirname, '..', 'captures', 'live');
fs.mkdirSync(out, { recursive: true });
const NOTE = 'Checked the source page and the schedule: e2e run.';
const results = [];
const api = async (p) => (await fetch(API + p, { headers: H })).json();

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const go = async (u) => { await page.goto(APP + u, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); };
  const confirmWith = async (note = NOTE) => {
    await page.waitForSelector('#sheet');
    if (await page.$('#sheet [data-why]')) await page.fill('#sheet [data-why]', note);
    await page.click('#sheet [data-confirm]');
    await page.waitForSelector('#sheet', { state: 'detached', timeout: 10000 });
    const t = await page.textContent('.toasts').catch(() => '');
    await page.waitForTimeout(600);
    return t;
  };
  const step = async (name, fn) => {
    try { const r = await fn(); results.push({ step: name, ok: true, toast: String(r || '').trim().slice(0, 180) }); }
    catch (e) {
      results.push({ step: name, ok: false, error: String(e).slice(0, 300), sheet: await page.textContent('#sheet').catch(() => null) });
      await page.screenshot({ path: path.join(out, 'fail-' + name.replace(/\W+/g, '-') + '.png') });
      await page.keyboard.press('Escape').catch(() => {});
    }
  };

  await step('dashboard figures', async () => {
    await go('/');
    const d = await api('/admin/v1/dashboard/detail');
    const shown = await page.textContent('#view .figs .fig .fig-v');
    await page.screenshot({ path: path.join(out, 'w-dashboard.png'), fullPage: true });
    return 'Registered shown ' + (await page.$$eval('#view .fig', (f) => f.map((x) => x.textContent).find((t) => t.startsWith('Registered')))) + '; API registered ' + d.users.registered + '; first fig ' + shown;
  });
  await step('cancel a scheduled question', async () => { await go('/questions?day=20784'); await page.click('[data-act="cancelq"][data-arg="Q-1127-1"]'); return confirmWith(); });
  await step('replace (save edited text) of a scheduled question', async () => {
    await go('/questions?day=20784&q=Q-1127-2');
    await page.fill('#title-en', 'Will Ethereum be above $3,600 at 21:00 tomorrow?');
    await page.click('[data-act="save"]'); return confirmWith();
  });
  await step('void a live question', async () => { await go('/questions?day=20783&q=Q-1126-2'); await page.click('#editor [data-act="void"]'); return confirmWith(); });
  await step('answer rerun', async () => { await go('/answers?q=Q-1125-5'); await page.click('[data-act="rerun"]'); return confirmWith(); });
  await step('answer correct inside the window', async () => { await go('/answers?q=Q-1125-3'); await page.click('[data-act="correct"]'); return confirmWith('The KMA page shows the daily high under 10 degrees.'); });
  await step('clear a player on the review list', async () => { await go('/players'); await page.click('[data-act="clear"]'); return confirmWith(); });
  await step('block a player from search and the drawer', async () => {
    await go('/players?state=search&q=dalgona');
    await page.click('[data-act="detail"]'); await page.waitForSelector('.drawer [data-act="block"]');
    await page.screenshot({ path: path.join(out, 'w-drawer.png') });
    await page.click('.drawer [data-act="block"]'); return confirmWith();
  });
  await step('unblock the player', async () => {
    const s = await api('/admin/v1/players?list=all&q=dalgona'); const wallet = s.players[0].wallet;
    await go('/players?state=blocked');
    await page.screenshot({ path: path.join(out, 'w-blocked.png'), fullPage: true });
    await page.click('[data-act="unblock"][data-arg="' + wallet + '"]'); return confirmWith();
  });
  await step('email domain add', async () => {
    await go('/system?state=adddomain');
    await page.fill('#dm', 'proton.me'); await page.fill('#dn', 'Proton Mail');
    await page.click('[data-act="adddomain"]'); return confirmWith();
  });
  await step('email domain disable', async () => { await go('/system'); await page.click('[data-act="domain"][data-arg="proton.me"]'); return confirmWith(); });
  await step('maintenance on', async () => { await go('/system'); await page.click('[data-act="maint"]'); const t = await confirmWith(); await go('/system'); await page.screenshot({ path: path.join(out, 'w-maintenance.png'), fullPage: true }); return t + ' / top status: ' + (await page.textContent('.top-status')); });
  await step('maintenance off', async () => { await go('/system'); await page.click('[data-act="maint"]'); return confirmWith(); });
  await step('run a job now', async () => { await go('/system'); await page.click('[data-act="run"][data-arg="settle"]'); return confirmWith(); });

  const aud = await api('/admin/v1/audit?limit=50');
  const actions = aud.entries.map((e) => e.action + ' ' + (e.target || '') + (e.payload && e.payload.reason ? ' [note: ' + String(e.payload.reason).slice(0, 30) + ']' : ''));
  const want = ['question.cancel', 'question.replace', 'question.void', 'answer.rerun', 'answer.correct', 'player.clear', 'player.block', 'player.unblock', 'email_domain.add', 'email_domain.update', 'app.maintenance.on', 'app.maintenance.off', 'job.run'];
  const missing = want.filter((a) => !aud.entries.some((e) => e.action === a));
  await go('/system'); await page.screenshot({ path: path.join(out, 'w-system-log.png'), fullPage: true });
  await b.close();
  console.log(JSON.stringify({ results, auditActions: actions, missingInAudit: missing, consoleErrors: errs }, null, 1));
})();
