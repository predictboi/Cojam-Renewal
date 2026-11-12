// node tools/design/audit.js <file.html[?query]> <width> <height> [--mobile] [--css a.css]... [--jsfile a.js]... [--js "code"]
// Same loading order as shot.js. Prints a design audit of the rendered page: monospace misuse, where the accent (AUDIT_ACCENT, default #124CC4) is used,
// text under 4.5:1, mobile targets under 44px, horizontal overflow. Use it to verify fixes; it is a helper, not the judge.
const {chromium}=require('playwright');
const path=require('path'), fs=require('fs');
(async()=>{
  const a=process.argv.slice(2); const [file,w,h]=a; const mobile=a.includes('--mobile');
  const multi=k=>a.map((v,i)=>v===k?a[i+1]:null).filter(Boolean); const one=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:+w,height:+h},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const [f,q]=file.split('?'); await pg.goto(/^https?:/.test(f)?file:'file://'+path.resolve(f)+(q?'?'+q:'')); await pg.waitForTimeout(700);
  for(const c of multi('--css')) await pg.addStyleTag({content:fs.readFileSync(c,'utf8')});
  for(const c of (process.env.CJ_EXTRA_CSS||'').split(':').filter(Boolean)) await pg.addStyleTag({content:fs.readFileSync(c,'utf8')}); // appended last, used for the shared shell
  for(const j of multi('--jsfile')){ await pg.addScriptTag({content:fs.readFileSync(j,'utf8')}); await pg.waitForTimeout(150); }
  for(const j of (process.env.CJ_EXTRA_JS||'').split(':').filter(Boolean)){ await pg.addScriptTag({content:fs.readFileSync(j,'utf8')}); await pg.waitForTimeout(100); } // appended last, used for the shared shell
  const js=one('--js'); if(js) await pg.evaluate(js);
  await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(500);
  const AC=(process.env.AUDIT_ACCENT||'#124CC4').replace('#','').match(/../g).map(h=>parseInt(h,16));
  const r=await pg.evaluate(([mobile,AC])=>{
    const vis=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>1&&r.height>1&&s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05};
    const own=el=>[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').replace(/\s+/g,' ').trim();
    const id=el=>el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,3).join('.'):'');
    const rgb=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}};
    const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
    const over=(t,u)=>({r:t.r*t.a+u.r*(1-t.a),g:t.g*t.a+u.g*(1-t.a),b:t.b*t.a+u.b*(1-t.a),a:1});
    const bgOf=el=>{let stack=[],e=el;while(e&&e.nodeType===1){const c=rgb(getComputedStyle(e).backgroundColor);if(c&&c.a>0){stack.push(c);if(c.a>=1)break}e=e.parentElement}let base={r:18,g:18,b:19,a:1};for(let i=stack.length-1;i>=0;i--)base=over(stack[i],base);return base};
    const isLime=c=>c&&c.a>.5&&Math.abs(c.r-AC[0])<14&&Math.abs(c.g-AC[1])<14&&Math.abs(c.b-AC[2])<14;
    const out={mono:[],lime:[],contrast:[],targets:[],overflow:document.documentElement.scrollWidth-innerWidth};
    const seen=new Set();
    document.querySelectorAll('body *').forEach(el=>{
      if(!vis(el)||el.closest('svg'))return; const s=getComputedStyle(el); const t=own(el);
      if(t){
        const fs=parseFloat(s.fontSize); const mono=/mono/i.test(s.fontFamily.split(',')[0]);
        if(mono){ const words=/[A-Za-z]{3,}/.test(t.replace(/USDC|USDP|USDT|SOL|BONK|pUSD|WIF|JUP/g,'')); const inTable=!!el.closest('table,[role="table"],[role="row"]');
          if(words||fs>=20||(!inTable&&!/^[\s\d$¢%+\-−.,:KMB<>≈/a-z]*$/.test(t))) out.mono.push(id(el)+' "'+t.slice(0,40)+'" '+fs+'px'+(words?' words':'')+(fs>=20?' display':'')); }
        const fg=rgb(s.color); if(fg){ const bg=bgOf(el); const f2=over(fg,bg); const L1=lum(f2),L2=lum(bg); const cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
          let op=1,e=el;while(e&&e.nodeType===1){op*=+getComputedStyle(e).opacity;e=e.parentElement}
          const eff=op<1?((Math.max(lum(over({...f2,a:op},bg)),L2)+.05)/(Math.min(lum(over({...f2,a:op},bg)),L2)+.05)):cr;
          if(eff<4.5){const k=id(el)+'|'+eff.toFixed(1); if(!seen.has(k)){seen.add(k); out.contrast.push(id(el)+' "'+t.slice(0,30)+'" '+eff.toFixed(2)+(op<1?' (opacity '+op.toFixed(2)+')':''))}} }
        if(isLime(rgb(s.color))) out.lime.push('text '+id(el)+' "'+t.slice(0,30)+'"');
      }
      if(isLime(rgb(s.backgroundColor))) out.lime.push('fill '+id(el)+' "'+(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,30)+'" '+Math.round(el.getBoundingClientRect().width)+'x'+Math.round(el.getBoundingClientRect().height));
      if(parseFloat(s.borderTopWidth)>0&&isLime(rgb(s.borderTopColor))) out.lime.push('border '+id(el));
      if(mobile&&el.matches('a,button,input,select,[role="button"],[role="tab"]')){const r=el.getBoundingClientRect(); if(r.height<43.5&&r.top<document.documentElement.scrollHeight) out.targets.push(id(el)+' "'+(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,24)+'" '+Math.round(r.width)+'x'+Math.round(r.height))}
    });
    return out; }, [mobile,AC]);
  await b.close();
  const show=(n,l,max=40)=>{console.log('\n'+n+': '+l.length); l.slice(0,max).forEach(x=>console.log('  '+x)); if(l.length>max)console.log('  ... '+(l.length-max)+' more')};
  console.log('overflow px: '+r.overflow+(errs.length?'  pageerrors: '+errs.join(' | '):''));
  show('MONO misuse (words, display size, or labels outside tables)',r.mono); show('ACCENT used (must be only the primary action and the current selection)',r.lime);
  show('CONTRAST under 4.5:1',r.contrast); if(mobile) show('TARGETS under 44px tall',r.targets);
})();
