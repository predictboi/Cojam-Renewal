// Reusable screen recorder: Playwright Chromium + CDP screencast -> CFR H.264 clip + events.json
// usage: node rec.js <scene.js>   (scene module exports { id, url, setup?(page), run(api) })
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const V = path.resolve(__dirname, '..');
const P = path.resolve(V, '../export/unslop-review');
const FPS = 30, W = 858, H = 1408;

function sceneDur(id) {
  const t = JSON.parse(fs.readFileSync(path.join(V, 'timeline.json'), 'utf8'));
  const s = t.scenes.find(x => x.id === id);
  if (!s) throw new Error('scene not in timeline: ' + id);
  return { dur: +(s.dur - 0.3).toFixed(3), lines: s.lines };
}

// injected in every page before its scripts: tap ring, hover ring, pulse, smooth scroll, Jupiter scrub, fade
const INIT = `
(function(){
  var css = \`
  .__tap{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2.5px solid rgba(255,255,255,.95);
    box-shadow:0 0 0 1px rgba(0,0,0,.25),0 2px 10px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;
    display:flex;align-items:center;justify-content:center;animation:__tapA 450ms ease-out forwards}
  .__tap i{width:16px;height:16px;border-radius:50%;background:#7ce85c;display:block}
  @keyframes __tapA{0%{transform:scale(.45);opacity:0}25%{transform:scale(1);opacity:1}100%{transform:scale(1.25);opacity:0}}
  .__hov{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2.5px solid rgba(255,255,255,.9);
    box-shadow:0 0 0 1px rgba(0,0,0,.25),0 2px 10px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;opacity:0;
    display:flex;align-items:center;justify-content:center;transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1),opacity .25s}
  .__hov i{width:14px;height:14px;border-radius:50%;background:#7ce85c;opacity:.85;display:block}
  .__hov.on{opacity:1}
  .__pulse{outline:2px solid rgba(124,232,92,.0);outline-offset:2px;animation:__pulseA 1.2s ease-in-out 2;border-radius:12px}
  @keyframes __pulseA{0%{outline-color:rgba(124,232,92,0);box-shadow:0 0 0 0 rgba(124,232,92,0)}45%{outline-color:rgba(124,232,92,.95);box-shadow:0 0 0 6px rgba(124,232,92,.16)}100%{outline-color:rgba(124,232,92,0);box-shadow:0 0 0 0 rgba(124,232,92,0)}}
  .__fade{position:fixed;inset:0;background:#0c0d10;z-index:2147483646;pointer-events:none;opacity:0;transition:opacity .28s ease}
  .__fade.on{opacity:1}
  ::-webkit-scrollbar{display:none} *{scrollbar-width:none}
  \`;
  function addCss(){ if(document.getElementById('__recCss')) return; var s=document.createElement('style'); s.id='__recCss'; s.textContent=css; (document.head||document.documentElement).appendChild(s); }
  window.__tap=function(x,y){ addCss(); var d=document.createElement('div'); d.className='__tap'; d.innerHTML='<i></i>'; d.style.left=x+'px'; d.style.top=y+'px'; document.body.appendChild(d); setTimeout(function(){ d.remove(); },520); };
  window.__hover=function(x,y){ addCss(); var d=document.getElementById('__hov'); if(!d){ d=document.createElement('div'); d.id='__hov'; d.className='__hov'; d.innerHTML='<i></i>'; d.style.left=x+'px'; d.style.top=y+'px'; document.body.appendChild(d); void d.offsetWidth; }
    if(!d.classList.contains('on')){ d.style.transition='none'; d.style.left=x+'px'; d.style.top=y+'px'; void d.offsetWidth; d.style.transition=''; }
    d.style.left=x+'px'; d.style.top=y+'px'; d.classList.add('on'); };
  window.__hoverOff=function(){ var d=document.getElementById('__hov'); if(d) d.classList.remove('on'); };
  window.__pulse=function(sel){ addCss(); var el=typeof sel==='string'?document.querySelector(sel):sel; if(!el) return; el.classList.remove('__pulse'); void el.offsetWidth; el.classList.add('__pulse'); setTimeout(function(){ el.classList.remove('__pulse'); },2500); };
  window.__fade=function(on){ addCss(); var d=document.getElementById('__fade'); if(!d){ d=document.createElement('div'); d.id='__fade'; d.className='__fade'; document.body.appendChild(d); void d.offsetWidth; } d.classList.toggle('on',!!on); };
  function ease(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
  // smooth scroll of window (el null) or a scrollable element to absolute y
  window.__scroll=function(el,y,ms){ return new Promise(function(res){
    var tgt = el ? (typeof el==='string'?document.querySelector(el):el) : null;
    var get=function(){ return tgt ? tgt.scrollTop : window.scrollY; };
    var set=function(v){ if(tgt) tgt.scrollTop=v; else window.scrollTo(0,v); };
    var max = tgt ? tgt.scrollHeight-tgt.clientHeight : document.documentElement.scrollHeight-window.innerHeight;
    var from=get(), to=Math.max(0,Math.min(max,y)), t0=performance.now();
    document.documentElement.style.scrollBehavior='auto'; if(tgt) tgt.style.scrollBehavior='auto';
    function f(now){ var k=Math.min(1,(now-t0)/ms); set(from+(to-from)*ease(k)); if(k<1) requestAnimationFrame(f); else res(to); }
    requestAnimationFrame(f);
  }); };
  // scrub Jupiter text everywhere
  function scrub(root){
    var w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT,null), n, list=[];
    while((n=w.nextNode())) if(n.nodeValue.indexOf('Jupiter')>=0) list.push(n);
    list.forEach(function(n){ n.nodeValue=n.nodeValue.replace(/Swaps run through Jupiter\\.?/g,'Swaps use the best route.').replace(/Jupiter\\s*·\\s*best price/g,'Best price').replace(/Jupiter/g,'Best route'); });
  }
  window.__scrub=scrub;
  document.addEventListener('DOMContentLoaded',function(){ addCss(); scrub(); new MutationObserver(function(){ scrub(); }).observe(document.body,{subtree:true,childList:true,characterData:true}); });
})();
`;

