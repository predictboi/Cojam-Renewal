// Captures the representative screenshots for the design kit zip, from a local server, with animations settled.
// Usage: node tools/design-kit/shots.js <base url, e.g. http://localhost:8847/> <out dir>
// PWA at 390x844 (DPR 2, touch) in EN, admin at 1440x900 (DPR 1). Chromium comes with Playwright; nothing is installed.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.argv[2];
const OUT = process.argv[3];
if (!BASE || !OUT) { console.error('usage: node shots.js <base url> <out dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

// [file name, url, wait in ms after fonts are ready]
const PWA = [
  ['01-home-cards', 'home-cards.html?state=fresh', 2800],
  ['02-home-list', 'home-terminal.html?state=fresh', 1200],
  ['03-day-done', 'done.html?state=moment', 6000],
  ['04-results', 'results.html', 1200],
  ['05-ranking', 'ranking.html', 1200],
  ['06-staking-new', 'staking.html', 1200],
  ['07-staking-review-sheet', 'staking.html?state=review', 1800],
  ['08-wallet', 'wallet.html', 1200],
  ['09-profile', 'profile.html', 1200],
  ['10-invite', 'invite.html', 1200],
  ['11-account-on-hold', 'wallet.html?state=hold', 1200],
];
const ADMIN = [
  ['12-admin-dashboard', 'admin/index.html', 1200],
  ['13-admin-questions', 'admin/questions.html', 1200],
  ['14-admin-players-block', 'admin/players.html?state=block', 1500],
];

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  async function run(list, ctxOpts, lang) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push('pageerror ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) problems.push(r.status() + ' ' + r.url()); });
    for (const [name, url, wait] of list) {
      await page.evaluate(() => { try { sessionStorage.clear(); localStorage.clear(); } catch (e) {} }).catch(() => {});
      const full = BASE + url + (lang ? (url.includes('?') ? '&' : '?') + 'lang=' + lang : '');
      await page.goto(full, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(OUT, name + '.png') });
      console.log('captured ' + name);
    }
    await ctx.close();
  }
  await run(PWA, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US' }, 'en');
  await run(ADMIN, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-US' }, '');
  await browser.close();
  if (problems.length) { console.error('problems:\n' + problems.join('\n')); process.exit(1); }
  console.log('no page errors, no local 4xx');
})();
