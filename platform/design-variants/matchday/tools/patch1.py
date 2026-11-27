# One-off edit script used during the build (round 1 fixes). Kept for the record; running it again changes nothing.
import os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))

def sub(path, pairs):
    s = open(path).read()
    for a, b in pairs:
        if a in s:
            s = s.replace(a, b)
    open(path, 'w').write(s)

sub('components.css', [
    ('.fx[data-pos="1"] > *, .fx[data-pos="2"] > * { opacity: .0; }', '.fx[data-pos="1"] > *, .fx[data-pos="2"] > * { visibility: hidden; }'),
    ('.fx.settle > * { transition: opacity var(--t-mid) linear; }', '.fx.settle[data-pos="0"] > :not(.fx-wipe) { animation: fadein var(--t-mid) linear both; }\n.fx.settle .fx-wipe { transition: transform var(--t-mid) var(--e-out), opacity var(--t-mid) linear; }'),
    ('pointer-events: none; opacity: 0; will-change: transform, opacity; z-index: 3; }', 'pointer-events: none; opacity: 0; visibility: hidden; will-change: transform, opacity; z-index: 3; }\n.fx-wipe.show { visibility: visible; }'),
    ('@keyframes rise {', '@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }\n@keyframes rise {'),
])
css = open('components.css').read()
if '.cb {' not in css:
    css += """.cb { position: relative; width: 44px; height: 44px; flex: none; display: grid; place-items: center; margin: -8px 0 0 -10px; }
.cb input { position: absolute; inset: 0; width: 44px; height: 44px; margin: 0; opacity: 0; cursor: pointer; }
.cb i { width: 24px; height: 24px; box-shadow: inset 0 0 0 2px var(--ink); border-radius: 2px; display: grid; place-items: center; color: var(--kit); }
.cb i svg { width: 18px; height: 18px; opacity: 0; }
.cb input:checked + i { background: var(--ink); }
.cb input:checked + i svg { opacity: 1; }
.cb input:focus-visible + i { outline: 3px solid var(--home); outline-offset: 2px; }
"""
    open('components.css', 'w').write(css)

sub('screens/office.js', [
    ('<input type="checkbox" id="chk" style="width:24px;height:24px;flex:none;accent-color:var(--ink);margin:0">', '<span class="cb"><input type="checkbox" id="chk"><i>\' + IC.check + \'</i></span>'),
    ('\'</p><p class="addr">\' + V.linkShort + \'</p>', '\'</p><p class="small dim" style="overflow-wrap:anywhere">\' + V.linkShort + \'</p>'),
])
sub('screens/play.js', [
    ('r.style.opacity = dx > 4 ? 1 : 0; l.style.opacity = dx < -4 ? 1 : 0;\n', 'r.style.opacity = dx > 4 ? 1 : 0; l.style.opacity = dx < -4 ? 1 : 0; r.classList.toggle("show", dx > 4); l.classList.toggle("show", dx < -4);\n'),
    ('function release(c) { c.classList.add("settle"); c.style.transform = ""; $$(".fx-wipe", c).forEach(function (w) { w.style.transform = ""; w.style.opacity = ""; }); }',
     'function release(c) { c.classList.add("settle"); c.style.transform = ""; $$(".fx-wipe", c).forEach(function (w) { w.style.transform = ""; w.style.opacity = ""; setTimeout(function () { if (!w.style.opacity) w.classList.remove("show"); }, 280); }); }'),
    ('c.classList.remove("settle"); w.style.opacity = 1;', 'c.classList.remove("settle"); w.classList.add("show"); w.style.opacity = 1;'),
    ('w.style.transform = ""; w.style.opacity = ""; });\n      c.style.pointerEvents', 'w.style.transform = ""; w.style.opacity = ""; w.classList.remove("show"); });\n      c.style.pointerEvents'),
])
print('patched')
