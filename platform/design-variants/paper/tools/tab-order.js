// node tools/tab-order.js : the first stops of the Tab order on every tab root. The skip link comes first, then the masthead, then the page, then the tab bar.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const url of ['home.html?state=fresh', 'home-list.html', 'results.html', 'ranking.html', 'staking.html', 'wallet.html']) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
    await pg.goto('http://localhost:8851/' + url); await pg.waitForTimeout(900);
    const stops = [];
    for (let i = 0; i < 4; i++) { await pg.keyboard.press('Tab'); stops.push(await pg.evaluate(() => { const a = document.activeElement; return a.closest('.skip') ? 'skip' : a.closest('.mast') ? 'masthead' : a.closest('.tb') ? 'tab bar' : a.closest('main') ? 'page' : a.tagName; })); }
    const ok = stops[0] === 'skip' && stops[1] === 'masthead'; if (!ok) bad++;
    console.log(url, stops.join(', '), ok ? '' : 'WRONG ORDER'); await pg.close();
  }
  console.log(bad + ' wrong'); await b.close(); process.exit(bad ? 1 : 0);
})();
