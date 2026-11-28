/* Staking, new stake: the rates page, read at a glance. The amount, the four lock periods as one rate table (the chosen one inverted), what it pays as one figure
   with the lock as two tags (the date and "No early exit"), and the action pinned. How rates work is behind the "?" beside the title.
   Every stake is reviewed in a sheet first: a lock with no early exit never starts on one tap.
   States (as platform/design/staking.html): (none), empty, below, above, zero, big, paused, full, fullnone, max20, loading, review, signing, steps, sending, slow, success, failed, hidden, error, offline, hold. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$;
  var bal = S === "zero" ? 0 : S === "big" || S === "review" ? 25000 : M.user.ct, period = 90;
  var initial = { empty: "", below: "50", above: "5,000", zero: "", big: "12,000", review: "12,000", loading: "", hold: "" }[S];
  if (initial === undefined) initial = "500";
  var blocked = S === "paused" || S === "fullnone" || S === "max20" || S === "zero" || S === "loading" || App.state === "offline" || S === "hold";
  var room = S === "full" ? 300 : Infinity;   /* what the interest fund can still reserve for this period */
  var PERIODS = [30, 90, 180, 365], HQ = S === "hold" ? "?state=hold" : "";
  function tier(a) { return a >= 10000 ? 2 : a >= 1000 ? 1 : 0; }

  function head() { return '<div class="ph-top ph-top--q"><h1>' + t("s.title") + "</h1>" + C.q("staking", t("s.title")) + "</div>"; }
  function sw() { return '<nav class="mtabs" id="sw" aria-label="' + App.esc(t("s.switch")) + '"><a href="staking.html' + HQ + '" aria-current="page">' + t("s.new") + '</a><a href="stakes.html' + HQ + '">' + t("s.tab.mine") + '<span class="mtabs-n" id="sw-n">' + (M.stakes.length + (S === "hold" ? 1 : 0)) + "</span></a></nav>"; }
  function avail() { return t("s.avail") + ' <b id="avail">' + F.ct(bal) + "</b>"; }
  function body() {
    if (S === "error") return sw() + C.error();
    return sw() +
      (S === "paused" ? C.note("warn", t("s.paused")) : "") + (S === "fullnone" ? C.note("warn", t("s.full") + " " + t("s.full.none")) : "") + (S === "max20" ? C.note("warn", t("s.max20"), C.btn(t("s.mine", { n: 20 }), { sm: true, href: "stakes.html" })) : "") + '<div id="full-note"></div>' + (App.offline ? C.note("warn", t("s.offline")) : "") +
      (S === "hold" ? C.hold(t("hold.stake"), { action: C.btn(t("s.tab.mine"), { sm: true, href: "stakes.html?state=hold", iconEnd: "right", id: "hold-mine" }) }) : "") +
      (S === "zero" ? C.note("", t("s.zero"), '<div class="row">' + C.btn(t("w.deposit"), { sm: true, href: "deposit.html" }) + C.btn(t("w.convert"), { sm: true, href: "convert.html" }) + "</div>") : "") +
      '<section class="msec" id="form">' +
      C.amount({ id: "amt", label: t("s.amount"), unit: "CT", value: initial, disabled: blocked, side: S === "loading" ? C.skel("110px", "12px") : avail(), msg: t("s.min") }) +
      '<div class="stack-8"><p class="field-label"><b id="per-l">' + t("s.period") + "</b><span>" + t("pp.peryear") + "</span></p>" + '<div class="period" role="group" aria-labelledby="per-l" id="period">' +
      PERIODS.map(function (d) { return '<button type="button" data-d="' + d + '" aria-pressed="' + (d === period) + '"' + (blocked ? " disabled" : "") + '><span class="per-d">' + t("s.days", { d: d }) + '</span><b data-rate="' + d + '"></b></button>'; }).join("") + "</div></div>" +
      "</section>" +
      '<section class="msec stk-sum"><div class="mhero" aria-live="polite"><h2 class="lbl" id="sum-l"></h2><p class="fig" id="sum-v"></p><p class="sub" id="sum-k" hidden></p></div>' +
      '<p class="stk-lock" id="rules"></p></section>';
  }
  function txCfg(a) {
    var r = M.rates[period][tier(a)], unlock = F.dateLong(M.ahead(period)), amt = F.dec(a);
    return { label: t("s.chip", { a: amt }), busy: busy, onSuccess: function () { staked(a, period, r); }, stepsTitle: t("tx.stake.h", { a: amt }), steps: [t("tx.step1", { a: amt }), t("tx.step2", { a: amt })],
      cancelMsg: t("s.cancelled"),
      review: { title: t("s.rv.h", { a: amt, d: period }), rows: [[t("s.amount"), F.ct(a)], [t("s.period"), t("s.days", { d: period })], [t("s.apr"), r + "%"], [t("s.interest", { d: period }), F.ct(a * r / 100 * period / 365), true]], warn: t("s.noexit", { date: unlock }), confirm: t("s.btn", { a: amt }) },
      success: { stamp: "pp.st.staked", title: t("s.ok.h", { a: amt }), rows: [[t("s.unlock"), unlock], [t("s.apr"), r + "%"]], btn: { label: t("s.ok.btn"), href: "stakes.html" } } };
  }
  /* while a stake is pending the primary button is disabled and is the status; a second stake waits until the first ends */
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
  var act = S === "error" ? "" : '<div class="pin pin--act"><p class="pin-fig" id="pin-fig" aria-hidden="true"></p>' + C.btn("", { kind: "primary", block: true, id: "go", disabled: true }) + '<p class="pin-note">' + (S === "hold" ? t("pp.youpay") : t("pp.nofee2")) + "</p></div>";
  App.mount({ tab: "stake", docTitle: t("s.title"), head: head(), body: body(), pin: act, pts: S === "loading" ? "loading" : "", badges: { home: "dot", results: 2 }, after: function () {
    var inp = $("#amt"); if (!inp) return;
    var msg = $("#amt-msg"), box = inp.closest(".field-box"), go = $("#go"); if (!go) return;
    var lastTier = null;
    function update() {
      /* an amount that cannot be staked: the reason is said once, under the field, with the fix as a button */
      var p = App.parseAmount(inp.value), a = p.value || 0, err = "", fix = "";
      if (p.bad) { err = t("s.e.nan"); }
      else if (p.decimals > 4) { var cut = Math.floor(a * 1e4) / 1e4; err = t("s.e.dec"); fix = C.btn(t("s.fix.dec", { b: F.dec(cut) }), { sm: true, attrs: 'data-fix="' + cut + '"' }); }
      else if (!p.empty && a < M.minStake) { err = t("s.e.min"); if (bal >= M.minStake) fix = C.btn(t("s.fix.min"), { sm: true, attrs: 'data-fix="100"' }); }
      else if (a > bal) { err = t("s.e.bal", { b: F.dec(bal) }); fix = C.btn(t("s.fix.bal", { b: F.dec(bal) }), { sm: true, attrs: 'data-fix="' + bal + '"' }); }
      box.classList.toggle("is-error", !!err); inp.setAttribute("aria-invalid", err ? "true" : "false");
      msg.className = "field-msg" + (err ? " is-error" : "");
      /* while the amount is in error the period table keeps the base rates: no rate is promised for an amount that cannot be staked */
      /* under the field: the minimum until it is met, then the next tier as a short cue (the full sentence is in the "?" sheet) */
      var ti = err ? 0 : tier(a), cue = a < M.minStake ? t("s.min") : ti === 0 ? t("pp.tier1") : ti === 1 ? t("pp.tier2") : t("s.tier.cue2");
      msg.innerHTML = err ? "<span>" + err + "</span>" + fix : '<span class="tier-cue' + (a >= M.minStake && ti ? " is-on" : "") + '">' + (a >= M.minStake && ti ? C.icon("check", 14) : "") + "<span>" + cue + "</span></span>" + (App.isKo && a ? "<span>" + F.krw(a) + "</span>" : "");
      var over = !err && a > room;
      $("#full-note").innerHTML = over ? C.note("warn", t("s.full") + " " + t("s.full.room", { x: F.dec(room), d: period }), C.btn(t("s.fix.stake", { x: F.dec(room) }), { sm: true, attrs: 'data-fix="' + room + '"' })) : "";
      var valid = !err && !p.empty && !blocked && !over;
      PERIODS.forEach(function (d, i) {
        var el = $('[data-rate="' + d + '"]'), v = M.rates[d][ti] + "%"; if (el.textContent === v) return;
        el.textContent = v;
        if (lastTier !== null && lastTier !== ti) { el.style.setProperty("--i", i); el.classList.remove("is-up", "is-down"); void el.offsetWidth; el.classList.add(ti > lastTier ? "is-up" : "is-down"); }
      });
      lastTier = ti;
      var r = M.rates[period][ti], interest = a * r / 100 * period / 365;
      var shown = !err && !p.empty;
      $("#sum-l").textContent = t("s.interest", { d: period });
      var sv = $("#sum-v");
      if (S === "loading") sv.innerHTML = C.skel("170px", "40px");
      else if (!shown) { sv._val = 0; sv.innerHTML = '<span class="is-zero">0 CT</span>'; }
      else App.countTo(sv, sv._val === undefined ? interest : sv._val, interest, function (v) { return F.dec(v) + "<small>CT</small>"; }, null, 260);
      var pf = $("#pin-fig"); if (pf) pf.innerHTML = "<span>" + t("s.interest", { d: period }) + '</span><b class="nw">' + (shown ? F.dec(interest) : "0") + " CT</b>";
      var kr = $("#sum-k"); kr.hidden = !(App.isKo && shown); kr.textContent = shown ? F.krw(interest) : "";
      /* the lock as two tags: the day it opens, and that there is no way out before it. The fee is a tag too. */
      /* the one condition that cannot be undone gets its own line in ink: the day the lock ends and that there is no way out before it */
      $("#rules").innerHTML = C.icon("lock", 18) + "<span>" + t("s.rules", { date: F.dateLong(M.ahead(period)) }) + "</span>";
      go.disabled = !valid || !!pending; go.classList.toggle("is-busy", !!pending);
      go.innerHTML = (pending ? '<span class="spin"></span>' : "") + "<span>" + (pending ? pending : valid ? t("s.btn", { a: F.dec(a) }) : S === "hold" ? t("hold.stake.btn") : t("s.btn.idle")) + "</span>";
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
    var show = { review: "review", signing: "signing", steps: "steps2", sending: "sending", slow: "slow", success: "success", failed: "failed" }[S];
    if (show) App.tx.show(show, txCfg(a0 || 500));
    if (S === "hidden") { App.tx.cfg = txCfg(500); App.tx.state = "sending"; App.tx.hidden = true; App.tx.busy(true); }
  } });
})();
