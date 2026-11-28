/* Day done: an extra edition. It opens the moment the fifth pick is made. While that pick can still be undone, the row under the figure holds Undo with
   its fuse and the press runs (a moving hatch in the band under the dateline, the headline set letter by letter); a tap anywhere means "finish now".
   When the points are paid the band inks in as "Extra", "+100P" counts up from 0 in the blue spot ink (it never shows any other amount), a "Paid" stamp
   lands in the same row, the fifth box inks in, the dateline turns from "Closes in" to "Next set in" and the points in the masthead count up.
   A tap skips to the settled page, which is the same layout with nothing moving. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$;
  var sess = App.sess;
  if (S === "moment" && sess.data.paid) S = "";   /* the reward moment plays once; a reload shows the settled screen */
  var moment = S === "moment", phase = moment || S === "saving" ? "saving" : "paid";
  var wel = S === "welcome", W = M.invite.welcome;
  var basePts = phase === "paid" && !sess.data.paid ? M.user.points + 100 : M.user.points;
  if (wel) basePts += W;
  if (phase === "paid") M.user.points = basePts;
  var sample = { q1: "r", q2: "r", q3: "l", q4: "r", q5: "r" };
  var picks = M.set.map(function (id) { return [id, sess.data.picks[id] || sample[id]]; });
  var outcome = ["wait", "wait", "wait", "wait", "wait"];   /* today's answers are set only after the day ends: every pick waits. "results" shows the hit points of an earlier day on their way (the masthead) */
  var waiting = outcome.filter(function (o) { return o === "wait"; }).length;

  /* the row under the figure has one height in every phase, so nothing below it ever moves: first the Undo of the fifth pick with its fuse,
     then "Saving your last pick", then the "Paid" stamp. */
  var qs2 = new URLSearchParams(location.search), undoMs = moment ? Math.max(0, Math.min(3000, +(qs2.get("undo") || 0))) : 0, undoQ = qs2.get("q") || "";
  function row(p) {
    if (p === "undo") return '<p class="done-st" id="fin-line">' + t("h.end.in", { n: '<b id="fin-n">' + Math.max(1, Math.ceil(undoMs / 1000)) + "</b>" }) + "</p>";
    if (p === "saving") return '<p class="done-st"><span class="spin"></span>' + t("d.saving.st") + "</p>";
    return '<span class="seal" id="seal" aria-hidden="true">' + C.rstamp("hit", t("pp.paid")) + "</span>" + (wel ? '<p class="done-st">' + t("d.wel.st", { n: 100 + W }) + "</p>" : '<p class="sr-only">' + t("d.paid.st") + "</p>");
  }
  function undoBar() {
    var dir = undoQ && sess.data.picks[undoQ], q = undoQ ? App.q(undoQ) : null;
    return '<div class="pin pin--undo" id="undo-bar">' +
      '<span class="pickbar-msg">' + C.icon("check", 16) + "<span>" + (q && dir ? t("h.sync", { n: q.n, choice: C.pick(dir, App.esc(q[dir])) }) : t("h.qn.sr", { n: q ? q.n : 5 })) + "</span></span>" +
      '<button type="button" class="undo" id="undo-last" aria-label="' + App.esc(t("h.undo.aria", { n: q ? q.n : 5, choice: q && dir ? q[dir] : "" })) + '"><span class="fuse fuse--fill" aria-hidden="true"><i style="--gone:-' + (3000 - undoMs) + 'ms"></i></span>' + C.icon("undo", 18) + "<span>" + t("h.undo") + '</span><kbd aria-hidden="true">Z</kbd></button></div>';
  }
  function letters(text) {
    var i = 0;
    return '<span aria-hidden="true">' + text.split(" ").map(function (w) {
      return '<span class="wd">' + Array.from(w).map(function (c) { return '<span class="ltr" style="--i:' + (i++) + '">' + App.esc(c) + "</span>"; }).join("") + "</span>";
    }).join(" ") + "</span>";
  }
  function num(v) { return "+" + String(Math.round(v)).replace(/\d/g, '<i class="dg">$&</i>') + "P"; }
  function hero() {
    var segs = phase === "saving" ? ["done", "done", "done", "done", "pend"] : ["done", "done", "done", "done", "done"];
    return '<section class="done-hero' + (moment ? " is-moment" : "") + (phase === "saving" ? " is-saving" : "") + '" id="hero">' +
      '<div class="extra" id="extra"><span class="extra-run" aria-hidden="true"></span><p class="extra-ink"><b>' + t("pp.extra") + "</b></p></div>" +
      '<h1 aria-label="' + App.esc(t("d.h1")) + '">' + letters(t("d.h1")) + '</h1><div class="done-figs"><p class="done-fig' + (phase === "saving" ? " is-wait" : "") + '" id="done-fig" data-dg aria-hidden="true">' + num(100) + "</p>" +
      (wel ? '<p class="done-wel" id="done-wel" aria-hidden="true"><b>+' + W + "P</b><span>" + t("d.wel.tag") + "</span></p>" : "") + "</div>" +
      '<div class="done-row" aria-live="polite" id="reward-wrap">' + row(undoMs ? "undo" : phase) + "</div>" +
      '<div class="ph-line">' + C.day5(segs, { id: "day5", label: "5/5" }) + "</div></section>";
  }
  function pickRow(p, i) {
    var o = outcome[i], q = App.q(p[0]);
    var sub = o === "pend" ? t("d.hitpending", { time: "22:10" }) : o === "miss" ? t("d.miss") : "";
    return '<li class="pick"><span class="pick-q">' + App.esc(q.title) + '</span><span class="pick-c">' + C.pick(p[1], App.esc(q[p[1]])) + (sub ? "<small>" + sub + "</small>" : "") + "</span></li>";
  }
  function rankBtn() { return C.btn(t("d.rank"), { kind: "primary", block: true, href: "ranking.html", iconEnd: "right", id: "rank-btn" }); }
  function body() {
    return '<div id="done-act">' + (undoMs ? C.btn(t("pp.finishnow"), { kind: "primary", block: true, id: "fin-btn" }) : rankBtn()) + "</div>" +
      (wel ? '<p class="done-welnote">' + t("d.wel.note", { name: '<b translate="no">' + App.esc(M.invite.by) + "</b>", w: W }) + "</p>" : "") +
      '<section class="sec sec-rule"><div class="sh"><h2>' + t("d.picks") + '</h2><a class="linkish" href="results.html">' + t("d.results") + "</a></div>" +
      (waiting ? '<p class="done-wait-n">' + t("d.waitn", { n: waiting }) + C.q("hits", t("h.ai.h")) + "</p>" : "") +
      '<ul class="list">' + picks.map(pickRow).join("") + "</ul></section>";
  }
  /* the dateline: while the last pick is saved it still reads "Closes in" (this edition is on the press); once paid it turns to the next set */
  var secs = S === "zero" ? 0 : M.untilNextSet();
  function cell(key) { return C.count(key, secs, "dl-flip"); }
  var liveCell = S === "zero" ? '<span class="spin"></span> ' + t("d.loading") : cell(moment ? "h.closes" : "d.next");
  App.mount({ tab: "home", cls: "is-done", docTitle: t("d.h1"), raw: C.dateline(liveCell) + hero() + '<div class="pg">' + body() + "</div>", pin: undoMs ? undoBar() : "", points: basePts, pts: phase === "saving" ? "pending" : S === "results" ? "hits" : "", badges: { results: 2 }, after: function () {
    document.addEventListener("cd:zero", function () { if (S !== "zero") setTimeout(function () { location.href = "home.html"; }, 1200); });
    if (S === "zero") setTimeout(function () { App.toast(t("h.new")); }, 600);
    if (!moment) return;
    var hero = $("#hero"), day5 = $("#day5"), wrap = $("#reward-wrap"), fig = $("#done-fig"), timers = [], paid = false, settled = false, mode = undoMs ? "undo" : "saving";
    function at(ms, fn) { timers.push(setTimeout(fn, App.reduce ? Math.min(ms, 300) : ms)); }
    /* the Undo window of the fifth pick has closed (or the player tapped anywhere to finish now): the pick is sent, then the points are paid */
    function dropBar() { clearInterval(finT); var bar = $("#undo-bar"); if (bar) bar.parentNode.removeChild(bar); var app = $(".app"); if (app) app.classList.remove("app--pin"); }
    function toSaving(wait) { if (mode !== "undo") return; mode = "saving"; dropBar(); wrap.innerHTML = row("saving"); primary(); at(wait, pay); }
    /* the window has ended: "Finish now" gives its place to the way on (the focus follows if it was on the button) */
    function primary() { var act = $("#done-act"); if (!act || !$("#fin-btn")) return; var had = document.activeElement && document.activeElement.id === "fin-btn"; act.innerHTML = rankBtn(); if (had) $("#rank-btn").focus({ preventScroll: true }); }
    var finT = 0, t0 = Date.now();
    if (undoMs) { finT = setInterval(function () { var n = $("#fin-n"); if (n) n.textContent = Math.max(1, Math.ceil((undoMs - (Date.now() - t0)) / 1000)); }, 200);
      var ub = $("#undo-last"); if (ub) ub.focus({ preventScroll: true }); }   /* the focus goes to Undo, where it also was on the deck */
    /* the points are credited with the fifth pick: only then does anything say "paid" */
    function pay() {
      if (paid) return; paid = true; mode = "paid";
      var sp = App.$("#pts .spin"); if (sp) sp.remove();
      sess.data.paid = true; sess.save();
      hero.classList.remove("is-saving"); hero.classList.add("is-paid");   /* the band inks in (CSS); the figure counts up; the stamp lands */
      fig.classList.remove("is-wait");
      fig.innerHTML = num(100);   /* the figure stood here in outline; it fills in (CSS), it never shows another amount */
      day5.children[4].className = "is-done";
      try { if (navigator.vibrate) navigator.vibrate([12, 40, 18]); } catch (e) {}
      App.addPoints(100);   /* the row under the figure is the one live region that says it */
      at(640, function () { if (settled) return; wrap.innerHTML = row("paid"); App.stampLand($("#seal .rstamp"), 0);
        var f = $("#dl-flip"); if (f) { f.firstChild.textContent = t("d.next"); var srr = f.parentNode.querySelector("[data-cd-sr]"); if (srr) { srr.setAttribute("data-cd-sr", "d.next"); srr.textContent = srr.textContent.replace(t("h.closes"), t("d.next")); } if (!App.reduce) { f.classList.remove("is-flip"); void f.offsetWidth; f.classList.add("is-flip"); } } });
      at(1400, settle);
    }
    /* settle: the page is exactly the settled done page, nothing left to run */
    function settle() {
      if (settled) return; settled = true;
      timers.forEach(clearTimeout); document.removeEventListener("pointerdown", skip, true); document.removeEventListener("keydown", skip, true);
      if (!paid) { mode = "saving"; pay(); timers.forEach(clearTimeout); }
      primary();
      if (fig._roll) cancelAnimationFrame(fig._roll); fig.innerHTML = num(100);
      wrap.innerHTML = row("paid");
      var f = $("#dl-flip"); if (f) { f.firstChild.textContent = t("d.next"); var s2 = f.parentNode.querySelector("[data-cd-sr]"); if (s2) { s2.setAttribute("data-cd-sr", "d.next"); s2.textContent = s2.textContent.replace(t("h.closes"), t("d.next")); } }
      dropBar();
      hero.classList.add("is-settled");
      if (hero.getAnimations) hero.getAnimations({ subtree: true }).forEach(function (a) { try { a.finish(); } catch (e) {} });
    }
    /* Undo on this page takes the fifth pick back and returns to the deck, where its card is on top again */
    function undoLast() { timers.forEach(clearTimeout); clearInterval(finT); if (undoQ) { delete sess.data.picks[undoQ]; sess.save(); } location.replace("home.html"); }
    /* a tap or a key: during the Undo window it means "finish now" (unless it is on Undo itself); after the points are paid it skips the rest of the show */
    function skip(e) {
      var tg = e && e.target && e.target.closest ? e.target : null;
      if (tg && tg.closest("#undo-bar")) return;
      /* during the Undo window only the headline area or the primary action ends it early: a tap on the list below, or a scroll, changes nothing */
      if (mode === "undo") { if (e.type === "keydown" ? (e.key === "Enter" && tg && tg.closest(".btn-primary")) : (tg && (tg.closest("#hero") || tg.closest(".pg .btn-primary")))) toSaving(500); }
      else if (paid) settle();
    }
    document.addEventListener("pointerdown", skip, true); document.addEventListener("keydown", skip, true);
    document.addEventListener("click", function (e) { if (e.target.closest("#undo-last")) undoLast(); });
    document.addEventListener("keydown", function (e) { if (mode === "undo" && (e.key === "z" || e.key === "Z" || e.key === "Backspace")) { e.preventDefault(); undoLast(); } });
    if (undoMs) at(undoMs, function () { toSaving(900); }); else at(900, pay);
  } });
})();
