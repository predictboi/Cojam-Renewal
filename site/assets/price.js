// New CT price from its DEX pool. Load after system.js on pages that show a price.
// Source: GeckoTerminal's public pool endpoint (CORS open). The pool is set in CJ.config.pool.link: any link or text
// that contains the pool address works (GeckoTerminal, DexScreener or a DEX page). Without a pool nothing is shown.
//
// Review: ?price=demo shows a labelled sample price; ?pool=<link or address> reads any pool before it is configured.
//   CJ.price.get()          -> last price or null: { usd, change24h, liquidityUsd, volume24hUsd, pair, link, at, sample }
//   CJ.price.status()       -> "none" (no pool yet) | "loading" | "ok" | "error"
//   CJ.price.value(ct)      -> USD value of an amount of new CT, or null without a price
//   CJ.price.usd(v)         -> "$0.01234" style text sized to the price
//   document event "cj:price" fires after every change.
// Refreshes every 60 s while the tab is visible; the last good price is kept in sessionStorage for 60 s so page changes
// do not refetch. A failed read keeps the last good price and marks it stale, never a made up number.
(function () {
  var CJ = window.CJ; if (!CJ) return;
  var API = "https://api.geckoterminal.com/api/v2/networks/";
  var KEY = "cj-price-v1", TTL = 60000, EVERY = 60000;
  var cfg = CJ.config.pool || {}, demo = CJ.params.get("price") === "demo";
  // ?pool=<link or address> tries a pool before it is written into the config (review and launch day checks).
  // Ignored once a pool is configured, and a price read this way is always labelled as a sample.
  var trial = !cfg.link && !!CJ.params.get("pool");
  var link = cfg.link || CJ.params.get("pool");
  var addr = (String(link || "").match(/0x[0-9a-fA-F]{40}/) || [null])[0];
  var state = demo ? "ok" : addr ? "loading" : "none", last = null, timer = null;

  function emit() { document.dispatchEvent(new CustomEvent("cj:price", { detail: last })); }
  function fromCache() {
    try { var c = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (c && c.pair === addr && Date.now() - c.at < TTL) return c; } catch (e) {}
    return null;
  }
  function toCache(p) { try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

  // Which side of the pool is new CT: match the token address when it is known, else the side whose symbol is CT.
  function pick(d) {
    var a = d.attributes, rel = d.relationships || {}, me = (CJ.config.newToken.address || "").toLowerCase();
    var base = ((rel.base_token || {}).data || {}).id || "", quote = ((rel.quote_token || {}).data || {}).id || "";
    var isQuote = me ? quote.toLowerCase().indexOf(me) > -1 : /^[^/]*\/\s*CT\b/.test(a.name || "") && !/^\s*CT\b/.test(a.name || "");
    var usd = parseFloat(isQuote ? a.quote_token_price_usd : a.base_token_price_usd);
    var ch = a.price_change_percentage && !isQuote ? parseFloat(a.price_change_percentage.h24) : null; // the 24 h change is for the base side
    return { usd: usd, change24h: isFinite(ch) ? ch : null, liquidityUsd: parseFloat(a.reserve_in_usd) || null,
      volume24hUsd: a.volume_usd ? parseFloat(a.volume_usd.h24) || null : null, pair: addr, link: link, at: Date.now(), sample: trial };
  }
  function load() {
    if (document.hidden) return;
    fetch(API + (cfg.network || "kaia") + "/pools/" + addr, { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var p = pick(j.data); if (!(p.usd > 0)) throw new Error("no price");
        last = p; state = "ok"; toCache(p); emit();
      })
      .catch(function () { state = last ? "ok" : "error"; if (last) last.stale = true; emit(); });
  }
  if (demo) {
    last = { usd: 0.01234, change24h: 4.2, liquidityUsd: 182400, volume24hUsd: 41250, pair: null, link: null, at: Date.now(), sample: true };
  } else if (addr) {
    last = fromCache(); if (last) state = "ok";
    if (!last) load();
    timer = setInterval(load, EVERY);
    document.addEventListener("visibilitychange", function () { if (!document.hidden && (!last || Date.now() - last.at > TTL)) load(); });
  }

  function usd(v) {
    if (v == null || !isFinite(v)) return "";
    var d = v >= 100 ? 0 : v >= 1 ? 2 : v >= 0.01 ? 4 : 6;
    return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  }
  CJ.price = {
    get: function () { return last; },
    status: function () { return state; },
    value: function (ct) { return last && last.usd > 0 ? ct * last.usd : null; },
    usd: usd,
    poolUrl: function () { return last && last.link ? last.link : addr ? "https://www.geckoterminal.com/" + (cfg.network || "kaia") + "/pools/" + addr : null; }
  };
  // A small price pill for page heads: "New CT $0.0123 +4.2%", linking to the pool. Hidden while there is no price.
  function mount(el) {
    if (!el) return;
    function paint() {
      var p = last, ok = state === "ok" && p && p.usd > 0;
      el.hidden = !ok; if (!ok) { el.innerHTML = ""; return; }
      var ch = p.change24h, url = CJ.price.poolUrl();
      var inner = '<span class="cj-price-k">' + CJ.t("price.label") + '</span> <span class="num">' + usd(p.usd) + "</span>" +
        (ch == null ? "" : ' <span class="cj-price-ch ' + (ch >= 0 ? "is-up" : "is-down") + '">' + (ch >= 0 ? "+" : "\u2212") + Math.abs(ch).toFixed(1) + "%</span>") +
        (p.sample ? ' <span class="tag">' + CJ.t("price.sample") + "</span>" : "");
      el.innerHTML = url ? '<a class="cj-price" href="' + url + '" target="_blank" rel="noopener" aria-label="' + CJ.t("price.aria") + '">' + inner + "</a>" : '<span class="cj-price">' + inner + "</span>";
    }
    paint();
    document.addEventListener("cj:price", paint);
    document.addEventListener("cj:lang", paint);
  }
  CJ.price.mount = mount;
  setTimeout(emit, 0);
})();
