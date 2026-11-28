/* Concept D "Clean": login, first run, home (cards and list), day done, results, ranking, account on hold. */
(function () {
  "use strict";
  var App = window.App, C = window.C, M = window.MOCK, t = App.t, F = App.fmt, $ = App.$, $$ = App.$$, esc = App.esc;
  var S = App.sess, st = App.state;

  /* ---------- question pictures: flat shapes in white and pale blue that follow the colour of the card ---------- */
  var ART = {
    q1: '<path class="art-s2" d="M8 152 70 120 118 136 178 78 214 98 272 36"/><circle class="art-a" cx="140" cy="94" r="54"/><circle class="art-sk" cx="140" cy="94" r="41" stroke-dasharray="1 10"/><path class="art-k" fill-rule="evenodd" d="M124 70h20c9 0 15 5 15 12.5 0 5-2.6 8.6-6.6 10.4 5.3 1.6 8.8 5.8 8.8 11.6 0 8.6-6.6 13.5-17 13.5H124zm9.5 8v12h9c4.2 0 6.6-2.2 6.6-6s-2.4-6-6.6-6zm0 19.6V110h10.6c4.6 0 7.2-2.2 7.2-6.2s-2.6-6.2-7.2-6.2z"/><path class="art-k" d="M131 62h5v9h-5zM142 62h5v9h-5zM131 117h5v9h-5zM142 117h5v9h-5z"/>',
    q2: '<rect class="art-v" x="24" y="120" width="34" height="56" rx="8"/><rect class="art-v" x="68" y="96" width="34" height="80" rx="8"/><rect class="art-v" x="180" y="70" width="34" height="106" rx="8"/><rect class="art-v" x="224" y="40" width="34" height="136" rx="8"/><circle class="art-b" cx="118" cy="84" r="42"/><circle class="art-k" cx="164" cy="112" r="52"/><circle class="art-a" cx="164" cy="112" r="46"/><path class="art-sk" d="M146 102h36M146 122h36"/>',
    q3: '<rect class="art-v" x="20" y="134" width="30" height="46" rx="6"/><rect class="art-v" x="56" y="112" width="34" height="68" rx="6"/><rect class="art-v" x="196" y="124" width="30" height="56" rx="6"/><rect class="art-v" x="232" y="146" width="28" height="34" rx="6"/><circle class="art-a" cx="176" cy="62" r="40"/><path class="art-b" d="M96 150a30 30 0 0 1 4-59.6A40 40 0 0 1 176 96a27 27 0 0 1 2 54z"/>',
    q4: '<path class="art-sv" d="M82 50v112M124 50v112M166 50v112M208 50v112M42 88h200M42 126h200"/><path class="art-s" d="M40 164V50h204v114"/><path class="art-sv" d="M14 164h252"/><circle class="art-a" cx="150" cy="112" r="38"/><path class="art-k" d="M150 96l15 11-6 18h-18l-6-18z"/><path class="art-sk" d="M150 96V78M165 107l18-6M159 125l11 15M141 125l-11 15M135 107l-18-6"/>',
    q5: '<path class="art-sv" d="M50 70v96M96 96v76M142 60v96M188 44v84M234 24v76"/><rect class="art-v" x="36" y="92" width="28" height="56" rx="7"/><rect class="art-v" x="82" y="112" width="28" height="46" rx="7"/><rect class="art-b" x="128" y="78" width="28" height="60" rx="7"/><rect class="art-a" x="174" y="58" width="28" height="56" rx="7"/><rect class="art-a" x="220" y="36" width="28" height="50" rx="7"/><path class="art-s2" d="M40 180 110 172 180 150 252 118"/>'
  };
  function art(id) { return '<svg viewBox="0 0 280 190" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + (ART[id] || ART.q1) + "</svg>"; }

  function remaining() { return M.set.filter(function (id) { return !S.data.picks[id]; }); }
  function preset(n) { S.reset(); var sides = ["r", "l", "r", "r", "r"]; M.set.slice(0, n).forEach(function (id, i) { S.data.picks[id] = sides[i]; }); S.save(); }
  function headline(k) {
    if (k >= 5) return t("v.home.h"); if (k === 0) return t("v.home.h.done");
    return k === 1 ? t("v.home.h.last") : t("v.home.h.part", { k: k });
  }
  function homeHead(view) {
    var k = remaining().length;
    return '<div class="say"><h1 id="home-h">' + headline(k) + "</h1></div>" +
      '<div class="home-meta"><p>' + t("h.closes") + ' <b data-cd="' + M.untilNextSet() + '"></b></p>' +
      C.seg("viewsw", [{ v: "card", icon: "cards", href: App.url("home.html"), aria: t("h.view.card") }, { v: "list", icon: "rows", href: App.url("home-list.html"), aria: t("h.view.term") }], view, t("h.view.label"), "seg--icons") + "</div>" +
      '<div class="prog" id="prog" role="img" aria-label="' + esc(t("h.prog.sr", { n: 5 - k })) + '">' + M.set.map(function (id) { return '<i class="' + (S.data.picks[id] ? "is-done" : "") + '"></i>'; }).join("") + "</div>";
  }
  function refreshHead() {
    var k = remaining().length;
    $("#home-h").textContent = headline(k);
    $$("#prog i").forEach(function (el, i) { el.classList.toggle("is-done", !!S.data.picks[M.set[i]]); });
    $("#prog").setAttribute("aria-label", t("h.prog.sr", { n: 5 - k }));
  }
  function aiSheet(q) {
    App.sheet.open('<h2 id="sheet-h">' + t("h.ai.h") + '</h2><ol class="sheet-list">' + [1, 2, 3].map(function (n) { return "<li><i>" + n + "</i><span>" + t("h.ai." + n) + "</span></li>"; }).join("") + "</ol>" +
      '<div class="blk">' + C.kv(t("h.ai.src"), esc(q.rule)) + C.kv(t("h.ai.when"), t("h.ai.after", { time: esc(q.settle) })) + "</div>" +
      '<button type="button" class="btn btn--plain" data-close>' + t("common.close") + "</button>");
  }
  function goDone() { S.data.paid = true; S.save(); location.href = App.url("done.html", "moment"); }

  /* =====================================================================
     HOME, card view
     ===================================================================== */
  App.screens.home = function () {
    if (st === "fresh" || st === "armed" || st === "offline") S.reset();
    if (st === "partial" || st === "undo") preset(2);
    if (st === "final") preset(4);
    if (st === "finishing") preset(5);
    var special = { loading: 1, empty: 1, error: 1, hold: 1 }[st], inner = "";
    if (st === "loading") inner = '<div class="deck-skel" role="status" aria-label="' + esc(t("common.loading")) + '"></div>';
    if (st === "empty") inner = '<div class="deck-state">' + C.state({ icon: "clock", tone: "blue", h: t("h.empty.h"), b: t("h.empty.b", { time: t("time.kst9") }), extra: '<p class="lbl" style="margin-top:20px">' + t("d.next") + "</p>" + '<b class="num num--md" data-cd="' + M.untilNextSet() + '"></b>' }) + "</div>";
    if (st === "error") inner = '<div class="deck-state">' + C.error() + "</div>";
    if (st === "hold") inner = '<div class="deck-state">' + C.state({ icon: "pause", h: t("hold.home.h"), b: t("hold.home.b"), btn: t("hold.home.btn"), href: App.url("hold.html") }) + "</div>";
    var body = homeHead("card") + '<div class="deck" id="deck">' + inner + "</div>" +
      (special ? '<div class="slot"></div>' :
        '<div class="answers" id="answers"><button type="button" class="ans ans--l" data-side="l">' + C.icon("left", 20) + '<span></span></button><button type="button" class="ans ans--r" data-side="r"><span></span>' + C.icon("right", 20) + "</button></div>" +
        '<div class="slot" id="slot"><p class="slot-hint">' + t("h.hint.touch") + '</p><div class="undo" id="undo"><span class="undo-t"></span><button type="button" class="undo-btn">' + t("h.undo") + '<svg class="ring" viewBox="0 0 24 24" aria-hidden="true"><circle class="trk" cx="12" cy="12" r="9"/><circle class="run" cx="12" cy="12" r="9"/></svg></button></div></div>');
    App.mount({ tab: "home", fit: true, docTitle: t("h.title"), body: body, pointsLoading: st === "loading" });
    if (special) return;
    deck();
  };

  function deck() {
    var el = $("#deck"), ansL = $(".ans--l"), ansR = $(".ans--r"), slot = $("#slot");
    var held = null, lastCommit = 0, finished = false, UNDO_MS = 3000;

    function make(id, pos) {
      var q = App.q(id), c = document.createElement("article");
      c.className = "qcard"; c.setAttribute("data-pos", pos); c.setAttribute("data-id", id);
      c.setAttribute("aria-label", t("h.qn.sr", { n: q.n }));
      c.innerHTML = '<div class="qc-top"><span class="qc-chip">' + t("cat." + q.cat) + '</span><span class="qc-reward">' + t("r.o.ifhit") + "</span></div>" +
        '<div class="qc-art">' + art(id) + "</div>" +
        '<h2 class="qc-q">' + esc(q.title) + "</h2>" +
        '<div class="qc-meta"><p>' + C.icon("search", 16) + "<span>" + t("h.answer", { rule: esc(q.rule) }) + '</span></p><button type="button" class="qc-ai">' + C.icon("clock", 16) + "<span>" + t("h.ai", { time: esc(q.settle) }) + "</span></button></div>" +
        '<span class="qc-stamp qc-stamp--l">' + C.icon("left", 22) + esc(q.l) + '</span><span class="qc-stamp qc-stamp--r">' + esc(q.r) + C.icon("right", 22) + "</span>";
      $(".qc-ai", c).addEventListener("click", function () { if (c.getAttribute("data-pos") === "0") aiSheet(q); });
      bindDrag(c);
      return c;
    }
    function cards() { return $$(".qcard:not(.is-out)", el).sort(function (a, b) { return a.getAttribute("data-pos") - b.getAttribute("data-pos"); }); }
    function front() { return cards()[0]; }
    function labels() {
      var rest = remaining(), q = rest.length ? App.q(rest[0]) : null;
      [ansL, ansR].forEach(function (b, i) {
        var side = i ? "r" : "l";
        $("span", b).textContent = q ? q[side] : "";
        if (q) b.setAttribute("aria-label", t("h.pick.aria", { choice: q[side], q: q.title }));
        if (App.offline) b.setAttribute("aria-disabled", "true");
      });
      $("#answers").hidden = !q;
      cards().forEach(function (c, i) { $$("button", c).forEach(function (b) { b.tabIndex = i === 0 ? 0 : -1; }); c.setAttribute("aria-hidden", i === 0 ? "false" : "true"); });
    }
    function build() {
      el.innerHTML = ""; var rest = remaining();
      for (var p = Math.min(3, rest.length) - 1; p >= 0; p--) el.appendChild(make(rest[p], p));
      labels(); if (!rest.length) finish(true);
    }
    function hot(side) { ansL.classList.toggle("is-hot", side === "l"); ansR.classList.toggle("is-hot", side === "r"); }

    /* ----- undo: 3 seconds, then the pick is sent ----- */
    function showUndo(h, frozen) {
      $(".undo-t", slot).innerHTML = t("h.sync", { n: h.n, choice: "<b>" + esc(h.label) + "</b>" });
      $(".undo-btn", slot).setAttribute("aria-label", t("h.undo.aria", { n: h.n, choice: h.label }));
      var ring = $(".ring", slot); ring.classList.remove("is-run"); void ring.getBoundingClientRect();
      if (!frozen) ring.classList.add("is-run"); else $(".run", ring).style.strokeDashoffset = 22;
      slot.classList.add("has-undo");
    }
    function commitHeld() {
      if (!held) return; clearTimeout(held.timer); held = null; slot.classList.remove("has-undo");
    }
    function undo() {
      if (!held) return; var h = held; clearTimeout(h.timer); held = null; slot.classList.remove("has-undo");
      delete S.data.picks[h.id]; S.save(); finished = false;
      var fin = $(".fin", el); if (fin) fin.remove(); clearInterval(finTick);
      cards().forEach(function (c) { var p = +c.getAttribute("data-pos") + 1; if (p > 2) c.remove(); else c.setAttribute("data-pos", p); });
      var c = make(h.id, 0), w = el.offsetWidth, dir = h.side === "l" ? -1 : 1;
      if (!App.reduce) { c.style.transition = "none"; c.style.transform = "translate(" + dir * (w + 80) + "px,-16px) rotate(" + dir * 14 + "deg)"; }
      el.appendChild(c); void c.offsetWidth; c.style.transition = ""; c.style.transform = "";
      labels(); refreshHead(); App.live(t("h.undone", { n: h.n }));
    }

    /* ----- pick: the card leaves on the side of the answer, the next one rises ----- */
    function pick(side, vy) {
      var rest = remaining(), now = Date.now();
      if (!rest.length || finished) return;
      if (App.offline) { App.toast(t("h.offline")); snap(front()); return; }
      if (now - lastCommit < 220) return;   /* a double tap never answers two cards */
      lastCommit = now; commitHeld();
      var id = rest[0], q = App.q(id), c = front(), dir = side === "l" ? -1 : 1;
      S.data.picks[id] = side; S.save();
      c.classList.remove("is-drag", "is-back"); c.classList.add("is-out", side === "l" ? "is-arm-l" : "is-arm-r");
      $(".qc-stamp--" + side, c).style.opacity = 1;
      if (!App.reduce) c.style.transform = "translate(" + dir * (el.offsetWidth + 120) + "px," + (vy || -24) + "px) rotate(" + dir * 16 + "deg)";
      setTimeout(function () { c.remove(); }, 320);
      hot(side); setTimeout(function () { hot(null); }, 200);
      cards().forEach(function (x) { x.setAttribute("data-pos", +x.getAttribute("data-pos") - 1); });
      if (rest[3]) { var n = make(rest[3], 2); el.insertBefore(n, el.firstChild); }
      labels(); refreshHead();
      held = { id: id, side: side, n: q.n, label: q[side], timer: setTimeout(function () { held = null; slot.classList.remove("has-undo"); if (finished) goDone(); }, UNDO_MS) };
      showUndo(held);
      App.live(t("h.live.picked", { choice: q[side], k: rest.length - 1 }));
      if (rest.length === 1) finish();
    }
    var finTick = null;
    function finish(frozen) {
      finished = true;
      var f = document.createElement("div"); f.className = "fin";
      f.innerHTML = '<div class="fin-ring' + (frozen ? "" : " is-run") + '"><svg viewBox="0 0 84 84" aria-hidden="true"><circle class="trk" cx="42" cy="42" r="38"/><circle class="run" cx="42" cy="42" r="38"' + (frozen ? ' style="stroke-dashoffset:80"' : "") + '/></svg><b id="fin-n">' + (frozen ? 2 : 3) + "</b></div><p>" + t("h.end.b") + '</p><button type="button" class="btn btn--auto">' + t("h.end.now") + "</button>";
      el.appendChild(f); labels();
      $(".btn", f).addEventListener("click", goDone);
      if (frozen) { showUndo({ n: 5, label: App.q("q5").r }, true); return; }
      var n = 3; finTick = setInterval(function () { n--; var b = $("#fin-n"); if (b && n > 0) b.textContent = n; else clearInterval(finTick); }, 1000);
    }

    /* ----- drag: the card follows the finger and decides on release ----- */
    function snap(c) { if (!c) return; c.classList.remove("is-drag", "is-arm-l", "is-arm-r"); c.classList.add("is-back"); c.style.transform = ""; $$(".qc-stamp", c).forEach(function (s) { s.style.opacity = 0; }); hot(null); setTimeout(function () { c.classList.remove("is-back"); }, 440); }
    function bindDrag(c) {
      var d = null;
      c.addEventListener("pointerdown", function (e) {
        if (c.getAttribute("data-pos") !== "0" || finished || e.button > 0) return;
        d = { x: e.clientX, y: e.clientY, lock: null, armed: null, pts: [], w: c.offsetWidth, id: e.pointerId };
      });
      c.addEventListener("pointermove", function (e) {
        if (!d || e.pointerId !== d.id) return;
        var dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.lock) { if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; d.lock = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; if (d.lock === "x") { try { c.setPointerCapture(d.id); } catch (err) {} c.classList.remove("is-back"); c.classList.add("is-drag"); el.classList.add("is-dragging"); } }
        if (d.lock !== "x") return;
        d.pts.push([e.timeStamp, dx]); if (d.pts.length > 8) d.pts.shift();
        d.dx = dx; d.dy = dy;
        c.style.transform = "translate(" + dx + "px," + dy * 0.15 + "px) rotate(" + Math.max(-8, Math.min(8, dx / d.w * 14)) + "deg)";
        var p = Math.abs(dx) / d.w, side = dx < 0 ? "l" : "r", armed = p >= 0.35 ? side : null;
        /* honest preview: below the threshold the stamp only hints, at the threshold the whole card takes the answer colour */
        $(".qc-stamp--" + side, c).style.opacity = armed ? 1 : Math.min(0.4, p / 0.35 * 0.4);
        $(".qc-stamp--" + (side === "l" ? "r" : "l"), c).style.opacity = 0;
        if (armed !== d.armed) { d.armed = armed; c.classList.toggle("is-arm-l", armed === "l"); c.classList.toggle("is-arm-r", armed === "r"); hot(armed); if (armed && navigator.vibrate) { try { navigator.vibrate(5); } catch (err) {} } }
      });
      function end(e) {
        if (!d || e.pointerId !== d.id) return; var x = d; d = null;
        if (x.lock !== "x") return; el.classList.remove("is-dragging");
        var v = 0, last = x.pts[x.pts.length - 1], first = x.pts.filter(function (p) { return last[0] - p[0] <= 100; })[0];
        if (first && last[0] > first[0]) v = (last[1] - first[1]) / (last[0] - first[0]);
        var dx = x.dx || 0, same = v * dx > 0, fling = same && ((Math.abs(dx) >= 96 && Math.abs(v) >= 0.5) || (Math.abs(dx) >= 56 && Math.abs(v) >= 1.1));
        if (e.type !== "pointercancel" && (x.armed || fling)) pick(dx < 0 ? "l" : "r", (x.dy || 0) * 0.3 - 10); else snap(c);
      }
      c.addEventListener("pointerup", end); c.addEventListener("pointercancel", end);
    }

    ansL.addEventListener("click", function () { pick("l"); });
    ansR.addEventListener("click", function () { pick("r"); });
    $(".undo-btn", slot).addEventListener("click", undo);
    document.addEventListener("keydown", function (e) {
      if (e.repeat || App.sheet.el() || /^(INPUT|TEXTAREA|A)$/.test((document.activeElement || {}).tagName || "")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); pick("l"); } else if (e.key === "ArrowRight") { e.preventDefault(); pick("r"); }
      else if ((e.key === "z" || e.key === "Z" || e.key === "Backspace") && held) { e.preventDefault(); undo(); }
    });
    window.addEventListener("pagehide", commitHeld);

    build();
    /* review states that hold one moment still for a capture */
    if (st === "armed") {
      var c = front(); c.style.transition = "none"; c.classList.add("is-drag", "is-arm-r");
      c.style.transform = "translate(" + Math.round(c.offsetWidth * 0.4) + "px,-10px) rotate(5.6deg)"; $(".qc-stamp--r", c).style.opacity = 1; hot("r"); el.classList.add("is-dragging");
    }
    if (st === "undo") { var q2 = App.q("q2"); showUndo({ n: 2, label: q2.l }, true); }
  }

  /* =====================================================================
     HOME, list view
     ===================================================================== */
  App.screens["home-list"] = function () {
    if (st === "fresh" || st === "offline") S.reset();
    if (st === "partial") preset(2);
    if (st === "finishing") preset(5);
    if (st === "loading") { App.mount({ tab: "home", docTitle: t("h.title"), body: homeHead("list") + C.skel([["100%", 96], ["100%", 68], ["100%", 68], ["100%", 68]]) }); return; }
    var open = remaining()[0] || null;
    App.mount({ tab: "home", docTitle: t("h.title"), body: homeHead("list") + '<div class="ql" id="ql"></div><div id="ql-end" class="sec"></div>' });
    var undoTimer = null;
    function render() {
      $("#ql").innerHTML = M.set.map(function (id) {
        var q = App.q(id), p = S.data.picks[id], isOpen = !p && id === open;
        return '<div class="qrow' + (isOpen ? " is-open" : "") + (p ? " is-done" : "") + '" data-id="' + id + '">' +
          "<" + (p || isOpen ? "div" : 'button type="button"') + ' class="qrow-h"><span class="qrow-n">' + q.n + '</span><span class="qrow-t"><b>' + esc(q.title) + "</b>" + (isOpen ? "" : "<small>" + t("cat." + q.cat) + "</small>") + "</span>" +
          (p ? C.pick(p, q[p]) : (isOpen ? "" : '<span class="qrow-go">' + t("h.t.pick") + "</span>")) + "</" + (p || isOpen ? "div" : "button") + ">" +
          (isOpen ? '<div class="qrow-body"><span class="cap">' + t("h.answer", { rule: esc(q.rule) }) + '</span><span class="cap">' + t("h.ai", { time: esc(q.settle) }) + "</span>" +
            '<div class="answers"><button type="button" class="ans ans--l" data-side="l"' + (App.offline ? ' aria-disabled="true"' : "") + ">" + C.icon("left", 18) + "<span>" + esc(q.l) + '</span></button><button type="button" class="ans ans--r" data-side="r"' + (App.offline ? ' aria-disabled="true"' : "") + "><span>" + esc(q.r) + "</span>" + C.icon("right", 18) + "</button></div></div>" : "") + "</div>";
      }).join("");
      var done = !remaining().length;
      $("#ql-end").innerHTML = done ? '<div class="blk"><h2 class="num num--sm">' + t("h.end.h") + '</h2><p class="lbl" style="margin:4px 0 16px">' + t("h.fin.b") + '</p><a class="btn" href="' + App.url("done.html", "moment") + '" id="ql-fin">' + t("h.end.now") + "</a></div>" : '<p class="cap">' + t("h.final") + "</p>";
      if (done) $("#ql-fin").addEventListener("click", function () { S.data.paid = true; S.save(); });
      refreshHead();
    }
    $("#ql").addEventListener("click", function (e) {
      var a = e.target.closest(".ans"), row = e.target.closest(".qrow"); if (!row) return;
      var id = row.getAttribute("data-id");
      if (a) {
        if (App.offline) { App.toast(t("h.offline")); return; }
        var side = a.getAttribute("data-side"), q = App.q(id);
        S.data.picks[id] = side; S.save(); open = remaining()[0] || null; render();
        clearTimeout(undoTimer);
        App.toast(t("h.sync", { n: q.n, choice: "<b>" + esc(q[side]) + "</b>" }), { action: t("h.undo"), ms: 3000, fn: function () { delete S.data.picks[id]; S.save(); open = id; render(); App.live(t("h.undone", { n: q.n })); } });
        App.live(t("h.live.picked", { choice: q[side], k: remaining().length }));
      } else if (e.target.closest("button.qrow-h")) { open = id; render(); }
    });
    render();
  };

  /* =====================================================================
     DAY DONE
     ===================================================================== */
  App.screens.done = function () {
    var saving = st === "saving", moment = st === "moment";
    if (!saving) { S.data.paid = true; S.save(); }
    var picks = S.count() === 5 ? S.data.picks : { q1: "r", q2: "r", q3: "l", q4: "r", q5: "r" };
    var settled = st === "results";
    var rows = M.set.map(function (id) {
      var q = App.q(id), p = picks[id], pend = settled && id === "q2";
      return '<div class="prow"><span class="prow-n">' + q.n + '</span><span class="prow-t"><b>' + esc(q.title) + "</b><small>" + (pend ? t("d.hitpending", { time: "22:10" }) : t("d.wait")) + "</small></span>" + C.pick(p, q[p]) + "</div>";
    }).join("");
    var hero = '<section class="done-hero">' + (saving ? '<span class="tx-ic">' + C.spin() + "</span>" : C.checkMark(moment ? "check--run" : "")) +
      '<h1 class="' + (moment ? "rise" : "") + '" style="--dl:120ms">' + t("v.done.h") + "</h1>" +
      '<span class="num num--lg ' + (saving ? "is-off" : "num--blue") + (moment ? " rise" : "") + '" style="--dl:200ms">+<span id="done-n">' + (moment ? 0 : 100) + '</span><span class="u">P</span></span>' +
      '<p class="done-st' + (moment ? " rise" : "") + '" style="--dl:280ms" id="done-st">' + (saving ? t("d.saving.st") : t("d.paid.st")) + "</p></section>";
    var body = hero +
      '<section class="sec"><div class="blk"><div class="blk-h"><div><span class="lbl">' + t("d.next") + '</span><b class="num num--md" data-cd="' + M.untilNextSet() + '"></b></div><span class="chip">' + t("d.next.at") + "</span></div></div></section>" +
      '<section class="sec"><div class="sec-h"><h2>' + t("d.picks") + '</h2><a class="link" href="' + App.url("results.html") + '">' + t("d.results") + "</a></div>" + rows +
      '<p class="cap" style="margin-top:12px">' + t("d.hit.1") + " " + t("d.hit.2") + "</p></section>";
    App.mount({ tab: "home", docTitle: t("d.h1"), body: body, pointsLoading: saving,
      cta: '<a class="btn" href="' + App.url("ranking.html") + '">' + t("d.rank") + "</a>" });
    if (moment) {
      /* the reward: the tick draws, then the figure counts to 100 and the points pill takes it */
      var pill = $("[data-pts]"), base = M.user.points;
      if (pill) pill.textContent = F.int(base);
      setTimeout(function () {
        App.countTo($("#done-n"), 0, 100, null, 700);
        App.countTo(pill, base, base + 100, null, 700, function () { var w = $("#hd-pts"); if (w) { w.classList.add("is-bump"); setTimeout(function () { w.classList.remove("is-bump"); }, 220); } });
      }, App.reduce ? 0 : 380);
      App.live(t("d.paid.st"));
    }
  };

  /* =====================================================================
     RESULTS
     ===================================================================== */
  App.screens.results = function () {
    var head = '<div class="say"><h1>' + t("v.results.h", { p: F.int(M.week.pts) }) + "</h1></div>";
    if (st === "loading") { App.mount({ tab: "results", docTitle: t("r.title"), body: head + C.skel([["100%", 104], ["100%", 50], ["40%", 24], ["100%", 64], ["100%", 64], ["100%", 64]]) }); return; }
    if (st === "error") { App.mount({ tab: "results", docTitle: t("r.title"), body: '<div class="say"><h1>' + t("r.title") + "</h1></div>" + C.error() }); return; }
    if (st === "empty") { App.mount({ tab: "results", docTitle: t("r.title"), body: '<div class="say"><h1>' + t("r.title") + "</h1></div>" + C.state({ icon: "results", h: t("r.empty.h"), b: t("r.empty.b"), btn: t("r.empty.btn"), href: App.url("home.html") }) }); return; }
    var filter = "all";
    var sum = '<section class="sec sec--tight"><div class="blk trio" role="group" aria-label="' + esc(t("r.sum.sr")) + '">' +
      "<div><span>" + t("r.week") + "</span><b>" + F.pts(M.week.pts) + "</b><small>" + t("r.sum.hits", { a: M.week.hits, b: M.week.answered }) + "</small></div>" +
      "<div><span>" + t("r.all") + "</span><b>" + F.pts(M.all.pts) + "</b><small>" + t("r.sum.rate", { n: M.all.rate }) + "</small></div>" +
      "<div><span>" + t("r.pending") + "</span><b>+" + F.pts(M.user.pendingHit) + "</b><small>" + t("r.at", { time: "22:10" }) + "</small></div></div></section>";
    var seg = '<section class="sec sec--tight">' + C.seg("rfilter", [{ v: "all", label: t("r.f.all") }, { v: "wait", label: t("r.f.wait") }, { v: "set", label: t("r.f.set") }], "all", t("r.filter")) + "</section>";
    App.mount({ tab: "results", docTitle: t("r.title"), body: head + sum + seg + '<div id="rdays" class="sec" style="margin-top:0"></div>' });
    function outcome(r, q) {
      var p50 = "+50P";
      switch (r.out) {
        case "wait": return '<b class="is-zero">' + t("r.o.waitat", { time: r.exp }) + "</b><small>" + t("r.o.ifhit") + "</small>";
        case "pend": return '<b class="is-hit">' + p50 + "</b><small>" + t("r.o.hit") + ", " + t("r.at", { time: r.at }) + "</small>";
        case "hit": return '<b class="is-hit">' + p50 + "</b><small>" + t("r.o.hit") + "</small>";
        case "corr": return '<b class="is-hit">' + p50 + "</b><small>" + t("r.o.corr") + "</small>";
        case "miss": return '<b class="is-zero">' + t("r.o.miss") + "</b>";
        case "void": return '<b class="is-zero">' + t("r.o.void") + "</b>";
        default: return '<b class="is-zero">' + t("r.o.none") + "</b>";
      }
    }
    function render() {
      var html = "", any = false;
      M.results.forEach(function (d, di) {
        var rows = d.rows.filter(function (r) { return filter === "all" || (filter === "wait" ? /wait|pend/.test(r.out) : /hit|miss|corr|void/.test(r.out)); });
        if (!rows.length) return; any = true;
        var name = d.day === 0 ? t("common.today") : d.day === 1 ? t("common.yesterday") : F.weekday(M.ago(d.day)), inv = M.invite.days[d.day];
        html += '<div class="rday"><div class="rday-h"><h2>' + name + '</h2><b class="' + (d.total ? "" : "is-zero") + '">+' + F.pts(d.total) + '</b></div><div class="rday-sub"><span>' + (d.done ? t("r.g.done") : t("r.g.part", { k: d.answered })) + "</span>" + (d.pending ? "<span>" + t("r.g.pending", { q: d.pending }) + "</span>" : "") + '</div><div class="rlist">' +
          rows.map(function (r, ri) {
            var q = App.q(r.q), can = /hit|miss|corr|void/.test(r.out), xid = "rx-" + di + "-" + ri;
            var ans = r.out === "miss" ? q[r.c === "l" ? "r" : "l"] : q[r.c];
            return "<" + (can ? 'button type="button" aria-expanded="false" aria-controls="' + xid + '" data-disc' : "div") + ' class="rrow"><span><span class="rrow-q">' + esc(q.title) + '</span><span class="rrow-s">' + (r.c ? C.pick(r.c, q[r.c]) : "") + '</span></span><span class="rrow-o">' + outcome(r, q) + "</span>" +
              (can ? '<span class="rrow-x blk" id="' + xid + '" hidden>' + (r.out === "void" ? '<span class="cap">' + t("r.o.void.line") + "</span>" : C.kv(t("r.x.answer"), esc(ans)) + C.kv(t("r.x.evidence"), t("p.evidence")) + (r.out === "corr" ? '<span class="cap">' + t("r.o.corr.line", { date: F.date(M.ago(d.day)) }) + "</span>" : "")) + "</span>" : "") +
              "</" + (can ? "button" : "div") + ">";
          }).join("") +
          (inv && filter === "all" ? '<div class="rrow rrow--inv"><span><span class="rrow-q">' + t("r.inv") + '</span><span class="rrow-s">' + t("r.inv.sub", { r: M.invite.rate }) + '</span></span><span class="rrow-o"><b>+' + F.pts(inv.pts) + "</b></span></div>" : "") + "</div>" + "</div>";
      });
      if (!any) html = '<p class="lbl" style="padding:32px 0">' + t(filter === "wait" ? "r.fe.wait" : "r.fe.set") + "</p>";
      $("#rdays").innerHTML = html; App.enhance($("#rdays"));
    }
    C.segBind("rfilter", function (v) { filter = v; render(); });
    render();
  };

  /* =====================================================================
     WEEKLY RANKING
     ===================================================================== */
  App.screens.ranking = function () {
    var last = st === "lastweek", top = st === "top10", unranked = st === "unranked", hold = App.hold;
    var seg = '<section class="sec sec--tight" style="margin-top:4px">' + C.seg("rkweek", [{ v: "this", label: t("r.week"), href: App.url("ranking.html") }, { v: "last", label: t("k.lastweek"), href: App.url("ranking.html", "lastweek") }], last ? "last" : "this", t("k.week")) + "</section>";
    if (st === "loading") { App.mount({ tab: "rank", docTitle: t("k.title"), body: seg + C.skel([["60%", 34], ["100%", 96], ["30%", 24], ["100%", 150], ["100%", 56], ["100%", 56]]) }); return; }
    if (st === "error") { App.mount({ tab: "rank", docTitle: t("k.title"), body: seg + C.error() }); return; }
    var list = M.ranking.map(function (r) { return { rank: r.rank, name: r.name, pts: r.pts, prize: r.prize }; });
    var me = { rank: M.me.rank, pts: M.me.pts };
    if (top) { list[6].name = M.user.name; list[6].me = true; me = { rank: 7, pts: list[6].pts, prize: list[6].prize }; }
    var s = M.untilWeekEnd(), dh = t("k.dh", { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600) });
    var say = last ? '<div class="say"><h1>' + t("k.last", { rank: t("k.rankth", { n: 8 }), amount: "38.52" }) + "</h1><p>" + t("k.sent") + "</p></div>"
      : unranked ? '<div class="say"><h1>' + t("k.none") + "</h1></div>"
      : '<div class="say"><h1>' + t("v.rank.h", { n: me.rank }) + "</h1><p>" + (top ? t("k.in") + " " + t("k.prize", { c: F.dec(me.prize, 2) }) : t("k.gap", { gap: M.me.gap })) + "</p></div>";
    var pool = '<section class="sec sec--tight"><div class="blk"><div class="pool"><div><span class="lbl">' + (last ? t("k.final.h") : t("k.pool")) + "</span>" + C.num('<span id="pool-n">' + F.int(M.pool.ct) + "</span>", "CT") + "</div>" +
      (last ? '<span class="chip chip--blue">' + t("k.sent") + "</span>" : '<div class="pool-end">' + t("k.ends") + "<b>" + dh + "</b></div>") + "</div>" +
      '<button type="button" class="link" id="split-btn">' + t("k.split.q") + "</button></div></section>";
    function podCol(r, h, dl) {
      return '<div class="pod-col pod-col--' + r.rank + '"><b class="pod-name">' + esc(r.name) + '</b><span class="pod-pts">' + F.pts(r.pts) + '</span><div class="pod-bar" style="--bh:' + h + "px;--dl:" + dl + 'ms"><span class="pod-rank"><span class="sr">' + t("k.rank.sr", { n: r.rank }) + '</span><span aria-hidden="true">' + r.rank + '</span></span><span class="pod-prize">' + F.dec(r.prize, 2) + "<small>CT</small></span></div></div>";
    }
    function rk(r, right) {
      return '<div class="rk' + (r.me ? " is-me" : "") + '"><span class="rk-n"><span class="sr">' + t("k.rank.sr", { n: r.rank }) + '</span><span aria-hidden="true">' + r.rank + '</span></span><span class="rk-who"><b>' + esc(r.name) + (r.me ? " (" + t("k.you") + ")" : "") + "</b><small>" + F.pts(r.pts) + '</small></span><span class="rk-v">' + right + "</span></div>";
    }
    var board = '<section class="sec"><div class="sec-h"><h2>' + t("k.top") + "</h2>" + (last ? "" : C.live()) + "</div>" +
      '<div class="pod">' + podCol(list[1], 104, 60) + podCol(list[0], 136, 0) + podCol(list[2], 88, 120) + "</div>" +
      '<div class="rk-cols"><span>' + t("v.rank.col") + "</span><span>" + t("k.col.prize") + "</span></div>" +
      list.slice(3).map(function (r) { return rk(r, F.dec(r.prize, 2) + " CT"); }).join("") +
      '<p class="cap" style="margin-top:12px">' + t("k.tie") + "</p></section>";
    var around = (top || unranked || last) ? "" : '<section class="sec" id="around"><div class="sec-h"><h2>' + t("k.around") + '</h2><span class="cap">' + t("k.around.sub", { a: M.around[0].rank, b: M.around[M.around.length - 1].rank }) + "</span></div>" +
      M.around.map(function (r) { var g = r.pts - me.pts; return rk(r, r.me ? (hold ? t("hold.rank.row") : t("k.you")) : (g > 0 ? t("k.gap.up", { n: g }) : g < 0 ? t("k.gap.down", { n: -g }) : t("k.gap.same"))); }).join("") + "</section>";
    var pinned = "";
    if (unranked) pinned = '<div class="cta"><a class="btn" href="' + App.url("home.html") + '">' + t("k.play") + "</a></div>";
    else if (!last) pinned = '<button type="button" class="mebar" id="mebar"><span class="mebar-n">' + t("k.rankth", { n: me.rank }) + '</span><span class="mebar-t"><b>' + esc(M.user.name) + "</b><small>" + (hold ? t("hold.rank.pin") : top ? t("k.prize", { c: F.dec(me.prize, 2) }) : t("k.gap", { gap: M.me.gap })) + '</small></span><span class="mebar-v">' + F.pts(me.pts) + "</span></button>";
    App.mount({ tab: "rank", docTitle: t("k.title"), body: seg + say + (hold ? '<section class="sec sec--tight">' + C.holdNote("hold.rank") + "</section>" : "") + pool + board + around, pinned: pinned });
    $("#split-btn").addEventListener("click", function () {
      App.sheet.open('<h2 id="sheet-h">' + t("k.split.q") + "</h2><p>" + t("k.pool.line", { n: F.int(M.pool.players) }) + '</p><div class="split" role="list" aria-label="' + esc(t("k.split.share")) + '">' +
        M.pool.split.map(function (p, i) { return '<div role="listitem"><span>' + t("k.rankth", { n: i + 1 }) + "</span><b>" + p + "%</b></div>"; }).join("") + '</div><p class="cap" style="margin-top:16px">' + t("k.split.note") + '</p><p class="cap" style="margin-top:8px">' + t("k.tie.note") + '</p><button type="button" class="btn btn--plain" data-close>' + t("common.close") + "</button>");
    });
    var mb = $("#mebar"); if (mb) mb.addEventListener("click", function () { var a = $("#around") || $(".rk.is-me"); if (a) a.scrollIntoView({ behavior: App.reduce ? "auto" : "smooth", block: "center" }); });
    if (!last && !App.reduce) App.countTo($("#pool-n"), M.pool.ct - 40, M.pool.ct, null, 600);
  };

  /* =====================================================================
     LOGIN
     ===================================================================== */
  App.screens.login = function () {
    var I = window.CJ_I18N;
    var langSeg = C.seg("lang", I.langs.map(function (l) { return { v: l, label: l === "en" ? "EN" : I.names[l] }; }), App.lang, t("lang.label"));
    var end = '<div style="width:196px">' + langSeg + "</div>";
    function mount(body, cta) { App.mount({ bare: true, end: end, docTitle: t("a.h1"), body: '<div class="auth">' + body + "</div>", cta: cta, offText: "a.offline" }); C.segBind("lang", function (v) { I.setLang(v); }); }
    if (st === "setup") {
      mount('<div class="say"><h1>' + t("a.setup.h1") + "</h1><p>" + t("a.setup.body") + '</p></div><div class="sec sec--tight"><ol class="setup">' +
        '<li class="is-done">' + C.checkMark("check--sm") + t("a.setup.s1") + '</li><li class="is-now"><span class="setup-ic">' + C.spin() + "</span>" + t("a.setup.s2") + '</li><li><span class="setup-ic"></span>' + t("a.setup.s3") + "</li></ol></div>");
      setTimeout(function () { location.href = App.url("first-run.html"); }, 2600);
      return;
    }
    if (st === "code" || st === "wrong") {
      var bad = st === "wrong";
      mount('<div class="say"><h1>' + t("v.login.code.h") + "</h1><p>" + t("a.code.body", { email: "<b>" + esc(M.user.email) + "</b>" }) + "</p></div>" +
        '<div class="sec sec--tight"><label class="field"><span class="sr">' + t("a.code.label") + '</span><input class="inp inp--code" id="code" name="code" spellcheck="false" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="' + (bad ? "418203" : "") + '" placeholder="000000"' + (bad ? ' aria-invalid="true"' : "") + ' aria-describedby="code-msg"></label>' +
        '<p class="field-msg' + (bad ? " field-msg--err" : "") + '" id="code-msg">' + (bad ? t("a.code.wrong") : t("a.code.tip")) + "</p>" +
        '<p class="cap" style="margin-top:20px">' + t("a.code.resendin", { s: 42 }) + '</p><a class="link" href="' + App.url("login.html") + '">' + t("a.code.change") + "</a></div>",
        '<button type="button" class="btn" id="go">' + t("a.code.btn") + "</button>");
      $("#go").addEventListener("click", function () {
        var v = $("#code").value.replace(/\D/g, "");
        if (v.length < 6) { $("#code").setAttribute("aria-invalid", "true"); var m = $("#code-msg"); m.className = "field-msg field-msg--err"; m.textContent = t("a.code.short"); return; }
        location.href = App.url("login.html", "setup");
      });
      return;
    }
    var badMail = st === "bademail", sending = st === "sending";
    mount('<div class="say"><h1>' + t("v.login.h") + "</h1><p>" + t("a.lede") + "</p></div>" +
      '<div class="sec sec--tight"><label class="field"><span class="field-l">' + t("a.email.label") + '</span><input class="inp" id="email" name="email" spellcheck="false" type="email" inputmode="email" autocomplete="email" placeholder="name@gmail.com" value="' + (badMail ? "minji@naver" : sending ? M.user.email : "") + '"' + (badMail ? ' aria-invalid="true"' : "") + ' aria-describedby="email-msg"></label>' +
      '<p class="field-msg' + (badMail ? " field-msg--err" : "") + '" id="email-msg">' + (badMail ? t("a.email.bad") : t("a.email.cap", { list: M.providerNames })) + "</p></div>" +
      '<div class="facts"><ul class="ticks">' + ["a.fact.1", "a.fact.2", "a.fact.3"].map(function (f) { return "<li>" + C.icon("check", 20) + "<span>" + t(f) + "</span></li>"; }).join("") + "</ul></div>" +
      '<div class="sec sec--tight"><button type="button" class="disc" data-disc aria-expanded="false" aria-controls="help-a">' + t("a.help.q") + C.icon("down1", 20) + '</button><div class="disc-p" id="help-a" hidden><p>' + t("a.help.a") + "</p></div></div>" +
      '<p class="fine">' + t("a.fine", { terms: '<a href="#" data-nolink>' + t("a.terms") + "</a>", privacy: '<a href="#" data-nolink>' + t("a.privacy") + "</a>" }) + "</p>",
      '<button type="button" class="btn" id="go"' + (sending ? ' aria-disabled="true"' : "") + ">" + (sending ? C.spin() + t("a.email.sending") : t("a.email.btn")) + "</button>");
    $("#go").addEventListener("click", function () {
      if (App.offline) { App.toast(t("a.offline")); return; }
      var inp = $("#email"), v = inp.value.trim(), m = $("#email-msg");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { inp.setAttribute("aria-invalid", "true"); m.className = "field-msg field-msg--err"; m.textContent = v ? t("a.email.bad") : t("a.email.empty"); inp.focus(); return; }
      this.setAttribute("aria-disabled", "true"); this.innerHTML = C.spin() + t("a.email.sending");
      setTimeout(function () { location.href = App.url("login.html", "code"); }, 900);
    });
  };

  /* =====================================================================
     FIRST RUN: three steps, each built from real product pieces
     ===================================================================== */
  App.screens["first-run"] = function () {
    var step = +st || 1; if (/^code/.test(st)) step = 1;
    var linked = st === "code-valid" ? M.invite.by : null;
    var ARTS = {
      1: '<div class="ob-stack"><span class="ob-side ob-side--l">' + C.icon("left") + '</span><div class="ob-card"><i></i><i></i></div><span class="ob-side ob-side--r">' + C.icon("right") + "</span></div>",
      2: '<div class="ob-two"><div class="prog">' + "<i class='is-done'></i>".repeat(5) + '</div><div class="ob-three"><div>' + C.num("+100", "P", "num--blue") + "<small>" + t("v.o.2.all") + "</small></div><div>" + C.num("+50", "P", "num--md") + "<small>" + t("v.o.2.hit") + "</small></div></div></div>",
      3: '<div class="ob-three"><div>' + C.num("1,000", "P", "num--md") + "</div>" + C.icon("right") + "<div>" + C.num("1", "CT", "num--blue") + "</div></div>"
    };
    function body() {
      return '<div class="ob-art" aria-hidden="true">' + ARTS[step] + '</div><div class="ob-dots" role="img" aria-label="' + esc(t("o.step", { n: step })) + '">' + [1, 2, 3].map(function (n) { return '<i class="' + (n === step ? "is-on" : "") + '"></i>'; }).join("") + "</div>" +
        '<div class="say" style="padding-top:20px"><h1>' + t("v.o." + step + ".h") + "</h1><p>" + t("o." + step + ".b") + "</p></div>" +
        (step === 1 ? '<div class="sec sec--tight">' + (linked ? '<p class="field-msg field-msg--ok">' + t("o.code.ok", { name: linked, w: M.invite.welcome }) + "</p>" : '<button type="button" class="link" id="code-open">' + t("o.code.q") + "</button>") + "</div>" : "");
    }
    function draw() {
      App.mount({ bare: true, end: '<a class="link link--quiet" href="' + App.url("home.html", "fresh") + '">' + t("o.skip") + "</a>", docTitle: t("o.1.h"), body: body(),
        cta: '<button type="button" class="btn" id="next">' + (step === 3 ? t("o.start") : t("o.next")) + "</button>" });
      $("#next").addEventListener("click", function () { if (step === 3) { location.href = App.url("home.html", "fresh"); return; } step++; draw(); });
      var co = $("#code-open"); if (co) co.addEventListener("click", codeSheet);
    }
    function codeSheet() {
      App.sheet.open('<h2 id="sheet-h">' + t("o.code.q") + "</h2><p>" + t("o.code.help") + '</p><div class="inp-wrap" style="margin-top:20px"><input class="inp inp--act" id="icode" name="invite-code" autocomplete="off" spellcheck="false" autocapitalize="characters" maxlength="8" placeholder="' + esc(t("o.code.ph")) + '" aria-label="' + esc(t("o.code.ph")) + '" aria-describedby="icode-msg"><button type="button" class="btn btn--sm btn--plain inp-act" id="icode-go">' + t("o.code.apply") + '</button></div><p class="field-msg" id="icode-msg">' + t("o.code.short") + '</p><button type="button" class="btn btn--plain" data-close>' + t("o.code.without") + "</button>");
      $("#icode-go").addEventListener("click", function () {
        var v = $("#icode").value.trim().toUpperCase(), m = $("#icode-msg"), name = M.invite.known[v];
        if (!/^[A-Z2-9]{6,8}$/.test(v)) { m.className = "field-msg field-msg--err"; m.textContent = t("o.code.short"); return; }
        if (v === M.invite.self) { m.className = "field-msg field-msg--err"; m.textContent = t("o.code.own"); return; }
        if (!name) { m.className = "field-msg field-msg--err"; m.textContent = t("o.code.unknown"); return; }
        linked = name; App.sheet.close(); draw();
      });
    }
    draw();
    if (st === "code") codeSheet();
  };

  /* =====================================================================
     ACCOUNT ON HOLD: the one screen that explains it
     ===================================================================== */
  App.screens.hold = function () {
    var body = '<div class="state" style="padding-bottom:0"><span class="state-ic">' + C.icon("pause", 26) + "</span><h2 role=\"heading\" aria-level=\"1\">" + t("sys.blocked.h") + "</h2><p>" + t("sys.blocked.b") + "</p></div>" +
      '<section class="sec sec--tight"><div class="blk"><h2 class="num num--sm">' + t("sys.blocked.works.h") + '</h2><ul class="ticks">' + [1, 2, 3, 4].map(function (n) { return "<li>" + C.icon("check", 20) + "<span>" + t("sys.blocked.works." + n) + "</span></li>"; }).join("") + '</ul><p class="cap" style="margin-top:8px">' + t("sys.blocked.fee") + "</p></div>" +
      '<div class="blk"><h2 class="num num--sm">' + t("sys.blocked.stops.h") + '</h2><ul class="ticks ticks--off">' + [1, 2, 3, 4, 5].map(function (n) { return "<li>" + C.icon("x", 20) + "<span>" + t("sys.blocked.stops." + n) + "</span></li>"; }).join("") + "</ul></div>" +
      '<p class="cap" style="margin-top:16px">' + t("sys.blocked.note") + "</p></section>";
    App.mount({ back: App.url("home.html", "hold"), title: t("hold.t"), docTitle: t("hold.t"), body: body,
      cta: '<button type="button" class="btn" id="mail">' + t("sys.blocked.contact") + '</button><a class="btn btn--plain" href="' + App.url("wallet.html", "hold") + '">' + t("sys.blocked.btn") + "</a>" });
    $("#mail").addEventListener("click", function () { App.copy("support@cojam.app", t("common.copied") + ": support@cojam.app"); });
  };
})();
