// Cojam shared system: config, i18n, mock ledger, mock clock, formatters, amount parser, swap track, toasts.
// Mock only: nothing here talks to a chain. Load order on every page: system.js, i18n/shell.js and shell.js right after
// <div id="cj-top"></div> (so the header is in the first paint), then motion.js, wallet.js, i18n/<page>.js and the page script
// at the end of <body>.
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
    // Exact supply, checked on chain: 4083262533956000100000000000 base units. Use supplyText wherever the figure is shown.
    newToken: { name: "Cojam Token", symbol: "CT", decimals: 18, address: null, supply: 4083262533.9560001, supplyText: "4,083,262,533.9560001" },
    swapContract: { address: null },
    // New CT price source: the DEX pool, read through GeckoTerminal (CORS open, about 30 requests a minute per visitor).
    // Paste the pool link or its address when the pool exists, e.g. "https://www.geckoterminal.com/kaia/pools/0x...".
    // Until then no price is shown anywhere. ?price=demo shows a labelled sample price for review.
    pool: { network: "kaia", link: null },
    ratio: 1,
    instantPercent: 10, // paid in the swap transaction; the rest is locked
    lockDays: 7,
    keeperDelayMin: 30, // mock keeper sends an unlocked lot this long after unlock
    // Mock window. Launch is the swap contract's deploy date; the window is open for 1 year from it.
    windowStart: Date.UTC(2026, 11, 1),
    windowEnd: Date.UTC(2027, 11, 1),
    oldHolders: 22500, // old CT holder addresses, for "share of holders who swapped"
    // Fee payer limits: the sponsor server's defaults (server/src/config.js, set by SENDER_DAILY_TX_LIMIT, DAILY_BUDGET_KAIA,
    // MIN_FEE_PAYER_BALANCE_KAIA and MIN_SPONSORED_OLD_CT in server/.env). Configuration, not data: change both together.
    sponsor: { walletTxPerDay: 10, dailyBudgetKaia: 50, balanceFloorKaia: 5, minOldCt: 1 },
    officialUrl: "https://cojam.app",
    since: 2019
  };

  // ---------- mock clock (?days=8 moves time forward) ----------
  var offset = (parseFloat(params.get("days")) || 0) * DAY;
  // The prototype pretends today is inside the window so every state can be shown.
  var baseNow = Math.max(Date.now(), config.windowStart + 12 * DAY + 14.25 * 3600000); // mid afternoon UTC so daily figures look natural
  function now() { return baseNow + offset + (Date.now() - loadedAt); }
  var loadedAt = Date.now();

  // ---------- i18n ----------
  var SUPPORTED = ["en", "ko", "ja"];
  var dicts = { en: {}, ko: {}, ja: {} };
  // A dictionary that loads after the shell (the page's own i18n file at the end of <body>) re-applies data-i18n and the
  // address rows at once, before the page script runs, so the static markup is translated in the first paint.
  function dict(d) {
    SUPPORTED.forEach(function (l) { if (d[l]) Object.assign(dicts[l], d[l]); });
    if (document.body) { applyI18n(); renderAddrs(); }
  }
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
  function compact(n) { return new Intl.NumberFormat(loc(), { notation: "compact", maximumFractionDigits: 1 }).format(n); }
  function pct(n, dp) { return new Intl.NumberFormat(loc(), { style: "percent", maximumFractionDigits: dp == null ? 1 : dp }).format(n); }
  function date(ts) { return new Intl.DateTimeFormat(loc(), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(ts); }
  function dateTime(ts) { return new Intl.DateTimeFormat(loc(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(ts); }
  // "Dec 6, 10:14 UTC": a lot's swap time, so two lots from the same day are told apart. 24 hour clock in every language.
  function lotTime(ts) { return new Intl.DateTimeFormat(loc(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC", timeZoneName: "short" }).format(ts); }
  function rel(ts) {
    var diff = ts - now(), abs = Math.abs(diff);
    var rtf = new Intl.RelativeTimeFormat(loc(), { numeric: "auto" });
    // Round first, then pick the unit, so 59.6 minutes reads "1 hour ago" and never "60 minutes ago".
    if (Math.round(abs / 1000) < 60) return rtf.format(Math.round(diff / 1000), "second");
    if (Math.round(abs / 60000) < 60) return rtf.format(Math.round(diff / 60000), "minute");
    if (Math.round(abs / 3600000) < 24) return rtf.format(Math.round(diff / 3600000), "hour");
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

  // ---------- 10% now, 90% after the lock ----------
  // Same rule as the contract: instant = 10% rounded down to the smallest unit, locked = the rest, so nothing is lost.
  // The mock works in micro units (6 decimals); the contract does the same in wei.
  function split(amt) {
    var u = Math.round((+amt || 0) * 1e6), i = Math.floor(u * config.instantPercent / 100);
    return { instant: i / 1e6, locked: (u - i) / 1e6 };
  }

  // ---------- mock ledger ----------
  // v2: lots carry instant and locked parts and a release (keeper or holder). v1 ledgers are ignored.
  var KEY = "cj.ledger.v2";
  var KEEPER_MS = config.keeperDelayMin * 60000;
  function freshLedger() {
    return {
      // kind: the wallet app chosen (kaia, mm, wc). Gas: Kaia Wallet and WalletConnect are fee delegated, MetaMask pays in KAIA.
      wallet: { connected: false, address: "0x3fA9c2E07b1d4C6e8A52bD90f1e7C4a6D2b8E915", network: "kaia", kaia: 2.48, kind: null },
      oldCT: 125000,
      newCT: 0,
      allowance: 0,
      lots: [], // {id, amount, instant, locked, swappedAt, unlockAt, releasedAt, releasedBy, txSwap, txRelease}
      contract: { paused: false, reserveEmpty: false, sponsorDown: false }
    };
  }
  if (params.get("reset") === "1") { try { localStorage.removeItem(KEY); } catch (e) {} }
  var ledger;
  try { ledger = JSON.parse(localStorage.getItem(KEY)) || freshLedger(); } catch (e) { ledger = freshLedger(); }
  if (document.body && document.body.getAttribute("data-page") === "swap") {
    var st = params.get("state"), on = st ? st !== "disconnected" : !!(ledger.wallet && ledger.wallet.connected);
    document.documentElement.setAttribute("data-wallet", on ? "on" : "off");
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(ledger)); } catch (e) {} }
  function save() { persist(); emit(); }
  function emit() { document.dispatchEvent(new CustomEvent("cj:ledger", { detail: ledger })); }
  function fakeTx() { var h = "0x"; for (var i = 0; i < 64; i++) h += "0123456789abcdef"[(Math.random() * 16) | 0]; return h; }
  // Mock keeper: a lot still locked at unlockAt + 30 minutes is released to its owner then. Applied lazily on read,
  // credited once, and saved without an event so a render never triggers another render.
  function settle() {
    var n = now(), changed = false;
    ledger.lots.forEach(function (l) {
      if (l.releasedAt || n < l.unlockAt + KEEPER_MS) return;
      l.releasedAt = l.unlockAt + KEEPER_MS; l.releasedBy = "keeper"; l.txRelease = fakeTx();
      ledger.newCT = +(ledger.newCT + l.locked).toFixed(6); changed = true;
    });
    if (changed) persist();
  }
  // Works for ledger lots and for any lot shaped object (admin, previews).
  function lotStatus(lot) {
    if (ledger.lots.indexOf(lot) > -1) settle();
    if (lot.releasedAt) return "released";
    return now() >= lot.unlockAt ? "releasing" : "locked";
  }
  var ledgerApi = {
    get: function () { settle(); return ledger; },
    save: save,
    persist: persist, // store without the cj:ledger event (a view marking something as seen while it renders)
    reset: function () { ledger = freshLedger(); save(); },
    connect: function () { ledger.wallet.connected = true; save(); },
    disconnect: function () { ledger.wallet.connected = false; save(); },
    setNetwork: function (n) { ledger.wallet.network = n; save(); },
    approve: function (amt) { ledger.allowance = amt; save(); },
    // Called only once the mock chain confirms the swap: the 10% lands in the wallet in the same transaction.
    swap: function (amt) {
      var t0 = now(), sp = split(amt);
      var lot = { id: "L" + t0.toString(36), amount: amt, instant: sp.instant, locked: sp.locked, swappedAt: t0, unlockAt: t0 + config.lockDays * DAY,
        releasedAt: null, releasedBy: null, txSwap: fakeTx(), txRelease: null };
      ledger.oldCT = Math.max(0, +(ledger.oldCT - amt).toFixed(6));
      ledger.newCT = +(ledger.newCT + sp.instant).toFixed(6);
      ledger.allowance = Math.max(0, +(ledger.allowance - amt).toFixed(6));
      ledger.lots.unshift(lot); save(); return lot;
    },
    // The holder releases an unlocked lot before the keeper does. Pays the owner, never anyone else.
    claim: function (id) {
      settle();
      var lot = ledger.lots.filter(function (l) { return l.id === id; })[0];
      if (!lot || lotStatus(lot) !== "releasing") return null;
      lot.releasedAt = now(); lot.releasedBy = "you"; lot.txRelease = fakeTx();
      ledger.newCT = +(ledger.newCT + lot.locked).toFixed(6);
      save(); return lot;
    },
    lotStatus: lotStatus,
    // instant: every 10% already paid; locked, releasing, released: the 90% parts by status.
    totals: function () {
      settle();
      var r = { instant: 0, locked: 0, releasing: 0, released: 0 };
      ledger.lots.forEach(function (l) { r.instant += l.instant; r[lotStatus(l)] += l.locked; });
      return r;
    }
  };

  // When a lot was swapped: the date, plus the time (UTC) when this wallet has another lot from the same UTC day,
  // so two lots are always told apart without crowding every caption with a time.
  function swapWhen(lot) {
    var d = Math.floor(lot.swappedAt / DAY);
    var twin = ledger.lots.some(function (l) { return l !== lot && l.id !== lot.id && Math.floor(l.swappedAt / DAY) === d; });
    return twin ? lotTime(lot.swappedAt) : date(lot.swappedAt);
  }

  // ---------- window ----------
  // Whole days left in the swap window (or until ts). One formula for every page: swap, status and admin say the same number.
  function daysLeft(ts) { return Math.floor(((ts == null ? config.windowEnd : ts) - now()) / DAY); }
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
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    swap: '<path d="M4 8h13"/><path d="M14 4l4 4-4 4"/><path d="M20 16H7"/><path d="M10 12l-4 4 4 4"/>',
    wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v4"/><path d="M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z"/><path d="M16 14h.01"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17v.01"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
  };
  function icon(name, size) {
    var s = size || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || "") + "</svg>";
  }

  // ---------- swap track ----------
  // Reads left to right: old CT swapped, the 10% block paid at once, the 7 day rail for the 90%, the 90% at the right end.
  // lot: {amount, instant, locked, swappedAt, unlockAt, releasedAt, releasedBy} or null for the explainer version,
  // which takes opts.amount (number) and opts.demoDays.
  function track(el, lot, opts) {
    opts = opts || {};
    var status = lot ? lotStatus(lot) : "demo";
    var days = config.lockDays, html = "";
    var total = lot ? lot.amount : (opts.amount || 0);
    var sp = lot && lot.instant != null ? { instant: lot.instant, locked: lot.locked } : split(total);
    var done = status === "releasing" || status === "released";
    var elapsed = lot ? Math.max(0, Math.min(days, (now() - lot.swappedAt) / DAY)) : (opts.demoDays || 0);
    for (var i = 0; i < days; i++) {
      var cls = "track-day";
      if (done || elapsed >= i + 1) cls += " is-full";
      else if (elapsed > i) cls += " is-today";
      var part = !done && elapsed > i && elapsed < i + 1 ? ' style="--part:' + (elapsed - i).toFixed(3) + '"' : "";
      html += '<span class="' + cls + '"' + part + "></span>";
    }
    var by = lot && lot.releasedBy === "you" ? "track.by_you" : lot && lot.releasedBy === "holder" ? "track.by_holder" : "track.by_keeper";
    var leftCap = lot ? t("track.swapped", { date: swapWhen(lot) }) : t("track.left");
    var nowCap = lot ? t("track.now_done") : t("track.now");
    var rightCap = status === "demo" ? t("track.right", { days: days })
      : status === "locked" ? t("track.unlocks", { date: date(lot.unlockAt) })
      : status === "releasing" ? t("track.sending")
      : t("track.released", { date: date(lot.releasedAt) });
    var mid = status === "demo" ? t("track.mid", { days: days })
      : status === "locked" ? t("track.left_days", { rel: rel(lot.unlockAt) })
      : status === "releasing" ? t("track.mid_ready") : t(by);
    var a = amount(total), ai = amount(sp.instant), al = amount(sp.locked);
    el.className = "track" + (opts.large ? " track-lg" : "") + (status === "releasing" ? " is-ready" : "") + (status === "released" ? " is-released" : "");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", t("track.aria", { amount: a, instant: ai, locked: al, right: rightCap, mid: mid }));
    el.innerHTML =
      '<div class="track-end"><span class="track-cap">' + leftCap + '</span><span class="track-amt"><span class="num">' + a + '</span> <span class="track-unit">' + t("unit.old") + "</span></span></div>" +
      '<div class="track-end r"><span class="track-cap">' + rightCap + '</span><span class="track-amt"><span class="num">' + al + '</span> <span class="track-unit">' + t("unit.new") + "</span></span></div>" +
      '<div class="track-rail"><span class="track-now"></span>' + html + "</div>" +
      '<div class="track-foot"><span class="track-end track-instant"><span class="track-cap">' + nowCap + '</span><span class="track-amt"><span class="num">' + ai + '</span> <span class="track-unit">' + t("unit.new") + "</span></span></span>" +
      '<span class="track-mid">' + icon(status === "released" ? "check" : done ? "unlock" : "lock", 14) + "<span>" + mid + "</span></span></div>";
  }

  // ---------- sample data: one seeded set for status and admin ----------
  // Stands in for the swap contract's Migrated(user, lotId, ...) and Claimed(user, lotId, amount, caller) events until launch.
  // CJ.sample.lots(): every generated lot through the end of the mock day, oldest first, stable across reloads:
  //   {id, n (the wallet's nth request), wallet, kind (kaia | wc | mm), amount, instant, locked, swappedAt, unlockAt, releaseAt,
  //    releasedBy (keeper | holder), txSwap, txRelease}
  // CJ.sample.state(): the chain as it reads at CJ.now(). Lots gain status (locked | releasing | released), releasedAt and overdue.
  //   tot holds every sum twice: in CT (tot.swapped ...) and in micro CT integers (tot.u.swapped ...), so parts always add up.
  //   ?keeper=late stalls the keeper for lots unlocked in the last 6 hours; ?gas=low shortens the gas runway.
  var sampleCache = null;
  function hash32(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var x = a;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededHex(R, n) { var h = "0x"; for (var i = 0; i < n; i++) h += "0123456789abcdef"[(R() * 16) | 0]; return h; }
  // Day by day from the window start: a launch spike that settles to a steady trickle. Each day has its own seed,
  // so moving the mock clock adds days without changing earlier ones.
  function sampleLots() {
    var until = Math.floor(now() / DAY) * DAY + DAY - 1;
    if (sampleCache && sampleCache.until === until) return sampleCache.lots;
    var out = [], pool = [], perWallet = {};
    for (var d = 0; config.windowStart + d * DAY <= until && config.windowStart + d * DAY < config.windowEnd; d++) {
      var R = seeded(hash32("cj-admin-" + d)), n = Math.round(90 * Math.exp(-d / 5) + 12), day = [];
      for (var i = 0; i < n; i++) {
        var u = R(), amt;
        if (R() < 0.014) amt = 8e6 + Math.pow(R(), 1.6) * 140e6;          // a few very large swaps
        else {                                                             // log normal body: many small, some mid size
          var z = Math.sqrt(-2 * Math.log(Math.max(u, 1e-9))) * Math.cos(2 * Math.PI * R());
          amt = Math.max(25, Math.min(9.5e6, Math.pow(10, 4.1 + 1.05 * z)));
        }
        amt = amt < 1000 ? Math.round(amt * 100) / 100 : (R() < 0.6 ? Math.round(amt) : Math.round(amt * 100) / 100);
        var wallet;
        if (pool.length && R() < 0.3) wallet = pool[Math.floor(Math.pow(R(), 1.5) * pool.length)];
        else { wallet = seededHex(R, 40); pool.push(wallet); }
        var at = config.windowStart + d * DAY + Math.floor(R() * (DAY - 60000));
        // Release: most lots by the keeper a few minutes after unlock, some claimed first by the holder, a few sent late.
        var r = R(), by = r < 0.09 ? "holder" : "keeper";
        var delay = by === "holder" ? (2 + R() * 20) * 60000 : r > 0.975 ? (70 + R() * 230) * 60000 : (4 + R() * 24) * 60000;
        var unlock = at + config.lockDays * DAY, sp = split(amt), kind = R() < 0.78 ? (R() < 0.85 ? "kaia" : "wc") : "mm";
        day.push({ wallet: wallet, amount: amt, instant: sp.instant, locked: sp.locked, kind: kind, swappedAt: at, unlockAt: unlock,
          releaseAt: unlock + delay, releasedBy: by, txSwap: seededHex(R, 64), txRelease: seededHex(R, 64) });
      }
      day.sort(function (a, b) { return a.swappedAt - b.swappedAt; });
      day.forEach(function (l) { perWallet[l.wallet] = (perWallet[l.wallet] || 0) + 1; l.n = perWallet[l.wallet]; l.id = out.length + 1; out.push(l); });
    }
    sampleCache = { until: until, lots: out };
    return out;
  }
  function micro(v) { return Math.round(v * 1e6); }
  var FEE = { approve: 0.004, swap: 0.012, release: 0.006 };
  function sampleState(opts) {
    opts = opts || {};
    var keeperLate = opts.keeperLate != null ? opts.keeperLate : params.get("keeper") === "late";
    var gasLow = opts.gasLow != null ? opts.gasLow : params.get("gas") === "low";
    var n = now(), HOUR = 3600000, lots = [], wallets = {};
    var U = { swapped: 0, instant: 0, locked: 0, releasing: 0, released: 0, overdue: 0 };
    var tot = { nLocked: 0, nReleasing: 0, nReleased: 0, byKeeper: 0, byHolder: 0, nOverdue: 0 };
    sampleLots().forEach(function (r) {
      if (r.swappedAt > n) return;
      var due = keeperLate && r.releasedBy === "keeper" && r.unlockAt > n - 6 * HOUR ? Infinity : r.releaseAt;
      var rel = due <= n;
      var l = { id: r.id, n: r.n, wallet: r.wallet, kind: r.kind, amount: r.amount, instant: r.instant, locked: r.locked, swappedAt: r.swappedAt, unlockAt: r.unlockAt,
        releasedAt: rel ? r.releaseAt : null, releasedBy: rel ? r.releasedBy : null, txSwap: r.txSwap, txRelease: rel ? r.txRelease : null };
      l.status = rel ? "released" : (n >= l.unlockAt ? "releasing" : "locked");
      l.overdue = l.status === "releasing" && n - l.unlockAt > HOUR;
      lots.push(l);
      var w = wallets[l.wallet] || (wallets[l.wallet] = { addr: l.wallet, total: 0, lots: [], instant: 0, locked: 0, releasing: 0, released: 0, u: { total: 0, instant: 0, locked: 0, releasing: 0, released: 0 } });
      w.u.total += micro(l.amount); w.u.instant += micro(l.instant); w.u[l.status] += micro(l.locked); w.lots.push(l);
      U.swapped += micro(l.amount); U.instant += micro(l.instant); U[l.status] += micro(l.locked);
      tot["n" + l.status.charAt(0).toUpperCase() + l.status.slice(1)]++;
      if (l.releasedBy === "keeper") tot.byKeeper++; else if (l.releasedBy === "holder") tot.byHolder++;
      if (l.overdue) { U.overdue += micro(l.locked); tot.nOverdue++; }
    });
    Object.keys(U).forEach(function (k) { tot[k] = U[k] / 1e6; });
    tot.u = U;
    var walletList = Object.keys(wallets).map(function (k) {
      var w = wallets[k]; ["total", "instant", "locked", "releasing", "released"].forEach(function (f) { w[f] = w.u[f] / 1e6; }); return w;
    });
    return { now: n, lots: lots, wallets: wallets, walletList: walletList, tot: tot, gas: gasWallet(lots, n, gasLow), holders: config.oldHolders };
  }
  // Gas wallet (sample): every fee delegated approve and swap, every holder claim from a fee delegated wallet, every keeper release.
  function gasWallet(lots, n, gasLow) {
    var today = Math.floor(n / DAY) * DAY, g = { tx: 0, kaia: 0, txToday: 0, kaiaToday: 0, releasesToday: 0, week: 0 };
    function add(at, fee, release) {
      g.tx++; g.kaia += fee;
      if (at >= today) { g.txToday++; g.kaiaToday += fee; if (release) g.releasesToday++; }
      if (at >= n - 7 * DAY) g.week += fee;
    }
    lots.forEach(function (l) {
      var free = l.kind !== "mm";
      if (free) { add(l.swappedAt - 60000, FEE.approve); add(l.swappedAt, FEE.swap); }
      if (l.releasedAt && (l.releasedBy === "keeper" || free)) add(l.releasedAt, FEE.release, l.releasedBy === "keeper");
    });
    var days = Math.min(7, Math.max(1, (n - config.windowStart) / DAY));
    g.rate = (n - config.windowStart >= 7 * DAY ? g.week / 7 : g.kaia / days);
    g.balance = Math.max(0, (gasLow ? g.kaia + g.rate * 4.2 : 60) - g.kaia);
    g.runway = g.rate > 0 ? g.balance / g.rate : Infinity;
    return g;
  }
  // Whole CT parts that add up: largest remainder rounding of micro CT parts to a whole number total.
  // wholeParts([u1, u2, u3]) -> [w1, w2, w3] with w1 + w2 + w3 === Math.round((u1 + u2 + u3) / 1e6), or === target when given
  // (to split a figure already shown elsewhere into parts that sum to it exactly).
  function wholeParts(us, target) {
    var total = 0; us.forEach(function (u) { total += u; });
    if (target == null) target = Math.round(total / 1e6);
    var floors = us.map(function (u) { return Math.floor(u / 1e6); }), sum = 0;
    floors.forEach(function (f) { sum += f; });
    var order = us.map(function (u, i) { return { i: i, r: u - floors[i] * 1e6 }; }).sort(function (a, b) { return b.r - a.r; });
    for (var k = 0; sum < target && order.length; k = (k + 1) % order.length) { floors[order[k].i]++; sum++; }
    for (k = order.length - 1; sum > target && k >= 0; k--) { if (floors[order[k].i] > 0) { floors[order[k].i]--; sum--; } }
    return floors;
  }
  // Shares that add up to exactly 100% at the given decimals (largest remainder).
  function shares(vals, dp) {
    var scale = Math.pow(10, (dp == null ? 1 : dp) + 2), total = 0; vals.forEach(function (v) { total += v; });
    if (!total) return vals.map(function () { return 0; });
    var raw = vals.map(function (v) { return v / total * scale; }), fl = raw.map(Math.floor), sum = 0;
    fl.forEach(function (f) { sum += f; });
    raw.map(function (r, i) { return { i: i, r: r - fl[i] }; }).sort(function (a, b) { return b.r - a.r; }).forEach(function (o) { if (sum < scale) { fl[o.i]++; sum++; } });
    return fl.map(function (f) { return f / scale; });
  }

  // ---------- aggregate swap track (status) ----------
  // The same parts as the lot track. d: {swapped, instant, locked, released, days: [7 amounts, tick 1 = swapped in the last day,
  // tick 7 = unlocks next], labels: {left, right, now, mid, aria, axisStart, axisEnd}} with amounts already formatted.
  function trackAggregate(el, d) {
    var max = 0, html = "";
    d.days.forEach(function (v) { if (v > max) max = v; });
    d.days.forEach(function (v) {
      var lv = v > 0 && max > 0 ? Math.max(0.08, v / max) : 0;
      html += '<span class="track-day" style="--lv:' + lv.toFixed(3) + '"></span>';
    });
    var L = d.labels;
    el.className = "track track-lg track-agg";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", L.aria);
    el.innerHTML =
      '<div class="track-end"><span class="track-cap">' + L.left + '</span><span class="track-amt"><span class="num">' + d.swapped + '</span> <span class="track-unit">' + t("unit.old") + "</span></span></div>" +
      '<div class="track-end r"><span class="track-cap">' + L.right + '</span><span class="track-amt"><span class="num">' + d.locked + '</span> <span class="track-unit">' + t("unit.new") + "</span></span></div>" +
      '<div class="track-rail"><span class="track-now"></span>' + html + "</div>" +
      '<div class="track-axis" aria-hidden="true"><span></span><span>' + L.axisStart + '</span><span></span><span></span><span></span><span></span><span></span><span>' + L.axisEnd + "</span></div>" +
      '<div class="track-foot"><span class="track-end track-instant"><span class="track-cap">' + L.now + '</span><span class="track-amt"><span class="num">' + d.instant + '</span> <span class="track-unit">' + t("unit.new") + "</span></span></span>" +
      '<span class="track-mid">' + icon("check", 14) + "<span>" + L.mid + "</span></span></div>";
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

  // An opened help popover scrolls fully into view, above a stuck bottom bar and below the sticky header,
  // so a toggle near the screen edge never opens off screen.
  document.addEventListener("toggle", function (e) {
    var d = e.target;
    if (!d.matches || !d.matches("details.help") || !d.open) return;
    requestAnimationFrame(function () {
      var pop = d.querySelector(".help-pop"); if (!pop) return;
      // layout height, not the rect: the open animation scales the popover in from its top edge
      var r0 = pop.getBoundingClientRect(), r = { top: r0.top, bottom: r0.top + pop.offsetHeight };
      var vv = window.visualViewport, top = vv ? vv.offsetTop : 0, h = vv ? vv.height : window.innerHeight;
      var bar = document.querySelector(".mg-sticky.is-stuck"), floor = top + h - (bar ? bar.offsetHeight : 0) - 12;
      var head = document.querySelector(".cj-header"), ceil = top + (head ? head.getBoundingClientRect().bottom : 0) + 12;
      var dy = r.bottom > floor ? r.bottom - floor : 0;
      if (r.top - dy < ceil) dy = r.top - ceil; // a tall popover: show its top
      if (Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }, true);

  window.CJ = {
    config: config, params: params, DAY: DAY, now: now,
    dict: dict, t: t, lang: function () { return lang; }, setLang: setLang, applyI18n: applyI18n,
    fmt: { amount: amount, compact: compact, pct: pct, date: date, dateTime: dateTime, lotTime: lotTime, swapWhen: swapWhen, rel: rel, addr: shortAddr },
    parseAmount: parseAmount, split: split, ledger: ledgerApi, windowState: windowState, daysLeft: daysLeft,
    icon: icon, track: track, trackAggregate: trackAggregate, toast: toast, copy: copy, renderAddrs: renderAddrs, fakeTx: fakeTx,
    sample: { lots: sampleLots, state: sampleState, wholeParts: wholeParts, shares: shares },
    state: params.get("state"),
    // The page script calls this after its first paint. Until then the CSS reserves the height of every container a
    // script fills (html:not(.cj-ready) rules in each page's CSS), so a slow network does not shift the layout.
    ready: function () { document.documentElement.classList.add("cj-ready"); }
  };
  document.documentElement.lang = lang;
})();
