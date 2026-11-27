/* Day done: the five answers lock into a printed grid, then the yellow sheet prints +100. ?moment=1 plays the reward moment; ?state=saving waits. */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state;
  var picks = A.picks(), set = M.set.map(A.q), play = A.qs.get("moment") === "1" && !A.reduce, saving = st === "saving";
  var day = M.results[0], rowOf = {}; day.rows.forEach(function (r) { rowOf[r.q] = r; });
  var tiles = set.map(function (q, i) {
    var c = picks[q.id] || "r", w = c === "l" ? q.left : q.right;
    return '<div class="tile t-' + c + '" style="--i:' + i + '"><b aria-hidden="true">' + (i + 1) + "</b><span>" + (c === "l" ? A.ICON.triL : "") + esc(w) + (c === "r" ? A.ICON.triR : "") + "</span></div>";
  }).join("");
  var wait = day.rows.filter(function (r) { return r.out === "wait" || r.out === "pend"; }).length;
  var body =
    '<section class="win' + (play ? " is-play" : "") + '" id="win" aria-label="' + t("d.h1") + '">' +
      '<div class="win-h"><h1 class="hh">' + t("d.h1") + '</h1><span class="lab">' + t("px.day.print") + "</span></div>" +
      '<div class="win-comp"><div class="win-grid" role="img" aria-label="' + t("d.picks") + '">' + tiles + "</div>" +
      '<div class="win-pay-w"><div class="win-pay' + (saving ? " is-wait" : "") + '"><div class="win-fig"><span>+<span id="plus">100</span></span><small>P</small></div>' +
      '<p class="win-st" role="status">' + (saving ? '<span class="busy"></span>' + t("d.saving.st") : t("d.paid.st")) + "</p></div></div>" +
      '<i class="reg reg-1"></i><i class="reg reg-2"></i><i class="reg reg-3"></i><i class="reg reg-4"></i></div>' +
    "</section>" +
    '<div class="after-w" style="display:flex;flex-direction:column">' +
    '<div class="pad" style="padding-top:20px;--i:0"><a class="btn btn-p" href="ranking.html"><span>' + t("d.rank") + "</span>" + A.ICON.go + "</a></div>" +
    '<section class="sec is-bare" style="--i:1;padding-bottom:16px"><span class="fig-l">' + t("d.next") + '</span>' +
      '<div class="cd" role="timer" aria-label="' + t("d.next") + '"><div><b data-cd="h"></b><span>' + t("d.u.h") + '</span></div><div><b data-cd="m"></b><span>' + t("d.u.m") + '</span></div><div><b data-cd="s"></b><span>' + t("d.u.s") + '</span></div></div>' +
      '<span class="fig-n">' + t("d.next.at") + "</span></section>" +
    '<section class="sec" style="--i:2"><div class="sec-hd"><h2 class="sec-h hh">' + t("d.picks") + '</h2><a class="lnk" href="results.html">' + t("d.results") + "</a></div>" +
      '<p class="sub" style="margin-bottom:6px">' + t("d.waitn", { n: wait }) + ". " + t("d.hit.1") + " " + t("d.hit.2") + "</p>" +
      '<ol class="rows">' + set.map(function (q, i) {
        var c = picks[q.id] || "r", r = rowOf[q.id] || {};
        return '<li class="row"><span class="num" style="width:22px;flex:none;font-size:var(--t-h2);font-weight:900">' + (i + 1) + '</span><div class="row-m"><p class="row-t">' + esc(q.title) + '</p><p class="row-s" style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + A.pick(c, c === "l" ? q.left : q.right) + "<span>" + (r.out === "pend" ? t("d.hitpending", { time: r.at }) : t("d.wait")) + "</span></p></div></li>";
      }).join("") + "</ol></section></div>";
  A.shell({ tab: "home", body: body });

  var win = document.getElementById("win");
  if (play) {
    var plus = document.getElementById("plus"); plus.textContent = "0";
    var tm = setTimeout(function () { A.roll(plus, 100, 0, 0, 620); }, 1320);
    var done;
    var skip = document.createElement("button"); skip.type = "button"; skip.className = "win-skip"; skip.setAttribute("aria-label", t("px.skip")); document.body.appendChild(skip);
    var end = function () { clearTimeout(tm); clearTimeout(done); win.classList.remove("is-play"); plus.textContent = "100"; skip.remove(); };
    done = setTimeout(end, 2500);
    skip.addEventListener("click", end); document.addEventListener("keydown", end, { once: true });
    window.__skip = end;
  }
})();
