// Checks an unpacked design kit served at <base url>: loads both hubs, every page the hubs link to, and three screens in a state,
// and fails on any local 4xx or 5xx, failed local request, page error or console error. External font requests are only reported.
// Usage: node tools/design-kit/verify.js http://localhost:PORT/
const { chromium } = require('playwright');
const BASE = process.argv[2];
if (!BASE) { console.error('usage: node verify.js <base url>'); process.exit(2); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const bad = [], external = [];
  let current = '';
  page.on('response', (r) => { if (r.status() >= 400) (r.url().startsWith(BASE) ? bad : external).push(r.status() + ' ' + r.url() + ' (on ' + current + ')'); });
  page.on('requestfailed', (r) => { (r.url().startsWith(BASE) ? bad : external).push('failed ' + r.url() + ' (on ' + current + ')'); });
  page.on('pageerror', (e) => bad.push('pageerror on ' + current + ': ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|jsdelivr/.test(m.text())) bad.push('console error on ' + current + ': ' + m.text()); });

  async function visit(path) {
    current = path;
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(400);
  }
  const pages = new Set();
  for (const hub of ['index.html', 'admin/hub.html']) {
    await visit(hub);
    const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
    for (const l of links) if (l.startsWith(BASE) && !/[?&]state=/.test(l)) pages.add(l.slice(BASE.length).split('#')[0]);
  }
  for (const p of ['home-cards.html?state=fresh&lang=en', 'staking.html?state=review&lang=ko', 'admin/players.html?state=block']) pages.add(p);
  for (const p of [...pages].sort()) await visit(p);
  await browser.close();
  console.log('visited ' + (pages.size + 2) + ' pages');
  if (external.length) console.log('external requests that failed (fonts need a network connection):\n  ' + [...new Set(external)].join('\n  '));
  if (bad.length) { console.error('PROBLEMS:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('no missing files, no page errors');
})();
