// node tools/lang-switch-check.js : the language switch must never wrap or clip from 360 to 440 px, in every language, on every screen that has it.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0, n = 0;
  for (const w of [360, 375, 390, 414, 440]) for (const lang of ['en', 'ko', 'ja']) for (const page of ['index.html', 'login.html', 'first-run.html', 'profile.html']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true }); const pg = await ctx.newPage();
    await pg.goto('http://localhost:8856/' + page + '?lang=' + lang, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready);
    const r = await pg.evaluate(() => { const g = document.querySelector('.langs'); const gr = g.getBoundingClientRect();
      return [...g.children].map(c => { const cr = c.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(c); const tr = range.getBoundingClientRect();
        return { t: c.textContent, lines: Math.round(tr.height / parseFloat(getComputedStyle(c).lineHeight || 20)), clip: c.scrollWidth > c.clientWidth + 1 || tr.left < cr.left || tr.right > cr.right, out: cr.right > innerWidth + 0.5 || cr.left < 0, lineH: tr.height }; }); });
    for (const c of r) { n++; if (c.clip || c.out || c.lineH > 28) { bad++; console.log('FAIL', w, lang, page, JSON.stringify(c)); } }
    await ctx.close();
  }
  console.log(n + ' buttons checked, ' + bad + ' wrapped or clipped'); await b.close(); process.exit(bad ? 1 : 0);
})();
