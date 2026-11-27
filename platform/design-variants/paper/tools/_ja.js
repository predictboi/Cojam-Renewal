// lists Japanese display text set larger than 28 px or without synthetic weight
const { chromium } = require('playwright'); const STATES = require('../assets/states.js');
(async () => { const b = await chromium.launch(); const seen = {};
  for (const [id, , , file] of STATES) { const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    await pg.goto('http://localhost:8851/' + file + '?lang=ja'); await pg.waitForTimeout(700);
    const r = await pg.evaluate(() => { const out = []; for (const el of document.querySelectorAll('body *')) { const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (!/[぀-ヿ一-鿿]/.test(own)) continue; const s = getComputedStyle(el); if (!/Besley/.test(s.fontFamily)) continue; const fs = parseFloat(s.fontSize);
      if (fs > 28.5 || (fs > 20 && s.fontSynthesisWeight === 'none')) out.push((el.className || el.tagName) + ' ' + fs + ' ' + s.fontSynthesisWeight + ' "' + own.slice(0, 14) + '"'); } return out; });
    r.forEach(x => { if (!seen[x]) { seen[x] = 1; console.log(file, x); } }); await pg.close(); }
  await b.close(); })();
