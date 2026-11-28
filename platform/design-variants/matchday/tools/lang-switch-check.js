// node tools/lang-switch-check.js : the language switch must sit on one line, unclipped, at 360, 390 and 440 px in all three languages.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0, n = 0;
  for (const w of [360, 390, 440]) for (const lang of ['en', 'ko', 'ja']) for (const page of ['index.html', 'login.html', 'first-run.html', 'first-run.html?state=3', 'profile.html']) {
    const pg = await b.newPage({ viewport: { width: w, height: 780 } });
    await pg.goto('http://localhost:8857/' + page + (page.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready);
    const r = await pg.evaluate(() => { const el = document.querySelector('.lang'); const bs = [...el.querySelectorAll('button')]; const box = el.getBoundingClientRect();
      return { tops: new Set(bs.map(x => Math.round(x.getBoundingClientRect().top))).size, clipped: bs.some(x => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1), inside: box.left >= 0 && box.right <= innerWidth, h: Math.min(...bs.map(x => x.getBoundingClientRect().height)) }; });
    n++; if (r.tops !== 1 || r.clipped || !r.inside || r.h < 44) { bad++; console.log('FAIL', w, lang, page, JSON.stringify(r)); }
    await pg.close();
  }
  console.log(n + ' checks, ' + bad + ' failures'); await b.close();
})();
