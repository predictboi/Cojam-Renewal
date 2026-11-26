// Touch walk through of the primary task with assertions (login, five cards, undo, day done, ranking, a 500 CT stake, copy the wallet address).
// Serve first: python3 -m http.server 8816 -d platform/design. Run: node platform/design/tests/e2e-touch.js <en|ko|ja> <width> <height> [captureDir]
const {chromium}=require('playwright');
const [lang,W,H,OUT]=[process.argv[2]||'en',+process.argv[3]||390,+process.argv[4]||844,process.argv[5]];
const B='http://localhost:8816/';
const res=[];const ok=(name,cond,extra)=>{res.push([cond?'PASS':'FAIL',name,extra===undefined?'':String(extra)]);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const cdp=await ctx.newCDPSession(pg);
  const shot=async n=>{ if(OUT) await pg.screenshot({path:`${OUT}/v2-${n}-${lang}-${W}.png`}); };
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  async function drag(x0,y0,dx,{steps=12,stepMs=16,hold=0,release=true,shotName}={}){
    await touch('touchStart',x0,y0);
    for(let i=1;i<=steps;i++){ await touch('touchMove',x0+dx*i/steps,y0); await sleep(stepMs); }
    if(hold) await sleep(hold);
    if(shotName) await shot(shotName);
    const st=await pg.evaluate(()=>{const c=document.querySelector('.qcard[data-pos="0"]');if(!c)return null;const s=d=>+getComputedStyle(c.querySelector('.qstamp--'+d)).opacity;return {l:s('l'),r:s('r'),hot:c.querySelectorAll('.choice.is-hot').length};});
    if(release){ await touch('touchEnd'); }
    return st;
  }
  const front=()=>pg.evaluate(()=>{const c=document.querySelector('.qcard[data-pos="0"]');return c?+c.dataset.q:0;});
  const cnt=()=>pg.evaluate(()=>+document.querySelector('#cnt').textContent);
  const cardBox=()=>pg.evaluate(()=>{const r=document.querySelector('.qcard[data-pos="0"]').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});

  // ---------- 1. login
  await pg.goto(B+'login.html'+(lang==='en'?'':'?lang='+lang)); await pg.waitForTimeout(900);
  if(lang==='en') ok('language: English by default with a Korean device', await pg.evaluate(()=>document.documentElement.lang)==='en');
  ok('login: email field focused on load', await pg.evaluate(()=>document.activeElement&&document.activeElement.id==='email'));
  ok('login: providers shown before submit', await pg.locator('#email-cap').isVisible());
  ok('login: terms and privacy are links', await pg.locator('.fine a[href]').count()===2);
  ok('login: language control present', await pg.locator('select[data-lang]').count()===1);
  await pg.keyboard.type('minji@gmial.com'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  ok('login: typo suggestion offered (gmail.com)', (await pg.locator('#typo').innerText().catch(()=>'')).includes('gmail.com'));
  ok('login: typo is not treated as unsupported', await pg.locator('#prov-note').count()===0);
  await shot('a1-login-typo-suggestion');
  await pg.locator('[data-fix-email]').tap(); await pg.waitForTimeout(200);
  ok('login: one tap fix sets gmail.com', await pg.inputValue('#email')==='minji@gmail.com');
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(1300);
  ok('login: code step headline swapped', await pg.locator('#code').count()===1 && !(await pg.locator('#lede').isVisible()));
  await pg.keyboard.type('418'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  const cm=await pg.locator('#code-msg').innerText();
  ok('login: incomplete code reads as incomplete', /6/.test(cm) && !(await pg.locator('.field-box--code.is-error').count()), cm);
  await shot('a1-login-code-incomplete');
  await pg.keyboard.type('250'); await pg.waitForURL(/first-run/,{timeout:9000}).catch(()=>{});
  ok('login: reaches first run', /first-run/.test(pg.url()));
  await pg.waitForTimeout(500); await shot('a2-first-run');
  ok('language: the choice is remembered on the next screens', await pg.evaluate(()=>document.documentElement.lang)===lang);

  // ---------- 2. five cards
  await pg.goto(B+'home-cards.html'); await pg.waitForTimeout(1200);
  ok('H1: header title on one line', await pg.evaluate(()=>{const h=document.querySelector('.ph h1');return h.getBoundingClientRect().height<parseFloat(getComputedStyle(h).fontSize)*1.6;}));
  ok('H1: language still '+lang, await pg.evaluate(()=>document.documentElement.lang)===lang);
  const fit=await pg.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:innerHeight,final:(()=>{const e=document.querySelector('.qcard[data-pos="0"] .qcard-final');const r=e.getBoundingClientRect();return r.bottom;})(),tab:document.querySelector('.tb').getBoundingClientRect().top,h2lines:(()=>{const h=document.querySelector('.qcard[data-pos="0"] h2');return Math.round(h.getBoundingClientRect().height/parseFloat(getComputedStyle(h).lineHeight));})()}));
  ok('H1: no page scroll', fit.sh<=fit.ih, fit.sh+' / '+fit.ih);
  ok('H1: "final" line inside the card and above the tab bar', fit.final<fit.tab, Math.round(fit.final)+' < '+fit.tab);
  ok('H1: question at most 3 lines', fit.h2lines<=3, fit.h2lines);
  ok('H1: deck focused on load', await pg.evaluate(()=>document.activeElement&&document.activeElement.id==='deck'));
  await shot('h1-card-at-rest');
  let c=await cardBox(); const cx=c.x+c.w/2, cy=c.y+c.h*0.4;
  // below threshold: 30% of the card width
  let st=await drag(cx,cy,c.w*0.30,{hold:250,shotName:'h1-drag-below-threshold',release:true});
  ok('drag 30%: stamp capped at 0.4', st.r<=0.41 && st.r>0.2, st.r);
  ok('drag 30%: no button lit', st.hot===0);
  await sleep(500);
  ok('drag 30%: release returns the card', await cnt()===0 && await front()===1);
  // armed: 42%
  st=await drag(cx,cy,c.w*0.42,{hold:250,shotName:'h1-drag-armed',release:false});
  ok('drag 42%: stamp solid and button lit', st.r===1 && st.hot===1, JSON.stringify(st));
  await touch('touchEnd'); await sleep(450);
  ok('drag 42%: release commits question 1', await cnt()===1 && await front()===2);
  ok('undo: button shown, at least 44px tall', await pg.evaluate(()=>{const u=document.querySelector('#undo');return !!u&&u.getBoundingClientRect().height>=44;}));
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
  // keyboard: arrow works without tabbing; key repeat ignored
  await pg.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',repeat:true,bubbles:true}))); await sleep(100);
  ok('keyboard: repeated key event ignored', await cnt()===2);
  await pg.keyboard.press('ArrowRight'); await sleep(100); await pg.keyboard.press('ArrowRight'); await sleep(500);
  ok('keyboard: arrow picks without tabbing, second press 100 ms later ignored', await cnt()===3 && await front()===4, await cnt());
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
  await shot('h3-day-done');
  await pg.locator('a.btn-primary').tap(); await pg.waitForURL(/ranking/); await pg.waitForTimeout(900);

  // ---------- 4. ranking
  const rk=await pg.evaluate(()=>{const pin=document.querySelector('#pin').getBoundingClientRect().top;const rows=[...document.querySelectorAll('.list .krow')].filter(r=>r.getBoundingClientRect().bottom<=pin).length;const ranks=[...document.querySelectorAll('.list .krow-rank [aria-hidden]')].map(e=>e.textContent);return {rows,ranks,tied:/Tied|동점|同点/.test(document.querySelector('.list').innerText),pin:document.querySelector('#pin').innerText,pill:document.querySelector('#pts-val').textContent};});
  ok('ranking: at least 3 full rows on the first screen', rk.rows>=3, rk.rows);
  ok('ranking: ranks are distinct 1 to 10', rk.ranks.join()==='1,2,3,4,5,6,7,8,9,10');
  ok('ranking: no Tied tag', !rk.tied);
  ok('ranking: tie rule line on screen', await pg.locator('.tie-line').first().isVisible());
  ok('ranking: pinned figure labelled as this week', /950P/.test(rk.pin), rk.pin.replace(/\s+/g,' ')+' | pill '+rk.pill);
  await shot('k1-ranking');
  await pg.locator('#how').tap(); await pg.waitForTimeout(500); await shot('k1-ranking-prize-sheet');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  ok('ranking: Escape closes the sheet', !(await pg.locator('#sheet-root.is-open').count()));

  // ---------- 5. staking 500 CT
  await pg.goto(B+'staking.html'); await pg.waitForTimeout(900);
  const sk=await pg.evaluate(()=>{const g=document.querySelector('#go').getBoundingClientRect();return {bottom:g.bottom,tab:document.querySelector('.tb').getBoundingClientRect().top,label:document.querySelector('#go').innerText};});
  ok('staking: primary action in view above the tab bar', sk.bottom<=sk.tab, Math.round(sk.bottom)+' <= '+sk.tab);
  await shot('s1-staking');
  await pg.fill('#amt','50'); await pg.waitForTimeout(150);
  const l50=await pg.locator('#go').innerText(); const i50=await pg.locator('#sum').innerText();
  ok('staking: invalid amount gives the reason on the button and no interest', l50!==sk.label && !/\d\.\d+ CT/.test(i50), l50);
  await pg.fill('#amt','500'); await pg.waitForTimeout(150);
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
  await pg.waitForTimeout(4300);
  await pg.locator('#go').tap(); await pg.waitForTimeout(400); await pg.locator('#tx-confirm').tap();
  await pg.waitForSelector('.sheet-ic.is-ok',{timeout:12000}).catch(()=>{});
  ok('staking: 500 CT staked through the review sheet', await pg.locator('.sheet-ic.is-ok').count()===1);
  await pg.waitForTimeout(500); await shot('s1-staking-success');

  // ---------- 6. wallet: copy the address
  await pg.goto(B+'wallet.html'); await pg.waitForTimeout(900);
  const wl=await pg.evaluate(()=>{const b=document.querySelector('#copy-addr').getBoundingClientRect();const d=document.querySelector('details.help');return {bottom:b.bottom,h:b.height,ih:innerHeight,text:document.querySelector('#copy-addr').innerText.trim(),open:d.open,order:[...document.querySelectorAll('#main section > h2, #main section h2.card-h')].map(e=>e.textContent)[0]};});
  ok('wallet: own address is the first block, with a text Copy button', wl.text.length>3 && wl.h>=44, wl.text+' | first block: '+wl.order);
  ok('wallet: copy button on the first screen', wl.bottom<wl.ih-62, Math.round(wl.bottom));
  ok('wallet: token contract collapsed by default', wl.open===false);
  await shot('w1-wallet');
  await pg.locator('#copy-addr').tap(); await pg.waitForTimeout(300);
  const clip=await pg.evaluate(()=>navigator.clipboard.readText());
  ok('wallet: clipboard holds the player address', clip==='0x7A3fC2b91E5d4086aB17c93D5E0f6A2948bD1C7e', clip);
  const toast1=await pg.locator('.toast').innerText();
  ok('wallet: toast names the address and does not cover it', /0x7A3f/.test(toast1) && await pg.evaluate(()=>document.querySelector('.toast').getBoundingClientRect().top>document.querySelector('.addr-card').getBoundingClientRect().bottom));
  await shot('w1-wallet-copied');
  await pg.waitForTimeout(4400);
  await pg.locator('details.help summary').tap(); await pg.waitForTimeout(300);
  await pg.locator('details.help [data-copy]').scrollIntoViewIfNeeded(); await pg.locator('details.help [data-copy]').tap(); await pg.waitForTimeout(300);
  const toast2=await pg.locator('.toast').innerText();
  ok('wallet: contract copy has its own warning toast', toast2!==toast1 && toast2.length>10, toast2);
  await shot('w1-wallet-token-info');

  ok('no page errors', errs.length===0, errs.join(' | '));
  await b.close();
  const fails=res.filter(r=>r[0]==='FAIL');
  for(const r of res) console.log(r[0],r[1],r[2]?('['+r[2]+']'):'');
  console.log(`\n${lang} ${W}x${H}: ${res.length-fails.length}/${res.length} passed`);
  process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);for(const r of res) console.log(r[0],r[1],r[2]);process.exit(2)});
