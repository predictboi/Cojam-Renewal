/* Night Desk: the shared shell and component builders. Static prototype, mock data only (assets/mock.js), copy from assets/i18n.js.
   Every screen calls N.page({ ... }); states come from ?state=, the language from ?lang=en|ko|ja. */
(function () {
  "use strict";
  var I = window.CJ_I18N, M = window.MOCK, lang = I.lang;
  var qs = new URLSearchParams(location.search), state = qs.get("state") || "";

  /* Labels this concept adds on top of the shared dictionary: [en, ko, ja]. */
  var EXTRA = {
    "n.rail.sr": ["Drag position", "드래그 위치", "ドラッグ位置"],
    "n.col.rank": ["Rank", "순위", "順位"],
    "n.col.player": ["Player", "플레이어", "プレイヤー"],
    "n.col.pts": ["Points", "포인트", "ポイント"],
    "n.col.q": ["Question", "질문", "質問"],
    "n.col.friend": ["Friend", "친구", "友だち"],
    "n.col.earned": ["Earned", "획득", "獲得"],
    "n.stack": ["{n} more behind this one", "뒤에 {n}개 더 있어요", "あと{n}問あります"],
    "n.hub.back": ["All screens", "전체 화면", "全画面"],
    "n.split.sr": ["Prize share by rank", "순위별 상금 비율", "順位ごとの賞金配分"],
    "n.send.to": ["Send to", "받는 주소", "送り先"],
    "n.ph.addr": ["0x address on Kaia", "Kaia의 0x 주소", "Kaiaの0xアドレス"]
  };
  Object.keys(EXTRA).forEach(function (k) { I.langs.forEach(function (l, i) { I.dict[l][k] = EXTRA[k][i]; }); });
  var t = I.t;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(n, d) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 4 : d }); }
  function href(file, st) { return file + "?lang=" + lang + (st ? "&state=" + st : ""); }
  function q(id) { var o = M.questions[id], l = o[lang] || o.en, r = {}; for (var k in o) r[k] = o[k]; for (var j in l) r[j] = l[j]; r.id = id; return r; }
  function short(a) { return a.slice(0, 6) + "…" + a.slice(-4); }
  function group(a) { return a.slice(0, 2) + " " + a.slice(2).replace(/(.{4})/g, "$1 ").trim(); }
  function date(d, opt) { return new Intl.DateTimeFormat(lang, opt || { month: "short", day: "numeric" }).format(d); }
  /* a figure: value in the numeral face, unit a step smaller */
  function tight(s) { return String(s).replace(/(\d)([.,])(?=\d)/g, '$1<i class="p">$2</i>').replace(/(^|\d) (CT|KAIA)\b/g, '$1<i class="u"> $2</i>'); }
  /* run once over a rendered page: every figure cell gets the same punctuation fit */
  function tighten(root) {
    root.querySelectorAll(".fig, .num, td.n, .row-v, .held, .me-r, .count").forEach(function (el) {
      Array.prototype.slice.call(el.childNodes).forEach(function (n) { if (n.nodeType === 3 && /\d[.,]\d|(^|\d) (CT|KAIA)/.test(n.textContent)) { var sp = document.createElement("span"); sp.innerHTML = tight(n.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;")); n.replaceWith.apply(n, Array.prototype.slice.call(sp.childNodes)); } });
    });
  }
  function fig(v, unit, cls) { return '<span class="fig' + (cls ? " " + cls : "") + '">' + v + (unit ? "<small>" + unit + "</small>" : "") + "</span>"; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { s = Math.max(0, s); return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }

  var P = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"';
  function svg(d, s) { return '<svg class="ic" viewBox="0 0 20 20" width="' + (s || 20) + '" height="' + (s || 20) + '" ' + P + ' aria-hidden="true">' + d + "</svg>"; }
  var ic = {
    home: svg('<path d="M4.5 7.5h11v9h-11zM6.5 4.5h7"/>'),
    results: svg('<path d="M9 5.5h7.5M9 10h7.5M9 14.5h7.5M3.5 5.5l1.2 1.2 2-2.2M3.5 10l1.2 1.2 2-2.2M3.5 14.5h3"/>'),
    rank: svg('<path d="M3.5 16.5v-6h4v6M7.5 16.5v-12h5v12M12.5 16.5v-8h4v8M2 16.5h16"/>'),
    stake: svg('<path d="M4.5 9h11v7.5h-11zM7 9V6.5a3 3 0 0 1 6 0V9M10 12v2"/>'),
    wallet: svg('<path d="M3.5 6.5h13v10h-13zM3.5 6.5l9-2.5v2.5M12.5 10.5h4v3h-4z"/>'),
    back: svg('<path d="M12 4.5 6.5 10l5.5 5.5"/>'),
    chev: svg('<path d="M7.5 4.5 13 10l-5.5 5.5"/>', 16),
    left: svg('<path d="M16 10H4.5M8.5 5.5 4 10l4.5 4.5"/>'),
    right: svg('<path d="M4 10h11.5M11.5 5.5 16 10l-4.5 4.5"/>'),
    copy: svg('<path d="M7.5 7.5h9v9h-9zM4 12.5V4h8.5"/>', 18),
    clock: svg('<path d="M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM10 6.5V10l2.5 1.5"/>', 16),
    source: svg('<path d="M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12.5 12.5l4 4"/>', 16),
    info: svg('<path d="M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM10 9v4.5M10 6.4v.2"/>', 16),
    check: svg('<path d="M4 10.5 8 14.5 16 5.5"/>', 16),
    x: svg('<path d="M5 5l10 10M15 5 5 15"/>', 18),
    cards: svg('<path d="M5 7h10v9.5H5zM7 4h6"/>', 18),
    list: svg('<path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"/>', 18),
    share: svg('<path d="M10 12.5v-9M6.5 6.5 10 3l3.5 3.5M4.5 10.5v6h11v-6"/>', 18),
    plus: svg('<path d="M10 4.5v11M4.5 10h11"/>', 18),
    minus: svg('<path d="M4.5 10h11"/>', 18),
    off: svg('<path d="M3 3l14 14M5.5 9.5a7 7 0 0 1 3-1.6M14.5 9.5a7 7 0 0 0-1.4-.9M7.8 12.4a3.6 3.6 0 0 1 4.4 0M10 15.4v.2"/>', 18),
    alert: svg('<path d="M10 3.5 17 16H3zM10 8.5v3.5M10 14v.2"/>', 18),
    undo: svg('<path d="M5 8h7a3.5 3.5 0 0 1 0 7H8M7.5 5.5 5 8l2.5 2.5"/>', 18),
    out: svg('<path d="M8 4.5H4.5v11H8M9 10h7.5M13.5 7l3 3-3 3"/>', 18),
    ext: svg('<path d="M8 5H4.5v10.5H15V12M11 4.5h4.5V9M15 5l-6 6"/>', 16)
  };

  /* ---------- small builders ---------- */
  /* a row of readout cells divided by hairlines: [{k: label, v: html, s: sub line}] */
  function cells(list, cls) {
    return '<dl class="cells' + (cls ? " " + cls : "") + '">' + list.map(function (c) {
      return '<div class="cell"><dt>' + c.k + "</dt><dd>" + c.v + "</dd>" + (c.s ? '<dd class="cell-s">' + c.s + "</dd>" : "") + "</div>";
    }).join("") + "</dl>";
  }
  /* list row: label (and sub) left, value right; a link when href is given */
  function row(o) {
    var inner = '<span class="row-l"><span class="row-k">' + o.k + "</span>" + (o.s ? '<span class="row-s">' + o.s + "</span>" : "") + "</span>" +
      (o.v !== undefined ? '<span class="row-v">' + o.v + "</span>" : "") + (o.href ? ic.chev : "");
    return o.href ? '<a class="row row-link" href="' + o.href + '">' + inner + "</a>" : '<div class="row">' + inner + "</div>";
  }
  /* segmented control: items [{id, label, href}] */
  function seg(items, cur, label, cls) {
    return '<div class="seg' + (cls ? " " + cls : "") + '" role="group" aria-label="' + esc(label) + '">' + items.map(function (it) {
      var on = it.id === cur;
      return it.href ? '<a class="seg-b" href="' + it.href + '"' + (on ? ' aria-current="true"' : "") + ">" + it.label + "</a>"
        : '<button type="button" class="seg-b" data-id="' + it.id + '" aria-pressed="' + on + '">' + it.label + "</button>";
    }).join("") + "</div>";
  }
  /* the pick marker: a small square in the answer's colour. side "l" or "r" */
  function mark(side) { return '<i class="mk mk-' + side + '" aria-hidden="true"></i>'; }
  /* the account on hold notice: one component, the reason differs per screen */
  function hold(reasonKey) {
    return '<aside class="hold" role="note"><div class="hold-b"><strong>' + t("hold.t") + "</strong><p>" + t(reasonKey) + '</p><a class="lnk" href="' + href("hold.html") + '">' + t("hold.more") + "</a></div></aside>";
  }
  function errorBox(msgKey) {
    return '<section class="state"><span class="state-ic is-danger">' + ic.alert + '</span><h2>' + t("common.error.h") + "</h2><p>" + t(msgKey || "e.load") + '</p><a class="btn btn-2" href="' + href(location.pathname.split("/").pop()) + '">' + t("common.retry") + "</a></section>";
  }
  function emptyBox(h, b, btn, to) {
    return '<section class="state"><span class="state-ic">' + ic.clock + "</span><h2>" + h + "</h2><p>" + b + "</p>" + (btn ? '<a class="btn btn-2" href="' + to + '">' + btn + "</a>" : "") + "</section>";
  }
  /* skeleton in the shape of what is coming: kinds "fig", "row", "cells", "card" */
  function skel(kinds) {
    return '<div class="skel" aria-busy="true"><span class="sr">' + t("common.loading") + "</span>" + kinds.map(function (k) { return '<i class="sk sk-' + k + '"></i>'; }).join("") + "</div>";
  }
  function details(qText, body) { return '<details class="disc"><summary>' + qText + ic.chev + '</summary><div class="disc-b">' + body + "</div></details>"; }

  /* ---------- shell ---------- */
  var TABS = [["home", "home.html", "tab.home"], ["results", "results.html", "tab.results"], ["rank", "ranking.html", "tab.rank"], ["stake", "staking.html", "tab.stake"], ["wallet", "wallet.html", "tab.wallet"]];
  function header(o) {
    if (o.back) {
      return '<header class="hd hd-sub"><a class="hd-back" href="' + o.back + '" aria-label="' + t("hd.back") + '">' + ic.back + '</a><h1 class="hd-title">' + o.title + "</h1></header>";
    }
    var u = M.user, loading = state === "loading";
    return '<header class="hd"><a class="brand" href="' + href("home.html") + '" aria-label="' + t("hd.home") + '"><span class="tile"><img src="assets/cojam-mark.svg" alt="" width="20" height="20"></span><b translate="no">Cojam</b></a>' +
      '<a class="hd-pts" href="' + href("wallet.html") + '" aria-label="' + esc(t("hd.points", { p: num(u.points) })) + '">' +
        (loading ? '<i class="sk sk-pts"></i>' : fig(num(u.points), "P") + (u.pendingHit && !o.plain ? '<span class="held" title="' + esc(t("w.onway")) + '">+' + u.pendingHit + "</span>" : "")) + "</a>" +
      '<a class="hd-me" href="' + href("profile.html") + '" aria-label="' + t("hd.profile") + '">' + u.name.charAt(0).toUpperCase() + "</a></header>";
  }
  function tabs(cur, o) {
    return '<nav class="tabs" aria-label="' + t("nav.tabs") + '">' + TABS.map(function (tb) {
      var on = tb[0] === cur, badge = "";
      if (tb[0] === "results" && !o.noBadge) badge = '<span class="tab-n" aria-label="' + esc(t("tab.badge.results", { n: 2 })) + '">2</span>';
      return '<a class="tab" href="' + href(tb[1]) + '"' + (on ? ' aria-current="page"' : "") + '><span class="tab-i">' + ic[tb[0]] + badge + "</span><span>" + t(tb[2]) + "</span></a>";
    }).join("") + "</nav>";
  }
  function page(o) {
    document.title = (o.title || "Cojam") + " · Cojam";
    var body = typeof o.body === "function" ? o.body(state) : o.body;
    var offline = state === "offline" ? '<div class="offbar" role="status">' + ic.off + "<span>" + t("off.bar") + "</span></div>" : "";
    var head = o.head === false ? "" : '<div class="ph"><h1>' + o.title + "</h1>" + (o.headRight || "") + "</div>";
    var pin = typeof o.pin === "function" ? o.pin(state) : (o.pin || "");
    document.body.insertAdjacentHTML("afterbegin",
      '<a class="skip" href="#main">' + t("nav.skip") + '</a><div class="app' + (o.fit ? " is-fit" : "") + (o.bare ? " is-bare" : "") + '">' +
      (o.bare ? "" : header(o)) + offline +
      '<main id="main" tabindex="-1">' + (o.back || o.bare ? "" : head) + body + "</main>" +
      (pin ? '<div class="pin">' + pin + "</div>" : "") +
      (o.tab ? tabs(o.tab, o) : "") + '</div><div class="toasts" aria-live="polite"></div>');
    startClocks(); tighten(document.body);
    if (o.after) o.after(document.querySelector(".app"), state);
  }

  /* ---------- live things ---------- */
  var clocks = [];
  function startClocks() {
    clocks = Array.prototype.map.call(document.querySelectorAll("[data-cd]"), function (el) { return { el: el, end: Date.now() + (+el.getAttribute("data-cd")) * 1000, fmt: el.getAttribute("data-fmt") || "hms" }; });
    document.querySelectorAll("[data-ago]").forEach(function (el) { clocks.push({ el: el, t0: Date.now() - 7000, fmt: "ago" }); });
    tick();
  }
  function tick() {
    clocks.forEach(function (c) {
      if (c.fmt === "ago") { c.el.textContent = t("common.updated", { n: Math.round((Date.now() - c.t0) / 1000) % 30 }); return; }
      var s = Math.max(0, Math.round((c.end - Date.now()) / 1000));
      if (c.fmt === "hms") c.el.textContent = hms(s);
      else if (c.fmt === "dh") c.el.textContent = t("k.dh", { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24 });
      else if (c.fmt === "parts") { c.el.querySelector("[data-h]").textContent = pad(Math.floor(s / 3600)); c.el.querySelector("[data-m]").textContent = pad(Math.floor(s / 60) % 60); c.el.querySelector("[data-s]").textContent = pad(s % 60); }
    });
  }
  setInterval(tick, 1000);

  function toast(msg, action, fn) {
    var box = document.querySelector(".toasts"), el = document.createElement("div");
    el.className = "toast"; el.innerHTML = "<span>" + msg + "</span>" + (action ? '<button type="button" class="toast-a">' + action + "</button>" : "");
    box.innerHTML = ""; box.appendChild(el);
    if (action) el.querySelector("button").addEventListener("click", function () { el.remove(); fn && fn(); });
    setTimeout(function () { el.remove(); }, 3600);
  }
  function copy(text, msg) {
    try { navigator.clipboard.writeText(text); } catch (e) {}
    toast(msg || t("common.copied"));
  }

  /* bottom sheet: N.sheet(title, html) returns { close }. Esc and the veil close it; focus goes in and comes back. */
  function sheet(title, html, o) {
    o = o || {};
    var from = document.activeElement, wrap = document.createElement("div");
    wrap.className = "sheet-wrap";
    wrap.innerHTML = '<div class="veil"></div><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h"><header class="sheet-hd"><h2 id="sheet-h">' + title + '</h2><button type="button" class="icon-b" data-close aria-label="' + t("common.close") + '">' + ic.x + '</button></header><div class="sheet-b">' + html + "</div></section>";
    document.body.appendChild(wrap);
    function close() { wrap.remove(); document.removeEventListener("keydown", key); if (from && from.focus) from.focus(); }
    function key(e) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") { var f = wrap.querySelectorAll("a[href],button:not([disabled]),input,summary"); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    }
    wrap.addEventListener("click", function (e) { if (e.target.closest("[data-close]") || e.target.classList.contains("veil")) close(); });
    document.addEventListener("keydown", key);
    tighten(wrap); wrap.querySelector("[data-close]").focus();
    return { el: wrap, close: close };
  }

  /* ---------- the day's game: picks, the 3 second Undo, the finish ---------- */
  var UNDO_MS = 3000;
  function game(o) {
    var g = { order: M.set.slice(), picks: {}, held: null };
    (o.start || []).forEach(function (p) { g.picks[p[0]] = p[1]; });
    g.count = function () { return Object.keys(g.picks).length; };
    g.current = function () { return g.order[g.count()] || null; };
    g.save = function () { try { sessionStorage.setItem("night.picks", JSON.stringify(g.picks)); } catch (e) {} };
    g.pick = function (side) {
      var id = g.current(); if (!id) return;
      if (g.held) g.flush(true);                       /* an earlier pick still in its window is sent at once */
      g.picks[id] = side; g.held = { id: id, side: side, t0: Date.now() };
      g.held.timer = setTimeout(function () { g.flush(); }, UNDO_MS);
      o.change("pick", id, side);
    };
    g.flush = function (quiet) {
      if (!g.held) return; clearTimeout(g.held.timer); var h = g.held; g.held = null; g.save();
      if (!quiet) o.change("saved", h.id, h.side);
      if (g.count() === 5 && !quiet) o.finish();
    };
    g.undo = function () {
      if (!g.held) return; clearTimeout(g.held.timer); var h = g.held; g.held = null; delete g.picks[h.id];
      o.change("undo", h.id, h.side);
    };
    return g;
  }
  /* five slots: a made pick takes its answer's colour, a held pick is hatched, an open one is an outline */
  function dayTicks(picks, heldId, order) {
    return '<span class="dticks" role="img" aria-label="' + esc(t("h.prog.sr", { n: Object.keys(picks).length })) + '">' + (order || M.set).map(function (id) {
      var s = picks[id]; return '<i class="' + (s ? "is-" + s + (heldId === id ? " is-held" : "") : "") + '"></i>';
    }).join("") + "</span>";
  }
  function savedPicks() {
    var p = null; try { p = JSON.parse(sessionStorage.getItem("night.picks") || "null"); } catch (e) {}
    if (!p || Object.keys(p).length < 5) { p = {}; M.results[0].rows.forEach(function (r) { p[r.q] = r.c; }); }
    return p;
  }

  window.N = { t: t, lang: lang, state: state, M: M, esc: esc, num: num, href: href, q: q, short: short, group: group, date: date, fig: fig, tight: tight, tighten: tighten, hms: hms, pad: pad, ic: ic,
    cells: cells, row: row, seg: seg, mark: mark, hold: hold, errorBox: errorBox, emptyBox: emptyBox, skel: skel, details: details,
    page: page, toast: toast, copy: copy, sheet: sheet, game: game, dayTicks: dayTicks, savedPicks: savedPicks, UNDO_MS: UNDO_MS, startClocks: startClocks,
    reduced: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches };
})();
