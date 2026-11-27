/* Home, list view: the five questions as an index of numbered stories. The open one is set on a fresh sheet between a heavy and a thin rule.
   Same rules as the card view: a pick can be undone for 3 seconds, then it is sent. */
(function () {
  var t = App.t, S = App.state, M = MOCK, $ = App.$;
  var picks = {}, sess = App.sess, live = S === "" || S === "fresh";
  function dropFresh() { try { var u = new URL(location.href); u.searchParams.delete("state"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {} }
  window.addEventListener("pageshow", function (e) { if (e.persisted) location.reload(); });
  if (S === "fresh") { sess.resetDay(); dropFresh(); }
  var leftSaved = live ? sess.takeLeft() : 0;
  var fin = live && sess.picked() === 5;
  /* picks made in this tab (in either view) carry over; with none, the plain screen shows its two sample picks */
  if (live && sess.picked()) M.set.forEach(function (id, i) { if (sess.data.picks[id]) picks[i + 1] = { dir: sess.data.picks[id], sync: "ok" }; });
  else if (S !== "fresh" && S !== "partial0" && S !== "hold") { picks[1] = { dir: "r", sync: "ok" }; picks[2] = { dir: "l", sync: S === "syncing" || S === "slow" ? "saving" : "ok" }; }
  if (S === "failed") picks[2] = { dir: "l", sync: "fail" };
  var current = null;
  var Q = M.set.map(App.q), UNDO_MS = 3000;
  function isAnswered(n) { return picks[n] && picks[n].sync !== "fail"; }
  function count() { return Q.filter(function (q) { return isAnswered(q.n); }).length; }
  function firstOpen() { for (var i = 0; i < 5; i++) if (!isAnswered(Q[i].n)) return Q[i].n; return null; }
  function segs() { return Q.map(function (q) { var p = picks[q.n]; return !p ? "" : p.sync === "ok" ? "done" : p.sync === "saving" || p.sync === "held" ? "pend" : "fail"; }); }

  function head() {
    var c = S === "loading" ? 0 : count();
    return '<div class="ph-top"><h1>' + t("h.title") + "</h1>" + C.viewSwitch("term", S === "fresh" ? "" : S) + "</div>" +
      '<div class="ph-line"><span class="sr-only"><span id="cnt">' + c + "</span>/5</span>" + C.day5(S === "loading" ? ["", "", "", "", ""] : segs(), { id: "day5" }) + "</div>";
  }
  function liveCell() { if (fin) return "<span>" + t("d.next") + '</span> <b data-cd="' + M.untilNextSet() + '"></b>';
    return S === "empty" || S === "closed" || S === "hold" || S === "otherdevice" ? "" : S === "loading" ? C.skel("96px", "12px") : C.closes(M.untilNextSet()); }
  function row(q) {
    var n = q.n, p = picks[n], num = '<span class="trow-n" aria-hidden="true">' + n + "</span>", cat = "<span>" + t("cat." + q.cat) + "</span>";
    if (p && p.sync !== "fail") {
      var undo = p.sync === "held" ? '<button type="button" class="undo" data-undo="' + n + '" aria-label="' + App.esc(t("h.undo.aria", { n: n, choice: q[p.dir] })) + '"><span class="fuse fuse--btn" aria-hidden="true"><i style="--gone:-' + (Date.now() - p.t0) + 'ms"></i></span>' + C.icon("undo", 18) + "<span>" + t("h.undo") + "</span></button>" : "";
      return '<li class="trow is-done">' + num + '<div><p class="trow-q">' + App.esc(q.title) + '</p><div class="trow-foot"><span class="trow-state">' +
        (p.sync === "saving" ? '<span class="spin"></span><span class="sr-only">' + t("common.saving") + "</span>" : undo ? "" : C.icon("check", 16)) + t("h.t.chose", { choice: C.pick(p.dir, App.esc(q[p.dir])) }) + "</span>" + undo + "</div></div>" + C.thumb(q) + "</li>";
    }
    var failed = p && p.sync === "fail";
    if (n === current) {
      return '<li class="trow is-open' + (failed ? " is-fail" : "") + '">' + num + '<div><h2 class="trow-q" tabindex="-1" id="open-q">' + App.esc(q.title) + '</h2><div class="trow-foot">' + cat +
        (failed ? '<span class="trow-state">' + C.icon("warn", 16) + t("h.t.notsaved") + "</span>" : "") + "</div></div>" + C.thumb(q) +
        '<div class="trow-body"><button type="button" class="qmeta" data-ai-info="' + q.id + '" aria-haspopup="dialog"><span class="qmeta-t"><span>' + t("h.answer", { rule: App.esc(q.rule) }) + "</span><span>" + t("h.ai", { time: q.settle }) + '</span></span><span class="qmeta-go">' + t("pp.rule") + C.icon("chev", 14) + "</span></button>" +
        '<div class="choices">' + ["l", "r"].map(function (d) {
          return '<button type="button" class="choice" data-pick="' + n + '" data-dir="' + d + '"' + (App.offline ? ' aria-disabled="true"' : "") + ' aria-label="' + App.esc(t("h.pick.aria", { choice: q[d], q: q.title })) + '">' + (d === "l" ? C.icon("left", 18) : "") + "<span>" + App.esc(q[d]) + "</span>" + (d === "r" ? C.icon("right", 18) : "") + "</button>";
        }).join("") + "</div>" + (App.offline ? '<p class="qcard-final">' + t("h.offline") + "</p>" : '<p class="qcard-final">' + t("h.final") + "</p>") + "</div></li>";
    }
    return '<li class="trow' + (failed ? " is-fail" : "") + '">' + num + '<div><p class="trow-q">' + App.esc(q.title) + '</p><div class="trow-foot">' + cat +
      (failed ? '<span class="trow-state">' + C.icon("warn", 16) + t("h.t.notsaved") + "</span>" : "") +
      C.btn(failed ? t("h.t.again") : t("h.t.pick"), { sm: true, attrs: 'data-open="' + n + '"' }) + "</div></div>" + C.thumb(q) + "</li>";
  }
  function list() { return Q.map(row).join(""); }
  function keep() { if (!live) return; sess.data.picks = {}; Q.forEach(function (q) { var p = picks[q.n]; if (p && p.sync !== "fail") sess.data.picks[q.id] = p.dir; }); sess.save(); }
  function body() {
    if (S === "loading") return '<ol class="term" aria-busy="true">' + [1, 2, 3, 4, 5].map(function (n) { return '<li class="trow"><span class="trow-n" aria-hidden="true">' + n + "</span><div>" + C.skel("94%", "16px") + '<div class="trow-foot">' + C.skel("64px", "12px") + "</div></div>" + C.skel("56px", "68px") + "</li>"; }).join("") + '</ol><p class="sr-only" role="status">' + t("common.loading") + "</p>";
    if (S === "empty") return C.empty({ icon: "clock", title: t("h.empty.h"), body: t("h.empty.b", { time: t("time.kst9") }), extra: '<p class="fig" data-dg data-cd="' + M.untilNextSet() + '"></p>' });
    if (S === "closed") return C.empty({ icon: "refresh", title: t("h.closed"), action: C.btn(t("h.closed.btn"), { kind: "primary", href: "home-list.html" }) });
    if (S === "error") return C.error();
    if (S === "otherdevice") return C.otherDevice();
    if (S === "hold") return C.empty({ icon: "pause", title: t("hold.home.h"), body: t("hold.home.b"), action: C.btn(t("hold.home.btn"), { href: "system.html?state=blocked", iconEnd: "right", id: "hold-more" }) });
    return (App.offline ? C.note("warn", t("h.offline")) : "") + C.playBanner(S) + '<div class="term-wrap" style="display:grid"><ol class="term" id="term">' + list() + '</ol><div class="term-end" id="term-end" hidden></div></div>';
  }
  current = firstOpen();
  App.store.set("view", "term");
  App.mount({ tab: "home", docTitle: t("h.title"), live: liveCell(), head: head(), body: body(), cls: "is-list", badges: { home: fin || S === "hold" ? 0 : "dot", results: 2 }, after: function () {
    var term = $("#term"), lastPick = 0; if (!term) return;
    if (S === "failed") App.toast(t("h.toast.fail", { n: 2 }), { btn: t("common.retry") });
    if (leftSaved) App.toast(leftSaved > 1 ? t("h.left.savedn", { n: leftSaved }) : t("h.left.saved"));
    var leaving = false;
    window.addEventListener("pagehide", function () { var n = Q.filter(function (q) { return picks[q.n] && picks[q.n].sync === "held"; }).length; if (live && n && !leaving) sess.leave(n); });
    var endEl = $("#term-end"), endT, endMode = "";
    function heldPicks() { return Q.map(function (q) { return picks[q.n]; }).filter(function (p) { return p && p.sync === "held"; }).sort(function (a, b) { return a.t0 - b.t0; }); }
    function endPaint() {
      clearInterval(endT);
      var held = heldPicks(), mode = count() < 5 ? "" : held.length ? "wait" : fin && !leaving ? "fin" : "saving";
      if (mode !== endMode) {
        endMode = mode; endEl.hidden = !mode; endEl.className = "term-end" + (mode === "fin" ? " is-fin" : "");
        endEl.innerHTML = !mode ? "" : '<div class="stack-8"><h2>' + t("h.end.h") + '</h2><p id="term-end-p">' + (mode === "fin" ? t("h.fin.b") : mode === "saving" ? '<span class="spin"></span>' + t("h.end.b") : "") + "</p></div>" +
          (mode === "wait" ? C.btn(t("h.end.now"), { kind: "primary", block: true, id: "finish" }) : mode === "fin" ? C.btn(t("h.fin.btn"), { kind: "primary", block: true, href: sess.data.paid ? "done.html" : "done.html?state=moment", iconEnd: "right" }) : "");
        if (mode === "wait") endEl.scrollIntoView({ block: "nearest", behavior: App.reduce ? "auto" : "smooth" });
      }
      if (mode !== "wait") return;
      var p = held[held.length - 1], line = $("#term-end-p");
      function tick() { line.innerHTML = t("h.end.in", { n: "<b>" + Math.max(1, Math.ceil((UNDO_MS - (Date.now() - p.t0)) / 1000)) + "</b>" }); }
      tick(); endT = setInterval(tick, 100);
    }
    function goDone(ms) { leaving = true; endPaint(); setTimeout(function () { location.href = "done.html?state=moment"; }, ms); }
    endEl.addEventListener("click", function (e) {
      if (!e.target.closest("#finish")) return;
      heldPicks().forEach(function (p) { clearTimeout(p.timer); p.sync = "saving"; });
      leaving = true; paint(false); goDone(0);
    });
    function paint(focus) {
      term.innerHTML = list(); endPaint();
      var day5 = $("#day5"), sg = segs(); for (var i = 0; i < 5; i++) day5.children[i].className = sg[i] ? "is-" + sg[i] : "";
      $("#cnt").textContent = count();
      if (focus) { var h = $("#open-q"); if (h) h.focus({ preventScroll: true }); }
    }
    function confirm(n) { setTimeout(function () { if (picks[n]) { picks[n].sync = "ok"; paint(false); } }, 1300 + Math.random() * 800); }
    if (S === "syncing") confirm(2);
    document.addEventListener("click", function (e) { if (e.target.closest("[data-retry-now]")) { var bn = $(".banner"); confirm(2); setTimeout(function () { if (bn) bn.parentNode.removeChild(bn); }, 1500); } });
    term.addEventListener("click", function (e) {
      var o = e.target.closest("[data-open]"); if (o) { current = +o.getAttribute("data-open"); paint(true); return; }
      var u = e.target.closest("[data-undo]");
      if (u) {
        var un = +u.getAttribute("data-undo"), up = picks[un]; if (!up || up.sync !== "held") return;
        clearTimeout(up.timer); delete picks[un]; keep(); current = un; paint(true); App.live(t("h.undone", { n: un })); return;
      }
      var b = e.target.closest("[data-pick]"); if (!b || b.disabled) return;
      if (App.offline) { App.toast(t("h.offline"), { key: "offline" }); return; }
      if (Date.now() - lastPick < 400) return;   /* a quick double tap never answers two questions */
      lastPick = Date.now();
      var n = +b.getAttribute("data-pick"), dir = b.getAttribute("data-dir");
      var p = picks[n] = { dir: dir, sync: "held", t0: Date.now() }; keep(); current = firstOpen();
      p.timer = setTimeout(function () {
        p.sync = "saving"; paint(false); confirm(n);
        var open = Q.some(function (q) { return picks[q.n] && picks[q.n].sync === "held"; });
        if (count() === 5 && !open && !leaving) goDone(App.reduce ? 0 : 500);
      }, UNDO_MS);
      try { if (navigator.vibrate) navigator.vibrate(10); } catch (err) {}
      App.live(t("h.live.picked", { choice: Q[n - 1][dir], k: 5 - count() }));
      paint(true);
    });
    endPaint();
    document.addEventListener("keydown", function (e) {
      if ((e.key !== "z" && e.key !== "Z" && e.key !== "Backspace") || e.repeat || e.altKey || e.ctrlKey || e.metaKey || $("#sheet-root.is-open")) return;
      var u = App.$$("[data-undo]", term).sort(function (a, b) { return picks[+b.getAttribute("data-undo")].t0 - picks[+a.getAttribute("data-undo")].t0; })[0];
      if (u) { e.preventDefault(); u.click(); }
    });
  } });
})();
