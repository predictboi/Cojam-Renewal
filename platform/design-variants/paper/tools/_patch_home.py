import io
def patch(p, pairs):
    s = io.open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8').write(s)

patch('screens/home.js', [
('''<span class="fuse fuse--end" aria-hidden="true"><i' + (id ? ' id="' + id + '"' : "") + "></i></span>"; }''',
 '''<span class="fuse fuse--end" aria-hidden="true"' + (id ? ' id="' + id + '"' : "") + "></span>"; }'''),
('''      if (!p) { endP.textContent = t("h.end.b"); endRun.style.animation = "none"; endRun.style.transform = "scaleX(0)"; finishBtn(false); endFor = null; return; }''',
 '''      if (!p) { endP.textContent = t("h.end.b"); endRun.innerHTML = ""; finishBtn(false); endFor = null; return; }'''),
('''      if (endFor !== p) { endFor = p; endRun.style.transform = ""; endRun.style.animation = "none"; void endRun.getBoundingClientRect(); endRun.style.animation = ""; endRun.style.animationDuration = UNDO_MS + "ms"; endRun.style.animationDelay = "-" + (Date.now() - p.t0) + "ms"; }''',
 '''      if (endFor !== p) { endFor = p; endRun.innerHTML = '<i style="--gone:-' + (Date.now() - p.t0) + 'ms"></i>'; }   /* a new rule for the newest pick, already used up by the time that has passed */'''),
('''<span class="fuse" aria-hidden="true"><i style="animation-duration:' + UNDO_MS + "ms;animation-delay:-" + gone + 'ms"></i></span>' +''',
 '''<span class="fuse" aria-hidden="true"><i style="--gone:-' + gone + 'ms"></i></span>' +'''),
])
patch('screens/home-list.js', [
('''<span class="fuse fuse--btn" aria-hidden="true"><i style="animation-duration:' + UNDO_MS + "ms;animation-delay:-" + (Date.now() - p.t0) + 'ms"></i></span>' ''',
 '''<span class="fuse fuse--btn" aria-hidden="true"><i style="--gone:-' + (Date.now() - p.t0) + 'ms"></i></span>' '''),
])
print("patched")
