// node tools/state-check.js [langs] [width] [height] : opens every screen in every state (assets/states.js) and reports page errors, missing copy keys ("[key]"),
// sideways overflow, empty pages, and tap targets covered by another element (elementFromPoint at the centre and four inner points of every button and link). Default languages: en,ko,ja. Prints the totals.
const { chromium } = require('playwright'); const STATES = require('../assets/states.js');
(async () => {
  const langs = (process.argv[2] || 'en,ko,ja').split(','), b = await chromium.launch(); let n = 0; const bad = [];
  const ctx = await b.newContext({ viewport: { width: +process.argv[3] || 390, height: +process.argv[4] || 844 }, isMobile: true, hasTouch: true });
  for (const [id, , , file, states] of STATES) for (const st of states) for (const lang of langs) {
    const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://localhost:8851/' + file + '?lang=' + lang + (st ? '&state=' + st : ''), { waitUntil: 'load' }); await pg.waitForTimeout(350);
    const cov = await pg.evaluate(() => { const out = []; const root = document.querySelector('.sheet-root.is-open #sheet') || document.body;
      for (const el of root.querySelectorAll('button, a[href], summary, select, input:not([type=hidden])')) {
        if (el.disabled || el.closest('[inert], [hidden], [aria-hidden="true"], details:not([open]) > :not(summary)')) continue; const q = el.getBoundingClientRect(), st = getComputedStyle(el);
        if (q.width < 2 || q.height < 2 || st.visibility === 'hidden' || st.pointerEvents === 'none' || +st.opacity === 0 && el.tagName !== 'SELECT') continue; if (q.bottom < 0 || q.top > innerHeight || q.right < 0 || q.left > innerWidth) continue;
        const pts = [[.5, .5], [.3, .3], [.7, .3], [.3, .7], [.7, .7]]; let bad = 0;
        for (const [fx, fy] of pts) { const x = q.left + q.width * fx, y = q.top + q.height * fy; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue; const hit = document.elementFromPoint(x, y); if (!hit) continue;
          if (!(el.contains(hit) || hit.contains(el) || (hit.closest('label') && hit.closest('label').contains(el)))) { if (hit.closest('.tb, .mast, .pin, .toasts, .offbar')) continue; bad++; } }   // sticky chrome over a scrolled control is not a covered target
        if (bad) out.push((el.id || el.className || el.tagName).toString().slice(0, 30) + ' ' + bad + '/5'); }
      return out.slice(0, 4).join('; '); });
    const r = await pg.evaluate(() => ({ keys: (document.body.innerText.match(/\[[a-z]+\.[a-z0-9.]+\]/g) || []).join(' '), over: document.documentElement.scrollWidth - innerWidth, len: document.body.innerText.trim().length, und: /undefined|NaN/.test(document.body.innerText) }));
    n++; if (errs.length || r.keys || r.over > 0 || r.len < 20 || r.und || cov) bad.push([id, file, st, lang, errs.join('|'), cov ? 'covered: ' + cov : '', r.keys, r.over > 0 ? 'overflow ' + r.over : '', r.len < 20 ? 'empty' : '', r.und ? 'undefined/NaN in text' : ''].filter(Boolean).join('  '));
    await pg.close();
  }
  console.log(n + ' pages checked (' + STATES.reduce((a, s) => a + s[4].length, 0) + ' states x ' + langs.length + ' languages), ' + bad.length + ' with problems'); bad.forEach(x => console.log('  ' + x));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
