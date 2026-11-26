/* Cojam Daily Prediction PWA: component library behaviour and the shared app shell.
   Screens call App.mount({...}) with HTML built from the C.* helpers below, so every screen uses the same header, tab bar,
   buttons, sheets and toasts. Mock only: nothing here talks to a chain or a server. */
(function () {
  "use strict";
  var I = window.CJ_I18N, t = I.t, M = window.MOCK;
  var qs = new URLSearchParams(location.search);
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var App = window.App = { state: qs.get("state") || "", lang: I.lang, t: t, reduce: reduce };
  var C = window.C = {};

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  App.esc = esc; App.$ = $; App.$$ = $$;
  App.store = {
    get: function (k, d) { try { var v = localStorage.getItem("cjp." + k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("cjp." + k, v); } catch (e) {} }
  };

  /* ---------- number and date formatting (one formatter for every screen) ---------- */
  var F = App.fmt = {
    int: function (n) { return Math.round(n).toLocaleString("en-US"); },
    pts: function (n) { return F.int(n) + "P"; },
    dec: function (n, d) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: d === undefined ? 4 : d }); },
    ct: function (n, d) { return F.dec(n, d) + " CT"; },
    kaia: function (n) { return F.dec(n, 4) + " KAIA"; },
    krw: function (ct) { return t("common.krw", { krw: F.int(ct * M.krwPerCt) }); },
    date: function (d, withTime) {
      var o = { month: "short", day: "numeric" }; if (withTime) { o.hour = "2-digit"; o.minute = "2-digit"; o.hour12 = false; }
      return new Intl.DateTimeFormat(App.lang, o).format(d);
    },
    dateLong: function (d) { return new Intl.DateTimeFormat(App.lang, { year: "numeric", month: "short", day: "numeric" }).format(d); },
    weekday: function (d) { return new Intl.DateTimeFormat(App.lang, { weekday: "short", month: "short", day: "numeric" }).format(d); },
    hms: function (s) { var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return [h, m, x].map(function (v) { return (v < 10 ? "0" : "") + v; }); },
    short: function (a) { return a.slice(0, 6) + "…" + a.slice(-4); },
    groups: function (a) { return a.replace(/^0x/, "").match(/.{1,4}/g).map(function (g, i) { return "<span>" + (i === 0 ? "0x" : "") + g + "</span>"; }).join(""); }
  };
  App.isKo = App.lang === "ko";

  /* ---------- icons: one stroke family, 24 grid ---------- */
  var IC = {
    cards: '<rect x="5" y="7" width="14" height="13" rx="3"/><path d="M8 3.5h8"/>',
    list: '<path d="M4 6.5l1.6 1.6L8.4 5"/><path d="M4 12.5l1.6 1.6 2.8-3.1"/><path d="M4 18.5l1.6 1.6 2.8-3.1"/><path d="M12 7h8M12 13h8M12 19h8"/>',
    podium: '<path d="M9 20V9h6v11"/><path d="M3 20v-6h6"/><path d="M15 12h6v8"/><path d="M2 20h20"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M15.5 13.5h1.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    left: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    right: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
    ext: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M18 14v3.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 17.5v-10A1.5 1.5 0 0 1 6.5 6H10"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    share: '<path d="M12 15V3.5"/><path d="M8 7l4-4 4 4"/><path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/>',
    more: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
    dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    addhome: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.8v.2"/>',
    warn: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5"/><path d="M12 17v.2"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    offline: '<path d="M3 3l18 18"/><path d="M5 12.5a10 10 0 0 1 3.2-2.2"/><path d="M12 8.5c2.7 0 5.2 1.1 7 3"/><path d="M8.5 16a5 5 0 0 1 5.6-1"/><path d="M12 19.5v.2"/>',
    tool: '<path d="M14.5 6.5a4 4 0 0 0-5.2 5.2L4 17v3h3l5.3-5.3a4 4 0 0 0 5.2-5.2L15 12l-3-3z"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 11l4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.200 1.900 7 5.500"/>',
    mail: '<rect x="3.5" y="5.500" width="17" height="13" rx="3"/><path d="M4.500 8l7.500 5 7.500-5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.500 12h17"/><path d="M12 3.500c2.400 2.500 3.600 5.300 3.600 8.500s-1.200 6-3.600 8.500c-2.400-2.500-3.600-5.300-3.600-8.500s1.200-6 3.600-8.500z"/>',
    swap: '<path d="M4 8h14"/><path d="M14 4l4 4-4 4"/><path d="M20 16H6"/><path d="M10 12l-4 4 4 4"/>',
    bolt: '<path d="M13 3L5 13.500h6L10 21l8-10.500h-6z"/>',
    phone: '<rect x="7" y="2.500" width="10" height="19" rx="3"/><path d="M11 18.500h2"/>',
    paste: '<rect x="6" y="5" width="12" height="15" rx="2.500"/><path d="M9.500 5V4h5v1"/><path d="M9.500 11h5M9.500 15h3"/>',
    search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4 4"/>',
    refresh: '<path d="M19 12a7 7 0 1 1-2.300-5.200"/><path d="M19 4.500v4h-4"/>',
    inbox: '<path d="M4 13.500l2.500-8h11l2.500 8"/><path d="M4 13.500V18a1.500 1.500 0 0 0 1.500 1.500h13A1.500 1.500 0 0 0 20 18v-4.500h-5a3 3 0 0 1-6 0z"/>',
    coin: '<circle cx="12" cy="12" r="8.500"/><path d="M9.500 8h3.500a2 2 0 0 1 0 4h-3.500zM9.500 12h4a2 2 0 0 1 0 4h-4zM9.500 8v8M11 6.500V8M11 16v1.500"/>',
    chart: '<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M14 7h4v4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600l1.400 1.400M17 17l1.400 1.400M18.400 5.600L17 7M7 17l-1.400 1.400"/>',
    ball: '<circle cx="12" cy="12" r="8.500"/><path d="M12 8.500l3.300 2.400-1.300 3.900h-4l-1.300-3.900zM12 3.500v5M20 10.500l-4.700.400M17 19l-3-4.200M7 19l3-4.200M4 10.500l4.700.400"/>',
    film: '<rect x="4" y="5" width="16" height="14" rx="2.500"/><path d="M8 5v14M16 5v14M4 9.500h4M4 14.500h4M16 9.500h4M16 14.500h4"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.500 2.500M15.500 15.500L18 18M18 6l-2.500 2.500M8.500 15.500L6 18"/>'
  };
  C.icon = function (name, size, cls) {
    size = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + (cls ? ' class="' + cls + '"' : "") + ">" + (IC[name] || "") + "</svg>";
  };
  var ic = C.icon;

  /* ---------- component builders (HTML strings) ---------- */
  C.btn = function (label, o) {
    o = o || {};
    var cls = "btn" + (o.kind ? " btn-" + o.kind : "") + (o.block ? " btn-block" : "") + (o.sm ? " btn-sm" : "") + (o.wrap ? " btn-wrap" : "") + (o.cls ? " " + o.cls : "");
    var inner = (o.loading ? '<span class="spin"></span>' : "") + (o.icon ? ic(o.icon, 18) : "") + "<span>" + label + "</span>" + (o.iconEnd ? ic(o.iconEnd, 18) : "");
    var attrs = (o.id ? ' id="' + o.id + '"' : "") + (o.attrs ? " " + o.attrs : "");
    if (o.href && !o.disabled) return '<a class="' + cls + '" href="' + o.href + '"' + (o.ext ? ' target="_blank" rel="noopener"' : "") + attrs + ">" + inner + "</a>";
    return '<button type="button" class="' + cls + (o.loading ? " is-loading" : "") + '"' + (o.disabled ? " disabled" : "") + attrs + ">" + inner + "</button>";
  };
  C.iconBtn = function (icon, label, attrs) { return '<button type="button" class="btn btn-icon" aria-label="' + esc(label) + '" ' + (attrs || "") + ">" + ic(icon, 18) + "</button>"; };
  C.seg = function (items, o) {
    o = o || {};
    return '<div class="seg" role="group" aria-label="' + esc(o.label || "") + '"' + (o.name ? ' data-seg="' + o.name + '"' : "") + ">" + items.map(function (it) {
      if (it.href) return '<a class="seg-btn" href="' + it.href + '"' + (it.on ? ' aria-current="page"' : "") + ">" + it.label + "</a>";
      return '<button type="button" class="seg-btn" data-value="' + esc(it.value) + '" aria-pressed="' + (it.on ? "true" : "false") + '"' + (o.disabled ? " disabled" : "") + ">" + it.label + "</button>";
    }).join("") + "</div>";
  };
  /* the signature: states is an array of 5 from "", done, pend, fail, miss, wait */
  C.day5 = function (states, o) {
    o = o || {};
    var n = states.filter(function (s) { return s === "done" || s === "pend"; }).length;
    return '<div class="day5' + (o.band ? " day5--band" : "") + (o.size ? " day5--" + o.size : "") + (o.ink ? " day5--ink" : "") + (o.cls ? " " + o.cls : "") + '" role="img" aria-label="' + esc(o.label || t("h.prog.sr", { n: n })) + '"' + (o.id ? ' id="' + o.id + '"' : "") + ">" +
      states.map(function (s, i) { return '<i style="--i:' + i + '"' + (s ? ' class="is-' + s + '"' : "") + ">" + (o.size === "lg" ? ic("check", 24) : "") + "</i>"; }).join("") + "</div>";
  };
  C.tag = function (text, kind, icon) { return '<span class="tag' + (kind ? " tag-" + kind : "") + '">' + (icon ? ic(icon, 14) : "") + text + "</span>"; };
  C.rows = function (rows) {
    return '<dl class="rows">' + rows.filter(Boolean).map(function (r) { return "<div" + (r[2] ? ' class="is-em"' : "") + "><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl>";
  };
  C.note = function (kind, html, action) {
    var icon = kind === "warn" || kind === "error" ? "warn" : kind === "ok" ? "check" : "info";
    return '<div class="note' + (kind ? " note-" + kind : "") + '"' + (kind === "error" ? ' role="alert"' : "") + ">" + ic(icon, 18) + '<div class="note-body"><div>' + html + "</div>" + (action || "") + "</div></div>";
  };
  C.addr = function (a, o) {
    o = o || {};
    return '<div class="addr' + (o.lg ? " addr--lg" : "") + '"><span class="addr-v" translate="no"' + (o.short ? ' aria-label="' + a + '"' : "") + ">" + (o.short ? F.short(a) : F.groups(a)) + "</span>" +
      C.iconBtn("copy", o.label || t("w.copy"), 'data-copy="' + a + '" data-toast="' + esc(o.toast || t("w.copied")) + '"') +
      (o.scan ? '<a class="btn btn-icon" href="https://kaiascan.io/address/' + a + '" target="_blank" rel="noopener" aria-label="' + esc(t("w.scan")) + '">' + ic("ext", 18) + "</a>" : "") + "</div>";
  };
  C.amount = function (o) {
    return '<div class="field"><div class="field-label"><label for="' + o.id + '"><b>' + o.label + "</b></label>" + (o.side ? "<span>" + o.side + "</span>" : "") + "</div>" +
      '<div class="field-box' + (o.error ? " is-error" : "") + (o.disabled ? " is-off" : "") + '"><input id="' + o.id + '" name="' + o.id + '" type="text" inputmode="' + (o.mode || "decimal") + '" autocomplete="off" spellcheck="false" placeholder="0" value="' + esc(o.value || "") + '"' + (o.disabled ? " disabled" : "") + ' aria-describedby="' + o.id + '-msg"' + (o.error ? ' aria-invalid="true"' : "") + ">" +
      '<span class="field-unit">' + o.unit + "</span>" + (o.max === false ? "" : '<button type="button" class="field-max" data-max="' + o.id + '"' + (o.disabled ? " disabled" : "") + ">" + t("s.max") + "</button>") + "</div>" +
      '<div class="field-msg' + (o.error ? " is-error" : "") + '" id="' + o.id + '-msg" aria-live="polite">' + (o.msg || "") + "</div></div>";
  };
  C.empty = function (o) {
    return '<div class="empty"><div class="empty-ic">' + ic(o.icon || "inbox", 32) + "</div><h2>" + o.title + "</h2>" + (o.body ? "<p>" + o.body + "</p>" : "") + (o.extra || "") + (o.action || "") + "</div>";
  };
  C.error = function (key) {
    return '<div class="card">' + C.note("error", t(key || "e.load"), C.btn(t("common.retry"), { sm: true, icon: "refresh", attrs: "data-reload" })) + "</div>";
  };
  C.skel = function (w, h, extra) { return '<span class="skel" style="width:' + w + ";height:" + (h || "14px") + ";" + (extra || "") + '"></span>'; };
  C.help = function (q, a, open) { return '<details class="help"' + (open ? " open" : "") + "><summary>" + q + ic("down", 18) + '</summary><div class="help-body">' + a + "</div></details>"; };
  C.stamp = function (n) { return '<p class="stamp"><span class="live-dot"></span><span data-stamp="' + (n || 4) + '">' + t("common.updated", { n: n || 4 }) + "</span></p>"; };
  C.lang = function () {
    return '<label class="select">' + ic("globe", 18) + '<span class="sr-only">' + t("lang.label") + '</span><select data-lang aria-label="' + esc(t("lang.label")) + '">' +
      I.langs.map(function (l) { return '<option value="' + l + '"' + (l === App.lang ? " selected" : "") + ">" + I.names[l] + "</option>"; }).join("") + "</select>" + ic("down", 16) + "</label>";
  };
  C.logo = function () { return '<span class="chip-logo"><img src="assets/cojam-mark.svg" alt="" width="26" height="26">Cojam</span>'; };
  C.steps = function (items) { return '<ol class="steps">' + items.map(function (s) { return "<li><span>" + s[0] + "</span>" + (s[1] ? ic(s[1], 22) : "<span></span>") + "</li>"; }).join("") + "</ol>"; };
  C.qr = function (text, label, mark) {
    return '<div class="qr" role="img" aria-label="' + esc(label) + '" data-qr="' + esc(text) + '">' + C.skel("100%", "auto") + (mark === false ? "" : '<span class="qr-mark"><img src="assets/cojam-mark.svg" alt="" width="32" height="32"></span>') + "</div>";
  };
  C.clock = function (secs, id) {
    var p = F.hms(secs);
    function g(v, u) { return '<div class="clock-g"><span>' + v + "</span><small>" + t(u) + "</small></div>"; }
    return '<div class="clock" data-cd="' + secs + '" data-cd-fmt="clock"' + (id ? ' id="' + id + '"' : "") + ' aria-hidden="true">' + g(p[0], "d.u.h") + "<i>:</i>" + g(p[1], "d.u.m") + "<i>:</i>" + g(p[2], "d.u.s") + "</div>" +
      '<p class="sr-only" data-cd-sr>' + t("d.next.sr", { h: +p[0], m: +p[1] }) + "</p>";
  };
  /* slim banner above the stack or list: text, optional spinner, optional action */
  C.banner = function (text, o) {
    o = o || {};
    return '<div class="banner' + (o.kind ? " banner-" + o.kind : "") + '" role="status">' + (o.spin ? '<span class="spin"></span>' : C.icon(o.icon || "info", 18)) + "<span>" + text + "</span>" + (o.btn ? C.btn(o.btn, { sm: true, attrs: o.attrs || "" }) : "") + "</div>";
  };
  /* play key and slow pick banners shared by H1 and H2 (spec H1, play key banners) */
  C.playBanner = function (state) {
    if (state === "slow") return C.banner(t("h.slow", { n: 1 }), { spin: true, btn: t("h.retrynow"), attrs: "data-retry-now" });
    if (state === "reconnect") return C.banner(t("h.reconnect"), { spin: true });
    if (state === "reconnectfail") return C.banner(t("h.reconnect.fail"), { kind: "warn", icon: "warn", btn: t("common.retry"), attrs: "data-reload" });
    return "";
  };
  C.otherDevice = function () {
    return C.empty({ icon: "phone", title: t("h.other.h"), body: t("h.other.b"), action: C.btn(t("h.other.btn"), { kind: "primary", attrs: "data-reload" }) });
  };
  /* a question card (used by the deck, the gate preview and the library) */
  C.qcard = function (q, o) {
    o = o || {};
    var id = q.id, qt = t(id + ".q"), img = o.noimg ? "" : q.img;
    /* every question carries a picture (4:5, subject in the top 55%); with none, the card draws the category on the blue grid */
    var media = img ? '<div class="qimg"><img src="' + img + '" alt="" width="800" height="1000" decoding="async" draggable="false"></div>' :
      '<div class="qimg qimg--fallback"><span class="qimg-tile">' + ic(CAT_ICON[q.cat] || "spark", 64) + "</span></div>";
    return '<article class="qcard' + (o.top ? " qcard--top" : "") + '" data-q="' + q.n + '" data-pos="' + (o.pos || 0) + '" role="group" tabindex="' + (o.static ? "-1" : "0") + '" aria-label="' + esc(t("h.qn", { n: q.n }) + ": " + qt) + '">' +
      media + '<span class="qtint" aria-hidden="true"></span>' +
      '<span class="qstamp qstamp--l" aria-hidden="true">' + t(id + ".l") + '</span><span class="qstamp qstamp--r" aria-hidden="true">' + t(id + ".r") + "</span>" +
      '<div class="qcard-top"><span class="qchip">' + t("cat." + q.cat) + '</span><span class="qchip qchip--n">' + t("h.qn", { n: q.n }) + "</span></div>" +
      '<div class="qcard-body"><h2 tabindex="-1">' + qt + "</h2>" +
      (o.failed ? '<p class="qcard-note">' + ic("warn", 16) + t("h.notsaved") + "</p>" : "") +
      '<div class="qcard-meta"><span>' + ic("search", 14) + "<span>" + t("h.answer", { rule: t(id + ".rule") }) + "</span></span><span>" + ic("clock", 14) + "<span>" + t("h.ai", { time: t(id + ".time") }) + "</span></span></div>" +
      '<div class="choices">' +
      '<button type="button" class="choice" data-dir="l"' + (o.disabled ? " disabled" : "") + (o.static ? ' tabindex="-1"' : "") + ' aria-label="' + esc(t("h.pick.aria", { choice: t(id + ".l"), q: qt })) + '">' + ic("left", 18) + "<span>" + t(id + ".l") + "</span></button>" +
      '<button type="button" class="choice" data-dir="r"' + (o.disabled ? " disabled" : "") + (o.static ? ' tabindex="-1"' : "") + ' aria-label="' + esc(t("h.pick.aria", { choice: t(id + ".r"), q: qt })) + '"><span>' + t(id + ".r") + "</span>" + ic("right", 18) + "</button>" +
      "</div></div></article>";
  };
  var CAT_ICON = { crypto: "coin", markets: "chart", weather: "sun", sports: "ball", culture: "film" };
  C.thumb = function (q) { return '<span class="trow-thumb" aria-hidden="true">' + (q.img ? '<img src="' + q.img + '" alt="" width="52" height="52" loading="lazy">' : ic(CAT_ICON[q.cat] || "spark", 24)) + "</span>"; };

  /* ---------- shell ---------- */
  var TABS = [
    { id: "home", icon: "cards", href: function () { return App.store.get("view", "card") === "term" ? "home-terminal.html" : "home-cards.html"; } },
    { id: "results", icon: "list", href: function () { return "results.html"; } },
    { id: "rank", icon: "podium", href: function () { return "ranking.html"; } },
    { id: "stake", icon: "lock", href: function () { return "stakes.html"; } },
    { id: "wallet", icon: "wallet", href: function () { return "wallet.html"; } }
  ];
  C.tabbar = function (current, badges) {
    badges = badges || { home: "dot", results: 2 };
    return '<nav class="tb" aria-label="' + esc(t("nav.tabs")) + '">' + TABS.map(function (tb) {
      var b = badges[tb.id], badge = "";
      if (b === "dot") badge = '<span class="tb-dot"></span><span class="sr-only">' + t("tab.badge." + tb.id) + "</span>";
      else if (b) badge = '<span class="tb-n" aria-hidden="true">' + (b > 9 ? "9+" : b) + '</span><span class="sr-only">' + t("tab.badge.results", { n: b }) + "</span>";
      return '<a href="' + tb.href() + '"' + (tb.id === current ? ' aria-current="page"' : "") + '><span class="tb-ic">' + ic(tb.icon, 22) + badge + "</span><span>" + t("tab." + tb.id) + "</span></a>";
    }).join("") + "</nav>";
  };
  C.header = function (o) {
    o = o || {};
    var pts = o.points === undefined ? M.user.points : o.points, st = o.pts || "";
    /* pill states: loading, ready, pending (today's fifth pick not mined yet), hits (hit points inside the 6 hour window), stale */
    var pill = st === "loading" ? C.skel("44px", "12px") :
      (st === "pending" ? '<span class="spin"></span>' : "") + '<span id="pts-val">' + F.pts(pts) + "</span>" + (st === "hits" ? '<span class="pts-tag">+' + M.user.pendingHit + "</span>" : "") + (st === "stale" ? '<span class="pts-dot"></span>' : "");
    var label = st === "loading" ? t("hd.points.loading") : t("hd.points", { p: F.int(pts) }) + (st === "pending" ? " " + t("hd.points.pending") : st === "hits" ? " " + t("hd.points.hits", { n: M.user.pendingHit, time: "22:10" }) : st === "stale" ? " " + t("hd.points.stale") : "");
    var left = o.back ? '<a class="ah-back" href="' + o.back + '" aria-label="' + esc(t("hd.back")) + '">' + ic("back", 24) + '</a><span class="ah-title" aria-hidden="true">' + (o.title || "") + "</span>" :
      '<a class="ah-logo" href="' + TABS[0].href() + '" aria-label="' + esc(t("hd.home")) + '">' + C.logo() + "</a>";
    return '<header class="ah' + (o.back ? " ah--sub" : "") + '"><div class="ah-in">' + left + '<div class="ah-end">' +
      '<a class="pts" id="pts" href="wallet.html" aria-label="' + esc(label) + '"><span class="pts-in">' + pill + "</span></a>" +
      '<a class="me" href="profile.html" aria-label="' + esc(t("hd.profile")) + '"' + (o.me ? ' aria-current="page"' : "") + '><span class="me-in" aria-hidden="true">' + esc(M.user.name.charAt(0)) + "</span></a>" +
      "</div></div></header>";
  };
  C.offbar = function () { return '<div class="offbar" role="status">' + ic("offline", 16) + "<div>" + t("off.bar") + "<small>" + t("off.last", { time: F.date(new Date(Date.now() - 23 * 60000), true) }) + "</small></div></div>"; };

  /* App.mount: builds the whole screen. cfg: tab, back, title, head, body, pin, bare, offline, pts, badges, cls, after */
  App.mount = function (cfg) {
    var offline = cfg.offline === undefined ? App.state === "offline" : cfg.offline;
    App.offline = offline;
    var html = '<a class="skip" href="#main">' + t("nav.skip") + "</a>" +
      '<div class="app' + (cfg.pin ? " app--pin" : "") + (cfg.bare ? " app--bare" : "") + (cfg.cls ? " " + cfg.cls : "") + '">' +
      (cfg.bare ? "" : C.header({ back: cfg.back, title: cfg.title, pts: cfg.pts, points: cfg.points, me: cfg.me })) +
      (offline && !cfg.bare ? C.offbar() : "") +
      '<main id="main" tabindex="-1">' + (cfg.raw ? cfg.raw : (cfg.head ? '<section class="ph">' + cfg.head + "</section>" : "") + '<div class="pg pg-fade">' + cfg.body + "</div>") + "</main>" +
      (cfg.pin || "") + (cfg.bare ? "" : C.tabbar(cfg.tab, cfg.badges)) + "</div>" +
      '<div class="toasts' + (cfg.bare ? " is-bare" : "") + '" id="toasts" role="status" aria-live="polite"></div>' +
      '<div class="sr-only" id="live" aria-live="polite"></div>' +
      '<div class="sheet-root" id="sheet-root"><div class="sheet-scrim" data-sheet-scrim></div><div class="sheet" id="sheet" role="dialog" aria-modal="true" tabindex="-1"></div></div>';
    document.body.innerHTML = html;
    document.title = (cfg.docTitle || cfg.title || "Cojam") + " | Cojam";
    App.enhance(document.body);
    if (cfg.after) cfg.after();
  };
  App.live = function (msg) { var l = $("#live"); if (l) { l.textContent = ""; setTimeout(function () { l.textContent = msg; }, 30); } };

  /* ---------- enhance: countdowns, QR, stamps, tickers ---------- */
  var timers = [];
  App.enhance = function (root) {
    $$("[data-qr]", root).forEach(function (el) { var sk = $(".skel", el); var svg = App.qrSvg(el.getAttribute("data-qr")); if (sk) sk.outerHTML = svg; });
    $$("[data-cd]", root).forEach(function (el) {
      if (el._cd) return; el._cd = true;
      var end = Date.now() + (+el.getAttribute("data-cd")) * 1000, fmt = el.getAttribute("data-cd-fmt") || "inline", lastMin = -1;
      function tick() {
        var s = Math.max(0, Math.round((end - Date.now()) / 1000)), p = F.hms(s);
        if (fmt === "clock") { var sp = $$("span", el); sp[0].textContent = p[0]; sp[1].textContent = p[1]; sp[2].textContent = p[2];
          var sr = el.parentNode.querySelector("[data-cd-sr]"); if (sr && +p[1] !== lastMin) { lastMin = +p[1]; sr.textContent = t("d.next.sr", { h: +p[0], m: +p[1] }); } }
        else if (fmt === "dh") el.textContent = t("k.dh", { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600) });
        else el.textContent = p.join(":");
        if (s === 0 && !el._zero) { el._zero = true; el.dispatchEvent(new CustomEvent("cd:zero", { bubbles: true })); }
      }
      tick(); timers.push(setInterval(tick, 1000));
    });
    $$("[data-stamp]", root).forEach(function (el) {
      if (el._st) return; el._st = true; var n = +el.getAttribute("data-stamp");
      timers.push(setInterval(function () { n = n >= 59 ? 1 : n + 1; el.textContent = t("common.updated", { n: n }); }, 1000));
    });
    /* interest tickers: data-tick="start value|per second" */
    $$("[data-tick]", root).forEach(function (el) {
      if (el._tk) return; el._tk = true;
      var p = el.getAttribute("data-tick").split("|"), v = +p[0], rate = +p[1], t0 = Date.now(), cap = p[2] ? +p[2] : Infinity;
      if (App.offline) return;
      timers.push(setInterval(function () { el.textContent = F.dec(Math.min(cap, v + rate * (Date.now() - t0) / 1000), 6); }, reduce ? 10000 : 1000));
    });
  };
  document.addEventListener("visibilitychange", function () { document.documentElement.classList.toggle("is-hidden", document.hidden); });

  /* ---------- count up ---------- */
  App.countTo = function (el, from, to, fmt, done) {
    if (!el) return; fmt = fmt || F.pts;
    if (reduce) { el.textContent = fmt(to); if (done) done(); return; }
    var t0 = performance.now(), dur = 400;
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    })(t0);
  };
  App.addPoints = function (n) {
    var el = $("#pts-val"), pill = $("#pts"); if (!el) return;
    var from = M.user.points; M.user.points += n;
    App.countTo(el, from, M.user.points);
    if (pill && !reduce) { pill.classList.add("is-pulse"); setTimeout(function () { pill.classList.remove("is-pulse"); }, 220); }
  };

  /* ---------- toast: one visible, the rest queue ---------- */
  var tq = [], tBusy = false;
  App.toast = function (msg, o) { tq.push({ msg: msg, o: o || {} }); if (!tBusy) nextToast(); };
  function nextToast() {
    var it = tq.shift(), box = $("#toasts"); if (!it || !box) { tBusy = false; return; }
    tBusy = true;
    var el = document.createElement("div"); el.className = "toast";
    el.innerHTML = "<span>" + it.msg + "</span>" + (it.o.btn ? '<button type="button">' + it.o.btn + "</button>" : "");
    box.appendChild(el);
    var gone = false;
    function out() { if (gone) return; gone = true; el.classList.add("is-out"); setTimeout(function () { el.remove(); nextToast(); }, 180); }
    var b = $("button", el); if (b) b.addEventListener("click", function () { if (it.o.fn) it.o.fn(); out(); });
    setTimeout(out, it.o.ms || (it.o.btn ? 8000 : 4000));
  }

  /* ---------- sheet ---------- */
  var sheetOpts = null, lastFocus = null;
  App.sheet = {
    open: function (html, o) {
      var root = $("#sheet-root"), sh = $("#sheet"); sheetOpts = o || {};
      sh.innerHTML = '<div class="sheet-grip" data-grip aria-hidden="true"></div>' + html;
      if (sheetOpts.label) sh.setAttribute("aria-label", sheetOpts.label);
      var h = $("h2", sh); if (h) { h.id = "sheet-h"; sh.setAttribute("aria-labelledby", "sheet-h"); }
      if (!root.classList.contains("is-open")) { lastFocus = document.activeElement; root.classList.add("is-open"); $(".app").setAttribute("inert", ""); sh.style.transform = ""; setTimeout(function () { sh.focus(); }, 50); }
      App.enhance(sh);
    },
    close: function (silent) {
      var root = $("#sheet-root"); if (!root || !root.classList.contains("is-open")) return;
      root.classList.remove("is-open"); $(".app").removeAttribute("inert"); $("#sheet").style.transform = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      var o = sheetOpts; sheetOpts = null; if (!silent && o && o.onClose) o.onClose();
    },
    closable: function () { return !sheetOpts || sheetOpts.closable !== false; }
  };

  /* ---------- transaction sheet (staking, claim, withdraw principal, convert, withdraw CT). Never used for picks. ---------- */
  var HASH = "0x8c41f0a7d2be6953c1e07a4f9b25d83e61a0c7f4b9d2e8351a6f0c4d7e92b3a1";
  var chipEl = null, txTimers = [];
  function txClear() { txTimers.forEach(clearTimeout); txTimers = []; }
  function later(fn, ms) { txTimers.push(setTimeout(fn, reduce ? Math.min(ms, 500) : ms)); }
  App.tx = {
    view: function (state, cfg) {
      var h = "";
      if (state === "review") {
        var rv = cfg.review;
        h = "<h2>" + (rv.title || t("tx.review.h")) + "</h2>" + C.rows(rv.rows) +
          (rv.check ? '<label class="check"><input type="checkbox" id="tx-check"><span>' + rv.check + "</span></label>" : "") +
          '<div class="sheet-acts">' + C.btn(rv.confirm || t("tx.confirm"), { kind: "primary", block: true, attrs: "data-tx=\"confirm\"", disabled: !!rv.check, id: "tx-confirm" }) + C.btn(t("common.cancel"), { kind: "ghost", block: true, attrs: "data-tx=\"cancel\"" }) + "</div>";
      } else if (state === "signing") {
        h = '<div class="sheet-state"><div class="sheet-ic"><span class="spin"></span></div><h2>' + t("tx.sign.h") + '</h2><p class="sheet-lead">' + t("tx.sign.b") + "</p></div>" +
          '<div class="sheet-acts">' + C.btn(t("common.cancel"), { kind: "ghost", block: true, attrs: "data-tx=\"cancel\"" }) + "</div>";
      } else if (state === "steps" || state === "steps2") {
        var now = state === "steps" ? 0 : 1;
        h = "<h2>" + cfg.stepsTitle + '</h2><ol class="txsteps">' + cfg.steps.map(function (s, i) {
          var st = i < now ? "done" : i === now ? "now" : "wait";
          return '<li class="is-' + st + '"><span class="n">' + (st === "done" ? ic("check", 16) : i + 1) + "</span><span>" + s + '</span><span class="st">' + (st === "now" ? '<span class="spin"></span>' : "") + t("tx.st." + st) + "</span></li>";
        }).join("") + '</ol><div class="sheet-acts">' + (now === 0 ? C.btn(t("common.cancel"), { kind: "ghost", block: true, attrs: "data-tx=\"cancel\"" }) : C.btn(t("tx.hide"), { block: true, attrs: "data-tx=\"hide\"" })) + "</div>";
      } else if (state === "sending" || state === "slow") {
        h = '<div class="sheet-state"><div class="sheet-ic"><span class="spin"></span></div><h2>' + t(state === "slow" ? "tx.slow.h" : "tx.send.h") + '</h2><p class="sheet-lead">' + t(state === "slow" ? "tx.slow.b" : "tx.send.b") + "</p></div>" +
          C.rows([[t("tx.hash"), '<span class="mono" translate="no">' + F.short(HASH) + "</span>"]]) +
          '<div class="sheet-acts">' + C.btn(t("tx.hide"), { block: true, attrs: "data-tx=\"hide\"" }) + (state === "slow" ? C.btn(t("tx.scan"), { kind: "ghost", block: true, iconEnd: "ext", href: "https://kaiascan.io/tx/" + HASH, ext: true }) : "") + "</div>";
      } else if (state === "success") {
        var ok = cfg.success;
        h = '<div class="sheet-state"><div class="sheet-ic is-ok">' + ic("check", 32) + "</div><h2>" + ok.title + "</h2></div>" + (ok.rows ? C.rows(ok.rows) : "") +
          '<div class="sheet-acts">' + (ok.btn ? C.btn(ok.btn.label, { kind: "primary", block: true, href: ok.btn.href }) + C.btn(t("common.done"), { kind: "ghost", block: true, attrs: "data-tx=\"done\"" }) : C.btn(t("common.done"), { kind: "primary", block: true, attrs: "data-tx=\"done\"" })) +
          '<a class="linkish self-center" href="https://kaiascan.io/tx/' + HASH + '" target="_blank" rel="noopener">' + t("tx.scan") + ic("ext", 16) + "</a></div>";
      } else if (state === "failed") {
        h = '<div class="sheet-state"><div class="sheet-ic is-bad">' + ic("x", 32) + "</div><h2>" + t("tx.fail.h") + '</h2><p class="sheet-lead">' + t(cfg.failKey || "tx.fail.reverted") + "</p></div>" +
          '<div class="sheet-acts">' + C.btn(t("common.retry"), { kind: "primary", block: true, attrs: "data-tx=\"retry\"" }) + C.btn(t("common.close"), { kind: "ghost", block: true, attrs: "data-tx=\"cancel\"" }) + "</div>";
      }
      return h;
    },
    show: function (state, cfg) {
      App.tx.cfg = cfg; App.tx.state = state; App.tx.chip(false);
      App.sheet.open(App.tx.view(state, cfg), { closable: state === "review" || state === "success" || state === "failed", label: cfg.label, onClose: function () { txClear(); if (state === "success" && cfg.onDone) cfg.onDone(); } });
      App.live($("#sheet h2") ? $("#sheet h2").textContent : "");
    },
    chip: function (on) {
      if (chipEl) { chipEl.remove(); chipEl = null; }
      if (!on) return;
      chipEl = document.createElement("button"); chipEl.type = "button"; chipEl.className = "txchip";
      chipEl.innerHTML = '<span class="spin"></span>' + t("tx.chip", { label: App.tx.cfg.label });
      chipEl.addEventListener("click", function () { App.tx.hidden = false; App.tx.show(App.tx.state, App.tx.cfg); });
      document.body.appendChild(chipEl);
    },
    go: function (state) { App.tx.state = state; if (App.tx.hidden) { if (state === "success" || state === "failed") { App.tx.hidden = false; App.tx.show(state, App.tx.cfg); } } else App.tx.show(state, App.tx.cfg); },
    /* run the whole mock flow with real waits */
    run: function (cfg) {
      txClear(); App.tx.hidden = false; App.tx.cfg = cfg;
      if (cfg.review && !cfg._confirmed) { App.tx.show("review", cfg); return; }
      App.tx.show("signing", cfg);
      var at = 1100;
      if (cfg.steps) { later(function () { App.tx.go("steps"); }, at); at += 1500; later(function () { App.tx.go("steps2"); }, at); at += 1400; }
      later(function () { App.tx.go("sending"); }, at); at += 1700;
      later(function () { App.tx.go(cfg.fail ? "failed" : "success"); if (!cfg.fail && cfg.onSuccess) cfg.onSuccess(); }, at);
    }
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tx]"); if (!b) return;
    var a = b.getAttribute("data-tx"), cfg = App.tx.cfg;
    if (a === "confirm") { cfg._confirmed = true; App.tx.run(cfg); cfg._confirmed = false; }
    else if (a === "cancel") { txClear(); App.sheet.close(true); }
    else if (a === "hide") { App.tx.hidden = true; App.sheet.close(true); App.tx.chip(true); }
    else if (a === "done") { App.sheet.close(true); if (cfg.onDone) cfg.onDone(); }
    else if (a === "retry") { cfg.fail = false; App.tx.run(cfg); }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "tx-check") { var c = $("#tx-confirm"); if (c) c.disabled = !e.target.checked; }
    if (e.target.matches("[data-lang]")) I.setLang(e.target.value);
  });

  /* ---------- global behaviours: press feedback, copy, seg, sheet close, max, reload ---------- */
  document.addEventListener("pointerdown", function (e) {
    var el = e.target.closest(".btn, .choice, .seg-btn, .field-max, .period button"); if (!el || el.disabled) return;
    el.classList.add("is-pressed"); var t0 = Date.now();
    function up() { setTimeout(function () { el.classList.remove("is-pressed"); }, Math.max(0, 90 - (Date.now() - t0))); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  document.addEventListener("click", function (e) {
    var c = e.target.closest("[data-copy]");
    if (c) {
      var text = c.getAttribute("data-copy");
      try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {}); } catch (err) {}
      App.toast(c.getAttribute("data-toast") || t("common.copied"));
      if (c.classList.contains("btn-icon")) { var old = c.innerHTML; c.classList.add("is-done"); c.innerHTML = ic("check", 18); setTimeout(function () { c.classList.remove("is-done"); c.innerHTML = old; }, 1600); }
      return;
    }
    var s = e.target.closest(".seg[data-seg] .seg-btn");
    if (s && !s.disabled) {
      var g = s.closest(".seg"); $$(".seg-btn", g).forEach(function (b) { b.setAttribute("aria-pressed", b === s ? "true" : "false"); });
      g.dispatchEvent(new CustomEvent("seg", { bubbles: true, detail: { name: g.getAttribute("data-seg"), value: s.getAttribute("data-value") } }));
      return;
    }
    if (e.target.closest("[data-sheet-scrim]") && App.sheet.closable()) { App.sheet.close(); return; }
    if (e.target.closest("[data-sheet-close]")) { App.sheet.close(); return; }
    if (e.target.closest("[data-reload]")) { var u = new URL(location.href); u.searchParams.delete("state"); location.href = u.toString(); return; }
    var hb = e.target.closest(".ah-back");
    if (hb) { var ref = document.referrer; if (ref && ref.indexOf(location.origin) === 0 && history.length > 1 && !/[?&]state=/.test(location.search)) { e.preventDefault(); history.back(); } return; }
    var bk = e.target.closest("[data-toast-msg]"); if (bk) App.toast(bk.getAttribute("data-toast-msg"));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && $("#sheet-root.is-open") && App.sheet.closable()) App.sheet.close();
    if (e.key === "Tab" && $("#sheet-root.is-open")) {
      var f = $$("a[href], button:not([disabled]), input:not([disabled]), select", $("#sheet")); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $("#sheet"))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  /* grip drag closes the sheet where closing is allowed */
  (function () {
    var y0 = null, sh;
    document.addEventListener("pointerdown", function (e) { if (!e.target.closest("[data-grip]") || !App.sheet.closable()) return; sh = $("#sheet"); y0 = e.clientY; sh.style.transition = "none"; });
    document.addEventListener("pointermove", function (e) { if (y0 === null) return; sh.style.transform = "translateY(" + Math.max(0, e.clientY - y0) + "px)"; });
    document.addEventListener("pointerup", function (e) { if (y0 === null) return; var d = e.clientY - y0; y0 = null; sh.style.transition = ""; if (d > 80) App.sheet.close(); else sh.style.transform = ""; });
  })();

  /* ---------- forgiving amount parser ---------- */
  App.parseAmount = function (s) {
    s = String(s).trim().replace(/\s*(ct|p|kaia)$/i, "").replace(/,/g, "");
    if (s === "") return { empty: true };
    if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return { bad: true };
    var dec = (s.split(".")[1] || "").length;
    return { value: parseFloat(s), decimals: dec };
  };

  /* ---------- swipe card stack (spec 6.3) ---------- */
  App.deck = function (root, o) {
    o = o || {};
    function live() { return $$(".qcard:not(.is-out)", root); }
    function layout() {
      live().forEach(function (c, i) {
        c.setAttribute("data-pos", i < 4 ? i : "x"); c.style.transform = ""; c.style.transition = "";
        if (i === 0) c.removeAttribute("inert"); else c.setAttribute("inert", "");
        if (i === 1 || i === 2) { var im = $("img", c); if (im && im.decode) im.decode().catch(function () {}); }   /* decoded before it reaches the front */
      });
    }
    function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
    function paint(card, k) {   /* k: travel as a share of the card width, -1 to 1 */
      var hot = Math.abs(k) >= 0.2 ? (k > 0 ? "r" : "l") : "";
      $$(".choice", card).forEach(function (b) { b.classList.toggle("is-hot", b.getAttribute("data-dir") === hot); });
      $(".qtint", card).style.opacity = Math.min(0.26, Math.abs(k) * 0.8);
      $(".qstamp--l", card).style.opacity = k < 0 ? Math.min(1, -k * 3.2) : 0;
      $(".qstamp--r", card).style.opacity = k > 0 ? Math.min(1, k * 3.2) : 0;
    }
    function feedback(card, dx, dy) {
      var w = card.offsetWidth, k = Math.max(-1, Math.min(1, dx / w));
      card.style.transform = "translate(" + dx + "px," + (dy * 0.18).toFixed(1) + "px)" + (reduce ? "" : " rotate(" + (k * 8).toFixed(2) + "deg)");
      paint(card, k);
      return k;
    }
    function reset(card) { card.classList.remove("is-drag"); card.style.transform = ""; paint(card, 0); }
    /* throw: the card leaves on its side with the speed of the release; the deck advances with a spring (CSS, on data-pos) */
    function commit(card, dir, v, dx, dy) {
      if (card.classList.contains("is-out")) return;
      if (o.disabled && o.disabled()) { reset(card); if (o.onBlocked) o.onBlocked(); return; }
      var w = card.offsetWidth, sign = dir === "r" ? 1 : -1, dist = innerWidth * 0.5 + w - Math.abs(dx || 0);
      var ms = reduce ? 200 : Math.round(Math.max(190, Math.min(380, dist / Math.max(v || 0, 1.6))));
      card.classList.remove("is-drag"); card.classList.add("is-out"); card.setAttribute("data-pos", "out");
      paint(card, sign * 0.5);
      card.style.transition = reduce ? "" : "transform " + ms + "ms cubic-bezier(0.3, 0.55, 0.4, 1), opacity " + ms + "ms cubic-bezier(0.6, 0, 0.9, 0.4)";
      void card.offsetWidth;
      if (!reduce) card.style.transform = "translate(" + sign * (innerWidth * 0.5 + w) + "px," + ((dy || 0) * 0.4 + 30).toFixed(0) + "px) rotate(" + sign * 22 + "deg)";
      card.style.opacity = 0;
      buzz(12);
      var n = +card.getAttribute("data-q");
      layout();
      var next = live()[0]; if (next) { var h = $("h2", next); if (h) h.focus({ preventScroll: true }); }
      setTimeout(function () { card.remove(); }, ms + 40);
      if (o.onCommit) o.onCommit(n, dir, live().length);
    }
    var drag = null, swallow = 0;
    root.addEventListener("pointerdown", function (e) {
      var card = e.target.closest('.qcard[data-pos="0"]'); if (!card || card.classList.contains("is-out") || (e.pointerType === "mouse" && e.button !== 0)) return;
      drag = { card: card, x: e.clientX, y: e.clientY, id: e.pointerId, lock: false, armed: false, pts: [{ x: e.clientX, t: e.timeStamp }] };
    });
    root.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.lock) {
        if (Math.abs(dy) > 10 && Math.abs(dx) < 10) { drag = null; return; }       /* vertical first: hand over to page scroll */
        if (Math.abs(dx) < 10) return;
        drag.lock = true; drag.card.classList.add("is-drag"); try { drag.card.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
      drag.pts.push({ x: e.clientX, t: e.timeStamp }); if (drag.pts.length > 6) drag.pts.shift();
      var k = feedback(drag.card, dx, dy), armed = Math.abs(k) >= 0.35;
      if (armed !== drag.armed) { drag.armed = armed; if (armed) buzz(5); }   /* a light tick when the release would commit */
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null; if (!d.lock) return;
      swallow = Date.now();
      var dx = e.clientX - d.x, dy = e.clientY - d.y, w = d.card.offsetWidth, a = d.pts[0], b = d.pts[d.pts.length - 1], v = b.t > a.t ? Math.abs(b.x - a.x) / (b.t - a.t) : 0;
      var k = Math.abs(dx) / w;
      if (e.type !== "pointercancel" && (k >= 0.35 || (v >= 0.5 && k >= 0.15))) commit(d.card, dx > 0 ? "r" : "l", v, dx, dy); else reset(d.card);
    }
    root.addEventListener("pointerup", end); root.addEventListener("pointercancel", end);
    root.addEventListener("click", function (e) {
      var b = e.target.closest(".choice"); if (!b || b.disabled) return;
      if (Date.now() - swallow < 250) { e.preventDefault(); return; }
      var card = b.closest(".qcard"); if (card.getAttribute("data-pos") !== "0") return;
      commit(card, b.getAttribute("data-dir"), 0, 0, 0);   /* a tap plays the same throw */
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      var card = live()[0]; if (!card || !card.contains(document.activeElement)) return;
      e.preventDefault(); commit(card, e.key === "ArrowRight" ? "r" : "l", 0, 0, 0);
    });
    layout();
    return { layout: layout, live: live };
  };
  /* payoff: a short burst of pieces from an element (day done, success) */
  App.burst = function (el, count) {
    if (reduce || !el) return;
    var b = document.createElement("span"); b.className = "burst"; b.setAttribute("aria-hidden", "true"); count = count || 16;
    for (var i = 0; i < count; i++) { var a = (i / count) * Math.PI * 2 + Math.random() * 0.4, r = 56 + Math.random() * 54;
      b.innerHTML += '<i style="--n:' + i + ";--x:" + (Math.cos(a) * r).toFixed(0) + "px;--y:" + (Math.sin(a) * r - 10).toFixed(0) + "px;--r:" + Math.round(Math.random() * 360) + 'deg"></i>'; }
    el.appendChild(b); setTimeout(function () { b.remove(); }, 1100);
  };

  /* ---------- QR code: byte mode, error correction Q, versions 1 to 6 (enough for a URL or an address) ---------- */
  App.qrMatrix = function (text, forceMask) {
    var bytes = []; for (var i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 255);
    var SPEC = [null, [13, [[1, 13]]], [22, [[1, 22]]], [18, [[2, 17]]], [26, [[2, 24]]], [18, [[2, 15], [2, 16]]], [24, [[4, 19]]]];
    var ver = 0, cap = 0;
    for (var v = 1; v <= 6; v++) { cap = SPEC[v][1].reduce(function (s, g) { return s + g[0] * g[1]; }, 0); if (bytes.length + 2 <= cap) { ver = v; break; } }
    if (!ver) return null;
    var ecLen = SPEC[ver][0], groups = SPEC[ver][1], size = 17 + 4 * ver;
    /* bit stream */
    var bits = [];
    function put(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1); }
    put(4, 4); put(bytes.length, 8); bytes.forEach(function (b) { put(b, 8); });
    for (var z = 0; z < 4 && bits.length < cap * 8; z++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var data = []; for (i = 0; i < bits.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; data.push(x); }
    for (var pad = 0; data.length < cap; pad++) data.push(pad % 2 ? 0x11 : 0xEC);
    /* Reed Solomon over GF(256) */
    var EXP = [], LOG = [], e = 1;
    for (i = 0; i < 255; i++) { EXP[i] = e; LOG[e] = i; e <<= 1; if (e & 256) e ^= 0x11d; }
    function mul(a, b) { return a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0; }
    var gen = [1];
    for (i = 0; i < ecLen; i++) { var ng = []; for (j = 0; j <= gen.length; j++) ng[j] = (j < gen.length ? mul(gen[j], EXP[i]) : 0) ^ (j > 0 ? gen[j - 1] : 0); gen = ng; }
    gen.reverse(); /* highest degree first, monic */
    function rs(block) {
      var rem = []; for (var k = 0; k < ecLen; k++) rem.push(0);
      block.forEach(function (b) { var f = b ^ rem.shift(); rem.push(0); for (var k = 0; k < ecLen; k++) rem[k] ^= mul(gen[k + 1], f); });
      return rem;
    }
    var blocks = [], ecs = [], pos = 0;
    groups.forEach(function (g) { for (var n = 0; n < g[0]; n++) { var bl = data.slice(pos, pos + g[1]); pos += g[1]; blocks.push(bl); ecs.push(rs(bl)); } });
    var out = [], maxLen = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (i = 0; i < maxLen; i++) blocks.forEach(function (b) { if (i < b.length) out.push(b[i]); });
    for (i = 0; i < ecLen; i++) ecs.forEach(function (b) { out.push(b[i]); });
    /* matrix and function patterns */
    var m = [], fn = [];
    for (i = 0; i < size; i++) { m.push(new Array(size).fill(0)); fn.push(new Array(size).fill(0)); }
    function set(xx, yy, val) { m[yy][xx] = val ? 1 : 0; fn[yy][xx] = 1; }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue; var d = Math.max(Math.abs(dx), Math.abs(dy)); set(xx, yy, d !== 2 && d !== 4); } }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (ver >= 2) { var c = size - 7; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    function format(mask) {
      var d = (3 << 3) | mask, rem = d; for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((d << 10) | rem) ^ 0x5412, bit = function (n) { return (f >>> n) & 1; };
      for (k = 0; k <= 5; k++) set(8, k, bit(k));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (k = 9; k < 15; k++) set(14 - k, 8, bit(k));
      for (k = 0; k < 8; k++) set(size - 1 - k, 8, bit(k));
      for (k = 8; k < 15; k++) set(8, size - 15 + k, bit(k));
      set(8, size - 8, 1);
    }
    format(0);
    /* data placement */
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var xx = right - j, up = ((right + 1) & 2) === 0, yy = up ? size - 1 - vert : vert;
        if (!fn[yy][xx] && bi < out.length * 8) { m[yy][xx] = (out[bi >>> 3] >>> (7 - (bi & 7))) & 1; bi++; }
      }
    }
    var MASKS = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x, y) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
    ];
    function apply(mask) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] ^= 1; }
    function penalty() {
      var p = 0, dark = 0, x, y, run, col;
      for (y = 0; y < size; y++) { run = 1; for (x = 1; x < size; x++) { if (m[y][x] === m[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (x = 0; x < size; x++) { run = 1; for (y = 1; y < size; y++) { if (m[y][x] === m[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { col = m[y][x]; if (col === m[y][x + 1] && col === m[y + 1][x] && col === m[y + 1][x + 1]) p += 3; }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) dark += m[y][x];
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    if (forceMask !== undefined) best = forceMask;
    else for (var k = 0; k < 8; k++) { apply(k); format(k); var pp = penalty(); if (pp < bestP) { bestP = pp; best = k; } apply(k); }
    apply(best); format(best);
    return m;
  };
  App.qrSvg = function (text) {
    var m = App.qrMatrix(text); if (!m) return "";
    var n = m.length, d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += "M" + x + " " + y + "h1v1h-1z";
    return '<svg viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" aria-hidden="true"><path fill="var(--ink)" d="' + d + '"/></svg>';
  };
})();
