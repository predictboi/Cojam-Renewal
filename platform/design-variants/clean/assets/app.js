/* Cojam Daily Prediction, concept D "Clean": the shared shell and the small component helpers.
   Mock only: nothing here talks to a chain or a server. Screens register in screens.js and call App.mount({...}). */
(function () {
  "use strict";
  var I = window.CJ_I18N, t = I.t, M = window.MOCK;
  var qs = new URLSearchParams(location.search);
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var App = window.App = window.App || {};
  App.state = qs.get("state") || ""; App.lang = I.lang; App.t = t; App.reduce = reduce;
  App.offline = App.state === "offline";
  App.hold = /^hold/.test(App.state);
  var C = window.C = {};

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  App.esc = esc; App.$ = $; App.$$ = $$;

  /* every link between screens keeps the language, so a review in Korean stays in Korean */
  App.url = function (file, state) { return file + "?lang=" + App.lang + (state ? "&state=" + state : ""); };

  /* ---------- formatting ---------- */
  var F = App.fmt = {
    int: function (n) { return Math.round(n).toLocaleString("en-US"); },
    pts: function (n) { return F.int(n) + "P"; },
    dec: function (n, d) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: d === undefined ? 4 : d }); },
    fix: function (n, d) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); },
    ct: function (n, d) { return F.dec(n, d) + " CT"; },
    krw: function (ct) { return t("common.krw", { krw: F.int(ct * M.krwPerCt) }); },
    date: function (d) { return new Intl.DateTimeFormat(App.lang, { month: "short", day: "numeric" }).format(d); },
    dateLong: function (d) { return new Intl.DateTimeFormat(App.lang, { year: "numeric", month: "short", day: "numeric" }).format(d); },
    weekday: function (d) { return new Intl.DateTimeFormat(App.lang, { weekday: "short", month: "short", day: "numeric" }).format(d); },
    hms: function (s) { var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return [h, m, x].map(function (v) { return (v < 10 ? "0" : "") + v; }).join(":"); },
    short: function (a) { return a.slice(0, 6) + "…" + a.slice(-4); },
    groups: function (a) { var g = a.replace(/^0x/, "").match(/.{1,4}/g); return "<span>0x" + g.slice(0, 5).join(" ") + "</span><span>" + g.slice(5).join(" ") + "</span>"; }
  };
  /* a figure with its unit set smaller: "1,840.5 CT" becomes the number and a quiet unit */
  C.num = function (value, unit, cls) { return '<span class="num ' + (cls || "") + '">' + value + (unit ? '<span class="u">' + unit + "</span>" : "") + "</span>"; };

  /* ---------- mock session: today's picks survive a page change inside one tab ---------- */
  App.sess = (function () {
    var K = "cjp.clean.sess", day = new Date().toISOString().slice(0, 10), d = null;
    try { d = JSON.parse(sessionStorage.getItem(K) || "null"); } catch (e) {}
    if (!d || d.day !== day || !d.picks) d = { day: day, picks: {}, paid: false };
    var api = { data: d,
      save: function () { try { sessionStorage.setItem(K, JSON.stringify(api.data)); } catch (e) {} },
      reset: function () { api.data.picks = {}; api.data.paid = false; api.save(); },
      count: function () { return M.set.filter(function (id) { return api.data.picks[id]; }).length; } };
    return api;
  })();
  App.points = function () { return M.user.points + (App.sess.data.paid ? 100 : 0); };
  App.q = function (id) {
    var q = M.questions[id], L = q[App.lang] || q.en;
    return { id: id, n: q.n, cat: q.cat, title: L.title, l: L.left, r: L.right, rule: L.rule, settle: L.settle };
  };

  /* ---------- icons: one monoline set, 24 px grid, 1.8 px stroke ---------- */
  var ICON = {
    home: '<rect x="5" y="8" width="14" height="12" rx="3.5"/><path d="M8.5 4.5h7"/>',
    results: '<path d="M4 7l2 2 3-3.5M4 15l2 2 3-3.5M13 7.5h7M13 15.5h7"/>',
    rank: '<path d="M4.5 20v-6.5h5V20M9.5 20V5h5v15M14.5 20V10h5v10M3 20h18"/>',
    stake: '<rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a2 2 0 0 1 2 2v1M4 7.5V17a3 3 0 0 0 3 3h11a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 1 4 7.5zM16 14h.01"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>', down1: '<path d="M6 9l6 6 6-6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>', right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    deposit: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', withdraw: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    gift: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M3 7.5h18V11H3zM12 7.5V20M12 7.5c-1.5-3.6-6-3-5 0M12 7.5c1.5-3.6 6-3 5 0"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
    alert: '<path d="M12 4l9 16H3zM12 10v4M12 17h.01"/>',
    off: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 3-2M19 13a10 10 0 0 0-5.5-2.8M12 20h.01"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
    cards: '<rect x="6" y="4" width="12" height="16" rx="3"/><path d="M3 8v8M21 8v8"/>',
    rows: '<path d="M5 7h14M5 12h14M5 17h14"/>',
    swap: '<path d="M7 8h12l-3-3M17 16H5l3 3"/>',
    user: '<circle cx="12" cy="9" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    plus: '<path d="M12 6v12M6 12h12"/>', minus: '<path d="M6 12h12"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M4.5 8l7.5 5 7.5-5"/>',
    spark: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 16.5h.01"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    out: '<path d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3M14 8l4 4-4 4M18 12H9"/>'
  };
  C.icon = function (name, size) { size = size || 24; return '<svg class="ic" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + "</svg>"; };
  C.spin = function () { return '<span class="spin" aria-hidden="true"></span>'; };
  C.checkMark = function (cls) { return '<span class="check ' + (cls || "") + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 12.5l4 4L18 8"/></svg></span>'; };

  /* ---------- small builders ---------- */
  /* a list row: optional icon tile, title, sub line, a value on the right and a chevron when it goes somewhere */
  C.row = function (o) {
    var tag = o.href ? "a" : (o.btn ? "button" : "div");
    return "<" + tag + ' class="row' + (o.cls ? " " + o.cls : "") + '"' + (o.href ? ' href="' + o.href + '"' : "") + (o.btn ? ' type="button"' : "") + (o.attr ? " " + o.attr : "") + ">" +
      (o.icon ? '<span class="row-ic">' + C.icon(o.icon, 22) + "</span>" : "") + (o.lead || "") +
      '<span class="row-t"><b>' + o.title + "</b>" + (o.sub ? "<small>" + o.sub + "</small>" : "") + "</span>" +
      (o.value !== undefined ? '<span class="row-v">' + o.value + "</span>" : "") +
      (o.href || o.chev ? '<span class="row-chev">' + C.icon("chev", 20) + "</span>" : "") + "</" + tag + ">";
  };
  C.kv = function (k, v, cls) { return '<div class="kv' + (cls ? " " + cls : "") + '"><span>' + k + "</span><b>" + v + "</b></div>"; };
  /* segmented control with a sliding thumb. items: [{v, label, href, icon, aria}] */
  C.seg = function (id, items, cur, label, cls) {
    var idx = Math.max(0, items.map(function (i) { return i.v; }).indexOf(cur));
    return '<div class="seg' + (cls ? " " + cls : "") + '" id="' + id + '" role="group" aria-label="' + esc(label) + '" style="--n:' + items.length + '"><span class="seg-thumb" style="transform:translateX(' + idx * 100 + '%)"></span>' +
      items.map(function (it) {
        var on = it.v === cur, inner = (it.icon ? C.icon(it.icon, 20) : "") + (it.label ? "<span>" + it.label + "</span>" : "");
        return it.href ? '<a class="seg-btn" href="' + it.href + '"' + (on ? ' aria-current="page"' : "") + (it.aria ? ' aria-label="' + esc(it.aria) + '"' : "") + ">" + inner + "</a>"
          : '<button type="button" class="seg-btn" data-v="' + it.v + '" aria-pressed="' + on + '"' + (it.aria ? ' aria-label="' + esc(it.aria) + '"' : "") + ">" + inner + "</button>";
      }).join("") + "</div>";
  };
  C.segBind = function (id, fn) {
    var el = $("#" + id); if (!el) return;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button.seg-btn"); if (!b) return;
      var all = $$("button.seg-btn", el), i = all.indexOf(b);
      all.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      $(".seg-thumb", el).style.transform = "translateX(" + i * 100 + "%)";
      fn(b.getAttribute("data-v"));
    });
  };
  /* the pick of a question, in its answer colour: left is persimmon, right is teal, everywhere */
  C.pick = function (side, label) { return '<span class="pick pick--' + side + '">' + C.icon(side === "l" ? "left" : "right", 14) + esc(label) + "</span>"; };
  C.state = function (o) {
    return '<div class="state"><span class="state-ic' + (o.tone ? " state-ic--" + o.tone : "") + '">' + C.icon(o.icon || "info", 26) + "</span><h2>" + o.h + "</h2>" + (o.b ? "<p>" + o.b + "</p>" : "") + (o.extra || "") +
      (o.btn ? (o.href ? '<a class="btn btn--auto" href="' + o.href + '">' + o.btn + "</a>" : '<button type="button" class="btn btn--auto" data-retry>' + o.btn + "</button>") : "") + "</div>";
  };
  C.error = function () { return C.state({ icon: "alert", tone: "danger", h: t("common.error.h"), b: t("e.load"), btn: t("common.retry") }); };
  C.skel = function (shape) { return '<div class="skel" role="status" aria-label="' + esc(t("common.loading")) + '">' + shape.map(function (s) { return '<i class="sk" style="--w:' + s[0] + ";--h:" + s[1] + 'px"></i>'; }).join("") + "</div>"; };
  /* account on hold: one notice with the reason for this screen and the way to the full explanation */
  C.holdNote = function (key) {
    return '<div class="note note--hold" role="note"><span class="note-ic">' + C.icon("pause", 22) + "</span><div><b>" + t("hold.t") + "</b><p>" + t(key) + '</p><a class="link" href="' + App.url("hold.html") + '">' + t("hold.more") + "</a></div></div>";
  };
  C.note = function (html, icon, tone) { return '<div class="note' + (tone ? " note--" + tone : "") + '" role="note"><span class="note-ic">' + C.icon(icon || "info", 22) + "</span><div><p>" + html + "</p></div></div>"; };
  C.live = function () { return '<span class="livestamp" data-live>' + t("common.updated", { n: 7 }) + "</span>"; };

  /* ---------- shell ---------- */
  var TABS = [["home", "home.html", "tab.home"], ["results", "results.html", "tab.results"], ["rank", "ranking.html", "tab.rank"], ["stake", "staking.html", "tab.stake"], ["wallet", "wallet.html", "tab.wallet"]];
  function header(cfg) {
    if (cfg.back) {
      return '<header class="hd hd--sub"><a class="hd-back" href="' + cfg.back + '" aria-label="' + esc(t("hd.back")) + '">' + C.icon("back") + '</a><span class="hd-title">' + (cfg.title || "") + '</span><span class="hd-end">' + (cfg.end || "") + "</span></header>";
    }
    var brand = '<a class="hd-brand" href="' + App.url("home.html") + '" aria-label="' + esc(t("hd.home")) + '"><img src="assets/cojam-mark.svg" alt="" width="28" height="28"><span translate="no">Cojam</span></a>';
    if (cfg.bare) return '<header class="hd">' + brand + '<span class="hd-end">' + (cfg.end || "") + "</span></header>";
    var p = App.points(), loading = cfg.pointsLoading;
    return '<header class="hd">' + brand + '<span class="hd-end">' +
      '<a class="hd-pts" id="hd-pts" href="' + App.url("wallet.html") + '" aria-label="' + esc(t("hd.points", { p: F.int(p) })) + '"><span>' + (loading ? C.spin() : "") + '<b data-pts>' + F.int(p) + "</b>P</span></a>" +
      '<a class="hd-me" href="' + App.url("profile.html") + '" aria-label="' + esc(t("hd.profile")) + '"><span>' + esc(M.user.name.charAt(0).toUpperCase()) + "</span></a></span></header>";
  }
  function tabbar(cur) {
    return '<nav class="tabbar" aria-label="' + esc(t("nav.tabs")) + '">' + TABS.map(function (x) {
      var on = x[0] === cur, badge = x[0] === "results" && cur !== "results" ? '<i class="tab-n" aria-label="' + esc(t("tab.badge.results", { n: 2 })) + '">2</i>' : "";
      return '<a class="tab" href="' + App.url(x[1]) + '"' + (on ? ' aria-current="page"' : "") + '><span class="tab-ic">' + C.icon(x[0], 24) + badge + "</span><span>" + t(x[2]) + "</span></a>";
    }).join("") + "</nav>";
  }
  App.mount = function (cfg) {
    document.title = "Cojam: " + (cfg.docTitle || cfg.title || "Daily Prediction");
    var off = App.offline ? '<div class="offbar" role="status">' + C.icon("off", 18) + "<span>" + t(cfg.offText || "off.bar") + "</span></div>" : "";
    document.body.innerHTML =
      '<a class="skip" href="#main">' + t("nav.skip") + "</a>" +
      '<div class="app' + (cfg.fit ? " app--fit" : "") + (cfg.cls ? " " + cfg.cls : "") + '">' + off + header(cfg) +
      '<main class="main" id="main" tabindex="-1">' + cfg.body + "</main>" +
      '<div class="dock">' + (cfg.pinned || "") + (cfg.cta ? '<div class="cta">' + cfg.cta + "</div>" : "") + (cfg.tab ? tabbar(cfg.tab) : "") + "</div></div>" +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div><div id="live" class="sr" aria-live="polite"></div>';
    App.enhance(document.body);
    $$("[data-retry]").forEach(function (b) { b.addEventListener("click", function () { location.href = location.pathname.split("/").pop() + "?lang=" + App.lang; }); });
  };
  App.live = function (msg) { var l = $("#live"); if (l) { l.textContent = ""; setTimeout(function () { l.textContent = msg; }, 30); } };

  /* countdowns ([data-cd] holds seconds), the "Updated 7s ago" stamp and disclosure rows */
  var tick = null, t0 = Date.now();
  App.enhance = function (root) {
    $$("[data-cd]", root).forEach(function (el) { el._s = +el.getAttribute("data-cd"); el._t = Date.now(); el.textContent = F.hms(el._s); });
    $$("[data-disc]", root).forEach(function (b) {
      b.addEventListener("click", function () { var open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open); var p = document.getElementById(b.getAttribute("aria-controls")); if (p) p.hidden = !open; });
    });
    if (!tick) tick = setInterval(function () {
      $$("[data-cd]").forEach(function (el) { var s = Math.max(0, el._s - Math.floor((Date.now() - el._t) / 1000)); el.textContent = F.hms(s); });
      $$("[data-live]").forEach(function (el) { el.textContent = t("common.updated", { n: 7 + Math.floor((Date.now() - t0) / 1000) % 20 }); });
    }, 1000);
  };

  /* a figure counts up when it changes: 600 ms, ease out, tabular so nothing shifts */
  App.countTo = function (el, from, to, fmt, ms, done) {
    fmt = fmt || F.int;
    if (reduce || !el) { if (el) el.textContent = fmt(to); if (done) done(); return; }
    var start = null, dur = ms || 600;
    function step(ts) { if (!start) start = ts; var p = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); else if (done) done(); }
    requestAnimationFrame(step);
  };

  /* ---------- toast: one at a time, leaves the way it came ---------- */
  var toastTimer = null;
  App.toast = function (msg, o) {
    var el = $("#toast"); if (!el) return; o = o || {};
    el.innerHTML = "<span>" + msg + "</span>" + (o.action ? '<button type="button" class="toast-act">' + o.action + "</button>" : "");
    if (o.action) $(".toast-act", el).addEventListener("click", function () { el.classList.remove("is-on"); o.fn && o.fn(); });
    el.classList.add("is-on"); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-on"); }, o.ms || 3200);
  };
  App.copy = function (text, msg) { try { navigator.clipboard && navigator.clipboard.writeText(text).catch(function () {}); } catch (e) {} App.toast(msg || t("common.copied")); };

  /* ---------- bottom sheet: rises on the drawer curve, closes by Esc, the backdrop, the grabber or a [data-close] ---------- */
  App.sheet = (function () {
    var wrap = null, last = null, onClose = null;
    function close() {
      if (!wrap) return; var w = wrap; wrap = null; w.classList.remove("is-open");
      setTimeout(function () { w.remove(); }, reduce ? 0 : 320);
      document.removeEventListener("keydown", key); if (last && last.focus) last.focus(); if (onClose) { var f = onClose; onClose = null; f(); }
    }
    function key(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab" || !wrap) return;
      var f = $$("button, a[href], input, [tabindex]:not([tabindex='-1'])", wrap).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    function open(html, o) {
      if (wrap) { wrap.remove(); wrap = null; } o = o || {}; onClose = o.onClose || null; last = document.activeElement;
      wrap = document.createElement("div"); wrap.className = "sheet-wrap";
      wrap.innerHTML = '<div class="sheet-back" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h" tabindex="-1"><button type="button" class="sheet-grab" data-close aria-label="' + esc(t("common.close")) + '"><i></i></button><div class="sheet-body">' + html + "</div></div>";
      document.body.appendChild(wrap);
      wrap.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) close(); });
      document.addEventListener("keydown", key);
      void wrap.offsetWidth; wrap.classList.add("is-open");
      App.enhance(wrap); $(".sheet", wrap).focus({ preventScroll: true });
      return wrap;
    }
    function set(html) { if (wrap) { $(".sheet-body", wrap).innerHTML = html; App.enhance(wrap); } }
    return { open: open, close: close, set: set, el: function () { return wrap; } };
  })();

  /* the same mock transaction for stake, claim, convert and withdraw: signing, sending, done. The button that started it is the status. */
  App.tx = function (o) {
    var fast = reduce ? 200 : 900;
    App.sheet.set('<div class="tx"><span class="tx-ic">' + C.spin() + '</span><h2 id="sheet-h">' + t("tx.sign.h") + "</h2><p>" + t("tx.sign.b") + "</p></div>");
    setTimeout(function () {
      if (!App.sheet.el()) return;
      App.sheet.set('<div class="tx"><span class="tx-ic">' + C.spin() + '</span><h2 id="sheet-h">' + t("tx.send.h") + "</h2><p>" + t("tx.send.b") + "</p></div>");
      setTimeout(function () { if (App.sheet.el()) App.txDone(o); }, fast);
    }, fast);
  };
  App.txDone = function (o) {
    App.sheet.set('<div class="tx">' + C.checkMark("check--run") + '<h2 id="sheet-h">' + o.h + "</h2>" + (o.rows ? '<div class="blk tx-rows">' + o.rows + "</div>" : "") +
      (o.href ? '<a class="btn" href="' + o.href + '">' + o.btn + "</a>" : '<button type="button" class="btn" data-close>' + (o.btn || t("common.done")) + "</button>") +
      '<a class="link link--center" href="#" data-nolink>' + t("tx.scan") + "</a></div>");
    App.live(o.h);
  };

  /* press feedback that a quick tap still shows: the class stays for at least 100 ms */
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".btn, .ans, .seg-btn, .opt, .row[href], button.row, .chipbtn, .tab"); if (!b) return;
    b.classList.add("is-pressed"); var at = Date.now();
    function up() { setTimeout(function () { b.classList.remove("is-pressed"); }, Math.max(0, 100 - (Date.now() - at))); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  document.addEventListener("click", function (e) { if (e.target.closest("[data-nolink]")) e.preventDefault(); });

  /* a typed amount: digits with an optional decimal part, commas allowed */
  App.parseAmount = function (s) { s = String(s).replace(/,/g, "").trim(); if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return NaN; return parseFloat(s); };

  /* boot: the page names its screen on <body data-screen> */
  App.screens = {};
  document.addEventListener("DOMContentLoaded", function () {
    var name = document.body.getAttribute("data-screen"), fn = App.screens[name];
    if (fn) fn();
  });
})();
