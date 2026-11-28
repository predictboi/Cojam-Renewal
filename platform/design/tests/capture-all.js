// Captures every screen at 390x844 and 360x780 in EN and KO, JA at 390x844, as v6-<screen>-<lang>-<width>.png.
// Serve first: python3 -m http.server 8823 -d platform/design (another port: PORT=8816). Run: node platform/design/tests/capture-all.js platform/design/captures
const {chromium}=require('playwright');const OUT=process.argv[2];const B='http://localhost:'+(process.env.PORT||8823)+'/';
const SCREENS=[['g1-gate','gate.html?state=android'],['a1-login','login.html'],['a1-login-typo','login.html?state=typo'],['a1-login-unsupported','login.html?state=unsupported'],['a1-login-code','login.html?state=code'],['a2-first-run','first-run.html'],
['h1-home-cards','home-cards.html'],['h1-home-cards-partial','home-cards.html?state=partial'],['h1-home-cards-offline','home-cards.html?state=offline'],['h2-home-terminal','home-terminal.html?state=fresh'],['h3-day-done-paid','done.html'],['h3-day-done-saving','done.html?state=saving'],['h3-day-done-moment','done.html?state=moment'],['r1-results','results.html'],
['k1-ranking-top','ranking.html'],['k1-ranking-lastweek','ranking.html?state=lastweek'],['k1-ranking-top10','ranking.html?state=top10'],['s1-staking-form','staking.html'],['s1-staking-error','staking.html?state=above'],['s1-staking-review-12000','staking.html?state=review'],['s1-staking-pending','staking.html?state=hidden'],['s2-my-stakes','stakes.html'],['s2-my-stakes-claimable','stakes.html?state=claimable'],
['w1-wallet-top','wallet.html'],['w2-convert','convert.html'],['w3-deposit','deposit.html'],['w4-withdraw','withdraw.html'],['w4-withdraw-filled','withdraw.html?state=filled'],['p1-profile','profile.html'],['sys-blocked','system.html?state=blocked'],['sys-maintenance','system.html?state=maintenance']];
(async()=>{const b=await chromium.launch();const errs=[];
 for(const [W,H,langs] of [[390,844,['en','ko','ja']],[360,780,['en','ko']]]){
  const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  for(const l of langs) for(const [n,u] of SCREENS){ if(u.includes('moment')) await pg.evaluate(()=>{try{sessionStorage.clear()}catch(e){}});   /* the reward moment plays once per session */
    await pg.goto(B+u+(u.includes('?')?'&':'?')+'lang='+l); await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(u.includes('moment')?2150:u.startsWith('done')||u.includes('review')?1500:u.startsWith('home-cards.html')&&!u.includes('?')?2600:800);
    await pg.screenshot({path:`${OUT}/v6-${n}-${l}-${W}.png`}); }
  await ctx.close(); }
 console.log('captured',errs.length?('pageerrors: '+errs.join(' | ')):'no page errors');await b.close();})();
