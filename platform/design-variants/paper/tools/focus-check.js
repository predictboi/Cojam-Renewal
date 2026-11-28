// node tools/focus-check.js : tabs through every focusable control of the scrolling screens and checks that the focused control is never under the
// tab bar, a pinned bar or the masthead (WCAG 2.4.7). 390 x 844, keyboard only.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), bad = []; let n = 0;
  for (const url of ['stakes.html', 'profile.html', 'results.html', 'wallet.html', 'staking.html', 'convert.html', 'withdraw.html', 'invite.html', 'ranking.html', 'done.html', 'home-list.html', 'deposit.html']) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } }); await pg.goto('http://localhost:8851/' + url + '?lang=en', { waitUntil: 'load' }); await pg.waitForTimeout(900);
    for (let i = 0; i < 60; i++) { await pg.keyboard.press('Tab'); await pg.waitForTimeout(40);
      const r = await pg.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const q = a.getBoundingClientRect(), tb = document.querySelector('.tb'), pin = document.querySelector('.app > .pin'), mast = document.querySelector('.mast');
        if (a.closest('.tb, .pin, .mast, .skip')) return { ok: true, last: !!a.closest('.tb') && a === [...document.querySelectorAll('.tb a')].pop() };
        const low = innerHeight - (tb ? tb.offsetHeight : 0) - (pin && !pin.classList.contains('is-away') ? pin.offsetHeight : 0), high = mast ? mast.getBoundingClientRect().bottom : 0;
        return { ok: q.bottom <= low + 1 && q.top >= high - 1, what: (a.id || a.className || a.tagName) + ' ' + Math.round(q.top) + '..' + Math.round(q.bottom) + ' (visible band ' + Math.round(high) + '..' + Math.round(low) + ')' }; });
      if (!r) continue; n++; if (!r.ok) bad.push(url + ': ' + r.what); if (r.last) break; }
    await pg.close(); }
  console.log(n + ' focus stops checked, ' + bad.length + ' hidden'); bad.forEach(x => console.log('  ' + x)); await b.close(); process.exit(bad.length ? 1 : 0);
})();
