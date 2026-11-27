# Round 1 audit fixes: real backgrounds on thick keys (so contrast is measured on the face), cards behind keep full strength, hidden stickers are not rendered.
def patch(p, reps):
    s = open(p, encoding='utf8').read()
    for a, b in reps:
        assert a in s, (p, a[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8').write(s)

patch('components.css', [
 ("padding: 0 var(--s-20); border: 0; border-radius: var(--r-ctl); background: none; color: var(--ink); font-size: var(--fs-18);", "padding: 0 var(--s-20); border: 0; border-radius: var(--r-ctl); background: var(--face); color: var(--ink); font-size: var(--fs-18);"),
 (".btn-ghost::before, .btn-ghost::after { display: none; }", ".btn-ghost, .btn-danger { background: none; }\n.btn-ghost::before, .btn-ghost::after { display: none; }"),
 ("min-height: 60px; padding: 0 var(--s-8); border: 0; border-radius: var(--r-ctl); background: none; color: var(--on-pick);", "min-height: 60px; padding: 0 var(--s-8); border: 0; border-radius: var(--r-ctl); background: var(--face); color: var(--on-pick);"),
 ("padding: 0 var(--s-16); border: 0; border-radius: 16px; background: none; color: var(--ink); font-size: var(--fs-18); line-height: 1; white-space: nowrap; animation: undo-in", "padding: 0 var(--s-16); border: 0; border-radius: 16px; background: var(--sun); color: var(--ink); font-size: var(--fs-18); line-height: 1; white-space: nowrap; animation: undo-in"),
 ("min-height: 72px; padding: var(--s-6) var(--s-2); border: 0; border-radius: 16px; background: none; color: var(--ink);", "min-height: 72px; padding: var(--s-6) var(--s-2); border: 0; border-radius: 16px; background: var(--cream); color: var(--ink);"),
 ('.period button[aria-pressed="true"] { color: var(--on-accent);', '.period button[aria-pressed="true"] { background: var(--accent); color: var(--on-accent);'),
 ('.qcard[data-pos="1"] .qcard-in > :not(.qstamp):not(.qtint), .qcard[data-pos="2"] .qcard-in > :not(.qstamp):not(.qtint) { opacity: 0.55; }\n', ''),
 ('.qcard[data-pos="x"] { z-index: 0; opacity: 0; transform: translateY(15px) scale(0.93); pointer-events: none; }', '.qcard[data-pos="x"] { z-index: 0; visibility: hidden; transform: translateY(15px) scale(0.93); pointer-events: none; }'),
 (".qstamp { position: absolute; left: 0; right: 0; top: 54px; z-index: 3; width: fit-content; max-width: 86%; margin: 0 auto; opacity: 0;", ".qstamp { position: absolute; left: 0; right: 0; top: 54px; z-index: 3; width: fit-content; max-width: 86%; margin: 0 auto; opacity: 0; visibility: hidden;"),
 (".viewsw a { display: grid; place-items: center; min-height: 38px; min-width: 52px;", ".viewsw a { display: grid; place-items: center; min-height: var(--target); min-width: 52px;"),
 ('.viewsw a::after { content: ""; position: absolute; inset: -3px 0; }\n', ''),
 (".select select { min-height: 40px;", ".select select { min-height: var(--target);"),
])
patch('assets/app.js', [
 ("        el.style.opacity = on ? (armed ? 1 : Math.min(1, a * 12)) : 0;", "        el.style.opacity = on ? (armed ? 1 : Math.min(1, a * 12)) : 0; el.style.visibility = on ? \"visible\" : \"\";"),
])
patch('screens/home.js', [
 ('deckEl.setAttribute("data-nudge", "1");', 'deckEl.setAttribute("data-nudge", "1"); App.$$(".qstamp", card).forEach(function (q) { q.style.visibility = "visible"; });'),
 ('deckEl.removeAttribute("data-nudge"); }', 'deckEl.removeAttribute("data-nudge"); App.$$(".qstamp", deckEl).forEach(function (q) { if (!q.style.opacity || q.style.opacity === "0") q.style.visibility = ""; }); }'),
])
print("ok")
