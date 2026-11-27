/* Staking, new stake: the rates page. The amount, the four lock periods as one rate table (the chosen one inverted), what it pays as a figure,
   and the action pinned above the tab bar. Every stake is reviewed in a sheet first: a lock with no early exit never starts on one tap. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$;
  var bal = S === "zero" ? 0 : S === "big" || S === "review" ? 25000 : M.user.ct, period = 90;
  var initial = { empty: "", below: "50", above: "5,000", zero: "", big: "12,000", review: "12,000", loading: "", hold: "" }[S];
  if (initial === undefined) initial = "500";
  var blocked = S === "paused" || S === "zero" || S === "loading" || App.state === "offline" || S === "hold";
  var PERIODS = [30, 90, 180, 365], HQ = S === "hold" ? "?state=hold" : "";
  function tier(a) { return a >= 10000 ? 2 : a >= 1000 ? 1 : 0; }

  function head() { return '<div class="ph-top"><h1>' + t("s.title") + "</h1></div>"; }
  function sw() { return '<nav class="mtabs" id="sw" aria-label="' + App.esc(t("s.switch")) + '"><a href="staking.html' + HQ + '" aria-current="page">' + t("s.new") + '</a><a href="stakes.html' + HQ + '">' + t("s.tab.mine") + '<span class="mtabs-n" id="sw-n">' + (M.stakes.length + (S === "hold" ? 1 : 0)) + "</span></a></nav>"; }
  function avail() { return t("s.avail") + ' <b id="avail">' + F.ct(bal) + "</b>"; }
  function body() {
    if (S === "error") return sw() + C.error();
    return sw() +
      (S === "paused" ? C.note("warn", t("s.paused")) : "") + (App.offline ? C.note("warn", t("s.offline")) : "") +
      (S === "hold" ? C.hold(t("hold.stake"), { action: C.btn(t("s.tab.mine"), { sm: true, href: "stakes.html?state=hold", iconEnd: "right", id: "hold-mine" }) }) : "") +
      (S === "zero" ? C.note("", t("s.zero"), '<div class="row">' + C.btn(t("w.deposit"), { sm: true, href: "wallet.html?state=deposit" }) + C.btn(t("w.convert"), { sm: true, href: "convert.html" }) + "</div>") : "") +
      '<section class="msec" id="form">' +
      C.amount({ id: "amt", label: t("s.amount"), unit: "CT", value: initial, disabled: blocked, side: S === "loading" ? C.skel("110px", "12px") : avail(), msg: t("s.min") }) +
      '<div class="stack-8"><p class="field-label"><b id="per-l">' + t("s.period") + '</b></p><div class="period" role="group" aria-labelledby="per-l" id="period">' +
      PERIODS.map(function (d) { return '<button type="button" data-d="' + d + '" aria-pressed="' + (d === period) + '"' + (blocked ? " disabled" : "") + '><span class="per-d">' + t("s.days", { d: d }) + '</span><b data-rate="' + d + '"></b></button>'; }).join("") + "</div></div>" +
      "</section>" +
      '<section class="msec stk-sum"><div class="mhero" aria-live="polite"><h2 class="lbl" id="sum-l"></h2><p class="fig" id="sum-v"></p><p class="sub" id="sum-k" hidden></p></div>' +
      '<p class="stk-lock" id="rules"></p></section>' +
      C.help(t("s.help.q"), "<p>" + t("s.help.a") + '</p><div class="scrollx"><table class="ratetable"><tr><th>' + t("s.th.lock") + "</th><th>" + t("s.th.1") + "</th><th>" + t("s.th.2") + "</th><th>" + t("s.th.3") + "</th></tr>" +
        PERIODS.map(function (d) { return "<tr><td>" + t("s.days", { d: d }) + "</td>" + M.rates[d].map(function (r) { return "<td>" + r + "%</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>", S === "rates");
  }
  function txCfg(a) {
    var r = M.rates[period][tier(a)], unlock = F.dateLong(M.ahead(period)), amt = F.dec(a);
    return { label: t("s.chip", { a: amt }), busy: busy, onSuccess: function () { staked(a, period, r); }, stepsTitle: t("tx.stake.h", { a: amt }), steps: [t("tx.step1", { a: amt }), t("tx.step2", { a: amt })],
      cancelMsg: t("s.cancelled"),
      review: { title: t("s.rv.h", { a: amt, d: period }), rows: [[t("s.amount"), F.ct(a)], [t("s.period"), t("s.days", { d: period })], [t("s.apr"), r + "%"], [t("s.interest", { d: period }), F.ct(a * r / 100 * period / 365), true]], warn: t("s.noexit", { date: unlock }), confirm: t("s.btn", { a: amt }) },
      success: { title: t("s.ok.h", { a: amt }), rows: [[t("s.unlock"), unlock], [t("s.apr"), r + "%"]], btn: { label: t("s.ok.btn"), href: "stakes.html" } } };
  }
  var pending = "", refresh = function () {};
  function busy(on, label) { pending = on ? label : ""; refresh(); }
  function staked(a, days, rate) {
    if (S === "" || S === "empty") { App.sess.data.stakes.push({ amount: a, days: days, rate: rate, start: Date.now() }); App.sess.save(); M.stakes.unshift({ id: "n", amount: a, days: days, rate: rate, start: new Date() }); }
    bal = Math.round((bal - a) * 1e4) / 1e4; M.user.ct = bal; M.user.staked += a;
    var av = $("#avail"); if (av) av.textContent = F.ct(bal);
    var mine = $("#sw-n"); if (mine) mine.textContent = M.stakes.length;
    var inp = $("#amt"); if (inp) inp.value = "";
    refresh();
  }
  var act = S === "error" ? "" : C.actbar(C.btn("", { kind: "primary", block: true, id: "go", disabled: true }), S === "hold" ? "" : t("s.fee"));
  App.mount({ tab: "stake", docTitle: t("s.title"), live: C.stamp(6), head: head(), body: body(), pin: act, pts: S === "loading" ? "loading" : "", badges: { home: "dot", results: 2 }, after: function () {
    var inp = $("#amt"); if (!inp) return;
    var msg = $("#amt-msg"), box = inp.closest(".field-box"), go = $("#go"); if (!go) return;
    var lastTier = null;
    function update() {
      var p = App.parseAmount(inp.value), a = p.value || 0, err = "", fix = "";
      if (p.bad) { err = t("s.e.nan"); }
      else if (p.decimals > 4) { var cut = Math.floor(a * 1e4) / 1e4; err = t("s.e.dec"); fix = C.btn(t("s.fix.dec", { b: F.dec(cut) }), { sm: true, attrs: 'data-fix="' + cut + '"' }); }
      else if (!p.empty && a < M.minStake) { err = t("s.e.min"); if (bal >= M.minStake) fix = C.btn(t("s.fix.min"), { sm: true, attrs: 'data-fix="100"' }); }
      else if (a > bal) { err = t("s.e.bal", { b: F.dec(bal) }); fix = C.btn(t("s.fix.bal", { b: F.dec(bal) }), { sm: true, attrs: 'data-fix="' + bal + '"' }); }
      box.classList.toggle("is-error", !!err); inp.setAttribute("aria-invalid", err ? "true" : "false");
      msg.className = "field-msg" + (err ? " is-error" : "");
      /* while the amount is in error the period table keeps the base rates: no rate is promised for an amount that cannot be staked */
      var ti = err ? 0 : tier(a), cue = a < M.minStake ? t("s.min") : t("s.tier.cue" + ti);
      msg.innerHTML = err ? "<span>" + err + "</span>" + fix : '<span class="tier-cue' + (a >= M.minStake && ti ? " is-on" : "") + '">' + (a >= M.minStake && ti ? C.icon("check", 14) : "") + "<span>" + cue + "</span></span>" + (App.isKo && a ? "<span>" + F.krw(a) + "</span>" : "");
      var valid = !err && !p.empty && !blocked;
      PERIODS.forEach(function (d, i) {
        var el = $('[data-rate="' + d + '"]'), v = M.rates[d][ti] + "%"; if (el.textContent === v) return;
        el.textContent = v;
        if (lastTier !== null && lastTier !== ti) { el.style.setProperty("--i", i); el.classList.remove("is-up", "is-down"); void el.offsetWidth; el.classList.add(ti > lastTier ? "is-up" : "is-down"); }
      });
      lastTier = ti;
      var r = M.rates[period][ti], interest = a * r / 100 * period / 365;
      var shown = !err && !p.empty;
      $("#sum-l").textContent = t("s.interest", { d: period });
      $("#sum-v").innerHTML = S === "loading" ? C.skel("170px", "40px") : shown ? F.dec(interest) + "<small>CT</small>" : "–";
      var kr = $("#sum-k"); kr.hidden = !(App.isKo && shown); kr.textContent = shown ? F.krw(interest) : "";
      $("#rules").innerHTML = C.icon("lock", 18) + "<span>" + t("s.rules", { date: F.dateLong(M.ahead(period)) }) + "</span>";
      go.disabled = !valid || !!pending; go.classList.toggle("is-busy", !!pending);
      go.innerHTML = (pending ? '<span class="spin"></span>' : "") + "<span>" + (pending ? pending : valid ? t("s.btn", { a: F.dec(a) }) : t(S === "hold" ? "hold.stake.btn" : "s.btn.idle")) + "</span>";
      return valid && !pending ? a : 0;
    }
    refresh = update;
    inp.addEventListener("input", update);
    document.addEventListener("click", function (e) {
      var f = e.target.closest("[data-fix]"); if (f) { inp.value = F.dec(+f.getAttribute("data-fix")); update(); return; }
      if (e.target.closest("[data-max]")) { inp.value = F.dec(bal); update(); return; }
      var d = e.target.closest("#period button"); if (d && !d.disabled) { period = +d.getAttribute("data-d"); App.$$("#period button").forEach(function (b) { b.setAttribute("aria-pressed", b === d); }); update(); }
    });
    go.addEventListener("click", function () { var a = update(); if (a) App.tx.run(txCfg(a)); });
    var a0 = update();
    var show = { review: "review", signing: "signing", steps: "steps2", sending: "sending", success: "success", failed: "failed" }[S];
    if (show) App.tx.show(show, txCfg(a0 || 500));
  } });
})();
