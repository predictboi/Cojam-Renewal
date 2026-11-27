import io, re
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8').write(s)
def patch(p, pairs):
    s = rd(p)
    for a, b in pairs:
        assert a in s, (p, a[:90])
        s = s.replace(a, b)
    wr(p, s)

patch('assets/app.js', [
# 1. the language control is a globe and a two letter code (72 px wide); the native list still shows the full names
('''    return '<label class="select">' + ic("globe", 18) + '<span class="sr-only">' + t("lang.label") + '</span><select data-lang aria-label="' + esc(t("lang.label")) + '">' +
      I.langs.map(function (l) { return '<option value="' + l + '"' + (l === App.lang ? " selected" : "") + ">" + I.names[l] + "</option>"; }).join("") + "</select>" + ic("down", 16) + "</label>";''',
 '''    return '<label class="select select--code">' + ic("globe", 18) + '<span class="select-v" aria-hidden="true">' + App.lang.toUpperCase() + '</span><select data-lang aria-label="' + esc(t("lang.label")) + '">' +
      I.langs.map(function (l) { return '<option value="' + l + '"' + (l === App.lang ? " selected" : "") + ">" + I.names[l] + "</option>"; }).join("") + "</select></label>";'''),
# 4. Japanese headlines end in a Latin question mark (Besley, like the numerals): no full width side bearing before the mark
('''    return { id: id, n: q.n, img: q.img, focus: q.focus, cat: q.cat, title: L.title,''', '''    return { id: id, n: q.n, img: q.img, focus: q.focus, cat: q.cat, title: App.lang === "ja" ? L.title.replace(/\\uFF1F/g, "?") : L.title,'''),
])
# 11. "Saving Q1: Yes", one colon
patch('screens/home.js', [
('''t("common.saving") + ": " + label(shown)''', '''t("common.saving") + " " + label(shown)'''),
('''t("h.saved") + ": " + label(shown)''', '''t("h.saved") + " " + label(shown)'''),
])
# 13. one ledger: results lists today's +100P as paid, so its masthead shows the same balance as day done
s = rd('screens/results.js')
m = re.search(r'pts: S === "" \? "hits" : S === "loading" \? "loading" : "",', s)
assert m
s = s[:m.start()] + 'points: App.sess.data.paid ? M.user.points : M.user.points + 100, ' + s[m.start():]
wr('screens/results.js', s)

# 3. gate: the install notice comes first (fully visible in the first screen), the example card after it with "Example" in its kicker row;
#    the iOS slip steps aside while the steps are on screen and the page keeps room for it
patch('screens/gate.js', [
('''  var demo = '<div class="gate-demo" aria-hidden="true"><span class="gate-demo-tag">' + t("g.example") + "</span>" + C.qcard(M.set[0], { static: true }) + "</div>";''',
 '''  var demo = '<div class="gate-demo" aria-hidden="true">' + C.qcard(M.set[0], { static: true }).replace(/(<span class="qno"[^>]*>)[^<]*/, "$1" + t("g.example")) + "</div>";'''),
('''    (inv ? "" : demo) + "</div>" +
    '<div class="gate-col"><section class="panel" aria-live="polite" id="panel">' + panel() + "</section>" + (inv ? demo : "") +''',
 '''    "</div>" +
    '<div class="gate-col"><section class="panel" aria-live="polite" id="panel">' + panel() + "</section>" + demo +'''),
('''    var q = $(".gate-demo .qcard"); if (q) q.setAttribute("inert", "");''',
 '''    var q = $(".gate-demo .qcard"); if (q) q.setAttribute("inert", "");
    /* the slip that points at Safari's Share button never lies on the steps it explains: it steps aside while they are on screen */
    var slip = $(".ios-point"), steps = $("#panel .steps");
    if (slip && steps && window.IntersectionObserver) new IntersectionObserver(function (en) { slip.classList.toggle("is-away", en[0].isIntersecting); }, { rootMargin: "0px 0px -8px 0px", threshold: 0.05 }).observe($("#panel"));'''),
])

# 6. first run: one picture band (fixed top and height on the three pages), text under it, the action row pinned
patch('screens/first-run.js', [
('''    var ready = from === "profile", waiting = false, line = $("#setup-line");''',
 '''    var ready = from === "profile", waiting = false, line = $("#setup-line");
    /* the drawing is scaled to the band, whatever the band's height on this phone */
    function fitArt() { App.$$(".onb-art").forEach(function (band) { var f = band.firstElementChild; if (!f) return; f.style.transform = ""; var hidden = band.closest("[hidden]"); if (hidden) hidden.hidden = false; var k = Math.min(1, (band.clientHeight - 24) / f.offsetHeight, (band.clientWidth - 24) / f.offsetWidth); if (hidden) hidden.hidden = true; f.style.transform = k < 1 ? "scale(" + k.toFixed(3) + ")" : ""; }); }
    fitArt(); window.addEventListener("resize", fitArt); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitArt);'''),
])

# 7. staking: the interest also shows in the pinned bar on short screens, so it is never off screen with the action
patch('screens/staking.js', [
('''  var act = S === "error" ? "" : C.actbar(C.btn("", { kind: "primary", block: true, id: "go", disabled: true }), S === "hold" ? t("pp.youpay") : t("pp.nofee2"));''',
 '''  var act = S === "error" ? "" : '<div class="pin pin--act"><p class="pin-fig" id="pin-fig" aria-hidden="true"></p>' + C.btn("", { kind: "primary", block: true, id: "go", disabled: true }) + '<p class="pin-note">' + (S === "hold" ? t("pp.youpay") : t("pp.nofee2")) + "</p></div>";'''),
('''      var kr = $("#sum-k"); kr.hidden = !(App.isKo && shown);''',
 '''      var pf = $("#pin-fig"); if (pf) pf.innerHTML = "<span>" + t("s.interest", { d: period }) + '</span><b class="nw">' + (shown ? F.dec(interest) : "0") + " CT</b>";
      var kr = $("#sum-k"); kr.hidden = !(App.isKo && shown);'''),
])
print('ok c1')