async function main() {
  const sceneFile = path.resolve(process.argv[2]);
  const scene = require(sceneFile);
  const { dur, lines } = sceneDur(scene.id);
  const outDir = path.join(V, 'clips');
  fs.mkdirSync(outDir, { recursive: true });
  const work = path.join(__dirname, 'work', scene.id);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 640 }, deviceScaleFactor: 2.2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  await ctx.route('**/*', r => r.request().url().startsWith('file:') || r.request().url().startsWith('data:') ? r.continue() : r.abort());
  await ctx.addInitScript(INIT);
  if (scene.initScript) await ctx.addInitScript(scene.initScript);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });

  await page.goto(scene.url, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  if (scene.setup) await scene.setup(page);
  await page.waitForTimeout(500);

  const cdp = await ctx.newCDPSession(page);
  const frames = []; // {ts, file}
  let fi = 0;
  cdp.on('Page.screencastFrame', async f => {
    const file = path.join(work, String(fi++).padStart(5, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ ts: f.metadata.timestamp, file });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const events = [];
  const now = () => Date.now() / 1000 - t0;
  const log = (type, label) => { events.push({ t: +now().toFixed(3), type, label }); console.log(now().toFixed(2), type, label); };

  async function box(sel) {
    const b = await page.evaluate(s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; }, sel);
    if (!b) throw new Error('no element ' + sel);
    return b;
  }
  const api = {
    page, P, V, dur, lines, now, log,
    at: async t => { const d = t - now(); if (d > 0) await page.waitForTimeout(d * 1000); else if (d < -0.15) console.warn(`  late by ${(-d).toFixed(2)}s for t=${t}`); },
    wait: ms => page.waitForTimeout(ms),
    box,
    tap: async (target, label, opts = {}) => {
      const p = typeof target === 'string' ? await box(target) : target;
      const x = p.x + (opts.dx || 0), y = p.y + (opts.dy || 0);
      if (y < 0 || y > 640) console.warn('  tap off screen', target, y);
      await page.evaluate(([x, y]) => { window.__hoverOff(); window.__tap(x, y); }, [x, y]);
      log('tap', label || String(target));
      await page.waitForTimeout(110);
      await page.mouse.click(x, y);
    },
    hover: async (target, label) => {
      const p = typeof target === 'string' ? await box(target) : target;
      await page.mouse.move(p.x, p.y);
      await page.evaluate(([x, y]) => window.__hover(x, y), [p.x + 30, p.y]);
    },
    hoverOff: () => page.evaluate(() => window.__hoverOff()),
    pulse: (sel) => page.evaluate(s => window.__pulse(s), sel),
    type: async (text, label, delay = 90) => { log('type', label || text); await page.keyboard.type(text, { delay }); },
    // smooth scroll window so that element top sits at `offset` px from viewport top
    scrollTo: async (sel, offset = 80, ms = 900, el = null) => {
      const y = await page.evaluate(([s, off, el]) => { const e = document.querySelector(s); const r = e.getBoundingClientRect();
        if (el) { const c = document.querySelector(el); return c.scrollTop + r.top - c.getBoundingClientRect().top - off; }
        return window.scrollY + r.top - off; }, [sel, offset, el]);
      log('scroll', sel);
      await page.evaluate(([el, y, ms]) => window.__scroll(el, y, ms), [el, y, ms]);
    },
    scrollY: async (y, ms = 900, el = null) => { log('scroll', String(y)); await page.evaluate(([el, y, ms]) => window.__scroll(el, y, ms), [el, y, ms]); },
    js: (fn, arg) => page.evaluate(fn, arg),
    success: label => log('success', label),
    goto: async (url, after) => {
      await page.evaluate(() => window.__fade(true));
      await page.waitForTimeout(300);
      await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const d = document.createElement('div'); d.id = '__fade'; d.className = '__fade on'; document.body.appendChild(d); }); });
      await page.goto(url, { waitUntil: 'load' });
      if (after) await after(page);
      await page.waitForTimeout(150);
      await page.evaluate(() => window.__fade(false));
      await page.waitForTimeout(300);
    },
  };

  await api.wait(200);
  try { await scene.run(api); } catch (e) { console.error('scene error', e); }
  await api.at(dur + 0.2);
  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(200);
  await browser.close();

  // build CFR clip: for output frame i at time i/FPS pick latest frame with ts <= t0 + i/FPS
  frames.sort((a, b) => a.ts - b.ts);
  fs.writeFileSync(path.join(work, 'ts.json'), JSON.stringify(frames.map(f => +(f.ts - t0).toFixed(3))));
  const N = Math.round(dur * FPS);
  const picks = [];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const t = t0 + i / FPS;
    while (j + 1 < frames.length && frames[j + 1].ts <= t) j++;
    picks.push(frames[j].file);
  }
  // merge runs into concat entries
  let list = 'ffconcat version 1.0\n', run = 1;
  for (let i = 0; i < N; i++) {
    if (i + 1 < N && picks[i + 1] === picks[i]) { run++; continue; }
    list += `file '${picks[i]}'\nduration ${(run / FPS).toFixed(6)}\n`;
    run = 1;
  }
  list += `file '${picks[N - 1]}'\n`;
  fs.writeFileSync(path.join(work, 'list.txt'), list);
  const out = path.join(outDir, scene.id + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(work, 'list.txt'),
    '-vf', `scale=${W}:${H}:flags=lanczos,setsar=1,format=yuv420p`, '-fps_mode', 'cfr', '-r', String(FPS), '-frames:v', String(N),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out]);
  fs.writeFileSync(path.join(outDir, scene.id + '.events.json'), JSON.stringify(events.filter(e => e.t <= dur), null, 1));
  const uniq = new Set(picks).size;
  const gaps = []; for (let k = 1; k < frames.length; k++) gaps.push([+(frames[k].ts - frames[k - 1].ts).toFixed(3), +(frames[k - 1].ts - t0).toFixed(2)]);
  gaps.sort((a, b) => b[0] - a[0]); console.log('largest frame gaps [gap, at]:', JSON.stringify(gaps.slice(0, 8)));
  console.log(`wrote ${out}: ${N} frames (${dur}s), ${frames.length} captured, ${uniq} unique used`);
}
main().catch(e => { console.error(e); process.exit(1); });
