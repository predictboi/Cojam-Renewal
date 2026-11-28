/* Pixel concept: the play screens (login, first run, home cards, home list, day done, results, ranking). */
(function () {
  "use strict";
  var PX = window.PX, t = PX.t, M = PX.M, A = PX.A, $ = PX.$, $$ = PX.$$, num = PX.num, esc = PX.esc, icon = PX.icon, btn = PX.btn, href = PX.href;
  var S = PX.screens, st = PX.state;
  var UNDO_MS = 3000;

  function scene(cat, px) { return '<div class="scene scene-' + cat + '">' + A.svg(cat, px || 8) + "</div>"; }
  function langSeg() {
    return '<div class="langs"><span class="lbl">' + t("lang.label") + "</span>" + PX.seg(window.CJ_I18N.langs.map(function (l) { return { label: window.CJ_I18N.names[l], v: l }; }), window.CJ_I18N.langs.indexOf(PX.lang), { label: t("lang.label"), cls: "seg-lang" }) + "</div>";
  }
  function wireLang() { $$(".seg-lang .seg-btn").forEach(function (b) { b.addEventListener("click", function () { window.CJ_I18N.setLang(b.getAttribute("data-v")); }); }); }

  /* =================== LOGIN =================== */
  S.login = function () {
    var email = M.user.email, body, band;
    if (st === "code") {
      band = '<div class="hero-row">' + PX.jam("idle", 4) + '<div><h1 class="t24 b">' + t("a.code.h1") + "</h1><p>" + t("a.code.body", { email: "<b>" + email + "</b>" }) + "</p></div></div>";
      body = '<form class="panel" novalidate><label class="lbl" for="code">' + t("a.code.h") + '</label><div class="code" aria-hidden="true">' + "482".split("").map(function (d) { return '<i class="is-set">' + d + "</i>"; }).join("") + '<i class="is-now"></i><i></i><i></i></div>' +
        '<input id="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="482" aria-label="' + esc(t("a.code.label")) + '">' +
        btn(t("a.code.btn"), { attrs: 'data-go="first-run.html"' }) + '<p class="cap">' + t("a.code.resendin", { s: 42 }) + '</p></form>' +
        '<p class="cap cap-c">' + t("a.code.tip") + '</p><a class="lnk lnk-c" href="' + href("login.html") + '">' + t("a.code.change") + "</a>";
    } else if (st === "setup") {
      band = '<div class="hero-row">' + PX.jam("idle", 4) + '<div><h1 class="t24 b">' + t("a.setup.h1") + "</h1><p>" + t("a.setup.body2") + "</p></div></div>";
      body = '<div class="panel"><h2 class="t15">' + t("a.setup.h") + '</h2><ol class="steps">' +
        '<li class="is-done">' + icon("check") + "<span>" + t("a.setup.s1") + '</span><i class="cap">' + t("tx.st.done") + "</i></li>" +
        '<li class="is-now"><i class="spin" aria-hidden="true"></i><span>' + t("a.setup.s2") + '</span><i class="cap">' + t("tx.st.now") + "</i></li>" +
        '<li><i class="dotbox" aria-hidden="true"></i><span>' + t("a.setup.s3") + '</span><i class="cap">' + t("tx.st.wait") + "</i></li></ol>" +
        '<p class="cap">' + t("a.setup.body") + "</p></div>";
    } else {
      var bad = st === "error";
      band = '<div class="hero-row">' + PX.jam("idle", 4) + '<div><h1 class="t24 b">' + t("a.h1") + "</h1><p>" + t("a.lede") + "</p></div></div>";
      body = '<form class="panel" novalidate><label class="lbl" for="email">' + t("a.email.label") + '</label>' +
        '<div class="field' + (bad ? " is-bad" : "") + '"><input id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@gmail.com" value="' + (bad ? "minji@naver" : "") + '"' + (bad ? ' aria-invalid="true" aria-describedby="email-e"' : "") + "></div>" +
        (bad ? '<p class="field-msg is-bad" id="email-e">' + icon("warn") + "<span>" + t("a.email.bad") + "</span></p>" : '<p class="cap">' + t("a.email.cap", { list: M.providerNames }) + "</p>") +
        btn(t("a.email.btn"), { attrs: 'data-go="login.html" data-state="code"' }) + "</form>" +
        PX.disc(t("a.help.q"), "<p>" + t("a.help.a") + "</p>") +
        '<ul class="facts"><li>' + icon("clock") + "<span>" + t("a.fact.1") + "</span></li><li>" + icon("heart") + "<span>" + t("a.fact.2") + "</span></li><li>" + A.svg("coin", 2) + "<span>" + t("a.fact.3") + "</span></li></ul>" +
        '<p class="cap fine">' + t("a.fine", { terms: '<a class="lnk" href="#">' + t("a.terms") + "</a>", privacy: '<a class="lnk" href="#">' + t("a.privacy") + "</a>" }) + "</p>" + langSeg();
    }
    PX.shell({ bare: true, band: band, body: body, title: t("a.h1"), cls: "is-auth" });
    wireLang();
    $$("[data-go]").forEach(function (b) { b.addEventListener("click", function () { var s = b.getAttribute("data-state"); location.href = href(b.getAttribute("data-go"), s ? { state: s } : {}); }); });
  };

  /* =================== FIRST RUN =================== */
  S.firstrun = function () {
    var n = Math.min(3, Math.max(1, +(PX.qs.get("step") || 1))), art;
    if (n === 1) {
      var q1 = PX.q("q1");
      art = '<div class="ob-deck"><span class="ob-key ob-l">' + icon("left") + "<b>" + q1.left + '</b></span><div class="ob-card">' + scene("crypto", 4) + '<i class="ob-line"></i><i class="ob-line ob-short"></i></div><span class="ob-key ob-r"><b>' + q1.right + "</b>" + icon("right") + "</span></div>";
    } else if (n === 2) {
      art = '<div class="ob-pts"><div class="ob-pt"><b class="t36 b">+100P</b>' + PX.cells(["done", "done", "done", "done", "done"], "") + '<span class="t12 b">' + t("o.2.a") + '</span></div><div class="ob-pt"><b class="t36 b">+50P</b>' + A.svg("coin", 4) + '<span class="t12 b">' + t("o.2.c") + "</span></div></div>";
    } else {
      art = '<div class="ob-swap"><div class="ob-pt"><b class="t36 b">1,000P</b>' + A.svg("coin", 4) + "</div>" + icon("right", 4) + '<div class="ob-pt"><b class="t36 b">1 CT</b><img src="assets/cojam-mark.svg" width="32" height="32" alt=""></div></div>';
    }
    var code = n === 1 ? '<div class="ob-code">' + PX.disc(t("o.code.q") + ' <i class="cap">' + t("o.code.opt") + "</i>",
      '<div class="field field-row"><input id="icode" aria-label="' + esc(t("o.code.ph")) + '" placeholder="' + esc(t("o.code.ph")) + '" autocapitalize="characters" maxlength="8"><button type="button" class="field-act" id="iapply">' + t("o.code.apply") + '</button></div><p class="cap" id="imsg">' + t("o.code.help") + "</p>", st === "code") + "</div>" : "";
    var body = '<div class="ob-steps" role="img" aria-label="' + esc(t("o.step", { n: n })) + '">' + [1, 2, 3].map(function (i) { return '<i class="cell' + (i <= n ? " is-done" : "") + '"></i>'; }).join("") + '<span class="t12 b">' + t("o.step", { n: n }) + "</span></div>" +
      '<h1 class="t24 b">' + t("o." + n + ".h") + '</h1><p class="lede">' + t("o." + n + ".b") + "</p>" + code + (n === 1 ? langSeg() : "");
    var foot = btn(n === 3 ? t("o.start") : t("o.next"), { href: n === 3 ? href("home.html") : href("first-run.html", { step: n + 1 }) }) + (n === 3 ? '<p class="cap cap-c">' + icon("check") + " " + t("o.3.wait") + "</p>" : "");
    PX.shell({ bare: true, band: '<div class="ob-art">' + art + "</div>", body: body, foot: foot, title: t("o." + n + ".h"), cls: "is-auth is-ob" });
    var hud = $(".hud"); if (n < 3) hud.insertAdjacentHTML("beforeend", '<a class="hud-skip t15" href="' + href("home.html") + '">' + t("o.skip") + "</a>");
    wireLang();
    var ap = $("#iapply"); if (ap) ap.addEventListener("click", function () {
      var v = $("#icode").value.trim().toUpperCase(), m = $("#imsg"), k = M.invite.known[v];
      m.className = "cap";
      if (!/^[A-Z2-9]{6,8}$/.test(v)) { m.textContent = t("o.code.short"); m.classList.add("is-bad"); }
      else if (v === M.invite.self) { m.textContent = t("o.code.own"); m.classList.add("is-bad"); }
      else if (!k) { m.textContent = t("o.code.unknown"); m.classList.add("is-bad"); }
      else { m.textContent = t("o.code.ok", { name: k, w: M.invite.welcome }); m.classList.add("is-ok"); }
    });
  };

  /* =================== HOME (cards and list share one controller) =================== */
  function play(mode) {
    var set = M.set.map(PX.q), picks = [], timer = null, endTick = null, busy = 0, frozen = false;
    if (st === "partial") picks = [{ side: "r", saved: true }, { side: "l", saved: true }];
    if (st === "finishing") { picks = ["r", "l", "r", "r", "r"].map(function (s, i) { return { side: s, saved: i < 4 }; }); frozen = true; }
    var offline = st === "offline";

    function cellStates() { return set.map(function (_, i) { var p = picks[i]; return p ? (p.saved ? "done" : "pend") : ""; }); }
    var band = '<div class="band-row"><h1 class="t24 b">' + t("h.title") + "</h1>" + PX.seg([{ label: t("h.view.card"), icon: "cards", href: href("home.html") }, { label: t("h.view.term"), icon: "list", href: href("home-list.html") }], mode === "card" ? 0 : 1, { label: t("h.view.label"), cls: "seg-view" }) + "</div>" +
      '<div class="band-row band-stat"><span class="count"><b class="t36 b" id="cnt">0</b><i class="t24 b">/5</i></span><span id="cells"></span><span class="closes"><i class="t12">' + t("h.closes") + "</i>" + PX.cd(M.untilNextSet(), "t15") + "</span></div>";

    var body;
    if (st === "loading") body = '<div class="deck"><div class="qcard is-skel" role="status" aria-label="' + esc(t("common.loading")) + '"><i class="skel-row" style="--w:30%"></i><i class="skel-block"></i><i class="skel-row" style="--w:90%"></i><i class="skel-row" style="--w:70%"></i><i class="skel-row" style="--w:50%"></i></div></div>';
    else if (st === "empty") body = PX.empty({ sprite: PX.jam("sleep", 8), h: t("h.empty.h"), b: t("h.empty.b", { time: t("time.kst9") }), btn: PX.cdTiles(M.untilNextSet()) });
    else if (st === "error") body = PX.empty({ sprite: PX.jam("dizzy", 8), h: t("common.error.h"), b: t("e.load"), btn: btn(t("common.retry"), { href: href(mode === "card" ? "home.html" : "home-list.html"), block: false }) });
    else if (st === "hold") body = PX.empty({ sprite: PX.jam("sleep", 8), h: t("hold.home.h"), b: t("hold.home.b"), btn: btn(t("hold.home.btn"), { kind: "second", href: href("index.html") + "#hold", block: false }) });
    else body = mode === "card"
      ? '<div class="deck" id="deck"><i class="plate plate-2"></i><i class="plate plate-1"></i></div><div class="answers" id="answers"></div><div class="pickbar" id="pickbar"></div>'
      : '<ol class="qlist" id="qlist"></ol><div class="pickbar" id="pickbar"></div>';
    PX.shell({ tab: "home", band: band, body: body, offline: offline, cls: "is-home is-" + mode, title: t("h.title") });

    function paintBand() { $("#cnt").textContent = picks.length; $("#cells").innerHTML = PX.cells(cellStates(), t("h.prog.sr", { n: picks.length })); }
    paintBand();
    if (!$("#pickbar")) return;

    /* ----- card pieces ----- */
    function cardHtml(q) {
      return '<article class="qcard" data-i="' + (q.n - 1) + '" aria-label="' + esc(t("h.qn.sr", { n: q.n })) + '">' +
        '<div class="qc-top">' + PX.chip("Q" + q.n + "/5", "n") + PX.chip(t("cat." + q.cat)) + "</div>" + scene(q.cat, 8) +
        '<h2 class="qc-title t24 b">' + q.title + '</h2><p class="qc-rule">' + t("h.answer", { rule: q.rule }) + "</p>" +
        '<button type="button" class="qc-ai" data-ai="' + q.id + '">' + icon("info") + "<span>" + t("h.ai", { time: q.settle }) + "</span></button>" +
        '<span class="stamp stamp-l t24 b" aria-hidden="true">' + q.left + '</span><span class="stamp stamp-r t24 b" aria-hidden="true">' + q.right + '</span><i class="wash" aria-hidden="true"></i></article>';
    }
    function answersHtml(q) {
      var dis = offline ? ' aria-disabled="true"' : "";
      return '<button type="button" class="choice choice-l" data-side="l"' + dis + ' aria-label="' + esc(t("h.pick.aria", { choice: q.left, q: q.title })) + '">' + icon("left") + '<span class="t24 b">' + q.left + "</span></button>" +
        '<button type="button" class="choice choice-r" data-side="r"' + dis + ' aria-label="' + esc(t("h.pick.aria", { choice: q.right, q: q.title })) + '"><span class="t24 b">' + q.right + "</span>" + icon("right") + "</button>";
    }
    function aiSheet(id) {
      var q = PX.q(id);
      PX.sheet({ title: t("h.ai.h"), body: '<ol class="nlist"><li>' + t("h.ai.1") + "</li><li>" + t("h.ai.2") + "</li><li>" + t("h.ai.3") + "</li></ol>" + PX.row(t("h.ai.src"), q.rule) + PX.row(t("h.ai.when"), t("h.ai.after", { time: q.settle })), foot: btn(t("common.close"), { kind: "second", attrs: "data-close" }) });
    }
    document.addEventListener("click", function (e) { var b = e.target.closest("[data-ai]"); if (b) aiSheet(b.getAttribute("data-ai")); });

    function front() { return $(".qcard.is-front"); }
    function mount(q, how) {
      var deck = $("#deck"); deck.insertAdjacentHTML("beforeend", cardHtml(q));
      var el = deck.lastElementChild; el.classList.add("is-front");
      if (how === "pop" && !PX.reduce) el.classList.add("is-pop");
      drag(el);
      $("#answers").innerHTML = answersHtml(q); $("#answers").hidden = false;
      var left = 5 - picks.length; $(".plate-1").hidden = left < 2; $(".plate-2").hidden = left < 3;
      return el;
    }
    function fly(el, dir, back, done) {
      var w = el.offsetWidth + 48, from = back ? "translate(" + dir * w + "px,0)" : (el.style.transform || "translate(0,0)"), to = back ? "translate(0,0)" : "translate(" + dir * w + "px,0)";
      var a = PX.reduce ? el.animate([{ opacity: back ? 0 : 1 }, { opacity: back ? 1 : 0 }], { duration: 150, easing: "linear", fill: "forwards" })
        : el.animate([{ transform: from }, { transform: to }], { duration: 240, easing: "steps(6, end)", fill: "forwards" });
      a.onfinish = function () { if (back) { a.cancel(); el.style.transform = ""; } done && done(); };
    }

    /* ----- finishing panel after the fifth pick ----- */
    function finishing() {
      var deck = $("#deck") || $("#qlist");
      var html = '<div class="finish" id="finish">' + PX.jam("cheer", 8) + '<h2 class="t24 b">' + t("h.end.h") + '</h2><p class="finish-in t15" id="endin">' + t("h.end.in", { n: 3 }) + '</p><span class="fuse" aria-hidden="true"><i></i><i></i><i></i></span>' + btn(t("h.end.now"), { id: "endnow", block: false }) + '<p class="cap">' + t("h.fin.b") + "</p></div>";
      if (mode === "card") { $$(".plate").forEach(function (p) { p.hidden = true; }); deck.insertAdjacentHTML("beforeend", html); $("#answers").hidden = true; }
      else deck.insertAdjacentHTML("afterend", html);
      $("#endnow").addEventListener("click", function () { location.href = href("done.html"); });
      if (frozen) return;
      var n = 3; endTick = setInterval(function () { n--; var e = $("#endin"); if (e && n > 0) { e.textContent = t("h.end.in", { n: n }); $("#finish").setAttribute("data-n", n); } }, 1000);
    }
    function unfinish() { var f = $("#finish"); f && f.remove(); clearInterval(endTick); }

    /* ----- pick bar: the hint, or Undo with a three second fuse ----- */
    function bar() {
      var pb = $("#pickbar"), last = picks[picks.length - 1];
      if (last && !last.saved) {
        var q = set[picks.length - 1], ch = last.side === "l" ? q.left : q.right;
        pb.innerHTML = '<span class="pb-pick"><i class="dot dot-' + last.side + '"></i><b class="t15">' + t("h.sync", { n: q.n, choice: ch }) + '</b></span><span class="fuse fuse-undo' + (frozen ? " is-frozen" : "") + '" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
          '<button type="button" class="undo" id="undo" aria-label="' + esc(t("h.undo.aria", { n: q.n, choice: ch })) + '">' + icon("undo") + '<span class="t15">' + t("h.undo") + "</span></button>";
        $("#undo").addEventListener("click", undo);
      } else if (picks.length >= 5) pb.innerHTML = '<span class="pb-hint">' + icon("check") + "<span>" + t("h.saved") + "</span></span>";
      else pb.innerHTML = '<span class="pb-hint">' + (st === "partial" && picks.length === 2 ? icon("check") + "<span>" + t("h.left.savedn", { n: 2 }) + "</span>" : "<span>" + t(mode === "card" ? "h.hint.touch" : "h.hint") + "</span>") + "</span>";
    }
    function settle() { picks.forEach(function (p) { p.saved = true; }); paintBand(); bar(); if (mode === "list") paintList(); }

    function pick(side) {
      if (offline) { PX.toast(t("h.offline")); return; }
      if (picks.length >= 5 || Date.now() < busy) return;
      busy = Date.now() + 250;
      clearTimeout(timer); picks.forEach(function (p) { p.saved = true; });
      var i = picks.length, q = set[i]; picks.push({ side: side, saved: false });
      if (navigator.vibrate) try { navigator.vibrate(5); } catch (e) {}
      PX.say(t("h.live.picked", { choice: side === "l" ? q.left : q.right, k: 5 - picks.length }));
      paintBand(); bar();
      if (mode === "card") {
        var el = front(); el.classList.remove("is-front"); el.classList.add("is-gone", "is-armed-" + side);
        fly(el, side === "l" ? -1 : 1, false, function () { el.remove(); });
        if (picks.length < 5) mount(set[picks.length], "pop"); else finishing();
      } else { paintList(); if (picks.length >= 5) finishing(); }
      timer = setTimeout(function () { settle(); if (picks.length >= 5) setTimeout(function () { location.href = href("done.html"); }, 500); }, UNDO_MS);
    }
    function undo() {
      var last = picks[picks.length - 1]; if (!last || last.saved) return;
      clearTimeout(timer); unfinish(); picks.pop();
      var q = set[picks.length]; PX.say(t("h.undone", { n: q.n }));
      paintBand(); bar();
      if (mode === "card") {
        var cur = front(); if (cur) cur.remove();
        $$(".qcard.is-gone").forEach(function (g) { g.remove(); });
        var el = mount(q); fly(el, last.side === "l" ? -1 : 1, true);
      } else paintList();
    }

    /* ----- drag: the card follows the finger on the 4 px grid; the pick shown is always the pick a release would make ----- */
    function drag(el) {
      var sx, sy, dx, lock, pid, samples;
      function arm(side) {
        el.classList.toggle("is-armed-l", side === "l"); el.classList.toggle("is-armed-r", side === "r");
        $$(".choice").forEach(function (c) { c.classList.toggle("is-hot", c.getAttribute("data-side") === side); });
      }
      function hint(v) { el.style.setProperty("--hint-l", v < 0 ? Math.min(0.4, -v * 0.4) : 0); el.style.setProperty("--hint-r", v > 0 ? Math.min(0.4, v * 0.4) : 0); }
      el.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button") || !el.classList.contains("is-front") || offline) return;
        sx = e.clientX; sy = e.clientY; dx = 0; lock = null; pid = e.pointerId; samples = [{ x: sx, t: e.timeStamp }];
      });
      el.addEventListener("pointermove", function (e) {
        if (pid !== e.pointerId) return;
        var mx = e.clientX - sx, my = e.clientY - sy;
        if (!lock) { if (Math.abs(mx) < 10 && Math.abs(my) < 10) return; lock = Math.abs(mx) >= Math.abs(my) ? "x" : "y"; if (lock === "x") { try { el.setPointerCapture(pid); } catch (er) {} el.classList.add("is-drag"); } }
        if (lock !== "x") return;
        dx = mx; samples.push({ x: e.clientX, t: e.timeStamp }); if (samples.length > 6) samples.shift();
        var snap = PX.reduce ? dx : Math.round(dx / 4) * 4, lift = Math.round(Math.abs(dx) * 0.06 / 4) * 4;
        el.style.transform = "translate(" + snap + "px," + (-lift) + "px)";
        var r = dx / (el.offsetWidth * 0.35);
        if (Math.abs(r) >= 1) { if (!el.classList.contains("is-armed-" + (r < 0 ? "l" : "r")) && navigator.vibrate) try { navigator.vibrate(5); } catch (er) {} arm(r < 0 ? "l" : "r"); hint(0); } else { arm(null); hint(r); }
      });
      function end(e) {
        if (pid !== e.pointerId) return; pid = null;
        if (lock !== "x") return;
        el.classList.remove("is-drag");
        var a = samples[0], b = samples[samples.length - 1], v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0, ad = Math.abs(dx);
        var same = v * dx > 0, commit = ad >= el.offsetWidth * 0.35 || (same && ((ad >= 96 && Math.abs(v) >= 0.5) || (ad >= 56 && Math.abs(v) >= 1.1)));
        if (commit && e.type !== "pointercancel") { arm(null); pick(dx < 0 ? "l" : "r"); }
        else { arm(null); hint(0); var from = el.style.transform; el.style.transform = ""; if (!PX.reduce) el.animate([{ transform: from }, { transform: "translate(0,0)" }], { duration: 160, easing: "steps(4, end)" }); }
      }
      el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    }

    /* ----- list view ----- */
    function paintList() {
      $("#qlist").innerHTML = set.map(function (q, i) {
        var p = picks[i], open = i === picks.length, no = (i < 9 ? "0" : "") + (i + 1);
        if (p) return '<li class="ql is-done"><b class="ql-n t24 b">' + no + '</b><div class="ql-b"><p class="ql-t">' + q.title + '</p><span class="ql-pick"><i class="dot dot-' + p.side + '"></i>' + t("h.t.chose", { choice: p.side === "l" ? q.left : q.right }) + "</span></div>" + (p.saved ? icon("check") : '<i class="spin" aria-hidden="true"></i>') + "</li>";
        if (open) return '<li class="ql is-open"><div class="ql-hd"><b class="ql-n t24 b">' + no + "</b>" + PX.chip(t("cat." + q.cat)) + '<span class="ql-thumb">' + A.svg(q.cat, 2) + '</span></div><h2 class="t24 b">' + q.title + '</h2><p class="qc-rule">' + t("h.answer", { rule: q.rule }) + '</p><button type="button" class="qc-ai" data-ai="' + q.id + '">' + icon("info") + "<span>" + t("h.ai", { time: q.settle }) + '</span></button><div class="answers">' + answersHtml(q) + "</div></li>";
        return '<li class="ql"><b class="ql-n t24 b">' + no + '</b><div class="ql-b"><p class="ql-t">' + q.title + "</p>" + PX.chip(t("cat." + q.cat)) + '</div><span class="ql-thumb">' + A.svg(q.cat, 2) + "</span></li>";
      }).join("");
    }

    document.addEventListener("click", function (e) { var c = e.target.closest(".choice"); if (c) pick(c.getAttribute("data-side")); });
    document.addEventListener("keydown", function (e) {
      if (e.repeat || $(".sheet-wrap") || /INPUT|TEXTAREA|SELECT|A/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowLeft") pick("l"); else if (e.key === "ArrowRight") pick("r"); else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") undo();
    });
    window.addEventListener("pagehide", function () { clearTimeout(timer); });

    if (mode === "card") { if (picks.length < 5) mount(set[picks.length]); else finishing(); } else { paintList(); if (picks.length >= 5) finishing(); }
    bar();
    /* first time teaching: the first card leans right, then left, once */
    if (mode === "card" && st === "default" && !PX.reduce && !PX.qs.get("still")) { var f = front(); f && f.classList.add("is-teach"); }
  }
  S.home = function () { play("card"); };
  S.homelist = function () { play("list"); };

  /* =================== DAY DONE =================== */
  S.done = function () {
    var saving = st === "saving", rows = M.results[0].rows.slice().sort(function (a, b) { return PX.q(a.q).n - PX.q(b.q).n; });
    var band = '<div class="win' + (saving ? " is-saving" : "") + '">' + (saving ? "" : '<div class="confetti" aria-hidden="true">' + new Array(15).join("<i></i>") + "</div>") +
      '<p class="win-tag t12 b">' + t("d.h1") + '</p><div class="win-row">' + PX.jam(saving ? "idle" : "cheer", 8) + '<div class="win-fig"><b class="t48 b">+100P</b>' + (saving ? '<i class="spin" aria-hidden="true"></i>' : PX.coinSpin(4)) + "</div></div>" +
      PX.cells(["done", "done", "done", "done", saving ? "pend" : "done"], t("h.prog.sr", { n: 5 })) + '<p class="win-st" role="status">' + t(saving ? "d.saving.st" : "d.paid.st") + "</p></div>";
    var waiting = rows.filter(function (r) { return r.out === "wait"; }).length;
    var body = btn(t("d.rank"), { href: href("ranking.html"), iconEnd: "chev" }) +
      '<section class="next"><div><h2 class="t15">' + t("d.next") + '</h2><p class="cap">' + t("d.next.at") + "</p></div>" + PX.cdTiles(M.untilNextSet()) + "</section>" +
      '<section class="sec"><div class="sec-hd"><h2 class="t24 b">' + t("d.picks") + '</h2><a class="lnk" href="' + href("results.html") + '">' + t("d.results") + '</a></div><p class="cap">' + t("d.waitn", { n: waiting }) + "<br>" + t("d.hit.2") + '</p><ul class="rows">' +
      rows.map(function (r) {
        var q = PX.q(r.q), ch = r.c === "l" ? q.left : q.right;
        return '<li class="prow"><b class="prow-n t15">' + q.n + '</b><div class="prow-b"><p>' + q.title + '</p><span class="cap">' + (r.out === "pend" ? t("d.hitpending", { time: r.at }) : t("d.wait")) + '</span></div><span class="pill pill-' + r.c + ' t12 b">' + ch + "</span></li>";
      }).join("") + "</ul></section>";
    PX.shell({ tab: "home", band: band, body: body, cls: "is-done", title: t("d.h1"), points: saving ? 1150 : 1250 });
    if (!saving && !PX.reduce) {   /* the score counts up in ten frames */
      var el = $("#score-n"), i = 0; el.textContent = num(1150); $("#score").classList.add("is-bump");
      var iv = setInterval(function () { i++; el.textContent = num(1150 + i * 10); if (i >= 10) clearInterval(iv); }, 60);
    }
  };

  /* =================== RESULTS =================== */
  S.results = function () {
    var W = M.week, filter = "all";
    var band = '<h1 class="t24 b">' + t("r.title") + '</h1><div class="trio" role="group" aria-label="' + esc(t("r.sum.sr")) + '">' +
      PX.fig(t("r.week"), num(W.pts), "P", t("r.sum.hits", { a: W.hits, b: W.answered })) + PX.fig(t("r.all"), num(M.all.pts), "P", t("r.sum.rate", { n: M.all.rate })) + PX.fig(t("r.pending"), "+" + M.user.pendingHit, "P", t("r.at", { time: "22:10" })) + "</div>";
    var body;
    if (st === "loading") body = PX.skeleton(8);
    else if (st === "error") body = PX.empty({ sprite: PX.jam("dizzy", 8), h: t("common.error.h"), b: t("e.load"), btn: btn(t("common.retry"), { href: href("results.html"), block: false }) });
    else if (st === "empty") body = PX.empty({ sprite: PX.jam("sleep", 8), h: t("r.empty.h"), b: t("r.empty.b"), btn: btn(t("r.empty.btn"), { href: href("home.html"), block: false }) });
    else body = PX.seg([{ label: t("r.f.all"), v: "all" }, { label: t("r.f.wait"), v: "wait" }, { label: t("r.f.set"), v: "set" }], 0, { label: t("r.filter"), cls: "seg-filter" }) +
      '<p class="legend" aria-label="' + esc(t("r.legend")) + '"><span><i class="mk mk-hit"></i>' + t("r.o.hit") + '</span><span><i class="mk mk-miss"></i>' + t("r.o.miss") + '</span><span><i class="mk mk-wait"></i>' + t("r.f.wait") + '</span></p><div id="days"></div>';
    if (st === "empty") W = { pts: 0, hits: 0, answered: 0 };
    PX.shell({ tab: "results", band: band, body: body, title: t("r.title"), noBadge: true, cls: "is-results" });
    if (!$("#days")) return;

    var MK = { hit: "hit", corr: "hit", pend: "hit", miss: "miss", wait: "wait", void: "void", none: "none" };
    function outChip(r) {
      if (r.out === "hit") return '<span class="out out-hit">' + PX.chip(t("r.o.hit"), "hit") + '<b class="t15">+50P</b></span>';
      if (r.out === "corr") return '<span class="out out-hit">' + PX.chip(t("r.o.corr"), "hit") + '<b class="t15">+50P</b></span>';
      if (r.out === "pend") return '<span class="out out-hit">' + PX.chip(t("r.o.hit"), "hit") + '<b class="t15 is-soft">+50P</b></span>';
      if (r.out === "miss") return '<span class="out">' + PX.chip(t("r.o.miss"), "miss") + '<b class="t15 is-soft">0P</b></span>';
      if (r.out === "void") return '<span class="out">' + PX.chip(t("r.o.void"), "miss") + "</span>";
      if (r.out === "none") return '<span class="out">' + PX.chip(t("r.o.none"), "none") + "</span>";
      return '<span class="out">' + PX.chip(t("r.f.wait"), "wait") + "</span>";
    }
    function paint() {
      var html = M.results.map(function (d, di) {
        var rows = d.rows.filter(function (r) { return filter === "all" || (filter === "wait" ? (r.out === "wait" || r.out === "pend") : (r.out !== "wait" && r.out !== "pend" && r.out !== "none")); });
        if (!rows.length) return "";
        var c = { hit: 0, miss: 0, wait: 0 }; d.rows.forEach(function (r) { var k = MK[r.out]; if (c[k] !== undefined) c[k]++; });
        var inv = M.invite.days[d.day];
        return '<section class="day"><div class="day-hd"><h2 class="t24 b">' + (d.day === 0 ? t("common.today") : d.day === 1 ? t("common.yesterday") : PX.date(M.ago(d.day))) + '</h2><span class="marks" role="img" aria-label="' + esc(t("r.marks.sr", { h: c.hit, m: c.miss, w: c.wait })) + '">' + d.rows.map(function (r) { return '<i class="mk mk-' + MK[r.out] + '"></i>'; }).join("") + '</span><b class="day-total t15">+' + d.total + "P</b></div>" +
          '<p class="cap day-sub">' + (d.done ? t("r.g.done") : t("r.g.part", { k: d.answered })) + (d.pending ? ' <span class="nb tagp">' + t("r.g.pending", { q: d.pending }) + "</span>" : "") + "</p>" +
          (inv ? '<div class="inv-line">' + A.svg("coin", 2) + "<p><b>" + t("r.inv") + "</b><span>" + t("r.inv.sub", { r: M.invite.rate }) + '</span></p><b class="t15">+' + inv.pts + "P</b></div>" : "") +
          '<ul class="rows">' + rows.map(function (r, ri) {
            var o = M.questions[r.q], l = o[PX.lang] || o.en, ch = r.c ? (r.c === "l" ? l.left : l.right) : null, set = r.out === "hit" || r.out === "miss" || r.out === "corr";
            var line = r.out === "pend" ? t("r.o.pend", { time: r.at }) : r.out === "wait" ? t("r.o.waitat", { time: r.exp }) + ' <span class="nb tagp">' + t("r.o.ifhit") + "</span>" : r.out === "corr" ? t("r.o.corr.line", { date: PX.date(M.ago(0.5)) }) : r.out === "void" ? t("r.o.void.line") : "";
            var ans = set ? ((r.out === "miss") === (r.c === "l") ? l.right : l.left) : "", rule = M.pastRules[r.q] ? M.pastRules[r.q][{ en: 0, ko: 1, ja: 2 }[PX.lang]] : (l.rule || "");
            var id = "x" + di + "-" + ri;
            return '<li class="rrow' + (r.out === "none" ? " is-none" : "") + '">' + (set ? '<button type="button" class="rrow-main" aria-expanded="false" aria-controls="' + id + '">' : '<div class="rrow-main">') +
              '<span class="rrow-b"><span class="rrow-t">' + l.title + "</span>" + (ch ? '<span class="rrow-pick"><i class="dot dot-' + r.c + '"></i>' + t("r.you", { choice: ch }) + "</span>" : "") + "</span>" + outChip(r) + (set ? "</button>" : "</div>") +
              (line ? '<p class="cap rrow-line">' + line + "</p>" : "") +
              (set ? '<div class="rrow-x" id="' + id + '" hidden>' + PX.row(t("r.x.answer"), "<b>" + ans + "</b>") + PX.row(t("h.ai.src"), rule) + PX.row(t("r.x.evidence"), t("p.evidence")) + "</div>" : "") + "</li>";
          }).join("") + "</ul></section>";
      }).join("");
      $("#days").innerHTML = html || '<p class="cap fe">' + t(filter === "wait" ? "r.fe.wait" : "r.fe.set") + "</p>";
    }
    paint();
    $$(".seg-filter .seg-btn").forEach(function (b) { b.addEventListener("click", function () { filter = b.getAttribute("data-v"); $$(".seg-filter .seg-btn").forEach(function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", on); }); paint(); }); });
    document.addEventListener("click", function (e) { var m = e.target.closest("button.rrow-main"); if (!m) return; var open = m.getAttribute("aria-expanded") !== "true"; m.setAttribute("aria-expanded", open); document.getElementById(m.getAttribute("aria-controls")).hidden = !open; });
  };

  /* =================== RANKING: a high score table =================== */
  S.ranking = function () {
    var last = st === "last", onHold = st === "hold", none = st === "none", R = M.ranking, me = M.me;
    var secs = M.untilWeekEnd(), dd = Math.floor(secs / 86400), hh = Math.floor(secs % 86400 / 3600);
    var weekSeg = PX.seg([{ label: t("r.week"), href: href("ranking.html") }, { label: t("k.lastweek"), href: href("ranking.html", { state: "last" }) }], last ? 1 : 0, { label: t("k.week"), cls: "seg-tabs" });
    var band = '<h1 class="t24 b">' + t("k.title") + "</h1>" +
      '<div class="band-row band-pool"><div class="fig"><span class="fig-l">' + t("k.pool") + '</span><span class="fig-v"><b>' + num(M.pool.ct) + '</b><i>CT</i></span></div><div class="fig fig-r"><span class="fig-l">' + (last ? t("k.final.h") : t("k.ends")) + '</span><span class="fig-v fig-sm"><b>' + (last ? t("k.sent") : t("k.dh", { d: dd, h: hh })) + '</b></span><span class="fig-s">' + (last ? t("k.final.time") : t("k.endat")) + "</span></div></div>";

    var body;
    if (st === "loading") body = PX.skeleton(9);
    else if (st === "error") body = PX.empty({ sprite: PX.jam("dizzy", 8), h: t("common.error.h"), b: t("e.load"), btn: btn(t("common.retry"), { href: href("ranking.html"), block: false }) });
    else {
      var split = '<table class="split"><thead><tr><th scope="col">' + t("k.rank.sr", { n: "" }).trim() + '</th><th scope="col">' + t("k.split.share") + '</th><th scope="col">' + t("k.col.prize") + "</th></tr></thead><tbody>" + M.pool.split.map(function (p, i) { return "<tr><td>" + t("k.rankth", { n: i + 1 }) + "</td><td>" + p + "%</td><td>" + num(R[i].prize) + " CT</td></tr>"; }).join("") + "</tbody></table>";
      var pod = [R[1], R[0], R[2]].map(function (p) {
        return '<li class="pod pod-' + p.rank + '"><span class="pod-art">' + (p.rank === 1 ? A.svg("crown", 4) : "") + '</span><b class="pod-name t12 b">' + esc(p.name) + '</b><span class="pod-pts t12 b">' + num(p.pts) + 'P</span><span class="pod-block"><b class="t36 b"><span class="sr">' + t("k.rank.sr", { n: "" }) + "</span>" + p.rank + '</b><i class="t12 b">' + num(p.prize) + " CT</i></span></li>";
      }).join("");
      var rows = R.slice(3).map(function (p) {
        return '<li class="hs"><b class="hs-r"><span class="sr">' + t("k.rank.sr", { n: "" }) + "</span>" + (p.rank < 10 ? "0" : "") + p.rank + '</b><span class="hs-n">' + esc(p.name) + '</span><span class="hs-p">' + num(p.pts) + '<i>P</i></span><span class="hs-z">' + num(p.prize) + "<i> CT</i></span></li>";
      }).join("");
      var around = '<ul class="around">' + M.around.map(function (p) { var g = p.pts - me.pts; return '<li class="ar' + (p.me ? " is-me" : "") + '"><b class="t15">' + p.rank + '</b><span class="ar-n">' + (p.me ? t("k.you") : esc(p.name)) + '</span><span class="t15">' + num(p.pts) + 'P</span><span class="cap">' + (p.me ? "" : g > 0 ? t("k.gap.up", { n: g }) : g < 0 ? t("k.gap.down", { n: -g }) : t("k.gap.same")) + "</span></li>"; }).join("") + "</ul>";
      body = weekSeg + (onHold ? PX.hold(t("hold.rank")) : "") + (last ? PX.note("info", t("k.closed", { time: t("k.final.time") })) : "") +
        PX.disc(t("k.split.q"), "<p>" + t("k.pool.line", { n: num(M.pool.players) }) + "</p>" + split + "<p>" + t("k.split.note") + "</p><p>" + t("k.tie") + " " + t("k.tie.note") + "</p>") +
        '<section class="sec"><div class="sec-hd"><h2 class="t24 b">' + t("k.top") + '</h2><span class="live cap"><i class="live-dot"></i><span data-up="7">' + t("common.updated", { n: 7 }) + '</span></span></div><ol class="podium">' + pod + '</ol>' +
        '<div class="hiscore"><div class="hs hs-hd" aria-hidden="true"><span class="hs-r">#</span><span class="hs-n">' + t("k.col.player") + '</span><span class="hs-z">' + t("k.col.prize") + '</span></div><ol start="4">' + rows + "</ol></div></section>" +
        (none ? "" : PX.disc(t("k.around.open"), around));
    }
    var foot = "";
    if (st !== "loading" && st !== "error") foot = none
      ? '<div class="mebar is-none"><p>' + t("k.none") + "</p>" + btn(t("k.play"), { href: href("home.html"), block: false }) + "</div>"
      : '<div class="mebar"><b class="mebar-r t24 b">' + t("k.rankth", { n: me.rank }) + '</b><div class="mebar-b"><span class="t15">' + t("k.you") + " " + M.user.name + '</span><span class="cap">' + (onHold ? t("hold.rank.pin") : t("k.gap", { gap: me.gap })) + '</span></div><b class="t24 b">' + num(me.pts) + "P</b></div>";
    PX.shell({ tab: "rank", band: band, body: body, foot: foot, title: t("k.title"), cls: "is-rank" });
  };
})();
