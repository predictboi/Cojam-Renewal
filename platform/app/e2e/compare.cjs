// Side by side captures of the app (mock build) and the design prototype, for visual comparison.
// node e2e/compare.cjs [lang] [width]   writes captures/compare/<lang>-<width>/<name>.png (app left, design right)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const lang = process.argv[2] || 'en', W = +(process.argv[3] || 390);
const APP = 'http://localhost:' + (process.env.APP_PORT || 4180), DES = 'http://localhost:' + (process.env.DESIGN_PORT || 8822);
const OUT = path.join(__dirname, '..', 'captures', 'compare', lang + '-' + W);
const PAIRS = [
  ['home', '/?state=fresh', 'home-cards.html?state=fresh'], ['home-partial', '/?state=partial', 'home-cards.html?state=partial'], ['home-hold', '/?state=hold', 'home-cards.html?state=hold'],
  ['list', '/list?state=fresh', 'home-terminal.html?state=fresh'], ['list-syncing', '/list?state=syncing', 'home-terminal.html?state=syncing'],
  ['done', '/done?state=results', 'done.html?state=results'], ['done-welcome', '/done?state=welcome', 'done.html?state=welcome'],
  ['results', '/results', 'results.html'], ['ranking', '/ranking', 'ranking.html'], ['ranking-top10', '/ranking?state=top10', 'ranking.html?state=top10'],
  ['staking', '/staking', 'staking.html'], ['staking-review', '/staking?state=review', 'staking.html?state=review'], ['stakes', '/stakes?state=claimable', 'stakes.html?state=claimable'],
  ['wallet', '/wallet', 'wallet.html'], ['convert', '/convert', 'convert.html'], ['deposit', '/deposit', 'deposit.html'], ['withdraw', '/withdraw?state=filled', 'withdraw.html?state=filled'],
  ['profile', '/profile', 'profile.html'], ['profile-code', '/profile?state=code-valid', 'profile.html?state=code-valid'], ['invite', '/invite', 'invite.html'],
  ['login', '/login?state=typo', 'login.html?state=typo'], ['login-setup', '/login?state=busy', 'login.html?state=busy'], ['first-run', '/welcome?state=code-valid', 'first-run.html?state=code-valid'],
  ['gate', '/gate?state=android', 'gate.html?state=android'], ['gate-invited', '/gate?state=invited', 'gate.html?state=invited'], ['system-blocked', '/system/blocked', 'system.html?state=blocked'],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('cjp.nudged', '1'); localStorage.setItem('cjp.nudged', '1'); } catch (e) {} });
  const a = await ctx.newPage(), d = await ctx.newPage();
  await a.goto(APP + '/?standalone=1&lang=' + lang); await a.waitForTimeout(600);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const [name, au, du] of PAIRS) {
    if (only && !only.includes(name)) continue;
    await a.goto(APP + au); await d.goto(DES + '/' + du + (du.includes('?') ? '&' : '?') + 'lang=' + lang);
    await a.waitForTimeout(1500); await d.waitForTimeout(1500);
    const fa = path.join(OUT, name + '-app.png'), fd = path.join(OUT, name + '-design.png');
    await a.screenshot({ path: fa, fullPage: !!process.env.FULL }); await d.screenshot({ path: fd, fullPage: !!process.env.FULL });
    execFileSync('python3', ['-c', `from PIL import Image\na=Image.open('${fa}');b=Image.open('${fd}')\nc=Image.new('RGB',(a.width+b.width+8,max(a.height,b.height)),'red');c.paste(a,(0,0));c.paste(b,(a.width+8,0));c.save('${path.join(OUT, name + '.png')}')`]);
    fs.unlinkSync(fa); fs.unlinkSync(fd);
  }
  await b.close();
  console.log('written to', OUT);
})();
