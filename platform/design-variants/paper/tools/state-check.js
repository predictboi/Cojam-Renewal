// node tools/state-check.js [langs] : opens every screen in every state (assets/states.js) and reports page errors, missing copy keys ("[key]"),
// sideways overflow, and empty pages. Default languages: en,ko,ja. Prints the totals.
const { chromium } = require('playwright'); const STATES = require('../assets/states.js');
(async () => {
  const langs = (process.argv[2] || 'en,ko,ja').split(','), b = await chromium.launch(); let n = 0; const bad = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const [id, , , file, states] of STATES) for (const st of states) for (const lang of langs) {
    const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://localhost:8851/' + file + '?lang=' + lang + (st ? '&state=' + st : ''), { waitUntil: 'load' }); await pg.waitForTimeout(350);
    const r = await pg.evaluate(() => ({ keys: (document.body.innerText.match(/\[[a-z]+\.[a-z0-9.]+\]/g) || []).join(' '), over: document.documentElement.scrollWidth - innerWidth, len: document.body.innerText.trim().length, und: /undefined|NaN/.test(document.body.innerText) }));
    n++; if (errs.length || r.keys || r.over > 0 || r.len < 20 || r.und) bad.push([id, file, st, lang, errs.join('|'), r.keys, r.over > 0 ? 'overflow ' + r.over : '', r.len < 20 ? 'empty' : '', r.und ? 'undefined/NaN in text' : ''].filter(Boolean).join('  '));
    await pg.close();
  }
  console.log(n + ' pages checked (' + STATES.reduce((a, s) => a + s[4].length, 0) + ' states x ' + langs.length + ' languages), ' + bad.length + ' with problems'); bad.forEach(x => console.log('  ' + x));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
