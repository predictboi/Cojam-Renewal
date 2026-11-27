import io
def patch(p, pairs):
    s = io.open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8').write(s)

# ---------- labels of the motion round
patch('assets/paper-i18n.js', [
('''    "pp.player.col": ["Player", "참가자", "プレイヤー"]''',
 '''    "pp.player.col": ["Player", "참가자", "プレイヤー"],
    "pp.extra": ["Extra", "호외", "号外"],
    "pp.paid": ["Paid", "지급 완료", "支払済"],
    "pp.press": ["Going to press", "인쇄 대기", "印刷待ち"]'''),
])

# ---------- results: stamps land in sequence, pending rows are going to press, totals count up, a row opens like a clipping
patch('screens/results.js', [
('''  function side(r) {
    var chip, pts;''',
 '''  /* every stamp sits at its own small angle, fixed by its place in the list (stable between visits), and lands in the order of the list */
  var ANG = [-5, 3, -2, 4, -4, 2, -3, 5], stampN = 0;
  function stamp(kind, text) { var k = stampN++; return '<span class="rstamp rstamp--' + kind + ' is-land" style="--rot:' + ANG[k % ANG.length] + "deg;--d:" + Math.min(k, 9) * 70 + 'ms">' + text + "</span>"; }
  function side(r) {
    var chip, pts;'''),
('''      case "wait": chip = '<span class="rchip rchip--wait">' + C.icon("clock", 14) + t("r.o.waitat", { time: r.exp }) + "</span>";''',
 '''      case "wait": chip = '<span class="rchip rchip--wait"><i class="press" role="img" aria-label="' + esc(t("pp.press")) + '"></i>' + t("r.o.waitat", { time: r.exp }) + "</span>";'''),
('''      case "hit": chip = C.rstamp("hit", t("r.o.hit")); pts''', '''      case "hit": chip = stamp("hit", t("r.o.hit")); pts'''),
('''      case "pend": chip = C.rstamp("hit", t("r.o.hit")); pts''', '''      case "pend": chip = stamp("hit", t("r.o.hit")); pts'''),
('''      case "corr": chip = C.rstamp("corr", t("r.o.corr")); pts''', '''      case "corr": chip = stamp("corr", t("r.o.corr")); pts'''),
('''      case "miss": chip = C.rstamp("miss", t("r.o.miss")); pts''', '''      case "miss": chip = stamp("miss", t("r.o.miss")); pts'''),
('''      '<div class="rrow-more" id="' + id + '" hidden>' + more + (r.out === "void" ? "" : '<button type="button" class="linkish" data-how="' + id + '">' + t("h.ai.h") + C.icon("chev", 16) + "</button>") + "</div></li>";''',
 '''      '<div class="rrow-more" id="' + id + '" inert><div class="rrow-clip">' + more + (r.out === "void" ? "" : '<button type="button" class="linkish" data-how="' + id + '">' + t("h.ai.h") + C.icon("chev", 16) + "</button>") + "</div></div></li>";'''),
('''<p class="rs-count">+' + F.pts(g.total) + "</p></div>" +''', '''<p class="rs-count" data-roll="' + g.total + '">+' + F.pts(g.total) + "</p></div>" +'''),
('''      var open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open); var m = document.getElementById(b.getAttribute("aria-controls")); if (m) m.hidden = !open;''',
 '''      /* the detail unfolds under its row like a clipping (an accordion: the one place a height is animated, through grid rows) */
      var open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open); var m = document.getElementById(b.getAttribute("aria-controls")); if (m) { m.classList.toggle("is-open", open); if (open) m.removeAttribute("inert"); else m.setAttribute("inert", ""); }'''),
('''    var moreDone = false, current = filter;
    apply(filter);''',
 '''    var moreDone = false, current = filter;
    apply(filter);
    /* the points of each day count up once, after its stamps have started to land (the first two days are on screen) */
    App.$$("[data-roll]", groups).slice(0, 2).forEach(function (el, i) { var to = +el.getAttribute("data-roll"); el.textContent = "+0P"; setTimeout(function () { App.countTo(el, 0, to, function (v) { return "+" + F.pts(v); }, null, 520); }, 180 + i * 260); });'''),
])

