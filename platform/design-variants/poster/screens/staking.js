/* Staking: new stake (staking.html) and my stakes (stakes.html). Money screens stay plain: one figure, the facts, one action. */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state, fmt = A.fmt;
  var mine = document.body.getAttribute("data-page") === "stakes", hold = st === "hold";
  function head() {
    return '<div class="ph" style="padding-bottom:12px"><h1 class="ph-t d' + (A.lang === "en" ? "" : " is-long") + '">' + t("s.title") + '</h1><p class="ph-s">' + t("s.sub") + "</p></div>" +
      '<div class="pad"><div class="seg" role="tablist" aria-label="' + t("s.switch") + '"><a role="tab" href="staking.html" aria-selected="' + !mine + '">' + t("s.new") + '</a><a role="tab" href="stakes.html" aria-selected="' + mine + '">' + t("s.tab.mine") + '<span class="cnt">' + (st === "empty" ? 0 : M.stakes.length) + "</span></a></div></div>";
  }
  if (st === "loading") return A.shell({ tab: "stake", body: head() + A.skeleton() });
  if (st === "error") return A.shell({ tab: "stake", body: head() + A.errBlock() });

  /* ---------- my stakes ---------- */
  if (mine) {
    if (st === "empty") return A.shell({ tab: "stake", body: head() + A.stateBlock("0", t("m.empty.h"), t("m.empty.b"), '<a class="btn btn-p" href="staking.html"><span>' + t("m.empty.btn") + "</span>" + A.ICON.go + "</a>") });
    var now = Date.now(), DAY = 86400000, totalInt = 0, claimable = 0;
    var rows = M.stakes.map(function (s) {
      var el = Math.min(s.days, (now - s.start.getTime()) / DAY), full = s.amount * s.rate / 100 * s.days / 365, sofar = full * el / s.days, unlocked = el >= s.days;
      totalInt += sofar; if (sofar >= M.minClaim || unlocked) claimable += sofar;
      var end = new Date(s.start.getTime() + s.days * DAY);
      return '<li class="stake"><div class="stake-hd"><div><span class="fig-l">' + t("m.card.period", { d: s.days, r: s.rate }) + '</span><span class="fig-v">' + fmt(s.amount) + '<small>CT</small></span></div>' +
        '<span class="chip ' + (unlocked ? "chip-y" : "chip-o") + '">' + t(unlocked ? "m.unlocked" : "m.locked") + "</span></div>" +
        '<div class="stake-bar" role="img" aria-label="' + t("m.day", { x: Math.floor(el), d: s.days }) + '"><i style="transform:scaleX(' + (el / s.days).toFixed(3) + ')"></i></div>' +
        '<div class="stake-meta"><span>' + t("m.day", { x: Math.floor(el), d: s.days }) + "</span><span>" + t(unlocked ? "m.started" : "m.unlocks", { date: A.date(unlocked ? s.start : end) }) + "</span></div>" +
        '<dl style="margin-top:8px"><div class="kv"><dt>' + t("m.interest") + '</dt><dd><span data-int="' + s.id + '">' + fmt(sofar, 4) + "</span> CT</dd></div></dl>" +
        (unlocked ? '<button type="button" class="btn btn-p" data-act="wd"><span>' + t("m.withdraw", { a: fmt(s.amount + full, 2) }) + "</span>" + A.ICON.go + '</button><p class="sub" style="margin-top:6px">' + t("m.withint", { p: fmt(s.amount), i: fmt(full, 2) }) + "</p>"
          : sofar >= M.minClaim ? '<button type="button" class="btn btn-s" data-act="claim"><span>' + t("m.claim", { i: fmt(sofar, 2) }) + "</span></button>"
          : '<p class="sub" style="margin-top:8px">' + t("m.claim.gap", { g: fmt(M.minClaim - sofar, 2) }) + "</p>") + "</li>";
    }).join("");
    var c = M.stakesClosed[0];
    var b2 = head() + (hold ? A.holdNote("hold.stakes") : "") +
      '<section class="sec is-bare" style="padding-top:20px"><span class="fig-l">' + t("m.staked") + '</span><span class="fig-v is-hero"><span data-roll="' + M.user.staked + '"></span><small>CT</small></span>' +
      '<div class="duo" style="margin-top:16px"><div><span class="fig-l">' + t("m.sofar") + '</span><span class="fig-v is-mid">' + fmt(totalInt, 4) + '<small>CT</small></span></div><div><span class="fig-l">' + t("m.claimable") + '</span><span class="fig-v is-mid">' + fmt(claimable, 2) + "<small>CT</small></span></div></div></section>" +
      '<ol class="pad">' + rows + "</ol>" +
      '<section class="sec"><details class="disc" style="border-top:0"><summary>' + t("m.closed.q", { n: 1 }) + '</summary><div class="disc-b"><dl><div class="kv"><dt>' + fmt(c.amount) + " CT, " + t("m.card.period", { d: c.days, r: c.rate }) + "</dt><dd>" + t("m.paidout", { a: fmt(c.paid, 2) }) + "</dd></div></dl></div></details></section>";
    A.shell({ tab: "stake", body: b2 });
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return; var label = b.querySelector("span").textContent;
      A.sheet(t("tx.review.h"), '<dl><div class="kv"><dt>' + t("x.rv.to") + "</dt><dd>" + A.short(M.user.address) + '</dd></div><div class="kv"><dt>' + t("c.fee") + "</dt><dd>" + (hold ? t("hold.fee.line") : t("c.fee.v")) + '</dd></div></dl><div style="margin-top:14px"><button type="button" class="btn btn-p" data-close><span>' + esc(label) + '</span></button><button type="button" class="btn btn-s" data-close><span>' + t("common.cancel") + "</span></button></div>");
    });
    return;
  }

  /* ---------- new stake ---------- */
  var amount = st === "errmin" ? 50 : st === "errbal" ? 5000 : 500, days = 90, bal = M.user.ct;
  function tier(a) { return a >= 10000 ? 2 : a >= 1000 ? 1 : 0; }
  var endOf = function () { return new Date(Date.now() + days * 86400000); };
  var body = head() + (hold ? A.holdNote("hold.stake") : "") +
    '<section class="sec is-bare" style="padding-top:18px;padding-bottom:14px"><label class="field" id="f"><span class="field-l"><span>' + t("s.amount") + '</span><span>' + t("s.avail") + " <b>" + fmt(bal) + ' CT</b></span></span>' +
      '<span class="field-box"><input id="amt" inputmode="decimal" autocomplete="off" value="' + amount + '" aria-describedby="msg"><span class="unit">CT</span><button type="button" class="field-act" id="max">' + t("s.max") + "</button></span>" +
      '<p class="field-msg" id="msg" role="status"></p></label></section>' +
    '<section class="sec" style="padding-top:12px"><span class="field-l">' + t("s.period") + '</span><div class="opts" role="radiogroup" aria-label="' + t("s.period") + '" id="opts"></div></section>' +
    '<section class="sec"><div class="pool"><div><span class="fig-l" id="int-l"></span><span class="fig-v is-hero" style="font-size:3.5rem"><span id="int"></span><small>CT</small></span></div>' +
      '<div style="text-align:right"><span class="fig-l">' + t("s.apr") + '</span><span class="fig-v is-mid" id="apr"></span></div></div>' +
      '<dl style="margin-top:14px"><div class="kv"><dt>' + t("s.unlock") + '</dt><dd id="unlock"></dd></div><div class="kv"><dt>' + t("s.value") + '</dt><dd id="value"></dd></div></dl>' +
      '<p class="note" style="margin-top:8px" id="noexit"></p>' +
      '<details class="disc" style="margin-top:12px"><summary>' + t("s.help.q") + '</summary><div class="disc-b"><p>' + t("s.help.a") + '</p><dl style="margin-top:8px"><div class="kv"><dt>' + t("s.th.lock") + "</dt><dd>" + t("s.th.1") + " / " + t("s.th.2") + " / " + t("s.th.3") + "</dd></div>" +
        Object.keys(M.rates).map(function (d) { return '<div class="kv"><dt>' + t("s.days", { d: d }) + "</dt><dd>" + M.rates[d].join("% / ") + "%</dd></div>"; }).join("") + "</dl></div></details></section>";
  var pin = '<button type="button" class="btn btn-p" id="go"><span></span>' + A.ICON.go + '</button><p class="sub">' + (hold ? t("hold.fee.line") : t("s.fee")) + "</p>";
  A.shell({ tab: "stake", body: body, pin: pin });
  var $ = function (i) { return document.getElementById(i); }, inp = $("amt");
  function paint() {
    var raw = inp.value.trim(), a = Number(raw), err = "", fix = null, btn = "";
    if (raw === "") btn = t("s.btn.empty");
    else if (isNaN(a)) { err = t("s.e.nan"); btn = t("s.btn.nan"); }
    else if (a < M.minStake) { err = t("s.e.min"); btn = t("s.btn.min"); fix = [t("s.fix.min"), M.minStake]; }
    else if (a > bal) { err = t("s.e.bal", { b: fmt(bal) }); btn = t("s.btn.bal"); fix = [t("s.fix.bal", { b: fmt(bal) }), bal]; }
    var ok = !err && raw !== "" && !hold, v = isNaN(a) ? 0 : a, ti = tier(v), rate = M.rates[days][ti], interest = v * rate / 100 * days / 365;
    $("f").classList.toggle("is-err", !!err);
    $("msg").innerHTML = err ? esc(err) + (fix ? ' <button type="button" class="lnk" data-fix="' + fix[1] + '">' + esc(fix[0]) + "</button>" : "") : t("s.tier.cue" + ti);
    $("opts").innerHTML = Object.keys(M.rates).map(function (d) { return '<button type="button" class="opt" role="radio" aria-checked="' + (+d === days) + '" data-d="' + d + '"><b>' + d + "<small>" + t("s.d") + "</small></b><span>" + M.rates[d][ti] + "%</span></button>"; }).join("");
    $("int-l").textContent = t("s.interest", { d: days }); $("int").textContent = fmt(interest, 2); $("apr").textContent = rate + "%";
    $("unlock").textContent = A.date(endOf()); $("value").textContent = fmt(v + interest, 2) + " CT";
    $("noexit").textContent = t("s.noexit", { date: A.date(endOf()) });
    var go = $("go"); go.disabled = !ok; go.querySelector("span").textContent = hold ? t("hold.stake.btn") : ok ? t("s.btn", { a: fmt(v) }) : btn;
    return { a: v, rate: rate, interest: interest };
  }
  inp.addEventListener("input", paint);
  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-d]"); if (o) { days = +o.getAttribute("data-d"); paint(); return; }
    var f = e.target.closest("[data-fix]"); if (f) { inp.value = f.getAttribute("data-fix"); paint(); return; }
    if (e.target.closest("#max")) { inp.value = bal; paint(); return; }
    if (e.target.closest("#go")) review();
    if (e.target.closest("#confirm")) {
      var b = e.target.closest("#confirm"); b.classList.add("is-busy"); b.innerHTML = "<span>" + t("tx.stake.h", { a: fmt(paint().a) }) + '</span><span class="busy"></span>';
      setTimeout(function () { A.closeSheet(); A.toast(t("s.ok.h", { a: fmt(paint().a) })); }, 1400);
    }
  });
  function review() {
    var v = paint();
    A.sheet(t("s.rv.h", { a: fmt(v.a), d: days }), '<dl><div class="kv"><dt>' + t("s.apr") + "</dt><dd>" + v.rate + '%</dd></div><div class="kv"><dt>' + t("s.interest", { d: days }) + "</dt><dd>" + fmt(v.interest, 2) + ' CT</dd></div><div class="kv"><dt>' + t("s.unlock") + "</dt><dd>" + A.date(endOf()) + '</dd></div><div class="kv"><dt>' + t("c.fee") + "</dt><dd>" + t("c.fee.v") + "</dd></div></dl>" +
      '<p class="note note-k" style="margin:12px 0">' + t("s.noexit", { date: A.date(endOf()) }) + '</p><button type="button" class="btn btn-p" id="confirm"><span>' + t("s.btn", { a: fmt(v.a) }) + "</span>" + A.ICON.go + '</button><button type="button" class="btn btn-s" data-close><span>' + t("common.cancel") + "</span></button>");
  }
  paint(); if (st === "review") review();
})();
