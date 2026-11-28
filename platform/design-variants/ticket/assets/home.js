/* Home (card deck and list) and Day done. The deck follows the finger; the stub tears at the perforation and drops into the tray. */
(function () {
  "use strict";
  var T = window.TK, t = T.t, M = T.M, ic = T.ic, esc = T.esc;
  var UNDO_MS = 3000, ARM = 0.35, STUB_H = 76;

  function head(view) {
    return '<div class="home-head"><div><h1 class="hd-1">' + t("h.title") + '</h1><p class="closes">' + t("h.closes") + ' <span class="num" data-cd="set"></span></p></div>' +
      '<div class="seg" role="group" aria-label="' + t("h.view.label") + '"><a href="' + T.url("home.html", T.state) + '"' + (view === "card" ? ' aria-current="true"' : "") + ">" + t("h.view.card") + '</a><a href="' + T.url("home-list.html", T.state) + '"' + (view === "list" ? ' aria-current="true"' : "") + ">" + t("h.view.term") + "</a></div></div>";
  }
  function serial(n) { return '<span class="serial">' + t("tk.no") + ' <span class="num">' + T.serialDay() + "-" + n + '</span><span class="sr">' + t("h.qn.sr", { n: n }) + "</span></span>"; }
  function stub(q, off) {
    var dis = off ? ' aria-disabled="true"' : "";
    return '<div class="card-stub piece"><div class="tkt-b">' +
      '<button type="button" class="ans ans--l" data-side="l"' + dis + ' aria-label="' + esc(t("h.pick.aria", { choice: q.left, q: q.title })) + '">' + ic("left") + "<span>" + esc(q.left) + "</span></button>" +
      '<button type="button" class="ans ans--r" data-side="r"' + dis + ' aria-label="' + esc(t("h.pick.aria", { choice: q.right, q: q.title })) + '"><span>' + esc(q.right) + "</span>" + ic("right") + "</button>" +
      '<div class="stub-ink" aria-hidden="true"></div></div></div>';
  }
  function rule(q) { return '<dl class="card-f"><div><dt>' + t("h.ai.when") + "</dt><dd>" + t("h.ai.after", { time: esc(q.settle) }) + '</dd></div><div><dt>' + t("r.o.hit") + '</dt><dd><span class="hl">+50P</span></dd></div></dl><div class="card-rule"><span>' + t("h.answer", { rule: "<b>" + esc(q.rule) + "</b>" }) + '</span><button type="button" class="info-btn" data-info="' + q.id + '" aria-label="' + t("h.ai.h") + '">' + ic("info") + "</button></div>"; }
  function aiSheet(q) {
    T.sheet(t("h.ai.h"), '<ol class="steps"><li>' + t("h.ai.1") + "</li><li>" + t("h.ai.2") + "</li><li>" + t("h.ai.3") + '</li></ol><dl class="slip slip--flush rows" style="background:var(--stock-2);box-shadow:none"><div class="row"><dt>' + t("h.ai.src") + "</dt><dd>" + esc(q.rule) + '</dd></div><div class="row"><dt>' + t("h.ai.when") + "</dt><dd>" + t("h.ai.after", { time: esc(q.settle) }) + "</dd></div></dl>" + '<button class="btn btn--line btn--block" data-close>' + t("common.close") + "</button>");
  }
  function trayHTML() { var s = '<div class="tray" id="tray" role="img">'; for (var i = 1; i <= 5; i++) s += '<div class="slot"><span class="num">' + i + "</span></div>"; return s + "</div>"; }
  function barHTML() { return '<div class="pickbar"><span class="pickbar-msg" id="msg"></span><button type="button" class="undo" id="undo" hidden>' + ic("undo") + "<span>" + t("h.undo") + "</span><i></i></button></div>"; }

  function home(view) {
    var st = T.state, main = T.shell({ tab: "home", fit: view === "card" });
    if (st === "loading") { main.innerHTML = head(view) + '<div class="sk" style="flex:1;min-height:320px;border-radius:10px"></div><div class="sk" style="height:46px"></div><span class="sr" role="status">' + t("common.loading") + "</span>"; return; }
    if (st === "empty") { main.innerHTML = head(view) + T.empty(t("h.empty.h"), t("h.empty.b", { time: t("time.kst9") })); return; }
    if (st === "error") { main.innerHTML = head(view) + T.errBox(); return; }
    if (st === "hold") { main.innerHTML = head(view) + T.empty(t("hold.home.h"), t("hold.home.b"), '<a class="btn btn--line" href="' + T.url("hold.html") + '">' + t("hold.home.btn") + "</a>"); return; }
    var offline = st === "offline";
    var pre = st === "fresh" ? 0 : st === "last" ? 4 : 2, sides = ["r", "l", "r", "r"];
    var picks = M.set.slice(0, pre).map(function (id, i) { return { q: id, side: sides[i] }; });
    var undoTo = null, finTo = null, finIv = null, lastCommit = 0;

    main.innerHTML = head(view) + (view === "card" ? '<div class="deck" id="deck"></div>' : '<ol class="stack-2" id="list"></ol>') + trayHTML() + barHTML();
    var tray = document.getElementById("tray"), msg = document.getElementById("msg"), undoBtn = document.getElementById("undo");
    T.tick();

    function fillSlot(i, side, anim) { var s = tray.children[i]; s.innerHTML = '<span class="mini ' + side + (anim ? " in" : "") + '">' + ic(side === "l" ? "left" : "right") + '<span class="num">' + (i + 1) + "</span></span>"; }
    function emptySlot(i) { tray.children[i].innerHTML = '<span class="num">' + (i + 1) + "</span>"; }
    function trayLabel() { tray.setAttribute("aria-label", t("tk.tray", { n: picks.length })); }
    picks.forEach(function (p, i) { fillSlot(i, p.side); }); trayLabel();
    function hint() { msg.innerHTML = offline ? t("h.offline") : (matchMedia("(pointer: coarse)").matches || view === "list" ? t(view === "list" ? "h.hint" : "h.hint.touch") : t("h.hint.keys")); }
    hint();

    function startUndo(p) {
      clearTimeout(undoTo); var q = T.Q(p.q), choice = p.side === "l" ? q.left : q.right;
      msg.innerHTML = "<b>" + esc(t("h.t.chose", { choice: choice })) + "</b>";
      undoBtn.hidden = false; undoBtn.setAttribute("aria-label", t("h.undo.aria", { n: q.n, choice: choice }));
      var bar = undoBtn.querySelector("i"); bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = "";
      T.live(t("h.live.picked", { choice: choice, k: 5 - picks.length }));
      undoTo = setTimeout(function () { undoBtn.hidden = true; if (picks.length < 5) hint(); else msg.textContent = t("h.end.b"); }, UNDO_MS);
    }
    function stopFinish() { clearTimeout(finTo); clearInterval(finIv); var f = document.getElementById("finish"); if (f) f.remove(); }
    function startFinish(host, inline) {
      stopFinish(); var n = 3;
      host.insertAdjacentHTML("beforeend", '<div class="finish' + (inline ? " finish--inline slip" : "") + '" id="finish"><h2 class="hd-2">' + t("h.end.h") + '</h2><div class="fig count" aria-hidden="true" id="fin-n">3</div><p class="muted" id="fin-t" role="status">' + t("h.end.in", { n: 3 }) + '</p><button type="button" class="btn" id="fin-btn">' + t("h.end.now") + "</button></div>");
      document.getElementById("fin-btn").addEventListener("click", finish);
      finIv = setInterval(function () { n--; if (n < 1) return; document.getElementById("fin-n").textContent = n; document.getElementById("fin-t").textContent = t("h.end.in", { n: n }); }, 1000);
      finTo = setTimeout(finish, UNDO_MS);
    }
    function finish() { stopFinish(); clearTimeout(undoTo); document.removeEventListener("keydown", onKey); document.querySelector(".app").classList.remove("app--fit"); renderDone(main, picks, "play"); window.scrollTo(0, 0); }
    function onKey(e) {
      if (e.repeat || e.target.closest("input, a, .sheet") || document.querySelector(".sheet")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); api.pick("l"); } else if (e.key === "ArrowRight") { e.preventDefault(); api.pick("r"); }
      else if ((e.key === "z" || e.key === "Backspace") && !undoBtn.hidden) { e.preventDefault(); api.undo(); }
    }
    document.addEventListener("keydown", onKey);
    undoBtn.addEventListener("click", function () { api.undo(); });
    main.addEventListener("click", function (e) { var b = e.target.closest("[data-info]"); if (b) aiSheet(T.Q(b.dataset.info)); });

    var api = view === "card" ? deck() : list();

    /* ----- card deck ----- */
    function deck() {
      var el = document.getElementById("deck"), cards = {};
      M.set.forEach(function (id, i) {
        if (i < picks.length) return;
        var q = T.Q(id), c = document.createElement("article"); c.className = "card"; c.dataset.q = id;
        c.innerHTML = '<div class="card-body piece"><div class="tkt-a"><div class="card-top">' + serial(q.n) + T.holes(5, 0, "", q.n - 1).replace(/<i class="">/g, "<i>") + '</div><div class="card-art"><span class="cat">' + t("cat." + q.cat) + "</span>" + T.art(id) + '</div><h2 class="card-q">' + esc(q.title) + "</h2>" + rule(q) + "</div></div>" + stub(q, offline);
        c.body = c.querySelector(".card-body"); c.stub = c.querySelector(".card-stub"); c.ink = c.querySelector(".stub-ink"); c.to = [];
        cards[id] = c; el.appendChild(c);
      });
      function setHoles() { Object.keys(cards).forEach(function (id) { var hs = cards[id].querySelectorAll(".holes i"), n = T.Q(id).n; hs.forEach(function (h, i) { h.className = i < picks.length && i < n - 1 ? "on" : (i === n - 1 ? "now" : (i < n - 1 ? "on" : "")); }); }); }
      function layout() {
        M.set.forEach(function (id, i) { var c = cards[id]; if (!c || c.dataset.pos === "out") return; var pos = i - picks.length; if (pos < 0) return; c.dataset.pos = Math.min(pos, 2); c.style.zIndex = 10 - i; c.inert = pos !== 0; });
      }
      function clear(c) { c.to.forEach(clearTimeout); c.to = []; }
      function ink(c, side) { var q = T.Q(c.dataset.q); c.ink.innerHTML = side === "l" ? ic("left") + "<span>" + esc(q.left) + "</span>" : "<span>" + esc(q.right) + "</span>" + ic("right"); c.stub.classList.remove("is-l", "is-r"); c.stub.classList.add("is-" + side); }
      function front() { return cards[M.set[picks.length]]; }
      layout(); setHoles();
      if (st === "fresh" && !T.reduce) front().classList.add("nudge");

      function commit(side) {
        var c = front(); if (!c) return; if (offline) { T.toast(t("h.offline")); return; }
        var W = el.clientWidth, dir = side === "r" ? 1 : -1, idx = picks.length;
        clear(c); c.classList.remove("nudge"); lastCommit = Date.now();
        var p = { q: c.dataset.q, side: side }; picks.push(p);
        c.dataset.pos = "out"; c.style.zIndex = 20; c.inert = true; layout(); setHoles(); trayLabel();
        ink(c, side); c.stub.classList.add("is-armed"); c.stub.style.transition = ""; c.stub.style.transform = "none";
        c.body.style.transition = "transform 420ms var(--ease-out)"; c.body.style.transform = "translate(" + dir * (W + 140) + "px, 70px) rotate(" + dir * 22 + "deg)";
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
        c.to.push(setTimeout(function () {
          var cr = c.getBoundingClientRect(), b = tray.children[idx].getBoundingClientRect();
          c.stub.classList.remove("is-armed"); c.stub.style.transition = "transform 340ms var(--ease-in-out)";
          c.stub.style.transform = "translate(" + (b.left + b.width / 2 - (cr.left + cr.width / 2)) + "px, " + (b.top - (cr.bottom - STUB_H)) + "px) scale(" + (b.width / cr.width) + ", " + (b.height / STUB_H) + ")";
          c.to.push(setTimeout(function () { fillSlot(idx, side, true); c.dataset.pos = "gone"; }, T.reduce ? 0 : 340));
        }, T.reduce ? 0 : 150));
        startUndo(p);
        if (picks.length === 5) c.to.push(setTimeout(function () { startFinish(el); }, T.reduce ? 50 : 520));
      }
      function undo() {
        if (!picks.length || undoBtn.hidden) return;
        var p = picks.pop(), c = cards[p.q], idx = picks.length; clear(c); stopFinish(); clearTimeout(undoTo); undoBtn.hidden = true;
        emptySlot(idx); trayLabel(); c.dataset.pos = "0"; c.inert = false; layout(); setHoles(); c.style.zIndex = 20;
        c.stub.style.transition = "transform 320ms var(--ease-in-out)"; c.stub.style.transform = "none";
        c.body.style.transition = "transform 400ms var(--ease-out)"; c.body.style.transform = "none";
        c.to.push(setTimeout(function () {
          c.stub.classList.remove("is-l", "is-r", "is-armed"); c.stub.style.transition = c.body.style.transition = ""; c.stub.style.transform = c.body.style.transform = ""; c.style.zIndex = 10 - idx;
          var old = c.querySelector(".tape"); if (old) old.remove();
          c.insertAdjacentHTML("beforeend", '<span class="tape in" role="img" aria-label="' + t("tk.taped") + '"></span>');
        }, T.reduce ? 0 : 330));
        msg.textContent = t("h.undone", { n: T.Q(p.q).n }); T.live(msg.textContent);
      }

      /* drag */
      var d = null;
      function tf(dx) { var W = el.clientWidth; return "translate(" + dx + "px, " + Math.abs(dx) * 0.05 + "px) rotate(" + (dx / W * 8) + "deg)"; }
      el.addEventListener("pointerdown", function (e) {
        var c = front(); if (!c || !e.target.closest(".card") || e.target.closest(".info-btn") || c.dataset.pos !== "0" || offline) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        clear(c); c.classList.remove("nudge");
        d = { c: c, x: e.clientX, y: e.clientY, id: e.pointerId, lock: null, armed: null, dx: 0, pts: [{ x: e.clientX, t: e.timeStamp }], moved: false };
      });
      el.addEventListener("pointermove", function (e) {
        if (!d || e.pointerId !== d.id) return;
        var dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.lock) { if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; d.lock = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; if (d.lock === "y") { d = null; return; } try { el.setPointerCapture(d.id); } catch (er) {} d.moved = true; d.c.body.style.transition = "none"; d.c.stub.style.transition = ""; }
        e.preventDefault(); d.dx = dx; d.pts.push({ x: e.clientX, t: e.timeStamp }); if (d.pts.length > 8) d.pts.shift();
        var W = el.clientWidth, armed = Math.abs(dx) > W * ARM ? (dx > 0 ? "r" : "l") : null, m = tf(dx);
        d.c.body.style.transform = m;
        if (armed) {
          if (armed !== d.armed) { ink(d.c, armed); d.c.stub.classList.add("is-armed"); d.c.stub.style.transform = "none"; if (navigator.vibrate) try { navigator.vibrate(5); } catch (er) {} }
        } else {
          if (d.armed) { d.c.stub.classList.remove("is-l", "is-r"); d.until = e.timeStamp + 180; }
          if (!d.until || e.timeStamp > d.until) d.c.stub.classList.remove("is-armed");
          d.c.stub.style.transform = m;
        }
        d.armed = armed;
      });
      function end(e) {
        if (!d || e.pointerId !== d.id) return; var g = d; d = null; if (!g.moved) return;
        var W = el.clientWidth, dx = g.dx, now = e.timeStamp, first = g.pts[0];
        for (var i = 0; i < g.pts.length; i++) if (now - g.pts[i].t <= 100) { first = g.pts[i]; break; }
        var v = (e.clientX - first.x) / Math.max(1, now - first.t), same = v * dx > 0, av = Math.abs(v), ax = Math.abs(dx);
        var go = e.type !== "pointercancel" && (ax > W * ARM || (same && ((ax >= 96 && av >= 0.5) || (ax >= 56 && av >= 1.1))));
        suppress = Date.now();
        if (go) { commit(dx > 0 ? "r" : "l"); return; }
        g.c.stub.classList.remove("is-l", "is-r", "is-armed");
        g.c.body.style.transition = g.c.stub.style.transition = "transform 380ms var(--ease-snap)"; g.c.body.style.transform = g.c.stub.style.transform = "none";
        g.c.to.push(setTimeout(function () { g.c.body.style.transition = g.c.stub.style.transition = ""; g.c.body.style.transform = g.c.stub.style.transform = ""; }, 400));
      }
      var suppress = 0;
      el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
      el.addEventListener("click", function (e) {
        var b = e.target.closest(".ans"); if (!b) return;
        if (Date.now() - suppress < 250) return;            /* the click that ends a drag */
        if (Date.now() - lastCommit < 400) return;          /* a quick double tap never answers two cards */
        commit(b.dataset.side);
      });
      return { pick: function (s) { if (Date.now() - lastCommit < 200) return; commit(s); }, undo: undo };
    }

    /* ----- list view ----- */
    function list() {
      var ol = document.getElementById("list");
      function render() {
        var h = "";
        M.set.forEach(function (id, i) {
          var q = T.Q(id), p = picks[i];
          if (p) h += '<li class="slip lrow">' + T.pick(p.side) + '<div><div class="srow-t">' + esc(q.title) + '</div><div class="srow-s">' + esc(t("h.t.chose", { choice: p.side === "l" ? q.left : q.right })) + '</div></div><span class="num muted">' + T.serialDay() + "-" + q.n + "</span></li>";
          else if (i === picks.length) h += '<li class="tkt lopen"><div class="tkt-a"><div class="card-top">' + serial(q.n) + '<span class="tag tag--quiet">' + t("cat." + q.cat) + '</span></div><h2 class="card-q">' + esc(q.title) + "</h2>" + rule(q) + "</div>" + stub(q, offline).replace(" piece", "") + "</li>";
          else h += '<li class="slip lrow is-next"><span class="n">' + q.n + '</span><div><div class="srow-t">' + esc(q.title) + '</div><div class="srow-s">' + t("cat." + q.cat) + "</div></div></li>";
        });
        ol.innerHTML = h; picks.forEach(function (p, i) { fillSlot(i, p.side); }); for (var i = picks.length; i < 5; i++) emptySlot(i); trayLabel();
      }
      render();
      function pick(side) {
        if (picks.length >= 5) return; if (offline) { T.toast(t("h.offline")); return; }
        var p = { q: M.set[picks.length], side: side }; picks.push(p); lastCommit = Date.now(); render();
        var m = tray.children[picks.length - 1].querySelector(".mini"); if (m) m.classList.add("in");
        startUndo(p); if (picks.length === 5) { ol.insertAdjacentHTML("afterend", '<div id="fin-host"></div>'); startFinish(document.getElementById("fin-host"), true); }
      }
      function undo() { if (!picks.length || undoBtn.hidden) return; var p = picks.pop(); stopFinish(); var fh = document.getElementById("fin-host"); if (fh) fh.remove(); clearTimeout(undoTo); undoBtn.hidden = true; render(); msg.textContent = t("h.undone", { n: T.Q(p.q).n }); T.live(msg.textContent); }
      ol.addEventListener("click", function (e) { var b = e.target.closest(".ans"); if (b && Date.now() - lastCommit > 400) pick(b.dataset.side); });
      return { pick: pick, undo: undo };
    }
  }

  /* ----- Day done: the strip of five prints out, then +100P is stamped on it ----- */
  function renderDone(main, picks, mode) {
    var saving = mode === "saving", pend = { q2: 1 };
    var h = '<div class="between"><h1 class="hd-1">' + t("d.h1") + "</h1>" + '<span class="serial">' + t("tk.no") + ' <span class="num">' + T.serialDay() + '</span></span></div>';
    h += '<div class="done-hero"><div class="strip-clip"><div class="strip" id="strip"><div class="strip-in" id="strip-in">';
    picks.forEach(function (p) {
      var q = T.Q(p.q), hp = pend[p.q] && mode === "still";
      h += '<div class="seg4 srow">' + T.pick(p.side) + '<div><div class="srow-t">' + esc(q.title) + '</div><div class="srow-s">' + esc(t("r.you", { choice: p.side === "l" ? q.left : q.right })) + "</div></div>" +
        '<span class="punch ' + (hp ? "pend" : "wait") + '">' + (hp ? ic("check") : "") + '<span class="sr">' + (hp ? t("d.hitp") : t("d.wait")) + "</span></span></div>";
    });
    h += '<div class="seg4 total"><span id="paid" role="status">' + (saving ? '<span class="spin" style="vertical-align:-3px;margin-right:6px"></span>' + t("d.saving.st") : t("d.paid.st")) + '</span></div><div class="stamp' + (saving ? " is-wait" : "") + '" id="stamp">+100P</div></div></div></div><div class="printer"></div></div>';
    h += '<div class="stack" id="after"><a class="btn btn--block" href="' + T.url("ranking.html") + '">' + t("d.rank") + "</a>" +
      '<div class="slip between"><div><div class="hd-3">' + t("d.next") + '</div><div class="cd"><span class="fig" data-cd="set" style="font-size:var(--fs-28)"></span></div><span class="sr">' + t("d.next.at") + '</span></div><a class="btn btn--line" href="' + T.url("results.html") + '">' + t("d.results") + "</a></div>" +
      '<p class="muted" style="font-size:var(--fs-13)">' + (mode === "still" ? t("d.waitn", { n: 4 }) + ". " + t("d.hitpending", { time: "22:10" }) + ". " : "") + t("d.hit.1") + " " + t("d.hit.2") + "</p></div>";
    main.classList.remove("enter"); main.innerHTML = h; T.tick();
    if (mode !== "play") { main.classList.add("still"); return; }

    var strip = document.getElementById("strip"), inn = document.getElementById("strip-in"), stamp = document.getElementById("stamp"), after = document.getElementById("after");
    var done = false, tos = [], anim = null, from = M.user.points, to = from + 100;
    function final() {
      if (done) return; done = true; tos.forEach(clearTimeout); if (anim) anim.finish(); stamp.style.opacity = ""; after.style.visibility = ""; after.classList.add("after");
      document.removeEventListener("pointerdown", final, true); document.removeEventListener("keydown", final, true);
      var n = document.getElementById("pts-n"); if (n && !n.querySelector(".odo")) n.textContent = T.num(to);
      T.live(t("d.h1") + ". " + t("d.paid.st"));
    }
    after.style.visibility = "hidden";
    if (T.reduce) { stamp.style.opacity = ""; T.bumpPoints(from, to); final(); return; }
    stamp.style.opacity = "0";
    var rows = inn.querySelectorAll(".seg4"), H = strip.offsetHeight, n = rows.length, STEP = 190, D = n * STEP, kf = [], prev = H + 12;
    rows.forEach(function (r, i) { var cur = H - (r.offsetTop + r.offsetHeight); kf.push({ offset: i / n, transform: "translateY(" + prev + "px)", easing: "cubic-bezier(0.23, 1, 0.32, 1)" }); kf.push({ offset: (i + 0.5) / n, transform: "translateY(" + cur + "px)" }); prev = cur; });
    kf.push({ offset: 1, transform: "translateY(0)" });
    anim = strip.animate(kf, { duration: D, fill: "both" });
    tos.push(setTimeout(function () { inn.parentNode.classList.add("is-jolt"); }, D + 20));
    tos.push(setTimeout(function () { stamp.style.opacity = ""; stamp.classList.add("is-slam"); if (navigator.vibrate) try { navigator.vibrate(14); } catch (e) {} }, D + 160));
    tos.push(setTimeout(function () { inn.parentNode.classList.remove("is-jolt"); void inn.offsetWidth; inn.parentNode.classList.add("is-jolt"); T.bumpPoints(from, to); }, D + 330));
    tos.push(setTimeout(final, D + 560));
    setTimeout(function () { document.addEventListener("pointerdown", final, true); document.addEventListener("keydown", final, true); }, 60);   /* skippable */
  }

  T.screens.home = function () { home("card"); };
  T.screens["home-list"] = function () { home("list"); };
  T.screens.done = function () {
    var main = T.shell({ tab: "home", points: T.state === "saving" || T.state === "play" ? M.user.points : M.user.points + 100 });
    var order = {}; M.results[0].rows.forEach(function (r) { order[r.q] = r.c; });
    var picks = M.set.map(function (id) { return { q: id, side: order[id] }; });
    renderDone(main, picks, T.state === "play" ? "play" : T.state === "saving" ? "saving" : "still");
  };
})();
