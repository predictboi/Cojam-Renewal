// node tools/card-measure.js : for every card of the day at short sizes, in EN, KO and JA: the room between the answers and the pinned pick bar (negative means covered),
// whether main has to scroll, and each answer label with its line count and size. A quick look, not a pass or fail check (tools/small-check.js holds the rules).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const lang of ['en', 'ko', 'ja']) for (const [w, h] of [[320, 568], [360, 640], [375, 667]]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
    await pg.goto('http://localhost:8851/home.html?state=fresh&lang=' + lang); await pg.waitForTimeout(700);
    const out = [];
    for (let i = 0; i < 5; i++) {
      out.push(await pg.evaluate(() => {
        const c = document.querySelector('.qcard:not(.is-out)'); if (!c) return 'none';
        const ch = c.querySelector('.choices').getBoundingClientRect(), pin = document.querySelector('.pin.pickbar').getBoundingClientRect(), m = document.querySelector('main');
        const brk = [...c.querySelectorAll('.choice span')].map(s => { const r = document.createRange(); r.selectNodeContents(s); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size + ':' + getComputedStyle(s).fontSize + ':' + s.textContent; }).join(' / ');
        return Math.round(pin.top - ch.bottom) + (m.scrollHeight > m.clientHeight + 1 ? ' scroll' + (m.scrollHeight - m.clientHeight) : '') + ' [' + brk + ']';
      }));
      if (i < 4) { await pg.evaluate(() => document.querySelector('.qcard:not(.is-out) .choice[data-dir="r"]').click()); await pg.waitForTimeout(700); }
    }
    console.log(w, h, lang, out.join(' | ')); await pg.close();
  }
  await b.close();
})();
