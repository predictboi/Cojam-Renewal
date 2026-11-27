# One-off edit script used during the build (round 1 motion fixes). Running it again changes nothing.
import os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
def sub(path, pairs):
    s = open(path).read()
    for a, b in pairs:
        if a not in s and b not in s: print('MISS', a[:60])
        s = s.replace(a, b)
    open(path, 'w').write(s)
sub('screens/play.js', [
    ('"translateX(" + (100 - 53 * (dx > 0 ? p : 0)) + "%) skewX(-12deg)"', '"translateX(" + (100 - 62 * (dx > 0 ? p : 0)) + "%) skewX(-12deg)"'),
    ('"translateX(" + (-100 + 53 * (dx < 0 ? p : 0)) + "%) skewX(-12deg)"', '"translateX(" + (-100 + 62 * (dx < 0 ? p : 0)) + "%) skewX(-12deg)"'),
    ('to = "translateX(" + sign * (W + 90) + "px) rotate(" + sign * 12 + "deg)";', 'to = "translateX(" + sign * (W * 1.5 + 90) + "px) rotate(" + sign * 12 + "deg)";'),
    ('ans[id] = dir; last = { id: id, dir: dir, el: c, fly: fly };', 'ans[id] = dir; last = { id: id, dir: dir, el: c, fly: fly };\n      if (fly) fly.onfinish = function () { if (ans[id]) c.style.visibility = "hidden"; };'),
    ('c.style.pointerEvents = ""; c.style.transform = ""; c.classList.remove("settle");', 'c.style.pointerEvents = ""; c.style.visibility = ""; c.style.transform = ""; c.classList.remove("settle");'),
    ("""ft.innerHTML = '<i class="ft-sweep"></i>""", """ft.innerHTML = '<div class="ft-pitch">' + A.art.pitch + '</div><i class="ft-sweep"></i>"""),
])
sub('components.css', [
    ('.fx-wipe > span { transform: skewX(12deg); display: flex; flex-direction: column; gap: 2px; padding: 0 18%; max-width: 62%; }', '.fx-wipe > span { transform: skewX(12deg); display: flex; flex-direction: column; gap: 2px; padding: 0 5%; max-width: 44%; }'),
    ('.ft-sweep { position: absolute;', '.ft-pitch { position: absolute; inset: 0; }\n.ft-pitch svg { width: 100%; height: 100%; }\n.ft-sweep { position: absolute;'),
])
print('ok')
