// Cojam shared system: config, i18n, mock ledger, mock clock, formatters, amount parser, swap track, toasts.
// Mock only: nothing here talks to a chain. Load order on every page: system.js, i18n/*.js, shell.js, page script.
(function () {
  var DAY = 86400000;
  var params = new URLSearchParams(location.search);

  // ---------- config ----------
  var config = {
    chainId: 8217,
    chainName: "Kaia",
    gasSymbol: "KAIA",
    explorer: "https://kaiascan.io",
    oldToken: { name: "Cojam", symbol: "CT", decimals: 18, address: "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b" },
    newToken: { name: "Cojam Token", symbol: "CT", decimals: 18, address: null, supply: 4083262533.956 },
    swapContract: { address: null },
    ratio: 1,
    lockDays: 7,
    // Mock window. Real dates are set at launch; the window is one year.
    windowStart: Date.UTC(2026, 11, 1),
    windowEnd: Date.UTC(2027, 11, 1),
    officialUrl: null, // new domain, to be announced
    since: 2019
  };

  // ---------- mock clock (?days=8 moves time forward) ----------
  var offset = (parseFloat(params.get("days")) || 0) * DAY;
  // The prototype pretends today is inside the window so every state can be shown.
  var baseNow = Math.max(Date.now(), config.windowStart + 12 * DAY);
  function now() { return baseNow + offset + (Date.now() - loadedAt); }
  var loadedAt = Date.now();

  // ---------- i18n ----------
  var SUPPORTED = ["en", "ko", "ja"];
  var dicts = { en: {}, ko: {}, ja: {} };
  function dict(d) { SUPPORTED.forEach(function (l) { if (d[l]) Object.assign(dicts[l], d[l]); }); }
  function pickLang() {
    var q = params.get("lang");
    if (SUPPORTED.indexOf(q) > -1) return q;
    try { var s = localStorage.getItem("cj.lang"); if (SUPPORTED.indexOf(s) > -1) return s; } catch (e) {}
    var n = (navigator.language || "en").slice(0, 2);
    return SUPPORTED.indexOf(n) > -1 ? n : "en";
  }
  var lang = pickLang();
  function t(key, vars) {
    var s = dicts[lang][key];
    if (s == null) s = dicts.en[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }
  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    root.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    root.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":"); if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
  }
  function setLang(l) {
    if (SUPPORTED.indexOf(l) < 0) return;
    lang = l;
    try { localStorage.setItem("cj.lang", l); } catch (e) {}
    document.documentElement.lang = l;
    applyI18n();
    document.dispatchEvent(new CustomEvent("cj:lang", { detail: l }));
  }

  // ---------- formatters ----------
  var locales = { en: "en-US", ko: "ko-KR", ja: "ja-JP" };
  function loc() { return locales[lang]; }
  function amount(n, dp) {
    if (n == null || isNaN(n)) return "";
    var max = dp == null ? (Math.abs(n) >= 1000 ? 2 : 4) : dp;
    return new Intl.NumberFormat(loc(), { maximumFractionDigits: max, minimumFractionDigits: 0 }).format(n);
  }
  function compact(n) { return new Intl.NumberFormat(loc(), { notation: "compact", maximumFractionDigits: 2 }).format(n); }
  function pct(n, dp) { return new Intl.NumberFormat(loc(), { style: "percent", maximumFractionDigits: dp == null ? 1 : dp }).format(n); }
  function date(ts) { return new Intl.DateTimeFormat(loc(), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(ts); }
  function dateTime(ts) { return new Intl.DateTimeFormat(loc(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(ts); }
  function rel(ts) {
    var diff = ts - now(), abs = Math.abs(diff);
    var rtf = new Intl.RelativeTimeFormat(loc(), { numeric: "auto" });
    if (abs < 60000) return rtf.format(Math.round(diff / 1000), "second");
    if (abs < 3600000) return rtf.format(Math.round(diff / 60000), "minute");
    if (abs < DAY) return rtf.format(Math.round(diff / 3600000), "hour");
    return rtf.format(Math.round(diff / DAY), "day");
  }
  function shortAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }

  // ---------- amount parser ----------
  // Accepts "1,250.75", "1250", "40 CT". Rejects negatives, exponents, more than 18 decimals and junk, with a reason key.
  function parseAmount(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (s === "") return { ok: false, empty: true };
    s = s.replace(/\s*(old\s*)?ct$/i, "").replace(/,/g, "").replace(/\s/g, "");
    if (/^-/.test(s)) return { ok: false, reason: "parse.negative" };
    if (/e/i.test(s)) return { ok: false, reason: "parse.exponent" };
    if (!/^\d*\.?\d*$/.test(s) || s === ".") return { ok: false, reason: "parse.junk" };
    var dec = (s.split(".")[1] || "");
    if (dec.length > 18) return { ok: false, reason: "parse.decimals" };
    var v = parseFloat(s);
    if (!(v > 0)) return { ok: false, reason: "parse.zero" };
    return { ok: true, value: v };
  }

  // ---------- mock ledger ----------
  var KEY = "cj.ledger.v1";
  function freshLedger() {
    return {
      wallet: { connected: false, address: "0x3fA9c2E07b1d4C6e8A52bD90f1e7C4a6D2b8E915", network: "kaia", kaia: 2.48 },
      oldCT: 125000,
      newCT: 0,
      allowance: 0,
      lots: [], // {id, amount, swappedAt, unlockAt, claimedAt, txSwap, txClaim}
      contract: { paused: false, reserveEmpty: false }
    };
  }
  if (params.get("reset") === "1") { try { localStorage.removeItem(KEY); } catch (e) {} }
  var ledger;
  try { ledger = JSON.parse(localStorage.getItem(KEY)) || freshLedger(); } catch (e) { ledger = freshLedger(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ledger)); } catch (e) {} emit(); }
  function emit() { document.dispatchEvent(new CustomEvent("cj:ledger", { detail: ledger })); }
  function fakeTx() { var h = "0x"; for (var i = 0; i < 64; i++) h += "0123456789abcdef"[(Math.random() * 16) | 0]; return h; }
  function lotStatus(lot) { if (lot.claimedAt) return "claimed"; return now() >= lot.unlockAt ? "claimable" : "locked"; }
  var ledgerApi = {
    get: function () { return ledger; },
    save: save,
    reset: function () { ledger = freshLedger(); save(); },
    connect: function () { ledger.wallet.connected = true; save(); },
    disconnect: function () { ledger.wallet.connected = false; save(); },
    setNetwork: function (n) { ledger.wallet.network = n; save(); },
    approve: function (amt) { ledger.allowance = amt; save(); },
    swap: function (amt) {
      var t0 = now();
      var lot = { id: "L" + t0.toString(36), amount: amt, swappedAt: t0, unlockAt: t0 + config.lockDays * DAY, claimedAt: null, txSwap: fakeTx(), txClaim: null };
      ledger.oldCT = Math.max(0, +(ledger.oldCT - amt).toFixed(6));
      ledger.allowance = Math.max(0, +(ledger.allowance - amt).toFixed(6));
      ledger.wallet.kaia = Math.max(0, +(ledger.wallet.kaia - 0.012).toFixed(4));
      ledger.lots.unshift(lot); save(); return lot;
    },
    claim: function (id) {
      var lot = ledger.lots.filter(function (l) { return l.id === id; })[0];
      if (!lot || lotStatus(lot) !== "claimable") return null;
      lot.claimedAt = now(); lot.txClaim = fakeTx(); ledger.newCT = +(ledger.newCT + lot.amount).toFixed(6);
      ledger.wallet.kaia = Math.max(0, +(ledger.wallet.kaia - 0.006).toFixed(4));
      save(); return lot;
    },
    lotStatus: lotStatus,
    totals: function () {
      var r = { locked: 0, claimable: 0, claimed: 0 };
      ledger.lots.forEach(function (l) { r[lotStatus(l)] += l.amount; });
      return r;
    }
  };

  // ---------- window ----------
  function windowState() {
    var n = now();
    if (n < config.windowStart) return "upcoming";
    if (n >= config.windowEnd) return "closed";
    return "open";
  }

  // ---------- icons (one stroke style, 1.75 px) ----------
  var P = {
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5v.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17v.01"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    swap: '<path d="M4 8h13"/><path d="M14 4l4 4-4 4"/><path d="M20 16H7"/><path d="M10 12l-4 4 4 4"/>',
    wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v4"/><path d="M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z"/><path d="M16 14h.01"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17v.01"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>'
  };
  function icon(name, size) {
    var s = size || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || "") + "</svg>";
  }

  // ---------- swap track ----------
  // lot: {amount, swappedAt, unlockAt, claimedAt} or null for the explainer version.
  function track(el, lot, opts) {
    opts = opts || {};
    var status = lot ? lotStatus(lot) : "demo";
    var days = config.lockDays, html = "";
    var elapsed = lot ? Math.max(0, Math.min(days, (now() - lot.swappedAt) / DAY)) : (opts.demoDays || 0);
    for (var i = 0; i < days; i++) {
      var cls = "track-day";
      if (status === "claimable" || status === "claimed" || elapsed >= i + 1) cls += " is-full";
      else if (elapsed > i) { cls += " is-today"; }
      var part = elapsed > i && elapsed < i + 1 ? ' style="--part:' + Math.round((elapsed - i) * 100) + '%"' : "";
      html += '<span class="' + cls + '"' + part + "></span>";
    }
    var amt = lot ? amount(lot.amount) : (opts.amountText || "");
    var leftCap = lot ? t("track.swapped", { date: date(lot.swappedAt) }) : t("track.left");
    var rightCap = !lot ? t("track.right") : status === "claimed" ? t("track.claimed", { date: date(lot.claimedAt) }) : status === "claimable" ? t("track.ready") : t("track.unlocks", { date: date(lot.unlockAt) });
    var mid = !lot ? t("track.mid", { days: days }) : status === "locked" ? t("track.left_days", { rel: rel(lot.unlockAt) }) : status === "claimable" ? t("track.mid_ready") : t("track.mid_done");
    el.className = "track" + (opts.large ? " track-lg" : "") + (status === "claimable" ? " is-ready" : "") + (status === "claimed" ? " is-claimed" : "");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", t("track.aria", { amount: amt, mid: mid, right: rightCap }));
    el.innerHTML =
      '<div class="track-end"><span class="track-cap">' + leftCap + '</span><span class="track-amt"><span class="num">' + amt + '</span> <span class="track-unit">' + t("unit.old") + "</span></span></div>" +
      '<div class="track-end r"><span class="track-cap">' + rightCap + '</span><span class="track-amt"><span class="num">' + amt + '</span> <span class="track-unit">' + t("unit.new") + "</span></span></div>" +
      '<div class="track-rail">' + html + "</div>" +
      '<div class="track-mid">' + icon(status === "claimable" || status === "claimed" ? "unlock" : "lock", 14) + "<span>" + mid + "</span></div>";
  }

  // ---------- toasts and copy ----------
  function toast(msg, action) {
    var host = document.querySelector(".toasts");
    if (!host) { host = document.createElement("div"); host.className = "toasts"; host.setAttribute("aria-live", "polite"); document.body.appendChild(host); }
    var el = document.createElement("div"); el.className = "toast"; el.innerHTML = "<span></span>"; el.firstChild.textContent = msg;
    if (action) { var b = document.createElement("button"); b.className = "btn"; b.type = "button"; b.textContent = action.label; b.onclick = function () { action.run(); el.remove(); }; el.appendChild(b); }
    host.appendChild(el); setTimeout(function () { el.remove(); }, action ? 6000 : 3000);
  }
  function copy(text) {
    var done = function () { toast(t("toast.copied")); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done); else done();
  }
  // Address rows: <div class="addr" data-addr="old|new|swap"></div>
  function renderAddrs(root) {
    (root || document).querySelectorAll("[data-addr]").forEach(function (el) {
      var k = el.getAttribute("data-addr");
      var map = { old: config.oldToken.address, "new": config.newToken.address, swap: config.swapContract.address };
      var a = map[k], label = t("addr." + k);
      if (!a) { el.innerHTML = '<span class="addr-label">' + label + '</span><span class="addr-value addr-tba">' + t("addr.tba") + "</span>"; return; }
      el.innerHTML = '<span class="addr-label">' + label + '</span><span class="addr-value">' + a + '</span><span class="addr-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-copy="' + a + '" aria-label="' + t("addr.copy") + '">' + icon("copy", 16) + "</button>" +
        '<a class="btn btn-ghost btn-sm" href="' + config.explorer + "/token/" + a + '" target="_blank" rel="noopener" aria-label="' + t("addr.explorer") + '">' + icon("ext", 16) + "</a></span>";
    });
  }
  document.addEventListener("click", function (e) {
    var c = e.target.closest("[data-copy]"); if (c) copy(c.getAttribute("data-copy"));
  });

  // ---------- keyboard: Esc closes open help popovers ----------
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") document.querySelectorAll("details.help[open]").forEach(function (d) { d.removeAttribute("open"); });
  });
  document.addEventListener("click", function (e) {
    document.querySelectorAll("details.help[open]").forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute("open"); });
  });

  window.CJ = {
    config: config, params: params, DAY: DAY, now: now,
    dict: dict, t: t, lang: function () { return lang; }, setLang: setLang, applyI18n: applyI18n,
    fmt: { amount: amount, compact: compact, pct: pct, date: date, dateTime: dateTime, rel: rel, addr: shortAddr },
    parseAmount: parseAmount, ledger: ledgerApi, windowState: windowState,
    icon: icon, track: track, toast: toast, copy: copy, renderAddrs: renderAddrs, fakeTx: fakeTx,
    state: params.get("state")
  };
  document.documentElement.lang = lang;
})();
