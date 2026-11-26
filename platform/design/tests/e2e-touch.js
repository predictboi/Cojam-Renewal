// Touch walk through of the primary task with assertions (login, five cards, undo, day done, ranking, a 500 CT stake, copy the wallet address, friend invites).
// Serve first: python3 -m http.server 8820 -d platform/design (another port: PORT=8816).
// Run: node platform/design/tests/e2e-touch.js <en|ko|ja> <width> <height> [captureDir]   Captures are named v7-<screen>-<lang>-<width>.png
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
  const shot=async n=>{ if(OUT) await pg.screenshot({path:`${OUT}/v7-${n}-${lang}-${W}.png`}); };
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  const stamps=()=>pg.evaluate(()=>{const c=document.querySelector('.qcard[data-pos="0"]');if(!c)return null;const s=d=>+getComputedStyle(c.querySelector('.qstamp--'+d)).opacity;const g=q=>getComputedStyle(c.querySelector(q)).backgroundColor;const h=c.querySelector('.choice.is-hot');return {l:s('l'),r:s('r'),hot:c.querySelectorAll('.choice.is-hot').length,stampL:g('.qstamp--l'),stampR:g('.qstamp--r'),tint:g('.qtint'),tintOn:+getComputedStyle(c.querySelector('.qtint')).opacity,hotBg:h?getComputedStyle(h).backgroundColor:''};});
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
  const CARDS=`[...document.querySelectorAll('#main .pg *')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();const edged=(parseFloat(s.borderTopWidth)>=1&&parseFloat(s.borderLeftWidth)>=1&&parseFloat(s.borderBottomWidth)>=1)||/inset/.test(s.boxShadow)&&/ 0px 0px (1\\.5|2)px/.test(s.boxShadow);return edged&&r.width>120&&r.height>64&&!e.closest('.btn, button, a, input, .seg, .field-box, .tag, .period, .qr, .mtabs, .day5, .mbar, .pod, .ratetable, .note');}).length`;
  const cards=()=>pg.evaluate(CARDS);
  const LIME='rgb(214, 255, 61)', CORAL='rgb(255, 122, 102)', SKY='rgb(77, 176, 255)', CORAL_HOT='rgb(255, 103, 83)', SKY_HOT='rgb(63, 166, 250)';
  const PROVIDERS=['Gmail','Naver','Kakao','Daum','Hanmail','iCloud','Outlook','Hotmail','Yahoo! JAPAN'];

  // ---------- 1. login
  await pg.goto(B+'login.html?state=unsupported'+(lang==='en'?'':'&lang='+lang)); await pg.waitForTimeout(600);
  const noteTxt=await pg.locator('#prov-note').innerText();
  ok('login: Send code is disabled while the unsupported note shows', await pg.locator('#send').isDisabled());
  await pg.locator('#email').fill('minji@naver.com'); await pg.waitForTimeout(150);
  ok('login: changing the address clears the note and frees the button', await pg.locator('#prov-note').count()===0 && !(await pg.locator('#send').isDisabled()));
  await pg.goto(B+'login.html?state=unsupported'+(lang==='en'?'':'&lang='+lang)); await pg.waitForTimeout(500);
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
  await pg.keyboard.type('Minji@Gmial.com'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  ok('login: typo suggestion offered (gmail.com)', (await pg.locator('#typo').innerText().catch(()=>'')).includes('gmail.com'));
  ok('login: typo is not treated as unsupported', await pg.locator('#prov-note').count()===0);
  const tf=await pg.evaluate(()=>{const f=document.querySelector('#facts');const fits=!f.hidden&&f.getBoundingClientRect().bottom<=innerHeight;f.hidden=false;const would=f.getBoundingClientRect().bottom<=innerHeight-8;f.hidden=!fits;return {fits,would,scroll:document.documentElement.scrollHeight<=innerHeight};});
  ok('login: the three facts stay in the typo state when the height allows', tf.fits===tf.would, JSON.stringify(tf));
  await shot('a1-login-typo-suggestion');
  await pg.locator('[data-fix-email]').tap(); await pg.waitForTimeout(200);
  await pg.waitForTimeout(1300);
  ok('login: one tap on the suggestion fixes the address (lower case) and sends the code', await pg.locator('#code').count()===1 && (await pg.locator('#f-code').innerText()).includes('minji@gmail.com'));

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
  const hd=await pg.evaluate(()=>{const cd=document.querySelector('.ph-cd'),sw=document.querySelector('.viewsw a[aria-current]');return {cd:cd.innerText.replace(/\s+/g,' ').trim(),word:App.t('h.closes'),sw:sw.innerText.trim(),want:App.t('h.view.card'),lig:getComputedStyle(document.body).fontVariantLigatures};});
  ok('H1: the header timer shows its word ("Closes in 12:48:08")', hd.cd.startsWith(hd.word) && /\d\d:\d\d:\d\d$/.test(hd.cd), hd.cd);
  ok('H1: the view switch names the selected view in words', hd.sw===hd.want, hd.sw);
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
  const cols=await pg.evaluate(()=>{const c=document.querySelector('.qcard[data-pos="0"]');const g=q=>getComputedStyle(c.querySelector(q)).backgroundColor;const lime='rgb(214, 255, 61)';return {l:g('.choice[data-dir="l"]'),r:g('.choice[data-dir="r"]'),limeOnHome:[...document.querySelectorAll('#main *')].filter(e=>{const s=getComputedStyle(e);return s.backgroundColor===lime||s.color===lime||s.borderTopColor===lime;}).length};});
  ok('H1: left answer coral, right answer sky; nothing on the home screen body is lime', cols.l===CORAL && cols.r===SKY && cols.limeOnHome===0, cols.l+' / '+cols.r+' / lime elements: '+cols.limeOnHome);
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
  ok('armed left: stamp, tint and lit button are coral', st.stampL===CORAL && st.tint===CORAL && st.tintOn>0.1 && st.hotBg===CORAL_HOT, st.stampL+' '+st.tint+' '+st.hotBg);
  for(let i=11;i>=0;i--){ await touch('touchMove',cx-c.w*0.42*i/12,cy); await sleep(16); } await touch('touchEnd'); await sleep(500);
  ok('drag back to the centre: nothing picked', await cnt()===0 && await front()===1);
  await drag(cx,cy,-70,{steps:5,stepMs:40}); await sleep(450);
  ok('fling rule: 70 px at an easy pace (under 1.1 px/ms) does not commit', await cnt()===0 && await front()===1, await cnt());
  await drag(cx,cy,-100,{steps:5,stepMs:90}); await sleep(450);
  ok('fling rule: 100 px made slowly (under 0.5 px/ms, short of 35%) does not commit', await cnt()===0 && await front()===1, await cnt());
  // armed to the right: 42%
  st=await drag(cx,cy,c.w*0.42,{hold:250,shotName:'h1-drag-armed-right',release:false});
  ok('drag 42%: stamp solid and button lit', st.r===1 && st.hot===1, JSON.stringify(st));
  ok('armed right: stamp, tint and lit button are sky, not lime', st.stampR===SKY && st.tint===SKY && st.tintOn>0.1 && st.hotBg===SKY_HOT, st.stampR+' '+st.tint+' '+st.hotBg);
  await touch('touchEnd'); await sleep(450);
  ok('drag 42%: release commits question 1', await cnt()===1 && await front()===2);
  ok('undo: button shown, at least 44px tall', await pg.evaluate(()=>{const u=document.querySelector('#undo');return !!u&&u.getBoundingClientRect().height>=44;}));
  ok('undo: the key hint is hidden on a touch device', await pg.evaluate(()=>getComputedStyle(document.querySelector('#undo kbd')).display==='none'));
  ok('undo: next card is already in front (no waiting)', await front()===2);
  ok('pick line: the made pick carries the dot of its answer colour (sky for the right answer)', await pg.evaluate(()=>{const d=document.querySelector('#pickbar .pk > i');return d?getComputedStyle(d).backgroundColor:'';})===SKY);
  await shot('h1-after-throw-undo');
  await pg.locator('#undo').tap(); await sleep(200); await shot('h1-undo-flying-back'); await sleep(500);
  ok('undo: card 1 back in front, counter 0, segment empty', await front()===1 && await cnt()===0 && await pg.evaluate(()=>document.querySelector('#day5').children[0].className===''));
  // double tap guard: two taps 120 ms apart answer one question
  const yes=await pg.evaluate(()=>{const r=document.querySelector('.qcard[data-pos="0"] .choice[data-dir="r"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await pg.touchscreen.tap(yes.x,yes.y); await sleep(120); await pg.touchscreen.tap(yes.x,yes.y); await sleep(100);
  ok('guard: two taps 120 ms apart answer one question', await cnt()===1, await cnt());
  // five rapid taps do not finish the day
  for(let i=0;i<4;i++){ await pg.touchscreen.tap(yes.x,yes.y); await sleep(60); }
  ok('guard: four rapid taps (60 ms apart) answer at most one more card (400 ms tap guard), never the whole set', await cnt()<=2, await cnt());
  // bring the deck back to: q1 picked only
  while(await cnt()>1){ await pg.locator('#undo').tap(); await sleep(450); }
  ok('undo acts on the most recent pick only', await cnt()===1 && await front()===2);
  // fling rule: 96 px of travel at 0.5 px/ms or more commits (or 56 px at 1.1 px/ms or more); short of the armed 35% a slow drag never does
  await sleep(450); c=await cardBox();
  await drag(cx,cy,-100,{steps:3,stepMs:6}); await sleep(450);
  ok('fling commits question 2 (100 px of travel at speed)', await cnt()===2 && await front()===3, await cnt());
  // two picks pending: undo brings back only the last one
  const held=await pg.evaluate(()=>document.querySelectorAll('#day5 .is-pend').length);
  await pg.locator('#undo').tap(); await sleep(500);
  ok('two pending, undo returns only question 2', await front()===2 && await cnt()===1, 'pending before: '+held);
  // pick 2 again by fling to the left, then wait for saving and saved
  await drag(cx,cy,-100,{steps:3,stepMs:6}); await sleep(3300);
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
  ok('keyboard: arrow picks without tabbing; a second press 100 ms later is queued and answers the next card (not lost, not doubled)', await cnt()===4 && await front()===5, await cnt());
  await pg.keyboard.press('z'); await sleep(600);
  ok('keyboard: Z takes back the queued pick only', await cnt()===3 && await front()===4, await cnt());
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
  const fin=await pg.evaluate(()=>{const e=document.querySelector('#deck-end'),r=document.querySelector('.end-ring').getBoundingClientRect(),b=document.querySelector('#finish'),br=b.getBoundingClientRect(),d=document.querySelector('#deck').getBoundingClientRect();return {vis:getComputedStyle(e).visibility==='visible'&&e.getAttribute('aria-hidden')==='false',ring:r.width>=80&&r.top>=d.top&&r.bottom<=d.bottom,anim:document.querySelector('#end-run').getAnimations().length>0,txt:document.querySelector('#end-p').innerText.trim(),btn:b.innerText.trim(),want:App.t('h.end.now'),inDeck:br.bottom<=d.bottom,h:br.height};});
  ok('fifth pick: the deck area shows the ring, "Finishing in N" and a "Finish now" button (no dead wait)', fin.vis&&fin.ring&&fin.anim&&/[123]/.test(fin.txt)&&fin.btn===fin.want&&fin.inDeck&&fin.h>=44, JSON.stringify(fin));
  await shot('h1-fifth-pick-undo');
  await pg.locator('#undo').tap(); await sleep(600);
  ok('fifth pick undone: card 5 back', await front()===5 && await cnt()===4);
  const t0=Date.now(); await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap();
  await pg.waitForURL(/done\.html/,{timeout:9000}).catch(()=>{}); const waited=Date.now()-t0;
  ok('without "Finish now" the day done screen opens only after the 3 s window', /done\.html/.test(pg.url()) && waited>=3000, waited+' ms');

  // ---------- 3. day done
  await pg.waitForTimeout(400); const p0=await pg.locator('#pts-val').innerText();
  await pg.waitForTimeout(2600); const p1=await pg.locator('#pts-val').innerText();
  const mom=await css('#done-fig','color');
  ok('done: during the moment the +100P figure is lime', mom===LIME, mom);
  ok('done: header pill counts 1,250P to 1,350P', p1==='1,350P', p0+' -> '+p1);
  ok('done: no duplicate +100P toast', await pg.locator('.toast').count()===0);
  await pg.waitForTimeout(1200);
  const dn=await pg.evaluate(()=>{const g=s=>getComputedStyle(document.querySelector(s));const lime='rgb(214, 255, 61)';
    const limeEls=[...document.querySelectorAll('.app *')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>1&&r.height>1&&(s.backgroundColor===lime||s.color===lime)&&!e.closest('.tb');}).map(e=>e.tagName==='I'?'day5':e.closest('.btn')?'btn':(e.className||e.tagName).toString().split(' ')[0]);
    const f=document.querySelector('#done-fig'),fr=f.getBoundingClientRect(),h=document.querySelector('.done-stack h1').getBoundingClientRect(),st=document.querySelector('.done-stack .done-st').getBoundingClientRect(),nx=document.querySelector('#next').getBoundingClientRect();
    return {fig:g('#done-fig').color,fs:g('#done-fig').fontSize,ff:g('#done-fig').fontFamily,txt:f.textContent,stacked:h.bottom<=fr.top+1&&fr.bottom<=st.top+1&&Math.abs(h.left-fr.left)<=4,lime:[...new Set(limeEls)].join(','),nextH:nx.height,nextTxt:document.querySelector('#next').innerText.replace(/\s+/g,' ').trim(),note:document.querySelectorAll('.done-wait .plain-note p').length,noteOut:document.querySelectorAll('.plain-note').length-document.querySelectorAll('.done-wait .plain-note').length,rule:getComputedStyle(document.querySelector('.done-picks')).borderTopWidth,resLink:!!document.querySelector('div.sect-h a[href="results.html"]'),resH:(document.querySelector('div.sect-h a[href="results.html"]')||document.body).getBoundingClientRect().height,listTop:document.querySelector('.list').getBoundingClientRect().top,
      picks:[...document.querySelectorAll('.pick-c .pk')].map(e=>e.textContent),dots:[...document.querySelectorAll('.pick-c .pk > i')].map(e=>getComputedStyle(e).backgroundColor),expect:['r','l','r','r','r'].map((d,i)=>App.q(MOCK.set[i])[d])};});
  ok('done: "+100P" is the hero: display face, 60px (52px at 360), stacked under the small headline and above the status line, white at rest', dn.txt==='+100P'&&dn.fs===(W>=380?'60px':'52px')&&/Archivo/.test(dn.ff)&&dn.stacked&&dn.fig==='rgb(255, 255, 255)', dn.fs+' '+dn.fig+' stacked '+dn.stacked);
  ok('done: at rest only the progress band and the primary button are lime', dn.lime==='day5,btn', dn.lime);
  const dnCards=await cards();
  ok('done: "Next set in" is one quiet line and nothing on the page is a bordered card', dn.nextH<=32&&/\d\d:\d\d:\d\d/.test(dn.nextTxt)&&dnCards===0, 'height '+dn.nextH+', cards '+dnCards+', list starts at '+Math.round(dn.listTop));
  ok('done: the picks section starts on the 2px ink rule, with the results link in its heading row (44px target)', dn.rule==='2px'&&dn.resLink&&dn.resH>=44, dn.rule+' / link '+dn.resLink+' '+dn.resH);
  ok('done: the payout note is two short plain lines inside the waiting block', dn.note===2&&dn.noteOut===0, dn.note+' / outside '+dn.noteOut);
  ok('done: the list shows the picks made in this session, each with the dot of its answer colour', dn.picks.join('|')===dn.expect.join('|') && dn.dots.join('|')===[SKY,CORAL,SKY,SKY,SKY].join('|'), dn.picks.join(' | '));
  await shot('h3-day-done');
  await pg.goto(B+'home-cards.html'); await pg.waitForTimeout(900);
  const hf=await pg.evaluate(()=>{const a=document.querySelector('.home-fin a.btn');return {href:a?a.getAttribute('href'):'',h:a?a.getBoundingClientRect().height:0,deck:!!document.querySelector('.qcard'),cnt:document.querySelector('#cnt')?document.querySelector('#cnt').textContent:'',done:document.querySelectorAll('#day5 .is-done').length,scroll:document.documentElement.scrollHeight<=innerHeight};});
  ok('home after the day is done: stays on home (no redirect), finished: 5/5, no cards, one button to the day done screen, 1,350P kept', /home-cards\.html$/.test(pg.url())&&hf.href==='done.html'&&hf.h>=44&&!hf.deck&&hf.done===5&&hf.scroll && await pg.locator('#pts-val').innerText()==='1,350P', pg.url()+' '+JSON.stringify(hf));
  await shot('h1-home-finished');
  await pg.locator('.home-fin a.btn').tap(); await pg.waitForURL(/done\.html/); await pg.waitForTimeout(700);
  ok('finished home leads to the settled day done screen (the moment does not replay)', /done\.html$/.test(pg.url()) && await css('#done-fig','color')==='rgb(255, 255, 255)' && await pg.locator('#pts-val').innerText()==='1,350P', pg.url());
  await pg.locator('a.btn-primary').tap(); await pg.waitForURL(/ranking/); await pg.waitForTimeout(900);

  // ---------- 4. ranking
  const rk=await pg.evaluate(()=>{const pin=document.querySelector('#pin').getBoundingClientRect().top;const rows=[...document.querySelectorAll('#top10 .krow')].filter(r=>r.getBoundingClientRect().bottom<=pin).length;const ranks=[...document.querySelectorAll('#top10 [data-rank]')].map(e=>e.dataset.rank);
    const pods=[...document.querySelectorAll('#top10 .pod')].map(e=>{const st=e.querySelector('.pod-step'),s=getComputedStyle(st),r=st.getBoundingClientRect(),er=e.getBoundingClientRect();return {rank:e.dataset.rank,bg:s.backgroundColor,h:Math.round(r.height),w:Math.round(r.width),x:Math.round(er.left),bottom:Math.round(r.bottom)};});
    const nm=document.querySelectorAll('#top10 .pod-name span')[1],ns=getComputedStyle(nm);
    const ar=[...document.querySelectorAll('#around .krow')].map(r=>({rank:r.dataset.rank,me:r.classList.contains('is-me'),gap:(r.querySelector('.krow-gap')||{}).textContent||''}));
    const order=document.querySelector('#top10').compareDocumentPosition(document.querySelector('#around'))&4;
    return {rows,ranks,pods,pin,name:nm.textContent,lig:ns.fontVariantLigatures,ar,order,up:App.t('k.gap.up',{n:50}),down:App.t('k.gap.down',{n:50}),cols:[...document.querySelectorAll('.cols')].map(c=>c.innerText.replace(/\s+/g,' ').trim()),colWant:[App.t('k.col.player'),App.t('k.col.prize')],aroundCols:document.querySelectorAll('#around .cols').length,blocks:[...document.querySelectorAll('#top10 .krow:not(.is-void) .krow-rank, #around .krow:not(.is-me) .krow-rank')].map(e=>{const s=getComputedStyle(e);return s.boxShadow+'|'+s.backgroundColor;}),meBlock:getComputedStyle(document.querySelector('#around .krow.is-me .krow-rank')).backgroundColor,tied:/Tied|동점|同点/.test(document.querySelector('#top10').innerText),pinTxt:document.querySelector('#pin').innerText,pill:document.querySelector('#pts-val').textContent};});
  ok('ranking: the podium and at least one plain row are on the first screen', rk.pods.every(p=>p.bottom<=rk.pin)&&rk.rows>=1, rk.rows+' rows, podium bottom '+rk.pods[0].bottom+' <= '+rk.pin);
  ok('ranking: ranks are distinct 1 to 10', rk.ranks.join()==='1,2,3,4,5,6,7,8,9,10');
  ok('ranking: ranks 1 to 3 stand on a podium: first in the middle and tallest, steps in ink, blue and sky, no lime', rk.pods.length===3&&rk.pods[0].h>rk.pods[1].h&&rk.pods[1].h>rk.pods[2].h&&rk.pods[1].x<rk.pods[0].x&&rk.pods[0].x<rk.pods[2].x&&rk.pods[0].bg==='rgb(11, 21, 48)'&&rk.pods[1].bg==='rgb(18, 76, 196)'&&rk.pods[2].bg==='rgb(151, 219, 255)'&&rk.pods.every(p=>p.w>=90), JSON.stringify(rk.pods));
  ok('ranking: an address keeps its x (ligatures and contextual forms are off for names)', rk.name.startsWith('0x')&&rk.lig==='none', rk.name+' / '+rk.lig);
  const rkCards=await cards();
  ok('ranking: no bordered cards on the page', rkCards===0, rkCards);
  ok('ranking: ranks from 4 down are ink outlined blocks on white; the player\'s own block is filled ink', rk.blocks.length>=9&&rk.blocks.every(x=>/rgb\(11, 21, 48\).*inset/.test(x)&&/\|rgb\(255, 255, 255\)$/.test(x))&&rk.meBlock==='rgb(11, 21, 48)', rk.blocks[0]+' / me '+rk.meBlock);
  ok('ranking: "Around you" sits under rank 10: the rank above, the player, the rank below, with the gap in words', !!rk.order&&rk.ar.length===3&&rk.ar[1].me&&rk.ar.map(r=>r.rank).join()==='26,27,28'&&rk.ar[0].gap===rk.up&&rk.ar[2].gap===rk.down, JSON.stringify(rk.ar));
  ok('ranking: one column label row (player, prize) above the list; "Around you" has no label row (the gap is said in words)', rk.cols.length===1&&rk.cols[0].startsWith(rk.colWant[0])&&rk.cols[0].endsWith(rk.colWant[1])&&rk.aroundCols===0, rk.cols.join(' | '));
  ok('ranking: no Tied tag', !rk.tied);
  ok('ranking: tie rule line on screen', await pg.locator('.tie-line').first().isVisible());
  ok('ranking: pinned figure labelled as this week', /950P/.test(rk.pinTxt), rk.pinTxt.replace(/\s+/g,' ')+' | pill '+rk.pill);
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
    const sw=document.querySelector('#sw'),seg=sw.getBoundingClientRect(),card=document.querySelector('#form').getBoundingClientRect(),cur=sw.querySelector('a[aria-current="page"]'),oth=sw.querySelector('a:not([aria-current])'),sum=document.querySelector('.stk-sum'),help=document.querySelector('.stk-sum + .help').getBoundingClientRect();
    return {bottom:g.bottom,tab,label:document.querySelector('#go').innerText,gap:Math.round(card.top-seg.bottom),pad:parseFloat(getComputedStyle(document.querySelector('.pg')).paddingBottom),pinH:pr.height,tabH:innerHeight-tab,fade:getComputedStyle(pin,'::before').height,border:getComputedStyle(pin).borderTopWidth,
      rules:document.querySelector('#rules').textContent,rulesWant:App.t('s.rules',{date:App.fmt.dateLong(MOCK.ahead(90))}),rulesBottom:document.querySelector('#rules').getBoundingClientRect().bottom,rulesLines:Math.round(document.querySelector('#rules').getBoundingClientRect().height/parseFloat(getComputedStyle(document.querySelector('#rules')).lineHeight)),rowTxt:sum.innerText,apr:App.t('s.apr'),unlock:App.t('s.unlock'),boxes:[...document.querySelectorAll('#main .pg > section')].filter(e=>parseFloat(getComputedStyle(e).borderLeftWidth)>0).length,rows:document.querySelectorAll('#sum, .stk-sum .rows').length,sumL:document.querySelector('#sum-l').textContent,sumWant:App.t('s.interest',{d:90}),sumV:document.querySelector('#sum-v').innerText.replace(/\s+/g,' '),sumFs:getComputedStyle(document.querySelector('#sum-v')).fontSize,pinTop:pr.top,
      tabs:{nav:sw.matches('nav.mtabs'),seg:!!sw.querySelector('.seg, .seg-btn'),rule:getComputedStyle(sw).borderBottomWidth,foot:getComputedStyle(cur,'::after').height,footBg:getComputedStyle(cur,'::after').backgroundColor,curBg:getComputedStyle(cur).backgroundColor,curW:getComputedStyle(cur).fontWeight,othW:getComputedStyle(oth).fontWeight,h:Math.min(cur.getBoundingClientRect().height,oth.getBoundingClientRect().height),n:document.querySelector('#sw-n').textContent},dead:Math.round(pr.top-help.bottom),cue:document.querySelector('#amt-msg').innerText.trim(),avail:document.querySelector('#avail').textContent};});
  ok('staking: primary action in view above the tab bar', sk.bottom<=sk.tab, Math.round(sk.bottom)+' <= '+sk.tab);
  ok('staking: "New stake / My stakes" are underline tabs on the 2px ink rule (two pages, not a filter), 44px targets, the open stakes as a count', sk.tabs.nav&&!sk.tabs.seg&&sk.tabs.rule==='2px'&&sk.tabs.foot==='4px'&&sk.tabs.footBg==='rgb(11, 21, 48)'&&sk.tabs.curBg==='rgba(0, 0, 0, 0)'&&+sk.tabs.curW>+sk.tabs.othW&&sk.tabs.h>=44&&sk.tabs.n==='2', JSON.stringify(sk.tabs));
  ok('staking: the form starts 16 to 24px under the tabs', sk.gap>=16&&sk.gap<=24, sk.gap);
  ok('staking: page bottom padding is the bar height plus its 16px fade', Math.abs(sk.pad-(sk.tabH+sk.pinH+16))<1.5 && sk.fade==='16px' && sk.border==='0px', sk.pad+' = '+sk.tabH+' + '+sk.pinH+' + 16');
  ok('staking: the summary is one figure (interest for the period) with no rows: no "Annual rate", no "Unlocks on" (the date is said once, in the lock line)', sk.rows===0&&sk.sumL===sk.sumWant&&/^[\d.,]+ ?CT$/.test(sk.sumV)&&parseFloat(sk.sumFs)>=28&&!sk.rowTxt.includes(sk.apr)&&!sk.rowTxt.includes(sk.unlock), sk.sumL+': '+sk.sumV+' '+sk.sumFs);
  const sg=await pg.evaluate(()=>{const f=document.querySelector('#form').getBoundingClientRect(),e=document.querySelector('.stk-sum'),r=e.getBoundingClientRect(),cs=getComputedStyle(e),l=document.querySelector('#rules').getBoundingClientRect();return {gap:Math.round(r.top-f.bottom),rule:cs.borderTopWidth,pad:cs.paddingTop,grow:cs.flexGrow,slack:Math.round(r.bottom-l.bottom)};});
  ok('staking: the summary is an ordinary section (2px ink rule, the standard gap above and inside, nothing stretches)', sg.gap>=16&&sg.gap<=24&&sg.rule==='2px'&&sg.pad==='20px'&&sg.grow==='0'&&sg.slack<=1, JSON.stringify(sg));
  ok('staking: the rules line is short ("Locked until {date}. No early exit."), at most 2 lines and never under the action bar', sk.rules===sk.rulesWant&&sk.rulesLines<=2&&sk.rulesBottom<=sk.pinTop, sk.rules+' | '+sk.rulesLines+' lines, '+Math.round(sk.rulesBottom)+' <= '+Math.round(sk.pinTop));
  ok('staking: the form is a flat section, not a bordered card', sk.boxes===0, sk.boxes);
  ok('staking: the caption under the amount states the tier cue (1,000 CT earns +1%)', /1,000 CT/.test(sk.cue)&&/\+1%/.test(sk.cue), sk.cue.replace(/\s+/g,' '));
  await shot('s1-staking');
  await pg.fill('#amt','50'); await pg.waitForTimeout(150);
  const l50=await pg.locator('#go').innerText(); const i50=await pg.locator('#sum-v').innerText();
  const idle=await pg.evaluate(()=>App.t('s.btn.idle')), m50=(await pg.locator('#amt-msg').innerText()).trim();
  ok('staking: invalid amount: the button keeps its label "Stake" (disabled), the reason is in the error line only, no interest', l50.trim()===idle && (lang!=='en'||idle==='Stake') && await pg.locator('#go').isDisabled() && m50.includes(await pg.evaluate(()=>App.t('s.e.min'))) && !/\d\.\d+ CT/.test(i50), l50.trim()+' | '+m50.replace(/\s+/g,' '));
  await pg.fill('#amt','1.23456'); await pg.waitForTimeout(150);
  const ldec=(await pg.locator('#go').innerText()).trim(), mdec=(await pg.locator('#amt-msg').innerText()).trim(), wantDec=await pg.evaluate(()=>App.t('s.e.dec'));
  ok('staking: excess decimals: the error line says so, the button still reads "Stake"', ldec===idle && mdec.includes(wantDec), ldec+' | '+mdec.replace(/\s+/g,' '));
  await pg.fill('#amt','5000'); await pg.waitForTimeout(150);
  const er=await pg.evaluate(()=>[...document.querySelectorAll('#period [data-rate]')].map(e=>e.textContent).join());
  ok('staking: while the amount is in error the period buttons keep the base tier rates', er==='8%,12%,18%,25%' && await pg.locator('.field-box.is-error').count()===1, er);
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
  await pg.waitForSelector('.toast',{timeout:12000}).catch(()=>{});
  const hid=await pg.evaluate(()=>({sheet:!!document.querySelector('#sheet-root.is-open'),toast:(document.querySelector('.toast')||{}).innerText||'',want:App.t('s.ok.h',{a:'500'})}));
  ok('staking: 500 CT staked; after Hide the result is a toast and the sheet stays shut', !hid.sheet&&hid.toast.includes('500')&&hid.toast.trim().length>3, hid.toast.replace(/\s+/g,' ')+' | sheet title would be: '+hid.want);
  await pg.waitForTimeout(500); await shot('s1-staking-done-toast');
  const after=await pg.evaluate(()=>({avail:document.querySelector('#avail').textContent,mine:document.querySelector('#sw a[href="stakes.html"]').textContent,busy:App.tx.pending}));
  ok('staking: the available balance drops by the staked amount at once', sk.avail==='1,840.5 CT'&&after.avail==='1,340.5 CT'&&/3/.test(after.mine)&&!after.busy, sk.avail+' -> '+after.avail+' | '+after.mine);
  ok('staking: after the stake the button is free again', await pg.evaluate(()=>{const g=document.querySelector('#go');return !g.querySelector('.spin')&&!g.classList.contains('is-busy');}));
  await pg.goto(B+'stakes.html'); await pg.waitForTimeout(700);
  ok('my stakes: the new 500 CT stake is listed first (3 stakes, 2,000 CT)', await pg.evaluate(()=>{const c=document.querySelectorAll('.stake');return c.length===3&&/^500/.test(c[0].querySelector('.fig').textContent)&&/2,000/.test(document.querySelector('#total .fig').textContent);}));

  // the success state of the sheet (kept open): the amount as the figure
  await pg.goto(B+'staking.html?state=success'); await pg.waitForTimeout(900);
  const okS=await pg.evaluate(()=>{const f=document.querySelector('#sheet .sheet-state--ok .sheet-done-fig');return {open:!!document.querySelector('#sheet-root.is-open'),fig:f?f.innerText.replace(/\s+/g,' ').trim():'',ff:f?getComputedStyle(f).fontFamily:'',old:document.querySelectorAll('#sheet .sheet-ic.is-ok').length,btn:!!document.querySelector('#sheet .sheet-acts .btn')};});
  ok('staking: the success sheet is the "ok" state with the staked amount as its display figure', okS.open&&/500/.test(okS.fig)&&/Archivo/.test(okS.ff)&&okS.old===0&&okS.btn, JSON.stringify(okS));
  await shot('s1-staking-success'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);

  // ---------- 6. wallet: the short address chip copies the full address
  await pg.goto(B+'wallet.html'); await pg.waitForTimeout(900);
  const FULL='0x7A3fC2b91E5d4086aB17c93D5E0f6A2948bD1C7e';
  const chipSig=()=>pg.evaluate(()=>{const c=document.querySelector('.addr-chip'),v=c.querySelector('.addr-chip-v'),s=getComputedStyle(c),vs=getComputedStyle(v);return [v.textContent,Math.round(c.getBoundingClientRect().height),s.borderTopWidth,s.borderTopColor,s.borderRadius,s.backgroundColor,vs.fontFamily,vs.fontSize,vs.fontVariantLigatures,c.getAttribute('data-copy'),!!c.querySelector('svg')].join('|');});
  const wl=await pg.evaluate(()=>{const c=document.querySelector('#copy-addr'),b=c.getBoundingClientRect(),v=c.querySelector('.addr-chip-v'),vs=getComputedStyle(v),cs=getComputedStyle(c);const d=document.querySelector('details.help');const top=s=>document.querySelector(s).getBoundingClientRect().top;const cv=document.querySelector('.wconvert .btn').getBoundingClientRect();
    return {h:b.height,w:b.width,pgW:document.querySelector('.pg').clientWidth,text:v.textContent,label:c.getAttribute('aria-label'),mono:/mono/i.test(vs.fontFamily),lig:vs.fontVariantLigatures,edge:cs.borderTopWidth+' '+cs.borderTopColor,icon:c.querySelector('svg').innerHTML,isBtn:c.tagName==='BUTTON',open:d.open,ct:document.querySelector('#ct-fig').textContent,ctLabel:document.querySelector('#ct-h').textContent,ctFs:getComputedStyle(document.querySelector('#ct-fig')).fontSize,pt:document.querySelector('#pt-fig').textContent,ptLabel:document.querySelector('#pt-h').textContent,staked:document.querySelector('#staked').textContent,
      order:top('#ct-fig')<top('#copy-addr')&&top('#copy-addr')<top('.acts')&&top('.acts')<top('#staked')&&top('#staked')<top('#pt-fig'),secs:document.querySelectorAll('#main .pg > section').length,rule:getComputedStyle(document.querySelectorAll('#main .pg > section')[1]).borderTopWidth,old:document.querySelectorAll('#main .maddr, #main #addr, #main .addr-note').length,fullShown:document.querySelector('#main .pg').innerText.includes('C2b9'),tints:document.querySelectorAll('#main .tint').length,convBottom:cv.bottom,stamp:!!document.querySelector('.wid .stamp'),tab:document.querySelector('.tb').getBoundingClientRect().top};});
  const wlCards=await cards();
  ok('wallet: two sections only (CT, then points under the 2px ink rule): balance, short address chip, actions, staked, then points; no address section', wl.order&&wl.ctFs==='40px'&&wl.secs===2&&wl.rule==='2px'&&wl.old===0&&!wl.fullShown, wl.ctFs+', sections '+wl.secs+', old address blocks '+wl.old);
  ok('wallet: one label per balance (no "CT" above "1,340.5 CT", no "P" after the points)', wl.ctLabel!=='CT'&&/CT$/.test(wl.ct)&&/^[\d,]+$/.test(wl.pt)&&wl.ptLabel.length>1, wl.ctLabel+' '+wl.ct+' | '+wl.ptLabel+' '+wl.pt);
  ok('wallet: the address is the short form (0x7A3f…1C7e) in the data face with ligatures off, one ink outlined chip that is the copy control, 44px tall', wl.text==='0x7A3f…1C7e'&&wl.mono&&wl.lig==='none'&&wl.isBtn&&wl.h>=44&&wl.w<wl.pgW*0.6&&wl.edge==='2px rgb(11, 21, 48)'&&wl.stamp, wl.text+' '+Math.round(wl.w)+'x'+Math.round(wl.h)+' '+wl.edge);
  ok('wallet: screen readers get the full address in the chip label', wl.label.includes(FULL)&&wl.label.length>FULL.length+3, wl.label);
  ok('wallet: no tinted block and nothing is a bordered card', wl.tints===0&&wlCards===0, wl.tints+' tinted, '+wlCards+' cards');
  ok('wallet: "Convert points" is on the first screen', wl.convBottom<=wl.tab, Math.round(wl.convBottom)+' <= '+wl.tab);
  ok('wallet: the balance reflects the stake (1,340.5 CT available, 2,000 CT staked)', /^1,340\.5/.test(wl.ct)&&wl.staked==='2,000 CT', wl.ct+' | '+wl.staked);
  ok('wallet: token contract collapsed by default', wl.open===false);
  const wSig=await chipSig();
  await shot('w1-wallet');
  await pg.locator('#copy-addr').tap(); await pg.waitForTimeout(300);
  const clip=await pg.evaluate(()=>navigator.clipboard.readText());
  ok('wallet: clipboard holds the full 42 character address', clip===FULL&&clip.length===42, clip);
  const cp=await pg.evaluate(()=>{const c=document.querySelector('#copy-addr');return {txt:c.querySelector('.addr-chip-v').textContent,want:App.t('w.copy.done'),icon:c.querySelector('svg').innerHTML,toasts:document.querySelectorAll('.toast').length,w:c.getBoundingClientRect().width,live:document.querySelector('#live')?1:0};});
  ok('wallet: the chip reads "Copied" with a check icon, keeps its width, and no toast repeats it', cp.txt===cp.want&&cp.icon!==wl.icon&&cp.toasts===0&&Math.abs(cp.w-wl.w)<1.5, cp.txt+' '+Math.round(cp.w)+' vs '+Math.round(wl.w));
  await shot('w1-wallet-copied');
  await pg.waitForTimeout(2200);
  const back=await pg.evaluate(()=>{const c=document.querySelector('#copy-addr');return {txt:c.querySelector('.addr-chip-v').textContent,icon:c.querySelector('svg').innerHTML};});
  ok('wallet: after about 2 s the short address and the copy icon return', back.txt===wl.text&&back.icon===wl.icon, back.txt);
  await pg.locator('details.help summary').scrollIntoViewIfNeeded(); await pg.locator('details.help summary').tap(); await pg.waitForTimeout(300);
  await pg.locator('details.help [data-copy]').scrollIntoViewIfNeeded(); await pg.locator('details.help [data-copy]').tap(); await pg.waitForTimeout(300);
  const toast2=await pg.locator('.toast').innerText().catch(()=>'');
  ok('wallet: the contract address copy keeps its warning toast', await pg.locator('.toast').count()===1 && toast2===await pg.evaluate(()=>App.t('w.token.copied')), toast2);
  const sc=await pg.evaluate(()=>{const k=document.querySelector('details.help #scan');return k?{txt:k.innerText.trim(),h:k.getBoundingClientRect().height,href:k.getAttribute('href')}:null;});
  ok('wallet: the explorer link ("Kaiascan", 44px) lives in the token info disclosure', !!sc&&sc.txt==='Kaiascan'&&sc.h>=44&&sc.href.endsWith(FULL), JSON.stringify(sc));
  await shot('w1-wallet-token-info');
  // profile: the same chip, and the explorer as an account row
  await pg.goto(B+'profile.html'); await pg.waitForTimeout(700);
  const pSig=await chipSig();
  const pf=await pg.evaluate(()=>{const row=document.querySelector('.prow-addr'),c=row.querySelector('.addr-chip'),k=document.querySelector('.rowlink[href^="https://kaiascan.io/address/"]');const r=row.getBoundingClientRect(),cr=c.getBoundingClientRect();return {full:document.querySelector('#main').innerText.includes('C2b9'),inRow:cr.right<=r.right+1&&cr.left>=r.left,label:c.getAttribute('aria-label'),scan:k?k.innerText.trim():'',want:App.t('w.scan'),scanH:k?k.getBoundingClientRect().height:0,over:document.documentElement.scrollWidth-innerWidth};});
  ok('profile: the address row carries the same short chip as the wallet (same text, size, outline, face) and the Kaiascan row follows', pSig===wSig&&!pf.full&&pf.inRow&&pf.label.includes(FULL)&&pf.scan===pf.want&&pf.scanH>=44&&pf.over<=0, pSig);
  await pg.locator('.prow-addr .addr-chip').tap(); await pg.waitForTimeout(300);
  ok('profile: the chip copies the full address and reads "Copied"', await pg.evaluate(()=>navigator.clipboard.readText())===FULL && await pg.evaluate(()=>document.querySelector('.addr-chip-v').textContent===App.t('w.copy.done')));
  await shot('p1-profile');

  // ---------- 6b. friend invites: open from profile, copy the code, share falls back to copy, the wallet row, first run code field, the gate for an invited visitor
  {
  const CODE='MINJI7Q', LINK='https://app.cojam.app/i/MINJI7Q';
  await pg.evaluate(()=>scrollTo(0,0)); await pg.waitForTimeout(150);
  const pr=await pg.evaluate(()=>{const a=document.querySelector('#to-invite'),r=a.getBoundingClientRect(),tb=document.querySelector('.tb').getBoundingClientRect();return {href:a.getAttribute('href'),h:r.height,first:r.bottom<=tb.top,n:a.querySelector('.inv-row-go [aria-hidden]').textContent};});
  ok('profile: the invite row sits on the first screen, is 44 px or taller and shows the friends who joined', pr.href==='invite.html'&&pr.h>=44&&pr.first&&pr.n==='4', JSON.stringify(pr));
  await pg.locator('#to-invite').tap(); await pg.waitForURL(/invite\.html/); await pg.waitForTimeout(700);
  const iv=await pg.evaluate(()=>{const g=q=>document.querySelector(q),c=g('#code'),v=c.querySelector('.code-v'),cs=getComputedStyle(c),vs=getComputedStyle(v),p=getComputedStyle(g('.inv-pct')),sh=g('#share').getBoundingClientRect(),tb=g('.tb').getBoundingClientRect();
    return {pct:g('.inv-pct').textContent,pff:p.fontFamily,pfs:parseFloat(p.fontSize),code:v.textContent,mono:/mono/i.test(vs.fontFamily),lig:vs.fontVariantLigatures,edge:cs.borderTopWidth+' '+cs.borderTopColor,h:c.getBoundingClientRect().height,link:g('.inv-link').textContent,shareFirst:sh.bottom<=tb.top,
      prim:document.querySelectorAll('#main .btn-primary').length,steps:document.querySelectorAll('.inv-steps li').length,tri:[...document.querySelectorAll('.inv-tri b')].map(b=>b.textContent).join('|'),friends:document.querySelectorAll('.inv-friend').length,rules:document.querySelectorAll('.inv-rules li').length,
      back:g('.ah-back').getAttribute('href'),over:document.documentElement.scrollWidth-innerWidth};});
  ok('invite: "10%" leads in the display numerals; the code is mono with ligatures off inside a 2 px ink outline; one primary action, on the first screen', iv.pct==='10%'&&/Archivo/.test(iv.pff)&&iv.pfs>=72&&iv.code===CODE&&iv.mono&&iv.lig==='none'&&iv.edge==='2px rgb(11, 21, 48)'&&iv.h>=44&&iv.prim===1&&iv.shareFirst&&iv.over<=0, JSON.stringify(iv));
  ok('invite: the link, three steps, three result figures, the friends and the rules are all there; back leads to the profile', iv.link==='app.cojam.app/i/'+CODE&&iv.steps===3&&iv.tri==='4|85P|1,240P'&&iv.friends===4&&iv.rules===4&&iv.back==='profile.html', JSON.stringify(iv));
  await shot('i1-invite');
  await pg.locator('#code').tap(); await pg.waitForTimeout(300);
  const cp=await pg.evaluate(()=>{const c=document.querySelector('#code');return {done:c.classList.contains('is-done'),label:c.querySelector('.code-act span').textContent===App.t('w.copy.done'),code:c.querySelector('.code-v').textContent,bg:getComputedStyle(c).backgroundColor};});
  ok('invite: a tap on the code block copies the code, the label reads "Copied" and the code stays readable', await pg.evaluate(()=>navigator.clipboard.readText())===CODE&&cp.done&&cp.label&&cp.code===CODE, JSON.stringify(cp));
  await shot('i1-invite-copied');
  await pg.waitForTimeout(2100);
  ok('invite: the copied state ends after 2 s', await pg.evaluate(()=>{const c=document.querySelector('#code');return !c.classList.contains('is-done')&&c.querySelector('.code-act span').textContent===App.t('common.copy');}));
  // no system share sheet: the primary button copies the link and says so
  await pg.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true,writable:true});return navigator.clipboard.writeText('x');});
  await pg.locator('#share').tap(); await pg.waitForTimeout(300);
  ok('invite: without navigator.share the primary button copies the invite link and reads "Link copied"', await pg.evaluate(()=>navigator.clipboard.readText())===LINK && await pg.evaluate(()=>document.querySelector('#share span').textContent===App.t('inv.linkcopied')));
  await pg.waitForTimeout(2100);
  ok('invite: the button returns to "Share invite link"', await pg.evaluate(()=>document.querySelector('#share span').textContent===App.t('inv.share')));
  // with a system share sheet: the link and the code go to it
  await pg.evaluate(()=>{navigator.share=d=>{window.__shared=d;return Promise.resolve();};});
  await pg.locator('#share').tap(); await pg.waitForTimeout(400);
  const sd=await pg.evaluate(()=>({d:window.__shared||null,toast:(document.querySelector('#toasts').textContent||'').includes(App.t('inv.shared'))}));
  ok('invite: with navigator.share the link and a text carrying the code go to the share sheet, then "shared" is confirmed', !!sd.d&&sd.d.url===LINK&&sd.d.text.includes(CODE)&&sd.toast, JSON.stringify(sd));
  await pg.evaluate(()=>navigator.clipboard.writeText('x')); await pg.locator('#copylink').tap(); await pg.waitForTimeout(300);
  ok('invite: "Copy link" copies the invite link', await pg.evaluate(()=>navigator.clipboard.readText())===LINK);
  await pg.goto(B+'invite.html?state=empty'); await pg.waitForTimeout(600);
  const ie=await pg.evaluate(()=>({none:!!document.querySelector('.inv-none'),box:document.querySelectorAll('.empty,.inv-tri,.inv-friend').length,steps:document.querySelectorAll('.inv-steps li').length,code:!!document.querySelector('#code')}));
  ok('invite, no friends yet: the offer, the code and the steps carry the page; one plain sentence, no empty box and no zero figures', ie.none&&ie.box===0&&ie.steps===3&&ie.code, JSON.stringify(ie));
  // wallet: the invite bonus row leads to the invite screen and does not move Convert off the first screen
  await pg.goto(B+'wallet.html'); await pg.waitForTimeout(700);
  const wi=await pg.evaluate(()=>{const a=document.querySelector('#to-invite'),cv=document.querySelector('.wconvert .btn').getBoundingClientRect(),tb=document.querySelector('.tb').getBoundingClientRect(),ar=a.getBoundingClientRect();return {href:a.getAttribute('href'),v:a.querySelector('.inv-row-go').textContent,h:ar.height,after:ar.top>=cv.bottom,convertFirst:cv.bottom<=tb.top,over:document.documentElement.scrollWidth-innerWidth};});
  ok('wallet: "Invite bonus this week +85P" is a row to the invite screen, under Convert, and Convert stays on the first screen', wi.href==='invite.html?from=wallet'&&wi.v==='+85P'&&wi.h>=44&&wi.after&&wi.convertFirst&&wi.over<=0, JSON.stringify(wi));
  // results: the invite bonus is its own line under the day's head, not a question row and not a hit chip
  await pg.goto(B+'results.html'); await pg.waitForTimeout(700);
  const ri=await pg.evaluate(()=>{const rows=[...document.querySelectorAll('.rs-inv')];return {n:rows.length,pts:rows.map(r=>r.querySelector('.rs-inv-p').textContent).join('|'),inList:rows.some(r=>r.closest('li,ul')),chip:rows.some(r=>r.querySelector('.rchip')),note:rows.every(r=>r.querySelector('small').textContent===App.t('r.inv.sub',{r:10})),count:document.querySelector('.rs-count').textContent,h:Math.min(...rows.map(r=>r.getBoundingClientRect().height))};});
  ok('results: each day carries its invite bonus as its own line with the ranking note; the day\'s own total is unchanged', ri.n===3&&ri.pts==='+15P|+35P|+35P'&&!ri.inList&&!ri.chip&&ri.note&&ri.count==='+100P'&&ri.h>=44, JSON.stringify(ri));
  // day done for an invited player: the one time welcome bonus beside the day's +100P
  await pg.goto(B+'done.html?state=welcome'); await pg.waitForTimeout(1300);
  const dw=await pg.evaluate(()=>{const f=document.querySelector('#done-fig').getBoundingClientRect(),w=document.querySelector('#done-wel'),wr=w.getBoundingClientRect(),ph=document.querySelector('.ph').getBoundingClientRect();return {fig:document.querySelector('#done-fig').textContent,wel:w.querySelector('b').textContent,tag:w.querySelector('span').textContent===App.t('d.wel.tag'),beside:wr.left>=f.right-2&&wr.right<=ph.right&&wr.top>=ph.top,bg:getComputedStyle(w).backgroundColor,pts:document.querySelector('#pts-val').textContent,st:document.querySelector('#reward').textContent===App.t('d.wel.st',{n:200}),note:!!document.querySelector('.done-welnote')};});
  ok('day done, welcome: "+100P welcome bonus" stands beside the day\'s +100P inside the band, in lime, and the points show both', dw.fig==='+100P'&&dw.wel==='+100P'&&dw.tag&&dw.beside&&dw.bg===LIME&&dw.pts==='1,450P'&&dw.st&&dw.note, JSON.stringify(dw));
  await shot('h3-day-done-welcome');
  // first run: the optional code field accepts a valid code and rejects an unknown one and the player's own
  await pg.goto(B+'first-run.html'); await pg.waitForTimeout(700);
  ok('first run: the code is one optional link on the first panel; the field is closed', await pg.locator('#code-open').isVisible() && !(await pg.locator('#code').isVisible()));
  await pg.locator('#code-open').tap(); await pg.waitForTimeout(250);
  const fc=await pg.evaluate(()=>{const i=document.querySelector('#code'),s=getComputedStyle(i),b=getComputedStyle(i.closest('.field-box'));return {focus:document.activeElement===i,mono:/mono/i.test(s.fontFamily),upper:s.textTransform,lig:s.fontVariantLigatures,edge:b.borderTopWidth+' '+b.borderTopColor,fits:document.documentElement.scrollHeight<=innerHeight,applyOff:document.querySelector('#code-apply').disabled};});
  ok('first run: the open field is focused, mono capitals with ligatures off in a 2 px ink outline, and the panel still fits one screen', fc.focus&&fc.mono&&fc.upper==='uppercase'&&fc.lig==='none'&&fc.edge==='2px rgb(11, 21, 48)'&&fc.fits&&fc.applyOff, JSON.stringify(fc));
  await pg.keyboard.type('kaia-999'); await pg.waitForTimeout(100);
  ok('first run: typing is normalised to capitals without separators', await pg.locator('#code').inputValue()==='KAIA999');
  await pg.locator('#next').tap(); await pg.waitForTimeout(800);
  const fu=await pg.evaluate(()=>({panel:+document.querySelector('[data-panel]:not([hidden])').dataset.panel,err:document.querySelector('#code').closest('.field-box').classList.contains('is-error'),msg:document.querySelector('#code-msg span').textContent===App.t('o.code.unknown'),inv:document.querySelector('#code').getAttribute('aria-invalid'),skip:!!document.querySelector('#code-without'),fits:document.documentElement.scrollHeight<=innerHeight}));
  ok('first run: Next checks a typed code first; an unknown code is rejected, the player stays on the panel and can continue without a code', fu.panel===1&&fu.err&&fu.msg&&fu.inv==='true'&&fu.skip&&fu.fits, JSON.stringify(fu));
  await shot('a2-first-run-code-unknown');
  await pg.locator('#code').fill('SORA52K'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(800);
  ok('first run: the player\'s own code is rejected with its own message', await pg.evaluate(()=>document.querySelector('#code-msg span').textContent===App.t('o.code.own')&&document.querySelector('#code').closest('.field-box').classList.contains('is-error')));
  await pg.locator('#code').fill('minji7q'); await pg.locator('#code-apply').tap(); await pg.waitForTimeout(800);
  const fv=await pg.evaluate(()=>{const i=document.querySelector('#code');return {v:i.value,ok:i.closest('.field-box').classList.contains('is-ok'),ro:i.readOnly,msg:document.querySelector('#code-msg').textContent,btn:document.querySelector('#code-apply').textContent===App.t('o.code.change'),fits:document.documentElement.scrollHeight<=innerHeight};});
  ok('first run: a valid code is accepted: "Invited by minji" with the +100P line, the field locks and offers Change', fv.v==='MINJI7Q'&&fv.ok&&fv.ro&&fv.msg.includes('minji')&&fv.msg.includes('+100P')&&fv.btn&&fv.fits, JSON.stringify(fv));
  await shot('a2-first-run-code-valid');
  await pg.locator('#next').tap(); await pg.waitForTimeout(300);
  ok('first run: with a valid code Next moves on and the code field leaves with the first panel', await pg.evaluate(()=>+document.querySelector('[data-panel]:not([hidden])').dataset.panel===2&&document.querySelector('#codebox').hidden));
  await pg.goto(B+'first-run.html?state=code-unknown'); await pg.waitForTimeout(600);
  await pg.locator('#code-skip').tap(); await pg.waitForTimeout(200);
  ok('first run: Skip clears and closes the code field', await pg.locator('#code-open').isVisible() && await pg.evaluate(()=>document.querySelector('#code').value===''&&document.querySelector('#code-form').hidden));
  // the gate for someone who opened an invite link in a browser
  await pg.goto(B+'gate.html?state=invited'); await pg.waitForTimeout(800);
  const gi=await pg.evaluate(()=>{const p=document.querySelector('#panel'),c=p.querySelector('.code-block'),st=p.querySelector('.steps'),r=c.getBoundingClientRect();return {h:p.querySelector('h2').textContent===App.t('g.inv.h',{name:'minji'}),code:c.querySelector('.code-v').textContent,above:r.bottom<=st.getBoundingClientRect().top,first:r.bottom<=innerHeight,steps:st.children.length,body:p.textContent.includes(App.t('g.inv.b')),over:document.documentElement.scrollWidth-innerWidth};});
  ok('gate, invited: "minji invited you", the code block on the first screen above the install steps', gi.h&&gi.code===CODE&&gi.above&&gi.first&&gi.steps===3&&gi.body&&gi.over<=0, JSON.stringify(gi));
  await pg.evaluate(()=>navigator.clipboard.writeText('x')); await pg.locator('#inv-code').tap(); await pg.waitForTimeout(300);
  ok('gate, invited: a tap copies the code and the block reads "Copied"', await pg.evaluate(()=>navigator.clipboard.readText())===CODE && await pg.evaluate(()=>document.querySelector('#inv-code').classList.contains('is-done')));
  await shot('g1-gate-invited');
  }
  await pg.goto(B+'wallet.html'); await pg.waitForTimeout(600);


  // ---------- 7. tab bar, stakes, offline, leaving inside the undo window
  const tb=await pg.evaluate(()=>{const lime='rgb(214, 255, 61)';const cur=document.querySelector('.tb a[aria-current="page"]'),other=document.querySelector('.tb a:not([aria-current])');const s=getComputedStyle(cur),o=getComputedStyle(other);
    return {lime:[...document.querySelectorAll('.tb *')].filter(e=>getComputedStyle(e).backgroundColor===lime).length,curCol:s.color,curW:s.fontWeight,othCol:o.color,othW:o.fontWeight,filled:!!cur.querySelector('svg [fill="currentColor"]'),othFilled:!!other.querySelector('svg [fill="currentColor"]'),target:[...document.querySelectorAll('.tb a')].every(a=>{const r=a.getBoundingClientRect();return r.width>=44&&r.height>=44;}),badge:document.querySelectorAll('.tb .tb-n, .tb .tb-dot').length};});
  ok('tab bar: no lime pill; the current tab is ink with a filled icon and a heavy label, the others muted; 44px targets and the badges stay', tb.lime===0&&tb.curCol==='rgb(11, 21, 48)'&&+tb.curW>=800&&tb.othCol==='rgb(74, 86, 114)'&&+tb.othW<=500&&tb.filled&&!tb.othFilled&&tb.target&&tb.badge>=1, JSON.stringify(tb));
  await pg.goto(B+'stakes.html'); await pg.waitForTimeout(700);
  const wd=await pg.evaluate(()=>{const b=document.querySelector('[data-wd]');const n=parseFloat(b.innerText.replace(/[^\d.]/g,''));return {txt:b.innerText.trim(),n,line:b.parentNode.querySelector('p').innerText.trim()};});
  ok('my stakes: the withdraw button states the full amount that leaves (principal plus interest)', wd.n>500&&wd.n<520&&/500/.test(wd.line), wd.txt+' | '+wd.line);
  await shot('s2-my-stakes');
  await pg.goto(B+'home-cards.html?state=offline'); await pg.waitForTimeout(900);
  const of=await pg.evaluate(()=>[...document.querySelectorAll('.qcard[data-pos="0"] .choice')].map(e=>{const s=getComputedStyle(e);return e.getAttribute('aria-disabled')+'|'+e.disabled+'|'+s.backgroundColor+'|'+s.boxShadow;}));
  ok('offline: both answers look switched off (mist, no drop) but are not removed from the tap', of.length===2&&of.every(x=>x==='true|false|rgb(238, 242, 249)|none'), of[0]);
  await pg.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap({force:true}); await pg.waitForTimeout(400);
  const ot=await pg.locator('.toast').innerText().catch(()=>'');
  ok('offline: a tap on an answer says why and picks nothing', ot===await pg.evaluate(()=>App.t('h.offline')) && await cnt()===2 && await front()===3, ot);
  await shot('h1-offline-tap');
  const ctx2=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true}); const p2=await ctx2.newPage(); p2.on('pageerror',e=>errs.push(e.message));
  await p2.goto(B+'home-cards.html?state=fresh'+(lang==='en'?'':'&lang='+lang)); await p2.waitForTimeout(3000);
  ok('home: "?state=fresh" resets the day once and is dropped from the address (Back never resets again)', !/state=fresh/.test(p2.url()) && /home-cards\.html/.test(p2.url()) && await p2.evaluate(()=>+document.querySelector('#cnt').textContent===0), p2.url());
  await p2.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap(); await p2.waitForTimeout(500);
  await p2.goto(B+'ranking.html'); await p2.waitForTimeout(400); await p2.goto(B+'home-cards.html'); await p2.waitForTimeout(900);
  const lv=await p2.evaluate(()=>({toast:(document.querySelector('.toast')||{}).innerText||'',want:App.t('h.left.saved'),cnt:+document.querySelector('#cnt').textContent,front:+document.querySelector('.qcard[data-pos="0"]').dataset.q,done:document.querySelectorAll('#day5 .is-done').length,undo:!!document.querySelector('#undo')}));
  ok('leaving home inside the undo window: the pick is sent at once and home says "Pick saved" on return, state consistent', lv.toast.trim()===lv.want&&lv.cnt===1&&lv.front===2&&lv.done===1&&!lv.undo, JSON.stringify(lv));
  if(OUT) await p2.screenshot({path:`${OUT}/v7-h1-pick-saved-on-return-${lang}-${W}.png`});
  // "Finish now": four picks, then the fifth, then the button ends the wait
  for(let i=0;i<4;i++){ await p2.waitForTimeout(350); await p2.locator('.qcard[data-pos="0"] .choice[data-dir="r"]').tap(); }
  await p2.waitForTimeout(500); const f0=Date.now(); await p2.locator('#finish').tap(); await p2.waitForURL(/done\.html/,{timeout:5000}).catch(()=>{});
  ok('"Finish now" ends the wait: the day done screen opens in under 1.5 s', /done\.html/.test(p2.url()) && Date.now()-f0<1500, (Date.now()-f0)+' ms');
  await ctx2.close();

  // ---------- 8. account on hold: home has the panel and no answers, wallet Convert is off and Withdraw works, a claim states the fee
  await pg.goto(B+'home-cards.html?state=hold'); await pg.waitForTimeout(700);
  const hh=await pg.evaluate(()=>({panel:!!document.querySelector('.empty #hold-more'),href:(document.querySelector('#hold-more')||{}).getAttribute&&document.querySelector('#hold-more').getAttribute('href'),answers:document.querySelectorAll('.choice').length,deck:!!document.querySelector('#deck'),dead:document.querySelectorAll('#main button[disabled], #main [aria-disabled="true"]').length}));
  ok('on hold, home (cards): the panel replaces the deck, links to the explanation, no answer buttons and nothing dead', hh.panel&&/system\.html\?state=blocked/.test(hh.href)&&hh.answers===0&&!hh.deck&&hh.dead===0, JSON.stringify(hh));
  await shot('h1-hold');
  await pg.goto(B+'home-terminal.html?state=hold'); await pg.waitForTimeout(600);
  ok('on hold, home (list): the same panel, no answer buttons and no pick buttons', await pg.evaluate(()=>!!document.querySelector('.empty #hold-more')&&!document.querySelector('.choice, [data-open], #term')));
  await pg.goto(B+'wallet.html?state=hold'); await pg.waitForTimeout(700);
  const hw=await pg.evaluate(()=>({banner:!!document.querySelector('.hold .hold-more'),conv:document.querySelector('#convert').disabled,why:(document.querySelector('#convert-why')||{}).innerText||'',want:App.t('hold.convert.reason'),ct:document.querySelector('#ct-fig').innerText,kaia:/KAIA/.test(document.querySelector('.list').innerText),wd:document.querySelector('#wd').tagName}));
  ok('on hold, wallet: the notice shows, balances stay, Convert is disabled with its reason, Withdraw is a live link', hw.banner&&hw.conv&&hw.why.trim()===hw.want&&/\d,\d{3}\.5\s*CT/.test(hw.ct)&&hw.kaia&&hw.wd==='A', JSON.stringify(hw));
  const hb=await pg.evaluate(()=>{const e=document.querySelector('.hold'),s=getComputedStyle(e);return s.backgroundColor+'|'+s.boxShadow;});
  ok('on hold: the notice is the round\'s alert style (white ground, 2 px ink outline)', /^rgb\(255, 255, 255\)\|/.test(hb)&&/rgb\(11, 21, 48\) 0px 0px 0px 2px inset/.test(hb), hb);
  await shot('w1-hold');
  await pg.locator('#wd').tap(); await pg.waitForURL(/withdraw\.html/,{timeout:4000}).catch(()=>{}); await pg.waitForTimeout(500);
  ok('on hold, wallet: Withdraw opens the withdraw screen, which says the fee is paid in KAIA', /withdraw\.html/.test(pg.url()) && await pg.evaluate(()=>document.querySelector('.lead').innerText.trim()===App.t('x.gas')&&!document.querySelector('#to').disabled));
  await pg.goto(B+'stakes.html?state=hold'); await pg.waitForTimeout(700);
  const hs=await pg.evaluate(()=>({claim:!document.querySelector('[data-claim]').disabled,wd:!document.querySelector('[data-wd]').disabled,lines:document.querySelectorAll('[data-fee-line]').length,line:document.querySelector('[data-fee-line]').innerText,want:App.t('hold.fee.line')}));
  ok('on hold, my stakes: claim and withdraw are live and each says "You pay the network fee in KAIA"', hs.claim&&hs.wd&&hs.lines===2&&hs.line.includes(hs.want), JSON.stringify(hs));
  await pg.locator('[data-claim]').tap(); await pg.waitForTimeout(500);
  const hn=await pg.evaluate(()=>({open:document.querySelector('#sheet-root').classList.contains('is-open'),note:(document.querySelector('#tx-note')||{}).innerText||'',want:App.t('hold.fee.rv'),rows:document.querySelector('#sheet .rows').innerText,confirm:!!document.querySelector('#tx-confirm:not([disabled])')}));
  ok('on hold, my stakes: Claim opens a review with the fee note, the fee and the KAIA balance before anything is sent', hn.open&&hn.note.includes(hn.want)&&/0\.0021/.test(hn.rows)&&/2\.4 KAIA/.test(hn.rows)&&hn.confirm, JSON.stringify(hn));
  await shot('s2-hold-claim-fee');
  await pg.goto(B+'stakes.html?state=hold-nokaia'); await pg.waitForTimeout(600);
  ok('on hold with too little KAIA: claim and withdraw are off and the note states the amount needed and links to the deposit screen', await pg.evaluate(()=>document.querySelector('[data-claim]').disabled&&document.querySelector('[data-wd]').disabled&&/0\.0021/.test(document.querySelector('.note').innerText)&&/deposit\.html/.test(document.querySelector('#get-kaia').getAttribute('href'))));
  await pg.goto(B+'system.html?state=blocked'); await pg.waitForTimeout(500);
  ok('account on hold screen: the support address is a mail link and is visible to copy', await pg.evaluate(()=>document.querySelector('#contact').getAttribute('href')==='mailto:help@cojam.app'&&document.querySelector('#mail-copy').innerText.trim()==='help@cojam.app'&&document.querySelector('#mail-copy').getAttribute('data-copy')==='help@cojam.app'));
  await pg.goto(B+'gate.html?state=invited-inapp'); await pg.waitForTimeout(500);
  ok('gate from an invite link (in-app browser): "Copy link" copies the invite link, not the plain app address', await pg.evaluate(()=>document.querySelector('#copylink').getAttribute('data-copy')===MOCK.invite.link&&MOCK.invite.link!==MOCK.appUrl));

  ok('no page errors', errs.length===0, errs.join(' | '));
  await b.close();
  const fails=res.filter(r=>r[0]==='FAIL');
  for(const r of res) console.log(r[0],r[1],r[2]?('['+r[2]+']'):'');
  console.log(`\n${lang} ${W}x${H}: ${res.length-fails.length}/${res.length} passed`);
  process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);for(const r of res) console.log(r[0],r[1],r[2]);process.exit(2)});
