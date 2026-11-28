/* Wallet: the accounts, read at a glance. One figure (CT available) with its two actions, three short rows, then the points with the one primary action.
   Every explanation is behind a "?" (why KAIA, how points become CT) or in the closed token disclosure.
   States (as platform/design/wallet.html): (none), new, zero, loading, error, offline, hold. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, u = M.user;
  var pts = S === "zero" ? 0 : S === "new" ? 450 : u.points, ct = S === "zero" ? 0 : u.ct, staked = S === "zero" ? 0 : u.staked, kaia = S === "zero" ? 0 : u.kaia;
  var off = App.state === "offline", hold = S === "hold";
  function head() { return '<div class="ph-top"><h1>' + t("w.title") + "</h1></div>"; }
  function body() {
    if (S === "loading") return '<section class="msec" aria-busy="true">' + C.skel("90px") + C.skel("220px", "56px") + '<div class="acts">' + C.skel("100%", "44px") + C.skel("100%", "44px") + "</div>" + C.skel("100%", "48px") + C.skel("100%", "48px") + "</section>" +
      '<section class="msec" aria-busy="true">' + C.skel("60px") + C.skel("140px", "44px") + C.skel("100%", "52px") + '</section><p class="sr-only" role="status">' + t("common.loading") + "</p>";
    var canCt = Math.floor(pts / 1000), a = u.address;
    return (off ? C.note("warn", t("w.offline")) : "") + (hold ? C.hold(t("hold.wallet")) : "") +
      '<section class="msec" aria-labelledby="ct-h">' + (S === "error" ? C.note("warn", t("e.rpc"), C.btn(t("common.retry"), { sm: true, icon: "refresh", attrs: "data-reload" })) : "") +
      '<div class="mhero"><div class="lbl-row"><h2 class="lbl" id="ct-h">' + t("w.avail") + "</h2>" + (App.isKo ? '<span class="sub">' + F.krw(ct) + "</span>" : "") + '</div><p class="fig fig--xl" id="ct-fig">' + (ct ? F.dec(ct) + "<small>CT</small>" : '<span class="is-zero">0 CT</span>') + "</p></div>" +
      '<div class="acts">' + C.btn(t("w.deposit"), { icon: "download", href: "deposit.html", disabled: off, id: "dep" }) + C.btn(t("w.withdraw"), { icon: "share", href: "withdraw.html", disabled: off, id: "wd" }) + "</div>" +
      '<div class="list"><div class="wrow wrow--addr"><span>' + t("pp.addr") + "</span>" + C.addr(a, { id: "copy-addr" }) + "</div>" +
      '<a class="wrow" href="stakes.html"><span>' + t("w.staked") + '</span><b id="staked">' + F.dec(staked) + ' <small>CT</small></b><span class="wrow-go"><span class="sr-only">' + t("s.mine", { n: S === "zero" ? 0 : M.stakes.length }) + '</span><span aria-hidden="true">' + (S === "zero" ? 0 : M.stakes.length) + "</span>" + C.icon("chev", 16) + "</span></a>" +
      /* why KAIA matters is one tap away; on hold the player pays fees, which is a state, so it is a tag */
      '<div class="wrow"><span class="wrow-l">KAIA' + C.q("kaia", "KAIA") + "</span><b>" + F.dec(kaia, 4) + " <small>KAIA</small></b>" + (hold ? '<small class="fact"><b>' + t("pp.youpay") + "</b></small>" : "") + "</div></div></section>" +
      '<section class="msec" aria-labelledby="pt-h"><div class="mhero"><h2 class="lbl lbl--q" id="pt-h">' + t("w.points") + C.q("points", t("w.points")) + '</h2><p class="fig" id="pt-fig">' + (pts ? F.int(pts) + "<small>P</small>" : '<span class="is-zero">0P</span>') + "</p></div>" +
      '<p class="fact"><b>1,000P = 1 CT</b>' + (S === "" || off || hold ? '<span class="fact-sep" aria-hidden="true"></span>' + t("pp.at", { p: u.pendingHit, time: "22:10" }) : "") + "</p>" +
      '<div class="wconvert">' + C.btn(t("w.convert"), { kind: "primary", block: true, href: "convert.html" + (S === "new" || S === "zero" ? "?state=short" : ""), disabled: off || hold, id: "convert" }) + "</div>" +
      '<a class="inv-row" id="to-invite" href="invite.html?from=wallet"><span class="inv-row-t"><b>' + t("w.invite") + '</b></span><span class="inv-row-go">+' + F.pts(S === "zero" || S === "new" ? 0 : M.invite.week) + C.icon("chev", 16) + "</span></a></section>" +
      C.help(t("w.info"), '<p class="hold-why">' + C.icon("warn", 16) + "<span>" + t("w.token") + '</span></p><div class="mcontract"><p class="addr-v" translate="no">' + F.groups(M.token) + "</p>" +
        C.btn(t("w.token.copy"), { sm: true, icon: "copy", attrs: 'data-copy="' + M.token + '" data-toast="' + App.esc(t("w.token.copied")) + '" data-done="' + App.esc(t("w.copy.done")) + '"' }) +
        '<a class="linkish" id="scan" translate="no" href="https://kaiascan.io/address/' + a + '" target="_blank" rel="noopener" aria-label="' + App.esc(t("w.scan")) + '">Kaiascan' + C.icon("ext", 16) + "</a></div>");
  }
  App.mount({ tab: "wallet", docTitle: t("w.title"), live: S === "error" ? C.stamp(48) : "", head: head(), body: body(), points: pts, pts: S === "loading" ? "loading" : S === "error" ? "stale" : "", badges: { home: "dot", results: 2 } });
})();
