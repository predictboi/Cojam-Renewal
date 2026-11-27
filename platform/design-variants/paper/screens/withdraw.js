/* Withdraw CT: a sub page of the wallet. Where to (with Paste and the full address repeated in groups once it is valid), how much (with Max),
   the facts right above the action (your KAIA, the fee, the network), and the action pinned. Every withdrawal is reviewed in a sheet with a required check.
   States (as platform/design/withdraw.html): (none), filled, bad, sum, own, contract, nokaia, review, signing, sending, success, failed, loading, offline. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$;
  var bal = M.user.ct, kaia = S === "nokaia" ? 0.0004 : M.user.kaia, fee = M.fee;
  var GOOD = "0x52908400098527886E0F7030069857D2E4169EE7";
  var addr0 = { filled: GOOD, review: GOOD, signing: GOOD, sending: GOOD, success: GOOD, failed: GOOD, nokaia: GOOD, bad: "0x52908400098527886E0F70300", sum: "0x52908400098527886e0F7030069857D2E4169EE7", own: M.user.address, contract: M.token }[S] || "";
  var amt0 = addr0 ? "250" : "";
  var blocked = S === "loading" || App.state === "offline";
  function body() {
    return (App.offline ? C.note("warn", t("x.offline")) : "") +
      '<section class="msec">' +
      '<div class="field"><div class="field-label"><label for="to"><b>' + t("x.to") + '</b></label></div><div class="field-box field-box--text field-box--mono' + (blocked ? " is-off" : "") + '"><input id="to" name="to" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="0x…" value="' + addr0 + '" aria-describedby="to-msg"' + (blocked ? " disabled" : "") + '><button type="button" class="field-max" id="paste"' + (blocked ? " disabled" : "") + ">" + t("x.paste") + '</button></div><div class="field-msg field-msg--stack" id="to-msg" aria-live="polite"></div></div>' +
      C.amount({ id: "amt", label: t("x.amount"), unit: "CT", value: amt0, disabled: blocked, side: S === "loading" ? C.skel("110px", "12px") : t("x.avail", { c: "<b>" + F.dec(bal) + "</b>" }) }) + "</section>" +
      '<section class="msec">' + C.rows([[t("x.kaia") + C.q("withdraw", t("x.fee")), F.kaia(kaia)], [t("x.fee"), t("x.fee.v", { f: fee }) + " " + C.tag(t("pp.youpay"))], [t("dp.net"), t("dp.net.v")]]) + "</section>" +
      '<div id="kaia-note"></div>';
  }
  function cfg(to, a) {
    var amt = F.dec(a);
    return { label: t("x.chip", { a: amt }), review: { title: t("x.rv.h", { a: amt }), rows: [[t("x.rv.to"), '<span class="addr-v" translate="no">' + F.groups(to) + "</span>"], [t("x.amount"), F.ct(a), true], [t("x.fee"), t("x.fee.v", { f: fee })]], check: t("x.rv.check"), confirm: t("x.rv.h", { a: amt }) },
      success: { title: t("x.ok", { a: amt }) } };
  }
  App.mount({ tab: "wallet", back: "wallet.html", title: t("x.title"), body: body(), pin: C.actbar(C.btn("", { kind: "primary", block: true, id: "go", disabled: true })), pts: S === "loading" ? "loading" : "", badges: { home: "dot", results: 2 }, after: function () {
    var to = $("#to"), inp = $("#amt"), go = $("#go"), toMsg = $("#to-msg"), aMsg = $("#amt-msg"), touched = !!addr0;
    function checkAddr(v) {
      if (!v) return touched ? "x.e.empty" : "";
      if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return "x.e.bad";
      if (S === "sum" && v === addr0) return "x.e.sum";
      if (v.toLowerCase() === M.user.address.toLowerCase()) return "x.e.own";
      if (M.contracts.indexOf(v.toLowerCase()) >= 0) return "x.e.contract";
      return "";
    }
    function update() {
      var v = to.value.trim(), e1 = checkAddr(v), p = App.parseAmount(inp.value), a = p.value || 0, e2 = "", fix = "";
      to.closest(".field-box").classList.toggle("is-error", !!e1); to.closest(".field-box").classList.toggle("is-ok", !!v && !e1); to.setAttribute("aria-invalid", e1 ? "true" : "false");
      /* the field cannot show 42 characters: a valid address is repeated in full, grouped as on the wallet, so it can be checked by eye */
      toMsg.className = "field-msg field-msg--stack" + (e1 ? " is-error" : ""); toMsg.innerHTML = e1 ? "<span>" + t(e1) + "</span>" : v ? '<span class="tier-cue is-on">' + C.icon("check", 14) + t("x.addr.ok") + '</span><span class="addr-v" translate="no">' + F.groups(v) + "</span>" : "";
      if (p.bad || (!p.empty && a <= 0)) e2 = t("s.e.nan");
      else if (a > bal) { e2 = t("s.e.bal", { b: F.dec(bal) }); fix = C.btn(t("s.fix.bal", { b: F.dec(bal) }), { sm: true, attrs: 'data-fix="' + bal + '"' }); }
      inp.closest(".field-box").classList.toggle("is-error", !!e2); aMsg.className = "field-msg" + (e2 ? " is-error" : ""); aMsg.innerHTML = e2 ? "<span>" + e2 + "</span>" + fix : "";
      var noKaia = kaia < fee;
      $("#kaia-note").innerHTML = noKaia ? C.note("error", t("x.e.kaia", { f: fee, k: F.dec(kaia) }), C.btn(t("x.fix.kaia"), { sm: true, href: "deposit.html" })) : "";
      var valid = v && !e1 && !e2 && !p.empty && !noKaia && !blocked;
      go.disabled = !valid; go.querySelector("span").textContent = !p.empty && !e2 && a ? t("x.btn", { a: F.dec(a) }) : t("x.btn.empty");
      return valid ? { to: v, a: a } : null;
    }
    to.addEventListener("input", function () { touched = true; update(); }); to.addEventListener("blur", function () { touched = true; update(); }); inp.addEventListener("input", update);
    document.addEventListener("click", function (e) {
      var f = e.target.closest("[data-fix]"); if (f) { inp.value = F.dec(+f.getAttribute("data-fix")); update(); return; }
      if (e.target.closest("[data-max]")) { inp.value = F.dec(bal); update(); return; }   /* Max subtracts nothing: the fee is paid in KAIA */
      if (e.target.closest("#paste")) { touched = true; var done = function (s) { to.value = (s || GOOD).trim(); update(); }; try { navigator.clipboard.readText().then(done, function () { done(""); }); } catch (err) { done(""); } }
    });
    go.addEventListener("click", function () { var r = update(); if (r) App.tx.run(cfg(r.to, r.a)); });
    update();
    var show = { review: "review", signing: "signing", sending: "sending", success: "success", failed: "failed" }[S];
    if (show) App.tx.show(show, cfg(GOOD, 250));
  } });
})();
