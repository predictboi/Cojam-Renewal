/* Results: three figures, a filter, then one section per day. */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state, L = A.lang;
  if (st === "loading") return A.shell({ tab: "results", body: head() + A.skeleton() });
  if (st === "error") return A.shell({ tab: "results", body: head() + A.errBlock() });
  if (st === "empty") return A.shell({ tab: "results", body: head() + A.stateBlock("0", t("r.empty.h"), t("r.empty.b"), '<a class="btn btn-p" href="home.html"><span>' + t("r.empty.btn") + "</span>" + A.ICON.go + "</a>") });
  function head() { return '<div class="ph"><h1 class="ph-t d">' + t("r.title") + "</h1></div>"; }

  var OUT = { hit: ["chip-k", "r.o.hit", "+50P", "mk-hit"], corr: ["chip-k", "r.o.corr", "+50P", "mk-hit"], miss: ["chip-o", "r.o.miss", "0P", ""], wait: ["chip-m", "r.o.wait", "", "mk-wait"], pend: ["chip-y", "r.o.hit", "+50P", "mk-wait"], none: ["", "r.o.none", "", "mk-none"], "void": ["chip-m", "r.o.void", "", "mk-void"] };
  var filter = "all";
  function dayName(d) { return d === 0 ? t("common.today") : d === 1 ? t("common.yesterday") : A.date(M.ago(d)); }
  function row(r, i) {
    var q = M.questions[r.q], x = q[L] || q.en, o = OUT[r.out], sub = "";
    if (r.out === "wait") sub = t("r.o.waitat", { time: t("r.at", { time: r.exp }) }) ;
    if (r.out === "pend") sub = t("r.o.pend", { time: r.at });
    if (r.out === "corr") sub = t("r.o.corr.line", { date: A.date(M.ago(1)) });
    if (r.out === "void") sub = t("r.o.void.line");
    var state = r.out === "none" ? '<span class="lab">' + t(o[1]) + "</span>" : '<span class="chip ' + o[0] + (r.out === "hit" || r.out === "corr" ? " pop" : "") + '" style="--i:' + i + '">' + t(o[1]) + "</span>";
    return '<li class="res rv" style="--i:' + i + '" data-k="' + (r.out === "wait" || r.out === "pend" ? "wait" : r.out === "none" ? "none" : "set") + '"><div><p class="res-q">' + esc(x.title) + '</p><p class="res-p">' +
      (r.c ? A.pick(r.c, r.c === "l" ? x.left : x.right) : "") + (r.out === "wait" ? "<span>" + t("r.o.ifhit") + "</span>" : "") + "</p></div>" +
      '<div class="res-o">' + state + (o[2] ? '<span class="pts">' + o[2] + "</span>" : "") + "</div>" + (sub ? '<p class="res-x">' + sub + "</p>" : "") + "</li>";
  }
  function day(d, k) {
    var inv = M.invite.days[d.day], n = 0;
    var marks = d.rows.map(function (r) { return '<i class="mk ' + OUT[r.out][3] + '"></i>'; }).join("");
    var h = d.rows.filter(function (r) { return r.out === "hit" || r.out === "corr"; }).length, m = d.rows.filter(function (r) { return r.out === "miss"; }).length, w = d.rows.filter(function (r) { return r.out === "wait" || r.out === "pend"; }).length;
    return '<section class="sec' + (k === 0 ? " is-heavy" : "") + '" data-day><div class="day-hd"><h2 class="hh">' + dayName(d.day) + '</h2><span class="day-tot">+' + d.total + "P</span></div>" +
      '<div class="day-sub"><span>' + (d.done ? t("r.g.done") : t("r.g.part", { k: d.answered })) + (d.pending ? ", " + t("r.g.pending", { q: d.pending }) : "") + '</span><span class="day-mk" role="img" aria-label="' + t("r.marks.sr", { h: h, m: m, w: w }) + '">' + marks + "</span></div>" +
      (inv ? '<p class="inv-line"><span>' + t("r.inv") + '</span><b>+' + inv.pts + "P</b></p>" : "") +
      '<ol>' + d.rows.map(function (r, i) { return row(r, k * 5 + i); }).join("") + "</ol></section>";
  }
  var body = head() +
    '<div class="trio pad" role="group" aria-label="' + t("r.sum.sr") + '" style="border-top:var(--rule) solid var(--ink);margin:0 var(--m);padding:0">' +
      '<div><span class="fig-l">' + t("r.week") + '</span><span class="fig-v"><span data-roll="' + M.week.pts + '"></span><small>P</small></span><span class="fig-n">' + t("r.sum.hits", { a: M.week.hits, b: M.week.answered }) + "</span></div>" +
      '<div><span class="fig-l">' + t("r.all") + '</span><span class="fig-v"><span data-roll="' + M.all.pts + '"></span><small>P</small></span><span class="fig-n">' + t("r.sum.rate", { n: M.all.rate }) + "</span></div>" +
      '<div><span class="fig-l">' + t("r.pending") + '</span><span class="fig-v">+' + M.user.pendingHit + '<small>P</small></span><span class="fig-n">' + t("r.at", { time: "04:10" }) + "</span></div></div>" +
    '<div class="pad" style="padding-top:14px;padding-bottom:16px"><div class="seg" role="group" aria-label="' + t("r.filter") + '" id="filter">' +
      ["all", "wait", "set"].map(function (f) { return '<button type="button" data-f="' + f + '" aria-pressed="' + (f === "all") + '">' + t("r.f." + f) + "</button>"; }).join("") + "</div>" +
      '<p class="legend" aria-label="' + t("r.legend") + '"><span><i class="mk mk-hit"></i>' + t("r.o.hit") + '</span><span><i class="mk"></i>' + t("r.o.miss") + '</span><span><i class="mk mk-wait"></i>' + t("r.f.wait") + "</span></p></div>" +
    '<div id="days">' + M.results.map(day).join("") + '</div><p class="pad sub" id="fe" hidden style="padding-top:8px"></p>' +
    '<div class="pad"><button type="button" class="btn btn-s" id="more"><span>' + t("r.more") + "</span></button></div>";
  A.shell({ tab: "results", body: body });
  document.getElementById("filter").addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]"); if (!b) return; filter = b.getAttribute("data-f");
    this.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    var any = false;
    document.querySelectorAll("[data-day]").forEach(function (s) {
      var n = 0; s.querySelectorAll(".res").forEach(function (r) { var show = filter === "all" || r.getAttribute("data-k") === filter; r.hidden = !show; if (show) n++; });
      s.hidden = !n; if (n) any = true;
    });
    var fe = document.getElementById("fe"); fe.hidden = any; fe.textContent = filter === "wait" ? t("r.fe.wait") : t("r.fe.set");
  });
  document.getElementById("more").addEventListener("click", function () { A.toast(t("common.loading")); });
})();
