const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 } }); pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto('http://localhost:8857/home.html?state=partial');
  const st = () => pg.evaluate(() => [...document.querySelectorAll('.fx')].map(c => c.dataset.q + ':' + c.dataset.pos).join(' '));
  console.log(await st());
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(600); console.log(await st());
  await pg.waitForTimeout(3300); console.log(await st());
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(600); console.log(await st());
  await b.close();
})();
