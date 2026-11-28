/* Wallet: CT as the one hero figure, then points. Deposit and withdraw open as sheets (?state=deposit, ?state=withdraw). */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state, fmt = A.fmt, u = M.user, hold = st === "hold";
  function head() { return '<div class="ph" style="padding-bottom:8px"><h1 class="ph-t d">' + t("w.title") + "</h1></div>"; }
  if (st === "loading") return A.shell({ tab: "wallet", body: head() + A.skeleton() });
  if (st === "error") return A.shell({ tab: "wallet", body: head() + A.errBlock() });
  var off = st === "offline", canCt = Math.floor(u.points / 1000);
  var body = head() + (hold ? A.holdNote("hold.wallet") : "") + (st === "rpc" ? '<div class="pad" style="padding-top:8px"><p class="note note-k">' + t("e.rpc") + "</p></div>" : "") +
    '<section class="sec is-bare" style="padding-top:10px"><span class="fig-l">CT, ' + t("w.avail").toLowerCase() + '</span><span class="fig-v is-hero"><span data-roll="' + u.ct + '" data-dec="1"></span><small>CT</small></span>' +
      (A.lang === "ko" ? '<span class="fig-n">' + t("common.krw", { krw: fmt(Math.round(u.ct * M.krwPerCt)) }) + "</span>" : "") +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px"><button type="button" class="addr-chip" data-copy="' + u.address + '" data-copied="' + esc(t("w.copied", { a: A.short(u.address) })) + '" aria-label="' + t("w.copy") + '">' + A.short(u.address) + A.ICON.copy + '</button><span class="live">' + (off ? t("off.last", { time: "08:52" }) : t("common.updated", { n: 7 })) + "</span></div>" +
      '<div class="duo" style="margin-top:12px"><button type="button" class="btn btn-s" id="dep"' + (off ? " disabled" : "") + "><span>" + t("w.deposit") + '</span></button><button type="button" class="btn btn-s" id="wd"' + (off ? " disabled" : "") + "><span>" + t("w.withdraw") + "</span></button></div>" +
      (off ? '<p class="sub" style="margin-top:8px">' + t("w.offline") + "</p>" : "") +
      '<div class="rows" style="margin-top:10px"><a class="row" href="stakes.html"><span class="row-m"><span class="row-t">' + t("w.staked") + '</span></span><span class="row-e">' + fmt(u.staked) + " CT</span>" + A.ICON.go + "</a>" +
      '<div class="row"><span class="row-m"><span class="row-t">KAIA</span><br><span class="row-s">' + t(hold ? "hold.kaia.note" : "w.kaia.note") + '</span></span><span class="row-e">' + fmt(u.kaia) + "</span></div></div></section>" +
    '<section class="sec is-heavy"><span class="fig-l">' + t("w.points") + '</span><span class="fig-v is-hero" style="font-size:3.5rem"><span data-roll="' + u.points + '"></span><small>P</small></span>' +
      '<span class="fig-n">' + t("w.ready", { n: canCt }) + "</span>" +
      '<p style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="chip chip-y">' + t("w.onway") + '</span><span class="sub">' + t("w.pendinghit", { p: u.pendingHit, time: "04:10" }) + "</span></p>" +
      '<div style="margin-top:14px">' + (hold ? '<button type="button" class="btn" disabled><span>' + t("hold.convert.btn") + "</span></button>" : '<a class="btn btn-p" href="convert.html"><span>' + t("w.convert") + "</span>" + A.ICON.go + "</a>") + "</div></section>" +
    '<section class="sec"><a class="row" href="invite.html"><span class="row-m"><span class="row-t">' + t("inv.entry") + '</span><br><span class="row-s">' + t("w.invite") + '</span></span><span class="row-e">+' + M.invite.week + "P</span>" + A.ICON.go + "</a></section>";
  A.shell({ tab: "wallet", body: body });

  /* a drawn stand in for the QR: the real one is generated from the address in the app */
  function qr() {
    var n = 25, s = "", seed = 7; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function finder(x, y) { return '<path d="M' + x + " " + y + "h7v7h-7zM" + (x + 1) + " " + (y + 1) + "v5h5v-5zM" + (x + 2) + " " + (y + 2) + 'h3v3h-3z" fill-rule="evenodd"/>'; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9), mid = x > 9 && x < 15 && y > 9 && y < 15;
      if (!inF && !mid && rnd() > 0.52) s += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 25 25" role="img" aria-label="' + t("dp.qr") + '" fill="var(--ink)" shape-rendering="crispEdges">' + s + finder(0, 0) + finder(18, 0) + finder(0, 18) + '<image href="assets/cojam-mark.svg" x="10.5" y="10.5" width="4" height="4"/></svg>';
  }
  function deposit() {
    A.sheet(t("px.deposit.h"), '<p class="sub" style="margin-bottom:12px">' + t("dp.lead") + '</p><div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:end"><div class="qr">' + qr() + '</div><p class="live">' + t("dp.watch") + '</p></div><p class="addr" style="margin:12px 0">' + A.group(u.address) + "</p>" +
      '<button type="button" class="btn btn-p" data-copy="' + u.address + '" data-copied="' + esc(t("w.copied", { a: A.short(u.address) })) + '"><span>' + t("w.copy") + "</span>" + A.ICON.copy + "</button>" +
      '<dl style="margin-top:10px"><div class="kv"><dt>' + t("dp.net") + "</dt><dd>" + t("dp.net.v") + '</dd></div><div class="kv"><dt>' + t("dp.token") + "</dt><dd>" + t("dp.token.v") + '<br><span class="addr">' + A.group(M.token) + '</span></dd></div></dl><p class="note note-k" style="margin-top:8px"><b>' + t("dp.w1") + "</b>" + t("dp.w2") + " " + t("dp.w3") + "</p>");
  }
  function withdraw() {
    var to = "0x4f2a9D1c7B3e5A6088f1C2d3E4b5A69788c191bc";
    var el = A.sheet(t("x.title"), '<label class="field"><span class="field-l"><span>' + t("x.to") + '</span></span><span class="field-box"><input class="is-text" id="to" value="' + to + '" autocomplete="off" spellcheck="false"><button type="button" class="field-act">' + t("x.paste") + '</button></span><p class="field-msg">' + t("x.addr.ok") + '<br><span class="addr">' + A.group(to) + "</span></p></label>" +
      '<label class="field" style="margin-top:14px"><span class="field-l"><span>' + t("x.amount") + "</span><span>" + t("x.avail", { c: "<b>" + fmt(u.ct) + "</b>" }) + '</span></span><span class="field-box"><input id="xa" inputmode="decimal" value="250"><span class="unit">CT</span><button type="button" class="field-act">' + t("s.max") + "</button></span></label>" +
      '<dl style="margin-top:12px"><div class="kv"><dt>' + t("x.kaia") + "</dt><dd>" + fmt(u.kaia) + ' KAIA</dd></div><div class="kv"><dt>' + t("x.fee") + "</dt><dd>" + t("x.fee.v", { f: M.fee }) + '</dd></div><div class="kv"><dt>' + t("dp.net") + "</dt><dd>" + t("dp.net.v") + "</dd></div></dl>" +
      '<label class="chk"><input type="checkbox" id="ck"><i></i><span>' + t("x.rv.check") + '</span></label><button type="button" class="btn btn-p" id="send" disabled><span>' + t("x.btn", { a: 250 }) + "</span>" + A.ICON.go + '</button><p class="sub" style="margin-top:8px">' + t("x.gas") + "</p>");
    el.querySelector("#ck").addEventListener("change", function () { el.querySelector("#send").disabled = !this.checked; });
    el.querySelector("#send").addEventListener("click", function () { A.closeSheet(); A.toast(t("x.ok", { a: 250 })); });
  }
  var d = document.getElementById("dep"), w = document.getElementById("wd");
  if (d) d.addEventListener("click", deposit); if (w) w.addEventListener("click", withdraw);
  if (st === "deposit") deposit(); if (st === "withdraw") withdraw();
})();
