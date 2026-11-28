// node scripts/shot.js <file.html[?query]> <out.png> <width> <height> [--full] [--mobile] [--css a.css]... [--jsfile a.js]... [--js "code"] [--clip x,y,w,h] [--wait ms]
// Order: page loads -> every --css is added -> every --jsfile runs in order -> --js runs -> capture.
const {chromium}=require('playwright');
const path=require('path'), fs=require('fs');
(async()=>{
  const a=process.argv.slice(2); const [file,out,w,h]=a; const full=a.includes('--full'); const mobile=a.includes('--mobile');
  const multi=k=>a.map((v,i)=>v===k?a[i+1]:null).filter(Boolean);
  const one=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:+w,height:+h},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const [f,q]=file.split('?'); await pg.goto(/^https?:/.test(f)?file:'file://'+path.resolve(f)+(q?'?'+q:'')); await pg.waitForTimeout(700);
  await pg.evaluate(()=>{ if(typeof window.revealAll==='function') window.revealAll(); document.querySelectorAll('[data-reveal],.rv,.reveal').forEach(e=>e.classList.add('in','is-in','visible')); }); // scroll reveal never hides content in a capture
  for(const c of multi('--css')) await pg.addStyleTag({content:fs.readFileSync(c,'utf8')});
  for(const c of (process.env.KIT_EXTRA_CSS||'').split(':').filter(Boolean)) await pg.addStyleTag({content:fs.readFileSync(c,'utf8')}); // appended last, used for the shared shell
  for(const j of multi('--jsfile')){ await pg.addScriptTag({content:fs.readFileSync(j,'utf8')}); await pg.waitForTimeout(150); }
  for(const j of (process.env.KIT_EXTRA_JS||'').split(':').filter(Boolean)){ await pg.addScriptTag({content:fs.readFileSync(j,'utf8')}); await pg.waitForTimeout(100); } // appended last, used for the shared shell
  const js=one('--js'); if(js){ await pg.evaluate(js); }
  await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(+(one('--wait')||500));
  const clip=one('--clip'); const o={path:out,fullPage:full}; if(clip){ const [x,y,cw,ch]=clip.split(',').map(Number); o.clip={x,y,width:cw,height:ch}; o.fullPage=false; }
  // Full page on a touch profile: Chromium's own full page capture drops the touch media emulation (hover: none, pointer: coarse)
  // and leaves sticky bars at the first screen's bottom edge, so grow the viewport to the page height and capture that instead.
  if(o.fullPage&&mobile){ const H=await pg.evaluate(()=>document.documentElement.scrollHeight); await pg.setViewportSize({width:+w,height:H}); await pg.waitForTimeout(300); o.fullPage=false; }
  await pg.screenshot(o); await b.close();
  console.log('saved',out, errs.length?('pageerrors: '+errs.join(' | ')):'');
})();
