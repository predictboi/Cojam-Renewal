// Cojam wallet connection: environment detection, mobile deep links and the connect sheet. Mock only: picking a wallet
// calls back into the page (the swap app runs CJ.ledger.connect with wallet.kind set); nothing talks to a real wallet.
// Load order on every page: system.js, wallet.js, i18n/*.js, shell.js, page script. Styles: assets/wallet.css.
//
// Sources (checked 2026-11-12):
// - MetaMask dapp deep link: "https://link.metamask.io/dapp/{dappUrl}" opens the URL in the MetaMask mobile in-app
//   browser; the example passes the URL without its scheme (app.uniswap.org). If the app is missing, the link lands on a
//   download page. https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks/
//   Older docs used https://metamask.app.link/dapp/{dappUrl}, which still redirects; we use the current domain.
// - Kaia Wallet, desktop: the docs (https://docs.kaiawallet.io/, https://docs.kaia.io/build/wallets/dapp-integration/integrate-dapp-with-kaiawallet/)
//   document the injected provider window.klaytn and the flag klaytn.isKaikas. window.kaia is checked too in case a later
//   release renames the provider; it is not documented today.
// - Kaia Wallet, mobile (re-checked 2026-11-12). The Kaia Wallet docs have a Korean section "[KO] Kaia Wallet mobile":
//   * Browser open, https://docs.kaiawallet.io/api_reference/ko-kaia-wallet-mobile/browser-open : documented.
//     "https://app.kaiawallet.io/u/${URL}" opens the URL in the Kaia Wallet in-app browser (example /u/google.com), and the
//     app scheme form is "kaikas://wallet/browser?url=" + encodeURIComponent(URL). This is what the Recommended row uses:
//     one tap opens this page inside Kaia Wallet, where the injected provider connects in one tap and signs Kaia fee
//     delegated transactions, so the holder needs no KAIA.
//     How the link behaves, read from app.kaiawallet.io's own page script (not from a device): /u/<rest> becomes
//     kaiawallet://wallet/browser?url=encodeURIComponent(<rest>) after 500 ms, Android uses
//     intent://wallet/browser?url=...#Intent;scheme=kaiawallet;package=io.klutch.wallet;end, and a missing app lands on
//     the store. app.kaiawallet.io serves no apple-app-site-association file, so on iOS it is a web page that hands off
//     to the app scheme (Safari asks "Open in Kaia Wallet?"), not a true universal link. NOT yet tested on a phone.
//   * App to app API, https://docs.kaiawallet.io/api_reference/ko-kaia-wallet-mobile/ko-kaia-wallet-mobile-app2app-api/
//     and .../prepare/ : documented. POST https://api.kaiawallet.io/api/v1/k/prepare with type auth | sign | send_klay |
//     execute_contract | watch_asset | add_network, then open kaikas://wallet/api?request_key=KEY on the phone (or show
//     https://app.kaiawallet.io/a/KEY as a QR code on desktop), then poll GET .../k/result/KEY. Fee delegation is
//     documented for execute_contract and send_klay: "fee_delegated": true builds a FeeDelegatedSmartContractExecution
//     (or value transfer), the wallet does not broadcast it and returns senderTxHashRLP for the fee payer to co-sign.
//     So a holder could also approve, swap and claim from Safari or Chrome without leaving it, at the cost of an app
//     round trip per step and a server that co-signs and sends. Kept as the production option for desktop QR and for
//     holders who do not want the in-app browser; the mock does not simulate it. The prepare endpoint answered
//     {"status":"prepared","request_key":...} to an auth request on 2026-11-12. The old host api.kaikas.io no longer
//     resolves; use api.kaiawallet.io.
//   * WalletConnect: thirdweb's wallet list, generated from the WalletConnect registry, has Kaia Wallet as io.kaiawallet
//     with mobile links native "kaiawallet://wallet" and universal "https://app.kaiawallet.io":
//     https://github.com/thirdweb-dev/js/blob/main/packages/thirdweb/src/wallets/__generated__/wallet/io.kaiawallet/index.ts
//     (the WalletConnect Explorer API itself needs a project id, so it was not queried directly).
//     The App Store notes list WalletConnect since v3.4.4. UNCONFIRMED: no Kaia Wallet or Kaia doc says Kaia Wallet signs
//     fee delegated transactions over WalletConnect, so the sheet never promises a free swap for the WalletConnect row.
//   Stores: https://apps.apple.com/app/id6502896387 (LINE NEXT Inc.), https://play.google.com/store/apps/details?id=io.klutch.wallet,
//   Chrome https://chromewebstore.google.com/detail/jblndlipeogpafnldhgmapagcccfchpi.
// - MetaMask install page for every platform: https://metamask.io/download/
//
// Testing: ?env=inapp-kaia | inapp-metamask | mobile-browser | desktop-ext | desktop-none forces a mode for captures.
(function () {
  var t = CJ.t, I = CJ.icon;
  var MODES = ["inapp-kaia", "inapp-metamask", "inapp-generic", "mobile-browser", "desktop-ext", "desktop-none"];
  var STORE = {
    kaiaIos: "https://apps.apple.com/app/id6502896387",
    kaiaAndroid: "https://play.google.com/store/apps/details?id=io.klutch.wallet",
    kaiaChrome: "https://chromewebstore.google.com/detail/jblndlipeogpafnldhgmapagcccfchpi",
    metamask: "https://metamask.io/download/"
  };
  // Local icons in the same 1.75 px stroke style as CJ.icon.
  var P = {
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2z"/><path d="M18 18h2v2h-2z"/><path d="M14 18h2"/><path d="M18 14h2"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    down: '<path d="M12 4v12"/><path d="M6 11l6 6 6-6"/><path d="M5 20h14"/>'
  };
  function ic(name, s) {
    if (!P[name]) return I(name, s);
    return '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + P[name] + "</svg>";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- environment ----------
  var ua = navigator.userAgent || "";
  var os = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "ios" : /Android/i.test(ua) ? "android" : null;
  var uaMobile = !!os || (navigator.userAgentData && navigator.userAgentData.mobile) || /Mobi/i.test(ua);
  function provider() {
    var k = window.klaytn || window.kaia;
    if (k) return "kaia";
    var e = window.ethereum;
    if (e && e.isMetaMask && !e.isKaikas) return "mm";
    if (e) return "web3";
    return null;
  }
  var forced = MODES.indexOf(CJ.params.get("env")) > -1 ? CJ.params.get("env") : null;
  function env() {
    if (forced) {
      var map = { "inapp-kaia": "kaia", "inapp-metamask": "mm", "inapp-generic": "web3" };
      return { mode: forced, inapp: !!map[forced], kind: map[forced] || null, mobile: forced.indexOf("desktop") < 0,
        exts: forced === "desktop-ext" ? ["kaia", "mm"] : [] };
    }
    var p = provider();
    if (uaMobile) return p ? { mode: p === "kaia" ? "inapp-kaia" : p === "mm" ? "inapp-metamask" : "inapp-generic", inapp: true, kind: p, mobile: true, exts: [] }
      : { mode: "mobile-browser", inapp: false, kind: null, mobile: true, exts: [] };
    var exts = [];
    if (window.klaytn || window.kaia) exts.push("kaia");
    if (window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isKaikas) exts.push("mm");
    else if (window.ethereum && !exts.length) exts.push("web3");
    return { mode: exts.length ? "desktop-ext" : "desktop-none", inapp: false, kind: null, mobile: false, exts: exts };
  }

  // ---------- links ----------
  // This page without the testing params, so the wallet browser detects its own provider.
  function pageUrl() {
    var u = new URL(location.href);
    ["env", "state", "reset"].forEach(function (k) { u.searchParams.delete(k); });
    return u.toString();
  }
  function metamaskLink() { return "https://link.metamask.io/dapp/" + pageUrl().replace(/^https?:\/\//, ""); }
  // Kaia Wallet browser open (documented, see the sources above). The page URL goes in raw, as in the docs example:
  // app.kaiawallet.io encodes it once when it hands off to kaiawallet://wallet/browser?url=.
  function kaiaLink() { return "https://app.kaiawallet.io/u/" + pageUrl(); }
  function kaiaStore() { return os === "android" ? [STORE.kaiaAndroid] : os === "ios" ? [STORE.kaiaIos] : [STORE.kaiaIos, STORE.kaiaAndroid]; }

  // Label for a one tap connect button (in-app) or the generic one.
  function ctaLabel() {
    var e = env();
    return e.inapp ? t("wl.connect.in", { wallet: t("wl.name." + e.kind) }) : t("wallet.connect");
  }

  // ---------- sheet ----------
  var dlg = null, body = null, opener = null, cb = null, picked = false, view = "list";
  function build() {
    if (dlg) return;
    dlg = document.createElement("dialog");
    dlg.className = "cj-sheet"; dlg.id = "cj-connect"; dlg.setAttribute("aria-labelledby", "cj-connect-h");
    dlg.innerHTML = '<div class="cj-sheet-grip" aria-hidden="true"><span></span></div>' +
      '<div class="cj-sheet-head"><h2 id="cj-connect-h"></h2><button type="button" class="btn btn-ghost cj-sheet-x" data-close></button></div>' +
      '<div class="cj-sheet-body" id="cj-connect-body"></div>';
    document.body.appendChild(dlg);
    body = dlg.querySelector(".cj-sheet-body");
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("keydown", trap);
    dlg.addEventListener("close", function () {
      var o = opener; opener = null;
      if (!picked && o && document.contains(o)) o.focus();
    });
    drag();
  }
  function opt(tag, attrs, icon, name, sub, badge, trail) {
    // The tag is its own grid item: beside the name when the row is wide, after the sub line on a narrow phone.
    return "<" + tag + ' class="cj-opt" ' + attrs + '><span class="cj-opt-ic">' + ic(icon, 20) + '</span><span class="cj-opt-txt"><span class="cj-opt-name">' + name + "</span>" +
      '<span class="cj-opt-sub">' + sub + "</span>" + (badge ? '<span class="tag tag-sky cj-opt-tag">' + badge + "</span>" : "") + "</span>" + ic(trail || "chevron", 18) + "</" + tag + ">";
  }
  function back() { return '<button type="button" class="btn btn-ghost cj-sheet-back" data-view="list">' + I("chevron", 18) + "<span>" + t("wl.back") + "</span></button>"; }
  function paint() {
    var e = env(), h = "";
    dlg.querySelector("#cj-connect-h").textContent = t(view === "kaia" ? "wl.kaia.title" : view === "qr" ? "wl.qr.title" : "wl.title");
    var x = dlg.querySelector("[data-close]"); x.innerHTML = I("x", 20); x.setAttribute("aria-label", t("wl.close"));
    dlg.setAttribute("data-mode", e.mode);
    if (view === "kaia") {
      var url = pageUrl();
      h = back() + '<p class="cj-sheet-lead">' + t("wl.kaia.lead") + "</p>" +
        '<ol class="cj-steps"><li>' + t("wl.kaia.s1") + "</li><li>" + t("wl.kaia.s2") + "</li><li>" + t("wl.kaia.s3") + "</li></ol>" +
        '<div class="cj-linkbox"><span class="cj-linkbox-url" id="cj-page-url">' + esc(url) + "</span></div>" +
        '<button type="button" class="btn btn-primary btn-lg btn-block" data-copy-page>' + I("copy", 18) + "<span>" + t("wl.kaia.copy") + "</span></button>" +
        '<p class="sr-only" role="status" id="cj-copy-live"></p>' +
        '<div class="cj-stores">' + kaiaStore().map(function (s) {
          var android = s === STORE.kaiaAndroid;
          return '<a class="btn btn-block" href="' + s + '" target="_blank" rel="noopener">' + ic("down", 18) + "<span>" + t(android ? "wl.store.android" : "wl.store.ios") + "</span></a>";
        }).join("") + "</div>" +
        '<button type="button" class="btn btn-ghost btn-block cj-sheet-alt" data-pick="wc">' + t("wl.kaia.wc") + "</button>";
    } else if (view === "qr") {
      h = back() + '<div class="cj-qr" role="img" aria-label="' + esc(t("wl.qr.aria")) + '"><span class="cj-qr-ph">' + ic("qr", 40) + "<span>" + t("wl.qr.ph") + "</span></span></div>" +
        '<p class="cj-sheet-lead">' + t("wl.qr.lead") + "</p>" +
        '<button type="button" class="btn btn-block" data-pick="wc">' + t("wl.qr.sim") + "</button>";
    } else if (e.mode === "mobile-browser") {
      // Recommended: one tap opens this page inside Kaia Wallet. If the app does not open (not installed, scheme blocked),
      // the line under it leads to Copy link and the store links.
      h = '<p class="cj-sheet-lead">' + t("wl.mobile.lead") + "</p><div class=\"cj-opts\">" +
        '<div class="cj-opt-group">' +
        opt("a", 'href="' + esc(kaiaLink()) + '" data-deeplink="kaia"', "phone", t("wl.open.kaia"), t("wl.sub.kaia.open"), t("wl.rec"), "ext") +
        '<button type="button" class="btn btn-ghost btn-block cj-opt-alt" data-view="kaia">' + t("wl.kaia.alt") + "</button></div>" +
        opt("a", 'href="' + esc(metamaskLink()) + '" data-deeplink="mm"', "phone", t("wl.open.mm"), t("wl.sub.mm"), null, "ext") +
        opt("button", 'type="button" data-pick="wc"', "link", t("wl.wc"), t("wl.sub.wc.mobile")) + "</div>";
    } else if (e.mode === "desktop-none") {
      h = '<p class="cj-sheet-lead">' + t("wl.none.lead") + "</p><div class=\"cj-opts\">" +
        opt("a", 'href="' + STORE.kaiaChrome + '" target="_blank" rel="noopener"', "wallet", t("wl.install.kaia"), t("wl.sub.kaia"), t("wl.rec"), "ext") +
        opt("a", 'href="' + STORE.metamask + '" target="_blank" rel="noopener"', "wallet", t("wl.install.mm"), t("wl.sub.mm"), null, "ext") +
        opt("button", 'type="button" data-view="qr"', "qr", t("wl.wc"), t("wl.sub.wc.desk")) + "</div>" +
        '<p class="small muted cj-sheet-foot">' + t("wl.none.reload") + "</p>";
    } else {
      // desktop with an extension (or an unforced inapp page that still asked for the sheet)
      var has = function (k) { return e.exts.indexOf(k) > -1 || e.kind === k; };
      h = '<div class="cj-opts">' +
        (has("kaia") ? opt("button", 'type="button" data-pick="kaia"', "wallet", t("wl.name.kaia"), t("wl.sub.kaia"), t("wl.found"))
          : opt("a", 'href="' + STORE.kaiaChrome + '" target="_blank" rel="noopener"', "wallet", t("wl.install.kaia"), t("wl.sub.kaia"), t("wl.rec"), "ext")) +
        (has("mm") ? opt("button", 'type="button" data-pick="mm"', "wallet", t("wl.name.mm"), t("wl.sub.mm"), t("wl.found"))
          : opt("a", 'href="' + STORE.metamask + '" target="_blank" rel="noopener"', "wallet", t("wl.install.mm"), t("wl.sub.mm"), null, "ext")) +
        (has("web3") ? opt("button", 'type="button" data-pick="web3"', "wallet", t("wl.name.web3"), t("wl.sub.web3"), t("wl.found")) : "") +
        opt("button", 'type="button" data-view="qr"', "qr", t("wl.wc"), t("wl.sub.wc.desk")) + "</div>";
    }
    body.innerHTML = h + '<p class="small muted cj-sheet-note">' + t("wl.note") + "</p>";
  }
  function focusFirst() {
    var f = body.querySelector("button, a[href]") || dlg.querySelector("[data-close]");
    if (f) f.focus();
  }
  function setView(v) { view = v; paint(); focusFirst(); }
  function onClick(e) {
    if (e.target === dlg) { // the backdrop, or the sheet's own edge
      var r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { close(); return; }
    }
    if (e.target.closest("[data-close]")) { close(); return; }
    var v = e.target.closest("[data-view]"); if (v) { setView(v.getAttribute("data-view")); return; }
    var p = e.target.closest("[data-pick]"); if (p) { pick(p.getAttribute("data-pick")); return; }
    var c = e.target.closest("[data-copy-page]");
    if (c) {
      // The page toast sits under the modal backdrop, so the button itself confirms the copy.
      var url = pageUrl(), done = function () {
        c.lastChild.textContent = t("wl.kaia.copied"); c.innerHTML = I("check", 18) + c.lastChild.outerHTML;
        var lv = dlg.querySelector("#cj-copy-live"); if (lv) lv.textContent = t("wl.kaia.copied");
        clearTimeout(c._t); c._t = setTimeout(function () { if (document.contains(c)) c.innerHTML = I("copy", 18) + "<span>" + t("wl.kaia.copy") + "</span>"; }, 2500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done); else done();
      return;
    }
  }
  // Keep Tab inside the sheet (showModal makes the page inert, but Tab can still leave for the browser UI).
  function trap(e) {
    if (e.key !== "Tab") return;
    var f = [].slice.call(dlg.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
  // Drag the grip or the head down to close (touch and pen; mouse users have Esc, the X and the backdrop).
  function drag() {
    var y0 = null, dy = 0;
    dlg.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || !e.target.closest(".cj-sheet-grip, .cj-sheet-head") || e.target.closest("button")) return;
      y0 = e.clientY; dy = 0; dlg.classList.add("is-dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0); dlg.style.transform = dy ? "translateY(" + dy + "px)" : "";
    });
    function end() {
      if (y0 == null) return;
      y0 = null; dlg.classList.remove("is-dragging"); dlg.style.transform = "";
      if (dy > 80) close();
    }
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  function pick(kind) {
    picked = true;
    var f = cb; dlg.close();
    if (f) f(kind);
  }
  function close() { if (dlg && dlg.open) dlg.close(); }

  // open({from, onPick(kind)}): in a wallet's own browser it connects at once (no chooser); elsewhere it shows the sheet.
  function open(opts) {
    opts = opts || {};
    var e = env();
    if (e.inapp && !opts.force) { if (opts.onPick) opts.onPick(e.kind); return; }
    build();
    cb = opts.onPick || null; picked = false; view = "list";
    opener = opts.from || document.activeElement;
    paint();
    if (!dlg.open) dlg.showModal();
    focusFirst();
  }
  document.addEventListener("cj:lang", function () { if (dlg && dlg.open) paint(); });

  CJ.wallet = { env: env, open: open, close: close, ctaLabel: ctaLabel, os: os, links: { metamask: metamaskLink, kaia: kaiaLink, store: STORE, page: pageUrl } };
})();
