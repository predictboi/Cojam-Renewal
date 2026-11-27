/* Day done: the reward is the headline. "+100P" waits in grey while the last pick is saved, then lands in the blue spot ink like a stamp;
   the five boxes ink in one after the other. Nothing repeats it: the points in the masthead count up. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$;
  var sess = App.sess;
  if (S === "moment" && sess.data.paid) S = "";   /* the reward moment plays once; a reload shows the settled screen */
  var phase = S === "moment" || S === "saving" ? "saving" : "paid";
  var wel = S === "welcome", W = M.invite.welcome;
  var basePts = phase === "paid" && !sess.data.paid ? M.user.points + 100 : M.user.points;
  if (wel) basePts += W;
  if (phase === "paid") M.user.points = basePts;
  var sample = { q1: "r", q2: "r", q3: "l", q4: "r", q5: "r" };
  var picks = M.set.map(function (id) { return [id, sess.data.picks[id] || sample[id]]; });
  var outcome = S === "results" ? ["wait", "pend", "miss", "wait", "wait"] : ["wait", "wait", "wait", "wait", "wait"];
  var waiting = outcome.filter(function (o) { return o === "wait"; }).length;

  function status(p) {
    if (p === "saving") return '<p class="done-st" id="reward"><span class="spin"></span>' + t("d.saving.st") + "</p>";
    return '<p class="done-st" id="reward">' + C.icon("check", 16) + (wel ? t("d.wel.st", { n: 100 + W }) : t("d.paid.st")) + "</p>";
  }
  function hero() {
    var segs = phase === "saving" ? ["done", "done", "done", "done", "pend"] : ["done", "done", "done", "done", "done"];
    return '<section class="done-hero"><h1>' + t("d.h1") + '</h1><div class="done-figs"><p class="done-fig' + (phase === "saving" ? " is-wait" : "") + '" id="done-fig" aria-hidden="true">+100P</p>' +
      (wel ? '<p class="done-wel" id="done-wel" aria-hidden="true"><b>+' + W + "P</b><span>" + t("d.wel.tag") + "</span></p>" : "") + "</div>" +
      '<div aria-live="polite" id="reward-wrap">' + status(phase) + "</div>" +
      '<div class="ph-line"><span class="ph-count">5<small>/5</small></span>' + C.day5(segs, { id: "day5", label: "5/5" }) + "</div></section>";
  }
  function pickRow(p, i) {
    var o = outcome[i], q = App.q(p[0]);
    var sub = o === "pend" ? t("d.hitpending", { time: "22:10" }) : o === "miss" ? t("d.miss") : "";
    return '<li class="pick"><span class="pick-q">' + App.esc(q.title) + '</span><span class="pick-c">' + C.pick(p[1], App.esc(q[p[1]])) + (sub ? "<small>" + sub + "</small>" : "") + "</span></li>";
  }
  function body() {
    return C.btn(t("d.rank"), { kind: "primary", block: true, href: "ranking.html", iconEnd: "right" }) +
      (wel ? '<p class="done-welnote">' + t("d.wel.note", { name: '<b translate="no">' + App.esc(M.invite.by) + "</b>", w: W }) + "</p>" : "") +
      '<section class="sec sec-rule"><div class="sh"><h2>' + t("d.picks") + '</h2><a class="linkish" href="results.html">' + t("d.results") + "</a></div>" +
      '<div class="done-wait">' + (waiting ? '<p class="done-wait-n">' + t("d.waitn", { n: waiting }) + "</p>" : "") + '<div class="plain-note"><p>' + t("d.hit.1") + "</p><p>" + t("d.hit.2") + "</p></div></div>" +
      '<ul class="list">' + picks.map(pickRow).join("") + "</ul></section>";
  }
  /* the dateline carries the next set: this edition is closed for the player */
  var secs = S === "zero" ? 0 : M.untilNextSet();
  var liveCell = S === "zero" ? '<span class="spin"></span> ' + t("d.loading") : "<span>" + t("d.next") + '</span> <b id="clock" data-cd="' + secs + '" aria-hidden="true"></b><span class="sr-only" data-cd-sr></span>';
  App.mount({ tab: "home", cls: "is-done", docTitle: t("d.h1"), live: liveCell, raw: C.dateline(liveCell) + hero() + '<div class="pg">' + body() + "</div>", points: basePts, pts: phase === "saving" ? "pending" : S === "results" ? "hits" : "", badges: { results: 2 }, after: function () {
    document.addEventListener("cd:zero", function () { if (S !== "zero") setTimeout(function () { location.href = "home.html"; }, 1200); });
    if (S === "zero") setTimeout(function () { App.toast(t("h.new")); }, 600);
    if (S !== "moment") return;
    var day5 = $("#day5"), wrap = $("#reward-wrap"), fig = $("#done-fig");
    setTimeout(function () { day5.children[4].className = "is-done is-fill"; }, 800);
    setTimeout(function () {
      var sp = App.$("#pts .spin"); if (sp) sp.remove();
      wrap.innerHTML = status("paid"); fig.classList.remove("is-wait"); fig.classList.add("is-pop");
      sess.data.paid = true; sess.save(); day5.classList.add("is-wave");
      try { if (navigator.vibrate) navigator.vibrate([12, 40, 18]); } catch (e) {}
      App.addPoints(100); App.live(t("toast.paid", { n: 100 }));
    }, 1500);
  } });
})();
