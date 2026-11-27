// node tools/motion-trace.js : Chromium trace of the same 2 second scripted drag as motion-run.js perf, with and without the layer promotion.
// Sums the time spent in style, layout, paint and raster during the drag. Headless Chromium rasters in software, so raster times are pessimistic
// compared with a phone GPU; the comparison between the two variants is the useful part.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(), rows = [];
  for (const variant of ['layers', 'no-layers']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
    await pg.goto('http://localhost:8851/home.html?state=fresh&lang=ko', { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(900);
    if (variant === 'no-layers') await pg.addStyleTag({ content: '.qimg .ht, .qtint, .qstamp, .deck-lift { will-change: auto !important; }' });
    await pg.waitForTimeout(400);
    await b.startTracing(pg, { categories: ['devtools.timeline', 'cc', 'disabled-by-default-devtools.timeline'] });
    await pg.evaluate(() => new Promise(res => {
      const c = document.querySelector('.qcard[data-pos="0"]'), ev = (t, x) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9, clientX: x, clientY: 330, pointerType: 'touch', isPrimary: true }));
      let t0 = 0; ev('pointerdown', 195);
      function f(now) { if (!t0) t0 = now; const k = (now - t0) / 2000; if (k >= 1) { ev('pointerup', 195); return res(); } ev('pointermove', 195 + Math.sin(k * Math.PI * 6) * 170); requestAnimationFrame(f); }
      requestAnimationFrame(f);
    }));
    const buf = await b.stopTracing(), ev = JSON.parse(buf.toString()).traceEvents || [];
    const sum = n => ev.filter(e => e.name === n && e.ph === 'X').reduce((a, e) => a + (e.dur || 0), 0) / 1000, cnt = n => ev.filter(e => e.name === n && e.ph === 'X').length;
    rows.push({ variant, styleMs: +sum('UpdateLayoutTree').toFixed(1), layoutMs: +sum('Layout').toFixed(1), layouts: cnt('Layout'), paintMs: +sum('Paint').toFixed(1), paints: cnt('Paint'), rasterMs: +sum('RasterTask').toFixed(1), rasterTasks: cnt('RasterTask') });
    await ctx.close();
  }
  console.table(rows); fs.writeFileSync(path.join(__dirname, '..', 'captures', 'video', 'perf-trace.json'), JSON.stringify(rows, null, 2));
  await b.close();
})();