# ---------- ranking: the table sets like type, prizes roll, the own bar comes up like a ticker strip, the week turns like a page
patch('screens/ranking.js', [
('''  function row(r) {
    var lead = r.prize !== undefined && r.rank <= 3;
    return '<li class="krow' + (lead''',
 '''  var rowN = 0;
  function row(r) {
    var lead = r.prize !== undefined && r.rank <= 3;
    return '<li style="--i:' + (rowN++) + '" class="krow' + (lead'''),
('''(r.prize === undefined ? "" : '<p class="krow-prize">' + prize(r.prize) + "<small>CT</small></p>")''',
 '''(r.prize === undefined ? "" : '<p class="krow-prize"><span data-prize="' + r.prize + '">' + prize(r.prize) + "</span><small>CT</small></p>")'''),
('''  function view(w) {
    var note = "";''',
 '''  function view(w) {
    var note = ""; rowN = 0;'''),
('''      if (e.detail.name !== "week") return; week = e.detail.value;
      $("#view").innerHTML = view(week);
      var p = $("#pin"); if (p) p.outerHTML = pin(week); App.enhance(document.body); App.pinFit();''',
 '''      if (e.detail.name !== "week" || e.detail.value === week) return; week = e.detail.value;
      /* the week turns like a page: the old table leaves towards the side it belongs to (120 ms), the new one comes in from the other side and sets again.
         The control has already switched, and a second tap during the turn simply wins. */
      var v = $("#view"), dir = week === "last" ? -1 : 1;
      function swap() {
        v.innerHTML = view(week); var p = $("#pin"); if (p) p.outerHTML = pin(week); App.enhance(document.body); App.pinFit(); roll();
        if (!App.reduce && v.animate) v.animate([{ opacity: 0, transform: "translateX(" + dir * -18 + "px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      }
      clearTimeout(v._turn);
      if (App.reduce || !v.animate) swap();
      else { v.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + dir * 18 + "px)" }], { duration: 120, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" }); v._turn = setTimeout(function () { v.getAnimations().forEach(function (a) { a.cancel(); }); swap(); }, 120); }'''),
('''    if (S === "how") howSheet();''',
 '''    if (S === "how") howSheet();
    roll();'''),
('''  function toAround() {''',
 '''  /* the prizes of the first three roll up as their rows set; the rest are still (ten rolling figures would be noise) */
  function roll() { App.$$("#top10 .krow--lead [data-prize]").forEach(function (el, i) { var to = +el.getAttribute("data-prize"); el.textContent = prize(0); setTimeout(function () { App.countTo(el, 0, to, prize, null, 560); }, 120 + i * 90); }); }
  function toAround() {'''),
])

# ---------- staking and convert: the result figure rolls to its new value while the amount is typed
patch('screens/staking.js', [
('''      $("#sum-v").innerHTML = S === "loading" ? C.skel("170px", "40px") : shown ? F.dec(interest) + "<small>CT</small>" : "–";''',
 '''      var sv = $("#sum-v");
      if (S === "loading") sv.innerHTML = C.skel("170px", "40px");
      else if (!shown) { sv._val = 0; sv.innerHTML = "–"; }
      else App.countTo(sv, sv._val === undefined ? interest : sv._val, interest, function (v) { return F.dec(v) + "<small>CT</small>"; }, null, 260);'''),
])
patch('screens/convert.js', [
('''      get.innerHTML = F.dec(n) + "<small>CT</small>";''',
 '''      App.countTo(get, get._val === undefined ? n : get._val, n, function (v) { return F.dec(Math.round(v)) + "<small>CT</small>"; }, null, 260);'''),
])
print("patched")
