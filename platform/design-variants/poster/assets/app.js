/* Cojam Daily, "Poster" variant: shell and shared pieces. Static design with mock data, no network calls. */
(function () {
  "use strict";
  var I = window.CJ_I18N, M = window.MOCK, L = I.lang;
  var qs = new URLSearchParams(location.search);
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var X = window.POSTER_I18N || {};
  function t(k, v) {
    if (X[k]) { var s = X[k][I.langs.indexOf(L)]; if (v) s = s.replace(/\{(\w+)\}/g, function (m, n) { return v[n] !== undefined ? v[n] : m; }); return s; }
    return I.t(k, v);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n, d) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 4 : d }); }
  function q(id) { var o = M.questions[id], x = o[L] || o.en; return { id: id, n: o.n, cat: o.cat, title: x.title, left: x.left, right: x.right, rule: x.rule, settle: x.settle }; }
  function date(d) { return d.toLocaleDateString(L === "en" ? "en-GB" : L, { month: "short", day: "numeric" }); }
  function short(a) { return a.slice(0, 6) + "…" + a.slice(-4); }
  function group(a) { return a.replace(/(.{6})/g, "$1 ").trim(); }

  var ICON = {
    back: '<svg viewBox="0 0 22 22" aria-hidden="true"><path d="M11 3 3 11l8 8M3.5 11H20" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>',
    go: '<svg class="go" viewBox="0 0 22 22" aria-hidden="true"><path d="m11 3 8 8-8 8M18.5 11H2" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>',
    x: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 3 14 14M17 3 3 17" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>',
    copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5h9v9H5zM2 11V2h9" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    triL: '<svg class="tri" viewBox="0 0 9 10" aria-hidden="true"><path d="M9 0v10L0 5z"/></svg>',
    triR: '<svg class="tri" viewBox="0 0 9 10" aria-hidden="true"><path d="M0 0v10l9-5z"/></svg>'
  };
  /* a pick chip: side glyph, the word, then the colour. c is "l" or "r". */
  function pick(c, label, cls) {
    return '<span class="chip chip-' + c + (cls ? " " + cls : "") + '">' + (c === "l" ? ICON.triL : "") + "<span>" + esc(label) + "</span>" + (c === "r" ? ICON.triR : "") + "</span>";
  }

  var TABS = [["home", "home.html", "tab.home"], ["results", "results.html", "tab.results"], ["rank", "ranking.html", "tab.rank"], ["stake", "staking.html", "tab.stake"], ["wallet", "wallet.html", "tab.wallet"]];

  function langSwitch() {
    return '<div class="seg langs" role="group" aria-label="' + t("lang.label") + '">' + I.langs.map(function (l) {
      return '<button type="button" data-lang="' + l + '" lang="' + l + '" aria-pressed="' + (l === L) + '">' + I.names[l] + "</button>";
    }).join("") + "</div>";
  }

  /* shell({ tab, back, title, body, pin, fixed, bare, state }) */
  function shell(o) {
    var st = qs.get("state");
    var hd = "";
    if (!o.bare) {
      var pts = st === "loading" ? "—" : fmt(M.user.points);
      hd = '<header class="hd">' +
        (o.back ? '<a class="hd-back" href="' + o.back + '" aria-label="' + t("hd.back") + '">' + ICON.back + "<span>" + esc(o.title || "") + "</span></a>"
          : '<a class="hd-brand" href="home.html" aria-label="' + t("hd.home") + '"><img src="assets/cojam-mark.svg" alt=""><span>Cojam</span></a>') +
        '<div class="hd-r"><a class="hd-pts" href="wallet.html" aria-label="' + t("hd.points", { p: pts }) + '"><span data-pts>' + pts + "</span><small>P</small></a>" +
        '<a class="hd-me" href="profile.html" aria-label="' + t("hd.profile") + '"' + (o.me ? ' aria-current="page"' : "") + "><span>" + esc(M.user.name.charAt(0)) + "</span></a></div></header>";
    }
    var off = st === "offline" ? '<div class="offbar" role="status">' + t("off.bar") + "</div>" : "";
    var tabs = "";
    if (o.tab) {
      tabs = '<nav class="tabs" aria-label="' + t("nav.tabs") + '">' + TABS.map(function (x) {
        var badge = x[0] === "results" && o.tab !== "results" ? '<b class="tab-b" aria-label="' + t("tab.badge.results", { n: 2 }) + '">2</b>' : "";
        return '<a class="tab" href="' + x[1] + '"' + (x[0] === o.tab ? ' aria-current="page"' : "") + "><span>" + t(x[2]) + "</span>" + badge + "</a>";
      }).join("") + "</nav>";
    }
    var foot = (o.pin || tabs) ? '<div class="foot">' + (o.pin ? '<div class="pin' + (o.pinCls ? " " + o.pinCls : "") + '">' + o.pin + "</div>" : "") + tabs + "</div>" : "";
    /* tab change: the new sheet slides in from the side of the tab that was pressed */
    var from = "0px";
    try {
      var cur = TABS.map(function (x) { return x[0]; }).indexOf(o.tab), last = +sessionStorage.getItem("cjp.poster.tab");
      if (cur >= 0) { if (!isNaN(last) && sessionStorage.getItem("cjp.poster.tab") !== null && last !== cur) from = (cur > last ? 18 : -18) + "px"; sessionStorage.setItem("cjp.poster.tab", cur); }
      else from = "0px";
    } catch (e) {}
    document.body.insertAdjacentHTML("beforeend",
      '<a class="skip" href="#main">' + t("nav.skip") + "</a>" +
      '<div class="app' + (o.fixed ? " is-fixed" : "") + '">' + hd + off + '<main class="main" id="main" tabindex="-1">' +
      '<div class="enter" style="--from:' + from + ";display:flex;flex-direction:column;flex:1;min-height:0\">" + o.body + "</div></main>" + foot + "</div>" +
      '<div class="toasts" role="status" aria-live="polite"></div><div class="sheet-bg"></div>');
    wire();
  }

  function wire() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-lang]"); if (b) { I.setLang(b.getAttribute("data-lang")); return; }
      var c = e.target.closest("[data-copy]"); if (c) { try { navigator.clipboard.writeText(c.getAttribute("data-copy")); } catch (er) {} toast(c.getAttribute("data-copied") || t("common.copied")); return; }
      var x = e.target.closest("[data-close]"); if (x) { closeSheet(); return; }
      if (e.target.classList.contains("sheet-bg")) closeSheet();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
    /* press feedback: held at least 90 ms so a quick tap is still seen */
    var SEL = ".btn, .choice, .seg > *, .opt, .undo, .tab, .field-act, .codeblock, .addr-chip";
    document.addEventListener("pointerdown", function (e) {
      var el = e.target.closest(SEL); if (!el || el.disabled) return;
      el.classList.add("is-pressed"); var t0 = Date.now();
      var up = function () { setTimeout(function () { el.classList.remove("is-pressed"); }, Math.max(0, 90 - (Date.now() - t0))); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
      addEventListener("pointerup", up); addEventListener("pointercancel", up);
    });
    rollAll(); countdowns();
  }

  function toast(msg, ms) {
    var w = document.querySelector(".toasts"); if (!w) return;
    var el = document.createElement("div"); el.className = "toast"; el.textContent = msg; w.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });
    setTimeout(function () { el.classList.remove("is-in"); setTimeout(function () { el.remove(); }, 300); }, ms || 2600);
  }

  /* bottom sheet: one at a time, slides up on the drawer curve, leaves the way it came */
  var sheetEl = null, lastFocus = null;
  function openSheet(title, html) {
    if (sheetEl) sheetEl.remove();
    lastFocus = document.activeElement;
    sheetEl = document.createElement("div"); sheetEl.className = "bsheet"; sheetEl.setAttribute("role", "dialog"); sheetEl.setAttribute("aria-modal", "true"); sheetEl.setAttribute("aria-label", title);
    sheetEl.innerHTML = '<div class="bsheet-hd"><h2 class="bsheet-t hh">' + esc(title) + '</h2><button type="button" class="bsheet-x" data-close aria-label="' + t("common.close") + '">' + ICON.x + "</button></div>" + html;
    document.body.appendChild(sheetEl);
    sheetEl.getBoundingClientRect();
    sheetEl.classList.add("is-open"); document.querySelector(".sheet-bg").classList.add("is-open");
    var f = sheetEl.querySelector("[data-close]"); if (f) f.focus({ preventScroll: true });
    return sheetEl;
  }
  function closeSheet() {
    if (!sheetEl) return; var el = sheetEl; sheetEl = null;
    el.classList.remove("is-open"); document.querySelector(".sheet-bg").classList.remove("is-open");
    setTimeout(function () { el.remove(); }, 450);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  /* figure roll: counts up once when the figure first shows */
  function roll(el, to, dec, from, ms) {
    if (reduce) { el.textContent = fmt(to, dec); return; }
    var t0 = null, a = from === undefined ? to * 0.6 : from; ms = ms || 700;
    function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / ms), e = 1 - Math.pow(1 - p, 4); el.textContent = fmt(a + (to - a) * e, dec); if (p < 1) requestAnimationFrame(step); }
    el.textContent = fmt(a, dec); requestAnimationFrame(step);
  }
  function rollAll() {
    document.querySelectorAll("[data-roll]").forEach(function (el) {
      var v = el.getAttribute("data-roll"), d = (v.split(".")[1] || "").length;
      roll(el, +v, el.hasAttribute("data-dec") ? +el.getAttribute("data-dec") : d);
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60); }
  function countdowns() {
    var els = document.querySelectorAll("[data-cd]"); if (!els.length) return;
    var end = Date.now() + M.untilNextSet() * 1000;
    function tick() {
      var s = Math.max(0, Math.round((end - Date.now()) / 1000));
      els.forEach(function (el) {
        var m = el.getAttribute("data-cd");
        if (m === "h") el.textContent = pad(Math.floor(s / 3600)); else if (m === "m") el.textContent = pad(Math.floor(s % 3600 / 60)); else if (m === "s") el.textContent = pad(s % 60); else el.textContent = hms(s);
      });
    }
    tick(); setInterval(tick, 1000);
  }

  /* today's picks, shared between home, list, done (session only) */
  var KEY = "cjp.poster.picks";
  function defaults() { var o = {}; M.results[0].rows.forEach(function (r) { o[r.q] = r.c; }); return o; }
  function picks() { try { var s = JSON.parse(sessionStorage.getItem(KEY)); if (s && Object.keys(s).length === 5) return s; } catch (e) {} return defaults(); }
  function savePicks(p) { try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

  function stateBlock(glyph, h, b, action) {
    return '<div class="state"><span class="state-g" aria-hidden="true">' + glyph + '</span><h2 class="d">' + h + "</h2>" + (b ? "<p>" + b + "</p>" : "") + (action || "") + "</div>";
  }
  function holdNote(key) {
    return '<div class="note note-k on-k" role="note" style="margin:12px var(--m) 0"><b>' + t("hold.t") + "</b>" + t(key) + '<div><a class="lnk" href="hold.html">' + t("hold.more") + "</a></div></div>";
  }
  function errBlock() { return stateBlock("!", t("common.error.h"), t("e.load"), '<button type="button" class="btn btn-p" onclick="location.reload()"><span>' + t("common.retry") + "</span></button>"); }
  function skeleton() { return '<div class="pad" style="padding-top:24px" aria-busy="true"><span class="sr">' + t("common.loading") + '</span><div class="sk sk-fig"></div><div class="sk sk-line" style="width:40%"></div><div class="sk sk-line" style="margin-top:32px"></div><div class="sk sk-line" style="width:86%"></div><div class="sk sk-line" style="width:70%"></div><div class="sk sk-line" style="margin-top:32px;height:56px"></div></div>'; }

  window.App = { t: t, esc: esc, fmt: fmt, q: q, date: date, short: short, group: group, lang: L, M: M, qs: qs, state: qs.get("state") || "", reduce: reduce, ICON: ICON, pick: pick,
    shell: shell, langSwitch: langSwitch, toast: toast, sheet: openSheet, closeSheet: closeSheet, roll: roll, rollAll: rollAll, hms: hms, pad: pad,
    picks: picks, savePicks: savePicks, defaults: defaults, stateBlock: stateBlock, holdNote: holdNote, errBlock: errBlock, skeleton: skeleton };
})();
