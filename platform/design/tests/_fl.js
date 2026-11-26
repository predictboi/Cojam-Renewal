const {chromium}=require('playwright');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const pg=await ctx.newPage();const cdp=await ctx.newCDPSession(pg);
const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
const cnt=()=>pg.evaluate(()=>+document.querySelector('#cnt').textContent);
await pg.goto('http://localhost:8841/home-cards.html?state=fresh');await pg.waitForTimeout(3200);
await pg.evaluate(()=>{window.__l=[];for(const t of ['pointerdown','pointermove','pointerup','pointercancel','click'])document.addEventListener(t,e=>__l.push([t,Math.round(e.clientX),Math.round(e.timeStamp),e.target.className]),true);});
const yes=await pg.evaluate(()=>{const r=document.querySelector('.qcard[data-pos="0"] .choice[data-dir="r"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
await pg.touchscreen.tap(yes.x,yes.y); await sleep(120); await pg.touchscreen.tap(yes.x,yes.y); await sleep(100);
for(let i=0;i<4;i++){ await pg.touchscreen.tap(yes.x,yes.y); await sleep(60); }
console.log('cnt',await cnt());
while(await cnt()>1){ await pg.locator('#undo').tap(); await sleep(450); }
await sleep(450);await pg.evaluate(()=>{__l=[]});
const x0=195,y0=350,dx=-90,steps=3;await touch('touchStart',x0,y0);for(let i=1;i<=steps;i++){await touch('touchMove',x0+dx*i/steps,y0);await sleep(6);}await touch('touchEnd');await sleep(500);
console.log('cnt',await cnt(),JSON.stringify(await pg.evaluate(()=>__l)));
await b.close();})();
