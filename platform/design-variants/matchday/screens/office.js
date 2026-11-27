/* Matchday, the club office: staking, my stakes, wallet, convert, profile, invite, account on hold. Same graphics system, no slants on actions, plain tables. */
(function () {
  "use strict";
  var A = window.App, T = A.t, M = A.M, $ = A.$, $$ = A.$$, esc = A.esc, fmt = A.fmt, IC = A.ic, ST = A.state, U = M.user;
  var S = {}, hold = ST === "hold", holdQ = hold ? "?state=hold" : "";
  function yellow(h, b, more) { return '<div class="notice" role="note"><i class="card-i y"></i>' + (h ? "<h2>" + h + "</h2>" : "") + "<p>" + b + "</p>" + (more ? '<a class="link" href="hold.html">' + T("hold.more") + "</a>" : "") + "</div>"; }
  function sw(cur) {
    return '<div class="seg" role="group" aria-label="' + T("s.switch") + '"><a href="staking.html' + holdQ + '"' + (cur === "new" ? ' aria-current="page"' : "") + ">" + T("s.new") + '</a><a href="stakes.html' + holdQ + '"' + (cur === "mine" ? ' aria-current="page"' : "") + ">" + T("s.mine", { n: M.stakes.length }) + "</a></div>";
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }

  /* ================= STAKING, new stake ================= */
  S.staking = function () {
    var main = A.shell({ screen: "staking", zone: "office", tab: "stake", title: T("s.title") });
    if (!main) return;
    var bal = ST === "zero" ? 0 : U.ct, days = 90, val = ST === "review" || ST === "done" ? "250" : "";
    A.put(main, '<div class="rise stack" style="gap:14px"><p class="dim" style="font-size:14px">' + T("s.sub") + "</p>" + sw("new") +
      (hold ? yellow(null, T("hold.stake"), true) : "") + (ST === "zero" ? '<div class="notice plain"><p>' + T("s.zero") + '</p><a class="link" href="wallet.html">' + T("tab.wallet") + "</a></div>" : "") +
      '<section class="panel ink-b"><div class="panel-h"><span class="label">' + T("s.avail") + '</span><span class="fig md">' + fmt(bal) + "<small>CT</small></span></div>" +
      '<div class="field"><label for="amt">' + T("s.amount") + "<span>" + T("s.min") + '</span></label><div class="inp" id="amt-w"><input id="amt" class="num" inputmode="decimal" placeholder="0" autocomplete="off" value="' + val + '"' + (hold ? " disabled" : "") + '><span class="unit">CT</span><button type="button" class="btn sm alt" id="max"' + (hold ? " disabled" : "") + ">" + T("s.max") + '</button></div><div id="amt-m" aria-live="polite"></div></div>' +
      '<div class="field"><span class="label">' + T("s.period") + '</span><div class="seg" id="per" role="group" aria-label="' + T("s.period") + '">' + [30, 90, 180, 365].map(function (d) { return '<button type="button" data-d="' + d + '" aria-pressed="' + (d === days) + '"><span class="num" style="font-size:20px">' + d + T("s.d") + '</span><small id="r' + d + '"></small></button>'; }).join("") + '</div><p class="msg" id="tier"></p></div></section>' +
      '<section class="panel"><dl class="kv"><div><dt>' + T("s.apr") + '</dt><dd class="num" id="apr"></dd></div><div><dt id="int-l"></dt><dd class="num" id="int"></dd></div><div><dt>' + T("s.unlock") + '</dt><dd id="unl"></dd></div></dl><p class="msg"><i class="card-i y"></i><span id="noexit"></span></p></section>' +
      '<div class="stack s6"><button class="btn wide" id="go"></button><p class="small dim" style="text-align:center">' + T("s.fee") + "</p></div>" +
      '<details class="q"><summary>' + T("s.help.q") + IC.down + '</summary><div class="q-b"><p>' + T("s.help.a") + '</p><div class="lgt" style="box-shadow:inset 0 0 0 1px var(--rule)"><div class="lg-h" style="grid-template-columns:1fr 1fr 1fr 1fr;padding:0 10px"><span style="text-align:left">' + T("s.th.lock") + "</span><span style='text-align:right'>" + T("s.th.1") + "</span><span>" + T("s.th.2") + "</span><span>" + T("s.th.3") + "</span></div>" +
      [30, 90, 180, 365].map(function (d) { return '<div class="lg-r" style="grid-template-columns:1fr 1fr 1fr 1fr;padding:0 10px;min-height:38px"><span style="text-align:left;color:var(--ink)">' + T("s.days", { d: d }) + "</span>" + M.rates[d].map(function (r) { return '<span class="lg-pts" style="text-align:right;color:var(--ink)">' + r + "%</span>"; }).join("") + "</div>"; }).join("") + "</div></div></details></div>");
    var inp = $("#amt"), btn = $("#go");
    function tier(a) { return a >= 10000 ? 2 : a >= 1000 ? 1 : 0; }
    function calc() {
      var raw = inp.value.trim(), a = parseFloat(raw), ok = false, msg = "", fix = null, label = T("s.btn.empty");
      if (raw === "") {} else if (!/^\d*\.?\d*$/.test(raw) || isNaN(a)) { msg = T("s.e.nan"); label = T("s.btn.nan"); }
      else if ((raw.split(".")[1] || "").length > 4) { msg = T("s.e.dec"); label = T("s.btn.dec"); fix = [T("s.fix.dec", { b: fmt(Math.floor(a * 1e4) / 1e4) }), Math.floor(a * 1e4) / 1e4]; }
      else if (a < M.minStake) { msg = T("s.e.min"); label = T("s.btn.min"); fix = [T("s.fix.min"), 100]; }
      else if (a > bal) { msg = T("s.e.bal", { b: fmt(bal) }); label = T("s.btn.bal"); fix = [T("s.fix.bal", { b: fmt(bal) }), bal]; }
      else { ok = true; label = T("s.btn", { a: fmt(a) }); }
      if (hold) { ok = false; label = T("hold.stake.btn"); msg = ""; }
      var t = tier(ok ? a : 0), rate = M.rates[days][t], unlock = addDays(new Date(), days);
      [30, 90, 180, 365].forEach(function (d) { $("#r" + d).textContent = M.rates[d][t] + "%"; });
      $("#apr").textContent = rate + "%"; $("#int-l").textContent = T("s.interest", { d: days });
      $("#int").textContent = ok ? "+" + fmt(a * rate / 100 * days / 365, 4) + " CT" : "0 CT"; $("#unl").textContent = A.date(unlock);
      $("#noexit").textContent = T("s.noexit", { date: A.date(unlock) }); $("#tier").textContent = T("s.tier.cue" + t);
      $("#amt-w").classList.toggle("bad", !!msg); inp.setAttribute("aria-invalid", !!msg);
      $("#amt-m").innerHTML = msg ? '<p class="msg bad"><i class="card-i r"></i><span>' + msg + "</span></p>" + (fix ? '<button type="button" class="link" id="fix">' + fix[0] + "</button>" : "") : "";
      var f = $("#fix"); if (f) f.onclick = function () { inp.value = fix[1]; calc(); };
      btn.textContent = label; btn.disabled = !ok; btn._a = a; btn._r = rate; btn._u = unlock;
    }
    inp.addEventListener("input", calc);
    $("#max").onclick = function () { inp.value = bal; calc(); };
    $("#per").addEventListener("click", function (e) { var b = e.target.closest("[data-d]"); if (!b) return; days = +b.getAttribute("data-d"); $$("#per button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); calc(); });
    function review() {
      var a = btn._a, sh = A.sheet(T("s.rv.h", { a: fmt(a), d: days }), '<dl class="kv"><div><dt>' + T("s.amount") + '</dt><dd class="num">' + fmt(a) + " CT</dd></div><div><dt>" + T("s.apr") + '</dt><dd class="num">' + btn._r + "%</dd></div><div><dt>" + T("s.interest", { d: days }) + '</dt><dd class="num">+' + fmt(a * btn._r / 100 * days / 365, 4) + " CT</dd></div><div><dt>" + T("s.unlock") + "</dt><dd>" + A.date(btn._u) + "</dd></div><div><dt>" + T("c.fee") + "</dt><dd>" + T("c.fee.v") + '</dd></div></dl><p class="notice"><i class="card-i y"></i><span>' + T("s.noexit", { date: A.date(btn._u) }) + '</span></p><div class="stack" id="rv-act"><button class="btn wide" id="cf">' + T("tx.confirm") + '</button><button class="btn alt wide" id="cc">' + T("common.cancel") + "</button></div>");
      $("#cc", sh).onclick = function () { A.closeSheet(); A.toast(T("s.cancelled")); };
      $("#cf", sh).onclick = function () { progress(sh, a); };
      if (ST === "done") progress(sh, a, true);
    }
    function progress(sh, a, instant) {
      $("#rv-act", sh).innerHTML = '<p style="font-weight:700">' + T("tx.sign.h") + '</p><p class="small dim">' + T("tx.sign.b") + '</p><ol class="setup"><li><span class="mk sm p">1</span><span>' + T("tx.step1", { a: fmt(a) }) + '</span><span class="st">' + T("tx.st.wait") + '</span></li><li><span class="mk sm p">2</span><span>' + T("tx.step2", { a: fmt(a) }) + '</span><span class="st">' + T("tx.st.wait") + "</span></li></ol>";
      var li = $$(".setup li", sh), i = 0;
      (function step() {
        if (i > 0) { li[i - 1].className = ""; $(".st", li[i - 1]).textContent = T("tx.st.done"); $(".mk", li[i - 1]).className = "mk sm w"; $(".mk", li[i - 1]).innerHTML = IC.check; }
        if (i === 2) { $("#rv-act", sh).insertAdjacentHTML("beforeend", '<p class="notice plain" role="status" style="font-weight:700;background:var(--win-tint)">' + T("s.ok.h", { a: fmt(a) }) + '</p><a class="btn wide" href="stakes.html">' + T("s.ok.btn") + "</a>"); return; }
        li[i].className = "now"; $(".st", li[i]).innerHTML = '<i class="spin"></i>'; i++; if (instant) step(); else setTimeout(step, 900);
      })();
    }
    btn.onclick = review; calc();
    if (ST === "review" || ST === "done") review();
  };

  /* ================= STAKING, my stakes ================= */
  S.stakes = function () {
    var main = A.shell({ screen: "stakes", zone: "office", tab: "stake", title: T("s.title") });
    if (!main) return;
    if (ST === "empty") { A.put(main, sw("mine").replace(/\(\d+\)/, "(0)") + '<div class="empty">' + A.art.board + '<h2 class="disp caps">' + T("m.empty.h") + "</h2><p>" + T("m.empty.b") + '</p><a class="btn" href="staking.html">' + T("m.empty.btn") + "</a></div>"); return; }
    var now = Date.now();
    function info(s) { var el = (now - s.start.getTime()) / 86400000, d = Math.min(s.days, el), unlocked = el >= s.days; return { d: d, unlocked: unlocked, int: s.amount * s.rate / 100 * d / 365, end: addDays(s.start, s.days) }; }
    var tot = 0, claim = 0; M.stakes.forEach(function (s) { var i = info(s); tot += i.int; if (i.unlocked || i.int >= M.minClaim) claim += i.int; });
    function cardOf(s) {
      var i = info(s), day = Math.min(s.days, Math.floor(i.d) + 1), fee = hold ? '<p class="small dim">' + T("hold.fee.line") + "</p>" : "";
      return '<article class="panel ink-b"><div class="panel-h"><span class="fig md">' + fmt(s.amount) + '<small>CT</small></span><span class="tag ' + (i.unlocked ? "win" : "") + '">' + (i.unlocked ? IC.check : IC.lock) + (i.unlocked ? T("m.unlocked") : T("m.locked")) + '</span></div><p style="font-weight:600;margin-top:-6px">' + T("m.card.period", { d: s.days, r: s.rate }) + "</p>" +
        '<div class="stack s6"><div class="bar' + (i.unlocked ? " done" : "") + '" role="img" aria-label="' + T("m.day", { x: day, d: s.days }) + '"><i style="transform:scaleX(' + (i.d / s.days).toFixed(3) + ')"></i></div><div class="row sb small dim"><span>' + T("m.day", { x: day, d: s.days }) + "</span><span>" + T("m.unlocks", { date: A.date(i.end) }) + "</span></div></div>" +
        '<dl class="kv"><div><dt>' + T("m.interest") + '</dt><dd class="num"' + (i.unlocked ? "" : ' data-live="' + s.id + '"') + ">" + fmt(i.int, i.unlocked ? 4 : 6) + " CT</dd></div><div><dt>" + T("m.started", { date: "" }).trim() + "</dt><dd>" + A.date(s.start) + "</dd></div></dl>" +
        (i.unlocked ? '<button class="btn wide" data-wd="' + s.id + '">' + T("m.withdraw", { a: fmt(s.amount + i.int, 2) }) + '</button><p class="small dim">' + T("m.withint", { p: fmt(s.amount), i: fmt(i.int, 2) }) + "</p>" + fee
          : i.int >= M.minClaim ? '<button class="btn wide" data-cl="' + s.id + '">' + T("m.claim", { i: fmt(i.int, 2) }) + "</button>" + fee : '<p class="msg">' + T("m.claim.gap", { g: fmt(M.minClaim - i.int, 2) }) + "</p>") + "</article>";
    }
    A.put(main, '<div class="rise stack" style="gap:14px">' + sw("mine") + (hold ? yellow(null, T("hold.stakes"), true) : "") +
      '<section class="board"><div class="stats"><div><p class="board-l">' + T("m.staked") + '</p><p class="board-n">' + fmt(U.staked) + '<small>CT</small></p></div><div><p class="board-l">' + T("m.sofar") + '</p><p class="board-n" id="tot" style="color:var(--on-board)">' + fmt(tot, 4) + '</p></div><div><p class="board-l">' + T("m.claimable") + '</p><p class="board-n" style="color:var(--on-board)">' + fmt(claim, 2) + "</p></div></div>" + (ST === "offline" ? "<hr><p>" + T("m.paused") + "</p>" : "") + "</section>" +
      M.stakes.map(cardOf).join("") +
      '<details class="q"><summary>' + T("m.closed.q", { n: M.stakesClosed.length }) + IC.down + '</summary><div class="q-b">' + M.stakesClosed.map(function (s) { return '<dl class="kv"><div><dt>' + fmt(s.amount) + " CT, " + T("m.card.period", { d: s.days, r: s.rate }) + "</dt><dd>" + T("m.paidout", { a: fmt(s.paid, 2) }) + "</dd></div></dl>"; }).join("") + "</div></details></div>");
    if (ST !== "offline" && !A.rm) setInterval(function () {
      var t = 0; M.stakes.forEach(function (s) { var el = (Date.now() - s.start.getTime()) / 86400000, d = Math.min(s.days, el), v = s.amount * s.rate / 100 * d / 365; t += v; var n = $('[data-live="' + s.id + '"]'); if (n) n.textContent = fmt(v, 6) + " CT"; });
      $("#tot").textContent = fmt(t, 4);
    }, 1000);
    main.addEventListener("click", function (e) {
      var w = e.target.closest("[data-wd]"), c = e.target.closest("[data-cl]"), b = w || c; if (!b) return;
      if (hold && U.kaia < M.fee) { A.toast(T("hold.nokaia", { f: M.fee, k: U.kaia })); return; }
      b.disabled = true; b.innerHTML = '<i class="spin"></i>' + T("tx.send.h");
      setTimeout(function () { var p = b.closest(".panel"); A.toast(w ? T("m.ok.wd", { a: b.textContent.replace(/[^\d.,]/g, "") || "501.97" }) : T("m.ok.claim", { i: "" })); if (w) { p.style.transition = "opacity 260ms linear, transform 260ms cubic-bezier(.5,0,.9,.3)"; p.style.opacity = 0; p.style.transform = "translateX(-24px)"; setTimeout(function () { p.remove(); }, 280); } }, 1100);
    });
  };

  /* ================= WALLET ================= */
  S.wallet = function () {
    var main = A.shell({ screen: "wallet", zone: "office", tab: "wallet", title: T("w.title") });
    if (!main) return;
    var can = Math.floor(U.points / 1000);
    A.put(main, '<div class="rise stack" style="gap:14px">' + (hold ? yellow(T("hold.t"), T("hold.wallet"), true) : "") +
      '<section class="board"><div class="board-split"><div><p class="board-l">' + T("w.points") + '</p><p class="board-n"><span id="pts">' + fmt(U.points) + '</span><small>P</small></p></div>' +
      (hold ? '<span class="btn sm" aria-disabled="true">' + T("hold.convert.btn") + "</span>" : '<a class="btn sm" href="convert.html" style="background:var(--bulb);color:var(--ink)">' + T("w.convert") + "</a>") + "</div><hr><p>" + (can ? T("w.ready", { n: can }) : T("w.notyet", { g: 1000 - U.points })) + '</p><div class="row sb" style="margin-top:8px"><span class="board-l">' + T("w.onway") + '</span><span style="font-size:14px;font-weight:600">' + T("w.pendinghit", { p: U.pendingHit, time: "22:10" }) + "</span></div></section>" +
      '<section class="panel ink-b"><div class="panel-h"><span class="label">CT</span>' + A.krw(U.ct + U.staked) + '</div><p class="fig" style="margin-top:-6px">' + fmt(U.ct + U.staked) + '<small>CT</small></p><dl class="kv"><div><dt>' + T("w.avail") + '</dt><dd class="num">' + fmt(U.ct) + " CT</dd></div><div><dt>" + T("w.staked") + '</dt><dd class="num">' + fmt(U.staked) + ' CT</dd></div><div><dt>KAIA</dt><dd class="num">' + U.kaia + " KAIA<small>" + (hold ? T("hold.kaia.note") : T("w.kaia.note")) + '</small></dd></div></dl><div class="row"><button class="btn alt grow" id="dep">' + T("w.deposit") + '</button><button class="btn alt grow" id="wd">' + T("w.withdraw") + "</button></div></section>" +
      '<section class="panel"><span class="label">' + T("w.addr") + '</span><p class="addr" style="font-size:14px">' + U.address + '</p><div class="row"><button class="btn sm alt grow" data-copy="' + U.address + '" data-copied="' + esc(T("w.copied", { a: U.address })) + '">' + IC.copy + T("w.copy") + '</button><a class="btn sm alt grow" href="#" role="button">' + IC.ext + T("w.scan") + '</a></div><p class="small dim">' + T("w.addr.note") + "</p></section>" +
      '<div class="menu"><a href="invite.html' + holdQ + '">' + IC.gift + '<span class="grow">' + T("w.invite") + '</span><b class="num" style="font-size:20px">+' + M.invite.week + "P</b>" + IC.right + "</a></div>" +
      '<details class="q"><summary>' + T("w.info") + IC.down + '</summary><div class="q-b"><p>' + T("w.token") + '</p><p class="addr" style="color:var(--ink)">' + M.token + '</p><button class="btn sm alt" data-copy="' + M.token + '" data-copied="' + esc(T("w.token.copied")) + '">' + IC.copy + T("w.token.copy") + "</button></div></details></div>");
    function deposit() {
      A.sheet(T("dp.title"), "<p>" + T("dp.lead") + '</p><div style="display:grid;place-items:center;padding:8px;box-shadow:inset 0 0 0 1.5px var(--ink);border-radius:var(--r)">' + A.qr(U.address) + '</div><p class="addr" style="font-size:14px;text-align:center">' + U.address + '</p><div class="row"><button class="btn grow" data-copy="' + U.address + '" data-copied="' + esc(T("w.copied", { a: U.address })) + '">' + IC.copy + T("w.copy") + '</button><button class="btn alt grow" id="shr">' + IC.share + T("dp.share") + '</button></div><dl class="kv"><div><dt>' + T("dp.net") + "</dt><dd>" + T("dp.net.v") + "</dd></div><div><dt>" + T("dp.token") + "</dt><dd>" + T("dp.token.v") + ', KAIA</dd></div></dl><div class="notice"><i class="card-i y"></i><p>' + T("dp.w1") + "</p><p>" + T("dp.w2") + "</p><p>" + T("dp.w3") + '</p></div><p class="msg" role="status"><i class="spin"></i><span>' + T("dp.watch") + "</span></p>");
    }
    function withdraw() {
      var sh = A.sheet(T("x.title"), '<div class="notice"><i class="card-i y"></i><p>' + T("x.gas") + '</p></div><dl class="kv"><div><dt>' + T("x.kaia") + '</dt><dd class="num">' + U.kaia + ' KAIA</dd></div></dl><div class="field"><label for="to">' + T("x.to") + '</label><div class="inp" id="to-w"><input id="to" class="addr" style="font-size:14px" placeholder="0x" autocomplete="off" spellcheck="false"><button type="button" class="btn sm alt" id="pst">' + T("x.paste") + '</button></div><div id="to-m" aria-live="polite"></div></div>' +
        '<div class="field"><label for="xa">' + T("x.amount") + "<span>" + T("x.avail", { c: fmt(U.ct) }) + '</span></label><div class="inp"><input id="xa" class="num" inputmode="decimal" placeholder="0"><span class="unit">CT</span><button type="button" class="btn sm alt" id="xmax">' + T("s.max") + '</button></div></div><dl class="kv"><div><dt>' + T("x.fee") + "</dt><dd>" + T("x.fee.v", { f: M.fee }) + '</dd></div></dl><label class="row" style="min-height:44px;font-size:14px;align-items:flex-start"><input type="checkbox" id="chk" style="width:24px;height:24px;flex:none;accent-color:var(--ink);margin:0"><span>' + T("x.rv.check") + '</span></label><button class="btn wide" id="xgo" disabled>' + T("x.btn.empty") + "</button>");
      var to = $("#to", sh), xa = $("#xa", sh), go = $("#xgo", sh);
      function chk() {
        var v = to.value.trim(), a = parseFloat(xa.value), msg = "";
        if (v && !/^0x[0-9a-fA-F]{40}$/.test(v)) msg = T("x.e.bad"); else if (v.toLowerCase() === U.address.toLowerCase()) msg = T("x.e.own"); else if (M.contracts.indexOf(v.toLowerCase()) >= 0) msg = T("x.e.contract");
        $("#to-w", sh).classList.toggle("bad", !!msg);
        $("#to-m", sh).innerHTML = msg ? '<p class="msg bad"><i class="card-i r"></i><span>' + msg + "</span></p>" : v ? '<p class="msg">' + IC.check.replace("<svg", '<svg width="18" height="18" style="flex:none"') + "<span>" + T("x.addr.ok") + "</span></p>" : "";
        var ok = v && !msg && a > 0 && a <= U.ct && $("#chk", sh).checked;
        go.disabled = !ok; go.textContent = a > 0 && v && !msg ? T("x.btn", { a: fmt(a) }) : T("x.btn.empty");
      }
      sh.addEventListener("input", chk); sh.addEventListener("change", chk);
      $("#pst", sh).onclick = function () { to.value = "0x4f2aB07c91E5d4086aB17c93D5E0f6A2948b91bc"; chk(); };
      $("#xmax", sh).onclick = function () { xa.value = U.ct; chk(); };
      go.onclick = function () { var a = parseFloat(xa.value); go.disabled = true; go.innerHTML = '<i class="spin"></i>' + T("tx.send.h"); setTimeout(function () { A.closeSheet(); A.toast(T("x.ok", { a: fmt(a) })); }, 1200); };
    }
    $("#dep").onclick = deposit; $("#wd").onclick = withdraw;
    if (ST === "deposit") deposit(); if (ST === "withdraw") withdraw();
  };

  /* ================= CONVERT ================= */
  S.convert = function () {
    var pts = ST === "short" ? 650 : U.points;
    var main = A.shell({ screen: "convert", zone: "office", tab: "wallet", back: "wallet.html" + holdQ, title: T("c.title"), points: pts });
    if (!main) return;
    var head = '<section class="board"><p class="board-l">' + T("c.avail") + '</p><p class="board-n"><span id="av">' + fmt(pts) + "</span><small>P</small></p></section>";
    if (ST === "short") { A.put(main, '<div class="rise stack" style="gap:14px">' + head + '<div class="notice plain"><h2>' + T("c.short.h") + "</h2><p>" + T("c.short.b", { p: fmt(pts), g: fmt(1000 - pts) }) + '</p></div><div class="bar" role="img" aria-label="' + pts + ' / 1000"><i style="transform:scaleX(' + pts / 1000 + ')"></i></div><a class="btn wide" href="home.html">' + T("k.play") + "</a></div>"); return; }
    if (ST === "wait") { var d = U.firstConvert, left = (d - Date.now()) / 3600000; A.put(main, '<div class="rise stack" style="gap:14px">' + head + '<div class="notice"><i class="card-i y"></i><h2>' + T("c.wait.h", { date: A.date(d) }) + "</h2><p>" + T("c.wait.b", { date: A.date(d) }) + '</p></div><section class="panel"><dl class="kv"><div><dt>' + T("c.wait.left", { d: Math.floor(left / 24), h: Math.floor(left % 24) }) + "</dt><dd>" + A.date(d) + '</dd></div><div><dt>' + T("c.rate") + '</dt><dd>1,000P = 1 CT</dd></div></dl></section><button class="btn wide" disabled>' + T("c.btn.empty") + "</button></div>"); return; }
    if (hold) { A.put(main, '<div class="rise stack" style="gap:14px">' + head + yellow(T("hold.convert.btn"), T("hold.convert"), true) + '<button class="btn wide" disabled>' + T("hold.convert.btn") + "</button></div>"); return; }
    var v = 1000;
    A.put(main, '<div class="rise stack" style="gap:14px">' + head +
      '<section class="panel ink-b"><div class="field"><label for="cv">' + T("c.amount") + "<span>" + T("c.step") + '</span></label><div class="inp" id="cv-w"><button type="button" class="btn sm alt" id="mn" style="margin-left:6px;width:44px;padding:0" aria-label="-1,000P">' + IC.minus + '</button><input id="cv" class="num" inputmode="numeric" value="1000" style="text-align:center"><span class="unit">P</span><button type="button" class="btn sm alt" id="pl" style="width:44px;padding:0" aria-label="+1,000P">' + IC.plus + '</button></div><div id="cv-m" aria-live="polite"></div></div>' +
      '<div class="panel-h" style="border-top:1.5px solid var(--ink);padding-top:12px"><span style="font-weight:700">' + T("c.get") + '</span><span class="fig"><span id="get">1</span><small>CT</small></span></div></section>' +
      '<section class="panel"><dl class="kv"><div><dt>' + T("c.rate") + "</dt><dd>1,000P = 1 CT</dd></div><div><dt>" + T("c.minimum") + "</dt><dd>1,000P</dd></div><div><dt>" + T("c.fee") + "</dt><dd>" + T("c.fee.v") + "</dd></div><div><dt>" + T("c.capleft") + "</dt><dd>" + T("c.capof", { n: 50 }) + '</dd></div></dl></section><p class="small dim">' + T("c.rank") + '</p><button class="btn wide" id="cgo"></button><div id="ok"></div></div>');
    var inp = $("#cv"), go = $("#cgo");
    function calc() {
      v = parseInt(inp.value.replace(/\D/g, ""), 10) || 0; var msg = "", fix = 0;
      if (!v) {} else if (v > pts) { msg = T("c.e.bal", { p: fmt(pts) }); fix = Math.floor(pts / 1000) * 1000; } else if (v < 1000) { msg = T("c.e.min"); fix = 1000; } else if (v % 1000) { fix = Math.floor(v / 1000) * 1000; msg = T("c.e.step", { f: fmt(fix) }); }
      $("#cv-w").classList.toggle("bad", !!msg);
      $("#cv-m").innerHTML = msg ? '<p class="msg bad"><i class="card-i r"></i><span>' + msg + "</span></p>" + (fix ? '<button type="button" class="link" id="cfix">' + T("c.fix", { f: fmt(fix) }) + "</button>" : "") : "";
      var f = $("#cfix"); if (f) f.onclick = function () { inp.value = fix; calc(); };
      var ok = v && !msg; $("#get").textContent = ok ? v / 1000 : 0; go.disabled = !ok; go.textContent = ok ? T("c.btn", { p: fmt(v), n: v / 1000 }) : T("c.btn.empty");
    }
    inp.addEventListener("input", calc);
    $("#mn").onclick = function () { inp.value = Math.max(0, (Math.floor(v / 1000) - 1) * 1000); calc(); };
    $("#pl").onclick = function () { inp.value = (Math.floor(v / 1000) + 1) * 1000; calc(); };
    function done(instant) {
      var n = v / 1000; go.hidden = true;
      $("#ok").innerHTML = '<div class="notice plain" role="status" style="background:var(--win-tint)"><h2>' + T("c.ok.h", { p: fmt(v), n: n }) + '</h2><dl class="kv" style="margin-top:8px"><div><dt>' + T("c.ok.left") + '</dt><dd class="num">' + fmt(pts - v) + "P</dd></div><div><dt>" + T("c.ok.ct") + '</dt><dd class="num">' + fmt(U.ct + n) + ' CT</dd></div></dl></div><a class="btn alt wide" style="margin-top:10px" href="wallet.html">' + T("common.done") + "</a>";
      A.roll($("#av"), pts, pts - v, instant ? 0 : 600); A.roll($("#bug-n"), pts, pts - v, instant ? 0 : 600);
    }
    go.onclick = function () { go.disabled = true; go.innerHTML = '<i class="spin"></i>' + T("c.chip", { p: fmt(v) }); setTimeout(done, 1000); };
    calc(); if (ST === "ok") done(true);
  };

  /* ================= PROFILE ================= */
  S.profile = function () {
    var main = A.shell({ screen: "profile", zone: "office", notabs: false, tab: "", back: "home.html" + holdQ, title: T("p.title") });
    if (!main) return;
    var hoursLeft = Math.max(1, Math.round(24 - (Date.now() - U.signedUp.getTime()) / 3600000));
    A.put(main, '<div class="rise stack" style="gap:14px">' +
      '<section class="board"><span class="lt bulb" style="margin:-14px 0 10px -16px">' + T("md.club") + '</span><h2 class="disp" style="font-size:40px;line-height:1">' + esc(U.name) + '</h2><p>' + T("p.login", { email: U.email }) + '</p><hr><div class="stats" style="grid-template-columns:1fr 1fr"><div><p class="board-l">' + T("p.rank") + '</p><p class="board-n">' + (hold ? "–" : T("k.rankth", { n: M.me.rank })) + '</p></div><div><p class="board-l">' + T("p.pts") + '</p><p class="board-n">' + fmt(U.points) + "<small>P</small></p></div></div></section>" +
      (hold ? '<a class="notice" href="hold.html" style="text-decoration:none"><i class="card-i y"></i><h2>' + T("hold.t") + "</h2><p>" + T("hold.profile.sub") + "</p></a>" : "") +
      '<div class="menu"><a href="invite.html' + holdQ + '">' + IC.gift + '<span class="grow"><b>' + T("inv.entry") + "</b><small>" + T("inv.entry.sub", { r: M.invite.rate }) + "</small></span>" + IC.right + '</a><button id="code">' + IC.plus + '<span class="grow"><b>' + T("p.code") + "</b><small>" + T("p.code.left", { h: hoursLeft }) + "</small></span>" + IC.right + "</button></div>" +
      '<section class="panel"><h2 class="h2 disp">' + T("p.account") + '</h2><div class="field"><label for="nm">' + T("p.name") + '</label><div class="inp"><input id="nm" value="' + esc(U.name) + '" maxlength="20" autocomplete="off"><button class="btn sm ink" id="nms" type="button">' + T("p.name.save.short") + '</button></div><p class="msg" id="nm-m">' + T("p.name.help") + '</p></div><dl class="kv"><div><dt>' + T("p.wallet") + '</dt><dd class="addr">' + U.address + "</dd></div><div><dt>" + T("p.device") + "</dt><dd>" + T("p.device.ready") + "<small>" + T("p.device.until", { date: A.date(M.ahead(26)) }) + '</small></dd></div></dl><button class="btn sm alt" data-copy="' + U.address + '" data-copied="' + esc(T("w.copied", { a: U.address })) + '">' + IC.copy + T("w.copy") + "</button></section>" +
      '<section class="panel"><h2 class="h2 disp">' + T("p.prefs") + '</h2><div class="field"><span class="label">' + T("lang.label") + "</span>" + A.langSwitch() + '</div><div class="field"><span class="label">' + T("p.view") + '</span><div class="seg" id="vw" role="group" aria-label="' + T("p.view") + '" style="max-width:300px"><button aria-pressed="true">' + T("h.view.card") + '</button><button aria-pressed="false">' + T("h.view.term") + "</button></div></div></section>" +
      '<div class="menu"><a href="first-run.html">' + IC.info + '<span class="grow">' + T("p.how") + "</span>" + IC.right + '</a><button id="ans">' + IC.info + '<span class="grow">' + T("p.answers.q") + "</span>" + IC.right + '</button><a href="https://cojam.app">' + IC.ext + '<span class="grow">' + T("p.swap") + "</span>" + IC.right + '</a><a href="https://cojam.app">' + IC.ext + '<span class="grow">' + T("p.site") + "</span>" + IC.right + "</a></div>" +
      '<button class="btn alt wide" id="out">' + IC.logout + T("p.logout") + '</button><div class="row sb small dim"><span>' + T("p.version", { v: M.version }) + '</span><button class="link" id="upd" style="font-size:13px">' + T("p.update") + "</button></div></div>");
    $("#vw").onclick = function (e) { var b = e.target.closest("button"); if (b) $$("#vw button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
    $("#nms").onclick = function () { var v = $("#nm").value.trim(), m = $("#nm-m"), err = v && (v.length < 2 || v.length > 20) ? T("p.name.e.len") : /[^\w .぀-ヿ一-鿿가-힣]/.test(v) ? T("p.name.e.chars") : /^0x|cojam|admin/i.test(v) ? T("p.name.e.staff") : ""; m.className = "msg" + (err ? " bad" : ""); m.innerHTML = err ? '<i class="card-i r"></i><span>' + err + "</span>" : T("p.name.help"); if (!err) A.toast(T("p.name.saved")); };
    $("#upd").onclick = function () { A.toast(T("p.uptodate")); };
    $("#ans").onclick = function () { A.sheet(T("p.answers.q"), "<p>" + T("p.answers.a") + '</p><button class="btn ink wide" onclick="App.closeSheet()">' + T("common.done") + "</button>"); };
    function logout() { var sh = A.sheet(T("p.logout.h"), "<p>" + T("p.logout.b") + '</p><div class="stack"><a class="btn ink wide" href="login.html">' + T("p.logout") + '</a><button class="btn alt wide" onclick="App.closeSheet()">' + T("common.cancel") + "</button></div>"); }
    function code() {
      var sh = A.sheet(T("p.code.h"), "<p>" + T("p.code.lead") + '</p><div class="field"><label for="pc">' + T("p.code.label") + '</label><div class="inp"><input id="pc" maxlength="8" autocapitalize="characters" placeholder="' + T("o.code.ph") + '" value="' + (ST === "code" ? "DALGONA4" : "") + '"></div><div id="pc-m" aria-live="polite"></div></div><button class="btn wide" id="pcl" disabled>' + T("p.code.link") + "</button>");
      function chk() { var v = $("#pc", sh).value.trim().toUpperCase(), k = M.invite.known[v]; $("#pcl", sh).disabled = !k; $("#pc-m", sh).innerHTML = !v ? "" : k ? '<p class="msg">' + IC.check.replace("<svg", '<svg width="18" height="18" style="flex:none"') + "<span>" + T("p.code.ok", { name: k }) + "</span></p>" : v.length >= 6 ? '<p class="msg bad"><i class="card-i r"></i><span>' + T("o.code.unknown") + "</span></p>" : ""; }
      $("#pc", sh).addEventListener("input", chk); chk();
      $("#pcl", sh).onclick = function () { A.closeSheet(); A.toast(T("p.code.done", { name: "dalgona" })); };
    }
    $("#out").onclick = logout; $("#code").onclick = code;
    if (ST === "logout") logout(); if (ST === "code") code();
  };

  /* ================= INVITE ================= */
  S.invite = function () {
    var main = A.shell({ screen: "invite", zone: "office", tab: "", back: "profile.html" + holdQ, title: T("inv.title") });
    if (!main) return;
    var V = M.invite, empty = ST === "empty";
    A.put(main, '<div class="rise stack" style="gap:14px">' +
      '<section class="board"><h2 class="disp" style="font-size:calc(34px * var(--ds))">' + T("inv.hero.line", { r: V.rate }) + '</h2><p style="margin-top:6px">' + T("inv.hero.sub") + '</p><hr><div class="row sb" role="img" aria-label="' + T("inv.ex.sr", { a: 350, b: 35 }) + '"><div><p class="board-l">' + T("inv.ex.friend") + '</p><p class="board-n" style="color:var(--on-board)">350<small>P</small></p></div><span style="color:var(--on-board-2)">' + IC.ar.replace("<svg", '<svg width="28" height="28"') + '</span><div style="text-align:right"><p class="board-l">' + T("inv.ex.you") + '</p><p class="board-n">+35<small>P</small></p></div></div></section>' +
      (hold ? yellow(T("hold.t"), T("hold.invite") + " " + T("hold.invite.bonus"), true)
        : '<section class="panel ink-b"><span class="label">' + T("inv.code.h") + '</span><p class="fig" style="letter-spacing:.06em">' + V.code + '</p><p class="addr">' + V.linkShort + '</p><div class="stack"><button class="btn wide" id="shr">' + IC.share + T("inv.share") + '</button><button class="btn alt wide" data-copy="' + V.link + '" data-copied="' + T("inv.linkcopied") + '">' + IC.copy + T("inv.copylink") + "</button></div></section>") +
      '<section class="panel"><h2 class="h2 disp">' + T("inv.how.h") + '</h2><ol class="steps"><li>' + T("inv.how.1") + "</li><li>" + T("inv.how.2", { w: V.welcome }) + "</li><li>" + T("inv.how.3", { r: V.rate }) + "</li></ol></section>" +
      '<section class="panel"><h2 class="h2 disp">' + T("inv.res.h") + '</h2><dl class="kv"><div><dt>' + T("inv.res.joined") + '</dt><dd class="num">' + (empty ? 0 : V.joined) + "</dd></div><div><dt>" + T("inv.res.week") + '</dt><dd class="num">+' + (empty ? 0 : V.week) + "P</dd></div><div><dt>" + T("inv.res.total") + '</dt><dd class="num">+' + (empty ? 0 : fmt(V.total)) + "P</dd></div></dl>" +
      (empty ? '<p class="notice plain">' + T("inv.empty") + "</p>" : '<p class="label" style="margin-top:4px">' + T("inv.friends.h") + '</p><dl class="kv">' + V.friends.map(function (f) { return '<div style="align-items:center"><dt style="color:var(--ink);font-weight:600;display:flex;gap:8px;align-items:center;max-width:70%">' + esc(f.name) + '<span class="tag' + (f.st === "first" ? " win" : "") + '">' + T("inv.st." + f.st) + '</span></dt><dd class="num">+' + fmt(f.pts) + "P</dd></div>"; }).join("") + "</ul>") + "</section>" +
      '<section class="panel"><h2 class="h2 disp">' + T("inv.rules.h") + '</h2><ul class="ticks">' + [1, 2, 3, 4].map(function (i) { return "<li>" + IC.check + "<span>" + T("inv.rule." + i) + "</span></li>"; }).join("") + "</ul></section></div>");
    var s = $("#shr"); if (s) s.onclick = function () { A.toast(T("inv.shared")); };
  };

  /* ================= ACCOUNT ON HOLD ================= */
  S.hold = function () {
    var main = A.shell({ screen: "hold", zone: "office", tab: "", back: "home.html?state=hold", title: T("hold.t") });
    if (!main) return;
    A.put(main, '<div class="rise stack" style="gap:14px"><section class="panel ink-b" style="background:var(--caution-tint)"><div class="row" style="align-items:flex-start;gap:14px"><i class="card-i y" style="width:34px;height:48px;border-radius:3px;margin-top:4px"></i><div class="grow"><h2 class="disp caps" style="font-size:calc(32px * var(--ds))">' + T("sys.blocked.h") + '</h2><p style="margin-top:6px">' + T("sys.blocked.b") + "</p></div></div></section>" +
      '<section class="panel"><h2 class="h2 disp">' + T("sys.blocked.works.h") + '</h2><ul class="ticks">' + [1, 2, 3, 4].map(function (i) { return "<li>" + IC.check.replace("<svg", '<svg style="color:var(--win)"') + "<span>" + T("sys.blocked.works." + i) + "</span></li>"; }).join("") + '</ul><p class="msg"><i class="card-i y"></i><span>' + T("sys.blocked.fee") + "</span></p></section>" +
      '<section class="panel"><h2 class="h2 disp">' + T("sys.blocked.stops.h") + '</h2><ul class="ticks">' + [1, 2, 3, 4, 5].map(function (i) { return "<li>" + IC.cross + "<span>" + T("sys.blocked.stops." + i) + "</span></li>"; }).join("") + "</ul></section>" +
      '<div class="stack"><a class="btn wide" href="wallet.html?state=hold">' + T("sys.blocked.btn") + '</a><button class="btn alt wide" data-copy="support@cojam.app" data-copied="' + T("common.copied") + '">' + T("sys.blocked.contact") + '</button><p class="small dim" style="text-align:center">' + T("sys.blocked.note") + "</p></div></div>");
  };

  var name = document.body.getAttribute("data-screen"); if (S[name]) S[name]();
})();
