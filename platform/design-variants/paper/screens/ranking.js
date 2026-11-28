/* Weekly ranking: the league table. The pool and the time left lead; ranks 1 to 3 are set larger, the leader largest, in one table with ranks 4 to 10.
   The player's own rank is pinned above the tab bar in ink. */
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
    var right = '<div class="end">' + (w === "last" ? (S === "sent" ? "" : C.tag(t("k.final.h"), "ink")) : "") + how + "</div>";
    return '<section class="sec pool"><div class="pool-top"><div class="mhero"><p class="lbl">' + t(w === "last" ? "k.lastweek" : "k.pool") + '</p><p class="fig fig--xl">' + F.int(ct) + "<small>CT</small></p></div>" + right + "</div></section>";
  }
  function howSheet() {
    var ct = poolCt(week);
    var split = M.pool.split.map(function (p, i) { return "<div><span>" + t("k.rankth", { n: i + 1 }) + "</span><span>" + p + "%</span><b>" + prize(ct * p / 100) + " CT</b></div>"; }).join("");
    App.sheet.open("<h2>" + t("k.split.q") + '</h2><div class="stack-8"><p class="sheet-lead">' + t("k.pool.line", { n: F.int(ct) }) + '</p><p class="sheet-lead">' + t("k.tie") + " " + t("k.tie.note") + '</p><p class="sheet-lead">' + t("k.split.note") + "</p></div>" +
      '<div class="split">' + split + '</div><div class="sheet-acts">' + C.btn(t("common.close"), { block: true, attrs: "data-sheet-close" }) + "</div>");
  }
  /* one face for every name in the table (the text face). The "x" of an address is shaped on its own (an inline block), so the text face cannot turn "0x4" into a multiplication sign. */
  function name(r) { return /^0x/i.test(r.name) ? '<span translate="no">0<span class="xb">x</span>' + App.esc(r.name.slice(2)) + "</span>" : App.name(r.name); }
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
    return '<section class="sec sec-rule" id="around" tabindex="-1"><div class="sh"><h2>' + t("k.around") + "</h2></div>" +
      '<ol class="klist klist--gap" aria-label="' + App.esc(t("k.col.gap")) + '">' + rows.map(row).join("") + "</ol></section>";
  }
  function list(w) {
    var colsHead = '<p class="cols" aria-hidden="true"><span>' + t("pp.rank.col") + "</span><span>" + t("pp.player.col") + "</span><span>" + t("pp.pts.col") + "</span><span>" + t("k.col.prize") + "</span></p>";
    if (S === "loading") return colsHead + '<ul class="klist" id="top10" aria-busy="true">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function () { return '<li class="krow">' + C.skel("20px", "20px") + C.skel("120px", "14px") + C.skel("48px", "12px") + C.skel("64px", "14px") + "</li>"; }).join("") + "</ul>";
    var rows = rowsFor(w), voids = "";
    for (var i = rows.length + 1; i <= 10; i++) voids += '<li class="krow is-void"><span class="krow-rank" aria-hidden="true">' + i + '</span><p class="krow-name">' + t("k.void") + "</p></li>";
    return colsHead + '<ol class="klist" id="top10">' + rows.map(row).join("") + voids + "</ol>";
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
  function roll() { App.$$("#top10 .krow--lead [data-prize]").forEach(function (el, i) { var to = +el.getAttribute("data-prize"); el.textContent = prize(0); setTimeout(function () { App.countTo(el, 0, to, prize, null, 560); }, 120 + i * 90); }); }
  /* while the player's own row is on screen the pinned own bar steps aside: the same line is never shown twice */
  var io = null;
  function watchOwn() {
    if (io) io.disconnect(); var row = $("#around .is-me"), p = $("#pin"); if (!row || !p || !window.IntersectionObserver) return;
    io = new IntersectionObserver(function (en) { var pin = $("#pin"); if (pin) pin.classList.toggle("is-away", en[0].isIntersecting); }, { rootMargin: "0px 0px -130px 0px", threshold: 0.6 }); io.observe(row);
  }
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
    return note + pool(w) + '<section class="sec sec-rule"><div class="sh"><h2>' + t("k.top") + "</h2>" + (S === "loading" || w === "last" ? "" : C.stamp(12)) + "</div>" +
      '<div class="ktable">' + list(w) + "</div></section>" + around(w);
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
      swap(); watchOwn();   /* the new page is in place at once and comes in from its side: the screen is never blank during the turn */
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest("#how")) howSheet();
      else if (e.target.closest("button#pin")) toAround();
    });
    if (S === "how") howSheet();
    roll(); watchOwn();
    /* At rest the pinned own bar never cuts through a row: the table is set down by the few pixels it takes for a row to end exactly at the bar's top edge. */
    function wholeRows() {
      var sec = $("#view .sec-rule"), p = $("#pin"); if (!sec) return; sec.style.marginTop = "";
      if (!p || p.classList.contains("is-flow") || p.classList.contains("is-away") || window.scrollY > 0) return;
      var top = p.getBoundingClientRect().top, rows = App.$$("#top10 .krow, #view .sh, #view .cols");
      for (var i = 0; i < rows.length; i++) { var q = rows[i].getBoundingClientRect(); if (q.top < top - 0.5 && q.bottom > top + 0.5) { sec.style.marginTop = Math.ceil(top - q.top) + "px"; break; } }
    }
    wholeRows(); setTimeout(wholeRows, 800); window.addEventListener("resize", wholeRows);   /* again once the bar has come in */ document.addEventListener("seg", function () { setTimeout(wholeRows, 0); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(wholeRows);
  } });
})();
