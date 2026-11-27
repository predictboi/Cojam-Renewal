/* Concept D "Clean": staking (new stake, my stakes), wallet, convert, deposit, withdraw, profile, invite. */
(function () {
  "use strict";
  var App = window.App, C = window.C, M = window.MOCK, t = App.t, F = App.fmt, $ = App.$, $$ = App.$$, esc = App.esc;
  var st = App.state, U = M.user, DAY = 86400000;

  function stakeTabs(cur, n) {
    return '<section class="sec sec--tight" style="margin-top:4px">' + C.seg("stabs", [{ v: "new", label: t("s.new"), href: App.url("staking.html") }, { v: "mine", label: t("s.tab.mine") + (n ? ' <i class="seg-n" style="font-style:normal">' + n + "</i>" : ""), href: App.url("stakes.html") }], cur, t("s.switch")) + "</section>";
  }
  function interestOf(s, at) { var days = Math.min(s.days, ((at || Date.now()) - s.start.getTime()) / DAY); return s.amount * s.rate / 100 * days / 365; }

  /* =====================================================================
     STAKING: new stake
     ===================================================================== */
  App.screens.staking = function () {
    var hold = App.hold, zero = st === "zero", bal = zero ? 0 : U.ct;
    var tabs = stakeTabs("new", M.stakes.length);
    if (st === "loading") { App.mount({ tab: "stake", docTitle: t("s.title"), body: tabs + C.skel([["70%", 34], ["100%", 64], ["40%", 24], ["100%", 160], ["100%", 150]]) }); return; }
    if (st === "error") { App.mount({ tab: "stake", docTitle: t("s.title"), body: tabs + C.error() }); return; }
    var val = { empty: "", zero: "", below: "50", above: "5000" }[st]; if (val === undefined) val = "500";
    var days = 30;
    var body = tabs + '<div class="say"><h1>' + t("v.stake.q") + "</h1></div>" +
      (hold ? '<section class="sec sec--tight">' + C.holdNote("hold.stake") + "</section>" : "") +
      (zero ? '<section class="sec sec--tight">' + C.note(t("s.zero"), "info") + "</section>" : "") +
      '<section class="sec sec--tight"><div class="amt" id="amt"><input id="amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="' + val + '" aria-label="' + esc(t("s.amount")) + '" aria-describedby="amt-msg"' + (hold ? " disabled" : "") + '><span class="u">CT</span><button type="button" class="btn btn--sm btn--plain" id="max"' + (hold ? " disabled" : "") + ">" + t("s.max") + "</button></div>" +
      '<div class="amt-row"><span>' + t("s.avail") + " <b>" + F.ct(bal) + '</b></span><span id="tier"></span></div>' +
      '<div id="amt-msg" aria-live="polite"></div></section>' +
      '<section class="sec"><div class="sec-h"><h2>' + t("v.stake.period") + '</h2></div><div class="opt-grid" id="period" role="group" aria-label="' + esc(t("s.period")) + '">' +
      [30, 90, 180, 365].map(function (d) { return '<button type="button" class="opt" data-d="' + d + '" aria-pressed="' + (d === days) + '"' + (hold ? " disabled" : "") + "><span>" + t("s.days", { d: d }) + "</span><b></b>" + C.icon("check", 20) + "</button>"; }).join("") + "</div></section>" +
      '<section class="sec sec--tight"><div class="blk"><div class="kv"><span id="int-l"></span></div><span class="num num--blue" style="margin:-4px 0 8px">+<span id="int-v">0</span><span class="u">CT</span></span>' + C.kv(t("s.apr"), '<span id="apr"></span>') + C.kv(t("s.unlock"), '<span id="unlock"></span>') + '<p class="cap" id="noexit" style="margin-top:8px"></p></div></section>' +
      '<section class="sec sec--tight"><button type="button" class="disc" data-disc aria-expanded="false" aria-controls="help-a">' + t("s.help.q") + C.icon("down1", 20) + '</button><div class="disc-p" id="help-a" hidden><p>' + t("s.help.a") + "</p></div></section>";
    App.mount({ tab: "stake", docTitle: t("s.title"), body: body, cta: '<button type="button" class="btn" id="go"></button><p class="cta-note">' + (hold ? t("hold.fee.line") : t("s.fee")) + "</p>" });

    var inp = $("#amount"), go = $("#go"), lastInt = 0;
    function tier(a) { return a >= 10000 ? 2 : a >= 1000 ? 1 : 0; }
    function calc() {
      var a = App.parseAmount(inp.value), blank = inp.value.trim() === "", ok = !isNaN(a), ti = ok ? tier(a) : 0, rate = M.rates[days][ti];
      var unlock = new Date(Date.now() + days * DAY), err = "", fix = null, label = t("s.btn", { a: ok ? F.dec(a) : "" });
      $$("#period .opt").forEach(function (b) { $("b", b).textContent = M.rates[+b.getAttribute("data-d")][ti] + "%"; });
      $("#tier").textContent = t("s.tier.cue" + ti);
      if (blank) label = t("s.btn.empty");
      else if (!ok) { err = t("s.e.nan"); label = t("s.btn.nan"); }
      else if (a < M.minStake) { err = t("s.e.min"); label = t("s.btn.min"); fix = [t("s.fix.min"), M.minStake]; }
      else if (a > bal) { err = t("s.e.bal", { b: F.dec(bal) }); label = t("s.btn.bal"); fix = [t("s.fix.bal", { b: F.dec(bal) }), bal]; }
      if (hold) { label = t("hold.stake.btn"); err = ""; }
      $("#amt").classList.toggle("is-err", !!err);
      $("#amt-msg").innerHTML = err ? '<p class="field-msg field-msg--err">' + err + "</p>" + (fix ? '<button type="button" class="link field-fix" id="fix">' + fix[0] + "</button>" : "") : "";
      if (fix) $("#fix").addEventListener("click", function () { inp.value = fix[1]; calc(); });
      var valid = !blank && ok && !err && !hold && !App.offline;
      go.textContent = label; go.setAttribute("aria-disabled", valid ? "false" : "true");
      var int = ok ? a * rate / 100 * days / 365 : 0;
      $("#int-l").textContent = t("s.interest", { d: days });
      App.countTo($("#int-v"), lastInt, int, function (n) { return F.fix(n, 4); }, 320); lastInt = int;
      $("#apr").textContent = rate + "%"; $("#unlock").textContent = F.dateLong(unlock);
      $("#noexit").textContent = t("s.rules", { date: F.dateLong(unlock) });
      return { a: a, rate: rate, int: int, unlock: unlock, valid: valid };
    }
    inp.addEventListener("input", calc);
    $("#max").addEventListener("click", function () { inp.value = bal; calc(); });
    $("#period").addEventListener("click", function (e) { var b = e.target.closest(".opt"); if (!b) return; days = +b.getAttribute("data-d"); $$("#period .opt").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); calc(); });
    function review() {
      var c = calc(); if (!c.valid) { if (App.offline) App.toast(t("s.offline")); return; }
      App.sheet.open('<h2 id="sheet-h">' + t("s.rv.h", { a: F.dec(c.a), d: days }) + '</h2><div class="blk">' + C.kv(t("s.amount"), F.ct(c.a)) + C.kv(t("s.period"), t("s.days", { d: days })) + C.kv(t("s.apr"), c.rate + "%") + C.kv(t("s.interest", { d: days }), "+" + F.fix(c.int, 4) + " CT") + C.kv(t("s.unlock"), F.dateLong(c.unlock)) + "</div>" +
        '<p class="cap" style="margin-top:12px">' + t("s.noexit", { date: F.dateLong(c.unlock) }) + '</p><button type="button" class="btn" id="confirm">' + t("tx.confirm") + '</button><button type="button" class="btn btn--plain" data-close>' + t("common.cancel") + "</button>");
      $("#confirm").addEventListener("click", function () { App.tx({ h: t("s.ok.h", { a: F.dec(c.a) }), btn: t("s.ok.btn"), href: App.url("stakes.html"), rows: C.kv(t("s.unlock"), F.dateLong(c.unlock)) + C.kv(t("s.interest", { d: days }), "+" + F.fix(c.int, 4) + " CT") }); });
    }
    go.addEventListener("click", review);
    var c0 = calc();
    if (st === "review") review();
    if (st === "success") { App.sheet.open(""); App.txDone({ h: t("s.ok.h", { a: F.dec(c0.a) }), btn: t("s.ok.btn"), href: App.url("stakes.html"), rows: C.kv(t("s.unlock"), F.dateLong(c0.unlock)) + C.kv(t("s.interest", { d: days }), "+" + F.fix(c0.int, 4) + " CT") }); }
  };

  /* =====================================================================
     STAKING: my stakes
     ===================================================================== */
  App.screens.stakes = function () {
    var hold = App.hold, list = st === "empty" ? [] : M.stakes.slice();
    if (st === "claimable") list.unshift(M.stakeBig);
    var tabs = stakeTabs("mine", list.length);
    if (st === "loading") { App.mount({ tab: "stake", docTitle: t("s.tab.mine"), body: tabs + C.skel([["80%", 34], ["100%", 84], ["100%", 190], ["100%", 190]]) }); return; }
    if (st === "error") { App.mount({ tab: "stake", docTitle: t("s.tab.mine"), body: tabs + C.error() }); return; }
    if (!list.length) { App.mount({ tab: "stake", docTitle: t("s.tab.mine"), body: tabs + C.state({ icon: "stake", tone: "blue", h: t("m.empty.h"), b: t("m.empty.b"), btn: t("m.empty.btn"), href: App.url("staking.html") }) }); return; }
    var now = Date.now(), total = 0, sofar = 0, claimable = 0;
    var blocks = list.map(function (s) {
      var x = Math.min(s.days, Math.floor((now - s.start.getTime()) / DAY)), unlocked = x >= s.days, int = interestOf(s, now), end = new Date(s.start.getTime() + s.days * DAY);
      total += s.amount; sofar += int; if (unlocked || int >= M.minClaim) claimable += int;
      var action = unlocked ? '<button type="button" class="btn" data-act="wd" data-id="' + s.id + '">' + t("m.withdraw", { a: F.dec(s.amount + int, 2) }) + '</button><p class="pos-why">' + t("m.withint", { p: F.dec(s.amount), i: F.fix(int, 4) }) + "</p>"
        : int >= M.minClaim ? '<button type="button" class="btn btn--soft" data-act="claim" data-id="' + s.id + '">' + t("m.claim", { i: F.fix(int, 2) }) + "</button>"
        : '<p class="pos-why">' + t("m.claim.gap", { g: F.fix(M.minClaim - int, 2) }) + "</p>";
      return '<div class="blk pos"><div class="pos-h"><div>' + C.num(F.dec(s.amount), "CT", "num--md") + "<small>" + t("m.card.period", { d: s.days, r: s.rate }) + '</small></div><span class="chip' + (unlocked ? " chip--blue" : "") + '">' + (unlocked ? t("m.unlocked") : t("m.locked")) + "</span></div>" +
        '<div class="bar" role="img" aria-label="' + esc(t("m.day", { x: x, d: s.days })) + '"><i style="--p:' + Math.round(x / s.days * 100) + '%"></i></div><div class="pos-dates"><span>' + t("m.day", { x: x, d: s.days }) + "</span><span>" + t("m.unlocks", { date: F.date(end) }) + "</span></div>" +
        C.kv(t("m.interest"), '+<span data-int="' + s.id + '">' + F.fix(int, 4) + "</span> CT") + action + "</div>";
    }).join("");
    var closed = M.stakesClosed.map(function (s) { return C.row({ title: F.ct(s.amount), sub: t("m.card.period", { d: s.days, r: s.rate }), value: "<small>" + t("m.paidout", { a: F.dec(s.paid, 2) }) + "</small>" }); }).join("");
    var body = tabs + '<div class="say"><h1>' + t("v.stakes.h", { a: F.dec(total) }) + "</h1></div>" +
      (hold ? '<section class="sec sec--tight">' + C.holdNote(st === "hold-nokaia" ? "hold.nokaia" : "hold.stakes") + "</section>" : "") +
      '<section class="sec sec--tight"><div class="blk trio" style="grid-template-columns:1fr 1fr"><div><span>' + t("m.sofar") + '</span><b>+<span id="sofar">' + F.fix(sofar, 4) + "</span> CT</b></div><div><span>" + t("m.claimable") + "</span><b>" + F.fix(claimable, 2) + " CT</b></div></div></section>" +
      '<section class="sec sec--tight">' + blocks + "</section>" +
      '<section class="sec sec--tight"><button type="button" class="disc" data-disc aria-expanded="false" aria-controls="closed">' + t("m.closed.q", { n: M.stakesClosed.length }) + C.icon("down1", 20) + '</button><div id="closed" hidden>' + closed + "</div></section>";
    App.mount({ tab: "stake", docTitle: t("s.tab.mine"), body: body });
    /* interest builds every second: the figure ticks, 4 decimals */
    setInterval(function () {
      var n = Date.now(), sum = 0;
      list.forEach(function (s) { var i = interestOf(s, n); sum += i; var el = $('[data-int="' + s.id + '"]'); if (el) el.textContent = F.fix(i, 4); });
      $("#sofar").textContent = F.fix(sum, 4);
    }, App.reduce ? 10000 : 1000);
    $("#main").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var s = list.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0], int = interestOf(s), wd = b.getAttribute("data-act") === "wd";
      var title = wd ? t("m.withdraw", { a: F.dec(s.amount + int, 2) }) : t("m.claim", { i: F.fix(int, 2) });
      App.sheet.open('<h2 id="sheet-h">' + title + '</h2><div class="blk">' + (wd ? C.kv(t("s.amount"), F.ct(s.amount)) : "") + C.kv(t("m.interest"), "+" + F.fix(int, 4) + " CT") + C.kv(t("c.fee"), hold ? t("hold.fee.line") : t("c.fee.v")) + '</div><button type="button" class="btn" id="confirm">' + t("tx.confirm") + '</button><button type="button" class="btn btn--plain" data-close>' + t("common.cancel") + "</button>");
      $("#confirm").addEventListener("click", function () { App.tx({ h: wd ? t("m.ok.wd", { a: F.dec(s.amount + int, 2) }) : t("m.ok.claim", { i: F.fix(int, 2) }) }); });
    });
  };

  /* =====================================================================
     WALLET
     ===================================================================== */
  App.screens.wallet = function () {
    var hold = App.hold, zero = st === "zero" || st === "new";
    var ct = zero ? 0 : U.ct, pts = zero ? 0 : App.points(), staked = zero ? 0 : U.staked, kaia = zero ? 0 : U.kaia;
    if (st === "loading") { App.mount({ tab: "wallet", docTitle: t("w.title"), pointsLoading: true, body: '<div class="say"><h1>' + t("v.wallet.h") + "</h1></div>" + C.skel([["64%", 52], ["50%", 44], ["100%", 56], ["100%", 64], ["100%", 64], ["100%", 170]]) }); return; }
    if (st === "error") { App.mount({ tab: "wallet", docTitle: t("w.title"), body: '<div class="say"><h1>' + t("w.title") + "</h1></div>" + C.state({ icon: "alert", tone: "danger", h: t("common.error.h"), b: t("e.rpc"), btn: t("common.retry") }) }); return; }
    var canConv = Math.floor(pts / 1000);
    var body = '<div class="say"><h1>' + t("v.wallet.h") + "</h1></div>" +
      '<section class="sec" style="margin-top:4px">' + C.num('<span id="ct-n">' + F.dec(ct) + "</span>", "CT") + (App.lang === "ko" ? '<p class="cap">' + F.krw(ct) + "</p>" : "") +
      '<div class="blk-h" style="margin-top:12px"><button type="button" class="chipbtn" id="addr" aria-label="' + esc(t("w.copy")) + '"><span class="addr">' + F.short(U.address) + "</span>" + C.icon("copy", 18) + "</button>" + C.live() + "</div>" +
      (hold ? '<div style="margin-top:16px">' + C.holdNote("hold.wallet") + "</div>" : "") +
      '<div class="btn-pair" style="margin-top:16px"><a class="btn btn--soft" href="' + App.url("deposit.html") + '">' + C.icon("deposit", 20) + t("w.deposit") + '</a><a class="btn btn--soft" href="' + App.url("withdraw.html") + '">' + C.icon("withdraw", 20) + t("w.withdraw") + "</a></div></section>" +
      '<section class="sec sec--tight">' + C.row({ href: App.url("stakes.html"), icon: "stake", title: t("w.staked"), sub: staked ? t("s.mine", { n: M.stakes.length }) : t("m.empty.b"), value: F.ct(staked) }) +
      C.row({ lead: '<span class="row-ic" aria-hidden="true"><b>K</b></span>', title: "KAIA", sub: hold ? t("hold.kaia.note") : t("w.kaia.note"), value: F.dec(kaia) }) + "</section>" +
      '<section class="sec sec--tight"><div class="blk"><div class="blk-h"><span class="lbl">' + t("w.points") + "</span>" + (!zero ? '<span class="chip">' + t("w.onway") + " +" + F.pts(U.pendingHit) + "</span>" : "") + "</div>" +
      C.num(F.int(pts), "P", pts ? "" : "is-off") + '<p class="lbl" style="margin:4px 0 16px">' + (canConv ? t("w.ready", { n: canConv }) : t("w.notyet", { g: F.int(1000 - pts % 1000) })) + "</p>" +
      (hold ? '<button type="button" class="btn" aria-disabled="true">' + t("hold.convert.btn") + "</button>" : '<a class="btn" href="' + App.url("convert.html") + '">' + t("w.convert") + "</a>") + "</div></section>" +
      '<section class="sec sec--tight">' + C.row({ href: App.url("invite.html"), icon: "gift", title: t("inv.entry"), sub: t("inv.entry.sub", { r: M.invite.rate }), value: zero ? "" : "+" + F.pts(M.invite.week) }) + "</section>";
    App.mount({ tab: "wallet", docTitle: t("w.title"), body: body });
    $("#addr").addEventListener("click", function () { App.copy(U.address, t("w.copied", { a: F.short(U.address) })); });
    if (!zero) App.countTo($("#ct-n"), ct - 12, ct, function (n) { return F.dec(n, 1); }, 500);
  };

  /* =====================================================================
     CONVERT POINTS
     ===================================================================== */
  App.screens.convert = function () {
    var hold = App.hold, pts = st === "short" ? 400 : U.points, wait = st === "wait", short = st === "short";
    var back = App.url("wallet.html");
    if (st === "loading") { App.mount({ back: back, title: t("c.title"), body: C.skel([["80%", 68], ["100%", 64], ["100%", 190]]) }); return; }
    var val = st === "empty" || short ? "" : "1000";
    var blocked = wait || short || hold;
    var notice = hold ? C.holdNote("hold.convert") : wait ? '<div class="note"><span class="note-ic">' + C.icon("clock", 22) + "</span><div><b>" + t("c.wait.h", { date: F.date(U.firstConvert) }) + "</b><p>" + t("c.wait.b", { date: F.date(U.firstConvert) }) + "</p><p><b>" + t("c.wait.left", { d: 3, h: 9 }) + "</b></p></div></div>"
      : short ? '<div class="note"><span class="note-ic">' + C.icon("info", 22) + "</span><div><b>" + t("c.short.h") + "</b><p>" + t("c.short.b", { p: F.int(pts), g: F.int(1000 - pts) }) + "</p></div></div>" : "";
    var body = '<div class="say"><h1>' + t("v.convert.h") + "</h1></div>" + (notice ? '<section class="sec sec--tight">' + notice + "</section>" : "") +
      '<section class="sec sec--tight"><div class="amt" id="amt"><input id="amount" inputmode="numeric" autocomplete="off" placeholder="0" value="' + (val ? F.int(+val) : "") + '" aria-label="' + esc(t("c.amount")) + '" aria-describedby="amt-msg"' + (blocked ? " disabled" : "") + '><span class="u">P</span>' +
      '<button type="button" class="btn btn--sm btn--plain" id="minus" aria-label="-1,000P"' + (blocked ? " disabled" : "") + ">" + C.icon("minus", 20) + '</button><button type="button" class="btn btn--sm btn--plain" id="plus" aria-label="+1,000P"' + (blocked ? " disabled" : "") + ">" + C.icon("plus", 20) + "</button></div>" +
      '<div class="amt-row"><span>' + t("c.avail") + " <b>" + F.pts(pts) + "</b></span><span>" + t("c.step") + '</span></div><div id="amt-msg" aria-live="polite"></div></section>' +
      '<section class="sec sec--tight"><div class="blk"><span class="lbl">' + t("c.get") + '</span><span class="num num--blue" id="get-w"><span id="get">0</span><span class="u">CT</span></span><div style="margin-top:12px">' +
      C.kv(t("c.rate"), "1,000P = 1 CT") + C.kv(t("c.minimum"), "1,000P") + C.kv(t("c.capleft"), t("c.capof", { n: 50 })) + C.kv(t("c.fee"), t("c.fee.v")) + '</div></div><p class="cap" style="margin-top:12px">' + t("c.rank") + "</p></section>";
    App.mount({ back: back, title: t("c.title"), body: body, cta: '<button type="button" class="btn" id="go"></button>' });
    var inp = $("#amount"), go = $("#go"), lastN = 0;
    function calc() {
      var p = App.parseAmount(inp.value), blank = inp.value.trim() === "", err = "", fix = null, n = 0, label;
      if (!blank && !isNaN(p)) {
        if (p < 1000) { err = t("c.e.min"); fix = 1000; }
        else if (p > pts) { err = t("c.e.bal", { p: F.int(pts) }); fix = Math.floor(pts / 1000) * 1000; }
        else if (p % 1000) { fix = Math.floor(p / 1000) * 1000; err = t("c.e.step", { f: F.int(fix) }); }
        else n = p / 1000;
      }
      label = hold ? t("hold.convert.btn") : n ? t("c.btn", { p: F.int(p), n: n }) : t("c.btn.empty");
      $("#amt").classList.toggle("is-err", !!err);
      $("#amt-msg").innerHTML = err ? '<p class="field-msg field-msg--err">' + err + "</p>" + (fix ? '<button type="button" class="link field-fix" id="fix">' + t("c.fix", { f: F.int(fix) }) + "</button>" : "") : "";
      if (fix && err) $("#fix").addEventListener("click", function () { inp.value = F.int(fix); calc(); });
      go.textContent = label; go.setAttribute("aria-disabled", n && !blocked ? "false" : "true");
      $("#get-w").classList.toggle("is-off", !n); $("#get-w").classList.toggle("num--blue", !!n);
      App.countTo($("#get"), lastN, n, null, 260); lastN = n;
      return { p: p, n: n, ok: !!n && !blocked };
    }
    inp.addEventListener("input", calc);
    function bump(d) { var p = App.parseAmount(inp.value); if (isNaN(p)) p = 0; p = Math.max(0, Math.min(Math.floor(pts / 1000) * 1000, Math.round(p / 1000) * 1000 + d)); inp.value = p ? F.int(p) : ""; calc(); }
    $("#minus").addEventListener("click", function () { bump(-1000); }); $("#plus").addEventListener("click", function () { bump(1000); });
    function done(c) { App.txDone({ h: t("c.ok.h", { p: F.int(c.p), n: c.n }), rows: C.kv(t("c.ok.left"), F.pts(pts - c.p)) + C.kv(t("c.ok.ct"), F.ct(U.ct + c.n)), btn: t("common.done"), href: back }); }
    go.addEventListener("click", function () { var c = calc(); if (!c.ok) return; App.sheet.open(""); App.tx({ h: t("c.ok.h", { p: F.int(c.p), n: c.n }), rows: C.kv(t("c.ok.left"), F.pts(pts - c.p)) + C.kv(t("c.ok.ct"), F.ct(U.ct + c.n)), btn: t("common.done"), href: back }); });
    var c0 = calc();
    if (st === "success") { App.sheet.open(""); done(c0); }
  };

  /* =====================================================================
     DEPOSIT
     ===================================================================== */
  App.screens.deposit = function () {
    var body = '<div class="say"><h1>' + t("v.dep.h") + "</h1><p>" + t("dp.lead") + "</p></div>" +
      '<section class="sec sec--tight"><div class="blk"><div class="qr" role="img" aria-label="' + esc(t("dp.qr")) + '">' + App.qrSvg(U.address) + '<img src="assets/cojam-mark.svg" alt="" width="36" height="36"></div><p class="addr-full" translate="no">' + F.groups(U.address) + "</p></div>" +
      '<p class="done-st" style="margin-top:12px">' + C.spin() + t("dp.watch") + "</p></section>" +
      '<section class="sec sec--tight">' + C.kv(t("dp.net"), t("dp.net.v")) + C.kv(t("dp.token"), t("dp.token.v")) + '<ul class="bul" style="margin-top:12px"><li>' + t("dp.w1") + "</li><li>" + t("dp.w2") + "</li><li>" + t("dp.w3") + "</li></ul></section>";
    App.mount({ back: App.url("wallet.html"), title: t("dp.title"), body: body, offText: "dp.offline", cta: '<button type="button" class="btn" id="copy">' + C.icon("copy", 20) + t("w.copy") + "</button>" });
    $("#copy").addEventListener("click", function () { App.copy(U.address, t("w.copied", { a: F.short(U.address) })); });
    if (st === "arrived") setTimeout(function () { App.toast(t("dp.toast", { a: "250" })); }, 400);
  };

  /* =====================================================================
     WITHDRAW CT
     ===================================================================== */
  App.screens.withdraw = function () {
    var TO = "0x52bF0C4a8e1D3967Ac5b20E4f8d1B7c6309aE4d2", bad = st === "bad", empty = st === "empty";
    var body = '<div class="say"><h1>' + t("v.wd.h") + "</h1></div>" +
      '<section class="sec sec--tight"><label class="field"><span class="field-l">' + t("x.to") + '</span><span class="inp-wrap" style="display:block"><input class="inp inp--act addr" id="to" name="to" autocomplete="off" spellcheck="false" placeholder="0x" value="' + (empty ? "" : bad ? "0x52bF0C4a8e1D" : TO) + '" aria-describedby="to-msg"><button type="button" class="btn btn--sm btn--plain inp-act" id="paste">' + t("x.paste") + '</button></span></label><p class="field-msg" id="to-msg"></p></section>' +
      '<section class="sec sec--tight"><span class="field-l">' + t("x.amount") + '</span><div class="amt" id="amt"><input id="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="' + (empty ? "" : "250") + '" aria-label="' + esc(t("x.amount")) + '"><span class="u">CT</span><button type="button" class="btn btn--sm btn--plain" id="max">' + t("s.max") + '</button></div><div class="amt-row"><span>' + t("x.avail", { c: F.dec(U.ct) }) + "</span></div></section>" +
      '<section class="sec sec--tight"><div class="blk">' + C.kv(t("x.kaia"), F.dec(U.kaia) + " KAIA") + C.kv(t("x.fee"), t("x.fee.v", { f: M.fee })) + C.kv(t("dp.net"), t("dp.net.v")) + '</div><p class="cap" style="margin-top:12px">' + t("x.gas") + "</p></section>";
    App.mount({ back: App.url("wallet.html"), title: t("x.title"), body: body, offText: "x.offline", cta: '<button type="button" class="btn" id="go"></button>' });
    var to = $("#to"), amt = $("#amount"), go = $("#go");
    function calc() {
      var a = App.parseAmount(amt.value), v = to.value.trim(), okAddr = /^0x[0-9a-fA-F]{40}$/.test(v), m = $("#to-msg"), own = v.toLowerCase() === U.address.toLowerCase();
      to.removeAttribute("aria-invalid"); m.className = "field-msg"; m.textContent = "";
      if (v && !okAddr) { to.setAttribute("aria-invalid", "true"); m.className = "field-msg field-msg--err"; m.textContent = t("x.e.bad"); }
      else if (own) { to.setAttribute("aria-invalid", "true"); m.className = "field-msg field-msg--err"; m.textContent = t("x.e.own"); okAddr = false; }
      else if (okAddr) { m.className = "field-msg field-msg--ok"; m.innerHTML = t("x.addr.ok") + '<span class="addr-full">' + F.groups(v) + "</span>"; }
      var ok = okAddr && !isNaN(a) && a > 0 && a <= U.ct && !App.offline;
      go.textContent = ok ? t("x.btn", { a: F.dec(a) }) : !isNaN(a) && a > U.ct ? t("s.btn.bal") : t("x.btn.empty");
      go.setAttribute("aria-disabled", ok ? "false" : "true");
      return { ok: ok, a: a, to: v };
    }
    to.addEventListener("input", calc); amt.addEventListener("input", calc);
    $("#max").addEventListener("click", function () { amt.value = U.ct; calc(); });
    $("#paste").addEventListener("click", function () { to.value = TO; calc(); });
    function review() {
      var c = calc(); if (!c.ok) return;
      App.sheet.open('<h2 id="sheet-h">' + t("x.rv.h", { a: F.dec(c.a) }) + '</h2><div class="blk">' + C.kv(t("x.rv.to"), '<span class="addr-full" style="align-items:flex-end;margin:0">' + F.groups(c.to) + "</span>") + C.kv(t("x.amount"), F.ct(c.a)) + C.kv(t("x.fee"), t("x.fee.v", { f: M.fee })) + "</div>" +
        '<label class="check-row"><input type="checkbox" id="chk"><span class="check-box">' + C.icon("check", 18) + '</span><span>' + t("x.rv.check") + '</span></label><button type="button" class="btn" id="confirm" aria-disabled="true">' + t("tx.confirm") + '</button><button type="button" class="btn btn--plain" data-close>' + t("common.cancel") + "</button>");
      $("#chk").addEventListener("change", function () { $("#confirm").setAttribute("aria-disabled", this.checked ? "false" : "true"); });
      $("#confirm").addEventListener("click", function () { if (!$("#chk").checked) return; App.tx({ h: t("x.ok", { a: F.dec(c.a) }), href: App.url("wallet.html"), btn: t("common.done") }); });
    }
    go.addEventListener("click", review);
    calc(); if (st === "review") review();
  };

  /* =====================================================================
     PROFILE AND SETTINGS
     ===================================================================== */
  App.screens.profile = function () {
    var I = window.CJ_I18N, hold = App.hold;
    var body = '<div class="me"><span class="me-av" aria-hidden="true">' + esc(U.name.charAt(0).toUpperCase()) + "</span><div><h1>" + esc(U.name) + "</h1><p>" + esc(U.email) + "</p></div></div>" +
      (hold ? '<section class="sec sec--tight">' + C.row({ href: App.url("hold.html"), icon: "pause", title: t("hold.t"), sub: t("hold.profile.sub"), cls: "row--blk" }) + "</section>" : "") +
      '<section class="sec sec--tight"><div class="blk trio"><div><span>' + t("p.rank") + "</span><b>" + t("k.rankth", { n: M.me.rank }) + "</b></div><div><span>" + t("r.week") + "</span><b>" + F.pts(M.week.pts) + "</b></div><div><span>" + t("p.pts") + "</span><b>" + F.pts(App.points()) + "</b></div></div></section>" +
      '<section class="sec sec--tight">' + C.row({ href: App.url("invite.html"), icon: "gift", title: t("inv.entry"), sub: t("inv.entry.n", { n: M.invite.joined }), value: "+" + F.pts(M.invite.week) }) + "</section>" +
      '<section class="sec"><div class="sec-h"><h2>' + t("p.name") + '</h2></div><div class="inp-wrap"><input class="inp inp--act" id="name" name="display-name" autocomplete="off" spellcheck="false" maxlength="20" value="' + esc(U.name) + '" aria-label="' + esc(t("p.name")) + '" aria-describedby="name-msg"><button type="button" class="btn btn--sm btn--plain inp-act" id="name-save">' + t("p.name.save.short") + '</button></div><p class="field-msg" id="name-msg">' + t("p.name.help") + "</p></section>" +
      '<section class="sec"><div class="sec-h"><h2>' + t("p.account") + "</h2></div>" +
      C.row({ icon: "mail", title: esc(U.email), sub: t("p.device.ready") }) +
      C.row({ btn: true, icon: "wallet", title: t("p.wallet"), sub: '<span class="addr">' + F.short(U.address) + "</span>", value: '<span class="link">' + t("common.copy") + "</span>", attr: 'id="addr"' }) +
      C.row({ href: "#", attr: "data-nolink", icon: "search", title: t("w.scan") }) + "</section>" +
      '<section class="sec"><div class="sec-h"><h2>' + t("p.prefs") + '</h2></div><span class="field-l">' + t("lang.label") + "</span>" + C.seg("lang", I.langs.map(function (l) { return { v: l, label: I.names[l] }; }), App.lang, t("lang.label")) +
      '<span class="field-l" style="margin-top:20px">' + t("p.view") + "</span>" + C.seg("view", [{ v: "card", label: t("h.view.card"), icon: "cards" }, { v: "list", label: t("h.view.term"), icon: "rows" }], "card", t("p.view")) + "</section>" +
      '<section class="sec"><div class="sec-h"><h2>' + t("p.help") + "</h2></div>" + C.row({ href: "#", attr: "data-nolink", icon: "help", title: t("p.how") }) +
      C.row({ btn: true, icon: "info", title: t("p.answers.q"), chev: true, attr: 'id="answers-q"' }) +
      C.row({ href: "#", attr: "data-nolink", icon: "swap", title: t("p.swap") }) + C.row({ href: "#", attr: "data-nolink", icon: "globe", title: t("p.site") }) + "</section>" +
      '<section class="sec"><button type="button" class="link link--danger" id="logout">' + t("p.logout") + '</button><p class="cap">' + t("p.version", { v: M.version }) + "</p></section>";
    App.mount({ back: App.url("home.html"), title: t("p.title"), body: body });
    C.segBind("lang", function (v) { I.setLang(v); }); C.segBind("view", function () {});
    $("#addr").addEventListener("click", function () { App.copy(U.address, t("w.copied", { a: F.short(U.address) })); });
    $("#answers-q").addEventListener("click", function () { App.sheet.open('<h2 id="sheet-h">' + t("p.answers.q") + "</h2><p>" + t("p.answers.a") + '</p><button type="button" class="btn btn--plain" data-close>' + t("common.close") + "</button>"); });
    $("#name-save").addEventListener("click", function () {
      var v = $("#name").value.trim(), m = $("#name-msg"), err = v && (v.length < 2 || v.length > 20) ? t("p.name.e.len") : v && !/^[\p{L}\p{N} _.]+$/u.test(v) ? t("p.name.e.chars") : "";
      $("#name").toggleAttribute("aria-invalid", !!err); if (err) $("#name").setAttribute("aria-invalid", "true");
      m.className = "field-msg" + (err ? " field-msg--err" : ""); m.textContent = err || t("p.name.help"); if (!err) App.toast(t("p.name.saved"));
    });
    function logout() { App.sheet.open('<h2 id="sheet-h">' + t("p.logout.h") + "</h2><p>" + t("p.logout.b") + '</p><a class="btn" href="' + App.url("login.html") + '">' + t("p.logout") + '</a><button type="button" class="btn btn--plain" data-close>' + t("common.cancel") + "</button>"); }
    $("#logout").addEventListener("click", logout);
    if (st === "logout") logout();
    if (st === "saved") setTimeout(function () { App.toast(t("p.name.saved")); }, 300);
  };

  /* =====================================================================
     INVITE FRIENDS
     ===================================================================== */
  App.screens.invite = function () {
    var V = M.invite, hold = App.hold, empty = st === "empty", back = App.url("wallet.html");
    if (st === "loading") { App.mount({ back: back, title: t("inv.title"), body: C.skel([["90%", 68], ["100%", 96], ["100%", 76], ["100%", 120]]) }); return; }
    var body = '<div class="say"><h1>' + t("v.inv.h", { r: V.rate }) + "</h1><p>" + t("inv.hero.sub") + "</p></div>" +
      (hold ? '<section class="sec sec--tight">' + C.holdNote("hold.invite") + "</section>" : "") +
      (st === "error" ? '<section class="sec sec--tight">' + C.note(t("inv.error"), "alert", "danger") + "</section>" : "") +
      '<section class="sec sec--tight"><div class="blk eg" role="img" aria-label="' + esc(t("inv.ex.sr", { a: 350, b: 35 })) + '"><div><span>' + t("inv.ex.friend") + "</span><b>+350P</b></div>" + C.icon("right", 22) + '<div class="is-you"><span>' + t("inv.ex.you") + "</span><b>+35P</b></div></div></section>" +
      '<section class="sec"><div class="sec-h"><h2>' + t("inv.code.h") + '</h2></div><button type="button" class="code" id="code"' + (hold ? " disabled" : "") + "><b>" + V.code + "</b><span>" + C.icon("copy", 18) + t("common.copy") + '</span></button><button type="button" class="chipbtn" id="link" style="margin-top:8px"' + (hold ? " disabled" : "") + '><span class="addr">' + V.linkShort + "</span>" + C.icon("copy", 18) + "</button></section>" +
      '<section class="sec"><div class="sec-h"><h2>' + t("inv.how.h") + '</h2></div><ol class="steps"><li>' + t("inv.how.1") + "</li><li>" + t("inv.how.2", { w: V.welcome }) + "</li><li>" + t("inv.how.3", { r: V.rate }) + "</li></ol></section>" +
      (st === "error" ? "" : '<section class="sec"><div class="sec-h"><h2>' + t("inv.res.h") + '</h2></div><div class="blk trio"><div><span>' + t("inv.res.joined") + "</span><b>" + (empty ? 0 : V.joined) + "</b></div><div><span>" + t("inv.res.week") + "</span><b>+" + F.pts(empty ? 0 : V.week) + "</b></div><div><span>" + t("inv.res.total") + "</span><b>+" + F.pts(empty ? 0 : V.total) + "</b></div></div>" +
        (empty ? '<p class="lbl" style="margin-top:16px">' + t("inv.empty") + "</p>" : "") + "</section>" +
        (empty ? "" : '<section class="sec"><div class="sec-h"><h2>' + t("inv.friends.h") + "</h2></div>" + V.friends.map(function (f) { return C.row({ lead: '<span class="row-ic" aria-hidden="true"><b>' + esc(f.name.charAt(0).toUpperCase()) + "</b></span>", title: esc(f.name), sub: t("inv.st." + f.st), value: f.pts ? "+" + F.pts(Math.round(f.pts * V.rate / 100)) : '<small>' + t("inv.st.joined") + "</small>" }); }).join("") + "</section>")) +
      '<section class="sec"><div class="sec-h"><h2>' + t("inv.rules.h") + '</h2></div><ul class="bul">' + [1, 2, 3, 4].map(function (n) { return "<li>" + t("inv.rule." + n) + "</li>"; }).join("") + "</ul></section>";
    App.mount({ back: back, title: t("inv.title"), body: body, offText: "inv.offline", cta: '<button type="button" class="btn" id="share"' + (hold ? ' aria-disabled="true"' : "") + ">" + C.icon("share", 20) + t("inv.share") + "</button>" });
    $("#code").addEventListener("click", function () { App.copy(V.code); });
    $("#link").addEventListener("click", function () { App.copy(V.link, t("inv.linkcopied")); });
    $("#share").addEventListener("click", function () { if (hold) return; App.copy(V.link, t("inv.shared")); });
    if (st === "copied") setTimeout(function () { App.toast(t("inv.linkcopied")); }, 300);
  };
})();
