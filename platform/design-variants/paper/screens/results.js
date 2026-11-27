/* Results: the box scores. Three figures divided by column rules, a filter, then one section per day with a stamp for every answer that is set. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$, esc = App.esc;
  var filter = S === "nowaiting" ? "wait" : S === "noset" ? "set" : "all";
  var days = M.results;
  if (S === "nowaiting") days = days.slice(1);
  if (S === "noset") days = [days[0]];   /* only today's set, and none of its answers can be set yet */
  /* one small mark per question beside the day: hit (blue, filled), miss (ink outline), waiting (dashed), off (not answered or cancelled) */
  var MARK = { hit: "hit", pend: "hit", corr: "hit", miss: "miss", wait: "wait", none: "off", "void": "off" };
  var LI = { en: 0, ko: 1, ja: 2 }[App.lang] || 0;
  var rowsById = {};

  function head() { return '<div class="ph-top ph-top--q"><h1>' + t("r.title") + "</h1>" + C.q("hits", t("h.ai.h")) + "</div>"; }
  function mark(k) { return '<i class="rmark rmark--' + k + '" aria-hidden="true"></i>'; }
  function summary() {
    if (S === "loading") return '<section class="sec" aria-busy="true"><div class="tri">' + [1, 2, 3].map(function () { return '<div class="tri-c">' + C.skel("72px", "24px") + C.skel("60px", "12px", "margin-top:6px") + "</div>"; }).join("") + "</div></section>";
    var pend = null; M.results.forEach(function (g) { g.rows.forEach(function (r) { if (r.out === "pend" && !pend) pend = r; }); });
    function col(fig, label, sub) { return '<div class="tri-c"><h2 class="tri-lbl">' + label + '</h2><p class="tri-fig">' + fig + "</p>" + (sub ? '<p class="tri-sub tnum">' + sub + "</p>" : "") + "</div>"; }
    return '<section class="sec" aria-label="' + esc(t("r.sum.sr")) + '"><div class="tri">' +
      col(F.pts(M.week.pts), t("r.week"), t("r.sum.hits", { a: M.week.hits, b: M.week.answered })) +
      col(F.pts(M.all.pts), t("r.all"), t("r.sum.rate", { n: M.all.rate })) +
      col("+" + F.pts(M.user.pendingHit), t("r.pending"), pend ? t("r.at", { time: pend.at }) : "") + "</div></section>";
  }
  function legend() {
    return '<ul class="rs-legend" aria-label="' + esc(t("r.legend")) + '"><li>' + mark("hit") + t("r.o.hit") + "</li><li>" + mark("miss") + t("r.o.miss") + "</li><li>" + mark("wait") + t("r.f.wait") + "</li></ul>";
  }
  /* the right column of every row: the stamp or the state, then the points, always in the same place */
  /* every stamp sits at its own small angle, fixed by its place in the list (stable between visits), and lands in the order of the list */
  var ANG = [-5, 3, -2, 4, -4, 2, -3, 5], stampN = 0;
  function stamp(kind, text) { var k = stampN++; return '<span class="rstamp rstamp--' + kind + ' is-land" style="--rot:' + ANG[k % ANG.length] + "deg;--d:" + Math.min(k, 9) * 70 + 'ms">' + text + "</span>"; }
  function side(r) {
    var chip, pts;
    switch (r.out) {
      case "wait": chip = '<span class="rchip rchip--wait">' + mark("wait") + t("pp.answerat", { time: r.exp }) + "</span>"; pts = '<span class="rs-pts is-if">' + t("r.o.ifhit") + "</span>"; break;
      case "hit": chip = stamp("hit", t("r.o.hit")); pts = '<span class="rs-pts">+50P</span>'; break;
      case "pend": chip = stamp("hit", t("r.o.hit")); pts = '<span class="rs-pts">+50P<small>' + t("r.at", { time: r.at }) + "</small></span>"; break;
      case "corr": chip = stamp("corr", t("r.o.corr")); pts = '<span class="rs-pts">+50P</span>'; break;
      case "miss": chip = stamp("miss", t("r.o.miss")); pts = ""; break;
      case "none": chip = '<span class="rchip">' + t("r.o.none") + "</span>"; pts = ""; break;
      default: chip = '<span class="rchip">' + t("r.o.void") + "</span>"; pts = "";
    }
    return '<span class="rs-side">' + chip + pts + "</span>";
  }
  function row(r, gi, ri, date) {
    var id = "x-" + gi + "-" + ri, q = App.q(r.q), more = "";
    var set = r.out === "hit" || r.out === "pend" || r.out === "miss" || r.out === "corr";
    rowsById[id] = { r: r, date: date };
    if (set) more += "<span><b>" + t("r.x.answer") + ":</b> " + esc(q[r.out === "miss" ? (r.c === "r" ? "l" : "r") : r.c]) + "</span><span><b>" + t("r.x.evidence") + ":</b> " + t("p.evidence") + "</span><span><b>" + t("r.x.setat") + ":</b> " + F.date(date, true) + "</span>";
    if (r.out === "pend") more += "<span>" + t("r.o.pend.help") + "</span>";
    if (r.out === "corr") more += "<span>" + t("r.o.corr.line", { date: F.date(date) }) + " " + t("r.o.added") + "</span>";
    if (r.out === "void") more += "<span>" + t("r.o.void.line") + "</span>";
    if (r.out === "wait") more += "<span><b>" + t("h.ai.src") + ":</b> " + esc(q.rule || "") + "</span>";
    var inner = '<span class="rs-main"><span class="rrow-q">' + esc(q.title) + '</span><span class="rs-meta">' + (r.c ? "<span>" + C.pick(r.c, esc(q[r.c])) + "</span>" : "<span>" + t("cat." + q.cat) + "</span>") + "</span></span>" + side(r);
    var li = '<li data-out="' + (r.out === "wait" ? "wait" : "set") + '">';
    if (!more) return li + '<div class="rrow">' + inner + "</div></li>";
    return li + '<button type="button" class="rrow" aria-expanded="false" aria-controls="' + id + '">' + inner + "</button>" +
      '<div class="rrow-more" id="' + id + '" hidden><div class="rrow-clip">' + more + (r.out === "void" ? "" : '<button type="button" class="linkish" data-how="' + id + '">' + t("h.ai.h") + C.icon("chev", 16) + "</button>") + "</div></div></li>";
  }
  function group(g, gi) {
    var d = M.ago(g.day), label = g.day === 0 ? t("common.today") : g.day === 1 ? t("common.yesterday") : F.weekday(d);
    var inv = S === "noset" ? null : M.invite.days[g.day];
    var n = { hit: 0, miss: 0, wait: 0, off: 0 }; g.rows.forEach(function (r) { n[MARK[r.out]]++; });
    return '<section class="sec rs-day" data-group><div class="rs-dayh"><div class="rs-dayh-t"><h2>' + label + '</h2><span class="rmarks" role="img" aria-label="' + esc(t("r.marks.sr", { h: n.hit, m: n.miss, w: n.wait })) + '">' + g.rows.map(function (r) { return mark(MARK[r.out]); }).join("") + "</span></div>" +
      (g.done ? "" : '<p class="rs-dayh-sub">' + t("r.g.part", { k: g.answered }) + "</p>") + '<p class="rs-count" data-roll="' + g.total + '">+' + F.pts(g.total) + "</p></div>" +
      (inv ? '<a class="rs-inv" href="invite.html"><b>' + t("r.inv") + '</b><span class="rs-inv-p">+' + F.pts(inv.pts) + "</span>" + C.icon("chev", 16) + "</a>" : "") +
      '<ul class="list">' + g.rows.map(function (r, ri) { return row(r, gi, ri, d); }).join("") + "</ul></section>";
  }
  function howSheet(id) {
    var x = id && rowsById[id], rows = [];
    if (x) {
      var q = App.q(x.r.q), rule = q.rule;
      if (rule) rows.push([t("h.ai.src"), esc(rule)]);
      rows.push([t("h.ai.when"), x.r.out === "wait" ? (q.settle ? t("h.ai.after", { time: q.settle }) : t("r.at", { time: x.r.exp })) : F.date(x.date, true)]);
    }
    App.sheet.open("<h2>" + t("h.ai.h") + '</h2><ol class="txsteps txsteps--plain">' + ["h.ai.1", "h.ai.2", "h.ai.3"].map(function (k, i) { return '<li><span class="n">' + (i + 1) + "</span><span>" + t(k) + "</span></li>"; }).join("") + "</ol>" +
      (rows.length ? C.rows(rows) : "") + '<div class="sheet-acts">' + C.btn(t("common.close"), { block: true, attrs: "data-sheet-close" }) + "</div>");
  }
  function body() {
    if (S === "error") return C.error();
    if (S === "empty") return C.empty({ icon: "list", title: t("r.empty.h"), body: t("r.empty.b"), action: C.btn(t("r.empty.btn"), { kind: "primary", href: "home.html" }) });
    var seg = C.seg([{ label: t("r.f.all"), value: "all", on: filter === "all" }, { label: t("r.f.wait"), value: "wait", on: filter === "wait" }, { label: t("r.f.set"), value: "set", on: filter === "set" }], { name: "filter", label: t("r.filter") });
    if (S === "loading") return summary() + seg + [1, 2].map(function () { return '<section class="sec rs-day" aria-busy="true"><div class="rs-dayh">' + C.skel("90px", "20px") + C.skel("64px", "26px") + "</div>" + [1, 2, 3].map(function () { return '<div class="rrow"><span class="rs-main">' + C.skel("90%", "16px") + C.skel("50%", "12px") + "</span>" + C.skel("64px", "24px") + "</div>"; }).join("") + "</section>"; }).join("") + '<p class="sr-only" role="status">' + t("common.loading") + "</p>";
    return summary() + seg + legend() + '<div class="pg-groups" id="groups">' + days.map(group).join("") + '</div><div id="fempty" hidden></div>' +
      C.btn(t("r.more"), { block: true, id: "more", icon: "down" });
  }
  App.mount({ tab: "results", cls: "sc-results", docTitle: t("r.title"), live: "<span>" + t("d.next") + '</span> <b data-cd="' + M.untilNextSet() + '"></b>', head: head(), body: body(), pts: S === "" ? "hits" : S === "loading" ? "loading" : "", badges: { home: "dot" }, after: function () {
    var groups = $("#groups"); if (!groups) return;
    function apply(f) {
      var any = false;
      App.$$("[data-group]", groups).forEach(function (g) {
        var shown = 0; App.$$("li[data-out]", g).forEach(function (li) { var on = f === "all" || li.getAttribute("data-out") === f; li.hidden = !on; if (on) shown++; });
        g.hidden = !shown; if (shown) any = true;
      });
      var fe = $("#fempty"); fe.hidden = any; $("#more").hidden = !any || moreDone;
      if (!any) fe.innerHTML = C.empty({ icon: f === "wait" ? "check" : "clock", title: t(f === "wait" ? "r.fe.wait" : "r.fe.set") });
    }
    var moreDone = false, current = filter;
    apply(filter);
    /* the points of each day count up once, after its stamps have started to land (the first two days are on screen) */
    App.$$("[data-roll]", groups).slice(0, 2).forEach(function (el, i) { var to = +el.getAttribute("data-roll"); el.textContent = "+0P"; setTimeout(function () { App.countTo(el, 0, to, function (v) { return "+" + F.pts(v); }, null, 520); }, 180 + i * 260); });
    document.addEventListener("seg", function (e) { if (e.detail.name === "filter") { current = e.detail.value; apply(current); } });
    groups.addEventListener("click", function (e) {
      var h = e.target.closest("[data-how]"); if (h) { howSheet(h.getAttribute("data-how")); return; }
      var b = e.target.closest("button.rrow"); if (!b) return;
      /* the detail unfolds under its row like a clipping (an accordion: the one place a height is animated, through grid rows) */
      var open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open); var m = document.getElementById(b.getAttribute("aria-controls")); if (m) { clearTimeout(m._h); if (open) { m.hidden = false; void m.offsetHeight; m.classList.add("is-open"); } else { m.classList.remove("is-open"); m._h = setTimeout(function () { m.hidden = true; }, App.reduce ? 0 : 250); } }
    });
    $("#more").addEventListener("click", function () {
      var extra = { day: 4, done: true, total: 200, rows: [
        { q: "p5", c: "r", out: "hit" }, { q: "p2", c: "r", out: "hit" }, { q: "p6", c: "l", out: "miss" }, { q: "p7", c: "r", out: "miss" }, { q: "p3", c: "l", out: "miss" }] };
      groups.insertAdjacentHTML("beforeend", group(extra, 9)); moreDone = true; this.hidden = true; apply(current);
    });
    if (S === "open") { var first = $("button.rrow", groups); if (first) first.click(); }
  } });
})();
