/* Matchday, the pitch side: login, first run, home (cards and list), day done, results, ranking. */
(function () {
  "use strict";
  var A = window.App, T = A.t, M = A.M, $ = A.$, $$ = A.$$, esc = A.esc, fmt = A.fmt, IC = A.ic, ST = A.state;
  var S = {};
  function go(url) { location.href = url; }
  function tally(ans) { var l = 0, r = 0; Object.keys(ans).forEach(function (k) { if (ans[k] === "l") l++; else r++; }); return { l: l, r: r }; }

  /* ================= HOME, card view ================= */
  S.home = function () {
    var main = A.shell({ screen: "home", tab: "home", title: T("h.title"), skeleton: '<div class="sk" style="height:32px;width:60%"></div><div class="sk" style="flex:1;min-height:430px"></div><div class="sk" style="height:34px"></div>' });
    if (!main) return;
    var ans = ST === "partial" ? { q1: "r", q2: "l" } : ST === "last" ? { q1: "r", q2: "l", q3: "l", q4: "r" } : {};
    var offline = ST === "offline", last = null, busy = false, lastTimer = null, endTimer = null, dragged = false;
    function count() { return Object.keys(ans).length; }
    function rest() { return M.set.filter(function (id) { return !ans[id]; }); }

    function strip() {
      var n = count();
      return '<div class="ms"><span class="lt" id="ms-lt">' + T("md.card") + '</span><span class="pips" aria-hidden="true">' + M.set.map(function (id, i) { return '<i class="' + (ans[id] ? "done" : i === n ? "now" : "") + '"></i>'; }).join("") +
        '</span><span class="sr" id="ms-sr" role="status">' + T("h.prog.sr", { n: n }) + '</span><a class="hd-btn viewsw" style="margin-left:auto" href="home-list.html" aria-label="' + T("h.view.label") + ": " + T("h.view.term") + '">' + IC.list + "</a></div>";
    }
    function card(id, pos) {
      var Q = A.q(id);
      return '<article class="fx" data-q="' + id + '" data-pos="' + pos + '" aria-label="' + T("h.qn.sr", { n: Q.n }) + '">' +
        (ST === "noimage" ? '<div class="fx-art none">' + A.art.pitch : '<div class="fx-art"><img src="' + Q.img + '" alt="" draggable="false">') +
        '<div class="fx-tags"><span class="lt">' + T("md.match", { n: Q.n }) + '</span></div><span class="tag on-img fx-cat">' + T("cat." + Q.cat) + "</span></div>" +
        '<div class="fx-body"><h2 class="fx-title disp">' + esc(Q.title) + '</h2><div class="fx-meta"><p>' + esc(T("h.answer", { rule: Q.rule })) + "</p><p>" + esc(T("h.ai", { time: Q.settle })) + '</p><button class="ib" aria-label="' + T("h.ai.h") + '">' + IC.info + "</button></div></div>" +
        A.face(Q) +
        '<div class="fx-wipe l" aria-hidden="true"><span><span class="side-k">' + IC.al + T("h.t.pick") + '</span><span class="side-n">' + esc(Q.left) + "</span></span></div>" +
        '<div class="fx-wipe r" aria-hidden="true"><span><span class="side-k">' + T("h.t.pick") + IC.ar + '</span><span class="side-n">' + esc(Q.right) + "</span></span></div></article>";
    }
    function notice(h, b, btn, href) {
      return '<div class="empty">' + A.art.board + '<h2 class="disp caps">' + h + "</h2><p>" + b + "</p>" + (btn ? '<a class="btn go" href="' + href + '">' + btn + "</a>" : "") + "</div>";
    }
    if (ST === "hold") { A.put(main, notice(T("hold.home.h"), T("hold.home.b"), T("hold.home.btn"), "hold.html")); return; }
    if (ST === "empty") { A.put(main, notice(T("h.empty.h"), T("h.empty.b", { time: T("time.kst9") }))); return; }
    if (ST === "closed") { A.put(main, notice(T("h.closed"), T("d.next.at"), T("h.closed.btn"), "home.html")); return; }

    A.put(main, strip() + '<div class="deck" id="deck"></div><div class="dock" id="dock"></div>' +
      '<div class="tk"><span class="tk-tag">' + T("h.closes") + '&nbsp;<span id="tk-clock" style="font-family:var(--f-disp);font-weight:700"></span></span><div class="tk-roll" id="tk-roll"></div></div><p class="sr" id="live" aria-live="polite"></p>');
    var deck = $("#deck"), dock = $("#dock"), live = $("#live");

    function layout() {
      var ids = rest();
      $$(".fx", deck).forEach(function (c) { var p = ids.indexOf(c.getAttribute("data-q")); c.setAttribute("data-pos", p); c.style.zIndex = 5 - p; c.style.display = p > 2 ? "none" : ""; c.setAttribute("aria-hidden", p > 0); $$("button", c).forEach(function (b) { b.tabIndex = p === 0 ? 0 : -1; if (offline) b.disabled = true; }); });
    }
    function renderDeck() { deck.innerHTML = rest().map(function (id, i) { return card(id, i); }).join(""); $$(".fx", deck).forEach(bind); layout(); }
    function refreshStrip() {
      var n = count(); $$(".pips i", main).forEach(function (p, i) { p.className = ans[M.set[i]] ? "done" : i === n ? "now" : ""; });
      $("#ms-sr").textContent = T("h.prog.sr", { n: n }); ticker.set(n);
    }
    function hint() { dock.innerHTML = '<p class="hint">' + (offline ? T("h.offline") : T("h.hint.touch")) + "</p>"; }

    /* drag */
    function paint(c, dx) {
      c.style.transform = "translateX(" + dx + "px) rotate(" + (dx * 0.04).toFixed(2) + "deg)";
      var p = Math.min(1, Math.abs(dx) / 100), r = $(".fx-wipe.r", c), l = $(".fx-wipe.l", c);
      r.style.opacity = dx > 4 ? 1 : 0; l.style.opacity = dx < -4 ? 1 : 0; r.classList.toggle("show", dx > 4); l.classList.toggle("show", dx < -4);
      r.style.transform = "translateX(" + (100 - 62 * (dx > 0 ? p : 0)) + "%) skewX(-12deg)";
      l.style.transform = "translateX(" + (-100 + 62 * (dx < 0 ? p : 0)) + "%) skewX(-12deg)";
    }
    function release(c) { c.classList.add("settle"); c.style.transform = ""; $$(".fx-wipe", c).forEach(function (w) { w.style.transform = ""; w.style.opacity = ""; setTimeout(function () { if (!w.style.opacity) w.classList.remove("show"); }, 280); }); }
    function bind(c) {
      var sx = 0, sy = 0, dx = 0, drag = false, pid = null, t0 = 0;
      c.addEventListener("pointerdown", function (e) { if (offline || c.getAttribute("data-pos") !== "0" || e.target.closest(".ib")) return; sx = e.clientX; sy = e.clientY; dx = 0; drag = false; pid = e.pointerId; t0 = e.timeStamp; });
      c.addEventListener("pointermove", function (e) {
        if (pid !== e.pointerId) return; dx = e.clientX - sx; var dy = e.clientY - sy;
        if (!drag) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag = true; c.classList.remove("settle"); try { c.setPointerCapture(pid); } catch (x) {} } else return; }
        e.preventDefault(); paint(c, dx);
      });
      function up(e) {
        if (pid !== e.pointerId) return; pid = null; if (!drag) return; dragged = true; setTimeout(function () { dragged = false; }, 60);
        var v = dx / Math.max(1, e.timeStamp - t0);
        if (e.type === "pointerup" && (Math.abs(dx) > 88 || (Math.abs(v) > 0.5 && Math.abs(dx) > 36))) commit(dx > 0 ? "r" : "l", dx); else release(c);
      }
      c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
      c.addEventListener("click", function (e) {
        if (dragged) { e.preventDefault(); return; }
        var b = e.target.closest(".side"); if (b && !b.disabled) { commit(b.getAttribute("data-dir"), 0); return; }
        if (e.target.closest(".ib")) aiSheet(A.q(c.getAttribute("data-q")));
      });
    }
    function aiSheet(Q) {
      A.sheet(T("h.ai.h"), '<ol class="steps"><li>' + T("h.ai.1") + "</li><li>" + T("h.ai.2") + "</li><li>" + T("h.ai.3") + '</li></ol><dl class="kv"><div><dt>' + T("h.ai.src") + "</dt><dd>" + esc(Q.rule) + "</dd></div><div><dt>" + T("h.ai.when") + "</dt><dd>" + esc(T("h.ai.after", { time: Q.settle })) + '</dd></div></dl><button class="btn ink wide" onclick="App.closeSheet()">' + T("common.done") + "</button>");
    }

    function seal() { /* the previous pick's undo window ends */
      clearTimeout(lastTimer); clearInterval(endTimer); if (last && last.el) last.el.remove(); last = null;
    }
    function commit(dir, dx) {
      var c = $('.fx[data-pos="0"]', deck); if (!c || busy || offline) return;
      seal(); busy = true;
      var id = c.getAttribute("data-q"), Q = A.q(id), sign = dir === "r" ? 1 : -1, W = deck.offsetWidth, w = $(".fx-wipe." + dir, c);
      c.classList.remove("settle"); w.classList.add("show"); w.style.opacity = 1;
      var from = c.style.transform || "none", to = "translateX(" + sign * (W * 1.5 + 90) + "px) rotate(" + sign * 12 + "deg)";
      var wf = w.style.transform || "translateX(" + sign * 100 + "%) skewX(-12deg)";
      var dur = A.rm ? 1 : dx ? 240 : 380;
      if (w.animate) w.animate([{ transform: wf }, { transform: "translateX(0%) skewX(-12deg)" }], { duration: dur * 0.6, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
      var fly = c.animate ? c.animate([{ transform: from }, { transform: from, offset: dx ? 0 : 0.35 }, { transform: to }], { duration: dur, easing: "cubic-bezier(.5,0,.9,.3)", fill: "forwards" }) : null;
      ans[id] = dir; last = { id: id, dir: dir, el: c, fly: fly };
      if (fly) fly.onfinish = function () { if (ans[id]) c.style.visibility = "hidden"; };
      c.setAttribute("data-pos", "-1"); c.style.zIndex = 9; c.style.pointerEvents = "none";
      $$(".fx", deck).forEach(function (x) { if (x !== c) x.classList.add("settle"); });
      layoutKeep(c); refreshStrip();
      live.textContent = T("h.live.picked", { choice: dir === "l" ? Q.left : Q.right, k: 5 - count() });
      setTimeout(function () { busy = false; if (count() === 5) ending(); }, A.rm ? 0 : Math.min(dur, 200));
      if (count() < 5) undoBar(Q, dir);
      else dock.innerHTML = "";
    }
    function layoutKeep(out) { var ids = rest(); $$(".fx", deck).forEach(function (c) { if (c === out) return; var p = ids.indexOf(c.getAttribute("data-q")); c.setAttribute("data-pos", p); c.style.zIndex = 5 - p; c.style.display = p > 2 ? "none" : ""; c.setAttribute("aria-hidden", p > 0); $$("button", c).forEach(function (b) { b.tabIndex = p === 0 ? 0 : -1; }); }); }
    function undoBar(Q, dir) {
      dock.innerHTML = '<div class="undo in"><span class="undo-t">' + esc(T("h.sync", { n: Q.n, choice: dir === "l" ? Q.left : Q.right })) + '</span><button class="undo-b" id="undo" aria-label="' + esc(T("h.undo.aria", { n: Q.n, choice: dir === "l" ? Q.left : Q.right })) + '">' + IC.undo + T("h.undo") + '</button><i class="undo-drain"></i></div>';
      var d = $(".undo-drain", dock); if (d.animate) d.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: 3000, fill: "forwards" });
      $("#undo").onclick = undo;
      lastTimer = setTimeout(function () { seal(); dock.innerHTML = '<div class="undo saved"><span class="undo-t">' + T("h.saved") + "</span></div>"; lastTimer = setTimeout(hint, 1200); }, 3000);
    }
    function undo() {
      if (!last) return; clearTimeout(lastTimer); clearInterval(endTimer);
      var c = last.el, id = last.id, Q = A.q(id); delete ans[id]; last = null;
      var e = $(".endp", deck); if (e) e.remove();
      var cur = getComputedStyle(c).transform; if (c.getAnimations) c.getAnimations().forEach(function (a) { a.cancel(); });
      $$(".fx-wipe", c).forEach(function (w) { if (w.getAnimations) w.getAnimations().forEach(function (a) { a.cancel(); }); w.style.transform = ""; w.style.opacity = ""; w.classList.remove("show"); });
      c.style.pointerEvents = ""; c.style.visibility = ""; c.style.transform = ""; c.classList.remove("settle");
      $$(".fx", deck).forEach(function (x) { if (x !== c) x.classList.add("settle"); });
      layout();
      if (c.animate && !A.rm) c.animate([{ transform: cur === "none" ? "translateX(120%) rotate(12deg)" : cur }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
      refreshStrip(); hint(); live.textContent = T("h.undone", { n: Q.n });
      var b = $(".side", c); if (b) b.focus({ preventScroll: true });
    }
    function ending() {
      var n = 3;
      deck.insertAdjacentHTML("beforeend", '<div class="endp in" style="z-index:8" role="status"><span class="lt bulb">' + T("md.match", { n: 5 }) + '</span><h2 class="disp caps">' + T("h.end.h") + '</h2><p id="end-in">' + T("h.end.in", { n: n }) + "</p>" + A.fd("3", "lg") +
        '<button class="btn go" id="finish">' + T("h.end.now") + '</button><button class="undo-b" id="undo">' + IC.undo + T("h.undo") + "</button></div>");
      var fdEl = $(".endp .fd", deck);
      function fin() { clearInterval(endTimer); try { sessionStorage.setItem("md.tally", JSON.stringify(tally(ans))); } catch (x) {} go("done.html?state=moment"); }
      $("#finish").onclick = fin; $("#undo").onclick = undo;
      endTimer = setInterval(function () { n--; if (n <= 0) { fin(); return; } A.fdSet(fdEl, String(n)); $("#end-in").textContent = T("h.end.in", { n: n }); }, 1000);
    }
    document.addEventListener("keydown", function (e) {
      if ($(".sheet")) return;
      if (e.key === "ArrowLeft") commit("l", 0); else if (e.key === "ArrowRight") commit("r", 0);
    });

    /* ticker: one line at a time rolls up */
    var ticker = (function () {
      var host = $("#tk-roll"), i = 0, items = [];
      function build(n) {
        items = [T("h.left", { n: 5 - n }), T("k.pool") + " <b>" + fmt(M.pool.ct) + "</b> CT", T("p.rank") + " <b>" + T("k.rankth", { n: M.me.rank }) + "</b>", T("k.ends") + " <b>" + T("k.dh", { d: Math.floor(M.untilWeekEnd() / 86400), h: Math.floor(M.untilWeekEnd() % 86400 / 3600) }) + "</b>"];
      }
      function show() { var old = $(".tk-i.on", host); if (old) { old.className = "tk-i off"; setTimeout(function () { old.remove(); }, 450); } var el = document.createElement("span"); el.className = "tk-i"; el.innerHTML = items[i % items.length]; host.appendChild(el); el.getBoundingClientRect(); el.className = "tk-i on"; }
      build(count()); show();
      if (!A.rm) setInterval(function () { i++; show(); }, 3600);
      var end = Date.now() + M.untilNextSet() * 1000, ck = $("#tk-clock");
      function tick() { ck.textContent = A.hms(Math.max(0, Math.round((end - Date.now()) / 1000))); } tick(); setInterval(tick, 1000);
      return { set: function (n) { build(n); i = 0; show(); } };
    })();

    renderDeck(); hint();
    if (count() === 5) ending();
  };

  /* ================= HOME, list view ================= */
  S["home-list"] = function () {
    var main = A.shell({ screen: "home-list", tab: "home", title: T("h.title") });
    if (!main) return;
    var ans = ST === "fresh" ? {} : { q1: "r", q2: "l" }, offline = ST === "offline", last = null, timer = null;
    function n() { return Object.keys(ans).length; }
    function item(id) {
      var Q = A.q(id), a = ans[id];
      return '<li class="fl-i' + (a ? " picked" : "") + '" data-q="' + id + '"><div class="fl-h"><span class="lt">' + T("md.matchn", { n: Q.n }) + '</span><div><h2 class="fl-t disp">' + esc(Q.title) + '</h2><p class="fl-m">' + esc(T("h.ai", { time: Q.settle })) + "</p></div></div>" +
        A.face(Q).replace('data-dir="' + a + '"', 'data-dir="' + a + '" aria-pressed="true"').replace('class="side ' + a + '"', 'class="side ' + a + ' on"') +
        (a ? '<p class="fl-s"><span>' + esc(T("h.t.chose", { choice: a === "l" ? Q.left : Q.right })) + "</span><span>" + T("h.saved") + "</span></p>" : "") + "</li>";
    }
    function draw() {
      $("#fl").innerHTML = M.set.map(item).join("");
      $("#fl-c").textContent = T("h.left", { n: 5 - n() });
      if (offline) $$("#fl .side").forEach(function (b) { b.disabled = true; });
      $$("#fl .picked .side").forEach(function (b) { b.disabled = true; });
    }
    A.put(main, '<div class="ms"><span class="lt">' + T("md.card") + '</span><span class="small dim" id="fl-c"></span><a class="hd-btn" style="margin-left:auto" href="home.html" aria-label="' + T("h.view.label") + ": " + T("h.view.card") + '">' + IC.cards + '</a></div><ul class="fl rise" id="fl"></ul><div class="dock" id="dock" style="position:sticky;bottom:calc(var(--tab) + 8px);z-index:5"></div><p class="hint">' + (offline ? T("h.offline") : T("h.sub")) + "</p>");
    draw();
    $("#fl").addEventListener("click", function (e) {
      var b = e.target.closest(".side"); if (!b || b.disabled) return;
      var id = b.closest(".fl-i").getAttribute("data-q"), Q = A.q(id), dir = b.getAttribute("data-dir");
      clearTimeout(timer); ans[id] = dir; last = id; draw();
      var done = n() === 5;
      $("#dock").innerHTML = '<div class="undo in"><span class="undo-t">' + esc(done ? T("h.end.h") : T("h.sync", { n: Q.n, choice: dir === "l" ? Q.left : Q.right })) + '</span><button class="undo-b" id="undo">' + IC.undo + T("h.undo") + '</button><i class="undo-drain"></i></div>';
      var d = $(".undo-drain"); if (d.animate) d.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: 3000, fill: "forwards" });
      $("#undo").onclick = function () { clearTimeout(timer); delete ans[last]; draw(); $("#dock").innerHTML = ""; };
      timer = setTimeout(function () { if (done) { try { sessionStorage.setItem("md.tally", JSON.stringify(tally(ans))); } catch (x) {} go("done.html?state=moment"); } else $("#dock").innerHTML = ""; }, 3000);
    });
  };

  /* ================= DAY DONE: full time ================= */
  S.done = function () {
    var saving = ST === "saving", welcome = ST === "welcome", moment = ST === "moment" && !A.rm;
    var base = M.user.points, gain = 100 + (welcome ? M.invite.welcome : 0);
    var main = A.shell({ screen: "done", tab: "home", title: T("md.fulltime"), points: moment || saving ? base : base + gain });
    if (!main) return;
    var tl = null; try { tl = JSON.parse(sessionStorage.getItem("md.tally")); } catch (x) {}
    var rows = M.results[0].rows;
    if (!tl) { tl = { l: 0, r: 0 }; rows.forEach(function (r) { tl[r.c]++; }); }
    function score(cls, l, r) {
      return '<div class="' + cls + '"><div class="ft-team l"><i class="kit-sw l"></i><span>' + T("md.left") + "</span></div>" + A.fd(l + ":" + r, cls === "ft-score" ? "xl" : "lg") +
        '<div class="ft-team r"><i class="kit-sw r"></i><span>' + T("md.right") + '</span></div><span class="sr">' + T("md.final.sr", { l: tl.l, r: tl.r }) + "</span></div>";
    }
    var sorted = M.set.map(function (id) { return rows.filter(function (r) { return r.q === id; })[0]; });
    A.put(main, '<div class="rise stack s16" style="gap:14px">' +
      '<section class="board final"><span class="lt bulb">' + T("md.final") + '</span><h1 class="disp caps">' + T("d.h1") + "</h1>" + score("final-score", tl.l, tl.r) +
      '<div class="paid">' + (saving ? '<span class="row" style="justify-content:center"><i class="spin"></i><span class="board-l">' + T("d.saving.st") + "</span></span>"
        : '<span class="lt bulb">+100P</span><span class="board-l">' + T("d.paid.st") + "</span>" + (welcome ? '<span class="lt kit" style="font-size:20px;min-height:30px">+' + M.invite.welcome + "P " + T("d.wel.tag") + '</span><span class="board-l">' + T("d.wel.note", { name: M.invite.by, w: M.invite.welcome }) + "</span>" : "")) + "</div></section>" +
      '<div class="next"><div><p style="font-weight:700">' + T("d.next") + '</p><p class="small dim">' + T("d.next.at") + '</p></div><div id="next-clock"></div></div>' +
      '<section class="day"><div class="day-h"><span class="lt">' + T("d.picks") + '</span><span class="small dim">' + T("d.waitn", { n: 4 }) + '</span></div><div class="flips">' +
      sorted.map(function (r) { var Q = A.q(r.q), pend = r.out === "pend";
        return '<div class="mr"><span class="mk ' + (pend ? "w" : "p") + '">' + (pend ? T("md.w") : IC.clock) + '</span><div><p class="mr-t">' + esc(Q.title) + '</p><p class="mr-p">' + A.pk(r.c, r.c === "l" ? Q.left : Q.right) + '</p><p class="mr-o' + (pend ? " good" : "") + '">' + (pend ? "<b>" + T("d.hitpending", { time: r.at }) + "</b>" : T("r.o.waitat", { time: r.exp })) + "</p></div></div>"; }).join("") +
      '</div></section><p class="small dim">' + T("d.hit.1") + " " + T("d.hit.2") + '</p><div class="stack"><a class="btn go wide" href="ranking.html">' + T("d.rank") + '</a><a class="btn alt wide" href="results.html">' + T("d.results") + "</a></div></div>");
    A.clock($("#next-clock"), M.untilNextSet());
    if (!moment) return;

    /* the full time whistle: about 2.2 s, any tap or key skips it */
    var ft = document.createElement("div"); ft.className = "ft"; ft.setAttribute("role", "status");
    ft.innerHTML = '<i class="ft-sweep"></i><i class="ft-sweep b"></i><button class="ft-skip">' + T("o.skip") + '</button><h2 class="ft-title disp caps">' + T("md.fulltime") + "</h2>" + score("ft-score", 0, 0) +
      '<div class="ft-bonus"><span class="lt bulb">+100P</span><span class="ft-pts"><b id="ft-pts">' + fmt(base) + "</b> P</span></div>";
    document.body.appendChild(ft);
    var anims = [], timers = [], over = false, E = "cubic-bezier(.2,.8,.2,1)";
    function an(el, kf, o) { o.fill = "both"; var a = el.animate(kf, o); anims.push(a); return a; }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    var sw = $$(".ft-sweep", ft), cells = $$(".ft-score .fd i", ft);
    an(sw[0], [{ transform: "translateX(-110%) skewX(-12deg)" }, { transform: "translateX(110%) skewX(-12deg)" }], { duration: 520, easing: "cubic-bezier(.6,0,.3,1)" });
    an(sw[1], [{ transform: "translateX(-110%) skewX(-12deg)" }, { transform: "translateX(110%) skewX(-12deg)" }], { duration: 520, delay: 90, easing: "cubic-bezier(.6,0,.3,1)" });
    an($(".ft-title", ft), [{ opacity: 0, transform: "scale(1.5) skewX(-8deg)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 260, easing: "cubic-bezier(.3,1.4,.5,1)" });
    an($(".ft-score", ft), [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { duration: 280, delay: 520, easing: E });
    function countUp(cell, to, t0) { for (var k = 1; k <= to; k++) (function (k) { at(t0 + (k - 1) * 150, function () { cell.textContent = k; cell.animate([{ transform: "rotateX(-90deg)" }, { transform: "none" }], { duration: 150, easing: E }); }); })(k); }
    countUp(cells[0], tl.l, 760); countUp(cells[1], tl.r, 760);
    an($(".ft-bonus", ft), [{ opacity: 0, transform: "translateX(-60px) skewX(-10deg)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 1340, easing: E });
    at(1500, function () { A.roll($("#ft-pts"), base, base + gain, 500); });
    at(2250, finish);
    function finish() {
      if (over) return; over = true; timers.forEach(clearTimeout);
      A.roll($("#bug-n"), base, base + gain, 500);
      var out = ft.animate([{ transform: "none" }, { transform: "translateX(-105%)" }], { duration: 340, easing: "cubic-bezier(.5,0,.9,.3)", fill: "forwards" });
      out.onfinish = function () { ft.remove(); };
      $$(".rise > *", main).forEach(function (c) { c.style.animation = "none"; c.getBoundingClientRect(); c.style.animation = ""; });
      $$(".flips .mk", main).forEach(function (c) { c.style.animation = "none"; c.getBoundingClientRect(); c.style.animation = ""; });
    }
    ft.addEventListener("click", finish);
    document.addEventListener("keydown", function k() { document.removeEventListener("keydown", k); finish(); });
    window.__ftFinish = finish;
  };

  /* ================= RESULTS: the results table ================= */
  S.results = function () {
    var main = A.shell({ screen: "results", tab: "results", title: T("r.title") });
    if (!main) return;
    if (ST === "empty") { A.put(main, '<div class="empty">' + A.art.board + '<h2 class="disp caps">' + T("r.empty.h") + "</h2><p>" + T("r.empty.b") + '</p><a class="btn go" href="home.html">' + T("r.empty.btn") + "</a></div>"); return; }
    var W = M.week, filter = "all";
    function mark(out, sm) {
      var c = { hit: "w", pend: "w", corr: "w", miss: "l", wait: "p", void: "v", none: "v" }[out];
      var g = c === "w" ? T("md.w") : c === "l" ? T("md.l") : out === "wait" ? IC.clock : out === "void" ? IC.close : IC.cross;
      return '<span class="mk ' + c + (sm ? " sm" : "") + '" aria-hidden="true">' + g + "</span>";
    }
    function outcome(r) {
      switch (r.out) {
        case "wait": return "<b>" + T("r.o.waitat", { time: r.exp }) + "</b>, " + T("r.o.ifhit");
        case "pend": return '<b>' + T("r.o.hit") + "</b>, " + T("r.o.pend", { time: r.at });
        case "hit": return "<b>" + T("d.hitp") + "</b>";
        case "miss": return "<b>" + T("r.o.miss") + "</b>";
        case "corr": return "<b>" + T("r.o.corr") + ", " + T("r.o.added") + "</b><br>" + T("r.o.corr.line", { date: A.date(M.ago(0.5)) });
        case "void": return "<b>" + T("r.o.void") + "</b><br>" + T("r.o.void.line");
        default: return "<b>" + T("r.o.none") + "</b>";
      }
    }
    function dayName(d) { return d === 0 ? T("common.today") : d === 1 ? T("common.yesterday") : A.date(M.ago(d)); }
    function days() {
      var html = M.results.map(function (D) {
        var rows = D.rows.filter(function (r) { return filter === "all" || (filter === "wait" ? r.out === "wait" || r.out === "pend" : r.out !== "wait" && r.out !== "pend" && r.out !== "none"); });
        if (!rows.length) return "";
        var inv = M.invite.days[D.day];
        return '<section class="day"><div class="day-h"><span class="lt">' + dayName(D.day) + '</span><span class="tot">+' + D.total + "P" + (D.pending ? "<small>" + T("r.g.pending", { q: D.pending }) + "</small>" : "") + '</span></div><p class="day-s"><span>' + (D.done ? T("r.g.done") : T("r.g.part", { k: D.answered })) + '</span></p><div class="flips">' +
          rows.map(function (r) { var Q = A.q(r.q), good = r.out === "hit" || r.out === "pend" || r.out === "corr";
            return '<div class="mr">' + mark(r.out) + '<div><p class="mr-t">' + esc(Q.title) + "</p>" + (r.c ? '<p class="mr-p"><span>' + T("r.you", { choice: "" }).replace(/[:：]?\s*$/, "") + "</span>" + A.pk(r.c, r.c === "l" ? Q.left : Q.right) + "</p>" : "") + '<p class="mr-o' + (good ? " good" : "") + '">' + outcome(r) + "</p></div></div>"; }).join("") + "</div>" +
          (inv && filter === "all" ? '<p class="day-s" style="border-top:1px solid var(--rule);border-bottom:0"><span>' + T("r.inv") + '</span><b style="color:var(--ink)">+' + inv.pts + "P</b></p>" : "") + "</section>";
      }).join("");
      return html || '<p class="notice plain">' + (filter === "wait" ? T("r.fe.wait") : T("r.fe.set")) + "</p>";
    }
    var all = []; M.results.forEach(function (D) { D.rows.forEach(function (r) { all.push(r.out); }); });
    var cnt = { h: 0, m: 0, w: 0 }; all.forEach(function (o) { if (o === "hit" || o === "pend" || o === "corr") cnt.h++; else if (o === "miss") cnt.m++; else if (o === "wait") cnt.w++; });
    A.put(main, '<div class="rise stack" style="gap:14px"><section class="board" aria-label="' + T("r.sum.sr") + '"><div class="stats">' +
      '<div><p class="board-l">' + T("r.week") + '</p><p class="board-n" id="wk">' + fmt(W.pts) + '<small>P</small></p></div>' +
      '<div><p class="board-l">' + T("r.hits") + '</p><p class="board-n">' + W.hits + "<small>/" + W.answered + '</small></p></div>' +
      '<div><p class="board-l">' + T("r.days") + '</p><p class="board-n">' + W.days + "</p></div></div><hr>" +
      '<div class="row sb"><span class="board-l">' + T("r.all") + '</span><span style="font-weight:600">' + fmt(M.all.pts) + "P, " + T("r.sum.rate", { n: M.all.rate }) + '</span></div><hr>' +
      '<div class="row sb"><span class="board-l">' + T("md.form") + '</span><span class="form flips">' + all.filter(function (o) { return o !== "none"; }).slice(0, 8).map(function (o) { return mark(o, true); }).join("") + '</span><span class="sr">' + T("r.marks.sr", cnt) + "</span></div></section>" +
      '<div class="fil" role="group" aria-label="' + T("r.filter") + '">' + [["all", "r.f.all"], ["wait", "r.f.wait"], ["set", "r.f.set"]].map(function (f) { return '<button data-f="' + f[0] + '" aria-pressed="' + (f[0] === "all") + '">' + T(f[1]) + "</button>"; }).join("") + "</div>" +
      '<div id="days" class="stack" style="gap:12px">' + days() + "</div>" +
      '<button class="btn alt wide" id="more">' + T("r.more") + "</button>" +
      '<details class="q"><summary>' + T("r.legend") + IC.down + '</summary><div class="q-b"><ul class="legend">' +
      [["hit", "r.o.hit"], ["miss", "r.o.miss"], ["wait", "r.o.wait"], ["void", "r.o.void"], ["none", "r.o.none"]].map(function (x) { return "<li>" + mark(x[0], true) + "<span>" + T(x[1]) + "</span></li>"; }).join("") + "</ul><p>" + T("r.o.pend.help") + "</p></div></details>" +
      '<details class="q"><summary>' + T("p.answers.q") + IC.down + '</summary><div class="q-b"><p>' + T("p.answers.a") + "</p></div></details></div>");
    A.roll($("#wk").firstChild, 0, W.pts, 700);
    main.addEventListener("click", function (e) {
      var b = e.target.closest("[data-f]"); if (b) { filter = b.getAttribute("data-f"); $$("[data-f]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); $("#days").innerHTML = days(); $$("#days .mk").forEach(function (c, i) { c.style.setProperty("--i", i); }); }
      if (e.target.closest("#more")) A.toast(T("common.loading"));
    });
  };

  /* ================= RANKING: the league table ================= */
  S.ranking = function () {
    var lastweek = ST === "lastweek", none = ST === "none", hold = ST === "hold";
    var main = A.shell({ screen: "ranking", tab: "rank", title: lastweek ? T("k.final.h") : T("k.title") });
    if (!main) return;
    var P = M.pool, me = M.me, left = M.untilWeekEnd();
    function row(r, i, promo) {
      return '<li class="lg-r' + (promo ? " promo" : "") + (r.me ? " me" : "") + '"' + (r.me ? ' aria-current="true"' : "") + '><span class="lg-rank"><span class="sr">' + T("k.rank.sr", { n: r.rank }) + '</span><span aria-hidden="true">' + r.rank + '</span></span><span class="lg-name">' + esc(r.name) + (r.me ? '<span class="lg-you">' + T("k.you") + "</span>" : "") +
        '</span><span class="lg-pts">' + fmt(r.pts) + '</span><span class="lg-prize">' + (r.prize ? "<b>" + fmt(r.prize, 2) + "</b> CT" : r.me && hold ? T("hold.rank.row") : r.me ? T("k.gap.same") : r.pts > me.pts ? T("k.gap.up", { n: r.pts - me.pts }) : r.pts < me.pts ? T("k.gap.down", { n: me.pts - r.pts }) : T("k.gap.same")) + "</span></li>";
    }
    var h = '<div class="rise stack" style="gap:14px">';
    h += '<section class="board"><div class="board-split"><div><p class="board-l">' + T("k.pool") + '</p><p class="board-n"><span id="pool">' + fmt(P.ct) + '</span><small>CT</small></p></div><div style="text-align:right"><p class="board-l">' + (lastweek ? T("k.lastweek") : T("k.ends")) + '</p><p class="board-n" style="font-size:30px;color:var(--on-board)">' + (lastweek ? T("k.sent") : T("k.dh", { d: Math.floor(left / 86400), h: Math.floor(left % 86400 / 3600) })) + '</p><p class="board-l">' + (lastweek ? T("k.final.time") : T("k.endat")) + "</p></div></div><hr><p>" + (lastweek ? T("k.last", { rank: T("k.rankth", { n: 8 }), amount: "38.52" }) : T("k.pool.line", { n: fmt(P.players) })) + "</p></section>";
    if (hold) h += '<div class="notice"><i class="card-i y"></i><h2>' + T("hold.rank.pin") + "</h2><p>" + T("hold.rank") + '</p><a class="link" href="hold.html">' + T("hold.more") + "</a></div>";
    if (none) h += '<div class="notice plain"><p>' + T("k.none") + '</p><a class="btn go" style="justify-self:start;margin-top:6px" href="home.html">' + T("k.play") + "</a></div>";
    else if (!lastweek) h += '<section class="panel ink-b" style="padding:0 14px 12px 0;gap:8px"><span class="lt" style="align-self:flex-start">' + T("md.club") + '</span><div class="row sb" style="padding-left:14px"><div><p class="fig">' + T("k.rankth", { n: me.rank }) + '</p></div><div style="text-align:right"><p style="font-weight:700">' + esc(M.user.name) + ", " + fmt(me.pts) + 'P</p><p class="small dim">' + (hold ? T("hold.rank.row") : T("k.gap", { gap: me.gap })) + "</p></div></div></section>";
    h += '<section class="lgt" aria-label="' + T("md.table") + '"><div class="lg-h" aria-hidden="true"><span>' + T("md.col.rank") + "</span><span>" + T("k.top") + "</span><span>" + T("md.col.pts") + "</span><span>" + T("k.col.prize") + '</span></div><ol class="rows">' + M.ranking.map(function (r, i) { return row(r, i, true); }).join("") + "</ol>" +
      '<p class="lg-cut">' + T("md.prizeline") + "</p>" +
      (none || lastweek ? "" : '<div class="lg-h" aria-hidden="true" style="border-top:1.5px solid var(--ink)"><span>' + T("md.col.rank") + "</span><span>" + T("k.around") + "</span><span>" + T("md.col.pts") + "</span><span>" + T("k.col.gap") + '</span></div><ol class="rows" style="--base:10">' + M.around.map(function (r, i) { return row(r, i + 10, false); }).join("") + "</ol>") + "</section>";
    h += '<p class="small dim">' + T("k.tie") + " " + T("k.tie.note") + "</p>";
    h += '<details class="q"><summary>' + T("k.split.q") + IC.down + '</summary><div class="q-b"><p class="label">' + T("k.split.share") + '</p><ol class="split">' + P.split.map(function (s, i) { return "<li><b>" + s + "%</b>" + T("k.rankth", { n: i + 1 }) + "</li>"; }).join("") + "</ol><p>" + T("k.split.note") + "</p></div></details></div>";
    A.put(main, h);
    $$(".rows").forEach(function (g, gi) { $$(":scope > *", g).forEach(function (c, i) { c.style.setProperty("--i", i + gi * 10); }); });
    A.roll($("#pool"), 0, P.ct, 800);
  };

  /* ================= LOGIN ================= */
  S.login = function () {
    var main = A.shell({ screen: "login", bare: true, title: T("a.h1") });
    var view = ST === "code" || ST === "wrong" ? "code" : ST === "setup" ? "setup" : "email", email = ST ? M.user.email : "";
    function hero(h, b) {
      return '<div class="gatehero on-dark"><div class="row sb"><img class="mark" src="assets/cojam-mark.svg" alt="Cojam">' + A.langSwitch().replace('class="lang"', 'class="lang" style="max-width:220px"') + '</div><h1 class="disp caps">' + h + "</h1><p>" + b + "</p></div>";
    }
    function draw() {
      var h = "";
      if (ST === "offline") h += '<div class="offbar" style="margin-bottom:14px"><i class="card-i y"></i><span>' + T("a.offline") + "</span></div>";
      if (view === "email") {
        var bad = ST === "bad";
        h += hero(T("a.h1"), T("a.lede")) + '<form class="stack" id="f" novalidate style="gap:12px"><div class="field"><label for="em">' + T("a.email.label") + '</label><div class="inp' + (bad ? " bad" : "") + '"><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="you@gmail.com" value="' + (bad ? "minji@naver" : esc(email)) + '"' + (bad ? ' aria-invalid="true" aria-describedby="em-e"' : "") + '></div>' +
          '<p class="msg bad" id="em-e"' + (bad ? "" : " hidden") + '><i class="card-i r"></i><span>' + T("a.email.bad") + '</span></p><p class="msg">' + T("a.email.cap", { list: M.providerNames }) + '</p></div><button class="btn go wide">' + T("a.email.btn") + "</button></form>" +
          '<ul class="ticks">' + [1, 2, 3].map(function (i) { return "<li>" + IC.check + "<span>" + T("a.fact." + i) + "</span></li>"; }).join("") + "</ul>" +
          '<details class="q"><summary>' + T("a.help.q") + IC.down + '</summary><div class="q-b"><p>' + T("a.help.a") + '</p></div></details><p class="small dim">' + T("a.fine", { terms: "<u>" + T("a.terms") + "</u>", privacy: "<u>" + T("a.privacy") + "</u>" }) + '</p><p class="small dim">' + T("g.top") + "</p>";
      } else if (view === "code") {
        var wrong = ST === "wrong";
        h += hero(T("a.code.h1"), T("a.code.body", { email: esc(email || "minji@naver.com") })) + '<form class="stack" id="f2" novalidate style="gap:12px"><div class="field"><label for="cd">' + T("a.code.h") + '</label><div class="inp code-in' + (wrong ? " bad" : "") + '"><input id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="' + (wrong ? "481920" : "") + '" aria-label="' + T("a.code.label") + '"></div>' +
          '<p class="msg bad" id="cd-e"' + (wrong ? "" : " hidden") + '><i class="card-i r"></i><span>' + T("a.code.wrong") + '</span></p></div><button class="btn go wide">' + T("a.code.btn") + '</button></form><p class="msg">' + T("a.code.tip") + '</p><p class="small dim">' + T("a.code.resendin", { s: 42 }) + '</p><button class="link" id="chg">' + T("a.code.change") + "</button>";
      } else {
        h += hero(T("a.setup.h1"), T("a.setup.body")) + '<section class="panel ink-b"><h2 class="h2 disp">' + T("a.setup.h") + '</h2><ol class="setup">' + [1, 2, 3].map(function (i) { return '<li data-i="' + i + '"><span class="mk sm p">' + i + "</span><span>" + T("a.setup.s" + i) + '</span><span class="st">' + T("tx.st.wait") + "</span></li>"; }).join("") + "</ol></section>";
      }
      main.innerHTML = h;
      if (view === "setup") {
        var li = $$(".setup li", main), i = 0;
        (function step() {
          if (i > 0) { li[i - 1].className = ""; $(".st", li[i - 1]).textContent = T("tx.st.done"); $(".mk", li[i - 1]).className = "mk sm w"; $(".mk", li[i - 1]).innerHTML = IC.check; }
          if (i === 3) { if (ST !== "setup") setTimeout(function () { go("first-run.html"); }, 500); return; }
          li[i].className = "now"; $(".st", li[i]).innerHTML = '<i class="spin"></i>'; i++;
          if (ST === "setup" && i === 2) return; setTimeout(step, 900);
        })();
      }
      var f = $("#f"); if (f) f.onsubmit = function (e) { e.preventDefault(); var v = $("#em").value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { $("#em-e").hidden = false; $(".inp", f).classList.add("bad"); $("#em").setAttribute("aria-invalid", "true"); $("#em").focus(); return; } email = v; view = "code"; draw(); $("#cd").focus(); };
      var f2 = $("#f2"); if (f2) f2.onsubmit = function (e) { e.preventDefault(); if ($("#cd").value.replace(/\D/g, "").length < 6) { $("#cd-e").hidden = false; $("#cd-e span").textContent = T("a.code.short"); return; } view = "setup"; draw(); };
      var c = $("#chg"); if (c) c.onclick = function () { view = "email"; draw(); };
    }
    draw();
  };

  /* ================= FIRST RUN ================= */
  S["first-run"] = function () {
    var main = A.shell({ screen: "first-run", bare: true, title: T("o.1.h") });
    var step = ST === "2" ? 2 : ST === "3" || ST === "code" ? 3 : 1, Q = A.q("q4");
    var art = {
      1: '<div style="position:absolute;inset:0">' + A.art.pitch.replace("<svg", '<svg width="100%" height="100%"') + '</div><div style="position:relative;width:78%;display:flex;flex-direction:column;gap:10px"><span class="lt bulb" style="align-self:flex-start">' + T("md.match", { n: 1 }) + '</span><div class="mini-face"><span class="side l"><span class="side-n">' + esc(Q.left) + '</span></span><span class="side r"><span class="side-n">' + esc(Q.right) + '</span></span><span class="vs">' + T("md.vs") + '</span></div><div class="row sb" style="color:var(--on-board-2)">' + IC.al.replace("<svg", '<svg width="28" height="28"') + '<span class="pips"><i class="now"></i><i></i><i></i><i></i><i></i></span>' + IC.ar.replace("<svg", '<svg width="28" height="28"') + "</div></div>",
      2: '<div class="ob-fig"><div>' + A.fd("100", "lg") + '<span class="lt bulb">+100P</span><span>' + T("o.2.a") + '</span></div><div>' + A.fd("50", "lg") + '<span class="lt kit">+50P</span><span>' + T("o.2.c") + "</span></div></div>",
      3: '<div class="ob-fig"><div>' + A.fd("1000", "lg") + "<span>P</span></div>" + IC.ar.replace("<svg", '<svg width="32" height="32"') + "<div>" + A.fd("1", "lg") + "<span>CT</span></div></div>"
    };
    function draw() {
      main.innerHTML = '<div class="row sb"><span class="lt">' + T("o.step", { n: step }) + '</span><span class="pips" aria-hidden="true">' + [1, 2, 3].map(function (i) { return '<i class="' + (i < step ? "done" : i === step ? "now" : "") + '"></i>'; }).join("") + '</span><a class="link" style="margin-left:auto" href="home.html">' + T("o.skip") + "</a></div>" +
        '<div class="ob"><div class="ob-panel on"><div class="ob-art">' + art[step] + '</div><h1 class="ob-h disp caps">' + T("o." + step + ".h") + "</h1><p>" + T("o." + step + ".b") + "</p>" +
        (step === 3 ? '<div class="field"><label for="ic">' + T("o.code.q") + "<span>" + T("o.code.opt") + '</span></label><div class="inp"><input id="ic" autocapitalize="characters" maxlength="8" placeholder="' + T("o.code.ph") + '" value="' + (ST === "code" ? "DALGONA4" : "") + '"><button class="btn sm ink" id="ap" type="button">' + T("o.code.apply") + '</button></div><p class="msg" id="ic-m">' + (ST === "code" ? IC.check.replace("<svg", '<svg width="18" height="18" style="flex:none"') + "<span>" + T("o.code.ok", { name: "dalgona", w: M.invite.welcome }) + "</span>" : T("o.code.help")) + "</p></div>" : "") +
        '</div><div class="ob-nav">' + A.langSwitch().replace('class="lang"', 'class="lang" style="max-width:190px"') + (step < 3 ? '<button class="btn go" id="nx">' + T("o.next") + "</button>" : '<a class="btn go" href="home.html">' + T("o.start") + "</a>") + "</div></div>";
      var nx = $("#nx"); if (nx) nx.onclick = function () { step++; draw(); $(".ob-h").setAttribute("tabindex", "-1"); $(".ob-h").focus({ preventScroll: true }); };
      var ap = $("#ap"); if (ap) ap.onclick = function () {
        var v = $("#ic").value.trim().toUpperCase(), m = $("#ic-m"), k = M.invite.known[v];
        m.className = "msg" + (k ? "" : " bad");
        m.innerHTML = k ? IC.check.replace("<svg", '<svg width="18" height="18" style="flex:none"') + "<span>" + T("o.code.ok", { name: k, w: M.invite.welcome }) + "</span>" : '<i class="card-i r"></i><span>' + (v.length < 6 ? T("o.code.short") : v === M.invite.self ? T("o.code.own") : T("o.code.unknown")) + "</span>";
      };
    }
    draw();
  };

  window.MD_SCREENS = S;
  var name = document.body.getAttribute("data-screen"); if (S[name]) S[name]();
})();
