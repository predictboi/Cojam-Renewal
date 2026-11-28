// node tools/lang-switch-check.js   the language switch must never wrap or clip from 360 to 440 px, in EN, KO and JA
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const w of [360, 375, 390, 414, 440]) for (const lang of ['en', 'ko', 'ja']) for (const page of ['index.html', 'login.html', 'first-run.html', 'profile.html']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true }); const pg = await ctx.newPage();
    await pg.goto('http://localhost:8858/' + page + '?lang=' + lang); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(250);
    const r = await pg.evaluate(() => { const seg = document.querySelector('.lang .seg'); const bs = [...seg.querySelectorAll('button')]; const sr = seg.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth - innerWidth, clipped: sr.left < 0 || sr.right > innerWidth, wrapped: bs.some(x => x.scrollWidth > x.clientWidth + 1 || x.getBoundingClientRect().height > 46 || x.getBoundingClientRect().top !== bs[0].getBoundingClientRect().top), cut: bs.some(x => { const q = x.getBoundingClientRect(); return q.left < sr.left - 1 || q.right > sr.right + 1; }) }; });
    if (r.overflow > 0 || r.clipped || r.wrapped || r.cut) { bad++; console.log('FAIL', w, lang, page, JSON.stringify(r)); }
    await ctx.close();
  }
  console.log(bad ? bad + ' failures' : 'PASS: 60 combinations, no wrap, no clip'); await b.close();
})();
