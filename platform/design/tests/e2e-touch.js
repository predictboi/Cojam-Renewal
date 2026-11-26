// Touch walk through of the primary task with assertions (login, five cards, undo, day done, ranking, a 500 CT stake, copy the wallet address).
// Serve first: python3 -m http.server 8820 -d platform/design (another port: PORT=8816).
// Run: node platform/design/tests/e2e-touch.js <en|ko|ja> <width> <height> [captureDir]   Captures are named v4-<screen>-<lang>-<width>.png
const {chromium}=require('playwright');
const [lang,W,H,OUT]=[process.argv[2]||'en',+process.argv[3]||390,+process.argv[4]||844,process.argv[5]];
const B='http://localhost:'+(process.env.PORT||8820)+'/';
const res=[];const ok=(name,cond,extra)=>{res.push([cond?'PASS':'FAIL',name,extra===undefined?'':String(extra)]);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const cdp=await ctx.newCDPSession(pg);
  const shot=async n=>{ if(OUT) await pg.screenshot({path:`${OUT}/v4-${n}-${lang}-${W}.png`}); };
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  const stamps=()=>pg.evaluate(()=>{const c=document.querySelector('.qcard[data-pos="0"]');if(!c)return null;const s=d=>+getComputedStyle(c.querySelector('.qstamp--'+d)).opacity;return {l:s('l'),r:s('r'),hot:c.querySelectorAll('.choice.is-hot').length};});
  async function drag(x0,y0,dx,{steps=12,stepMs=16,hold=0,release=true,shotName}={}){
    await touch('touchStart',x0,y0);
    for(let i=1;i<=steps;i++){ await touch('touchMove',x0+dx*i/steps,y0); await sleep(stepMs); }
    if(hold) await sleep(hold);
    if(shotName) await shot(shotName);
    const st=await stamps();
    if(release){ await touch('touchEnd'); }
    return st;
  }
  const front=()=>pg.evaluate(()=>{const c=document.querySelector('.qcard[data-pos="0"]');return c?+c.dataset.q:0;});
  const cnt=()=>pg.evaluate(()=>+document.querySelector('#cnt').textContent);
  const cardBox=()=>pg.evaluate(()=>{const r=document.querySelector('.qcard[data-pos="0"]').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  const css=(sel,prop)=>pg.evaluate(([s,p])=>{const e=document.querySelector(s);return e?getComputedStyle(e)[p]:null;},[sel,prop]);
  const PROVIDERS=['Gmail','Naver','Kakao','Daum','Hanmail','iCloud','Outlook','Hotmail','Yahoo! JAPAN'];

  // ---------- 1. login
  await pg.goto(B+'login.html?state=unsupported'+(lang==='en'?'':'&lang='+lang)); await pg.waitForTimeout(600);
  const noteTxt=await pg.locator('#prov-note').innerText();
  await pg.goto(B+'login.html'+(lang==='en'?'':'?lang='+lang)); await pg.waitForTimeout(900);
  if(lang==='en') ok('language: English by default with a Korean device', await pg.evaluate(()=>document.documentElement.lang)==='en');
  ok('login: email field focused on load', await pg.evaluate(()=>document.activeElement&&document.activeElement.id==='email'));
  ok('login: providers shown before submit', await pg.locator('#email-cap').isVisible());
  const capTxt=await pg.locator('#email-cap').innerText();
  ok('login: the caption and the unsupported note list the same providers', PROVIDERS.every(p=>capTxt.includes(p)&&noteTxt.includes(p)), capTxt);
  ok('login: terms and privacy are links', await pg.locator('.fine a[href]').count()===2);
  ok('login: language control present', await pg.locator('select[data-lang]').count()===1);
  if(lang!=='en'){ const h=await pg.evaluate(()=>{const s=getComputedStyle(document.querySelector('.auth h1'));return {w:s.fontWeight,fs:parseFloat(s.fontSize),ls:parseFloat(s.letterSpacing)};});
    ok('type: login headline is weight 900, 34px, tighter tracking in '+lang, h.w==='900'&&h.fs===34&&h.ls<-1, JSON.stringify(h)); }
  await pg.keyboard.type('minji@gmial.com'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  ok('login: typo suggestion offered (gmail.com)', (await pg.locator('#typo').innerText().catch(()=>'')).includes('gmail.com'));
  ok('login: typo is not treated as unsupported', await pg.locator('#prov-note').count()===0);
  await shot('a1-login-typo-suggestion');
  await pg.locator('[data-fix-email]').tap(); await pg.waitForTimeout(200);
  ok('login: one tap fix sets gmail.com', await pg.inputValue('#email')==='minji@gmail.com');
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(1300);
  ok('login: code step headline swapped', await pg.locator('#code').count()===1 && !(await pg.locator('#lede').isVisible()));
  const facts=await pg.evaluate(()=>{const f=document.querySelector('#facts'),p=document.querySelector('#panel').getBoundingClientRect();const r=f.getBoundingClientRect();return {vis:!f.hidden&&r.height>0,n:f.children.length,below:r.top>=p.bottom,inView:r.bottom<=innerHeight};});
  ok('login: the code step shows the three benefit lines under the panel', facts.vis&&facts.n===3&&facts.below&&facts.inView, JSON.stringify(facts));
  const s1=+(await pg.locator('#resend-s').innerText()); await shot('a1-login-code'); await sleep(2200); const s2=+(await pg.locator('#resend-s').innerText());
  ok('login: the resend countdown ticks every second', s1-s2>=2&&s1-s2<=3, s1+' -> '+s2);
  await pg.keyboard.type('418'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  const cm=await pg.locator('#code-msg').innerText();
  ok('login: incomplete code reads as incomplete', /6/.test(cm) && !(await pg.locator('.field-box--code.is-error').count()), cm);
  const s3=+(await pg.locator('#resend-s').innerText());
  ok('login: the countdown keeps its place when the panel repaints', s3<=s2&&s3>0, s2+' -> '+s3);
  await shot('a1-login-code-incomplete');
  await pg.keyboard.type('250'); await pg.waitForURL(/first-run/,{timeout:9000}).catch(()=>{});
  ok('login: reaches first run', /first-run/.test(pg.url()));
  await pg.waitForTimeout(500); await shot('a2-first-run');
  ok('language: the choice is remembered on the next screens', await pg.evaluate(()=>document.documentElement.lang)===lang);

  // ---------- 2. five cards
  await pg.goto(B+'home-cards.html'); await pg.waitForTimeout(1100);
  ok('H1: first card ever: the nudge plays', await pg.evaluate(()=>document.querySelector('#deck').getAttribute('data-nudge')==='1' && document.querySelector('.qcard[data-pos="0"]').getAnimations().length>0));
  await pg.waitForTimeout(1500);
  ok('H1: the nudge ends on its own and is remembered', await pg.evaluate(()=>!document.querySelector('#deck').hasAttribute('data-nudge') && localStorage.getItem('cjp.nudged')==='1' && document.querySelector('.qcard[data-pos="0"]').getAnimations().length===0));
  ok('H1: header title on one line', await pg.evaluate(()=>{const h=document.querySelector('.ph h1');return h.getBoundingClientRect().height<parseFloat(getComputedStyle(h).fontSize)*1.6;}));
  if(lang!=='en'){ const h=await pg.evaluate(()=>{const s=getComputedStyle(document.querySelector('.ph h1'));return {w:s.fontWeight,fs:parseFloat(s.fontSize),ls:parseFloat(s.letterSpacing)};});
    ok('type: page title is weight 900, 2px larger, tighter tracking in '+lang, h.w==='900'&&h.fs===(W>=380?26:24)&&h.ls<-0.7, JSON.stringify(h)); }
  const tabs=await pg.evaluate(()=>[...document.querySelectorAll('.tb a')].map(a=>{const s=a.lastElementChild;return {fs:parseFloat(getComputedStyle(a).fontSize),fits:s.scrollWidth<=a.clientWidth-4};}));
  ok('tab bar: labels are 12px and fit their column', tabs.every(t=>t.fs===12&&t.fits), JSON.stringify(tabs));
  ok('H1: language still '+lang, await pg.evaluate(()=>document.documentElement.lang)===lang);
  const fit=await pg.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:innerHeight,final:(()=>{const e=document.querySelector('.qcard[data-pos="0"] .qcard-final');const r=e.getBoundingClientRect();return r.bottom;})(),finalTxt:document.querySelector('.qcard[data-pos="0"] .qcard-final').textContent,tab:document.querySelector('.tb').getBoundingClientRect().top,h2lines:(()=>{const h=document.querySelector('.qcard[data-pos="0"] h2');return Math.round(h.getBoundingClientRect().height/parseFloat(getComputedStyle(h).lineHeight));})()}));
  ok('H1: no page scroll', fit.sh<=fit.ih, fit.sh+' / '+fit.ih);
  ok('H1: "final" line inside the card and above the tab bar, and it names the +50P', fit.final<fit.tab && /\+50P/.test(fit.finalTxt), Math.round(fit.final)+' < '+fit.tab+' | '+fit.finalTxt);
  ok('H1: question at most 3 lines', fit.h2lines<=3, fit.h2lines);
  ok('H1: deck focused on load', await pg.evaluate(()=>document.activeElement&&document.activeElement.id==='deck'));
  const pair=await pg.evaluate(()=>['l','r'].map(d=>{const e=document.querySelector('.qcard[data-pos="0"] .choice[data-dir="'+d+'"]'),s=getComputedStyle(e),r=e.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),s.borderTopWidth,s.borderTopColor,s.boxShadow,s.fontSize,s.fontWeight,s.color].join('|');}));
  ok('H1: the two answers have the same size, border, shadow and type', pair[0]===pair[1], pair[0]);
  const bar0=await pg.evaluate(()=>{const b=document.querySelector('#pickbar');return {txt:b.innerText.trim(),h:b.getBoundingClientRect().height,bottom:b.getBoundingClientRect().bottom,tab:document.querySelector('.tb').getBoundingClientRect().top};});
  ok('H1: the bar under the deck is used at rest (how to pick)', bar0.txt.length>8 && bar0.bottom<=bar0.tab, bar0.txt);
  const scrim=await pg.evaluate(()=>{const c=document.querySelector('.qcard[data-pos="0"]'),body=c.querySelector('.qcard-body'),h2=c.querySelector('h2');const off=h2.getBoundingClientRect().top-body.getBoundingClientRect().top;return {off,bg:getComputedStyle(body).backgroundImage};});
  ok('H1: the question starts below the fade of the picture (solid ink behind the words)', scrim.off>=54 && /0\.98\d*\) 54px\)$/.test(scrim.bg), scrim.off);
  await shot('h1-home-at-rest');
  // "AI settles it" opens the explanation and does not pick
  await pg.locator('.qcard[data-pos="0"] [data-ai-info]').tap(); await pg.waitForTimeout(500);
  const ai=await pg.evaluate(()=>({open:!!document.querySelector('#sheet-root.is-open'),steps:document.querySelectorAll('#sheet .txsteps li').length,rows:document.querySelectorAll('#sheet .rows > div').length,target:document.querySelector('.qcard[data-pos="0"] [data-ai-info]').getBoundingClientRect().height}));
  ok('H1: a tap on "AI settles it" opens the sheet (3 steps, source and time), target 44px', ai.open&&ai.steps===3&&ai.rows===2&&ai.target>=44, JSON.stringify(ai));
  await shot('h1-ai-sheet');
  await pg.locator('#sheet [data-sheet-close]').tap(); await pg.waitForTimeout(450);
  ok('H1: the sheet closes and nothing was picked', !(await pg.locator('#sheet-root.is-open').count()) && await cnt()===0 && await front()===1);
  let c=await cardBox(); const cx=c.x+c.w/2, cy=c.y+c.h*0.4;
  // below threshold: 30% of the card width
  let st=await drag(cx,cy,c.w*0.30,{hold:250,shotName:'h1-drag-below-threshold',release:true});
  ok('drag 30%: stamp capped at 0.4', st.r<=0.41 && st.r>0.2, st.r);
  ok('drag 30%: no button lit', st.hot===0);
  await sleep(500);
  ok('drag 30%: release returns the card', await cnt()===0 && await front()===1);
  // armed to the left: 42%, held, then carried back to the centre and released: nothing is picked
  await touch('touchStart',cx,cy); for(let i=1;i<=12;i++){ await touch('touchMove',cx-c.w*0.42*i/12,cy); await sleep(16); } await sleep(250);
  await shot('h1-drag-armed-left'); st=await stamps();
  ok('drag 42% left: left stamp solid and one button lit', st.l===1 && st.r===0 && st.hot===1, JSON.stringify(st));
  for(let i=11;i>=0;i--){ await touch('touchMove',cx-c.w*0.42*i/12,cy); await sleep(16); } await touch('touchEnd'); await sleep(500);
  ok('drag back to the centre: nothing picked', await cnt()===0 && await front()===1);
  // armed to the right: 42%
  st=await drag(cx,cy,c.w*0.42,{hold:250,shotName:'h1-drag-armed-right',release:false});
  ok('drag 42%: stamp solid and button lit', st.r===1 && st.hot===1, JSON.stringify(st));
  await touch('touchEnd'); await sleep(450);
  ok('drag 42%: release commits question 1', await cnt()===1 && await front()===2);
  ok('undo: button shown, at least 44px tall', await pg.evaluate(()=>{const u=document.querySelector('#undo');return !!u&&u.getBoundingClientRect().height>=44;}));
  ok('undo: the key hint is hidden on a touch device', await pg.evaluate(()=>getComputedStyle(document.querySelector('#undo kbd')).display==='none'));
  ok('undo: next card is already in front (no waiting)', await front()===2);
  await shot('h1-after-throw-undo');
  await pg.locator('#undo').tap(); await sleep(200); await shot('h1-undo-flying-back'); await sleep(500);
  ok('undo: card 1 back in front, counter 0, segment empty', await front()===1 && await cnt()===0 && await pg.evaluate(()=>document.querySelector('#day5').children[0].className===''));
  // double tap guard: two taps 120 ms apart answer one question
  const yes=await pg.evaluate(()=>{const r=document.querySelector('.qcard[data-pos="0"] .choice[data-dir="r"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await pg.touchscreen.tap(yes.x,yes.y); await sleep(120); await pg.touchscreen.tap(yes.x,yes.y); await sleep(100);
  ok('guard: two taps 120 ms apart answer one question', await cnt()===1, await cnt());
  // five rapid taps do not finish the day
  for(let i=0;i<4;i++){ await pg.touchscreen.tap(yes.x,yes.y); await sleep(60); }
  ok('guard: rapid taps cannot run through the set', await cnt()<=2, await cnt());
  // bring the deck back to: q1 picked only
  while(await cnt()>1){ await pg.locator('#undo').tap(); await sleep(450); }
  ok('undo acts on the most recent pick only', await cnt()===1 && await front()===2);
  // fling on question 2: 60px in about 60 ms
  await sleep(450); c=await cardBox();
  await drag(cx,cy,-90,{steps:3,stepMs:6}); await sleep(450);
  ok('fling commits question 2', await cnt()===2 && await front()===3, await cnt());
  // two picks pending: undo brings back only the last one
  const held=await pg.evaluate(()=>document.querySelectorAll('#day5 .is-pend').length);
  await pg.locator('#undo').tap(); await sleep(500);
  ok('two pending, undo returns only question 2', await front()===2 && await cnt()===1, 'pending before: '+held);
  // pick 2 again by fling to the left, then wait for saving and saved
  await drag(cx,cy,-90,{steps:3,stepMs:6}); await sleep(3300);
  const bar1=await pg.locator('#pickbar').innerText();
  await sleep(1700);
  const bar2=await pg.locator('#pickbar').innerText();
  ok('after 3 s the bar reads saving, then saved', bar1.length>0 && bar2.length>0 && bar1!==bar2, bar1.replace(/\s+/g,' ')+' -> '+bar2.replace(/\s+/g,' '));
  ok('no Undo after the window', await pg.locator('#undo').count()===0);
  await sleep(2000);
  const bar3=(await pg.locator('#pickbar').innerText()).trim();
  ok('after "saved" fades the bar says how many are left', /3/.test(bar3) && bar3!==bar2.trim(), bar3);
  // leaving and coming back in the middle of the set keeps the progress
  await pg.goto(B+'ranking.html'); await pg.waitForTimeout(400); await pg.goto(B+'home-cards.html'); await pg.waitForTimeout(1200);
  ok('home: coming back mid set keeps the progress (2 of 5, card 3 in front)', await cnt()===2 && await front()===3 && await pg.evaluate(()=>document.querySelectorAll('#day5 .is-done').length===2), await cnt()+' / front '+await front());
  ok('home: the nudge does not play a second time', await pg.evaluate(()=>!document.querySelector('#deck').hasAttribute('data-nudge') && document.querySelector('.qcard[data-pos="0"]').getAnimations().length===0));
  // keyboard: arrow works without tabbing; key repeat ignored
  await pg.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',repeat:true,bubbles:true}))); await sleep(100);
  ok('keyboard: repeated key event ignored', await cnt()===2);
  await pg.keyboard.press('ArrowRight'); await sleep(100); await pg.keyboard.press('ArrowRight'); await sleep(500);
  ok('keyboard: arrow picks without tabbing, second press 100 ms later ignored', await cnt()===3 && await front()===4, await cnt());
  // keyboard undo: Z, then Backspace, while the window is open
  await pg.keyboard.press('z'); await sleep(600);
  ok('keyboard: Z undoes the pick while the window is open', await cnt()===2 && await front()===3, await cnt());
  await pg.keyboard.press('ArrowRight'); await sleep(500); await pg.keyboard.press('Backspace'); await sleep(600);
  ok('keyboard: Backspace undoes too', await cnt()===2 && await front()===3, await cnt());
  await pg.keyboard.press('ArrowRight'); await sleep(3400); await pg.keyboard.press('z'); await sleep(400);
  ok('keyboard: Z does nothing once the window has closed', await cnt()===3 && await front()===4, await cnt());
  // question 4 by button, question 5 by drag; then undo the fifth and pick it again
  await sleep(300); await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap(); await sleep(500);
  ok('button picks question 4', await cnt()===4 && await front()===5);
  c=await cardBox(); await drag(cx,cy,c.w*0.45,{}); await sleep(600);
  ok('fifth pick: stays on the deck screen while Undo is open', /home-cards/.test(pg.url()) && await pg.locator('#undo').count()===1);
  await shot('h1-fifth-pick-undo');
  await pg.locator('#undo').tap(); await sleep(600);
  ok('fifth pick undone: card 5 back', await front()===5 && await cnt()===4);
  const t0=Date.now(); await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap();
  await pg.waitForURL(/done\.html/,{timeout:9000}).catch(()=>{}); const waited=Date.now()-t0;
  ok('day done shows only after the 3 s window', /done\.html/.test(pg.url()) && waited>=3000, waited+' ms');

  // ---------- 3. day done
  await pg.waitForTimeout(400); const p0=await pg.locator('#pts-val').innerText();
  await pg.waitForTimeout(2600); const p1=await pg.locator('#pts-val').innerText();
  ok('done: header pill counts 1,250P to 1,350P', p1==='1,350P', p0+' -> '+p1);
  ok('done: no duplicate +100P toast', await pg.locator('.toast').count()===0);
  await pg.waitForTimeout(1200);
  const dn=await pg.evaluate(()=>{const g=s=>getComputedStyle(document.querySelector(s));const lime='rgb(214, 255, 61)';
    const limeEls=[...document.querySelectorAll('.app *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>1&&r.height>1&&getComputedStyle(e).backgroundColor===lime&&!e.closest('.tb');}).map(e=>e.tagName==='I'?'day5':(e.className||e.tagName).toString().split(' ')[0]);
    const row=document.querySelector('.clock-row').getBoundingClientRect(),lab=document.querySelector('.clock-row .card-h').getBoundingClientRect(),tm=document.querySelector('#clock').getBoundingClientRect();
    return {badge:g('.done-badge').backgroundColor,tick:g('.done-badge').color,chip:g('.reward').backgroundColor,chipTxt:g('.reward').color,lime:[...new Set(limeEls)].join(','),rowH:row.height,sameRow:Math.abs((lab.top+lab.height/2)-(tm.top+tm.height/2))<6&&lab.right<tm.left,listTop:document.querySelector('.list').getBoundingClientRect().top,
      picks:[...document.querySelectorAll('.pick-c')].map(e=>e.firstChild.textContent),expect:['r','l','r','r','r'].map((d,i)=>App.q(MOCK.set[i])[d])};});
  ok('done: after the animation the badge is white with an ink tick', dn.badge==='rgb(255, 255, 255)'&&dn.tick==='rgb(11, 21, 48)', dn.badge);
  ok('done: the "+100P paid" chip is white on ink', dn.chip==='rgb(11, 21, 48)'&&dn.chipTxt==='rgb(253, 253, 255)', dn.chip+' / '+dn.chipTxt);
  ok('done: at rest only the progress band and the primary button are lime', dn.lime==='day5,btn', dn.lime);
  ok('done: the countdown is one compact row (label left, time right)', dn.rowH<=64&&dn.sameRow, 'height '+dn.rowH+', list starts at '+Math.round(dn.listTop));
  ok('done: the list shows the picks made in this session', dn.picks.join('|')===dn.expect.join('|'), dn.picks.join(' | '));
  await shot('h3-day-done');
  await pg.goto(B+'home-cards.html'); await pg.waitForTimeout(900);
  ok('home after the day is done: the day done screen, settled, 1,350P kept', /done\.html$/.test(pg.url()) && await pg.locator('#pts-val').innerText()==='1,350P' && await css('.done-badge','backgroundColor')==='rgb(255, 255, 255)', pg.url());
  await pg.locator('a.btn-primary').tap(); await pg.waitForURL(/ranking/); await pg.waitForTimeout(900);

  // ---------- 4. ranking
  const rk=await pg.evaluate(()=>{const pin=document.querySelector('#pin').getBoundingClientRect().top;const rows=[...document.querySelectorAll('#top10 .krow')].filter(r=>r.getBoundingClientRect().bottom<=pin).length;const ranks=[...document.querySelectorAll('#top10 .krow-rank [aria-hidden]')].map(e=>e.textContent);
    const m=[...document.querySelectorAll('#top10 .krow.is-top .krow-rank')].map(e=>{const s=getComputedStyle(e);return s.backgroundColor+'/'+s.color+'/'+getComputedStyle(e,'::after').content;});
    const ar=[...document.querySelectorAll('#around .krow')].map(r=>({rank:r.querySelector('.krow-rank [aria-hidden]').textContent,me:r.classList.contains('is-me'),gap:(r.querySelector('.krow-gap [aria-hidden]')||{}).textContent||''}));
    const order=document.querySelector('#top10').compareDocumentPosition(document.querySelector('#around'))&4;
    return {rows,ranks,m,ar,order,tied:/Tied|동점|同点/.test(document.querySelector('#top10').innerText),pin:document.querySelector('#pin').innerText,pill:document.querySelector('#pts-val').textContent};});
  ok('ranking: at least 3 full rows on the first screen', rk.rows>=3, rk.rows);
  ok('ranking: ranks are distinct 1 to 10', rk.ranks.join()==='1,2,3,4,5,6,7,8,9,10');
  ok('ranking: the top three medals are filled ink with white numerals, no lime dot', rk.m.length===3&&rk.m.every(x=>x==='rgb(11, 21, 48)/rgb(253, 253, 255)/none'), rk.m[0]);
  ok('ranking: "Around you" sits under rank 10: the rank above, the player, the rank below, with point gaps', !!rk.order&&rk.ar.length===3&&rk.ar[1].me&&rk.ar.map(r=>r.rank).join()==='26,27,28'&&rk.ar[0].gap==='+50P'&&rk.ar[2].gap==='−50P', JSON.stringify(rk.ar));
  ok('ranking: no Tied tag', !rk.tied);
  ok('ranking: tie rule line on screen', await pg.locator('.tie-line').first().isVisible());
  ok('ranking: pinned figure labelled as this week', /950P/.test(rk.pin), rk.pin.replace(/\s+/g,' ')+' | pill '+rk.pill);
  await shot('k1-ranking');
  await pg.locator('#pin').tap(); await pg.waitForTimeout(900);
  const av=await pg.evaluate(()=>{const a=document.querySelector('#around').getBoundingClientRect(),pin=document.querySelector('#pin').getBoundingClientRect().top;return {top:a.top,bottom:a.bottom,pin,sheet:!!document.querySelector('#sheet-root.is-open')};});
  ok('ranking: the pinned bar brings the "Around you" block into view (no sheet)', !av.sheet&&av.top>=56&&av.bottom<=av.pin, JSON.stringify(av));
  await shot('k1-ranking-around');
  await pg.evaluate(()=>scrollTo(0,0)); await pg.locator('#how').tap(); await pg.waitForTimeout(500); await shot('k1-ranking-prize-sheet');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  ok('ranking: Escape closes the sheet', !(await pg.locator('#sheet-root.is-open').count()));

  // ---------- 5. staking 500 CT
  await pg.goto(B+'staking.html'); await pg.waitForTimeout(900);
  const sk=await pg.evaluate(()=>{const g=document.querySelector('#go').getBoundingClientRect(),pin=document.querySelector('.pin--act'),pr=pin.getBoundingClientRect(),tab=document.querySelector('.tb').getBoundingClientRect().top;
    const seg=document.querySelector('#sw').getBoundingClientRect(),card=document.querySelector('.pg > .card').getBoundingClientRect(),un=[...document.querySelectorAll('#sum .rows > div')].pop().getBoundingClientRect();
    return {bottom:g.bottom,tab,label:document.querySelector('#go').innerText,gap:Math.round(card.top-seg.bottom),pad:parseFloat(getComputedStyle(document.querySelector('.pg')).paddingBottom),pinH:pr.height,tabH:innerHeight-tab,fade:getComputedStyle(pin,'::before').height,border:getComputedStyle(pin).borderTopWidth,
      rows:document.querySelectorAll('#sum .rows > div').length,unlockBottom:un.bottom,pinTop:pr.top,cue:document.querySelector('#amt-msg').innerText.trim(),avail:document.querySelector('#avail').textContent};});
  ok('staking: primary action in view above the tab bar', sk.bottom<=sk.tab, Math.round(sk.bottom)+' <= '+sk.tab);
  ok('staking: 16px between the switch and the form card (as on ranking)', sk.gap===16, sk.gap);
  ok('staking: page bottom padding is the bar height plus its 16px fade', Math.abs(sk.pad-(sk.tabH+sk.pinH+16))<1.5 && sk.fade==='16px' && sk.border==='0px', sk.pad+' = '+sk.tabH+' + '+sk.pinH+' + 16');
  ok('staking: '+(W<380?'at this width the annual rate row is dropped (2 rows)':'summary has 3 rows')+' and "Unlocks on" is visible above the bar', sk.rows===(W<380?2:3)&&sk.unlockBottom<=sk.pinTop-16, sk.rows+' rows, '+Math.round(sk.unlockBottom)+' <= '+Math.round(sk.pinTop-16));
  ok('staking: the caption under the amount states the tier cue (1,000 CT earns +1%)', /1,000 CT/.test(sk.cue)&&/\+1%/.test(sk.cue), sk.cue.replace(/\s+/g,' '));
  await shot('s1-staking');
  await pg.fill('#amt','50'); await pg.waitForTimeout(150);
  const l50=await pg.locator('#go').innerText(); const i50=await pg.locator('#sum').innerText();
  ok('staking: invalid amount gives the reason on the button and no interest', l50!==sk.label && !/\d\.\d+ CT/.test(i50), l50);
  await pg.fill('#amt','1.23456'); await pg.waitForTimeout(150);
  const ldec=(await pg.locator('#go').innerText()).trim(), wantDec=await pg.evaluate(()=>App.t('s.btn.dec'));
  ok('staking: excess decimals: the button reads "Up to 4 decimals"', ldec===wantDec && (lang!=='en'||ldec==='Up to 4 decimals'), ldec);
  await pg.fill('#amt','500'); await pg.waitForTimeout(150); const r0=await pg.locator('[data-rate="90"]').innerText();
  await pg.fill('#amt','1000'); await pg.waitForTimeout(60);
  const tr=await pg.evaluate(()=>({rate:document.querySelector('[data-rate="90"]').textContent,anim:[...document.querySelectorAll('#period [data-rate]')].every(e=>e.classList.contains('is-up')&&e.getAnimations().length>0),cue:document.querySelector('#amt-msg').innerText}));
  ok('staking: at 1,000 CT the rates on the period buttons change and animate, and the cue moves to the next tier', r0==='12%'&&tr.rate==='13%'&&tr.anim&&/10,000 CT/.test(tr.cue)&&/\+2%/.test(tr.cue), r0+' -> '+tr.rate+' | '+tr.cue.replace(/\s+/g,' '));
  await pg.fill('#amt','500'); await pg.waitForTimeout(500);
  await pg.locator('#go').tap(); await pg.waitForTimeout(500);
  const sheet=await pg.locator('#sheet').innerText();
  ok('staking: review sheet for 500 CT', await pg.locator('#sheet-root.is-open').count()===1 && /500/.test(sheet));
  ok('staking: "No early exit" stated above the confirm button', await pg.evaluate(()=>{const w=document.querySelector('.sheet-warn'),c=document.querySelector('#tx-confirm');return !!w&&!!c&&w.getBoundingClientRect().bottom<=c.getBoundingClientRect().top;}));
  await shot('s1-staking-review-sheet');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  ok('staking: Escape closes the review sheet', !(await pg.locator('#sheet-root.is-open').count()));
  await pg.locator('#go').tap(); await pg.waitForTimeout(400); await pg.locator('#tx-confirm').tap();
  await pg.waitForTimeout(400); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  ok('staking: Escape while signing cancels, with a message', !(await pg.locator('#sheet-root.is-open').count()) && await pg.locator('.toast').count()===1, await pg.locator('.toast').innerText().catch(()=>''));
  ok('staking: after a cancel the button is the action again', await pg.evaluate(()=>{const g=document.querySelector('#go');return !g.disabled&&!g.querySelector('.spin');}));
  await pg.waitForTimeout(4300);
  await pg.locator('#go').tap(); await pg.waitForTimeout(400); await pg.locator('#tx-confirm').tap();
  await pg.waitForSelector('#sheet [data-tx="hide"]',{timeout:6000}); await pg.locator('#sheet [data-tx="hide"]').tap(); await pg.waitForTimeout(450);
  const pd=await pg.evaluate(()=>{const g=document.querySelector('#go');return {sheet:!!document.querySelector('#sheet-root.is-open'),chip:document.querySelectorAll('.txchip').length,disabled:g.disabled,spin:!!g.querySelector('.spin'),label:g.innerText.trim(),want:App.t('tx.chip',{label:App.t('s.chip',{a:'500'})}),floating:[...document.body.children].filter(e=>getComputedStyle(e).position==='fixed'&&e.getBoundingClientRect().height>0&&!e.matches('.toasts,.sheet-root')).length};});
  ok('staking pending: the primary button is disabled and is the status, nothing floats over it', !pd.sheet&&pd.chip===0&&pd.disabled&&pd.spin&&pd.label===pd.want&&pd.floating===0 && (lang!=='en'||pd.label==='Staking 500 CT: sending'), pd.label);
  await shot('s1-staking-pending');
  await pg.fill('#amt','200'); await pg.waitForTimeout(150); await pg.locator('#go').tap({force:true}).catch(()=>{}); await pg.waitForTimeout(300);
  ok('staking pending: a second stake cannot be started', !(await pg.locator('#sheet-root.is-open').count()) && await pg.evaluate(()=>document.querySelector('#go').disabled && App.tx.pending===true));
  await pg.waitForSelector('.sheet-ic.is-ok',{timeout:12000}).catch(()=>{});
  ok('staking: 500 CT staked through the review sheet (the result opens on its own)', await pg.locator('.sheet-ic.is-ok').count()===1);
  await pg.waitForTimeout(500); await shot('s1-staking-success');
  const after=await pg.evaluate(()=>({avail:document.querySelector('#avail').textContent,mine:document.querySelector('#sw a[href="stakes.html"]').textContent,busy:App.tx.pending}));
  ok('staking: the available balance drops by the staked amount at once', sk.avail==='1,840.5 CT'&&after.avail==='1,340.5 CT'&&/3/.test(after.mine)&&!after.busy, sk.avail+' -> '+after.avail+' | '+after.mine);
  await pg.locator('[data-tx="done"]').tap(); await pg.waitForTimeout(400);
  ok('staking: after the stake the button is free again', await pg.evaluate(()=>{const g=document.querySelector('#go');return !g.querySelector('.spin')&&!g.classList.contains('is-busy');}));
  await pg.goto(B+'stakes.html'); await pg.waitForTimeout(700);
  ok('my stakes: the new 500 CT stake is listed first (3 stakes, 2,000 CT)', await pg.evaluate(()=>{const c=document.querySelectorAll('.stake');return c.length===3&&/^500/.test(c[0].querySelector('.fig').textContent)&&/2,000/.test(document.querySelector('.card--ink .fig').textContent);}));

  // ---------- 6. wallet: copy the address
  await pg.goto(B+'wallet.html'); await pg.waitForTimeout(900);
  const wl=await pg.evaluate(()=>{const b=document.querySelector('#copy-addr').getBoundingClientRect();const d=document.querySelector('details.help');const k=document.querySelector('.addr-acts a');return {bottom:b.bottom,h:b.height,ih:innerHeight,text:document.querySelector('#copy-addr').innerText.trim(),open:d.open,heads:[...document.querySelectorAll('#main h2.card-h')].map(e=>e.textContent),scan:k.innerText.trim(),scanH:k.getBoundingClientRect().height,figs:[...document.querySelectorAll('#main .card .fig')].map(e=>e.textContent),staked:document.querySelector('.rowlink b').textContent,ctTop:document.querySelectorAll('#main .card .fig')[0].getBoundingClientRect().bottom,tab:document.querySelector('.tb').getBoundingClientRect().top};});
  ok('wallet: own address is the first block, with a text Copy button', wl.text.length>3 && wl.h>=44, wl.text+' | first block: '+wl.heads[0]);
  ok('wallet: copy button on the first screen', wl.bottom<wl.ih-62, Math.round(wl.bottom));
  ok('wallet: the explorer button is labelled "Kaiascan"', wl.scan==='Kaiascan'&&wl.scanH>=44, wl.scan);
  ok('wallet: the CT card comes before Points and its figure is on the first screen', wl.heads[1]==='CT'&&/CT$/.test(wl.figs[0])&&/P$/.test(wl.figs[1])&&wl.ctTop<wl.tab, wl.heads.join(' > '));
  ok('wallet: the balance reflects the stake (1,340.5 CT available, 2,000 CT staked)', /^1,340\.5/.test(wl.figs[0])&&wl.staked==='2,000 CT', wl.figs[0]+' | '+wl.staked);
  ok('wallet: token contract collapsed by default', wl.open===false);
  await shot('w1-wallet');
  await pg.locator('#copy-addr').tap(); await pg.waitForTimeout(300);
  const clip=await pg.evaluate(()=>navigator.clipboard.readText());
  ok('wallet: clipboard holds the player address', clip==='0x7A3fC2b91E5d4086aB17c93D5E0f6A2948bD1C7e', clip);
  const copied=(await pg.locator('#copy-addr').innerText()).trim();
  ok('wallet: the button says "Copied" and no toast repeats it', copied!==wl.text && copied===await pg.evaluate(()=>App.t('w.copy.done')) && await pg.locator('.toast').count()===0, copied);
  await shot('w1-wallet-copied');
  await pg.waitForTimeout(2200);
  ok('wallet: the button label returns', (await pg.locator('#copy-addr').innerText()).trim()===wl.text);
  await pg.locator('details.help summary').scrollIntoViewIfNeeded(); await pg.locator('details.help summary').tap(); await pg.waitForTimeout(300);
  await pg.locator('details.help [data-copy]').scrollIntoViewIfNeeded(); await pg.locator('details.help [data-copy]').tap(); await pg.waitForTimeout(300);
  const toast2=await pg.locator('.toast').innerText().catch(()=>'');
  ok('wallet: the contract address copy keeps its warning toast', await pg.locator('.toast').count()===1 && toast2===await pg.evaluate(()=>App.t('w.token.copied')), toast2);
  await shot('w1-wallet-token-info');

  ok('no page errors', errs.length===0, errs.join(' | '));
  await b.close();
  const fails=res.filter(r=>r[0]==='FAIL');
  for(const r of res) console.log(r[0],r[1],r[2]?('['+r[2]+']'):'');
  console.log(`\n${lang} ${W}x${H}: ${res.length-fails.length}/${res.length} passed`);
  process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);for(const r of res) console.log(r[0],r[1],r[2]);process.exit(2)});
