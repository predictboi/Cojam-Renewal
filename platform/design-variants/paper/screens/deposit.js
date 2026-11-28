/* Deposit: a sub page of the wallet. The address as a QR code, then in full in two lines of five groups, one primary action (copy), a live line that
   waits for deposits, and what may be sent here. States (as platform/design/deposit.html): (none), arrived, loading, error, offline. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$, a = M.user.address;
  function body() {
    if (S === "error") return C.note("error", t("dp.err"), C.btn(t("common.retry"), { sm: true, icon: "refresh", attrs: "data-reload" }));
    var qr = S === "loading" ? '<div class="qr" aria-busy="true">' + C.skel("100%", "176px") + "</div>" : C.qr(a, t("dp.qr"));
    return (App.offline ? C.note("warn", t("w.offline")) : "") + '<section class="msec dp-qr">' + qr + "</section>" +
      '<section class="msec" aria-labelledby="addr-h"><h2 class="lbl lbl--q" id="addr-h">' + t("pp.addr") + C.q("deposit", t("dp.title")) + "</h2>" +
      (S === "loading" ? C.skel("100%", "44px") : '<p class="addr-v addr-v--lg" id="addr" translate="no">' + F.groups(a) + "</p>") +
      C.btn(t("w.copy"), { kind: "primary", block: true, icon: "copy", id: "copy-addr", attrs: 'data-copy="' + a + '" data-done="' + App.esc(t("w.copy.done")) + '"', disabled: S === "loading" }) +
      '<p class="watch watch--live" id="watch" role="status">' + (App.offline ? C.icon("offline", 16) + "<span>" + t("dp.offline") + "</span>" : '<i class="press" aria-hidden="true"></i><span>' + t("dp.watch") + "</span>") + "</p></section>" +
      '<section class="msec">' + C.rows([[t("dp.net"), t("dp.net.v")], [t("dp.token"), t("dp.token.v")]]) +
      /* one plain warning stays on the surface; old CT, exchanges and the token contract are in the sheet behind "?" */
      '<p class="hold-why">' + C.icon("warn", 16) + "<span>" + t("dp.w1") + "</span></p></section>";
  }
  App.mount({ tab: "wallet", back: "wallet.html", title: t("dp.title"), body: body(), pts: S === "loading" ? "loading" : "", badges: { home: "dot", results: 2 }, after: function () {
    if (S === "arrived") setTimeout(function () {
      /* a deposit arrived: the waiting line becomes a stamp, and a slip says how much */
      var w = $("#watch"); w.innerHTML = C.rstamp("hit", t("dp.arrived", { a: "250" })); App.stampLand($(".rstamp", w), 0); App.toast(t("dp.toast", { a: "250" }));
    }, 1400);
  } });
})();
