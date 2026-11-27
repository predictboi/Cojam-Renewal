/* Wallet: the accounts. CT is the one hero figure; deposit and withdraw are the two secondary buttons and open as sheets;
   points are the second figure, with Convert as the one primary action. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, u = M.user, $ = App.$;
  var pts = S === "zero" ? 0 : S === "new" ? 450 : u.points, ct = S === "zero" ? 0 : u.ct, staked = S === "zero" ? 0 : u.staked, kaia = S === "zero" ? 0 : u.kaia;
  var off = App.state === "offline", hold = S === "hold";
  function head() { return '<div class="ph-top"><h1>' + t("w.title") + "</h1></div>"; }
  function body() {
    if (S === "loading") return '<section class="msec" aria-busy="true">' + C.skel("90px") + C.skel("220px", "56px") + '<div class="acts">' + C.skel("100%", "44px") + C.skel("100%", "44px") + "</div>" + C.skel("100%", "48px") + C.skel("100%", "48px") + "</section>" +
      '<section class="msec" aria-busy="true">' + C.skel("60px") + C.skel("140px", "44px") + C.skel("100%") + C.skel("100%", "52px") + '</section><p class="sr-only" role="status">' + t("common.loading") + "</p>";
    var canCt = Math.floor(pts / 1000), a = u.address;
    return (off ? C.note("warn", t("w.offline")) : "") + (hold ? C.hold(t("hold.wallet")) : "") +
      '<section class="msec" aria-labelledby="ct-h">' + (S === "error" ? C.note("warn", t("e.rpc"), C.btn(t("common.retry"), { sm: true, icon: "refresh", attrs: "data-reload" })) : "") +
      '<div class="wid"><div class="mhero"><h2 class="lbl" id="ct-h">' + t("w.avail") + '</h2><p class="fig fig--xl" id="ct-fig">' + F.dec(ct) + "<small>CT</small></p>" + (App.isKo ? '<p class="sub">' + F.krw(ct) + "</p>" : "") + "</div></div>" +
      '<div class="acts">' + C.btn(t("w.deposit"), { icon: "download", disabled: off, id: "dep" }) + C.btn(t("w.withdraw"), { icon: "share", disabled: off, id: "wd" }) + "</div>" +
      '<div class="list"><div class="wrow wrow--addr"><span>' + t("w.addr") + "</span>" + C.addr(a, { id: "copy-addr" }) + "</div>" +
      '<a class="wrow" href="stakes.html"><span>' + t("w.staked") + '</span><b id="staked">' + F.dec(staked) + ' <small>CT</small></b><span class="wrow-go"><span class="sr-only">' + t("s.mine", { n: M.stakes.length }) + '</span><span aria-hidden="true">' + M.stakes.length + "</span>" + C.icon("chev", 16) + "</span></a>" +
      '<div class="wrow"><span>KAIA</span><b>' + F.dec(kaia, 4) + " <small>KAIA</small></b><small>" + t(hold ? "hold.kaia.note" : "w.kaia.note") + "</small></div></div></section>" +
      '<section class="msec" aria-labelledby="pt-h"><div class="mhero"><h2 class="lbl" id="pt-h">' + t("w.points") + '</h2><p class="fig" id="pt-fig">' + F.int(pts) + "<small>P</small></p></div>" +
      '<p class="mline">' + (canCt ? t("w.ready", { n: canCt }) : t("w.notyet", { g: F.int(1000 - pts) })) + "</p>" +
      (S === "" || off || hold ? '<p class="wpend">' + C.tag(t("w.onway")) + "<span>" + t("w.pendinghit", { p: u.pendingHit, time: "22:10" }) + "</span></p>" : "") +
      '<div class="wconvert">' + C.btn(t("w.convert"), { kind: "primary", block: true, href: "convert.html" + (S === "new" || S === "zero" ? "?state=short" : ""), disabled: off || hold, id: "convert" }) + (hold ? '<p class="hold-why" id="convert-why">' + C.icon("pause", 16) + "<span>" + t("hold.convert.reason") + "</span></p>" : "") + "</div>" +
      '<a class="inv-row" id="to-invite" href="invite.html?from=wallet"><span class="inv-row-t"><b>' + t("w.invite") + "</b><small>" + t("inv.entry.sub", { r: M.invite.rate }) + '</small></span><span class="inv-row-go">+' + F.pts(S === "zero" || S === "new" ? 0 : M.invite.week) + C.icon("chev", 16) + "</span></a></section>" +
      C.help(t("w.info"), '<p class="hold-why">' + C.icon("warn", 16) + "<span>" + t("w.token") + '</span></p><div class="mcontract"><p class="addr-v" translate="no">' + F.groups(M.token) + "</p>" +
        C.btn(t("w.token.copy"), { sm: true, icon: "copy", attrs: 'data-copy="' + M.token + '" data-toast="' + App.esc(t("w.token.copied")) + '" data-done="' + App.esc(t("w.copy.done")) + '"' }) +
        '<a class="linkish" id="scan" translate="no" href="https://kaiascan.io/address/' + a + '" target="_blank" rel="noopener" aria-label="' + App.esc(t("w.scan")) + '">Kaiascan' + C.icon("ext", 16) + "</a></div>");
  }
  /* deposit: the address as a QR code and in full, one copy action, and what may be sent here */
  function depositSheet() {
    var a = u.address;
    App.sheet.open("<h2>" + t("dp.title") + '</h2><p class="sheet-lead">' + t("dp.lead") + '</p><div class="dep">' + C.qr(a, t("dp.qr")) + '<p class="addr-v" translate="no">' + F.groups(a) + "</p></div>" +
      C.rows([[t("dp.net"), t("dp.net.v")], [t("dp.token"), t("dp.token.v") + ", KAIA"]]) +
      '<p class="hold-why">' + C.icon("warn", 16) + "<span>" + t("dp.w1") + " " + t("dp.w2") + "</span></p>" +
      '<div class="sheet-acts">' + C.btn(t("w.copy"), { kind: "primary", block: true, icon: "copy", attrs: 'data-copy="' + a + '" data-done="' + App.esc(t("w.copy.done")) + '"' }) + C.btn(t("common.close"), { kind: "ghost", block: true, attrs: "data-sheet-close" }) + "</div>");
  }
  /* withdraw: where to, how much, the fee the player pays, then the review with a required check */
  function withdrawSheet() {
    var DEST = "0x52b1c3d4E5f60718293a4B5c6D7e8F9012345678";
    App.sheet.open("<h2>" + t("x.title") + '</h2><div class="field"><div class="field-label"><label for="to"><b>' + t("x.to") + '</b></label></div><div class="field-box field-box--text"><input id="to" name="to" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="0x" aria-describedby="to-msg"><button type="button" class="field-max" id="paste">' + t("x.paste") + '</button></div><div class="field-msg" id="to-msg" aria-live="polite"></div></div>' +
      C.amount({ id: "wamt", label: t("x.amount"), unit: "CT", value: "", side: t("x.avail", { c: "<b>" + F.dec(ct) + "</b>" }) }) +
      C.rows([[t("x.kaia"), F.kaia(kaia)], [t("x.fee"), t("x.fee.v", { f: M.fee })]]) +
      '<p class="hold-why">' + C.icon("info", 16) + "<span>" + t("x.gas") + "</span></p>" +
      '<div class="sheet-acts">' + C.btn(t("x.btn.empty"), { kind: "primary", block: true, id: "wgo", disabled: true }) + C.btn(t("common.cancel"), { kind: "ghost", block: true, attrs: "data-sheet-close" }) + "</div>");
    var to = $("#to"), amt = $("#wamt"), go = $("#wgo"), tmsg = $("#to-msg");
    function check() {
      var v = to.value.trim(), okAddr = /^0x[0-9a-fA-F]{40}$/.test(v), own = v.toLowerCase() === u.address.toLowerCase(), err = !v ? "" : !okAddr ? t("x.e.bad") : own ? t("x.e.own") : "";
      to.closest(".field-box").classList.toggle("is-error", !!err); to.closest(".field-box").classList.toggle("is-ok", okAddr && !own);
      tmsg.className = "field-msg" + (err ? " is-error" : ""); tmsg.innerHTML = err ? "<span>" + err + "</span>" : okAddr ? '<span class="tier-cue is-on">' + C.icon("check", 14) + t("x.addr.ok") + "</span>" : "";
      var p = App.parseAmount(amt.value), a = p.value || 0, valid = okAddr && !own && a > 0 && a <= ct;
      go.disabled = !valid; go.querySelector("span").textContent = valid ? t("x.btn", { a: F.dec(a) }) : t("x.btn.empty");
      return valid ? { to: v, a: a } : null;
    }
    to.addEventListener("input", check); amt.addEventListener("input", check);
    $("#paste").addEventListener("click", function () { to.value = DEST; check(); });
    $("#sheet").addEventListener("click", function (e) { if (e.target.closest('[data-max="wamt"]')) { amt.value = F.dec(ct); check(); } });
    go.addEventListener("click", function () {
      var v = check(); if (!v) return; var a = F.dec(v.a);
      App.tx.run({ label: t("x.chip", { a: a }), review: { title: t("x.rv.h", { a: a }), rows: [[t("x.rv.to"), '<span class="addr-v" translate="no">' + F.groups(v.to) + "</span>"], [t("x.amount"), F.ct(v.a), true], [t("x.fee"), t("x.fee.v", { f: M.fee })]], check: t("x.rv.check"), confirm: t("x.btn", { a: a }) }, success: { title: t("x.ok", { a: a }) } });
    });
    if (S === "withdraw") { to.value = DEST; amt.value = "250"; check(); }
  }
  App.mount({ tab: "wallet", docTitle: t("w.title"), live: C.stamp(S === "error" ? 48 : 6), head: head(), body: body(), points: pts, pts: S === "loading" ? "loading" : S === "error" ? "stale" : "", badges: { home: "dot", results: 2 }, after: function () {
    document.addEventListener("click", function (e) { if (e.target.closest("#dep")) depositSheet(); else if (e.target.closest("#wd")) withdrawSheet(); });
    if (S === "deposit") depositSheet();
    if (S === "withdraw") withdrawSheet();
  } });
})();
