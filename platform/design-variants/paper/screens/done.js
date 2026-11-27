/* Day done: an extra edition. While the last pick is saved the press runs (a moving hatch in the band under the dateline and the headline set letter by letter);
   when the points are paid the band inks in as "Extra", "+100P" prints with its figures rolling, a "Paid" stamp lands, the fifth box inks in,
   the dateline turns from "Closes in" to "Next set in" and the points in the masthead count up. About 2.2 seconds, and a tap skips to the settled page.
   The settled page is the same layout with nothing moving. */
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
  var outcome = S === "results" ? ["wait", "pend", "miss", "wait", "wait"] : ["wait", "wait", "wait", "wait", "wait"];
  var waiting = outcome.filter(function (o) { return o === "wait"; }).length;

  function status(p) {
    if (p === "saving") return '<p class="done-st" id="reward"><span class="spin"></span>' + t("d.saving.st") + "</p>";
    return '<p class="done-st" id="reward">' + C.icon("check", 16) + (wel ? t("d.wel.st", { n: 100 + W }) : t("d.paid.st")) + "</p>";
  }
  /* the headline as letters, so it can be set one by one; words stay whole for line breaks, and a screen reader gets the plain sentence */
  function letters(text) {
    var i = 0;
    return '<span class="sr-only">' + App.esc(text) + '</span><span aria-hidden="true">' + text.split(" ").map(function (w) {
      return '<span class="wd">' + Array.from(w).map(function (c) { return '<span class="ltr" style="--i:' + (i++) + '">' + App.esc(c) + "</span>"; }).join("") + "</span>";
    }).join(" ") + "</span>";
  }
  /* "+100P" as three reels: each column runs through a few figures and stops on its own, the last one last */
  function reels(n) {
    return "+" + String(n).split("").map(function (d, k) {
      var seq = []; for (var j = 0; j < 6 + k * 3; j++) seq.push((+d + 10 - (6 + k * 3 - 1 - j) % 10) % 10);
      return '<span class="reel"><span class="reel-in" style="--n:' + (seq.length - 1) + ";--k:" + k + '">' + seq.map(function (x) { return "<i>" + x + "</i>"; }).join("") + "</span></span>";
    }).join("") + "P";
  }
  function hero() {
    var segs = phase === "saving" ? ["done", "done", "done", "done", "pend"] : ["done", "done", "done", "done", "done"];
    return '<section class="done-hero' + (moment ? " is-moment" : "") + (phase === "saving" ? " is-saving" : "") + '" id="hero">' +
      '<div class="extra" id="extra"><span class="extra-run" aria-hidden="true"></span><p class="extra-ink"><b>' + t("pp.extra") + "</b><span>" + t("pp.issue", { d: App.issue.day, w: App.issue.week }) + "</span></p></div>" +
      "<h1>" + letters(t("d.h1")) + '</h1><div class="done-figs"><p class="done-fig' + (phase === "saving" ? " is-wait" : "") + '" id="done-fig" aria-hidden="true">' + reels(100) + "</p>" +
      '<span class="seal" id="seal" aria-hidden="true">' + C.rstamp("hit", t("pp.paid")) + "</span>" +
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
  /* the dateline: while the last pick is saved it still reads "Closes in" (this edition is on the press); once paid it turns to the next set */
  var secs = S === "zero" ? 0 : M.untilNextSet();
  function cell(key) { return '<span class="flip" id="dl-flip"><span>' + t(key) + '</span> <b id="clock" data-cd="' + secs + '" aria-hidden="true"></b></span><span class="sr-only" data-cd-sr></span>'; }
  var liveCell = S === "zero" ? '<span class="spin"></span> ' + t("d.loading") : cell(moment ? "h.closes" : "d.next");
  App.mount({ tab: "home", cls: "is-done", docTitle: t("d.h1"), raw: C.dateline(liveCell) + hero() + '<div class="pg">' + body() + "</div>", points: basePts, pts: phase === "saving" ? "pending" : S === "results" ? "hits" : "", badges: { results: 2 }, after: function () {
    document.addEventListener("cd:zero", function () { if (S !== "zero") setTimeout(function () { location.href = "home.html"; }, 1200); });
    if (S === "zero") setTimeout(function () { App.toast(t("h.new")); }, 600);
    if (!moment) return;
    var hero = $("#hero"), day5 = $("#day5"), wrap = $("#reward-wrap"), fig = $("#done-fig"), timers = [], paid = false, settled = false;
    function at(ms, fn) { timers.push(setTimeout(fn, App.reduce ? Math.min(ms, 300) : ms)); }
    /* the points are credited with the fifth pick: only then does anything say "paid" */
    function pay() {
      if (paid) return; paid = true;
      var sp = App.$("#pts .spin"); if (sp) sp.remove();
      sess.data.paid = true; sess.save();
      hero.classList.remove("is-saving"); hero.classList.add("is-paid");   /* the band inks in, the reels run, the stamp lands (CSS, each with its own delay) */
      fig.classList.remove("is-wait");
      wrap.innerHTML = status("paid");
      day5.children[4].className = "is-done";
      try { if (navigator.vibrate) navigator.vibrate([12, 40, 18]); } catch (e) {}
      App.addPoints(100); App.live(t("toast.paid", { n: 100 }));
      /* the dateline turns to the next set as the stamp lands */
      at(760, function () { var f = $("#dl-flip"); if (!f) return; f.firstChild.textContent = t("d.next"); if (!App.reduce && !settled) { f.classList.remove("is-flip"); void f.offsetWidth; f.classList.add("is-flip"); } });
      at(1500, settle);
    }
    /* settle: the page is exactly the settled done page, nothing left to run */
    function settle() {
      if (settled) return; settled = true;
      timers.forEach(clearTimeout); document.removeEventListener("pointerdown", skip, true); document.removeEventListener("keydown", skip, true);
      pay();
      var f = $("#dl-flip"); if (f) f.firstChild.textContent = t("d.next");
      hero.classList.add("is-settled");
      if (hero.getAnimations) hero.getAnimations({ subtree: true }).forEach(function (a) { try { a.finish(); } catch (e) {} });
    }
    /* a tap or a key anywhere skips the show; the tap is not swallowed, so a tap on a button still works */
    function skip() { settle(); }
    document.addEventListener("pointerdown", skip, true); document.addEventListener("keydown", skip, true);
    at(900, pay);
  } });
})();
