/* Cojam Daily, "Ticket" variant: shell, helpers and shared components. Static design: every figure comes from mock.js. */
(function () {
  "use strict";
  var I = window.CJ_I18N, t = I.t, M = window.MOCK, lang = I.lang;
  var qs = new URLSearchParams(location.search);
  var state = qs.get("state") || "";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(v, d) { return Number(v).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 4 : d }); }
  function url(page, st) { var p = []; if (qs.get("lang")) p.push("lang=" + lang); if (st) p.push("state=" + st); return page + (p.length ? "?" + p.join("&") : ""); }
  function Q(id) { var q = M.questions[id]; var o = { id: id, n: q.n, cat: q.cat }; var l = q[lang] || q.en; for (var k in l) o[k] = l[k]; return o; }
  function date(d, year) { var o = { month: "short", day: "numeric" }; if (year) o.year = "numeric"; return d.toLocaleDateString(lang === "en" ? "en-US" : lang, o); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function serialDay() { var d = new Date(); return pad(d.getMonth() + 1) + pad(d.getDate()); }
  function hms(s) { s = Math.max(0, s); return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60); }

  /* ---------- icons: one 24 px grid, 1.8 stroke, drawn for this variant ---------- */
  var P = {
    home: '<path d="M4 6.5h16v3.2a2.3 2.3 0 0 0 0 4.6v3.2H4v-3.2a2.3 2.3 0 0 0 0-4.6z"/><path d="M14.5 7v2M14.5 11v2M14.5 15v2"/>',
    results: '<path d="M4 6.5h16v3.2a2.3 2.3 0 0 0 0 4.6v3.2H4v-3.2a2.3 2.3 0 0 0 0-4.6z"/><path d="m8.8 12.2 2.2 2.2 4.4-4.6"/>',
    rank: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M8.5 4.5v15"/>',
    stake: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 11.5h6"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3"/><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M15.5 13.5h.01"/>',
    user: '<circle cx="12" cy="9" r="3.5"/><path d="M5 19.5c1.2-3 3.8-4.5 7-4.5s5.800 1.500 7 4.500"/>',
    back: '<path d="M14.500 5.500 8 12l6.500 6.500"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="8.500"/><path d="M12 11v5M12 8h.01"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
    x: '<path d="M6.500 6.500l11 11M17.500 6.500l-11 11"/>',
    dash: '<path d="M7 12h10"/>',
    clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
    copy: '<rect x="8.500" y="8.500" width="11" height="11" rx="2"/><path d="M5 15.500V6.500A1.500 1.500 0 0 1 6.500 5h9"/>',
    chev: '<path d="m9.500 5.500 6.500 6.500-6.500 6.500"/>',
    down: '<path d="m6 9.500 6 6 6-6"/>',
    undo: '<path d="M8 6 4 10l4 4"/><path d="M4 10h10a5 5 0 0 1 0 10h-3"/>',
    lock: '<rect x="5.500" y="10.500" width="13" height="9.500" rx="2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
    share: '<path d="M12 15V4M8 7.500 12 3.500l4 4M5.500 12v7.500h13V12"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.500"/><path d="M4 13h16M12 9v11M12 9c-2-.5-4-2-3.500-3.500S11 5 12 9c1-4 3-4.500 3.500-3.500S14 8.500 12 9"/>',
    dep: '<path d="M12 4v11M7.500 10.500 12 15l4.500-4.500M5 19.500h14"/>',
    wd: '<path d="M12 15V4M7.500 8.500 12 4l4.500 4.500M5 19.500h14"/>',
    off: '<path d="M4 4l16 16M8.500 13a5 5 0 0 1 2.500-1.300M5.500 9.800a9.500 9.500 0 0 1 2.300-1.500M12 8a9.500 9.500 0 0 1 6.500 2M15.500 13.200a5 5 0 0 0-1-.7M12 17.500h.01"/>',
    warn: '<path d="M12 4.500 20.500 19h-17z"/><path d="M12 10v4M12 16.500h.01"/>',
    out: '<path d="M14 5h5v5M19 5l-8 8M17.500 13.500V19h-12V7H11"/>'
  };
  function ic(n, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : "") + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[n].replace(/\.500/g, ".5").replace(/\.800/g, ".8") + "</svg>"; }

  /* ---------- pictograms: one ink, printed on the ticket ---------- */
  var ART = {
    q1: '<circle cx="118" cy="62" r="40" fill="none"/><circle cx="118" cy="62" r="29" stroke-dasharray="2 7"/><path d="M108 46h14a8 8 0 0 1 0 16h-14zm0 16h17a8 8 0 0 1 0 16h-17zM114 40v6M122 40v6M114 78v6M122 78v6" fill="none"/><path d="M18 128 58 104l26 12 28-22" fill="none"/><path d="M150 116 182 84M182 84h-16M182 84v16" fill="none"/>',
    q2: '<circle cx="64" cy="66" r="34" fill="none"/><path d="M76 54c-3-6-10-8-16-6s-8 9-3 13 13 3 17 8-1 12-8 13-12-2-14-7M64 42v48" fill="none"/><circle cx="140" cy="94" r="34" fill="none"/><path d="M124 78l8 32 8-26 8 26 8-32M120 90h40M120 98h40" fill="none"/><path d="M108 30h28l-8-8M96 134H68l8 8" fill="none"/>',
    q3: '<circle cx="74" cy="70" r="24" fill="none"/><path d="M74 28v10M74 102v10M32 70h10M106 70h10M44 40l7 7M97 93l7 7M44 100l7-7M97 47l7-7" fill="none"/><path d="M142 34a9 9 0 0 1 18 0v62a17 17 0 1 1-18 0z" fill="none"/><path d="M151 58v52" stroke-width="8"/><circle cx="151" cy="112" r="8" fill="currentColor"/><path d="M168 48h10M168 64h10M168 80h10" fill="none"/>',
    q4: '<path d="M22 132V40h156v92" fill="none"/><path d="M22 62h156M22 84h156M22 106h156M48 40v92M74 40v92M126 40v92M152 40v92" stroke-width="1.5" opacity=".45" fill="none"/><circle cx="100" cy="104" r="27" fill="var(--stock-2)"/><path d="m100 90 12 9-5 14H93l-5-14zM100 77v13M112 99l13-4M107 113l8 11M93 113l-8 11M88 99l-13-4" fill="none"/>',
    q5: '<path d="M24 132h152" fill="none"/><path d="M36 132v-34h22v34M72 132V82h22v50M108 132V96h22v36" fill="none"/><path d="M144 132V56h22v76" fill="currentColor" fill-opacity=".14"/><path d="M144 132V56h22v76" fill="none"/><path d="M34 74 70 54l28 14 48-38M146 30h-15M146 30v15" fill="none"/>',
    culture: '<rect x="30" y="38" width="140" height="92" rx="6" fill="none"/><path d="M30 60h140M52 38l-10 22M84 38 74 60M116 38l-10 22M148 38l-10 22" fill="none"/><path d="m88 80 30 16-30 16z" fill="none"/>'
  };
  function art(key) { return '<svg viewBox="0 0 200 160" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ART[key] || ART.culture) + "</svg>"; }
  function mark(size) { return '<img src="assets/cojam-mark.svg" width="' + size + '" height="' + size + '" alt="">'; }
  function holes(total, on, cls, now) { var s = '<span class="holes ' + (cls || "") + '" aria-hidden="true">'; for (var i = 0; i < total; i++) s += '<i class="' + (i < Math.floor(on) ? "on" : (i < on ? "half" : (i === now ? "now" : ""))) + '"></i>'; return s + "</span>"; }
  function pick(side) { return '<span class="pick ' + (side || "none") + '">' + ic(side === "l" ? "left" : side === "r" ? "right" : "dash") + "</span>"; }

  /* ---------- shell ---------- */
  var TABS = [["home", "home.html"], ["results", "results.html"], ["rank", "ranking.html"], ["stake", "staking.html"], ["wallet", "wallet.html"]];
  function shell(o) {
    o = o || {};
    var html = '<a class="skip" href="#main">' + t("nav.skip") + "</a>";
    html += '<div class="app' + (o.sub ? " app--sub" : "") + (o.bare ? " app--bare" : "") + (o.fit ? " app--fit" : "") + (o.cls ? " " + o.cls : "") + '">';
    if (o.sub) {
      html += '<header class="hd hd--sub"><a class="icon-btn" href="' + url(o.back || "wallet.html") + '" aria-label="' + t("hd.back") + '">' + ic("back") + '</a><span class="hd-title">' + esc(o.sub) + "</span></header>";
    } else if (!o.bare) {
      html += '<header class="hd"><a class="hd-brand" href="' + url("home.html") + '" aria-label="' + t("hd.home") + '">' + mark(28) + "<span>Cojam</span></a>" +
        '<a class="pts" id="pts" href="' + url("wallet.html") + '" aria-label="' + t("hd.points", { p: num(M.user.points) }) + '"><b id="pts-n">' + num(o.points === undefined ? M.user.points : o.points) + "</b><i>P</i></a>" +
        '<a class="icon-btn" href="' + url("profile.html") + '" aria-label="' + t("hd.profile") + '">' + ic("user") + "</a></header>";
    }
    if (state === "offline") html += '<div class="offbar" role="status">' + t("off.bar") + "</div>";
    html += '<main class="main enter" id="main" tabindex="-1"></main>';
    if (!o.sub && !o.bare) {
      var idx = 0;
      html += '<nav class="tabs" aria-label="' + t("nav.tabs") + '"><span class="tabs-punch" id="punch"></span>';
      TABS.forEach(function (tb, i) {
        var on = tb[0] === o.tab; if (on) idx = i;
        html += '<a class="tab" href="' + url(tb[1]) + '"' + (on ? ' aria-current="page"' : "") + ">" + ic(tb[0]) + "<span>" + t("tab." + tb[0]) + "</span>" +
          (tb[0] === "results" && !on ? '<i class="tab-dot"></i><span class="sr">' + t("tab.badge.results", { n: 2 }) + "</span>" : "") + "</a>";
      });
      html += "</nav>";
    }
    html += '</div><div class="sr" aria-live="polite" id="live"></div>';
    document.body.insertAdjacentHTML("beforeend", html);
    var punch = document.getElementById("punch");
    if (punch) {
      var prev = null; try { prev = sessionStorage.getItem("tk.tab"); sessionStorage.setItem("tk.tab", idx); } catch (e) {}
      if (prev !== null && +prev !== idx && !reduce) {
        punch.style.transition = "none"; punch.style.transform = "translateX(" + (+prev * 100) + "%)";
        requestAnimationFrame(function () { requestAnimationFrame(function () { punch.style.transition = ""; punch.style.transform = "translateX(" + (idx * 100) + "%)"; }); });
      } else punch.style.transform = "translateX(" + (idx * 100) + "%)";
    }
    return document.getElementById("main");
  }
  function live(msg) { var l = document.getElementById("live"); if (l) { l.textContent = ""; setTimeout(function () { l.textContent = msg; }, 30); } }

  /* ---------- press feedback: held for at least 90 ms so a quick tap is seen ---------- */
  var PRESS = ".btn, .ans, .opt, .undo, .tab, .row--link, .mini-btn, .rrow";
  document.addEventListener("pointerdown", function (e) {
    var el = e.target.closest && e.target.closest(PRESS); if (!el || el.disabled) return;
    el.classList.add("is-pressed"); var t0 = Date.now();
    function up() { setTimeout(function () { el.classList.remove("is-pressed"); }, Math.max(0, 90 - (Date.now() - t0))); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); }
    document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });

  /* ---------- toast, sheet ---------- */
  var toastEl, toastTo;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; clearTimeout(toastTo);
    requestAnimationFrame(function () { toastEl.classList.add("on"); });
    toastTo = setTimeout(function () { toastEl.classList.remove("on"); }, 2600);
  }
  function sheet(title, body) {
    var back = document.createElement("div"); back.className = "sheet-back";
    var el = document.createElement("div"); el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", title); el.tabIndex = -1;
    el.innerHTML = '<div class="sheet-h"><h2 class="hd-2">' + esc(title) + '</h2><button class="icon-btn" data-close aria-label="' + t("common.close") + '">' + ic("x") + "</button></div>" + body;
    document.body.appendChild(back); document.body.appendChild(el);
    var last = document.activeElement;
    function close() { el.classList.remove("on"); back.classList.remove("on"); document.removeEventListener("keydown", key); setTimeout(function () { el.remove(); back.remove(); }, reduce ? 0 : 380); if (last && last.focus) last.focus(); }
    function key(e) { if (e.key === "Escape") close(); }
    back.addEventListener("click", close); document.addEventListener("keydown", key);
    el.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) close(); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); back.classList.add("on"); el.focus({ preventScroll: true }); }); });
    el.close = close; return el;
  }
  function copy(text, msg) { try { navigator.clipboard.writeText(text).catch(function () {}); } catch (e) {} toast(msg || t("common.copied")); live(msg || t("common.copied")); }

  /* ---------- odometer: digits roll by transform only ---------- */
  function odo(el, from, to) {
    from = String(from); to = String(to); while (from.length < to.length) from = " " + from;
    var h = '<span class="sr">' + esc(to) + '</span><span class="odo" aria-hidden="true">';
    for (var i = 0; i < to.length; i++) {
      var c = to[i];
      if (/\d/.test(c)) { h += '<span><span class="col" data-to="' + c + '" style="transform:translateY(-' + ((/\d/.test(from[i]) ? +from[i] : 0) * 10) + '%)">'; for (var d = 0; d < 10; d++) h += "<i>" + d + "</i>"; h += "</span></span>"; }
      else h += "<span>" + esc(c) + "</span>";
    }
    el.innerHTML = h + "</span>";
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.querySelectorAll(".col").forEach(function (c, i) { c.style.transitionDelay = (i * 40) + "ms"; c.style.transform = "translateY(-" + (+c.dataset.to * 10) + "%)"; }); }); });
  }
  function bumpPoints(from, to) { var p = document.getElementById("pts"), n = document.getElementById("pts-n"); if (!p) return; odo(n, num(from), num(to)); p.classList.remove("is-bump"); void p.offsetWidth; p.classList.add("is-bump"); }

  /* ---------- countdowns ---------- */
  function tick() {
    document.querySelectorAll("[data-cd]").forEach(function (el) {
      var s = el.dataset.cd === "week" ? M.untilWeekEnd() : M.untilNextSet();
      if (el.dataset.cd === "week") el.textContent = t("k.dh", { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600) }); else el.textContent = hms(s);
    });
  }
  setInterval(tick, 1000);

  function langSwitch() {
    var names = { en: "EN", ko: "한국어", ja: "日本語" };
    return '<div class="lang"><div class="seg" role="group" aria-label="' + t("lang.label") + '">' + I.langs.map(function (l) { return '<button type="button" data-lang="' + l + '" lang="' + l + '" aria-pressed="' + (l === lang) + '">' + names[l] + "</button>"; }).join("") + "</div></div>";
  }
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-lang]"); if (b) I.setLang(b.dataset.lang); });

  function empty(h, b, btn) { return '<div class="empty"><svg class="art" viewBox="0 0 132 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M8 14h116v22a12 12 0 0 0 0 24v22H8V60a12 12 0 0 0 0-24z"/><path d="M88 18v8M88 32v8M88 46v8M88 60v8M88 74v6" stroke-dasharray="0" stroke-linecap="round"/><path d="M24 34h44M24 48h30" stroke-linecap="round" opacity=".4"/></svg><h2 class="hd-2">' + h + "</h2>" + (b ? "<p>" + b + "</p>" : "") + (btn || "") + "</div>"; }
  function errBox() { return empty(t("common.error.h"), t("e.load"), '<button class="btn btn--line" onclick="location.reload()">' + t("common.retry") + "</button>"); }
  function holdNote(key) { return '<div class="note note--warn" role="status">' + ic("warn") + "<div><b>" + t("hold.tag") + ".</b> " + t(key) + ' <a href="' + url("hold.html") + '">' + t("hold.more") + "</a></div></div>"; }

  window.TK = { I: I, t: t, M: M, lang: lang, qs: qs, state: state, reduce: reduce, esc: esc, num: num, url: url, Q: Q, date: date, pad: pad, serialDay: serialDay, hms: hms, ic: ic, art: art, mark: mark, holes: holes, pick: pick,
    shell: shell, live: live, toast: toast, sheet: sheet, copy: copy, odo: odo, bumpPoints: bumpPoints, tick: tick, langSwitch: langSwitch, empty: empty, errBox: errBox, holdNote: holdNote, screens: {} };
  document.addEventListener("DOMContentLoaded", function () { var s = document.body.dataset.screen; if (TK.screens[s]) TK.screens[s](); tick(); });
})();
