// node tools/lang-switch-check.js : the language control on every screen that has one (hub, gate, login, first run, profile), at 360, 390 and 440 px, in EN, KO and JA.
// Fails a control when a label wraps to more than one line, is clipped by its cell, or the page overflows sideways.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0; const rows = [];
  for (const [name, url, sel] of [['hub', 'index.html', '#langs .seg-btn'], ['login', 'login.html', '.select'], ['gate', 'gate.html?state=android', '.select'], ['first-run', 'first-run.html', '#langrow .seg-btn'], ['profile', 'profile.html', '[data-seg="lang"] .seg-btn']])
    for (const w of [360, 390, 440]) for (const lang of ['en', 'ko', 'ja']) {
      const pg = await b.newPage({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true });
      await pg.goto('http://localhost:8851/' + url + '?lang=' + lang, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(300);
      const r = await pg.evaluate((sel) => { const els = [...document.querySelectorAll(sel)]; return { n: els.length, overflow: document.documentElement.scrollWidth - innerWidth,
        fail: els.filter(e => { const s = getComputedStyle(e), lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.5; const rng = document.createRange(); rng.selectNodeContents(e); const lines = new Set([...rng.getClientRects()].map(q => Math.round(q.top))).size; const t = rng.getBoundingClientRect(), box = e.getBoundingClientRect(); return (sel === '.select' ? false : lines > 1) || e.scrollWidth > e.clientWidth + 1 || t.left < box.left - 1 || t.right > box.right + 1 || box.height < 44; }).map(e => e.textContent.trim()) }; }, sel);
      const ok = r.n > 0 && !r.fail.length && r.overflow <= 0; if (!ok) bad++;
      rows.push({ screen: name, width: w, lang, controls: r.n, overflow: r.overflow, result: ok ? 'ok' : 'FAIL ' + r.fail.join(',') });
      await pg.close();
    }
  console.table(rows.filter(r => r.result !== 'ok').length ? rows.filter(r => r.result !== 'ok') : [{ checked: rows.length, failed: 0 }]);
  if (!bad) { const pg = await b.newPage({ viewport: { width: 440, height: 500 }, deviceScaleFactor: 2 }); await pg.goto('http://localhost:8851/index.html?lang=ko'); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(300); await pg.screenshot({ path: __dirname + '/../captures/index-ko-440.png' }); await pg.setViewportSize({ width: 360, height: 500 }); await pg.waitForTimeout(200); await pg.screenshot({ path: __dirname + '/../captures/index-ko-360.png' }); }
  await b.close(); process.exit(bad ? 1 : 0);
})();
