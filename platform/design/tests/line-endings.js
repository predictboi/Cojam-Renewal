// Line endings: no fine print, field caption or card footnote ends on a single word (EN, KO) or on one or two characters (JA).
// Serve first (see capture-all.js). Run: node platform/design/tests/line-endings.js [width] [height]   Exit code 1 when an orphan is found.
const {chromium}=require('playwright');const W=+process.argv[2]||360,H=+process.argv[3]||780;const B='http://localhost:'+(process.env.PORT||8823)+'/';
const PAGES=['gate.html?state=android','login.html','login.html?state=typo','login.html?state=unsupported','login.html?state=code','first-run.html','home-cards.html','home-cards.html?state=offline','home-terminal.html?state=fresh','done.html','results.html','ranking.html','ranking.html?state=lastweek','staking.html','staking.html?state=above','staking.html?state=review','stakes.html','stakes.html?state=claimable','wallet.html','convert.html','deposit.html','withdraw.html','profile.html','system.html?state=blocked','system.html?state=maintenance'];
const SEL='.tiny, .field-cap, .field-msg, .fine, .pin-note, .addr-note, .tie-line, .qcard-final, .lead, .plain-note p, .sheet-lead, .note-body > div, .small.muted, .sub, .rrow-line, .done-st, .auth-lede, .gate-lede, .empty p, .sheet-warn span, .stat > span, .rows dd small, .rowlink small, .sys p, .lib-cap';
(async()=>{const b=await chromium.launch();let bad=0,checked=0;
 for(const lang of ['en','ko','ja']){const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,isMobile:true,hasTouch:true});const pg=await ctx.newPage();
  for(const u of PAGES){ await pg.goto(B+u+(u.includes('?')?'&':'?')+'lang='+lang); await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(u.includes('review')?1200:600);
   const r=await pg.evaluate(([SEL,lang])=>{const out=[];let n=0;
    for(const el of document.querySelectorAll(SEL)){ const cr=el.getBoundingClientRect(); if(cr.width<2||cr.height<2||getComputedStyle(el).visibility==='hidden'||el.closest('[hidden], .qcard:not([data-pos="0"])')) continue;
      const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const units=[];let node;
      while((node=tw.nextNode())){ const txt=node.textContent; const re=lang==='ja'?/[^\s]/g:/\S+/g; let m; while((m=re.exec(txt))){ const rg=document.createRange(); rg.setStart(node,m.index); rg.setEnd(node,m.index+m[0].length); const rc=rg.getClientRects()[0]; if(rc&&rc.width>0) units.push({t:m[0],top:Math.round(rc.top),bottom:Math.round(rc.bottom)}); } }
      if(units.length<3) continue; n++;
      const lines=[];for(const u of units){ const L=lines[lines.length-1]; if(L&&Math.abs(L.top-u.top)<6) L.w.push(u.t); else lines.push({top:u.top,w:[u.t]}); }
      if(lines.length<2) continue; const last=lines[lines.length-1].w;
      if(lang==='ja'?last.join('').replace(/[。、．，.!?）)」]/g,'').length<=2:last.length===1) out.push((el.className||el.tagName)+': "…'+lines[lines.length-2].w.slice(-3).join(lang==='ja'?'':' ')+' / '+last.join(lang==='ja'?'':' ')+'"'); }
    return {out,n};},[SEL,lang]);
   checked+=r.n; for(const o of r.out){bad++;console.log('ORPHAN',lang,W,u,o);} }
  await ctx.close(); }
 console.log(`line endings at ${W}: ${checked} multi word blocks checked in EN, KO, JA, ${bad} orphans`);await b.close();process.exit(bad?1:0);})();
