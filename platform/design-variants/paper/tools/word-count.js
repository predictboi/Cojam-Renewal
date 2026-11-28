// node tools/word-count.js <out.json> : visible words per screen in EN, KO and JA (the content and any pinned bar; the masthead, the dateline and the tab bar are not counted).
// Words are counted with Intl.Segmenter (word granularity, word-like segments), which works for the three languages.
const { chromium } = require('playwright'); const fs = require('fs');
const SCREENS = ['wallet.html', 'staking.html', 'stakes.html', 'convert.html', 'deposit.html', 'withdraw.html', 'profile.html', 'invite.html', 'results.html', 'ranking.html', 'done.html', 'home.html?state=partial', 'home-list.html', 'first-run.html', 'first-run.html?state=2', 'first-run.html?state=3', 'login.html', 'gate.html?state=android', 'system.html?state=blocked', 'wallet.html?state=hold', 'staking.html?state=hold', 'stakes.html?state=hold', 'convert.html?state=hold', 'invite.html?state=hold'];
(async () => {
  const b = await chromium.launch(), out = {};
  for (const url of SCREENS) { out[url] = {};
    for (const lang of ['en', 'ko', 'ja']) {
      const pg = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const res = await pg.goto('http://localhost:8851/' + url + (url.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'load' }).catch(() => null);
      if (!res || !res.ok()) { out[url][lang] = null; await pg.close(); continue; }
      await pg.waitForTimeout(900);
      out[url][lang] = await pg.evaluate((lang) => {
        const seg = new Intl.Segmenter(lang, { granularity: 'word' }); let n = 0;
        const roots = [...document.querySelectorAll('#main, .app > .pin')];
        for (const root of roots) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node;
          while ((node = w.nextNode())) { const el = node.parentElement; if (!el || el.closest('.sr-only, .dateline, [hidden], [inert], details:not([open]) > :not(summary), script, style')) continue; const r = el.getBoundingClientRect(), s = getComputedStyle(el); if (r.width < 1 || r.height < 1 || s.visibility === 'hidden') continue;
            for (const x of seg.segment(node.textContent)) if (x.isWordLike) n++; } }
        return n; }, lang);
      await pg.close(); } }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1)); console.table(out); await b.close();
})();
