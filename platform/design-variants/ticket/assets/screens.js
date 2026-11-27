/* Every screen except Home and Day done (assets/home.js). Mock data only. */
(function () {
  "use strict";
  var T = window.TK, t = T.t, M = T.M, ic = T.ic, esc = T.esc, num = T.num, url = T.url, st = T.state, S = T.screens;
  function ph(h, sub) { return '<div class="ph"><h1 class="hd-1">' + h + "</h1>" + (sub ? "<p>" + sub + "</p>" : "") + "</div>"; }
  function loading() { return '<div class="sk" style="height:120px"></div><div class="sk" style="height:220px"></div><div class="sk" style="height:160px"></div><span class="sr" role="status">' + t("common.loading") + "</span>"; }
  function more(q, body, open) { return '<details class="more"' + (open ? " open" : "") + "><summary>" + q + ic("down") + "</summary><div>" + body + "</div></details>"; }
  function short(a) { return a.slice(0, 6) + "…" + a.slice(-4); }
  function grouped(a) { return a.replace(/(.{6})/g, "$1 ").trim(); }
  function row(k, v, sub) { return '<div class="row"><dt>' + k + "</dt><dd>" + v + (sub ? "<small>" + sub + "</small>" : "") + "</dd></div>"; }

  /* ================= Results: checked tickets ================= */
  S.results = function () {
    var main = T.shell({ tab: "results" });
    if (st === "loading") { main.innerHTML = ph(t("r.title")) + loading(); return; }
    if (st === "error") { main.innerHTML = ph(t("r.title")) + T.errBox(); return; }
    if (st === "empty") { main.innerHTML = ph(t("r.title")) + T.empty(t("r.empty.h"), t("r.empty.b"), '<a class="btn" href="' + url("home.html") + '">' + t("r.empty.btn") + "</a>"); return; }
    var h = ph(t("r.title"));
    h += '<div class="slip slip--flush trio" role="group" aria-label="' + t("r.sum.sr") + '">' +
      '<div><span class="k">' + t("r.week") + '</span><span class="fig">' + num(M.week.pts) + 'P</span><small>' + t("r.sum.hits", { a: M.week.hits, b: M.week.answered }) + "</small></div>" +
      '<div><span class="k">' + t("r.all") + '</span><span class="fig">' + num(M.all.pts) + 'P</span><small>' + t("r.sum.rate", { n: M.all.rate }) + "</small></div>" +
      '<div><span class="k">' + t("r.pending") + '</span><span class="fig"><span class="hl">+' + M.user.pendingHit + 'P</span></span><small>' + t("r.at", { time: "22:10" }) + "</small></div></div>";
    h += '<div class="between"><div class="seg" role="group" aria-label="' + t("r.filter") + '">' + [["all", "r.f.all"], ["wait", "r.f.wait"], ["set", "r.f.set"]].map(function (f, i) { return '<button type="button" data-f="' + f[0] + '" aria-pressed="' + (i === 0) + '">' + t(f[1]) + "</button>"; }).join("") + "</div>" +
      '<div class="legend" aria-label="' + t("r.legend") + '"><span><i class="punch hit">' + ic("check") + "</i>" + t("r.o.hit") + '</span><span><i class="punch miss">' + ic("x") + "</i>" + t("r.o.miss") + "</span></div></div>";
    h += '<div id="days" class="stack reveal"></div><button type="button" class="btn btn--line btn--block" id="more">' + t("r.more") + "</button>";
    main.innerHTML = h;
    var OUT = { hit: ["hit", "check", "r.o.hit", "+50P"], pend: ["pend", "check", "r.o.hit", "+50P"], corr: ["hit", "check", "r.o.corr", "+50P"], miss: ["miss", "x", "r.o.miss", ""], wait: ["wait", null, null, ""], void: ["void", "dash", "r.o.void", ""], none: ["void", "dash", "r.o.none", ""] };
    function days(f) {
      var out = "", i = 0;
      M.results.forEach(function (d) {
        var rows = d.rows.filter(function (r) { return f === "all" || (f === "wait" ? (r.out === "wait" || r.out === "pend") : !(r.out === "wait" || r.out === "pend" || r.out === "none")); });
        if (!rows.length) return;
        var label = d.day === 0 ? t("common.today") : d.day === 1 ? t("common.yesterday") : T.date(M.ago(d.day));
        out += '<section class="strip"><div class="seg4 day-h"><div><h2 class="hd-2">' + label + '</h2><span class="srow-s">' + (d.done ? t("r.g.done") : t("r.g.part", { k: d.answered })) + '</span></div><span class="hl">+' + d.total + "P</span></div>";
        rows.forEach(function (r) {
          var q = T.Q(r.q), o = OUT[r.out], choice = r.c ? (r.c === "l" ? q.left : q.right) : null, id = "x" + d.day + r.q;
          var lab = r.out === "wait" ? t("r.o.waitat", { time: r.exp }) : t(o[2]);
          out += '<div class="seg4"><button type="button" class="rrow" aria-expanded="false" aria-controls="' + id + '">' + T.pick(r.c) + '<span><span class="srow-t">' + esc(q.title) + '</span><span class="srow-s">' + (choice ? esc(t("r.you", { choice: choice })) : t("r.o.none")) + '</span></span>' +
            '<span class="rrow-out"><i class="punch ' + o[0] + '" style="--i:' + (i++) + '">' + (o[1] ? ic(o[1]) : "") + '</i><span>' + (r.out === "none" ? "" : lab) + (o[3] ? ' <span class="num">+50</span>P' : "") + "</span></span></button>" +
            '<div class="rdetail" id="' + id + '" hidden>' + detail(r, q) + "</div></div>";
        });
        var inv = M.invite.days[d.day];
        if (inv && f === "all") out += '<div class="seg4 row"><span><b style="font-size:var(--fs-13)">' + t("r.inv") + "</b><small>" + t("r.inv.sub", { r: M.invite.rate }) + '</small></span><span><span class="num">+' + inv.pts + "</span>P</span></div>";
        out += "</section>";
      });
      return out || '<p class="muted" style="text-align:center;padding:24px 0">' + t(f === "wait" ? "r.fe.wait" : "r.fe.set") + "</p>";
    }
    function detail(r, q) {
      var src = q.rule || (M.pastRules[r.q] || [])[T.I.langs.indexOf(T.lang)] || "";
      if (r.out === "wait") return "<span>" + t("r.o.ifhit") + "</span><span>" + t("h.ai.src") + ": <b>" + esc(src) + "</b></span>";
      if (r.out === "pend") return "<span><b>" + t("r.o.pend", { time: r.at }) + "</b></span><span>" + t("r.o.pend.help") + "</span>";
      if (r.out === "void") return "<span>" + t("r.o.void.line") + "</span>";
      if (r.out === "none") return "<span>" + t("h.ai.src") + ": <b>" + esc(src) + "</b></span>";
      var ans = (r.out === "miss") ? (r.c === "l" ? q.right : q.left) : (r.c === "l" ? q.left : q.right);
      return (r.out === "corr" ? "<span>" + t("r.o.corr.line", { date: T.date(M.ago(0)) }) + " <b>" + t("r.o.added") + "</b></span>" : "") + "<span>" + t("r.x.answer") + ": <b>" + esc(ans) + "</b></span><span>" + t("r.x.evidence") + ": " + t("p.evidence") + "</span><span>" + t("h.ai.src") + ": " + esc(src) + "</span>";
    }
    var box = document.getElementById("days"); box.innerHTML = days("all");
    main.addEventListener("click", function (e) {
      var f = e.target.closest("[data-f]"), r = e.target.closest(".rrow");
      if (f) { main.querySelectorAll("[data-f]").forEach(function (b) { b.setAttribute("aria-pressed", b === f); }); box.classList.remove("reveal"); box.innerHTML = days(f.dataset.f); }
      if (r) { var d = document.getElementById(r.getAttribute("aria-controls")), open = r.getAttribute("aria-expanded") === "true"; r.setAttribute("aria-expanded", !open); d.hidden = open; }
      if (e.target.id === "more") T.toast(t("common.loading"));
    });
  };

  /* ================= Ranking: the prize board ================= */
  S.ranking = function () {
    var none = st === "none", hold = st === "hold";
    var main = T.shell({ tab: "rank", cls: none ? "" : "has-pin" });
    if (st === "loading") { main.innerHTML = ph(t("k.title"), t("k.sub")) + loading(); return; }
    if (st === "error") { main.innerHTML = ph(t("k.title"), t("k.sub")) + T.errBox(); return; }
    var last = st === "last";
    var h = '<div class="between">' + ph(t("k.title"), t("k.sub")) + "</div>";
    h += '<div class="seg seg--block" role="group"><a href="' + url("ranking.html") + '"' + (!last ? ' aria-current="true"' : "") + ">" + t("r.week") + '</a><a href="' + url("ranking.html", "last") + '"' + (last ? ' aria-current="true"' : "") + ">" + t("k.lastweek") + "</a></div>";
    if (hold) h += T.holdNote("hold.rank");
    if (last) h += '<div class="note">' + ic("check") + "<div>" + t("k.sent") + " " + t("k.last", { rank: t("k.rankth", { n: 9 }), amount: "38.52" }) + "</div></div>";
    h += '<section class="tkt pool"><div class="tkt-a"><div class="between" style="align-items:flex-end"><div><div class="hd-3">' + (last ? t("k.final.h") : t("k.pool")) + '</div><div class="fig" style="margin-top:8px"><span id="pool-n">' + num(M.pool.ct) + "</span><small>CT</small></div></div>" +
      '<div style="text-align:right"><div class="hd-3">' + (last ? t("k.final.time") : t("k.ends")) + '</div><div class="fig" style="font-size:var(--fs-22);margin-top:6px">' + (last ? ic("check") : '<span data-cd="week"></span>') + '</div><div class="srow-s">' + (last ? "" : t("k.endat")) + "</div></div></div></div>" +
      '<div class="tkt-b" style="padding-top:6px;padding-bottom:6px">' + more(t("k.split.q"), "<p>" + t("k.pool.line", { n: num(M.pool.players) }) + "</p><p>" + t("k.split.note") + "</p><p>" + t("k.tie") + " " + t("k.tie.note") + '</p><p class="num" style="color:var(--ink)">' + M.pool.split.map(function (s, i) { return (i + 1) + ": " + s + "%"; }).join("  ") + "</p>") + "</div></section>";
    h += '<div class="sec-h"><h2 class="hd-2">' + t("k.top") + '</h2><span class="srow-s">' + (last ? "" : t("common.updated", { n: 7 })) + "</span></div>";
    h += '<ol class="board reveal" id="board">';
    M.ranking.forEach(function (r, i) {
      h += '<li class="place' + (r.rank <= 3 ? " place--top place--" + r.rank : "") + '" style="--i:' + i + '"><span class="place-n"><span class="sr">' + t("k.rank.sr", { n: r.rank }) + '</span><span aria-hidden="true">' + r.rank + '</span></span><span class="place-who"><b>' + esc(r.name) + '</b><span><span class="num">' + num(r.pts) + '</span>P</span></span><span class="place-prize"><span class="sr">' + t("k.col.prize") + ' </span><span class="num">' + num(r.prize, 2) + "</span> CT</span></li>";
    });
    h += "</ol>";
    if (!none) {
      h += '<div class="sec-h"><h2 class="hd-2">' + t("k.around") + '</h2><span class="srow-s">' + t("k.around.sub", { a: 25, b: 29 }) + '</span></div><ol class="board">';
      M.around.forEach(function (r) {
        var g = r.pts - M.me.pts;
        h += '<li class="place' + (r.me ? " place--me" : "") + '"><span class="place-n">' + r.rank + '</span><span class="place-who"><b>' + esc(r.name) + (r.me ? " (" + t("k.you") + ")" : "") + '</b><span><span class="num">' + num(r.pts) + '</span>P</span></span><span class="place-prize">' + (r.me ? "" : g > 0 ? t("k.gap.up", { n: g }) : g < 0 ? t("k.gap.down", { n: -g }) : t("k.gap.same")) + "</span></li>";
      });
      h += "</ol>";
    } else h += '<div class="note">' + ic("info") + "<div>" + t("k.none") + ' <a href="' + url("home.html") + '">' + t("k.play") + "</a></div></div>";
    main.innerHTML = h; T.tick();
    if (!none) document.querySelector(".app").insertAdjacentHTML("beforeend", '<div class="pin"><div class="place place--me"><span class="place-n"><span class="sr">' + t("k.rank.sr", { n: M.me.rank }) + '</span><span aria-hidden="true">' + M.me.rank + '</span></span><span class="place-who"><b>' + esc(M.user.name) + " (" + t("k.you") + ')</b><span><span class="num">' + num(M.me.pts) + '</span>P</span></span><span class="place-prize">' + (hold ? t("hold.rank.row") : t("k.gap", { gap: M.me.gap })) + "</span></div></div>");
    if (!T.reduce && !last) T.odo(document.getElementById("pool-n"), "1,000", num(M.pool.ct));
  };

  /* ================= Staking ================= */
  function stakeTabs(on) { return '<div class="seg seg--block" role="group" aria-label="' + t("s.switch") + '"><a href="' + url("staking.html") + '"' + (on === 0 ? ' aria-current="true"' : "") + ">" + t("s.new") + '</a><a href="' + url("stakes.html") + '"' + (on === 1 ? ' aria-current="true"' : "") + ">" + t("s.mine", { n: M.stakes.length }) + "</a></div>"; }
  S.staking = function () {
    var hold = st === "hold", zero = st === "zero", bal = zero ? 0 : M.user.ct;
    var main = T.shell({ tab: "stake", cls: "has-dock" });
    var h = ph(t("s.title"), t("s.sub")) + stakeTabs(0);
    if (hold) h += T.holdNote("hold.stake");
    if (zero) h += '<div class="note">' + ic("info") + "<div>" + t("s.zero") + ' <a href="' + url("wallet.html") + '">' + t("tab.wallet") + "</a></div></div>";
    h += '<div class="field"><label for="amt">' + t("s.amount") + "<span>" + t("s.avail") + " " + num(bal) + ' CT</span></label><div class="inp" id="amt-w"><input id="amt" inputmode="decimal" autocomplete="off" value="' + (zero ? "" : "500") + '" aria-describedby="amt-m"><span class="unit">CT</span><button type="button" class="mini-btn" id="max">' + t("s.max") + '</button></div><p class="field-msg" id="amt-m"></p></div>';
    h += '<div class="field"><span class="lbl" id="per-l">' + t("s.period") + '</span><div class="opts" role="group" aria-labelledby="per-l">' + [30, 90, 180, 365].map(function (d) { return '<button type="button" class="opt" data-d="' + d + '" aria-pressed="' + (d === 90) + '"><span>' + d + t("s.d") + '</span><small><span class="rate"></span>%</small></button>'; }).join("") + "</div></div>";
    h += '<section class="tkt"><div class="tkt-a cert-top"><div class="between"><span class="serial">' + t("s.apr") + '</span><span class="tag" id="c-rate"></span></div><div><div class="hd-3" id="c-il"></div><div class="fig cert-amt" style="margin-top:6px"><span id="c-int"></span><small>CT</small></div></div><div class="kv"><div><span class="k">' + t("s.unlock") + '</span><span class="v" id="c-date"></span></div><div><span class="k">' + t("s.value") + '</span><span class="v"><span id="c-val"></span> CT</span></div></div></div>' +
      '<div class="tkt-b"><div class="note" style="background:none;padding:0">' + ic("lock") + '<div id="c-rule"></div></div></div></section>';
    h += more(t("s.help.q"), "<p>" + t("s.help.a") + '</p><dl class="rows slip slip--flush" style="box-shadow:none;background:var(--stock)">' + [30, 90, 180, 365].map(function (d) { return row(t("s.days", { d: d }), '<span class="num">' + M.rates[d].join("% / ") + "%</span>"); }).join("") + "</dl><p>" + t("s.tier.1") + " / " + t("s.tier.2") + " / " + t("s.tier.3") + "</p>");
    main.innerHTML = h;
    document.querySelector(".app").insertAdjacentHTML("beforeend", '<div class="dock"><button type="button" class="btn btn--block" id="go"></button><span>' + (hold ? t("hold.fee.line") : t("s.fee")) + "</span></div>");
    var inp = document.getElementById("amt"), go = document.getElementById("go"), msg = document.getElementById("amt-m"), days = 90, cur = null;
    function calc() {
      var raw = inp.value.trim().replace(/,/g, ""), a = parseFloat(raw), tier = a >= 10000 ? 2 : a >= 1000 ? 1 : 0, rate = M.rates[days][isNaN(a) ? 0 : tier];
      main.querySelectorAll(".opt").forEach(function (o) { o.querySelector(".rate").textContent = M.rates[o.dataset.d][isNaN(a) ? 0 : tier]; });
      var err = null, btn = null;
      if (raw === "") btn = t("s.btn.empty"); else if (!/^\d*\.?\d*$/.test(raw) || isNaN(a)) { err = t("s.e.nan"); btn = t("s.btn.nan"); }
      else if ((raw.split(".")[1] || "").length > 4) { err = t("s.e.dec"); btn = t("s.btn.dec"); } else if (a < M.minStake) { err = t("s.e.min"); btn = t("s.btn.min"); } else if (a > bal) { err = t("s.e.bal", { b: num(bal) }); btn = t("s.btn.bal"); }
      var ok = !btn && !hold, v = ok || (!err && !isNaN(a)) ? a : 0, interest = v * rate / 100 * days / 365, dt = M.ahead(days);
      document.getElementById("amt-w").classList.toggle("is-err", !!err); msg.classList.toggle("is-err", !!err); msg.textContent = err || t("s.tier.cue" + tier);
      document.getElementById("c-rate").textContent = rate + "%"; document.getElementById("c-il").textContent = t("s.interest", { d: days });
      document.getElementById("c-int").textContent = num(interest, 4); document.getElementById("c-date").textContent = T.date(dt, true); document.getElementById("c-val").textContent = num(v + interest, 4);
      document.getElementById("c-rule").textContent = t("s.rules", { date: T.date(dt, true) });
      go.textContent = hold ? t("hold.stake.btn") : ok ? t("s.btn", { a: num(a) }) : btn; go.disabled = !ok; cur = { a: a, rate: rate, interest: interest, dt: dt };
    }
    function review() {
      var sh = T.sheet(t("s.rv.h", { a: num(cur.a), d: days }), '<dl class="rows">' + row(t("s.amount"), num(cur.a) + " CT") + row(t("s.apr"), cur.rate + "%") + row(t("s.interest", { d: days }), '<span class="hl">+' + num(cur.interest, 4) + " CT</span>") + row(t("s.unlock"), T.date(cur.dt, true)) + row(t("c.fee"), t("c.fee.v")) + '</dl><div class="note note--warn">' + ic("lock") + "<div>" + t("s.noexit", { date: T.date(cur.dt, true) }) + '</div></div><button type="button" class="btn btn--block" id="cf">' + t("tx.confirm") + '</button><button type="button" class="btn btn--text" data-close>' + t("common.cancel") + "</button>");
      sh.querySelector("#cf").addEventListener("click", function () {
        var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>' + t("tx.stake.h", { a: num(cur.a) });
        setTimeout(function () { sh.close(); T.toast(t("s.ok.h", { a: num(cur.a) })); setTimeout(function () { location.href = url("stakes.html"); }, 1200); }, 1400);
      });
    }
    inp.addEventListener("input", calc);
    main.addEventListener("click", function (e) { var o = e.target.closest(".opt"); if (o) { days = +o.dataset.d; main.querySelectorAll(".opt").forEach(function (x) { x.setAttribute("aria-pressed", x === o); }); calc(); } if (e.target.id === "max") { inp.value = bal; calc(); } });
    go.addEventListener("click", review); calc(); if (st === "review") review();
  };

  S.stakes = function () {
    var main = T.shell({ tab: "stake" }), hold = st === "hold";
    var h = ph(t("s.title"), t("s.sub")) + stakeTabs(1);
    if (st === "empty") { main.innerHTML = h + T.empty(t("m.empty.h"), t("m.empty.b"), '<a class="btn" href="' + url("staking.html") + '">' + t("m.empty.btn") + "</a>"); return; }
    if (hold) h += T.holdNote("hold.stakes");
    function calc(s) { var el = Math.min((Date.now() - s.start) / 86400000, s.days); return { day: Math.min(Math.floor(el) + 1, s.days), frac: el / s.days, int: s.amount * s.rate / 100 * el / 365, open: el >= s.days, end: new Date(+s.start + s.days * 86400000) }; }
    var total = 0; M.stakes.forEach(function (s) { total += s.amount; });
    h += '<div class="slip slip--flush trio" style="grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)"><div><span class="k">' + t("m.staked") + '</span><span class="fig">' + num(total) + '</span><small>CT</small></div><div><span class="k">' + t("m.sofar") + '</span><span class="fig" id="sum-i"></span><small>CT</small></div><div><span class="k">' + t("m.claimable") + '</span><span class="fig" id="sum-c"></span><small>CT</small></div></div><div class="stack reveal">';
    M.stakes.forEach(function (s, i) {
      var c = calc(s);
      h += '<section class="tkt"><div class="tkt-a cert-top"><div class="between"><span class="serial">' + t("tk.no") + ' <span class="num">' + T.pad(s.start.getMonth() + 1) + T.pad(s.start.getDate()) + "-" + s.days + '</span></span><span class="tag ' + (c.open ? "tag--mark" : "") + '">' + (c.open ? t("m.unlocked") : ic("lock").replace("<svg", '<svg width="13" height="13"') + t("m.locked")) + '</span></div>' +
        '<div class="between" style="align-items:flex-end"><div class="fig cert-amt">' + num(s.amount) + "<small>CT</small></div><div class=\"srow-s\">" + t("m.card.period", { d: s.days, r: s.rate }) + '</div></div>' +
        '<div class="stack-2"><div class="meter" role="img" aria-label="' + t("m.day", { x: c.day, d: s.days }) + '"><i style="transform:scaleX(' + c.frac.toFixed(3) + ')"></i></div><div class="between srow-s"><span>' + t("m.day", { x: c.day, d: s.days }) + "</span><span>" + t("m.unlocks", { date: T.date(c.end, true) }) + "</span></div></div></div>" +
        '<div class="tkt-b stack-2"><div class="between"><span class="hd-3">' + t("m.interest") + '</span><span><span class="num" data-int="' + i + '" style="font-size:var(--fs-15);font-weight:600"></span> CT</span></div>' +
        (c.open ? '<button type="button" class="btn btn--block" data-wd="' + i + '">' + t("m.withdraw", { a: num(s.amount + c.int, 4) }) + '</button><p class="srow-s" style="text-align:center">' + t("m.withint", { p: num(s.amount), i: num(c.int, 4) }) + "</p>"
          : (c.int >= M.minClaim ? '<button type="button" class="btn btn--line btn--block">' + t("m.claim", { i: num(c.int, 4) }) + "</button>" : '<p class="srow-s">' + t("m.claim.gap", { g: num(M.minClaim - c.int, 2) }) + "</p>")) + "</div></section>";
    });
    h += "</div>" + more(t("m.closed.q", { n: M.stakesClosed.length }), M.stakesClosed.map(function (s) { return '<div class="between"><span>' + num(s.amount) + " CT, " + t("m.card.period", { d: s.days, r: s.rate }) + '</span><span class="tag tag--quiet">' + t("m.paidout", { a: num(s.paid, 2) }) + "</span></div>"; }).join(""));
    main.innerHTML = h;
    function tick() { var sum = 0, cl = 0; M.stakes.forEach(function (s, i) { var c = calc(s); sum += c.int; if (c.open || c.int >= M.minClaim) cl += c.int; var e = main.querySelector('[data-int="' + i + '"]'); if (e) e.textContent = num(c.int, 4); }); document.getElementById("sum-i").textContent = num(sum, 2); document.getElementById("sum-c").textContent = num(cl, 2); }
    tick(); setInterval(tick, T.reduce ? 10000 : 1000);
    main.addEventListener("click", function (e) { var b = e.target.closest("[data-wd]"); if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span>' + t("m.chip.wd", { a: num(M.stakes[b.dataset.wd].amount) }); setTimeout(function () { T.toast(t("m.ok.wd", { a: num(M.stakes[b.dataset.wd].amount) })); b.textContent = t("m.closed"); }, 1400); } });
  };

  /* ================= Wallet ================= */
  S.wallet = function () {
    var main = T.shell({ tab: "wallet" }), U = M.user, hold = st === "hold", off = st === "offline";
    if (st === "loading") { main.innerHTML = ph(t("w.title"), t("w.sub")) + loading(); return; }
    if (st === "error") { main.innerHTML = ph(t("w.title"), t("w.sub")) + T.errBox(); return; }
    var can = Math.floor(U.points / 1000), part = (U.points % 1000) / 100;
    var h = ph(t("w.title"), t("w.sub"));
    if (hold) h += T.holdNote("hold.wallet");
    if (off) h += '<div class="note">' + ic("off") + "<div>" + t("w.offline") + "</div></div>";
    h += '<section class="tkt"><div class="tkt-a stack-2"><div class="between"><span class="hd-3">CT, ' + t("w.avail") + '</span><span class="srow-s">' + (off ? t("off.last", { time: "09:12" }) : t("common.updated", { n: 7 })) + '</span></div><div class="fig pass-fig">' + num(U.ct) + "<small>CT</small></div>" + (T.lang === "ko" ? '<div class="srow-s">' + t("common.krw", { krw: num(Math.round(U.ct * M.krwPerCt)) }) + "</div>" : "") +
      '<button type="button" class="chip-copy" id="cp" aria-label="' + t("w.copy") + '"><span class="addr">' + short(U.address) + "</span>" + ic("copy") + '</button></div><div class="tkt-b"><div class="btn-row"><button type="button" class="btn btn--line" id="dep"' + (off ? " disabled" : "") + ">" + ic("dep").replace("<svg", '<svg width="20" height="20"') + t("w.deposit") + '</button><button type="button" class="btn btn--line" id="wd"' + (off ? " disabled" : "") + ">" + ic("wd").replace("<svg", '<svg width="20" height="20"') + t("w.withdraw") + "</button></div></div></section>";
    h += '<div class="slip slip--flush rows"><a class="row row--link" href="' + url("stakes.html") + '"><span class="k">' + t("w.staked") + '</span><span class="between" style="gap:6px"><b>' + num(U.staked) + " CT</b>" + ic("chev") + '</span></a><div class="row"><span><span class="k">KAIA</span><small>' + t(hold ? "hold.kaia.note" : "w.kaia.note") + "</small></span><b>" + num(U.kaia) + "</b></div></div>";
    h += '<section class="tkt"><div class="tkt-a stack-2"><div class="between"><span class="hd-3">' + t("w.points") + '</span><span class="tag tag--quiet">' + ic("clock").replace("<svg", '<svg width="13" height="13"') + t("w.onway") + ' <span><span class="num">+' + U.pendingHit + '</span>P</span></span></div><div class="between" style="align-items:flex-end"><div class="fig pass-fig" style="font-size:var(--fs-36)">' + num(U.points) + "<small>P</small></div>" + T.holes(10, part, "holes--lg holes--mark") + '</div><p class="srow-s" style="font-size:var(--fs-13)">' + (can ? t("w.ready", { n: can }) : t("w.notyet", { g: 1000 - U.points })) + "</p></div>" +
      '<div class="tkt-b">' + (hold ? '<button class="btn btn--block" disabled>' + t("hold.convert.btn") + "</button>" : '<a class="btn btn--block" href="' + url("convert.html") + '"' + (off ? ' aria-disabled="true"' : "") + ">" + t("w.convert") + "</a>") + "</div></section>";
    h += '<div class="slip slip--flush rows"><a class="row row--link" href="' + url("invite.html") + '"><span><b>' + t("inv.entry") + "</b><small>" + t("w.invite") + ': <span class="num">+' + M.invite.week + "</span>P</small></span>" + ic("chev") + "</a></div>";
    h += more(t("w.info"), "<p>" + t("w.token") + '</p><p class="addr" style="color:var(--ink)">' + M.token + '</p><button type="button" class="btn btn--line" id="tcp">' + t("w.token.copy") + "</button>");
    main.innerHTML = h;
    function deposit() {
      T.sheet(t("dp.title"), "<p>" + t("dp.lead") + '</p><div class="slip" style="background:var(--stock-2);box-shadow:none"><div class="hd-3">' + t("w.addr") + '</div><p class="addr" style="font-size:var(--fs-15);margin-top:6px">' + grouped(U.address) + '</p></div><button type="button" class="btn btn--block" id="dcp">' + ic("copy").replace("<svg", '<svg width="20" height="20"') + t("w.copy") + '</button><dl class="rows">' + row(t("dp.net"), t("dp.net.v")) + row(t("dp.token"), t("dp.token.v")) + '</dl><ul class="list-dash"><li>' + t("dp.w1") + "</li><li>" + t("dp.w2") + "</li><li>" + t("dp.w3") + '</li></ul><p class="srow-s" role="status"><span class="spin" style="width:12px;height:12px;vertical-align:-1px;margin-right:6px"></span>' + t("dp.watch") + "</p>")
        .querySelector("#dcp").addEventListener("click", function () { T.copy(U.address, t("w.copied", { a: short(U.address) })); });
    }
    function withdraw() {
      var sh = T.sheet(t("x.title"), '<div class="note">' + ic("info") + "<div>" + t("x.gas") + '</div></div><div class="field"><label for="xto">' + t("x.to") + '</label><div class="inp inp--text"><input id="xto" autocomplete="off" spellcheck="false" placeholder="0x"><button type="button" class="mini-btn" id="xp">' + t("x.paste") + '</button></div><p class="field-msg" id="xm"></p></div><div class="field"><label for="xa">' + t("x.amount") + "<span>" + t("x.avail", { c: num(U.ct) }) + '</span></label><div class="inp"><input id="xa" inputmode="decimal" autocomplete="off"><span class="unit">CT</span><button type="button" class="mini-btn" id="xmax">' + t("s.max") + '</button></div></div><dl class="rows">' + row(t("x.kaia"), num(U.kaia) + " KAIA") + row(t("x.fee"), t("x.fee.v", { f: M.fee })) + row(t("dp.net"), t("dp.net.v")) + '</dl><button type="button" class="btn btn--block" id="xgo" disabled>' + t("x.btn.empty") + "</button>");
      var to = sh.querySelector("#xto"), a = sh.querySelector("#xa"), go = sh.querySelector("#xgo"), m = sh.querySelector("#xm");
      function upd() { var okA = /^0x[0-9a-fA-F]{40}$/.test(to.value.trim()), v = parseFloat(a.value); m.textContent = to.value ? (okA ? t("x.addr.ok") : t("x.e.bad")) : ""; m.classList.toggle("is-err", !!to.value && !okA); var ok = okA && v > 0 && v <= U.ct; go.disabled = !ok; go.textContent = ok ? t("x.btn", { a: num(v) }) : t("x.btn.empty"); }
      to.addEventListener("input", upd); a.addEventListener("input", upd);
      sh.querySelector("#xp").addEventListener("click", function () { to.value = "0x4f2a9C1e77d003bDe41A1e094b7F77aAc2D191bc"; upd(); });
      sh.querySelector("#xmax").addEventListener("click", function () { a.value = U.ct; upd(); });
      go.addEventListener("click", function () { go.disabled = true; go.innerHTML = '<span class="spin"></span>' + t("x.chip", { a: num(parseFloat(a.value)) }); setTimeout(function () { sh.close(); T.toast(t("x.ok", { a: num(parseFloat(a.value)) })); }, 1400); });
    }
    main.addEventListener("click", function (e) {
      if (e.target.closest("#cp")) T.copy(U.address, t("w.copied", { a: short(U.address) }));
      if (e.target.closest("#tcp")) T.copy(M.token, t("w.token.copied"));
      if (e.target.closest("#dep")) deposit(); if (e.target.closest("#wd")) withdraw();
    });
    if (st === "deposit") deposit(); if (st === "withdraw") withdraw();
  };

  /* ================= Convert ================= */
  S.convert = function () {
    var U = M.user, main = T.shell({ sub: t("c.title"), back: "wallet.html", cls: "has-dock" }), hold = st === "hold";
    var pts = st === "short" ? 650 : U.points, h = "";
    if (st === "ok") {
      main.innerHTML = '<section class="tkt"><div class="tkt-a stack" style="text-align:center;align-items:center;padding-top:28px"><span class="punch hit" style="width:44px;height:44px">' + ic("check").replace("<svg", '<svg style="width:26px;height:26px"') + '</span><h1 class="hd-1" style="font-size:var(--fs-22)">' + t("c.ok.h", { p: "1,000", n: 1 }) + '</h1></div><dl class="tkt-b rows" style="padding:0 0 4px">' + row(t("c.ok.left"), num(U.points - 1000) + "P") + row(t("c.ok.ct"), num(U.ct + 1) + " CT") + '</dl></section><a class="btn btn--block" href="' + url("wallet.html") + '">' + t("common.done") + "</a>";
      document.querySelector(".app").classList.remove("has-dock"); return;
    }
    if (hold) h += T.holdNote("hold.convert");
    if (st === "wait") h += '<div class="note note--warn">' + ic("clock") + "<div><b>" + t("c.wait.h", { date: T.date(U.firstConvert) }) + "</b><br>" + t("c.wait.b", { date: T.date(U.firstConvert) }) + " " + t("c.wait.left", { d: 3, h: 9 }) + "</div></div>";
    if (st === "short") h += '<div class="note">' + ic("info") + "<div><b>" + t("c.short.h") + "</b><br>" + t("c.short.b", { p: pts, g: 1000 - pts }) + "</div></div>";
    h += '<div class="field"><label for="pts-in">' + t("c.amount") + "<span>" + t("c.avail") + " " + num(pts) + 'P</span></label><div class="inp" id="pw"><input id="pts-in" inputmode="numeric" autocomplete="off" value="' + (pts >= 1000 ? "1000" : "") + '" aria-describedby="pm"><span class="unit">P</span><button type="button" class="mini-btn" id="pmax">' + t("s.max") + '</button></div><p class="field-msg" id="pm"></p></div>';
    h += '<section class="tkt"><div class="tkt-a"><div class="hd-3">' + t("c.get") + '</div><div class="between" style="align-items:flex-end;margin-top:8px"><div class="fig pass-fig"><span id="get">0</span><small>CT</small></div><span id="punch-row"></span></div></div><dl class="tkt-b rows" style="padding:0 0 4px">' + row(t("c.rate"), "1,000P = 1 CT") + row(t("c.minimum"), "1,000P") + row(t("c.capleft"), t("c.capof", { n: 50 })) + row(t("c.fee"), t("c.fee.v")) + "</dl></section>";
    h += '<p class="srow-s" style="font-size:var(--fs-13)">' + t("c.rank") + "</p>";
    main.innerHTML = h;
    document.querySelector(".app").insertAdjacentHTML("beforeend", '<div class="dock"><button type="button" class="btn btn--block" id="go"></button></div>');
    var inp = document.getElementById("pts-in"), go = document.getElementById("go"), m = document.getElementById("pm");
    function calc() {
      var raw = inp.value.replace(/,/g, "").trim(), v = parseInt(raw, 10), err = null, fix = Math.floor(v / 1000) * 1000;
      if (raw !== "") { if (isNaN(v) || v < 1000) err = t("c.e.min"); else if (v > pts) err = t("c.e.bal", { p: num(pts) }); else if (v % 1000) err = t("c.e.step", { f: num(fix) }); }
      var ok = raw !== "" && !err && st !== "wait" && !hold, n = err || raw === "" ? 0 : v / 1000;
      document.getElementById("pw").classList.toggle("is-err", !!err); m.classList.toggle("is-err", !!err); m.textContent = err || t("c.step");
      document.getElementById("get").textContent = n; document.getElementById("punch-row").innerHTML = T.holes(10, n ? 10 : (pts % 1000) / 100, "holes--lg holes--mark");
      go.disabled = !ok; go.textContent = hold ? t("hold.convert.btn") : ok ? t("c.btn", { p: num(v), n: n }) : t("c.btn.empty");
    }
    inp.addEventListener("input", calc); document.getElementById("pmax").addEventListener("click", function () { inp.value = Math.floor(pts / 1000) * 1000 || ""; calc(); });
    go.addEventListener("click", function () { go.disabled = true; go.innerHTML = '<span class="spin"></span>' + t("c.chip", { p: num(parseInt(inp.value, 10)) }); setTimeout(function () { location.href = url("convert.html", "ok"); }, 1400); });
    calc();
  };

  /* ================= Profile ================= */
  S.profile = function () {
    var U = M.user, main = T.shell({ sub: t("p.title"), back: "home.html" }), hold = st === "hold";
    var h = "";
    if (hold) h += '<a class="note note--warn" href="' + url("hold.html") + '" style="text-decoration:none">' + ic("warn") + "<div><b>" + t("hold.t") + ".</b> " + t("hold.profile.sub") + "</div></a>";
    h += '<section class="tkt"><div class="tkt-a between" style="justify-content:flex-start;gap:14px"><span class="avatar" aria-hidden="true">' + U.name[0].toUpperCase() + '</span><div><h1 class="hd-1" style="font-size:var(--fs-22)">' + esc(U.name) + '</h1><p class="srow-s">' + t("p.login", { email: U.email }) + '</p></div></div><div class="tkt-b trio" style="padding:4px 4px 6px"><div><span class="k">' + t("p.rank") + '</span><span class="fig">' + t("k.rankth", { n: M.me.rank }) + '</span></div><div><span class="k">' + t("r.week") + '</span><span class="fig">' + num(M.week.pts) + 'P</span></div><div><span class="k">' + t("p.pts") + '</span><span class="fig">' + num(U.points) + "P</span></div></div></section>";
    h += '<div class="slip slip--flush rows"><a class="row row--link" href="' + url("invite.html") + '"><span><b>' + t("inv.entry") + "</b><small>" + t("inv.entry.sub", { r: M.invite.rate }) + '</small></span><span class="between" style="gap:6px"><span class="tag tag--quiet">' + t("inv.entry.n", { n: M.invite.joined }) + "</span>" + ic("chev") + "</span></a></div>";
    h += '<h2 class="hd-2 sec-h">' + t("p.account") + '</h2><div class="slip slip--flush rows"><div class="row"><span><span class="k">' + t("p.wallet") + '</span><span class="addr" style="display:block">' + short(U.address) + '</span></span><button type="button" class="btn btn--text" id="cp">' + t("common.copy") + '</button></div><div class="row"><span><span class="k">' + t("p.device") + "</span><b style=\"display:block;font-size:var(--fs-13)\">" + t("p.device.ready") + '</b></span><span class="punch hit">' + ic("check") + "</span></div></div>";
    h += '<div class="field"><label for="nm">' + t("p.name") + '</label><div class="inp inp--text"><input id="nm" value="' + esc(U.name) + '" maxlength="20" autocomplete="off"><button type="button" class="mini-btn" id="sv">' + t("p.name.save.short") + '</button></div><p class="field-msg">' + t("p.name.help") + "</p></div>";
    h += '<h2 class="hd-2 sec-h">' + t("p.prefs") + '</h2><div class="slip slip--flush rows"><div class="row"><span class="k">' + t("lang.label") + "</span>" + T.langSwitch() + '</div><div class="row"><span class="k">' + t("p.view") + '</span><div class="seg" role="group"><button type="button" aria-pressed="true">' + t("h.view.card") + '</button><button type="button" aria-pressed="false">' + t("h.view.term") + "</button></div></div></div>";
    h += '<h2 class="hd-2 sec-h">' + t("p.help") + '</h2><div class="slip" style="padding:4px 16px">' + more(t("p.how"), "<p>" + t("o.1.b") + "</p><p>" + t("o.2.b") + "</p><p>" + t("o.3.b") + "</p>") + more(t("p.answers.q"), "<p>" + t("p.answers.a") + "</p>") + "</div>";
    h += '<div class="slip slip--flush rows"><a class="row row--link" href="https://cojam.app" rel="noopener"><b>' + t("p.swap") + "</b>" + ic("out") + '</a><a class="row row--link" href="https://cojam.app" rel="noopener"><b>' + t("p.site") + "</b>" + ic("out") + "</a></div>";
    h += '<div class="stack-2" style="align-items:center"><button type="button" class="btn btn--text btn--danger" id="lo">' + t("p.logout") + '</button><p class="fine">' + t("p.version", { v: M.version }) + "</p></div>";
    main.innerHTML = h;
    main.addEventListener("click", function (e) {
      if (e.target.closest("#cp")) T.copy(U.address, t("w.copied", { a: short(U.address) }));
      if (e.target.closest("#sv")) T.toast(t("p.name.saved"));
      var sb = e.target.closest(".seg button:not([data-lang])"); if (sb) sb.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === sb); });
      if (e.target.closest("#lo")) T.sheet(t("p.logout.h"), "<p>" + t("p.logout.b") + '</p><a class="btn btn--ink btn--block" href="' + url("login.html") + '">' + t("p.logout") + '</a><button type="button" class="btn btn--text" data-close>' + t("common.cancel") + "</button>");
    });
  };

  /* ================= Invite: a coupon with your code on the stub ================= */
  S.invite = function () {
    var V = M.invite, main = T.shell({ sub: t("inv.title"), back: "profile.html" }), hold = st === "hold", emp = st === "empty";
    var h = "";
    if (hold) h += T.holdNote("hold.invite");
    h += '<section class="tkt"><div class="tkt-a stack"><div class="between" style="align-items:flex-end"><div class="fig coupon-fig">' + V.rate + '%</div></div><h1 class="hd-2">' + t("inv.hero.line", { r: V.rate }) + '</h1><p class="srow-s" style="font-size:var(--fs-13)">' + t("inv.hero.sub") + '</p><div class="ex" role="img" aria-label="' + t("inv.ex.sr", { a: 350, b: 35 }) + '"><div><span class="k">' + t("inv.ex.friend") + '</span><span class="fig">+350P</span></div>' + ic("right") + '<div><span class="k">' + t("inv.ex.you") + '</span><span class="fig"><span class="hl">+35P</span></span></div></div></div>' +
      (hold ? "" : '<div class="tkt-b between"><div><div class="hd-3">' + t("inv.code.h") + '</div><div class="code-big" style="margin-top:4px">' + V.code + '</div></div><button type="button" class="btn btn--line" id="cc">' + ic("copy").replace("<svg", '<svg width="20" height="20"') + t("common.copy") + "</button></div>") + "</section>";
    if (!hold) h += '<div class="stack-2"><button type="button" class="btn btn--block" id="sh">' + ic("share").replace("<svg", '<svg width="20" height="20"') + t("inv.share") + '</button><button type="button" class="btn btn--line btn--block" id="cl">' + t("inv.copylink") + '</button><p class="fine">' + V.linkShort + "</p></div>";
    h += '<h2 class="hd-2 sec-h">' + t("inv.how.h") + '</h2><ol class="list-n"><li>' + t("inv.how.1") + "</li><li>" + t("inv.how.2", { w: V.welcome }) + "</li><li>" + t("inv.how.3", { r: V.rate }) + "</li></ol>";
    h += '<h2 class="hd-2 sec-h">' + t("inv.res.h") + "</h2>";
    if (emp) h += '<div class="note">' + ic("info") + "<div>" + t("inv.empty") + "</div></div>";
    else {
      h += '<div class="slip slip--flush trio"><div><span class="k">' + t("inv.res.joined") + '</span><span class="fig">' + V.joined + '</span></div><div><span class="k">' + t("inv.res.week") + '</span><span class="fig">+' + V.week + 'P</span></div><div><span class="k">' + t("inv.res.total") + '</span><span class="fig">+' + num(V.total) + "P</span></div></div>";
      if (hold) h += '<p class="srow-s">' + t("hold.invite.bonus") + "</p>";
      h += '<h2 class="hd-3">' + t("inv.friends.h") + '</h2><div class="slip slip--flush rows">' + V.friends.map(function (f) { return '<div class="row"><span><b>' + esc(f.name) + "</b><small>" + t("inv.st." + f.st) + '</small></span><span><span class="num">' + (f.pts ? "+" + num(Math.round(f.pts * V.rate / 100)) : "0") + "</span>P</span></div>"; }).join("") + "</div>";
    }
    h += '<h2 class="hd-2 sec-h">' + t("inv.rules.h") + '</h2><ul class="list-dash"><li>' + t("inv.rule.1") + "</li><li>" + t("inv.rule.2") + "</li><li>" + t("inv.rule.3") + "</li><li>" + t("inv.rule.4") + "</li></ul>";
    main.innerHTML = h;
    main.addEventListener("click", function (e) { if (e.target.closest("#cc")) T.copy(V.code); if (e.target.closest("#cl")) T.copy(V.link, t("inv.linkcopied")); if (e.target.closest("#sh")) { T.copy(V.link, t("inv.shared")); } });
  };

  /* ================= Account on hold ================= */
  S.hold = function () {
    var main = T.shell({ sub: t("hold.t"), back: "home.html" });
    function li(ok, key) { return '<div class="row" style="justify-content:flex-start;align-items:flex-start"><span class="punch ' + (ok ? "hit" : "miss") + '" style="flex:none">' + ic(ok ? "check" : "x") + '</span><span style="font-size:var(--fs-13);line-height:1.45">' + t(key) + "</span></div>"; }
    main.innerHTML = '<section class="tkt"><div class="tkt-a stack" style="padding-top:24px"><div><span class="void-stamp">' + t("hold.tag") + '</span></div><h1 class="hd-1">' + t("hold.home.h") + "</h1><p>" + t("hold.home.b") + '</p></div><div class="tkt-b"><span class="serial">' + t("p.wallet") + ' <span class="num">' + short(M.user.address) + "</span></span></div></section>" +
      '<h2 class="hd-2 sec-h">' + t("hold.more") + '</h2><div class="slip slip--flush rows">' + li(true, "hold.stakes") + li(false, "hold.convert") + li(false, "hold.stake") + li(false, "hold.rank") + li(false, "hold.invite") + '</div><a class="btn btn--line btn--block" href="' + url("wallet.html", "hold") + '">' + t("tab.wallet") + "</a>";
  };

  /* ================= Login ================= */
  S.login = function () {
    var main = T.shell({ bare: true });
    document.querySelector(".app").insertAdjacentHTML("afterbegin", '<div class="gatebar"><span class="hd-brand">' + T.mark(28) + "<span>Cojam</span></span>" + T.langSwitch() + "</div>");
    var email = "minji@naver.com";
    function view(v, err) {
      var h = "";
      if (v === "email") {
        h += '<section class="tkt"><div class="tkt-a stack"><span class="serial">' + t("tk.no") + ' <span class="num">' + T.serialDay() + '</span></span><h1 class="hd-1">' + t("a.h1") + "</h1><p class=\"muted\">" + t("a.lede") + '</p></div><form class="tkt-b stack" id="f" novalidate><div class="field"><label for="em">' + t("a.email.label") + '</label><div class="inp inp--text' + (err ? " is-err" : "") + '"><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="' + (err ? "minji@" : "") + '" aria-describedby="emm"></div><p class="field-msg' + (err ? " is-err" : "") + '" id="emm">' + (err ? t("a.email.bad") : t("a.email.cap", { list: "Gmail, Naver, Kakao, Daum, iCloud, Outlook, Yahoo! JAPAN" })) + '</p></div><button class="btn btn--block" type="submit">' + t("a.email.btn") + "</button></form></section>";
        h += '<ul class="facts">' + [["clock", "a.fact.1"], ["gift", "a.fact.2"], ["wallet", "a.fact.3"]].map(function (f) { return "<li>" + ic(f[0]) + "<span>" + t(f[1]) + "</span></li>"; }).join("") + "</ul>";
        h += '<div class="slip" style="padding:4px 16px">' + more(t("a.help.q"), "<p>" + t("a.help.a") + "</p>") + "</div>";
        h += '<p class="fine">' + t("a.fine", { terms: '<a href="#">' + t("a.terms") + "</a>", privacy: '<a href="#">' + t("a.privacy") + "</a>" }) + "</p>";
      } else if (v === "code") {
        h += '<section class="tkt"><div class="tkt-a stack"><span class="serial">' + t("tk.no") + ' <span class="num">' + T.serialDay() + '</span></span><h1 class="hd-1">' + t("a.code.h1") + '</h1><p class="muted">' + t("a.code.h") + ". " + t("a.code.body", { email: "<b>" + email + "</b>" }) + '</p></div><form class="tkt-b stack" id="f" novalidate><div class="field"><label for="cd">' + t("a.code.label") + '</label><div class="inp code-inp' + (err ? " is-err" : "") + '"><input id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="' + (err ? "482913" : "") + '" aria-describedby="cdm"></div><p class="field-msg' + (err ? " is-err" : "") + '" id="cdm">' + (err ? t("a.code.wrong") : t("a.code.tip")) + '</p></div><button class="btn btn--block" type="submit">' + t("a.code.btn") + '</button></form></section><div class="stack-2" style="align-items:center"><p class="fine">' + t("a.code.resendin", { s: 42 }) + '</p><button type="button" class="btn btn--text" id="chg">' + t("a.code.change") + "</button></div>";
      } else {
        h += '<section class="tkt"><div class="tkt-a stack"><h1 class="hd-1">' + t("a.setup.h1") + '</h1><p class="muted">' + t("a.setup.h") + ". " + t("a.setup.body") + '</p></div><div class="tkt-b"><ol class="setup" id="su">' + ["a.setup.s1", "a.setup.s2", "a.setup.s3"].map(function (k, i) { return '<li><span class="punch ' + (i === 0 ? "hit" : "wait") + '">' + (i === 0 ? ic("check") : "") + "</span><span>" + t(k) + '</span><span class="st">' + t(i === 0 ? "tx.st.done" : i === 1 ? "tx.st.now" : "tx.st.wait") + "</span></li>"; }).join("") + "</ol></div></section>";
      }
      main.innerHTML = h;
      var f = document.getElementById("f");
      if (f) f.addEventListener("submit", function (e) { e.preventDefault(); if (v === "email") { var val = document.getElementById("em").value.trim(); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(val)) { view("email", true); return; } email = val; view("code"); } else { view("setup"); setTimeout(function () { location.href = url("first-run.html"); }, 2200); } });
      var c = document.getElementById("chg"); if (c) c.addEventListener("click", function () { view("email"); });
    }
    view(st === "code" || st === "code-error" ? "code" : st === "setup" ? "setup" : "email", st === "error" || st === "code-error");
  };

  /* ================= First run: three tickets ================= */
  S["first-run"] = function () {
    var main = T.shell({ bare: true }), step = +st || 1;
    document.querySelector(".app").insertAdjacentHTML("afterbegin", '<div class="gatebar"><span class="hd-brand">' + T.mark(28) + "<span>Cojam</span></span>" + T.langSwitch() + "</div>");
    var q = T.Q("q1");
    var ARTS = [
      '<div class="tkt" style="width:230px;transform:rotate(-3deg)"><div class="tkt-a stack-2" style="padding:12px 14px 16px"><div class="between"><span class="serial">' + t("tk.no") + ' <span class="num">' + T.serialDay() + "-1</span></span>" + T.holes(5, 0, "", 0) + '</div><div class="card-art" style="height:74px;flex:none">' + T.art("q1") + '</div><b style="font-stretch:88%;line-height:1.2">' + esc(q.title) + '</b></div><div class="card-stub"><div class="tkt-b" style="height:52px"><span class="ans ans--l" style="font-size:var(--fs-15)">' + ic("left") + esc(q.left) + '</span><span class="ans ans--r" style="font-size:var(--fs-15)">' + esc(q.right) + ic("right") + "</span></div></div></div>",
      '<div style="width:250px;position:relative"><div class="strip">' + ["r", "l", "r", "r", "r"].map(function (s, i) { return '<div class="seg4 between" style="padding:7px 14px;min-height:34px">' + T.pick(s).replace('class="pick', 'style="height:22px" class="pick') + '<span class="num muted">' + T.serialDay() + "-" + (i + 1) + '</span><span class="punch ' + (i === 1 ? "hit" : "wait") + '" style="width:20px;height:20px">' + (i === 1 ? ic("check") : "") + "</span></div>"; }).join("") + '</div><div class="stamp" style="font-size:2rem;right:-18px;bottom:-14px">+100P<small>' + t("o.2.a") + '</small></div><span class="hl" style="position:absolute;right:-22px;top:28px;transform:rotate(5deg)">+50P ' + t("o.2.c") + "</span></div>",
      '<div class="tkt" style="width:250px;transform:rotate(2deg)"><div class="tkt-a stack-2" style="padding:14px"><span class="hd-3">' + t("w.points") + '</span><div class="between" style="align-items:flex-end"><span class="fig" style="font-size:var(--fs-28)">1,000P</span>' + T.holes(10, 10, "holes--mark") + '</div></div><div class="tkt-b between" style="padding:14px"><span class="hd-3">' + t("c.get") + '</span><span class="fig" style="font-size:var(--fs-28)">1 CT</span></div></div>'
    ];
    function view() {
      var h = '<div class="between"><span class="hd-3" aria-live="polite">' + t("o.step", { n: step }) + '</span><a class="btn btn--text" href="' + url("home.html", "fresh") + '">' + t("o.skip") + "</a></div>";
      h += '<div class="ob-art" aria-hidden="true">' + ARTS[step - 1] + "</div>";
      h += '<div class="stack-2"><h1 class="hd-1">' + t("o." + step + ".h") + '</h1><p class="muted" style="font-size:var(--fs-16)">' + t("o." + step + ".b") + "</p></div>";
      if (step === 1) h += '<div class="slip" style="padding:4px 16px">' + more(t("o.code.q") + ' <span class="muted" style="font-weight:400">' + t("o.code.opt") + "</span>", '<div class="field"><div class="inp inp--text"><input id="ic" aria-label="' + t("p.code.label") + '" placeholder="' + t("o.code.ph") + '" maxlength="8" autocapitalize="characters" autocomplete="off"><button type="button" class="mini-btn" id="ia">' + t("o.code.apply") + '</button></div><p class="field-msg" id="im">' + t("o.code.help") + "</p></div>", st === "code") + "</div>";
      h += '<div style="margin-top:auto" class="stack"><div class="ob-dots">' + T.holes(3, step, "holes--lg") + '</div><button type="button" class="btn btn--block" id="nx">' + (step === 3 ? t("o.start") : t("o.next")) + "</button></div>";
      main.classList.remove("enter"); void main.offsetWidth; main.classList.add("enter"); main.innerHTML = h;
      document.getElementById("nx").addEventListener("click", function () { if (step === 3) location.href = url("home.html", "fresh"); else { step++; view(); } });
      var ia = document.getElementById("ia"); if (ia) ia.addEventListener("click", function () { var v = document.getElementById("ic").value.trim().toUpperCase(), m = document.getElementById("im"), k = M.invite.known[v]; m.classList.toggle("is-err", !k); m.textContent = v.length < 6 ? t("o.code.short") : v === M.invite.self ? t("o.code.own") : k ? t("o.code.ok", { name: k, w: M.invite.welcome }) : t("o.code.unknown"); });
    }
    main.style.flex = "1"; view();
  };

  /* ================= Hub ================= */
  S.index = function () {
    var main = T.shell({ bare: true });
    document.querySelector(".app").insertAdjacentHTML("afterbegin", '<div class="gatebar"><span class="hd-brand">' + T.mark(28) + "<span>Cojam</span></span>" + T.langSwitch() + "</div>");
    var L = [["login.html", "a.h1", ["code", "code-error", "setup", "error"]], ["first-run.html", "o.1.h", ["2", "3", "code"]], ["home.html", "h.title", ["fresh", "last", "loading", "empty", "error", "offline", "hold"]], ["home-list.html", "h.view.term", ["fresh", "last", "offline"]], ["done.html", "d.h1", ["play", "saving"]],
      ["results.html", "r.title", ["empty", "loading", "error"]], ["ranking.html", "k.title", ["last", "none", "hold", "loading", "error"]], ["staking.html", "s.new", ["review", "zero", "hold"]], ["stakes.html", "s.tab.mine", ["empty", "hold"]],
      ["wallet.html", "w.title", ["deposit", "withdraw", "offline", "loading", "error", "hold"]], ["convert.html", "c.title", ["wait", "short", "ok", "hold"]], ["profile.html", "p.title", ["hold"]], ["invite.html", "inv.title", ["empty", "hold"]], ["hold.html", "hold.t", []]];
    var h = '<section class="tkt"><div class="tkt-a stack-2"><span class="serial">' + t("tk.no") + ' <span class="num">' + T.serialDay() + '</span></span><h1 class="hd-1">' + t("tk.hub.h") + '</h1><p class="muted">' + t("tk.hub.b") + '</p></div><div class="tkt-b between"><span class="srow-s">CONCEPT.md, MOTION.md, REVIEW.md</span>' + T.holes(5, 3, "", 3) + '</div></section><div class="slip hub-grid rows" style="padding:4px 16px">';
    L.forEach(function (p, i) { h += '<div class="hub-item" style="padding:6px 0 10px"><a href="' + url(p[0]) + '"><span><span class="num muted" style="margin-right:8px">' + T.pad(i + 1) + "</span>" + t(p[1]) + "</span>" + ic("chev") + "</a>" + (p[2].length ? '<div class="hub-states">' + p[2].map(function (s) { return '<a href="' + url(p[0], s) + '">' + s + "</a>"; }).join("") + "</div>" : "") + "</div>"; });
    main.innerHTML = h + "</div>";
  };
})();
