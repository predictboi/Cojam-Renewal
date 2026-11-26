// Captures every screen at 390x844 and 360x780 in EN and KO, JA at 390x844. Serve first (port 8816). Run: node platform/design/tests/capture-all.js platform/design/captures
const {chromium}=require('playwright');const OUT=process.argv[2];const B='http://localhost:8816/';
const SCREENS=[['g1-gate','gate.html?state=android'],['a1-login','login.html'],['a1-login-typo','login.html?state=typo'],['a1-login-code','login.html?state=code'],['a2-first-run','first-run.html'],
['h1-home-cards','home-cards.html'],['h1-home-cards-partial','home-cards.html?state=partial'],['h2-home-terminal','home-terminal.html?state=fresh'],['h3-day-done-paid','done.html'],['r1-results','results.html'],
['k1-ranking-top','ranking.html'],['k1-ranking-lastweek','ranking.html?state=lastweek'],['s1-staking-form','staking.html'],['s1-staking-review-12000','staking.html?state=review'],['s2-my-stakes','stakes.html'],
['w1-wallet-top','wallet.html'],['w2-convert','convert.html'],['w3-deposit','deposit.html'],['w4-withdraw','withdraw.html'],['p1-profile','profile.html'],['sys-blocked','system.html?state=blocked'],['sys-maintenance','system.html?state=maintenance']];
(async()=>{const b=await chromium.launch();const errs=[];
 for(const [W,H,langs] of [[390,844,['en','ko','ja']],[360,780,['en','ko']]]){
  const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  for(const l of langs) for(const [n,u] of SCREENS){ await pg.goto(B+u+(u.includes('?')?'&':'?')+'lang='+l); await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(u.startsWith('done')||u.includes('review')?1500:800);
    await pg.screenshot({path:`${OUT}/v2-${n}-${l}-${W}.png`}); }
  await ctx.close(); }
 console.log('captured',errs.length?('pageerrors: '+errs.join(' | ')):'no page errors');await b.close();})();
