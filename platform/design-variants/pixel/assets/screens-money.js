/* Pixel concept: the money and account screens (staking, my stakes, wallet, convert, profile, invite).
   Same grid and palette as the play screens, but quieter: sentences in Pretendard, one figure per block, no sprites that move. */
(function () {
  "use strict";
  var PX = window.PX, t = PX.t, M = PX.M, A = PX.A, $ = PX.$, $$ = PX.$$, num = PX.num, esc = PX.esc, icon = PX.icon, btn = PX.btn, href = PX.href, row = PX.row;
  var S = PX.screens, st = PX.state, U = M.user, DAY = 86400000;
  function tier(a) { return a >= 10000 ? 2 : a >= 1000 ? 1 : 0; }
  function interest(a, r, d) { return a * r / 100 * d / 365; }
  function addrChip(a, msg) { return '<button type="button" class="addr" data-copy="' + a + '" data-msg="' + esc(msg || t("common.copied")) + '" aria-label="' + esc(t("w.copy")) + '"><span class="addr-t">' + PX.shortAddr(a) + "</span>" + icon("copy") + "</button>"; }
  document.addEventListener("click", function (e) { var c = e.target.closest("[data-copy]"); if (c) PX.copy(c.getAttribute("data-copy"), c.getAttribute("data-msg")); });
  function stakeTabs(i) { return PX.seg([{ label: t("s.new"), href: href("staking.html") }, { label: t("s.tab.mine"), count: M.stakes.length, href: href("stakes.html") }], i, { label: t("s.switch"), cls: "seg-tabs" }); }
  function inviteRow() { return '<a class="nav-row" href="' + href("invite.html") + '">' + A.svg("coin", 2) + '<span class="nav-b"><b class="t15">' + t("inv.entry") + '</b><span class="cap">' + t("inv.entry.sub", { r: M.invite.rate }) + "</span></span>" + icon("chev") + "</a>"; }

  /* =================== STAKING: new stake =================== */
  S.staking = function () {
    var onHold = st === "hold", zero = st === "zero", bal = zero ? 0 : U.ct, amount = st === "error" ? 2500 : zero ? "" : 500, days = 90;
    var band = '<h1 class="t24 b">' + t("s.title") + '</h1><p class="band-sub">' + t("s.sub") + "</p>";
    var body = stakeTabs(0) + (onHold ? PX.hold(t("hold.stake")) : "") + (zero ? PX.note("info", t("s.zero")) : "") +
      '<div class="lbl-row"><label class="lbl" for="amt">' + t("s.amount") + '</label><span class="cap">' + t("s.avail") + " <b>" + num(bal) + ' CT</b></span></div>' +
      '<div class="field field-row" id="amt-f"><input id="amt" inputmode="decimal" autocomplete="off" value="' + amount + '" placeholder="0" aria-describedby="amt-m"><span class="field-unit t15">CT</span><button type="button" class="field-act" id="max">' + t("s.max") + '</button></div><p class="field-msg" id="amt-m"></p>' +
      '<fieldset class="opts"><legend class="lbl">' + t("s.period") + '</legend><div class="opt-grid">' + [30, 90, 180, 365].map(function (d) { return '<button type="button" class="opt" data-d="' + d + '" aria-pressed="' + (d === days) + '"><b class="t24 b">' + d + '</b><span class="t12 b">' + t("s.d") + '</span><i class="opt-r t15" data-r></i></button>'; }).join("") + "</div></fieldset>" +
      '<section class="quote"><div class="fig"><span class="fig-l" id="q-l"></span><span class="fig-v"><b id="q-i">0</b><i>CT</i></span></div>' + row(t("s.apr"), '<b id="q-r"></b>') + row(t("s.unlock"), '<b id="q-u"></b>') + '<p class="cap noexit" id="q-n"></p></section>' +
      PX.disc(t("s.help.q"), "<p>" + t("s.help.a") + '</p><table class="split"><thead><tr><th scope="col">' + t("s.th.lock") + '</th><th scope="col">' + t("s.th.1") + '</th><th scope="col">' + t("s.th.2") + '</th><th scope="col">' + t("s.th.3") + "</th></tr></thead><tbody>" + [30, 90, 180, 365].map(function (d) { return "<tr><td>" + t("s.days", { d: d }) + "</td>" + M.rates[d].map(function (r) { return "<td>" + r + "%</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>");
    var foot = btn("", { id: "go" }) + '<p class="cap cap-c" id="go-n">' + t(onHold ? "hold.fee.line" : "s.fee") + "</p>";
    PX.shell({ tab: "stake", band: band, body: body, foot: foot, title: t("s.title"), cls: "is-money" });

    var inp = $("#amt"), go = $("#go");
    function calc() {
      var raw = inp.value.trim(), a = Number(raw.replace(/,/g, "")), err = "", label = "", fix = null;
      if (raw === "") label = t("s.btn.empty");
      else if (isNaN(a)) { err = t("s.e.nan"); label = t("s.btn.nan"); }
      else if (a < M.minStake) { err = t("s.e.min"); label = t("s.btn.min"); fix = [t("s.fix.min"), 100]; }
      else if (a > bal) { err = t("s.e.bal", { b: num(bal) }); label = t("s.btn.bal"); fix = [t("s.fix.bal", { b: num(bal) }), bal]; }
      var ok = !err && raw !== "" && !onHold, ti = tier(isNaN(a) ? 0 : a), r = M.rates[days][ti], unlock = new Date(Date.now() + days * DAY);
      $$(".opt").forEach(function (o) { var d = +o.getAttribute("data-d"); o.setAttribute("aria-pressed", d === days); $("[data-r]", o).textContent = M.rates[d][ti] + "%"; });
      $("#q-l").textContent = t("s.interest", { d: days }); $("#q-i").textContent = num(ok || (!err && raw !== "") ? interest(a, r, days) : 0, 2);
      $("#q-r").textContent = r + "%"; $("#q-u").textContent = PX.date(unlock); $("#q-n").textContent = t("s.noexit", { date: PX.date(unlock) });
      var m = $("#amt-m"); $("#amt-f").classList.toggle("is-bad", !!err); inp.setAttribute("aria-invalid", !!err);
      m.className = "field-msg" + (err ? " is-bad" : "");
      m.innerHTML = err ? icon("warn") + "<span>" + err + "</span>" + (fix ? '<button type="button" class="lnk" id="fix">' + fix[0] + "</button>" : "") : "<span>" + t("s.tier.cue" + ti) + "</span>";
      if (fix) $("#fix").addEventListener("click", function () { inp.value = fix[1]; calc(); });
      $(".btn-l", go).textContent = onHold ? t("hold.stake.btn") : ok ? t("s.btn", { a: num(a) }) : label;
      go.setAttribute("aria-disabled", !ok);
      go._v = { a: a, r: r, unlock: unlock, i: interest(a, r, days) };
    }
    inp.addEventListener("input", calc);
    $("#max").addEventListener("click", function () { inp.value = bal; calc(); });
    $$(".opt").forEach(function (o) { o.addEventListener("click", function () { days = +o.getAttribute("data-d"); calc(); }); });
    function review() {
      var v = go._v;
      PX.sheet({ title: t("s.rv.h", { a: num(v.a), d: days }),
        body: row(t("s.amount"), "<b>" + num(v.a) + " CT</b>") + row(t("s.period"), "<b>" + t("s.days", { d: days }) + "</b>") + row(t("s.apr"), "<b>" + v.r + "%</b>") + row(t("s.interest", { d: days }), "<b>" + num(v.i, 2) + " CT</b>") + row(t("s.unlock"), "<b>" + PX.date(v.unlock) + "</b>") + PX.note("warn", t("s.noexit", { date: PX.date(v.unlock) })) + '<p class="cap">' + t("s.fee") + "</p>",
        foot: btn(t("tx.confirm"), { id: "cf" }) + btn(t("common.cancel"), { kind: "text", attrs: "data-close" }),
        ready: function (w) { $("#cf", w).addEventListener("click", function () { PX.closeSheet(); PX.toast(t("s.ok.h", { a: num(v.a) }), t("s.ok.btn"), function () { location.href = href("stakes.html"); }); }); } });
    }
    go.addEventListener("click", function () { if (go.getAttribute("aria-disabled") === "true") return; review(); });
    calc();
    if (st === "review") review();
  };

  /* =================== MY STAKES =================== */
  S.stakes = function () {
    var onHold = st === "hold", list = st === "empty" ? [] : M.stakes, now = Date.now();
    var band = '<h1 class="t24 b">' + t("s.title") + '</h1><p class="band-sub">' + t("s.sub") + "</p>";
    function calc(s) { var el = Math.min(s.days, (now - s.start.getTime()) / DAY); return { day: Math.min(s.days, Math.floor(el) + 1), i: interest(s.amount, s.rate, el), open: el >= s.days, end: new Date(s.start.getTime() + s.days * DAY), per: s.amount * s.rate / 100 / 365 / 86400 }; }
    var body;
    if (st === "loading") body = stakeTabs(1) + PX.skeleton(7);
    else if (!list.length) body = stakeTabs(1) + PX.empty({ sprite: A.svg("lock", 8), h: t("m.empty.h"), b: t("m.empty.b"), btn: btn(t("m.empty.btn"), { href: href("staking.html"), block: false }) });
    else {
      var tot = 0, claim = 0; list.forEach(function (s) { var c = calc(s); tot += c.i; if (c.open || c.i >= M.minClaim) claim += c.i; });
      body = stakeTabs(1) + (onHold ? PX.hold(t("hold.stakes")) : "") +
        '<section class="totals">' + PX.fig(t("m.staked"), num(U.staked), "CT") + '<div class="duo">' + PX.fig(t("m.sofar"), '<span data-int="' + tot + '" data-per="' + list.reduce(function (a, s) { return a + (calc(s).open ? 0 : calc(s).per); }, 0) + '">' + num(tot, 4) + "</span>", "CT") + PX.fig(t("m.claimable"), num(claim, 4), "CT") + "</div></section>" +
        list.map(function (s) {
          var c = calc(s), N = 15, fill = Math.round(Math.min(1, c.day / s.days) * N), bar = "";
          for (var i = 0; i < N; i++) bar += '<i class="' + (i < fill ? "is-on" : "") + '"></i>';
          return '<section class="stake"><div class="stake-hd"><div><h2 class="t24 b">' + num(s.amount) + ' CT</h2><p class="cap">' + t("m.card.period", { d: s.days, r: s.rate }) + "</p></div>" + PX.chip(t(c.open ? "m.unlocked" : "m.locked"), c.open ? "ok" : "lock") + "</div>" +
            '<div class="prog" role="img" aria-label="' + esc(t("m.day", { x: c.day, d: s.days })) + '">' + bar + '</div><div class="prog-l cap"><span>' + t("m.started", { date: PX.date(s.start) }) + "</span><b>" + t("m.day", { x: c.day, d: s.days }) + "</b><span>" + t("m.unlocks", { date: PX.date(c.end) }) + "</span></div>" +
            row(t("m.interest"), '<b class="t15"><span' + (c.open ? "" : ' data-int="' + c.i + '" data-per="' + c.per + '"') + ">" + num(c.i, 4) + "</span> CT</b>") +
            (c.open ? btn(t("m.withdraw", { a: num(s.amount + c.i, 4) }), { cls: "act", attrs: 'data-msg="' + esc(t("m.ok.wd", { a: num(s.amount + c.i, 4) })) + '"' }) + '<p class="cap cap-c">' + t("m.withint", { p: num(s.amount), i: num(c.i, 4) }) + "</p>"
              : c.i >= M.minClaim ? btn(t("m.claim", { i: num(c.i, 4) }), { kind: "second", cls: "act", attrs: 'data-msg="' + esc(t("m.ok.claim", { i: num(c.i, 4) })) + '"' })
              : '<p class="cap why">' + icon("info") + "<span>" + t("m.claim.gap", { g: num(M.minClaim - c.i, 2) }) + "</span></p>") +
            (onHold && c.open ? '<p class="cap cap-c">' + t("hold.fee.line") + "</p>" : "") + "</section>";
        }).join("") +
        PX.disc(t("m.closed.q", { n: M.stakesClosed.length }), M.stakesClosed.map(function (s) { return '<div class="closed">' + row(num(s.amount) + " CT, " + t("m.card.period", { d: s.days, r: s.rate }), "<b>" + t("m.paidout", { a: num(s.paid) }) + "</b>") + "</div>"; }).join(""));
    }
    PX.shell({ tab: "stake", band: band, body: body, title: t("s.tab.mine"), cls: "is-money" });
    $$(".act").forEach(function (b) { b.addEventListener("click", function () { PX.toast(b.getAttribute("data-msg")); }); });
    setInterval(function () { $$("[data-int]").forEach(function (el) { var v = +el.getAttribute("data-int") + +el.getAttribute("data-per") * (PX.reduce ? 10 : 1); el.setAttribute("data-int", v); el.textContent = num(v, 4); }); }, PX.reduce ? 10000 : 1000);
  };

  /* =================== WALLET =================== */
  S.wallet = function () {
    var onHold = st === "hold", err = st === "error", canCt = Math.floor(U.points / 1000);
    var krw = PX.lang === "ko" ? '<span class="fig-s">' + t("common.krw", { krw: num(Math.round(U.ct * M.krwPerCt)) }) + "</span>" : "";
    var band = '<h1 class="t24 b">' + t("w.title") + '</h1><div class="fig fig-hero"><span class="fig-l">' + t("w.avail") + '</span><span class="fig-v"><b>' + (st === "loading" ? '<i class="skel-fig"></i>' : num(U.ct)) + "</b><i>CT</i></span>" + krw + '</div><div class="band-row band-addr">' + addrChip(U.address, t("w.copied", { a: PX.shortAddr(U.address) })) + '<span class="live cap">' + (err ? t("hd.points.stale") : '<i class="live-dot"></i><span data-up="7">' + t("common.updated", { n: 7 }) + "</span>") + "</span></div>";
    var body;
    if (st === "loading") body = PX.skeleton(8);
    else body = (err ? PX.note("error", t("e.rpc"), btn(t("common.retry"), { kind: "second", href: href("wallet.html"), block: false })) : "") + (onHold ? PX.hold(t("hold.wallet")) : "") +
      '<div class="pair">' + btn(t("w.deposit"), { kind: "second", id: "dep", icon: "plus" }) + btn(t("w.withdraw"), { kind: "second", id: "wd", icon: "share" }) + "</div>" +
      '<div class="list"><a class="nav-row" href="' + href("stakes.html") + '">' + A.svg("lock", 2) + '<span class="nav-b"><b class="t15">' + t("w.staked") + '</b><span class="cap">' + t("s.tab.mine") + " " + M.stakes.length + '</span></span><b class="t15">' + num(U.staked) + " CT</b>" + icon("chev") + "</a>" +
      '<div class="nav-row is-static"><span class="tok t12 b" aria-hidden="true">K</span><span class="nav-b"><b class="t15">KAIA</b><span class="cap">' + t(onHold ? "hold.kaia.note" : "w.kaia.note") + '</span></span><b class="t15">' + num(U.kaia) + "</b></div></div>" +
      '<section class="points"><div class="points-hd"><div class="fig"><span class="fig-l">' + t("w.points") + '</span><span class="fig-v">' + A.svg("coin", 4) + "<b>" + num(U.points) + '</b><i>P</i></span></div></div>' +
      '<p class="points-rate">' + t("w.ready", { n: canCt }) + '</p><p class="onway">' + PX.chip(t("w.onway"), "wait") + "<span>" + t("w.pendinghit", { p: U.pendingHit, time: "22:10" }) + "</span></p>" +
      (onHold ? btn(t("hold.convert.btn"), { disabled: true }) + '<p class="cap why">' + icon("info") + "<span>" + t("hold.convert.reason") + "</span></p>" : btn(t("w.convert"), { href: href("convert.html") })) + "</section>" +
      '<div class="list">' + inviteRow() + row(t("w.invite"), '<b class="t15">+' + M.invite.week + "P</b>", { cls: "kv-pad" }) + "</div>";
    PX.shell({ tab: "wallet", band: band, body: body, title: t("w.title"), cls: "is-money is-wallet" });
    var dep = $("#dep"); if (!dep) return;
    dep.addEventListener("click", function () {
      PX.sheet({ title: t("dp.title"), body: "<p>" + t("dp.lead") + '</p><div class="copyblock"><span class="lbl">' + t("w.addr") + '</span><code class="addr-full">' + PX.groupAddr(U.address) + "</code></div>" + row(t("dp.net"), "<b>" + t("dp.net.v") + "</b>") + row(t("dp.token"), "<b>" + t("dp.token.v") + "</b>") + PX.note("warn", t("dp.w1")) + '<p class="cap">' + t("dp.w2") + "</p>",
        foot: btn(t("w.copy"), { icon: "copy", attrs: 'data-copy="' + U.address + '" data-msg="' + esc(t("w.copied", { a: PX.shortAddr(U.address) })) + '"' }) });
    });
    $("#wd").addEventListener("click", function () {
      PX.sheet({ title: t("x.title"), body: '<label class="lbl" for="to">' + t("x.to") + '</label><div class="field field-row"><input id="to" placeholder="0x" autocomplete="off" spellcheck="false"><button type="button" class="field-act">' + t("x.paste") + '</button></div><div class="lbl-row"><label class="lbl" for="xa">' + t("x.amount") + '</label><span class="cap">' + t("x.avail", { c: num(U.ct) }) + '</span></div><div class="field field-row"><input id="xa" inputmode="decimal" placeholder="0"><span class="field-unit t15">CT</span><button type="button" class="field-act">' + t("s.max") + "</button></div>" + row(t("x.kaia"), "<b>" + num(U.kaia) + " KAIA</b>") + row(t("x.fee"), "<b>" + t("x.fee.v", { f: M.fee }) + "</b>") + '<p class="cap">' + t("x.gas") + "</p>",
        foot: btn(t("x.btn.empty"), { disabled: true }) });
    });
  };

  /* =================== CONVERT =================== */
  S.convert = function () {
    var wait = st === "wait", short = st === "short", onHold = st === "hold", pts = short ? 650 : U.points, val = short ? 0 : 1000, capLeft = 50;
    var block = wait ? PX.note("info", "<b>" + t("c.wait.h", { date: PX.date(U.firstConvert) }) + "</b><br>" + t("c.wait.b", { date: PX.date(U.firstConvert) }) + '<br><span class="nb">' + t("c.wait.left", { d: 3, h: 9 }) + "</span>")
      : short ? PX.note("info", "<b>" + t("c.short.h") + "</b><br>" + t("c.short.b", { p: num(pts), g: num(1000 - pts) })) : onHold ? PX.hold(t("hold.convert")) : "";
    var body = block +
      '<div class="lbl-row"><label class="lbl" for="pts">' + t("c.amount") + '</label><span class="cap">' + t("c.avail") + " <b>" + num(pts) + 'P</b></span></div>' +
      '<div class="stepper"><button type="button" class="step" id="dec" aria-label="-1,000P">' + icon("minus") + '</button><div class="field"><input id="pts" inputmode="numeric" value="' + num(val) + '" aria-describedby="pts-m"><span class="field-unit t15">P</span></div><button type="button" class="step" id="inc" aria-label="+1,000P">' + icon("plus") + '</button></div><p class="field-msg" id="pts-m"></p>' +
      '<section class="get"><span class="get-arrow">' + icon("down", 4) + '</span><div class="fig fig-c"><span class="fig-l">' + t("c.get") + '</span><span class="fig-v"><img src="assets/cojam-mark.svg" width="32" height="32" alt=""><b id="get">1</b><i>CT</i></span></div></section>' +
      '<div class="list list-kv">' + row(t("c.rate"), "<b>1,000P = 1 CT</b>") + row(t("c.minimum"), "<b>1,000P</b>") + row(t("c.capleft"), t("c.capof", { n: capLeft })) + row(t("c.fee"), t("c.fee.v")) + "</div>";
    var foot = btn("", { id: "go" }) + '<p class="cap cap-c">' + t("c.rank") + "</p>";
    PX.shell({ back: "wallet.html", title: t("c.title"), body: body, foot: foot, points: pts, cls: "is-money is-sub" });
    var inp = $("#pts"), go = $("#go");
    function calc() {
      var raw = inp.value.replace(/,/g, "").trim(), p = Number(raw), err = "", fix = null, locked = wait || short || onHold;
      if (raw === "" || p === 0) err = ""; else if (isNaN(p) || p < 1000) err = t("c.e.min");
      else if (p > pts) { err = t("c.e.bal", { p: num(pts) }); fix = Math.floor(pts / 1000) * 1000; }
      else if (p % 1000) { fix = Math.floor(p / 1000) * 1000; err = t("c.e.step", { f: num(fix) }); }
      var ok = !err && p >= 1000 && !locked, m = $("#pts-m");
      m.className = "field-msg" + (err ? " is-bad" : ""); $(".stepper .field").classList.toggle("is-bad", !!err);
      m.innerHTML = err ? icon("warn") + "<span>" + err + "</span>" + (fix ? '<button type="button" class="lnk" id="fix">' + t("c.fix", { f: num(fix) }) + "</button>" : "") : "<span>" + t("c.step") + "</span>";
      if (fix) $("#fix").addEventListener("click", function () { inp.value = num(fix); calc(); });
      $("#get").textContent = ok ? num(p / 1000) : "0";
      $(".btn-l", go).textContent = onHold ? t("hold.convert.btn") : ok ? t("c.btn", { p: num(p), n: num(p / 1000) }) : t("c.btn.empty");
      go.setAttribute("aria-disabled", !ok); go._p = p;
    }
    function bump(d) { var p = Number(inp.value.replace(/,/g, "")) || 0; p = Math.max(0, Math.min(Math.floor(pts / 1000) * 1000, Math.floor(p / 1000) * 1000 + d)); inp.value = num(p); calc(); }
    inp.addEventListener("input", calc); $("#dec").addEventListener("click", function () { bump(-1000); }); $("#inc").addEventListener("click", function () { bump(1000); });
    go.addEventListener("click", function () {
      if (go.getAttribute("aria-disabled") === "true") return; var p = go._p;
      PX.sheet({ title: t("tx.review.h"), body: row(t("c.amount"), "<b>" + num(p) + "P</b>") + row(t("c.get"), "<b>" + num(p / 1000) + " CT</b>") + row(t("c.fee"), t("c.fee.v")) + '<p class="cap">' + t("c.rank") + "</p>", foot: btn(t("c.btn", { p: num(p), n: num(p / 1000) }), { id: "cf" }) + btn(t("common.cancel"), { kind: "text", attrs: "data-close" }),
        ready: function (w) { $("#cf", w).addEventListener("click", function () { PX.closeSheet(); PX.toast(t("c.ok.h", { p: num(p), n: num(p / 1000) })); }); } });
    });
    calc();
  };

  /* =================== PROFILE =================== */
  S.profile = function () {
    var onHold = st === "hold", L = window.CJ_I18N;
    var body = '<section class="me">' + '<span class="avatar">' + A.svg("jam", 4) + '</span><div><h2 class="t24 b">' + U.name + '</h2><p class="cap">' + t("p.login", { email: U.email }) + "</p></div></section>" +
      (onHold ? '<a class="nav-row nav-hold" href="' + href("index.html") + '#hold">' + icon("stake") + '<span class="nav-b"><b class="t15">' + t("hold.t") + '</b><span class="cap">' + t("hold.profile.sub") + "</span></span>" + icon("chev") + "</a>" : "") +
      '<div class="trio trio-paper">' + PX.fig(t("p.rank"), t("k.rankth", { n: M.me.rank })) + PX.fig(t("r.week"), num(M.week.pts), "P") + PX.fig(t("p.pts"), num(U.points), "P") + "</div>" +
      '<div class="list">' + inviteRow() + "</div>" +
      '<section class="sec"><h2 class="sec-t t24 b">' + t("p.account") + '</h2><div class="list list-kv">' + row(t("p.wallet"), addrChip(U.address, t("w.copied", { a: PX.shortAddr(U.address) }))) + row(t("p.device"), '<span class="ok">' + icon("check") + t("p.device.ready") + "</span>") + '</div><a class="lnk" href="#">' + t("w.scan") + "</a></section>" +
      '<section class="sec"><label class="sec-t t24 b" for="nm">' + t("p.name") + '</label><div class="field field-row"><input id="nm" value="' + U.name + '" maxlength="20" autocomplete="nickname" aria-describedby="nm-m"><button type="button" class="field-act" id="nm-s">' + t("p.name.save.short") + '</button></div><p class="cap" id="nm-m">' + t("p.name.help") + "</p></section>" +
      '<section class="sec"><h2 class="sec-t t24 b">' + t("p.prefs") + '</h2><div class="pref"><span class="lbl">' + t("lang.label") + "</span>" + PX.seg(L.langs.map(function (l) { return { label: L.names[l], v: l }; }), L.langs.indexOf(PX.lang), { label: t("lang.label"), cls: "seg-lang" }) + '</div><div class="pref"><span class="lbl">' + t("p.view") + "</span>" + PX.seg([{ label: t("h.view.card"), icon: "cards" }, { label: t("h.view.term"), icon: "list" }], 0, { label: t("p.view"), cls: "seg-homeview" }) + "</div></section>" +
      '<section class="sec"><h2 class="sec-t t24 b">' + t("p.help") + "</h2>" + PX.disc(t("p.answers.q"), "<p>" + t("p.answers.a") + "</p>") + '<div class="list"><a class="nav-row" href="#"><span class="nav-b"><b class="t15">' + t("p.how") + "</b></span>" + icon("chev") + '</a><a class="nav-row" href="https://cojam.app"><span class="nav-b"><b class="t15">' + t("p.swap") + "</b></span>" + icon("chev") + '</a><a class="nav-row" href="https://cojam.app"><span class="nav-b"><b class="t15">' + t("p.site") + "</b></span>" + icon("chev") + "</a></div></section>" +
      '<div class="bye">' + btn(t("p.logout"), { kind: "text", id: "out", block: false }) + '<p class="cap">' + t("p.version", { v: M.version }) + "</p></div>";
    PX.shell({ back: "home.html", title: t("p.title"), body: body, cls: "is-sub is-profile" });
    $$(".seg-lang .seg-btn").forEach(function (b) { b.addEventListener("click", function () { L.setLang(b.getAttribute("data-v")); }); });
    $$(".seg-homeview .seg-btn").forEach(function (b) { b.addEventListener("click", function () { $$(".seg-homeview .seg-btn").forEach(function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", on); }); }); });
    $("#nm-s").addEventListener("click", function () {
      var v = $("#nm").value.trim(), m = $("#nm-m"), e = v && (v.length < 2 || v.length > 20) ? t("p.name.e.len") : v && !/^[\p{L}\p{N} _.]+$/u.test(v) ? t("p.name.e.chars") : /^0x|admin|cojam/i.test(v) ? t("p.name.e.staff") : "";
      m.textContent = e || t("p.name.help"); m.classList.toggle("is-bad", !!e); if (!e) PX.toast(t("p.name.saved"));
    });
    $("#out").addEventListener("click", function () { PX.sheet({ title: t("p.logout.h"), body: "<p>" + t("p.logout.b") + "</p>", foot: btn(t("p.logout"), { href: href("login.html") }) + btn(t("common.cancel"), { kind: "text", attrs: "data-close" }) }); });
  };

  /* =================== INVITE =================== */
  S.invite = function () {
    var V = M.invite, none = st === "empty", onHold = st === "hold";
    var band = '<div class="offer"><b class="t48 b">' + V.rate + '%</b><div><p class="offer-l">' + t("inv.hero.line", { r: V.rate }) + '</p><p class="band-sub">' + t("inv.hero.sub") + '</p></div></div><div class="ex" role="img" aria-label="' + esc(t("inv.ex.sr", { a: 350, b: 35 })) + '"><div class="ex-b"><span class="t12">' + t("inv.ex.friend") + '</span><b class="t24 b">+350P</b></div>' + icon("right", 4) + '<div class="ex-b ex-you"><span class="t12">' + t("inv.ex.you") + '</span><b class="t24 b">+35P</b></div></div>';
    var body = (onHold ? PX.hold(t("hold.invite")) + PX.note("info", t("hold.invite.bonus")) :
      '<section class="codeblock"><span class="lbl">' + t("inv.code.h") + '</span><button type="button" class="code-big" data-copy="' + V.code + '" aria-label="' + esc(t("common.copy")) + " " + V.code + '"><b class="t36 b">' + V.code + "</b>" + icon("copy") + '</button><code class="link">' + V.linkShort + "</code></section>" +
      btn(t("inv.share"), { icon: "share", id: "sh" }) + btn(t("inv.copylink"), { kind: "second", attrs: 'data-copy="' + V.link + '" data-msg="' + esc(t("inv.linkcopied")) + '"' })) +
      '<section class="sec"><h2 class="sec-t t24 b">' + t("inv.how.h") + '</h2><ol class="how">' + [1, 2, 3].map(function (i) { return '<li><b class="t24 b">' + i + "</b><p>" + t("inv.how." + i, { w: V.welcome, r: V.rate }) + "</p></li>"; }).join("") + "</ol></section>" +
      '<section class="sec"><h2 class="sec-t t24 b">' + t("inv.res.h") + '</h2><div class="trio trio-paper">' + PX.fig(t("inv.res.joined"), none ? 0 : V.joined) + PX.fig(t("inv.res.week"), "+" + (none ? 0 : V.week), "P") + PX.fig(t("inv.res.total"), num(none ? 0 : V.total), "P") + "</div></section>" +
      '<section class="sec"><h2 class="sec-t t24 b">' + t("inv.friends.h") + "</h2>" + (none ? '<p class="cap fe">' + t("inv.empty") + "</p>" : '<ul class="rows">' + V.friends.map(function (f) { return '<li class="frow"><span class="frow-n t15">' + esc(f.name) + "</span>" + PX.chip(t("inv.st." + f.st), f.st === "first" ? "ok" : "") + '<b class="t15">' + (f.pts ? "+" + num(f.pts) + "P" : "0P") + "</b></li>"; }).join("") + "</ul>") + "</section>" +
      '<section class="sec"><h2 class="sec-t t24 b">' + t("inv.rules.h") + '</h2><ul class="bullets">' + [1, 2, 3, 4].map(function (i) { return "<li>" + t("inv.rule." + i) + "</li>"; }).join("") + "</ul></section>";
    PX.shell({ back: "wallet.html", title: t("inv.title"), band: band, body: body, cls: "is-sub is-invite" });
    var sh = $("#sh"); if (sh) sh.addEventListener("click", function () { var d = { text: t("inv.share.text", { code: V.code, w: V.welcome }), url: V.link }; if (navigator.share) navigator.share(d).catch(function () {}); else PX.copy(V.link, t("inv.linkcopied")); });
  };
})();
