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
  // round 3 (reviews C and D): rules that must hold on short and narrow phones
  async function open(url, w, h, lang) { const pg = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true }); await pg.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
    await pg.goto('http://localhost:8851/' + url + (url.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(1300); return pg; }
  for (const lang of ['en', 'ko', 'ja']) {
    // the "+50P if right. Undo for 3 seconds." line shows at every size; the picture is at least 96 px tall or absent; nothing of the next card shows inside the front card's box
    for (const [w, h] of [[320, 568], [360, 640], [375, 667], [390, 844]]) { const pg = await open('home.html?state=fresh', w, h, lang);
      const r = await pg.evaluate(() => { const c = document.querySelector('.qcard[data-pos="0"]'), f = c.querySelector('.qcard-final'), im = c.querySelector('.qimg'), fr = f.getBoundingClientRect(), ir = im.getBoundingClientRect(), h2 = c.querySelector('h2').getBoundingClientRect(), top = c.querySelector('.qcard-top').getBoundingClientRect();
        const under = [...document.querySelectorAll('.qcard:not([data-pos="0"]) .choice')].some(x => getComputedStyle(x).visibility !== 'hidden');
        return { final: fr.height > 8 && getComputedStyle(f).display !== 'none', img: Math.round(ir.height), gap: Math.round(h2.top - (ir.height ? ir.bottom : top.bottom)), under }; });
      n++; if (!r.final || (r.img > 0 && r.img < 96) || r.gap > 24 || r.under) bad.push('card rule ' + w + 'x' + h + ' ' + lang + ' ' + JSON.stringify(r)); await pg.close(); }
    // first run: "Next" is on screen on the three pages; the picture band keeps one top and one height
    for (const [w, h] of [[360, 640], [320, 568], [390, 844]]) { const bands = []; for (const st of ['1', '2', '3']) { const pg = await open('first-run.html?state=' + st, w, h, lang);
        const r = await pg.evaluate(() => { const nx = document.querySelector('#next').getBoundingClientRect(), bd = [...document.querySelectorAll('.onb:not([hidden]) .onb-art')][0].getBoundingClientRect(); return { next: nx.bottom <= innerHeight && nx.top >= 0, top: Math.round(bd.top), h: Math.round(bd.height) }; });
        bands.push(r.top + '/' + r.h); n++; if (!r.next) bad.push('first run Next off screen ' + w + 'x' + h + ' page ' + st + ' ' + lang); await pg.close(); }
      n++; if (new Set(bands).size !== 1) bad.push('first run band moves ' + w + 'x' + h + ' ' + lang + ' ' + bands.join(' ')); }
    // ranking: complete rows between the column heads and the own bar
    for (const [w, h, min] of [[360, 640, 3], [320, 568, 2]]) { const pg = await open('ranking.html', w, h, lang);
      const rows = await pg.evaluate(() => { const pin = document.querySelector('.app > .pin').getBoundingClientRect(); return [...document.querySelectorAll('#top10 .krow')].filter(r => { const q = r.getBoundingClientRect(); return q.top >= 0 && q.bottom <= pin.top + 0.5; }).length; });
      n++; if (rows < min) bad.push('ranking shows ' + rows + ' complete rows at ' + w + 'x' + h + ' ' + lang); await pg.close(); }
    // staking: the lock options and the interest figure are visible together with the pinned action
    for (const [w, h] of [[360, 640], [320, 568]]) { const pg = await open('staking.html', w, h, lang);
      const r = await pg.evaluate(() => { const pin = document.querySelector('.app > .pin').getBoundingClientRect(), per = document.querySelector('#period').getBoundingClientRect(), pf = document.querySelector('#pin-fig'), sv = document.querySelector('#sum-v').getBoundingClientRect();
        return { period: per.bottom <= pin.top + 0.5 && per.top >= 0, interest: (pf && getComputedStyle(pf).display !== 'none' && pf.textContent.length > 3) || (sv.bottom <= pin.top && sv.top >= 0) }; });
      n++; if (!r.period || !r.interest) bad.push('staking ' + w + 'x' + h + ' ' + lang + ' ' + JSON.stringify(r)); await pg.close(); }
    // cover screens: the nameplate keeps its words, the install action is in the first screen, the iOS slip covers nothing it explains
    for (const w of [320, 360, 390]) for (const url of ['login.html', 'gate.html?state=android', 'gate.html?state=ios', 'system.html?state=blocked']) { const pg = await open(url, w, w === 390 ? 844 : 640, lang);
      const r = await pg.evaluate(() => { const sp = document.querySelector('.gate-bar .plate > span'), q = sp.getBoundingClientRect(), nxt = sp.closest('.gate-bar').querySelector('.select, .tag'); const gone = !sp.getClientRects().length; const o = { plate: gone ? !sp.closest('.plate--big') : sp.scrollWidth <= sp.clientWidth + 1 && (!nxt || q.right <= nxt.getBoundingClientRect().left + 1) };   // on the cover (big nameplate) the words must stay; elsewhere they may leave whole, never cut
        const ins = document.querySelector('#install'); if (ins) { const i = ins.getBoundingClientRect(); o.install = i.bottom <= innerHeight; }
        const slip = document.querySelector('.ios-point'); if (slip && !slip.classList.contains('is-away')) { const sr = slip.getBoundingClientRect(); o.slip = ![...document.querySelectorAll('#panel .steps li, #panel .btn, .gate h1, .qcard .choice')].some(e => { const x = e.getBoundingClientRect(); return x.bottom > sr.top && x.top < sr.bottom && x.right > sr.left && x.left < sr.right; }); }
        return o; });
      n++; if (!r.plate || r.install === false && w === 390 || r.slip === false) bad.push('cover ' + url + ' ' + w + ' ' + lang + ' ' + JSON.stringify(r)); await pg.close(); }
    // a figure and its unit stay on one line; no text under 12 px
    for (const w of [320, 360, 390]) for (const url of ['first-run.html?state=2', 'results.html', 'wallet.html', 'stakes.html', 'staking.html', 'convert.html', 'ranking.html', 'profile.html', 'invite.html', 'done.html', 'home.html?state=partial', 'home-list.html', 'deposit.html', 'withdraw.html?state=filled']) { const pg = await open(url, w, 700, lang);
      const r = await pg.evaluate(() => { const out = [];
        for (const el of document.querySelectorAll('.fig, .tri-fig, .stat b, .rs-count, .rs-pts, .done-fig, .pin-pts, .krow-prize, .wrow b, .inv-ex b, .facts3 dd, .pts-in, .period b, .sheet-done-fig, .art-coin')) { if (el.closest('[hidden], [inert]') || !el.getClientRects().length) continue; const rg = document.createRange(); rg.selectNodeContents(el); const tops = new Set([...rg.getClientRects()].filter(q => q.width > 1).map(q => Math.round(q.bottom / 6))); if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.push('clipped ' + el.className); else if (getComputedStyle(el).whiteSpace !== 'nowrap') out.push('may wrap ' + el.className); }
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let nd, small = new Set();
        while ((nd = w.nextNode())) { const el = nd.parentElement; if (!nd.textContent.trim() || !el || el.closest('.sr-only, [hidden], script, style, .skip, option, select') || !el.getClientRects().length) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11.95) small.add((el.className || el.tagName) + ' ' + fs.toFixed(1)); }
        return out.concat([...small].map(x => 'under 12 px: ' + x)); });
      n++; if (r.length) bad.push('type ' + url + ' ' + w + ' ' + lang + ': ' + [...new Set(r)].slice(0, 4).join('; ')); await pg.close(); }
  }
  console.log(n + ' checks, ' + bad.length + ' failed'); bad.slice(0, 60).forEach(x => console.log('  ' + x));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
