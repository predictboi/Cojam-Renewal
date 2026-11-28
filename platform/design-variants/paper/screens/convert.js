/* Convert points: a sub page. The points to convert, the CT they become as the figure of the screen, the rules as rows, the action naming both amounts. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$;
  var bal = S === "short" ? 450 : S === "cap" ? 62250 : M.user.points, capLeft = S === "cap" ? 0 : 50;
  var initial = { empty: "", step: "1,250", above: "5,000", min: "500", loading: "", cap: "", capglobal: "", wait: "", paused: "1,000" }[S];
  if (initial === undefined) initial = "1,000";
  var blocked = S === "cap" || S === "capglobal" || S === "paused" || S === "wait" || S === "loading" || App.state === "offline" || S === "hold";
  function body() {
    if (S === "short") return '<section class="msec"><div class="mhero"><h2 class="lbl">' + t("c.avail") + '</h2><p class="fig fig--xl">' + (bal ? F.int(bal) + "<small>P</small>" : '<span class="is-zero">0P</span>') + "</p></div></section>" +
      C.empty({ icon: "bolt", title: t("c.short.h"), body: t("c.short.b", { p: F.int(bal), g: F.int(1000 - bal) }), action: C.btn(t("k.play"), { kind: "primary", href: "home.html" }) });
    var waitNote = "";
    if (S === "wait") { var d = M.user.firstConvert, secs = (d - Date.now()) / 1000;
      waitNote = C.note("", t("c.wait.b", { date: "<b>" + F.date(d, true) + "</b>" }) + "<br><b>" + t("c.wait.left", { d: Math.floor(secs / 86400), h: Math.floor(secs % 86400 / 3600) }) + "</b>"); }
    return waitNote + (S === "cap" ? C.note("warn", t("c.cap.hit", { time: t("time.kst9") })) : "") + (S === "capglobal" ? C.note("warn", t("c.cap.global", { time: t("time.kst9") })) : "") + (S === "paused" ? C.note("warn", t("c.paused")) : "") + (App.offline ? C.note("warn", t("w.offline")) : "") + (S === "hold" ? C.hold(t("hold.convert")) : "") +
      '<section class="msec">' +
      C.amount({ id: "amt", label: t("pp.points"), unit: "P", mode: "numeric", value: initial, disabled: blocked, side: S === "loading" ? C.skel("96px", "12px") : t("c.avail") + " <b>" + F.pts(bal) + "</b>", msg: t("c.step") }) +
      "</section>" +
      /* the result is the figure of this screen; the rate and the fee are two tags, every other rule is behind "?" */
      '<section class="msec mgrow"><div class="getbox"><h2 class="lbl lbl--q">' + t("c.get") + C.q("convert", t("c.title")) + '</h2><p class="fig" id="get" aria-live="polite"><span class="is-zero">0 CT</span></p>' +
      '<p class="fact" id="left"></p></div>' +
      '<dl class="facts3"><div><dt>' + t("c.rate") + "</dt><dd>1,000P = 1 CT</dd></div><div><dt>" + t("c.fee") + "</dt><dd>" + (S === "hold" ? t("pp.youpay") : t("pp.none")) + "</dd></div><div><dt>" + t("pp.lefttoday") + "</dt><dd>" + capLeft + " CT</dd></div></dl></section>";
  }
  function cfg(p) { var n = p / 1000; return { label: t("c.chip", { p: F.int(p) }), review: { title: t("c.btn", { p: F.int(p), n: n }), rows: [[t("pp.points"), F.pts(p)], [t("c.get"), F.ct(n), true], [t("c.ok.left"), F.pts(bal - p)]], note: t("pp.c.final"), confirm: t("c.btn", { p: F.int(p), n: n }) }, success: { stamp: "pp.st.conv", title: t("c.ok.h", { p: F.int(p), n: n }), rows: [[t("c.ok.left"), F.pts(bal - p)], [t("c.ok.ct"), F.ct(M.user.ct + n)]] }, onSuccess: function () { App.addPoints(-p); if (S === "") App.ledger(n, -p); }, onDone: function () { if (S === "") location.href = "wallet.html"; } }; }
  App.mount({ tab: "wallet", back: "wallet.html", title: t("c.title"), body: body(), pin: S === "short" ? "" : C.actbar(C.btn("", { kind: "primary", block: true, id: "go", disabled: true })), points: bal, pts: S === "loading" ? "loading" : "", badges: { home: "dot", results: 2 }, after: function () {
    var inp = $("#amt"); if (!inp) return;
    var msg = $("#amt-msg"), box = inp.closest(".field-box"), go = $("#go"), get = $("#get"), maxP = Math.min(Math.floor(bal / 1000) * 1000, capLeft * 1000);
    function update() {
      var p = App.parseAmount(inp.value), v = Math.floor(p.value || 0), err = "", fix = "";
      function use(f) { return C.btn(t("c.fix", { f: F.int(f) }), { sm: true, attrs: 'data-fix="' + f + '"' }); }
      if (p.bad) err = t("pp.c.nan");
      else if (!p.empty && p.decimals > 0) err = t("pp.c.whole");   /* a value with decimals is refused, never rounded to another number */
      else if (!p.empty && v > bal) { err = t("c.e.bal", { p: F.int(bal) }); if (maxP) fix = use(maxP); }
      else if (!p.empty && v < 1000) err = t("c.e.min");
      else if (!p.empty && v % 1000) { var f = Math.floor(v / 1000) * 1000; err = t("c.e.step", { f: F.int(f) }); fix = use(f); }
      else if (!p.empty && v > capLeft * 1000 && capLeft) { err = t("c.cap.over", { n: capLeft, f: F.int(capLeft * 1000) }); fix = use(capLeft * 1000); }
      box.classList.toggle("is-error", !!err); inp.setAttribute("aria-invalid", err ? "true" : "false");
      msg.className = "field-msg" + (err ? " is-error" : ""); msg.innerHTML = err ? "<span>" + err + "</span>" + fix : "<span>" + t("c.step") + "</span>";
      var valid = !err && !p.empty && !blocked, n = valid ? v / 1000 : 0;
      App.countTo(get, get._val === undefined ? n : get._val, n, function (v) { return Math.round(v) ? F.dec(Math.round(v)) + "<small>CT</small>" : '<span class="is-zero">0 CT</span>'; }, null, 260);
      var lf = $("#left"); if (lf) lf.innerHTML = valid ? t("c.ok.left") + " <b>" + F.pts(bal - v) + "</b>" : "";
      var why = S === "hold" || S === "paused" ? t("hold.convert.btn") : S === "wait" ? t("pp.c.wait", { date: F.date(M.user.firstConvert, true) }) : S === "cap" || S === "capglobal" ? t("pp.c.cap") : App.offline ? t("off.bar").split(".")[0] : t("c.btn.empty");   /* an amount in error: the sentence is under the field, once; the button keeps its own words */
      go.disabled = !valid; go.querySelector("span").textContent = valid ? t("c.btn", { p: F.int(v), n: n }) : why;
      return valid ? v : 0;
    }
    inp.addEventListener("input", update);
    document.addEventListener("click", function (e) {
      var f = e.target.closest("[data-fix]"); if (f) { inp.value = F.int(+f.getAttribute("data-fix")); update(); return; }
      if (e.target.closest("[data-max]")) { inp.value = F.int(maxP); update(); }
    });
    go.addEventListener("click", function () { var v = update(); if (v) App.tx.run(cfg(v)); });
    var v0 = update();
    var show = { signing: "signing", sending: "sending", success: "success", failed: "failed" }[S];
    if (show) App.tx.show(show, cfg(v0 || 1000));
  } });
})();
