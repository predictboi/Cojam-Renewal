/* Day done: the capsule machine. While the last pick is saved a closed capsule drops in and wobbles; when the points are paid it pops open:
   the lid flies off, Jam jumps out, the "+100P" coin sticker is slapped on, a few flat bits burst, the fifth sticker lands on the sheet,
   the live chip turns from "Closes in" to "Next set in" and the points in the header count up. About 2.2 seconds, and a tap skips to the settled page.
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
  var BITS = [["sun", -112, -58, 40], ["accent", 118, -70, -60], ["pick-l", -86, 44, 90], ["pick-r", 96, 52, -30], ["sun", 30, -96, 120], ["accent", -34, -92, -90], ["pick-r", -132, 6, 60], ["pick-l", 136, -8, -120]];
  function hero() {
    var segs = phase === "saving" ? ["done", "done", "done", "done", "pend"] : ["done", "done", "done", "done", "done"];
    return '<section class="done-hero' + (moment ? " is-moment" : "") + (phase === "saving" ? " is-saving" : "") + '" id="hero">' +
      '<div class="cap-stage" aria-hidden="true"><div class="cap-drop"><div class="cap" id="cap">' +
      '<span class="cap-jam">' + C.jam("cheer", 108) + '</span><span class="cap-bot"></span><span class="cap-top"><i></i></span></div></div>' +
      BITS.map(function (b, i) { return '<i class="bit bit--' + (i % 3) + '" style="--c:var(--' + b[0] + ");--x:" + b[1] + "px;--y:" + b[2] + "px;--r:" + b[3] + 'deg"></i>'; }).join("") +
      '<p class="cap-coin' + (phase === "saving" ? " is-wait" : "") + '" id="done-fig"><span>+100<small>P</small></span></p>' +
      '<span class="seal" id="seal">' + C.rstamp("hit", C.icon("check", 14) + t("ar.paid")) + "</span>" +
      (wel ? '<p class="done-wel" id="done-wel"><b>+' + W + "P</b><span>" + t("d.wel.tag") + "</span></p>" : "") + "</div>" +
      "<h1>" + t("d.h1") + "</h1>" +
      '<div aria-live="polite" id="reward-wrap">' + status(phase) + "</div>" +
      '<div class="ph-line ph-line--sheet"><span class="ph-count">5<small>/5</small></span>' + C.day5(segs, { id: "day5", label: "5/5", size: "lg" }) + "</div>" +
      (moment ? '<p class="done-skip" aria-hidden="true">' + t("ar.skip") + "</p>" : "") + "</section>";
  }
  function pickRow(p, i) {
    var o = outcome[i], q = App.q(p[0]);
    var sub = o === "pend" ? t("d.hitpending", { time: "22:10" }) : o === "miss" ? t("d.miss") : "";
    return '<li class="pick"><span class="pick-q">' + App.esc(q.title) + '</span><span class="pick-c">' + C.pick(p[1], App.esc(q[p[1]])) + (sub ? "<small>" + sub + "</small>" : "") + "</span></li>";
  }
  function body() {
    return C.btn(t("d.rank"), { kind: "primary", block: true, href: "ranking.html", iconEnd: "right" }) +
      (wel ? '<p class="done-welnote">' + t("d.wel.note", { name: '<b translate="no">' + App.esc(M.invite.by) + "</b>", w: W }) + "</p>" : "") +
      '<section class="sec box"><div class="sh"><h2>' + t("d.picks") + '</h2><a class="linkish" href="results.html">' + t("d.results") + "</a></div>" +
      '<div class="done-wait">' + (waiting ? '<p class="done-wait-n">' + t("d.waitn", { n: waiting }) + "</p>" : "") + '<div class="plain-note"><p>' + t("d.hit.1") + "</p><p>" + t("d.hit.2") + "</p></div></div>" +
      '<ul class="list">' + picks.map(pickRow).join("") + "</ul></section>";
  }
  /* the live chip: while the last pick is saved it still reads "Closes in"; once paid it turns to the next set */
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
      hero.classList.remove("is-saving"); hero.classList.add("is-paid");   /* the capsule pops, Jam jumps, the coin sticker lands (CSS, each with its own delay) */
      fig.classList.remove("is-wait");
      wrap.innerHTML = status("paid");
      day5.children[4].className = "is-done";
      try { if (navigator.vibrate) navigator.vibrate([12, 40, 18]); } catch (e) {}
      App.addPoints(100); App.live(t("toast.paid", { n: 100 }));
      /* the live chip turns to the next set as the coin sticker lands */
      at(700, function () { var f = $("#dl-flip"); if (!f) return; f.firstChild.textContent = t("d.next"); if (!App.reduce && !settled) { f.classList.remove("is-flip"); void f.offsetWidth; f.classList.add("is-flip"); } });
      at(1400, settle);
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
    at(850, pay);
  } });
})();
