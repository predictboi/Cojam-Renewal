/* Weekly ranking: the league. The prize pool leads; ranks 1 to 3 stand on a podium, ranks 4 to 10 follow in one table.
   The player's own rank is pinned above the dock. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$;
  var week = S === "lastweek" || S === "sent" ? "last" : "this";
  function prize(n) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function head() { return '<div class="ph-top"><h1>' + t("k.title") + "</h1></div>"; }
  function rowsFor(w) {
    var rows = M.ranking.map(function (r) { return r; });
    if (w === "last") return rows.map(function (r, i) { return Object.assign({}, r, { pts: r.pts + 900 - i * 10, prize: +(1196 * M.pool.split[i] / 100).toFixed(2) }); });
    if (S === "top10") rows[6] = { rank: 7, name: M.user.name, pts: 1150, prize: 51.36, me: true };
    if (S === "short") rows = rows.slice(0, 6);
    return rows;
  }
  function poolCt(w) { return w === "last" ? 1196 : M.pool.ct; }
  function pool(w) {
    if (S === "loading") return '<section class="sec pool" aria-busy="true">' + C.skel("120px") + C.skel("180px", "44px") + "</section>";
    var ct = poolCt(w);
    /* the time left is on the dateline; beside the pool sits the way to the rules (or, for a closed week, its state) */
    var how = '<button type="button" class="linkish" id="how">' + t("k.split.q") + C.icon("chev", 16) + "</button>";
    var right = '<div class="end">' + (w === "last" ? (S === "sent" ? C.tag(t("k.sent"), "ink", "check") : C.tag(t("k.final.h"), "ink")) : "") + how + "</div>";
    return '<section class="sec pool"><div class="pool-top"><div class="mhero"><p class="lbl">' + t(w === "last" ? "k.lastweek" : "k.pool") + '</p><p class="fig fig--xl">' + F.int(ct) + "<small>CT</small></p></div>" + right + "</div></section>";
  }
  function howSheet() {
    var ct = poolCt(week);
    var split = M.pool.split.map(function (p, i) { return "<div><span>" + t("k.rankth", { n: i + 1 }) + "</span><span>" + p + "%</span><b>" + prize(ct * p / 100) + " CT</b></div>"; }).join("");
    App.sheet.open("<h2>" + t("k.split.q") + '</h2><div class="stack-8"><p class="sheet-lead">' + t("k.pool.line", { n: F.int(ct) }) + '</p><p class="sheet-lead">' + t("k.tie") + " " + t("k.tie.note") + '</p><p class="sheet-lead">' + t("k.split.note") + "</p></div>" +
      '<div class="split">' + split + '</div><div class="sheet-acts">' + C.btn(t("common.close"), { block: true, attrs: "data-sheet-close" }) + "</div>");
  }
  function name(r) { return '<span translate="no">' + App.esc(r.name) + "</span>"; }
  function rankNo(n) { return '<span class="sr-only">' + t("k.rank.sr", { n: n }) + '</span><span aria-hidden="true">' + n + "</span>"; }
  function gap(g) { return t(g > 0 ? "k.gap.up" : g < 0 ? "k.gap.down" : "k.gap.same", { n: F.int(Math.abs(g)) }); }
  /* one row pattern for the whole table: rank, player, points, prize. Ranks 1 to 3 take the larger setting. */
  var rowN = 0;
  function row(r) {
    var lead = r.prize !== undefined && r.rank <= 3;
    return '<li style="--i:' + (rowN++) + '" class="krow' + (lead ? " krow--lead" : "") + (lead && r.rank === 1 ? " krow--first" : "") + (r.me ? " is-me" : "") + '" data-rank="' + r.rank + '"><span class="krow-rank">' + rankNo(r.rank) + "</span>" +
      '<p class="krow-name">' + name(r) + (r.me ? C.tag(t("k.you"), "ink") : "") + '</p><p class="krow-pts">' + F.pts(r.pts) + "</p>" +
      (r.prize === undefined ? "" : '<p class="krow-prize"><span data-prize="' + r.prize + '">' + prize(r.prize) + "</span><small>CT</small></p>") +
      (r.gap === undefined ? "" : '<p class="krow-gap krow-gap--one">' + (r.me ? "" : gap(r.gap)) + "</p>") + "</li>";
  }
  function aroundRows(w) {
    var rows = M.around.slice(1, 4);
    if (w === "last") rows = rows.map(function (r, i) { return Object.assign({}, r, { rank: 30 + i, pts: 1250 - i * 50 }); });
    var mine = rows.filter(function (r) { return r.me; })[0];
    return rows.map(function (r) { return Object.assign({}, r, { gap: r.pts - mine.pts }); });
  }
  function hasAround(w) { return S !== "loading" && S !== "unranked" && S !== "hold" && !(w === "this" && S === "top10"); }
  function around(w) {
    if (!hasAround(w)) return "";
    var rows = aroundRows(w);
    return '<section class="sec" id="around" tabindex="-1"><div class="sh"><h2>' + t("k.around") + '</h2><span class="muted tiny">' + t("k.around.sub", { a: rows[0].rank, b: rows[rows.length - 1].rank }) + "</span></div>" +
      '<div class="ktable"><ol class="klist klist--gap" aria-label="' + App.esc(t("k.col.gap")) + '">' + rows.map(row).join("") + "</ol></div></section>";
  }
  /* ranks 1 to 3 stand on a league podium (second, first, third from left to right; the list order for a screen reader stays 1, 2, 3) */
  function pod(r) {
    var ini = /^0x/.test(r.name) ? "0x" : Array.from(r.name)[0].toUpperCase();
    return '<li class="pod' + (r.me ? " is-me" : "") + '" data-rank="' + r.rank + '"><span class="pod-top"><span class="pod-av" aria-hidden="true">' + App.esc(ini) + '</span><span class="pod-name">' + name(r) + (r.me ? C.tag(t("k.you"), "ink") : "") + '</span><span class="pod-pts">' + F.pts(r.pts) + "</span></span>" +
      '<span class="pod-clip"><span class="pod-block"><span class="pod-rank">' + rankNo(r.rank) + '</span><span class="pod-prize"><span data-prize="' + r.prize + '">' + prize(r.prize) + "</span><small>CT</small></span></span></span></li>";
  }
  function list(w) {
    var colsHead = '<p class="cols" aria-hidden="true"><span>' + t("ar.rank.col") + "</span><span>" + t("ar.player.col") + "</span><span>" + t("ar.pts.col") + "</span><span>" + t("k.col.prize") + "</span></p>";
    if (S === "loading") return '<div class="podium podium--skel" aria-busy="true">' + C.skel("100%", "150px") + "</div>" + '<ul class="klist" id="top10" aria-busy="true">' + [1, 2, 3, 4, 5].map(function () { return '<li class="krow">' + C.skel("20px", "20px") + C.skel("120px", "14px") + C.skel("48px", "12px") + C.skel("64px", "14px") + "</li>"; }).join("") + "</ul>";
    var rows = rowsFor(w), voids = "";
    for (var i = rows.length + 1; i <= 10; i++) voids += '<li class="krow is-void"><span class="krow-rank" aria-hidden="true">' + i + '</span><p class="krow-name">' + t("k.void") + "</p></li>";
    return '<ol class="podium" id="podium" aria-label="' + App.esc(t("ar.podium")) + '">' + rows.slice(0, 3).map(pod).join("") + "</ol>" +
      '<div class="ktable">' + colsHead + '<ol class="klist" id="top10" start="4">' + rows.slice(3).map(row).join("") + voids + "</ol></div>";
  }
  function pin(w) {
    if (S === "loading" || S === "error") return "";
    var me = M.me;
    function bar(rank, title, sub, pts, label) {
      return '<button type="button" class="pin" id="pin" aria-label="' + App.esc(t("k.around.open")) + '"><span class="pin-rank"><span class="sr-only">' + t("k.rank.sr", { n: rank }) + '</span><span aria-hidden="true">' + rank + '</span></span><span class="pin-main"><b>' + title + "</b><span>" + sub + '</span></span><span class="pin-pts">' + F.pts(pts) + "<small>" + label + "</small></span></button>";
    }
    if (S === "hold") return '<aside class="pin pin--wide" id="pin" aria-label="' + App.esc(t("k.you")) + '"><span class="pin-main"><b>' + t("k.you") + "</b><span>" + t("hold.rank.pin") + '</span></span><span class="pin-pts">' + F.pts(w === "last" ? 1200 : me.pts) + "<small>" + t(w === "last" ? "k.lastweek" : "r.week") + "</small></span></aside>";
    if (w === "last") return bar(31, t("k.you"), t("k.final.h"), 1200, t("k.lastweek"));
    if (S === "unranked") return '<aside class="pin pin--wide" id="pin" aria-label="' + t("k.you") + '"><div class="pin-main"><b>' + t("k.none") + "</b></div>" + C.btn(t("k.play"), { sm: true, href: "home.html", cls: "btn-onink" }) + "</aside>";
    if (S === "top10") return bar(7, t("k.in"), t("k.prize", { c: "51.36" }), 1150, t("r.week"));
    return bar(me.rank, t("k.you"), t("k.gap", { gap: F.int(me.gap) }), me.pts, t("r.week"));
  }
  /* the prizes of the first three roll up as their rows set; the rest are still (ten rolling figures would be noise) */
  function roll() { App.$$("#podium [data-prize]").forEach(function (el, i) { var to = +el.getAttribute("data-prize"); el.textContent = prize(0); setTimeout(function () { App.countTo(el, 0, to, prize, null, 620); }, [520, 360, 680][i] || 400); }); }
  function toAround() {
    var a = $("#around"); if (!a) return;
    a.scrollIntoView({ behavior: App.reduce ? "auto" : "smooth", block: "center" }); a.focus({ preventScroll: true });
    a.classList.remove("is-flash"); void a.offsetWidth; a.classList.add("is-flash");
  }
  function view(w) {
    var note = ""; rowN = 0;
    if (S === "hold") note = C.hold(t("hold.rank"));
    else if (w === "last") note = S === "sent" ? C.note("ok", t("k.sent") + ' <a href="https://kaiascan.io/" target="_blank" rel="noopener">' + t("w.scan") + "</a>") : C.note("", t("k.closed", { time: t("k.final.time") }));
    else if (S === "winner") note = C.note("ok", t("k.last", { rank: 4, amount: "119.60" }));
    return note + pool(w) + '<section class="sec"><div class="sh"><h2>' + t("k.top") + "</h2>" + (S === "loading" || w === "last" ? "" : C.stamp(12)) + "</div>" +
      list(w) + '<p class="tie-line">' + C.icon("info", 16) + "<span>" + t("k.tie") + "</span></p></section>" + around(w);
  }
  function body() {
    if (S === "error") return C.error();
    return C.seg([{ label: t("r.week"), value: "this", on: week === "this" }, { label: t("k.lastweek"), value: "last", on: week === "last" }], { name: "week", label: t("k.week") }) + '<div class="pg-view" id="view">' + view(week) + "</div>";
  }
  App.mount({ tab: "rank", cls: "sc-rank", docTitle: t("k.title"), live: "<span>" + t("k.ends") + '</span> <b data-cd="' + M.untilWeekEnd() + '" data-cd-fmt="dh"></b>', head: head(), body: body(), pin: pin(week), badges: { home: "dot", results: 2 }, after: function () {
    document.addEventListener("seg", function (e) {
      if (e.detail.name !== "week" || e.detail.value === week) return; week = e.detail.value;
      /* the week turns like a page: the old table leaves towards the side it belongs to (120 ms), the new one comes in from the other side and sets again.
         The control has already switched, and a second tap during the turn simply wins. */
      var v = $("#view"), dir = week === "last" ? -1 : 1;
      function swap() {
        v.innerHTML = view(week); var p = $("#pin"); if (p) p.outerHTML = pin(week); App.enhance(document.body); App.pinFit(); roll();
        if (!App.reduce && v.animate) v.animate([{ opacity: 0, transform: "translateX(" + dir * -18 + "px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      }
      clearTimeout(v._turn);
      if (App.reduce || !v.animate) swap();
      else { v.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + dir * 18 + "px)" }], { duration: 120, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" }); v._turn = setTimeout(function () { v.getAnimations().forEach(function (a) { a.cancel(); }); swap(); }, 120); }
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest("#how")) howSheet();
      else if (e.target.closest("button#pin")) toAround();
    });
    if (S === "how") howSheet();
    roll();
  } });
})();
