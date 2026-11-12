// Shared shell: safety banner, header, footer. Every page has <body data-page="home|swap|status|docs" data-root="./|../">
// with <div id="cj-top"></div> before <main> and <div id="cj-foot"></div> after it.
(function () {
  var b = document.body, page = b.dataset.page || "home", root = b.dataset.root || "./";
  var I = CJ.icon;
  var links = [
    { id: "swap", href: root + "migrate/", key: "nav.swap" },
    { id: "status", href: root + "status/", key: "nav.status" },
    { id: "docs", href: root + "docs/", key: "nav.docs" }
  ];
  function nav(cls) {
    return '<nav class="' + cls + '" data-i18n-attr="aria-label:nav.main">' + links.map(function (l) {
      return '<a href="' + l.href + '"' + (l.id === page ? ' aria-current="page"' : "") + ' data-i18n="' + l.key + '"></a>';
    }).join("") + "</nav>";
  }
  var top = document.getElementById("cj-top");
  if (top) {
    top.outerHTML =
      '<div class="cj-banner" role="note"><div class="container">' + I("shield", 16) + '<span data-i18n="banner.text"></span></div></div>' +
      '<header class="cj-header"><div class="container cj-header-row">' +
        '<a class="cj-brand" href="' + root + '" data-i18n-attr="aria-label:nav.home"><img src="' + root + 'assets/cojam-mark.svg" alt="" width="28" height="28"><span>Cojam</span></a>' +
        nav("cj-nav") +
        '<div class="cj-tools">' +
          '<label class="cj-lang">' + I("globe", 18) + '<span class="sr-only" data-i18n="nav.lang"></span>' +
            '<select id="cj-lang-select"><option value="en">EN</option><option value="ko">한국어</option><option value="ja">日本語</option></select></label>' +
          (page === "swap" ? '<button type="button" class="btn btn-sm cj-wallet" id="cj-wallet"></button>' : "") +
        "</div>" +
      "</div>" + nav("cj-nav-mobile container") + "</header>";
  }
  var foot = document.getElementById("cj-foot");
  if (foot) {
    foot.outerHTML =
      '<footer class="cj-footer"><div class="container cj-foot-grid">' +
        '<div class="cj-foot-brand"><a class="cj-brand" href="' + root + '" data-i18n-attr="aria-label:nav.home"><img src="' + root + 'assets/cojam-mark.svg" alt="" width="28" height="28"><span>Cojam</span></a>' +
          '<p class="muted small" data-i18n="foot.tagline"></p></div>' +
        '<div><h2 class="cj-foot-h" data-i18n="foot.site"></h2>' + nav("cj-foot-nav") + "</div>" +
        '<div class="cj-foot-addrs"><h2 class="cj-foot-h" data-i18n="foot.contracts"></h2><div class="addr" data-addr="old"></div><div class="addr" data-addr="new"></div><div class="addr" data-addr="swap"></div></div>' +
      "</div>" +
      '<div class="container cj-foot-legal"><p class="small" data-i18n="foot.safety"></p><p class="xs muted" data-i18n="foot.legal"></p><p class="xs muted" data-i18n="foot.copy"></p></div></footer>';
  }

  var sel = document.getElementById("cj-lang-select");
  if (sel) { sel.value = CJ.lang(); sel.addEventListener("change", function () { CJ.setLang(sel.value); }); }

  function paintWallet() {
    var w = document.getElementById("cj-wallet"); if (!w) return;
    var L = CJ.ledger.get();
    if (L.wallet.connected) { w.innerHTML = I("wallet", 16) + '<span class="num">' + CJ.fmt.addr(L.wallet.address) + "</span>"; w.setAttribute("aria-label", CJ.t("wallet.connected", { addr: L.wallet.address })); }
    else { w.innerHTML = I("wallet", 16) + "<span>" + CJ.t("wallet.connect") + "</span>"; w.removeAttribute("aria-label"); }
  }
  document.addEventListener("cj:ledger", paintWallet);
  document.addEventListener("cj:lang", function () { paintWallet(); CJ.renderAddrs(); });

  CJ.applyI18n();
  CJ.renderAddrs();
  paintWallet();
})();
