/* Cojam Daily Prediction, variant "Pocket Arcade": behaviour and the shared app shell.
   Screens call App.mount({...}) with HTML built from the C.* helpers, so every screen uses the same header, dock, buttons, cards, sheets and toasts.
   The behaviour (deck, undo, sheets, transactions, countdowns, QR) is carried over from platform/design/assets/components.js;
   the builders, the illustrations, the mascot and the shell are drawn new for this concept. Mock only: nothing here talks to a chain or a server. */
(function () {
  "use strict";
  var I = window.CJ_I18N, t = I.t, M = window.MOCK;
  var qs = new URLSearchParams(location.search);
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var App = window.App = { state: qs.get("state") || "", lang: I.lang, t: t, reduce: reduce };
  App.offline = App.state === "offline";   /* known before a screen builds its body, so offline controls are drawn switched off */
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
    /* a full address is two equal lines of five groups of four (the first group carries 0x), whatever the width */
    groups: function (a) {
      var g = a.replace(/^0x/, "").match(/.{1,4}/g).map(function (x, i) { return "<i>" + (i === 0 ? "0x" : "") + x + "</i>"; });
      return "<span>" + g.slice(0, 5).join("") + "</span><span>" + g.slice(5).join("") + "</span>";
    }
  };
  App.isKo = App.lang === "ko";
  /* Mock state that survives a page change inside one tab (sessionStorage): the picks made today, the 100P for the finished day and
     stakes opened in this session. It belongs to one daily set (the UTC date) and is dropped when the set changes. */
  App.sess = (function () {
    var K = "cjp.sess", day = new Date().toISOString().slice(0, 10), d = null;
    try { d = JSON.parse(sessionStorage.getItem(K) || "null"); } catch (e) {}
    if (!d || d.day !== day || !d.picks || !d.stakes) d = { day: day, picks: {}, paid: false, stakes: [], left: 0 };
    var api = { data: d, save: function () { try { sessionStorage.setItem(K, JSON.stringify(api.data)); } catch (e) {} },
      resetDay: function () { api.data.picks = {}; api.data.paid = false; api.data.left = 0; api.save(); },
      /* Leaving the home screen inside an undo window sends the held picks at once (they can no longer be undone). The count is kept so the
         home screen can say "Pick saved" when the player comes back. */
      leave: function (n) { if (n > 0) { api.data.left = (api.data.left || 0) + n; api.save(); } },
      takeLeft: function () { var n = api.data.left || 0; if (n) { api.data.left = 0; api.save(); } return n; },
      picked: function () { return M.set.filter(function (id) { return api.data.picks[id]; }).length; } };
    return api;
  })();
  if (App.sess.data.paid) M.user.points += 100;
  App.sess.data.stakes.forEach(function (s, i) {
    M.user.ct = Math.round((M.user.ct - s.amount) * 1e4) / 1e4; M.user.staked += s.amount;
    M.stakes.unshift({ id: "n" + i, amount: s.amount, days: s.days, rate: s.rate, start: new Date(s.start) });
  });
  /* a question in the chosen language. The server sends title, choices and answer rule authored per language (see mock.js). */
  App.q = function (id) {
    var q = M.questions[id], L = q[App.lang] || q.en;
    return { id: id, n: q.n, img: q.img, cat: q.cat, title: L.title, l: L.left, r: L.right, rule: L.rule, settle: L.settle };
  };

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
    /* the current tab: the same shapes, filled (details cut out in the page colour) */
    cardsOn: '<rect x="5" y="7" width="14" height="13" rx="3" fill="currentColor"/><path d="M8 3.5h8"/>',
    listOn: '<rect x="3" y="3" width="18" height="18" rx="4.500" fill="currentColor"/><g stroke="var(--card)"><path d="M6.500 8.200l1.300 1.300 2.200-2.500"/><path d="M6.500 15.200l1.300 1.300 2.200-2.500"/><path d="M13.500 8.500h4M13.500 15.500h4"/></g>',
    podiumOn: '<path d="M9 20V9h6v11z" fill="currentColor"/><path d="M3 20v-6h6v6z" fill="currentColor"/><path d="M15 20v-8h6v8z" fill="currentColor"/><path d="M2 20h20"/>',
    lockOn: '<rect x="5" y="11" width="14" height="9" rx="2.500" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 14.500v2" stroke="var(--card)"/>',
    walletOn: '<path d="M4 7.500A2.500 2.500 0 0 1 6.500 5H17v3"/><rect x="4" y="8" width="16" height="11" rx="2.500" fill="currentColor"/><path d="M15.500 13.500h1.500" stroke="var(--card)"/>',
    pause: '<circle cx="12" cy="12" r="8.500"/><path d="M10 9v6M14 9v6"/>',
    undo: '<path d="M9 7L4.500 11.500 9 16"/><path d="M4.500 11.500H14a5 5 0 0 1 0 10h-2"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.500 2.500M15.500 15.500L18 18M18 6l-2.500 2.500M8.500 15.500L6 18"/>'
  };
  C.icon = function (name, size, cls) {
    size = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + (cls ? ' class="' + cls + '"' : "") + ">" + (IC[name] || "") + "</svg>";
  };
  var ic = C.icon;


  /* ---------- the edition: date, day of the week and week number are real information on the dateline ----------
     A daily set runs from 09:00 KST to 09:00 KST, which is a UTC day; the week starts on Monday. */
  App.issue = (function () {
    var n = new Date(), d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())), dow = d.getUTCDay() || 7;
    var th = new Date(d); th.setUTCDate(d.getUTCDate() + 4 - dow);
    var week = Math.ceil(((th - Date.UTC(th.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
    return { date: d, day: dow, week: week };
  })();

  /* ---------- component builders (HTML strings) ---------- */
  C.btn = function (label, o) {
    o = o || {};
    var cls = "btn" + (o.kind ? " btn-" + o.kind : "") + (o.block ? " btn-block" : "") + (o.sm ? " btn-sm" : "") + (o.wrap ? " btn-wrap" : "") + (o.cls ? " " + o.cls : "");
    var inner = (o.loading ? '<span class="spin"></span>' : "") + (o.icon ? ic(o.icon, 18) : "") + "<span>" + label + "</span>" + (o.iconEnd ? ic(o.iconEnd, 18) : "");
    var attrs = (o.id ? ' id="' + o.id + '"' : "") + (o.attrs ? " " + o.attrs : "");
    if (o.href && !o.disabled) return '<a class="' + cls + '" href="' + o.href + '"' + (o.ext ? ' target="_blank" rel="noopener"' : "") + attrs + ">" + inner + "</a>";
    return '<button type="button" class="' + cls + (o.loading ? " is-loading" : "") + '"' + (o.disabled ? " disabled" : "") + attrs + ">" + inner + "</button>";
  };
  C.seg = function (items, o) {
    o = o || {};
    return '<div class="seg" role="group" aria-label="' + esc(o.label || "") + '"' + (o.name ? ' data-seg="' + o.name + '"' : "") + ">" + items.map(function (it) {
      if (it.href) return '<a class="seg-btn" href="' + it.href + '"' + (it.on ? ' aria-current="page"' : "") + ">" + it.label + "</a>";
      return '<button type="button" class="seg-btn" data-value="' + esc(it.value) + '" aria-pressed="' + (it.on ? "true" : "false") + '"' + (o.disabled ? " disabled" : "") + ">" + it.label + "</button>";
    }).join("") + "</div>";
  };
  /* the day as a sticker sheet of five numbered slots: an empty well, a sticker half pressed while a pick is being saved, a full sticker when it is in.
     states is an array of 5 from "", done, pend, fail */
  C.day5 = function (states, o) {
    o = o || {};
    var n = states.filter(function (s) { return s === "done" || s === "pend"; }).length;
    return '<div class="day5' + (o.size ? " day5--" + o.size : "") + (o.cls ? " " + o.cls : "") + '" role="img" aria-label="' + esc(o.label || t("h.prog.sr", { n: n })) + '"' + (o.id ? ' id="' + o.id + '"' : "") + ">" +
      states.map(function (s, i) { return "<i" + (s ? ' class="is-' + s + '"' : "") + "><b>" + (i + 1) + "</b></i>"; }).join("") + "</div>";
  };
  /* a made pick, wherever it is shown, carries the colour of its answer (coral left, mint right) as a small token with the side it was thrown to */
  C.pick = function (dir, text) { return '<span class="pk pk--' + dir + '"><i aria-hidden="true">' + ic(dir === "l" ? "left" : "right", 12) + "</i>" + text + "</span>"; };
  C.tag = function (text, kind, icon) { return '<span class="tag' + (kind ? " tag-" + kind : "") + '">' + (icon ? ic(icon, 14) : "") + text + "</span>"; };
  /* a result as a sticker: hit (yellow, the reward), miss (a peeled off outline), corr (blue, corrected) */
  C.rstamp = function (kind, text) { return '<span class="rstamp rstamp--' + kind + '">' + text + "</span>"; };
  C.rows = function (rows) {
    return '<dl class="rows">' + rows.filter(Boolean).map(function (r) { return "<div" + (r[2] ? ' class="is-em"' : "") + "><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl>";
  };
  C.note = function (kind, html, action) {
    var icon = kind === "warn" || kind === "error" ? "warn" : kind === "ok" ? "check" : "info";
    return '<div class="note' + (kind ? " note-" + kind : "") + '"' + (kind === "error" ? ' role="alert"' : "") + ">" + ic(icon, 18) + '<div class="note-body"><div>' + html + "</div>" + (action || "") + "</div></div>";
  };
  C.addr = function (a, o) {
    o = o || {};
    return '<button type="button" class="addr-chip"' + (o.id ? ' id="' + o.id + '"' : "") + ' data-copy="' + a + '" data-done="' + esc(t("w.copy.done")) + '" aria-label="' + esc(t("w.copy") + ": " + a) + '">' +
      '<span class="addr-chip-v" translate="no">' + F.short(a) + "</span>" + ic("copy", 16) + "</button>";
  };
  C.code = function (code, o) {
    o = o || {};
    return '<button type="button" class="code-block' + (o.done ? " is-done" : "") + (o.cls ? " " + o.cls : "") + '"' + (o.id ? ' id="' + o.id + '"' : "") + ' data-copy="' + esc(code) + '"' + (o.done ? "" : ' data-done="' + esc(t("w.copy.done")) + '"') + ">" +
      '<b class="code-v" translate="no">' + esc(code) + '</b><i class="code-act">' + ic("copy", 18) + ic("check", 18) + "<span>" + (o.done ? t("w.copy.done") : (o.label || t("common.copy"))) + "</span></i></button>";
  };
  C.amount = function (o) {
    return '<div class="field"><div class="field-label"><label for="' + o.id + '"><b>' + o.label + "</b></label>" + (o.side ? "<span>" + o.side + "</span>" : "") + "</div>" +
      '<div class="field-box field-box--fig' + (o.error ? " is-error" : "") + (o.disabled ? " is-off" : "") + '"><input id="' + o.id + '" name="' + o.id + '" type="text" inputmode="' + (o.mode || "decimal") + '" autocomplete="off" spellcheck="false" placeholder="0" value="' + esc(o.value || "") + '"' + (o.disabled ? " disabled" : "") + ' aria-describedby="' + o.id + '-msg"' + (o.error ? ' aria-invalid="true"' : "") + ">" +
      '<span class="field-unit">' + o.unit + "</span>" + (o.max === false ? "" : '<button type="button" class="field-max" data-max="' + o.id + '"' + (o.disabled ? " disabled" : "") + ">" + t("s.max") + "</button>") + "</div>" +
      '<div class="field-msg' + (o.error ? " is-error" : "") + '" id="' + o.id + '-msg" aria-live="polite">' + (o.msg || "") + "</div></div>";
  };
  C.empty = function (o) {
    return '<div class="empty">' + (o.jam !== undefined ? '<div class="empty-jam">' + C.jam(o.jam, 104) + "</div>" : '<div class="empty-ic">' + ic(o.icon || "inbox", 28) + "</div>") + "<h2>" + o.title + "</h2>" + (o.body ? "<p>" + o.body + "</p>" : "") + (o.extra || "") + (o.action || "") + "</div>";
  };
  C.error = function (key) {
    return C.note("error", t(key || "e.load"), C.btn(t("common.retry"), { sm: true, icon: "refresh", attrs: "data-reload" }));
  };
  C.actbar = function (btn, note) { return '<div class="pin pin--act">' + btn + (note ? '<p class="pin-note">' + note + "</p>" : "") + "</div>"; };
  C.skel = function (w, h, extra) { return '<span class="skel" style="width:' + w + ";height:" + (h || "14px") + ";" + (extra || "") + '"></span>'; };
  C.help = function (q, a, open) { return '<details class="help"' + (open ? " open" : "") + "><summary>" + q + ic("down", 18) + '</summary><div class="help-body">' + a + "</div></details>"; };
  /* "Updated 6s ago": a live line, used on the dateline of the money screens and beside live tables */
  C.stamp = function (n) { return '<span class="upd"><span data-stamp="' + (n || 4) + '">' + t("common.updated", { n: n || 4 }) + "</span></span>"; };
  C.lang = function () {
    return '<label class="select">' + ic("globe", 18) + '<span class="sr-only">' + t("lang.label") + '</span><select data-lang aria-label="' + esc(t("lang.label")) + '">' +
      I.langs.map(function (l) { return '<option value="' + l + '"' + (l === App.lang ? " selected" : "") + ">" + I.names[l] + "</option>"; }).join("") + "</select>" + ic("down", 16) + "</label>";
  };
  /* the wordmark: the Cojam mark and the name. It is a logo, so it is the same in every language. */
  C.logo = function (big) { return '<span class="plate' + (big ? " plate--big" : "") + '" translate="no"><img src="assets/cojam-mark.svg" alt="" width="' + (big ? 44 : 32) + '" height="' + (big ? 44 : 32) + '"><span>Cojam</span></span>'; };
  C.qr = function (text, label, mark) {
    return '<div class="qr" role="img" aria-label="' + esc(label) + '" data-qr="' + esc(text) + '">' + C.skel("100%", "auto") + (mark === false ? "" : '<span class="qr-mark"><img src="assets/cojam-mark.svg" alt="" width="32" height="32"></span>') + "</div>";
  };
  /* the on hold notice, one component on every screen: a framed notice with a heavy top rule, the title "Account on hold",
     what it means on this screen, and the link to the full explanation (hold.html). */
  App.hold = /^hold/.test(App.state);
  C.hold = function (html, o) {
    o = o || {};
    return '<div class="hold" role="status">' + ic("pause", 20) + '<div class="hold-body"><b class="hold-t">' + t("hold.t") + "</b><p>" + html + "</p>" + (o.action || "") +
      (o.more === false ? "" : '<a class="hold-more" href="hold.html">' + t("hold.more") + ic("chev", 16) + "</a>") + "</div></div>";
  };
  C.banner = function (text, o) {
    o = o || {};
    return '<div class="banner' + (o.kind ? " banner-" + o.kind : "") + '" role="status">' + (o.spin ? '<span class="spin"></span>' : C.icon(o.icon || "info", 18)) + "<span>" + text + "</span>" + (o.btn ? C.btn(o.btn, { sm: true, attrs: o.attrs || "" }) : "") + "</div>";
  };
  C.playBanner = function (state) {
    if (state === "slow") return C.banner(t("h.slow", { n: 1 }), { spin: true, btn: t("h.retrynow"), attrs: "data-retry-now" });
    return "";
  };
  /* ---------- illustration: one bold picture per category, drawn from four flat shapes or fewer ----------
     Blue, yellow, white and ink only: coral and mint are never used here, because they only ever mean the left and the right answer.
     Every picture keeps its subject inside the middle square of a 320 x 200 field, so the same drawing crops to a square thumb. */
  var D = 'font-family="var(--font-display)" text-anchor="middle"';
  function coin(cx, cy, r, face, side, glyph, ink) {
    return '<circle cx="' + cx + '" cy="' + (cy + 9) + '" r="' + r + '" fill="var(' + side + ')"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(' + face + ')"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 11) + '" fill="none" stroke="var(' + side + ')" stroke-width="4"/>' +
      '<text x="' + cx + '" y="' + (cy + r * 0.36) + '" font-size="' + Math.round(r * 1.05) + '" fill="var(' + (ink || "--ink") + ')" ' + D + ">" + glyph + "</text>";
  }
  function spark(x, y, s, c) { return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10z" fill="var(' + (c || "--white") + ')"/>'; }
  var ART = {
    crypto: { bg: "accent-tint", d: coin(160, 96, 62, "--sun", "--sun-deep", "B") + spark(66, 52, 1.5) + spark(262, 142, 1.1) + spark(250, 40, 0.8, "--accent") },
    kaia: { bg: "accent-tint", d: coin(140, 104, 56, "--white", "--edge-deep", "K", "--accent") +
      '<path d="M216 150V74" stroke="var(--accent-deep)" stroke-width="22" stroke-linecap="round" transform="translate(0 7)"/><path d="M190 96l26-28 26 28" fill="none" stroke="var(--accent-deep)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 7)"/>' +
      '<path d="M216 150V74" stroke="var(--sun)" stroke-width="22" stroke-linecap="round"/><path d="M190 96l26-28 26 28" fill="none" stroke="var(--sun)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>' + spark(74, 44, 1.2) },
    markets: { bg: "sun-tint", d: '<g transform="translate(0 8)" fill="var(--accent-deep)"><rect x="88" y="112" width="40" height="52" rx="12"/><rect x="140" y="84" width="40" height="80" rx="12"/><rect x="192" y="48" width="40" height="116" rx="12"/></g>' +
      '<g fill="var(--accent)"><rect x="88" y="112" width="40" height="52" rx="12"/><rect x="140" y="84" width="40" height="80" rx="12"/><rect x="192" y="48" width="40" height="116" rx="12"/></g>' +
      '<path d="M84 84l42-30 32 14 44-38" fill="none" stroke="var(--ink)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="204" cy="29" r="11" fill="var(--sun)" stroke="var(--ink)" stroke-width="7"/>' + spark(262, 96, 1.1) },
    weather: { bg: "sky", d: '<g stroke="var(--sun)" stroke-width="13" stroke-linecap="round"><path d="M190 18v14M246 42l-10 10M134 42l10 10M262 96h-14"/></g><circle cx="190" cy="96" r="44" fill="var(--sun)"/>' +
      '<path d="M96 168a30 30 0 0 1 4-60 42 42 0 0 1 78 10 26 26 0 0 1 2 50z" fill="var(--edge-deep)" transform="translate(0 8)"/><path d="M96 168a30 30 0 0 1 4-60 42 42 0 0 1 78 10 26 26 0 0 1 2 50z" fill="var(--white)"/>' },
    sports: { bg: "accent", d: '<circle cx="160" cy="109" r="62" fill="var(--accent-deep)"/><circle cx="160" cy="100" r="62" fill="var(--white)"/>' +
      '<g fill="var(--ink)"><path d="M160 76l23 17-9 27h-28l-9-27z"/><path d="M160 38l20 8-20 14-20-14zM222 92l-3 22-22-13 5-20zM98 92l3 22 22-13-5-20zM196 150l-19 11-3-22 16-9zM124 150l19 11 3-22-16-9z"/></g>' + spark(62, 48, 1.4, "--sun") + spark(264, 150, 1, "--sun") },
    culture: { bg: "sun", d: '<g transform="translate(0 8)" fill="var(--sun-deep)"><rect x="92" y="84" width="136" height="84" rx="16"/></g><rect x="92" y="84" width="136" height="84" rx="16" fill="var(--ink)"/>' +
      '<g transform="rotate(-12 96 80)"><rect x="90" y="48" width="140" height="30" rx="10" fill="var(--ink)"/><path d="M108 48h18l-12 30H96zM148 48h18l-12 30h-18zM188 48h18l-12 30h-18z" fill="var(--white)"/></g>' +
      '<path d="M146 108v38l34-19z" fill="var(--white)"/>' }
  };
  App.artKey = function (q) { return q.id === "q5" ? "kaia" : ART[q.cat] ? q.cat : "crypto"; };
  C.art = function (q) {
    var a = ART[App.artKey(q)];
    return '<svg class="art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + a.d + "</svg>";
  };
  C.artBg = function (q) { return ART[App.artKey(q)].bg; };
  /* ---------- the mascot: Jam, a small blue blob that lives in the capsules. Used sparingly: sign in, empty states, the reward.
     moods: "" (smile), "cheer" (arms up, mouth open), "sleep" (eyes shut) */
  C.jam = function (mood, size) {
    size = size || 96;
    var eyes = mood === "sleep" ? '<path d="M35 55q7 6 14 0M63 55q7 6 14 0" fill="none" stroke="var(--white)" stroke-width="5" stroke-linecap="round"/>' :
      '<ellipse cx="42" cy="52" rx="9" ry="11" fill="var(--white)"/><ellipse cx="70" cy="52" rx="9" ry="11" fill="var(--white)"/><circle cx="44" cy="54" r="4.5" fill="var(--ink)"/><circle cx="72" cy="54" r="4.5" fill="var(--ink)"/>';
    var mouth = mood === "cheer" ? '<path d="M47 71h18a9 9 0 0 1-18 0z" fill="var(--ink)"/>' : mood === "sleep" ? '<circle cx="56" cy="74" r="3.5" fill="var(--ink)"/>' : '<path d="M48 71q8 8 16 0" fill="none" stroke="var(--ink)" stroke-width="4.5" stroke-linecap="round"/>';
    var arms = mood === "cheer" ? '<path d="M18 52L6 30M94 52l12-22" stroke="var(--accent)" stroke-width="11" stroke-linecap="round"/>' : "";
    return '<svg class="jam' + (mood ? " jam--" + mood : "") + '" viewBox="0 0 112 112" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' + arms +
      '<path d="M38 100v6M74 100v6" stroke="var(--accent-deep)" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M56 16c26 0 42 18 42 46 0 26-14 40-42 40S14 88 14 62c0-28 16-46 42-46z" fill="var(--accent)"/>' +
      '<path d="M30 38q8-12 22-13" fill="none" stroke="var(--accent-tint)" stroke-width="5" stroke-linecap="round" opacity=".55"/>' + eyes + mouth + "</svg>";
  };
  /* the question card: a collectible card. The picture on its flat ground with the number and the category, the question, how it is answered,
     and the two answers as two chunky keys. The two stickers (one per answer) wait above the picture and are slapped on by a pick. */
  C.qcard = function (id, o) {
    o = o || {};
    var q = App.q(id);
    var long = /[　-鿿가-힯]/.test(q.title) ? q.title.length > 22 : q.title.length > 44;
    function choice(d) {
      return '<button type="button" class="choice" data-dir="' + d + '"' + (o.disabled ? ' aria-disabled="true"' : "") + (o.static ? ' tabindex="-1"' : "") + ' aria-label="' + esc(t("h.pick.aria", { choice: q[d], q: q.title })) + '">' +
        '<span class="choice-in">' + (d === "l" ? ic("left", 20) : "") + "<span>" + esc(q[d]) + "</span>" + (d === "r" ? ic("right", 20) : "") + "</span></button>";
    }
    function sticker(d) { return '<span class="qstamp qstamp--' + d + '" aria-hidden="true"><span class="qstamp-in">' + ic(d === "l" ? "left" : "right", 18) + "<b>" + esc(q[d]) + "</b></span></span>"; }
    return '<article class="qcard" data-q="' + q.n + '" data-id="' + id + '" data-pos="' + (o.pos || 0) + '" role="group" aria-label="' + esc(t("h.qn.sr", { n: q.n }) + ": " + q.title) + '">' +
      '<div class="qcard-in"><div class="qart' + (o.noimg ? " qart--none" : "") + '" data-bg="' + (o.noimg ? "well" : C.artBg(q)) + '">' + (o.noimg ? "" : C.art(q)) +
      '<span class="qno" aria-hidden="true"><b>' + q.n + "</b>/5</span><span class=\"qkick\">" + t("cat." + q.cat) + "</span></div>" +
      '<span class="qtint" aria-hidden="true"></span>' + sticker("l") + sticker("r") +
      '<div class="qcard-body"><h2' + (long ? ' class="is-long"' : "") + ">" + esc(q.title) + "</h2>" +
      (o.failed ? '<p class="qcard-note">' + ic("warn", 16) + t("h.notsaved") + "</p>" : "") +
      (o.static ? '<div class="qmeta">' : '<button type="button" class="qmeta" data-ai-info="' + id + '" aria-haspopup="dialog">') + '<span class="qmeta-t"><span>' + t("h.answer", { rule: esc(q.rule) }) + "</span><span>" + t("h.ai", { time: q.settle }) + "</span></span>" + (o.static ? "</div>" : ic("info", 18) + "</button>") +
      '<div class="choices">' + choice("l") + choice("r") + "</div>" +
      (o.final ? '<p class="qcard-final">' + t("h.final") + "</p>" : "") +
      "</div></div></article>";
  };
  /* the view switch on the home head: a two position slider key */
  C.viewSwitch = function (cur, state) {
    function a(id, file) { var on = id === cur; return '<a href="' + file + (on || !state ? "" : "?state=" + state) + '"' + (on ? ' aria-current="page"' : "") + ">" + t("h.view." + id) + "</a>"; }
    return '<div class="viewsw" role="group" aria-label="' + esc(t("h.view.label")) + '">' + a("card", "home.html") + a("term", "home-list.html") + "</div>";
  };
  C.closes = function (secs) { return "<span>" + t("h.closes") + '</span> <b data-cd="' + secs + '"></b>'; };
  C.thumb = function (q) { if (typeof q === "string") q = App.q(q); return '<span class="thumb" data-bg="' + C.artBg(q) + '" aria-hidden="true">' + C.art(q) + "</span>"; };
  /* the live chip under the header: the one live fact of the screen (time until the set closes, time until the week ends) */
  C.dateline = function (liveHtml) {
    return liveHtml ? '<div class="livebar"><span class="livechip">' + ic("clock", 16) + '<span class="livechip-t">' + liveHtml + "</span></span></div>" : "";
  };

  /* ---------- shell ---------- */
  var TABS = [
    { id: "home", icon: "cards", href: function () { return App.store.get("view", "card") === "term" ? "home-list.html" : "home.html"; } },
    { id: "results", icon: "list", href: function () { return "results.html"; } },
    { id: "rank", icon: "podium", href: function () { return "ranking.html"; } },
    { id: "stake", icon: "lock", href: function () { return "stakes.html"; } },
    { id: "wallet", icon: "wallet", href: function () { return "wallet.html"; } }
  ];
  App.homeHref = function () { return TABS[0].href(); };
  C.tabbar = function (current, badges) {
    badges = badges || { home: "dot", results: 2 };
    return '<nav class="tb" aria-label="' + esc(t("nav.tabs")) + '"><div class="tb-in">' + TABS.map(function (tb) {
      var b = badges[tb.id], badge = "";
      if (b === "dot") badge = '<span class="tb-dot"></span><span class="sr-only">' + t("tab.badge." + tb.id) + "</span>";
      else if (b) badge = '<span class="tb-n" aria-hidden="true">' + (b > 9 ? "9+" : b) + '</span><span class="sr-only">' + t("tab.badge.results", { n: b }) + "</span>";
      return '<a href="' + tb.href() + '"' + (tb.id === current ? ' aria-current="page"' : "") + '><span class="tb-key"><span class="tb-ic">' + ic(tb.icon, 24) + badge + '</span><span class="tb-l">' + t("tab." + tb.id) + "</span></span></a>";
    }).join("") + "</div></nav>";
  };
  /* the header: the wordmark (or, on a sub page, the back key and the page title), the points as a coin chip, the profile. */
  C.header = function (o) {
    o = o || {};
    var pts = o.points === undefined ? M.user.points : o.points, st = o.pts || "";
    var pill = st === "loading" ? C.skel("44px", "12px") :
      (st === "pending" ? '<span class="spin"></span>' : "") + '<span id="pts-val">' + F.pts(pts) + "</span>" + (st === "hits" ? '<span class="pts-tag">+' + M.user.pendingHit + "</span>" : "");
    var label = st === "loading" ? t("hd.points.loading") : t("hd.points", { p: F.int(pts) }) + (st === "pending" ? " " + t("hd.points.pending") : st === "hits" ? " " + t("hd.points.hits", { n: M.user.pendingHit, time: "22:10" }) : st === "stale" ? " " + t("hd.points.stale") : "");
    var left = o.back ? '<a class="mast-back" href="' + o.back + '" aria-label="' + esc(t("hd.back")) + '">' + ic("back", 24) + '</a><h1 class="mast-title">' + (o.title || "") + "</h1>" :
      '<a class="mast-home" href="' + TABS[0].href() + '" aria-label="' + esc(t("hd.home")) + '">' + C.logo() + "</a>";
    return '<header class="mast' + (o.back ? " mast--sub" : "") + '"><div class="mast-in">' + left + '<div class="mast-end">' +
      '<a class="pts" id="pts" href="wallet.html" aria-label="' + esc(label) + '"><span class="pts-in"><i class="pcoin" aria-hidden="true">P</i>' + pill + "</span></a>" +
      '<a class="me" href="profile.html" aria-label="' + esc(t("hd.profile")) + '"' + (o.me ? ' aria-current="page"' : "") + '><span class="me-in" aria-hidden="true">' + esc(M.user.name.charAt(0).toUpperCase()) + "</span></a>" +
      '</div></div></header>';
  };
  C.offbar = function () { return '<div class="offbar" role="status">' + ic("offline", 16) + "<div>" + t("off.bar") + "<small>" + t("off.last", { time: F.date(new Date(Date.now() - 23 * 60000), true) }) + "</small></div></div>"; };

  /* App.mount: builds the whole screen. cfg: tab, back, title, live (the dateline's live cell), head, body, pin, bare, raw, offline, pts, points, badges, cls, after */
  App.mount = function (cfg) {
    var offline = cfg.offline === undefined ? App.state === "offline" : cfg.offline;
    App.offline = offline;
    var html = '<a class="skip" href="#main">' + t("nav.skip") + "</a>" +
      '<div class="app' + (cfg.pin ? " app--pin" : "") + (cfg.bare ? " app--bare" : "") + (cfg.cls ? " " + cfg.cls : "") + '">' +
      (cfg.bare ? "" : C.header({ back: cfg.back, title: cfg.title, pts: cfg.pts, points: cfg.points, me: cfg.me })) +
      (offline && !cfg.bare ? C.offbar() : "") +
      '<main id="main" tabindex="-1">' + (cfg.raw ? cfg.raw : (cfg.back || cfg.bare ? "" : C.dateline(cfg.live)) + (cfg.head ? '<section class="ph">' + cfg.head + "</section>" : "") + '<div class="pg">' + cfg.body + "</div>") + "</main>" +
      (cfg.pin || "") + (cfg.bare ? "" : C.tabbar(cfg.tab, cfg.badges)) + "</div>" +
      '<div class="toasts' + (cfg.bare ? " is-bare" : "") + '" id="toasts" role="status" aria-live="polite"></div>' +
      '<div class="sr-only" id="live" aria-live="polite"></div>' +
      '<div class="sheet-root" id="sheet-root"><div class="sheet-scrim" data-sheet-scrim></div><div class="sheet" id="sheet" role="dialog" aria-modal="true" tabindex="-1"></div></div>';
    document.body.innerHTML = html;
    /* a section change is a quick page turn (under 200 ms, on the content only, never on the chrome): a tab further right comes from the right,
       a sub page comes from the right, going back comes from the left. The same section again only settles. Input is live from the first frame. */
    (function () {
      var order = { home: 0, results: 1, rank: 2, stake: 3, wallet: 4 }, now = { i: order[cfg.tab] === undefined ? 5 : order[cfg.tab], sub: !!cfg.back || !!cfg.bare }, was = null;
      try { was = JSON.parse(sessionStorage.getItem("cjp.nav") || "null"); sessionStorage.setItem("cjp.nav", JSON.stringify(now)); } catch (e) {}
      var dir = !was ? "same" : now.sub && !was.sub ? "fwd" : !now.sub && was.sub ? "back" : now.i > was.i ? "fwd" : now.i < was.i ? "back" : "same";
      var m = $("#main"); if (m && !reduce) m.setAttribute("data-in", dir);
    })();
    document.title = (cfg.docTitle || cfg.title || "Cojam") + " | Cojam Daily";
    App.enhance(document.body);
    App.pinFit();
    if (cfg.after) cfg.after();
    App.pinFit();
  };
  App.pinFit = function () {
    var app = $(".app--pin"); if (!app) return;
    function fit() { var p = $(".app--pin > .pin"); if (p) app.style.setProperty("--pin-h", p.offsetHeight + "px"); }
    fit();
    if (!app._ro && window.ResizeObserver) { app._ro = new ResizeObserver(fit); var p0 = $(".app--pin > .pin"); if (p0) app._ro.observe(p0); window.addEventListener("resize", fit); }
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
        var sr = el.parentNode.querySelector("[data-cd-sr]"); if (sr && +p[1] !== lastMin) { lastMin = +p[1]; sr.textContent = t("d.next.sr", { h: +p[0], m: +p[1] }); }
        if (fmt === "clock") { var sp = $$("span", el); sp[0].textContent = p[0]; sp[1].textContent = p[1]; sp[2].textContent = p[2]; }
        else if (fmt === "dh") el.textContent = t("k.dh", { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600) });
        else App.digits(el, p.join(":"));
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
      function put() { el.innerHTML = Number(Math.min(cap, v + rate * (Date.now() - t0) / 1000)).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).replace(/\d/g, '<i class="dg">$&</i>'); }
      put(); timers.push(setInterval(put, reduce ? 10000 : 1000));
    });
  };
  /* a countdown ticks like a date stamp: only the digit that changed is replaced, and it drops into place (one short step, never under reduced motion) */
  App.digits = function (el, str) {
    if (!el._dg || el._s.length !== str.length) {
      el.innerHTML = str.replace(/./g, function (c) { return '<i class="' + (/\d/.test(c) ? "dg" : "dgs") + '">' + c + "</i>"; });
      el._dg = Array.prototype.slice.call(el.children); el._s = str; return;
    }
    for (var i = 0; i < str.length; i++) if (str[i] !== el._s[i]) {
      var n = el._dg[i]; n.textContent = str[i];
      if (!reduce && !document.hidden) { n.classList.remove("tk"); void n.offsetWidth; n.classList.add("tk"); }
    }
    el._s = str;
  };
  document.addEventListener("visibilitychange", function () { document.documentElement.classList.toggle("is-hidden", document.hidden); });

  /* ---------- count up ---------- */
  /* a figure rolls to its new value. A second call retargets from where the figure is now (it never restarts from zero), so typing stays fluid. */
  App.countTo = function (el, from, to, fmt, done, dur) {
    if (!el) return; fmt = fmt || F.pts;
    if (el._roll) cancelAnimationFrame(el._roll);
    if (from === null || from === undefined) from = el._val === undefined ? to : el._val;
    if (reduce || from === to) { el._val = to; el.innerHTML = fmt(to); if (done) done(); return; }
    var t0 = performance.now(); dur = dur || 400;
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el._val = from + (to - from) * e; el.innerHTML = fmt(el._val);
      if (k < 1) el._roll = requestAnimationFrame(step); else { el._roll = 0; el._val = to; if (done) done(); }
    })(t0);
  };
  /* a stamp lands: the class restarts its one keyframe. order staggers a sequence. */
  App.stampLand = function (el, order) {
    if (!el || reduce) return;
    el.style.setProperty("--d", Math.min(order || 0, 9) * 70 + "ms"); el.classList.remove("is-land"); void el.offsetWidth; el.classList.add("is-land");
  };
  App.addPoints = function (n) {
    var el = $("#pts-val"), pill = $("#pts"); if (!el) return;
    var from = M.user.points; M.user.points += n;
    App.countTo(el, from, M.user.points);
    if (pill && !reduce) { pill.classList.add("is-pulse"); setTimeout(function () { pill.classList.remove("is-pulse"); }, 220); }
  };

  /* ---------- toast: one visible, the rest queue ---------- */
  var tq = [], tBusy = false;
  var tKey = "";
  App.toast = function (msg, o) {
    o = o || {};
    if (o.key && (tKey === o.key || tq.some(function (q) { return q.o.key === o.key; }))) return;   /* the same notice is never stacked */
    tq.push({ msg: msg, o: o }); if (!tBusy) nextToast();
  };
  function nextToast() {
    var it = tq.shift(), box = $("#toasts"); if (!it || !box) { tBusy = false; tKey = ""; return; }
    tBusy = true; tKey = it.o.key || "";
    var el = document.createElement("div"); el.className = "toast";
    el.innerHTML = "<span>" + it.msg + "</span>" + (it.o.btn ? '<button type="button">' + it.o.btn + "</button>" : "");
    box.appendChild(el);
    var gone = false;
    function out() { if (gone) return; gone = true; el.classList.add("is-out"); setTimeout(function () { el.remove(); nextToast(); }, 200); }
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
      if (!root.classList.contains("is-open")) { lastFocus = document.activeElement; root.classList.add("is-open"); var pg = $(".app") || $(".doc"); if (pg) pg.setAttribute("inert", ""); sh.style.transform = ""; setTimeout(function () { sh.focus(); }, 50); }
      App.enhance(sh);
    },
    close: function (silent) {
      var root = $("#sheet-root"); if (!root || !root.classList.contains("is-open")) return;
      root.classList.remove("is-open"); var pg = $(".app") || $(".doc"); if (pg) pg.removeAttribute("inert"); $("#sheet").style.transform = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      var o = sheetOpts; sheetOpts = null; if (!silent && o && o.onClose) o.onClose();
    },
    closable: function () { return !sheetOpts || sheetOpts.closable !== false; }
  };

  /* ---------- transaction sheet (staking, claim, withdraw principal, convert, withdraw CT). Never used for picks. ---------- */
  var HASH = "0x8c41f0a7d2be6953c1e07a4f9b25d83e61a0c7f4b9d2e8351a6f0c4d7e92b3a1";
  var txTimers = [], lastBtn = null;
  document.addEventListener("click", function (e) { var b = e.target.closest(".btn"); if (b && !b.closest("#sheet")) lastBtn = b; }, true);
  function txClear() { txTimers.forEach(clearTimeout); txTimers = []; }
  function later(fn, ms) { txTimers.push(setTimeout(fn, reduce ? Math.min(ms, 500) : ms)); }
  App.tx = {
    view: function (state, cfg) {
      var h = "";
      if (state === "review") {
        var rv = cfg.review;
        h = "<h2>" + (rv.title || t("tx.review.h")) + "</h2>" + C.rows(rv.rows) +
          (rv.check ? '<label class="check"><input type="checkbox" id="tx-check"><span>' + rv.check + "</span></label>" : "") +
          (rv.note ? '<p class="sheet-warn" id="tx-note">' + ic("info", 18) + "<span>" + rv.note + "</span></p>" : "") +
          (rv.warn ? '<p class="sheet-warn">' + ic("lock", 18) + "<span>" + rv.warn + "</span></p>" : "") +
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
        h = '<div class="sheet-state sheet-state--ok">' + App.tx.doneFig(ok) + "<h2>" + ok.title + "</h2></div>" + (ok.rows ? C.rows(ok.rows) : "") +
          '<div class="sheet-acts">' + (ok.btn ? C.btn(ok.btn.label, { kind: "primary", block: true, href: ok.btn.href }) + C.btn(t("common.done"), { kind: "ghost", block: true, attrs: "data-tx=\"done\"" }) : C.btn(t("common.done"), { kind: "primary", block: true, attrs: "data-tx=\"done\"" })) +
          '<a class="linkish self-center" href="https://kaiascan.io/tx/' + HASH + '" target="_blank" rel="noopener">' + t("tx.scan") + ic("ext", 16) + "</a></div>";
      } else if (state === "failed") {
        h = '<div class="sheet-state"><div class="sheet-ic is-bad">' + ic("x", 32) + "</div><h2>" + t("tx.fail.h") + '</h2><p class="sheet-lead">' + t(cfg.failKey || "tx.fail.reverted") + "</p></div>" +
          '<div class="sheet-acts">' + C.btn(t("common.retry"), { kind: "primary", block: true, attrs: "data-tx=\"retry\"" }) + C.btn(t("common.close"), { kind: "ghost", block: true, attrs: "data-tx=\"cancel\"" }) + "</div>";
      }
      return h;
    },
    /* the success moment speaks the product's own language: what happened as a display figure on ink beside a lime done block (the day done moment, smaller).
       The figure is success.fig (for example "500 CT") or, without it, the CT amount named in the title (else the point amount). */
    doneFig: function (ok) {
      var fig = ok.fig, m;
      if (!fig) { var txt = String(ok.title).replace(/<[^>]+>/g, ""), re = /([+\-]?\d[\d,]*(?:\.\d+)?)\s?(CT|P)(?![A-Za-z])/g, hit = null; while ((m = re.exec(txt))) { if (!hit || (m[2] === "CT" && hit[2] !== "CT") || m[2] === hit[2]) hit = m; } if (hit) fig = hit[1] + " " + hit[2]; }
      var parts = fig ? /^(.*?)(?:\s(CT|P))?$/.exec(fig) : null;
      return '<div class="sheet-done" aria-hidden="true">' + C.rstamp("hit", ic("check", 16) + t("common.done")) + (parts ? '<span class="sheet-done-fig">' + parts[1] + (parts[2] ? "<small>" + parts[2] + "</small>" : "") + "</span>" : "") + "</div>";
    },
    show: function (state, cfg) {
      App.tx.cfg = cfg; App.tx.state = state;
      App.sheet.open(App.tx.view(state, cfg), { closable: state === "review" || state === "success" || state === "failed", label: cfg.label, onClose: function () { txClear(); if (state === "success" && cfg.onDone) cfg.onDone(); } });
      App.live($("#sheet h2") ? $("#sheet h2").textContent : "");
      if (state === "success") App.stampLand($("#sheet .sheet-done .rstamp"), 3);   /* the filed stamp lands once the sheet is up; nothing plays on a failure */
    },
    /* While a transaction runs, the button that started it is disabled and carries the status ("Staking 500 CT: sending").
       Nothing floats over the page, and the same action cannot be started twice. A screen can take this over with cfg.busy(on, label). */
    busy: function (on) {
      var cfg = App.tx.cfg; if (!cfg) return;
      App.tx.pending = !!on;
      var label = t("tx.chip", { label: cfg.label });
      if (cfg.busy) { cfg.busy(!!on, label); return; }
      var b = cfg._trigger; if (!b || !b.isConnected) return;
      if (on) { if (b._tx) return; b._tx = { html: b.innerHTML, dis: b.disabled }; b.innerHTML = '<span class="spin"></span><span>' + label + "</span>"; b.disabled = true; b.classList.add("is-busy"); }
      else if (b._tx) { b.innerHTML = b._tx.html; b.disabled = b._tx.dis; b.classList.remove("is-busy"); b._tx = null; }
    },
    go: function (state) { App.tx.state = state; if (state === "success" || state === "failed") App.tx.busy(false); var cfg = App.tx.cfg;
      if (!App.tx.hidden) { App.tx.show(state, cfg); return; }
      /* after "Hide" the player has moved on: a finished transaction confirms with a toast and the sheet stays shut. Only a failure comes back, because it needs an answer. */
      if (state === "failed") { App.tx.hidden = false; App.tx.show(state, cfg); }
      else if (state === "success") {
        App.tx.hidden = false; var ok = cfg.success || {}, msg = String(ok.title || cfg.label || "");
        App.toast(msg, ok.btn ? { btn: ok.btn.label, fn: function () { location.href = ok.btn.href; } } : {});
        App.live(msg.replace(/<[^>]+>/g, "")); if (cfg.onDone) cfg.onDone();
      } },
    /* run the whole mock flow with real waits */
    run: function (cfg) {
      if (App.tx.pending) return;   /* one at a time */
      txClear(); App.tx.hidden = false; App.tx.cfg = cfg;
      if (!$("#sheet-root.is-open")) cfg._trigger = lastBtn;
      if (cfg.review && !cfg._confirmed) { App.tx.show("review", cfg); return; }
      App.tx.show("signing", cfg); App.tx.busy(true);
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
    else if (a === "cancel") { var running = App.tx.state !== "review" && App.tx.state !== "failed"; txClear(); App.tx.busy(false); App.sheet.close(true); if (running) App.toast(cfg.cancelMsg || t("tx.fail.cancel")); }
    else if (a === "hide") { App.tx.hidden = true; App.sheet.close(true); }
    else if (a === "done") { App.sheet.close(true); if (cfg.onDone) cfg.onDone(); }
    else if (a === "retry") { cfg.fail = false; App.tx.run(cfg); }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "tx-check") { var c = $("#tx-confirm"); if (c) c.disabled = !e.target.checked; }
    if (e.target.matches("[data-lang]")) I.setLang(e.target.value);
  });

  /* ---------- global behaviours: press feedback, copy, seg, sheet close, max, reload ---------- */
  document.addEventListener("pointerdown", function (e) {
    var el = e.target.closest(".btn, .choice, .seg-btn, .field-max, .period button, .undo"); if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    el.classList.add("is-pressed"); var t0 = Date.now();
    function up() { setTimeout(function () { el.classList.remove("is-pressed"); }, Math.max(0, 90 - (Date.now() - t0))); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  document.addEventListener("click", function (e) {
    var c = e.target.closest("[data-copy]");
    if (c) {
      var text = c.getAttribute("data-copy");
      try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {}); } catch (err) {}
      if (c.hasAttribute("data-toast")) App.toast(c.getAttribute("data-toast"));   /* a button that turns into "Copied" needs no toast */
      var dn = c.getAttribute("data-done"), lab = $("span", c);
      if (dn && lab && !c._old) {
        var chip = c.classList.contains("addr-chip"), svg = chip && $("svg", c), was = svg && svg.outerHTML;
        if (chip) { c.style.minWidth = c.offsetWidth + "px"; if (svg) svg.outerHTML = ic("check", 16); App.live(dn); }
        if (c.classList.contains("code-block")) App.live(dn);
        c._old = lab.textContent; lab.textContent = dn; c.classList.add("is-done");
        setTimeout(function () { lab.textContent = c._old; c._old = null; c.classList.remove("is-done"); if (chip) { var s2 = $("svg", c); if (s2 && was) s2.outerHTML = was; c.style.minWidth = ""; } }, 2000);
      }
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
    var hb = e.target.closest(".mast-back");
    if (hb) { var ref = document.referrer; if (ref && ref.indexOf(location.origin) === 0 && history.length > 1 && !/[?&]state=/.test(location.search)) { e.preventDefault(); history.back(); } return; }
    var bk = e.target.closest("[data-toast-msg]"); if (bk) App.toast(bk.getAttribute("data-toast-msg"));
    var ai = e.target.closest("[data-ai-info]"); if (ai) App.aiSheet(ai.getAttribute("data-ai-info"));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && $("#sheet-root.is-open")) {
      if (App.sheet.closable()) App.sheet.close();
      else { var vb = $('#sheet [data-tx="cancel"], #sheet [data-tx="hide"]'); if (vb) vb.click(); }
    }
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

  /* how an answer is set: opened from the "AI settles it" line of a question */
  App.aiSheet = function (id) {
    var q = App.q(id);
    App.sheet.open("<h2>" + t("h.ai.h") + '</h2><ol class="txsteps txsteps--plain">' + ["h.ai.1", "h.ai.2", "h.ai.3"].map(function (k, i) { return '<li><span class="n">' + (i + 1) + "</span><span>" + t(k) + "</span></li>"; }).join("") + "</ol>" +
      C.rows([[t("h.ai.src"), esc(q.rule)], [t("h.ai.when"), t("h.ai.after", { time: q.settle })]]) +
      '<div class="sheet-acts">' + C.btn(t("common.close"), { block: true, attrs: "data-sheet-close" }) + "</div>");
  };

  /* ---------- forgiving amount parser ---------- */
  App.parseAmount = function (s) {
    s = String(s).trim().replace(/\s*(ct|p|kaia)$/i, "").replace(/,/g, "");
    if (s === "") return { empty: true };
    if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return { bad: true };
    var dec = (s.split(".")[1] || "").length;
    return { value: parseFloat(s), decimals: dec };
  };

  /* ---------- swipe card stack (spec 6.3) ----------
     Drag follows the finger, a release past the threshold (or a fling) throws the card, the next one springs forward.
     Release: a drag commits past 35% of the card width however slowly it was made. A fling commits only with real travel (96 px at 0.5 px/ms)
     or with clearly more speed (1.1 px/ms after 56 px), always in the direction of the drag. A drag that is more vertical than horizontal never commits.
     Guards: for 400 ms after a commit a tap on an answer is dropped (a quick double tap never answers two cards), while a swipe or a key press
     within 200 ms is a second deliberate pick: one is queued and plays when that guard ends, so a quick pick is not lost.
     Key repeat is ignored, arrow keys work without focus inside the card.
     A thrown card is kept so restore() can fly it back in (Undo). */
  App.deck = function (root, o) {
    o = o || {};
    var ARM = 0.35, GUARD = 200, TAP_GUARD = 400, FLING = { far: 96, v: 0.5, near: 56, fast: 1.1 }, guardUntil = 0, tapUntil = 0, queued = null, qTimer = null;
    function live() { return $$(".qcard:not(.is-out)", root); }
    function guarded() { return Date.now() < guardUntil; }
    function queue(dir) {
      queued = dir; clearTimeout(qTimer);
      qTimer = setTimeout(function () { var d = queued, c = live()[0]; queued = null; if (d && c) commit(c, d, 0, 0, 0, "queue"); }, Math.max(0, guardUntil - Date.now()) + 10);
    }
    function layout() {
      var cards = live();
      cards.forEach(function (c, i) {
        c.setAttribute("data-pos", i < 3 ? i : "x"); c.style.transform = ""; c.style.transition = ""; c.style.opacity = "";
        if (i === 0) c.removeAttribute("inert"); else c.setAttribute("inert", "");
        if (i === 1 || i === 2) { var im = $("img", c); if (im && im.decode) im.decode().catch(function () {}); }   /* decoded before it reaches the front */
      });
      root.classList.toggle("is-empty", !cards.length);
    }
    function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
    /* k: travel as a share of the card width, -1 to 1. Below the commit threshold the stamp only hints (0.4 at most) and no button lights:
       the card never shows a pick it would not make on release. */
    /* Under the threshold the stamp is a proof: an unfilled outline (ink on the sheet, so it is readable at once) that grows with the travel.
       At the threshold it presses in: filled with the answer's ink, one size up, with a short recoil. The card never shows a pick it would not make on release. */
    function paint(card, k, armed) {
      var dir = k > 0 ? "r" : k < 0 ? "l" : "", a = Math.abs(k);
      $$(".choice", card).forEach(function (b) { b.classList.toggle("is-hot", !!armed && b.getAttribute("data-dir") === dir); });
      var tint = $(".qtint", card); if (dir) tint.setAttribute("data-dir", dir); tint.style.opacity = armed ? 0.2 : 0;
      [["l", 7], ["r", -7]].forEach(function (x) {
        var el = $(".qstamp--" + x[0], card), on = dir === x[0];
        el.style.opacity = on ? (armed ? 1 : Math.min(1, a * 12)) : 0; el.style.visibility = on ? "visible" : "";
        el.style.transform = on && !armed ? "rotate(" + x[1] * 2 + "deg) scale(" + (0.55 + Math.min(0.3, a * 0.86)).toFixed(3) + ")" : "";
        el.classList.toggle("is-armed", !!armed && on);
      });
    }
    /* the sheet lifts off the stack while it is held: a flat shadow of ink follows it, a few pixels down and to the right */
    var lift = document.createElement("div"); lift.className = "deck-lift"; lift.setAttribute("aria-hidden", "true"); root.appendChild(lift);
    function setLift(tf) { root.classList.toggle("is-lift", !!tf); lift.style.transform = tf || ""; }
    function feedback(card, dx, dy) {
      var w = card.offsetWidth, k = Math.max(-1, Math.min(1, dx / w));
      /* paper turns about the hand: held by its upper half it leans with the drag, held by its lower half it leans the other way */
      var rot = reduce ? "" : " rotate(" + (k * 11 * (card._low ? -1 : 1)).toFixed(2) + "deg)", pos = "translate(" + dx + "px," + (dy * 0.18).toFixed(1) + "px)";
      card.style.transform = pos + rot + (reduce ? "" : " scale(1.02)");
      if (!reduce) setLift("translate(" + (dx * 0.86).toFixed(1) + "px," + (dy * 0.12 + 14).toFixed(1) + "px)" + rot);
      paint(card, k, Math.abs(k) >= ARM);
      return k;
    }
    /* let go under the threshold: the sheet flicks back onto the stack with a small overshoot */
    function back(card) { card.classList.add("is-back"); clearTimeout(card._bk); card._bk = setTimeout(function () { card.classList.remove("is-back"); }, 460); }
    function reset(card) { card.classList.remove("is-drag"); setLift(""); back(card); card.style.transform = ""; paint(card, 0, false); }
    function off(sign, w, dy) { return "translate(" + sign * (innerWidth * 0.5 + w) + "px," + ((dy || 0) * 0.4 + 30).toFixed(0) + "px) rotate(" + sign * 24 + "deg)"; }
    /* throw: the card leaves on its side with the speed of the release; the deck advances with a spring (CSS, on data-pos) */
    function commit(card, dir, v, dx, dy, src) {
      if (card.classList.contains("is-out")) return;
      if (o.disabled && o.disabled()) { reset(card); if (o.onBlocked) o.onBlocked(); return; }
      if (src === "tap" ? Date.now() < tapUntil : guarded()) { reset(card); if (src !== "tap") queue(dir); return; }
      guardUntil = Date.now() + GUARD; tapUntil = Date.now() + TAP_GUARD;
      var w = card.offsetWidth, sign = dir === "r" ? 1 : -1, dist = innerWidth * 0.5 + w - Math.abs(dx || 0);
      var ms = reduce ? 200 : Math.round(Math.max(190, Math.min(380, dist / Math.max(v || 0, 1.6))));
      card.classList.remove("is-drag", "is-back"); card.classList.add("is-out"); card.setAttribute("data-pos", "out"); setLift("");
      paint(card, sign * 0.5, true);
      var st = $(".qstamp--" + dir, card); st.classList.add("is-thunk");   /* the stamp comes down for good */
      /* a tap or a key has no drag to show the stamp, so the sheet holds for 130 ms while the stamp lands, then it is thrown. The pick itself is taken at once. */
      var hold = src === "swipe" || reduce ? 0 : 170;
      function fly() {
        card.style.transition = reduce ? "" : "transform " + ms + "ms cubic-bezier(0.3, 0.55, 0.4, 1), opacity " + ms + "ms cubic-bezier(0.6, 0, 0.9, 0.4)";
        void card.offsetWidth;
        if (!reduce) card.style.transform = off(sign, w, dy);
        card.style.opacity = 0;
      }
      if (hold) { card.style.transition = "transform 170ms cubic-bezier(0.34, 1.56, 0.64, 1)"; card.style.transform = "translateY(-4px) scale(1.02) rotate(" + sign * 1.5 + "deg)"; card._fly = setTimeout(fly, hold); } else fly();
      buzz(12);
      layout();
      if (card.contains(document.activeElement)) root.focus({ preventScroll: true });
      card._rm = setTimeout(function () { card.remove(); }, ms + 40 + hold);
      if (o.onCommit) o.onCommit(+card.getAttribute("data-q"), dir, live().length, card);
    }
    /* Undo: the thrown card flies back in from the side it left and takes the front; the card that had advanced drops back behind it */
    function restore(card, dir) {
      clearTimeout(card._rm); clearTimeout(card._fly);
      var first = live()[0] || null, sign = dir === "r" ? 1 : -1;
      card.style.transition = "none"; card.style.opacity = 0;
      /* pulled back out of the tray: it comes in low from the side it left, still turned, and settles on the stack with the same small overshoot */
      if (!reduce) card.style.transform = "translate(" + sign * root.offsetWidth * 0.92 + "px,26px) rotate(" + sign * 11 + "deg)";
      card.classList.remove("is-out", "is-drag"); paint(card, 0, false); $$(".qstamp", card).forEach(function (q) { q.classList.remove("is-thunk"); }); back(card);
      root.insertBefore(card, first);
      card.setAttribute("data-pos", "0");
      void card.offsetWidth;
      layout();
      guardUntil = tapUntil = Date.now() + 250; queued = null; clearTimeout(qTimer);   /* the tap that undid cannot also pick */
      root.focus({ preventScroll: true });
    }
    var drag = null, swallow = 0;
    root.addEventListener("pointerdown", function (e) {
      var card = e.target.closest('.qcard[data-pos="0"]'); if (!card || card.classList.contains("is-out") || (e.pointerType === "mouse" && e.button !== 0)) return;
      var cr = card.getBoundingClientRect(); card._low = e.clientY > cr.top + cr.height * 0.6;
      drag = { card: card, x: e.clientX, y: e.clientY, id: e.pointerId, lock: false, armed: false, pts: [{ x: e.clientX, t: e.timeStamp }] };
    });
    root.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.lock) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }       /* vertical first: hand over to page scroll */
        if (Math.abs(dx) < 10) return;
        drag.lock = true; drag.card.classList.remove("is-back"); drag.card.classList.add("is-drag"); try { drag.card.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
      drag.pts.push({ x: e.clientX, t: e.timeStamp }); if (drag.pts.length > 8) drag.pts.shift();
      var k = feedback(drag.card, dx, dy), armed = Math.abs(k) >= ARM && Math.abs(dx) > Math.abs(dy);
      if (armed !== drag.armed) { drag.armed = armed; if (armed) buzz(5); }   /* a light tick when the release would commit */
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null; if (!d.lock) return;
      swallow = Date.now();
      var dx = e.clientX - d.x, dy = e.clientY - d.y, w = d.card.offsetWidth, ax = Math.abs(dx), sign = dx > 0 ? 1 : -1;
      /* release speed: the samples of the last 100 ms only, signed, so a pause before the release or a flick back is not a fling */
      var pts = d.pts.filter(function (p) { return e.timeStamp - p.t <= 100; }), a = pts[0], b = pts[pts.length - 1];
      var v = a && b.t > a.t ? Math.max(0, sign * (b.x - a.x) / (b.t - a.t)) : 0;
      var fling = (ax >= FLING.far && v >= FLING.v) || (ax >= FLING.near && v >= FLING.fast);
      if (e.type !== "pointercancel" && ax > Math.abs(dy) && (ax / w >= ARM || fling)) commit(d.card, sign > 0 ? "r" : "l", v, dx, dy, "swipe"); else reset(d.card);
    }
    root.addEventListener("pointerup", end); root.addEventListener("pointercancel", end);
    root.addEventListener("click", function (e) {
      var b = e.target.closest(".choice"); if (!b || b.disabled) return;
      if (Date.now() - swallow < 250) { e.preventDefault(); return; }
      var card = b.closest(".qcard"); if (card.getAttribute("data-pos") !== "0") return;
      commit(card, b.getAttribute("data-dir"), 0, 0, 0, "tap");   /* a tap plays the same throw */
    });
    /* arrow keys pick from anywhere on the screen, unless a form control, a link or a sheet has the focus. A held key never repeats a pick. */
    if (!o.nokeys) document.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || $("#sheet-root.is-open")) return;
      var a = document.activeElement;
      if (a && a !== document.body && a !== root && !root.contains(a) && /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(a.tagName)) return;
      var card = live()[0]; if (!card) return;
      e.preventDefault(); commit(card, e.key === "ArrowRight" ? "r" : "l", 0, 0, 0, "key");
    });
    root.setAttribute("tabindex", "-1");
    layout();
    return { layout: layout, live: live, restore: restore };
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
