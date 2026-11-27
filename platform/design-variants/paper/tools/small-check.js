// node tools/small-check.js : the checks review B asked for.
// 1. The two answer buttons of the front card are fully inside the card and at least 44 px tall, on short and narrow viewports, in every home state
//    that has a card, in EN, KO and JA (scrolling inside main is allowed: the buttons must be reachable and whole, not clipped).
// 2. At 320 px, and at 360 and 390 px with the root font at 130% and 200%, nothing in the masthead, the language control or the tab bar leaves the screen,
//    the page does not overflow sideways, and tab labels stay on one line.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const bad = []; let n = 0;
  const sizes = [[320, 568], [360, 560], [360, 640], [375, 667], [390, 844], [844, 390]], states = ['fresh', 'partial', 'failed', 'offline', 'slow', 'syncing', 'reconnect', 'noimage'];
  for (const [w, h] of sizes) for (const st of states) for (const lang of ['en', 'ko', 'ja']) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
    await pg.goto('http://localhost:8851/home.html?state=' + st + '&lang=' + lang, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(350);
    const r = await pg.evaluate(() => { const c = document.querySelector('.qcard[data-pos="0"]'); if (!c) return { none: true }; const cr = c.getBoundingClientRect();
      const m = document.querySelector('main'); const btn = [...c.querySelectorAll('.choice')].map(x => x.getBoundingClientRect()); const h2 = c.querySelector('h2');
      return { inside: btn.every(q => q.top >= cr.top - 0.5 && q.bottom <= cr.bottom + 0.5 && q.left >= cr.left && q.right <= cr.right), tall: Math.min(...btn.map(q => q.height)), wide: Math.min(...btn.map(q => q.width)),
        clipped: h2.scrollHeight > h2.clientHeight + 8 || getComputedStyle(h2).webkitLineClamp !== "none", reach: cr.bottom <= m.getBoundingClientRect().bottom + 0.5 || m.scrollHeight > m.clientHeight, over: document.documentElement.scrollWidth - innerWidth }; });
    n++; if (r.none || !r.inside || r.tall < 44 || r.wide < 44 || r.clipped || !r.reach || r.over > 0) bad.push('answers ' + w + 'x' + h + ' ' + st + ' ' + lang + ' ' + JSON.stringify(r));
    await pg.close();
  }
  const pages = ['home.html?state=partial', 'results.html', 'ranking.html', 'staking.html', 'stakes.html', 'wallet.html', 'convert.html', 'withdraw.html?state=filled', 'deposit.html', 'profile.html', 'invite.html', 'done.html?state=results', 'done.html?state=zero', 'login.html', 'gate.html?state=android', 'first-run.html', 'system.html?state=blocked'];
  for (const [w, scale] of [[320, 100], [360, 130], [390, 130], [390, 200], [360, 200]]) for (const url of pages) for (const lang of ['en', 'ko', 'ja']) {
    const pg = await b.newPage({ viewport: { width: w, height: 780 }, isMobile: true, hasTouch: true });
    await pg.addInitScript((s) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = s + '%'; }); try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} }, scale);
    await pg.goto('http://localhost:8851/' + url + (url.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(350);
    const r = await pg.evaluate(() => { const out = []; const W = innerWidth;
      for (const sel of ['.pts', '.me', '.select', '.mast-back', '.tb a', '.gate-bar .linkish', '.plate img', '.seg-btn', '.btn', '.choice', '.tri-fig', '.stat b', '.addr-v i', '.krow-prize', '.field-box']) for (const el of document.querySelectorAll(sel)) { const q = el.getBoundingClientRect(); if (q.width && (q.right > W + 0.5 || q.left < -0.5)) out.push(sel + ' ' + Math.round(q.left) + '..' + Math.round(q.right)); }
      for (const el of document.querySelectorAll('.tb a > span:nth-child(2)')) { if (el.getClientRects().length > 1 || el.scrollWidth > el.clientWidth + 1) out.push('tab label wraps or clips: ' + el.textContent); }
      const figs = [...document.querySelectorAll('.tri-fig')].map(e => e.getBoundingClientRect()); for (let i = 1; i < figs.length; i++) if (figs[i].top === figs[i - 1].top && figs[i].left < figs[i - 1].right) out.push('figures overlap');
      if (document.documentElement.scrollWidth - W > 0) out.push('page overflow ' + (document.documentElement.scrollWidth - W));
      return [...new Set(out)]; });
    n++; if (r.length) bad.push('reflow ' + w + 'px ' + scale + '% ' + url + ' ' + lang + ': ' + r.slice(0, 4).join('; '));
    await pg.close();
  }
  console.log(n + ' checks, ' + bad.length + ' failed'); bad.slice(0, 60).forEach(x => console.log('  ' + x));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
