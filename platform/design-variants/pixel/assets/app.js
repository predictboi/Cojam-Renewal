/* Pixel concept: shell and shared components. Static design with mock data: no network calls.
   PX.shell() draws the HUD header, the band, the main column and the tab bar; the screens (screens-*.js) fill them. */
(function () {
  "use strict";
  var I18N = window.CJ_I18N, M = window.MOCK, A = window.PXA;
  var qs = new URLSearchParams(location.search);
  var lang = I18N.lang;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function t(k, v) { return I18N.t(k, v); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(n, d) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 4 : d }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function q(id) { var o = M.questions[id]; var l = o[lang] || o.en; return { id: id, n: o.n, cat: o.cat, title: l.title, left: l.left, right: l.right, rule: l.rule, settle: l.settle }; }
  function date(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    if (lang === "ko") return m + "월 " + day + "일";
    if (lang === "ja") return m + "月" + day + "日";
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] + " " + day;
  }
  function shortAddr(a) { return a.slice(0, 6) + "…" + a.slice(-4); }
  function groupAddr(a) { return a.slice(0, 2) + " " + a.slice(2).match(/.{1,4}/g).join(" "); }
  function href(file, params) {
    var p = new URLSearchParams(params || {});
    if (qs.get("lang")) p.set("lang", lang);
    var s = p.toString();
    return file + (s ? "?" + s : "");
  }

  /* ---------- small pieces ---------- */
  function icon(n, px, cls) { return A.icon(n, px || 2, cls); }
  function btn(label, o) {
    o = o || {};
    var cls = "btn btn-" + (o.kind || "primary") + (o.block === false ? "" : " btn-block") + (o.cls ? " " + o.cls : "");
    var inner = (o.icon ? icon(o.icon) : "") + '<span class="btn-l">' + label + "</span>" + (o.iconEnd ? icon(o.iconEnd) : "");
    var attrs = (o.id ? ' id="' + o.id + '"' : "") + (o.attrs ? " " + o.attrs : "");
    if (o.href) return '<a class="' + cls + '" href="' + o.href + '"' + attrs + ">" + inner + "</a>";
    return '<button type="button" class="' + cls + '"' + attrs + (o.disabled ? ' aria-disabled="true"' : "") + ">" + inner + "</button>";
  }
  function chip(text, kind) { return '<span class="chip' + (kind ? " chip-" + kind : "") + '">' + text + "</span>"; }
  /* day progress as five energy cells: "", "done", "pend", "fail" */
  function cells(states, label) {
    return '<span class="cells" role="img" aria-label="' + esc(label || "") + '">' + states.map(function (s) { return '<i class="cell' + (s ? " is-" + s : "") + '"></i>'; }).join("") + "</span>";
  }
  function seg(items, active, o) {
    o = o || {};
    return '<div class="seg' + (o.cls ? " " + o.cls : "") + '" role="tablist" aria-label="' + esc(o.label || "") + '">' + items.map(function (it, i) {
      var on = i === active, inner = (it.icon ? icon(it.icon) : "") + '<span>' + it.label + "</span>" + (it.count !== undefined ? '<b class="seg-n">' + it.count + "</b>" : "");
      return it.href ? '<a role="tab" aria-selected="' + on + '" class="seg-btn' + (on ? " is-on" : "") + '" href="' + it.href + '">' + inner + "</a>"
        : '<button type="button" role="tab" aria-selected="' + on + '" class="seg-btn' + (on ? " is-on" : "") + '" data-v="' + (it.v || i) + '">' + inner + "</button>";
    }).join("") + "</div>";
  }
  function note(kind, text, extra) {
    var ic = kind === "error" || kind === "warn" ? "warn" : kind === "ok" ? "check" : "info";
    return '<div class="note note-' + kind + '" role="' + (kind === "error" ? "alert" : "note") + '">' + icon(ic) + "<p>" + text + "</p>" + (extra || "") + "</div>";
  }
  function hold(reason) {
    return '<div class="hold" role="note"><div class="hold-hd">' + icon("stake") + '<b class="t12 b">' + t("hold.tag") + '</b></div><p>' + reason + '</p><a class="lnk" href="' + href("index.html") + '#hold">' + t("hold.more") + "</a></div>";
  }
  function empty(o) {
    return '<div class="empty">' + (o.sprite ? '<div class="empty-art">' + o.sprite + "</div>" : "") + '<h2 class="t24 b">' + o.h + "</h2>" + (o.b ? "<p>" + o.b + "</p>" : "") + (o.btn || "") + "</div>";
  }
  function skeleton(rows) {
    var s = '<div class="skel" role="status" aria-label="' + esc(t("common.loading")) + '">';
    for (var i = 0; i < rows; i++) s += '<i class="skel-row" style="--w:' + [92, 64, 80, 48, 72][i % 5] + '%"></i>';
    return s + "</div>";
  }
  function fig(label, value, unit, sub) {
    return '<div class="fig"><span class="fig-l">' + label + '</span><span class="fig-v"><b>' + value + "</b>" + (unit ? "<i>" + unit + "</i>" : "") + "</span>" + (sub ? '<span class="fig-s">' + sub + "</span>" : "") + "</div>";
  }
  function row(l, v, o) { o = o || {}; return '<div class="kv' + (o.cls ? " " + o.cls : "") + '"><span class="kv-l">' + l + '</span><span class="kv-v">' + v + "</span></div>"; }
  function jam(mood, px) {
    var set = { idle: ["jam", "jam", "jam", "jamBlink"], cheer: ["jamCheer", "jamCheer2"], sleep: ["jamSleep"], dizzy: ["jamDizzy"] }[mood || "idle"];
    return A.frames(set, px || 4, "jam jam-" + (mood || "idle"));
  }
  function coinSpin(px) { return A.frames(["coin", "coinHalf", "coinSide", "coinHalf"], px || 4, "coin-spin"); }

  /* ---------- countdowns: [data-cd] holds seconds; text in HH:MM:SS, spoken text once a minute ---------- */
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60); }
  function cd(secs, cls) { return '<span class="cd ' + (cls || "") + '" data-cd="' + secs + '" aria-hidden="true">' + hms(secs) + "</span>"; }
  function tick() {
    $$("[data-cd]").forEach(function (el) {
      var s = Math.max(0, +el.getAttribute("data-cd") - 1); el.setAttribute("data-cd", s);
      if (el.hasAttribute("data-tiles")) tiles(el, s); else el.textContent = hms(s);
    });
    $$("[data-up]").forEach(function (el) { var n = +el.getAttribute("data-up") + 1; if (n > 59) n = 1; el.setAttribute("data-up", n); el.textContent = t("common.updated", { n: n }); });
  }
  function tiles(el, s) {
    var parts = [two(Math.floor(s / 3600)), two(Math.floor(s / 60) % 60), two(s % 60)], units = [t("d.u.h"), t("d.u.m"), t("d.u.s")];
    el.innerHTML = parts.map(function (p, i) { return '<span class="tile"><b>' + p + "</b><i>" + units[i] + "</i></span>"; }).join('<span class="tile-sep">:</span>');
  }
  function cdTiles(secs) { return '<div class="cd-tiles" data-cd="' + secs + '" data-tiles aria-hidden="true"></div>'; }

  /* ---------- toast ---------- */
  function toast(msg, action, fn) {
    var host = $(".toasts"); if (!host) return;
    var el = document.createElement("div"); el.className = "toast";
    el.innerHTML = "<span>" + msg + "</span>" + (action ? '<button type="button" class="toast-a">' + action + "</button>" : "");
    host.innerHTML = ""; host.appendChild(el);
    if (action) $(".toast-a", el).addEventListener("click", function () { el.remove(); fn && fn(); });
    setTimeout(function () { el.remove(); }, 4000);
  }
  function copy(text, msg) { try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {} toast(msg || t("common.copied")); }

  /* ---------- bottom sheet ---------- */
  function sheet(o) {
    closeSheet();
    var wrap = document.createElement("div"); wrap.className = "sheet-wrap";
    wrap.innerHTML = '<div class="sheet-back" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h" tabindex="-1">' +
      '<div class="sheet-hd"><h2 id="sheet-h" class="t24 b">' + o.title + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t("common.close")) + '">' + icon("cross") + "</button></div>" +
      '<div class="sheet-bd">' + o.body + "</div>" + (o.foot ? '<div class="sheet-ft">' + o.foot + "</div>" : "") + "</div>";
    document.body.appendChild(wrap);
    var last = document.activeElement;
    wrap.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeSheet(); });
    wrap._key = function (e) {
      if (e.key === "Escape") closeSheet();
      if (e.key === "Tab") { var f = $$("a,button,input,[tabindex]", wrap).filter(function (x) { return x.offsetParent !== null; }); if (!f.length) return; var a = f[0], b = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); } }
    };
    document.addEventListener("keydown", wrap._key);
    wrap._last = last;
    $(".sheet", wrap).focus();
    o.ready && o.ready(wrap);
    return wrap;
  }
  function closeSheet() { var w = $(".sheet-wrap"); if (!w) return; document.removeEventListener("keydown", w._key); w.remove(); w._last && w._last.focus && w._last.focus(); }

  /* ---------- shell ---------- */
  var TABS = [["home", "home.html", "home"], ["results", "results.html", "results"], ["rank", "ranking.html", "rank"], ["stake", "staking.html", "stake"], ["wallet", "wallet.html", "wallet"]];
  function shell(o) {
    var u = M.user, pts = o.points === undefined ? u.points : o.points;
    var left = o.back
      ? '<a class="hud-back" href="' + href(o.back) + '" aria-label="' + esc(t("hd.back")) + '">' + icon("back") + '</a><h1 class="hud-title t24 b">' + o.title + "</h1>"
      : '<a class="hud-brand" href="' + href("home.html") + '" aria-label="' + esc(t("hd.home")) + '"><img src="assets/cojam-mark.svg" width="32" height="32" alt=""><span class="t24 b" translate="no">Cojam</span></a>';
    var right = o.bare ? "" :
      '<a class="score" id="score" href="' + href("wallet.html") + '" aria-label="' + esc(t("hd.points", { p: num(pts) })) + '">' + A.svg("coin", 2) + '<b class="t24 b" id="score-n">' + num(pts) + '</b><i class="t12 b">P</i></a>' +
      (o.back ? "" : '<a class="icon-btn hud-user" href="' + href("profile.html") + '" aria-label="' + esc(t("hd.profile")) + '">' + icon("user") + "</a>");
    var tabs = o.tab ? '<nav class="tabbar" aria-label="' + esc(t("nav.tabs")) + '">' + TABS.map(function (tb) {
      var on = tb[0] === o.tab, badge = "";
      if (tb[0] === "results" && !o.noBadge) badge = '<i class="tab-badge"></i><span class="sr">' + t("tab.badge.results", { n: 2 }) + "</span>";
      return '<a class="tab' + (on ? " is-on" : "") + '" href="' + href(tb[1]) + '"' + (on ? ' aria-current="page"' : "") + '><span class="tab-ic">' + icon(tb[2]) + badge + '</span><span class="tab-l">' + t("tab." + tb[0]) + "</span></a>";
    }).join("") + "</nav>" : "";
    document.body.innerHTML =
      '<a class="skip" href="#main">' + t("nav.skip") + "</a>" +
      '<div class="app' + (o.cls ? " " + o.cls : "") + '">' +
      '<header class="hud">' + left + '<span class="hud-gap"></span>' + right + "</header>" +
      (o.offline ? '<div class="offbar" role="status">' + icon("wifi") + "<span>" + t("off.bar") + "</span></div>" : "") +
      (o.band ? '<section class="band">' + o.band + '</section><div class="dither-edge" aria-hidden="true"></div>' : "") +
      '<main id="main" class="main">' + (o.body || "") + "</main>" +
      (o.foot ? '<div class="foot">' + o.foot + "</div>" : "") +
      tabs + "</div>" +
      '<div class="toasts" aria-live="polite"></div><div class="sr" id="live" aria-live="polite"></div>';
    document.title = (o.title || t("h.title")) + " · Cojam";
  }
  function say(msg) { var l = $("#live"); if (l) l.textContent = msg; }

  /* ---------- press feedback: the key drops one pixel at once and stays down at least 90 ms ---------- */
  document.addEventListener("pointerdown", function (e) {
    var el = e.target.closest && e.target.closest(".btn, .choice, .seg-btn, .tab, .opt, .undo, .icon-btn, .field-act");
    if (!el || el.getAttribute("aria-disabled") === "true") return;
    el.classList.add("is-pressed");
    var t0 = Date.now(), up = function () { setTimeout(function () { el.classList.remove("is-pressed"); }, Math.max(0, 90 - (Date.now() - t0))); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  /* disclosure rows: <button class="disc" aria-expanded> + next sibling */
  document.addEventListener("click", function (e) {
    var d = e.target.closest && e.target.closest(".disc"); if (!d) return;
    var open = d.getAttribute("aria-expanded") !== "true"; d.setAttribute("aria-expanded", open); d.nextElementSibling.hidden = !open;
  });
  setInterval(tick, 1000);
  document.addEventListener("DOMContentLoaded", function () { $$("[data-tiles]").forEach(function (el) { tiles(el, +el.getAttribute("data-cd")); }); });

  function disc(qText, aHtml, open) { return '<button type="button" class="disc" aria-expanded="' + (open ? "true" : "false") + '"><span>' + qText + "</span>" + icon("down") + '</button><div class="disc-a"' + (open ? "" : " hidden") + ">" + aHtml + "</div>"; }

  window.PX = {
    t: t, esc: esc, num: num, $: $, $$: $$, q: q, date: date, shortAddr: shortAddr, groupAddr: groupAddr, href: href, qs: qs, lang: lang, reduce: reduce,
    state: qs.get("state") || "default", M: M, A: A,
    icon: icon, btn: btn, chip: chip, cells: cells, seg: seg, note: note, hold: hold, empty: empty, skeleton: skeleton, fig: fig, row: row, jam: jam, coinSpin: coinSpin,
    cd: cd, cdTiles: cdTiles, tiles: tiles, hms: hms, toast: toast, copy: copy, sheet: sheet, closeSheet: closeSheet, shell: shell, say: say, disc: disc,
    screens: {},
    run: function () { var s = document.documentElement.getAttribute("data-screen"); if (PX.screens[s]) PX.screens[s](); $$("[data-tiles]").forEach(function (el) { tiles(el, +el.getAttribute("data-cd")); }); document.documentElement.classList.add("is-ready"); }
  };
})();
