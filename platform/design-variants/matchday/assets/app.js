/* Matchday shell: header with the score bug, tab bar, sheets, toasts, flip digits, figure rolls. Static design, mock data only. */
(function () {
  "use strict";
  var I = window.CJ_I18N, T = I.t, L = I.lang, M = window.MOCK;
  var qs = new URLSearchParams(location.search), STATE = qs.get("state") || "";
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n, d) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 4 : d }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function svg(p, a) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"' + (a || "") + ">" + p + "</svg>"; }
  var IC = {
    home: svg('<rect x="3.5" y="4" width="17" height="16"/><path d="M13.5 4 10.5 20"/>'),
    results: svg('<path d="M4 6h3M4 12h3M4 18h3M11 6h9M11 12h9M11 18h9"/>'),
    rank: svg('<path d="M4 20V11h5v9M9 20V5h6v15M15 20v-6h5v6M3 20h18"/>'),
    stake: svg('<rect x="5" y="10.5" width="14" height="9.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>'),
    wallet: svg('<path d="M4 7h16v12H4zM4 7l11-3v3M15.5 13h1"/>'),
    profile: svg('<circle cx="12" cy="9" r="3.5"/><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5"/>'),
    back: svg('<path d="M14.5 5 7.5 12l7 7"/>'),
    info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.500M12 7.600v.300"/>'),
    undo: svg('<path d="M8 5 4 9l4 4M4.5 9H14a5 5 0 0 1 0 10H9"/>'),
    al: svg('<path d="M11 6 5 12l6 6M5.5 12H19"/>'),
    ar: svg('<path d="M13 6l6 6-6 6M18.5 12H5"/>'),
    check: svg('<path d="M5 12.5 10 17.5 19 7"/>'),
    cross: svg('<path d="M6 12h12"/>'),
    clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.500V12l3 2"/>'),
    copy: svg('<rect x="8" y="8" width="11.5" height="11.5"/><path d="M5 15.500V4.500h11"/>'),
    down: svg('<path d="M6 9.5 12 15.500l6-6"/>'),
    right: svg('<path d="M9.5 6l6 6-6 6"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    share: svg('<path d="M12 15V4M8 7.5 12 3.500l4 4M5 12v8h14v-8"/>'),
    ext: svg('<path d="M10 5H5v14h14v-5M13 4h7v7M20 4l-9 9"/>'),
    list: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    cards: svg('<rect x="6" y="4" width="12" height="16"/><path d="M3 7v10M21 7v10"/>'),
    lock: svg('<rect x="5" y="10.5" width="14" height="9.5"/><path d="M8.5 10.500V7.500a3.5 3.5 0 0 1 7 0v3"/>'),
    minus: svg('<path d="M6 12h12"/>'), plus: svg('<path d="M6 12h12M12 6v12"/>'),
    gift: svg('<path d="M4 10h16v10H4zM3 6.500h18V10H3zM12 6.500V20M12 6.500C10 3 6.5 4 8 6.500M12 6.500c2-3.5 5.5-2.5 4 0"/>'),
    logout: svg('<path d="M14 5H5v14h9M10 12h10M16.5 8.5 20 12l-3.5 3.5"/>')
  };
  function q(id) { var o = M.questions[id], x = o[L] || o.en, r = {}; for (var k in x) r[k] = x[k]; r.n = o.n; r.img = o.img; r.cat = o.cat; r.id = id; return r; }
  function time(d) { return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function date(d) {
    if (L === "ko") return (d.getMonth() + 1) + "월 " + d.getDate() + "일";
    if (L === "ja") return (d.getMonth() + 1) + "月" + d.getDate() + "日";
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " + d.getDate();
  }
  function krw(ct) { return L === "ko" ? '<span class="small dim">' + T("common.krw", { krw: fmt(Math.round(ct * M.krwPerCt), 0) }) + "</span>" : ""; }

  /* a pick, never told by colour alone: side swatch (stripes on the left kit), arrow and the answer's own words */
  function pk(dir, label) { return '<span class="pk"><i class="kit-sw ' + dir + '"></i>' + (dir === "l" ? IC.al.replace("<svg", '<svg width="14" height="14"') : "") + esc(label) + (dir === "r" ? IC.ar.replace("<svg", '<svg width="14" height="14"') : "") + "</span>"; }
  function face(Q, cls) {
    return '<div class="face ' + (cls || "") + '">' +
      '<button class="side l" data-dir="l" aria-label="' + esc(T("h.pick.aria", { choice: Q.left, q: Q.title })) + '"><span class="side-k">' + IC.al + esc(T("md.left")) + '</span><span class="side-n">' + esc(Q.left) + "</span></button>" +
      '<button class="side r" data-dir="r" aria-label="' + esc(T("h.pick.aria", { choice: Q.right, q: Q.title })) + '"><span class="side-k">' + esc(T("md.right")) + IC.ar + '</span><span class="side-n">' + esc(Q.right) + "</span></button>" +
      '<span class="vs" aria-hidden="true">' + T("md.vs") + "</span></div>";
  }

  /* flip digits */
  function fdHtml(str, cls) {
    return '<span class="fd ' + (cls || "") + '" aria-hidden="true">' + str.split("").map(function (c) { return /\d/.test(c) ? "<i>" + c + "</i>" : c === ":" ? "<b>:</b>" : "<u>" + esc(c) + "</u>"; }).join("") + "</span>";
  }
  function fdSet(el, str) {
    var cells = $$("i", el), ds = str.replace(/\D/g, "").split("");
    cells.forEach(function (c, i) {
      if (ds[i] !== undefined && c.textContent !== ds[i]) { c.textContent = ds[i]; if (!RM && c.animate) c.animate([{ transform: "rotateX(-90deg)" }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" }); }
    });
  }
  function hms(s) { var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2) + ":" + ("0" + x).slice(-2); }
  /* a live clock: host gets the tiles and a screen reader label; ticks each second */
  function clock(host, secs, cls) {
    var end = Date.now() + secs * 1000;
    function left() { return Math.max(0, Math.round((end - Date.now()) / 1000)); }
    host.innerHTML = fdHtml(hms(left()), cls) + '<span class="sr">' + T("d.next.sr", { h: Math.floor(left() / 3600), m: Math.floor(left() % 3600 / 60) }) + "</span>";
    var fd = $(".fd", host);
    setInterval(function () { fdSet(fd, hms(left())); }, 1000);
  }
  function roll(el, from, to, ms, f) {
    f = f || function (v) { return fmt(Math.round(v), 0); };
    if (RM || !ms) { el.textContent = f(to); return; }
    var t0 = performance.now();
    (function step(t) { var p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = f(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); })(t0);
  }

  function langSwitch() {
    return '<div class="lang" role="group" aria-label="' + T("lang.label") + '">' + I.langs.map(function (l) {
      return '<button type="button" lang="' + l + '" data-lang="' + l + '" aria-pressed="' + (l === L) + '">' + I.names[l] + "</button>"; }).join("") + "</div>";
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-lang]"); if (b) I.setLang(b.getAttribute("data-lang"));
    var c = e.target.closest("[data-copy]"); if (c) { try { navigator.clipboard.writeText(c.getAttribute("data-copy")); } catch (x) {} toast(c.getAttribute("data-copied") || T("common.copied")); }
    var t = e.target.closest(".tab"); if (t && t.getAttribute("aria-current") !== "page") { try { sessionStorage.setItem("md.wipe", "1"); } catch (x) {} }
  });

  /* sheet */
  var sheetEl, bgEl, lastFocus;
  function sheet(title, html) {
    closeSheet(true); lastFocus = document.activeElement;
    bgEl = document.createElement("div"); bgEl.className = "sheet-bg";
    sheetEl = document.createElement("div"); sheetEl.className = "sheet"; sheetEl.setAttribute("role", "dialog"); sheetEl.setAttribute("aria-modal", "true"); sheetEl.setAttribute("aria-label", title);
    sheetEl.innerHTML = '<div class="sheet-h"><h2 class="disp">' + esc(title) + '</h2><button class="sheet-x" aria-label="' + T("common.close") + '">' + IC.close + "</button></div>" + html;
    document.body.appendChild(bgEl); document.body.appendChild(sheetEl);
    sheetEl.getBoundingClientRect(); bgEl.classList.add("on"); sheetEl.classList.add("on");
    bgEl.onclick = function () { closeSheet(); }; $(".sheet-x", sheetEl).onclick = function () { closeSheet(); };
    $(".sheet-x", sheetEl).focus({ preventScroll: true });
    return sheetEl;
  }
  function closeSheet(now) {
    if (!sheetEl) return; var s = sheetEl, b = bgEl; sheetEl = bgEl = null;
    s.classList.add("out"); s.classList.remove("on"); b.classList.remove("on");
    setTimeout(function () { s.remove(); b.remove(); }, now || RM ? 0 : 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.getBoundingClientRect(); toastEl.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 2600);
  }

  /* shell */
  var TABS = [["home", "home.html", "tab.home"], ["results", "results.html", "tab.results"], ["rank", "ranking.html", "tab.rank"], ["stake", "staking.html", "tab.stake"], ["wallet", "wallet.html", "tab.wallet"]];
  function shell(o) {
    var b = document.body; b.setAttribute("data-screen", o.screen); b.setAttribute("data-zone", o.zone || "play");
    document.title = o.title + " | Cojam Daily";
    var u = M.user, hold = STATE === "hold";
    var h = '<a class="skip" href="#main">' + T("nav.skip") + "</a>";
    if (!o.bare) {
      h += '<header class="hd">' + (o.back
        ? '<a class="hd-btn" href="' + o.back + '" aria-label="' + T("hd.back") + '">' + IC.back + "</a>"
        : '<a class="hd-mark" href="home.html" aria-label="' + T("hd.home") + '"><img src="assets/cojam-mark.svg" alt=""></a>') +
        '<h1 class="hd-title disp caps">' + esc(o.title) + "</h1>" +
        '<a class="bug" href="wallet.html" aria-label="' + T("hd.points", { p: fmt(u.points) }) + '"><span class="bug-in"><span class="bug-n" id="bug-n">' + fmt(o.points !== undefined ? o.points : u.points) + '</span><span class="bug-u">P</span></span></a>' +
        (o.back ? "" : '<a class="hd-btn" href="profile.html" aria-label="' + T("hd.profile") + '">' + IC.profile + "</a>") + "</header>";
    }
    h += '<main class="main" id="main" tabindex="-1"></main>';
    if (!o.bare && !o.notabs) {
      h += '<nav class="tabs" aria-label="' + T("nav.tabs") + '">' + TABS.map(function (t) {
        var badge = t[0] === "home" && o.tab !== "home" ? '<i class="tab-badge"></i><span class="sr">' + T("tab.badge.home") + "</span>" : "";
        return '<a class="tab" href="' + t[1] + (hold ? "?state=hold" : "") + '"' + (o.tab === t[0] ? ' aria-current="page"' : "") + ">" + IC[t[0]] + "<span>" + T(t[2]) + "</span>" + badge + "</a>"; }).join("") + "</nav>";
    }
    var ns = $("noscript"); if (ns) ns.remove();
    b.insertAdjacentHTML("afterbegin", h);
    try { if (sessionStorage.getItem("md.wipe")) { sessionStorage.removeItem("md.wipe"); if (!RM) { var w = document.createElement("div"); w.className = "pagewipe"; b.appendChild(w); setTimeout(function () { w.remove(); }, 400); } } } catch (x) {}
    var main = $("#main");
    if (STATE === "offline") main.insertAdjacentHTML("beforeend", '<div class="offbar" role="status"><i class="card-i y"></i><span>' + T("off.bar") + " " + T("off.last", { time: time(new Date(Date.now() - 42 * 60000)) }) + "</span></div>");
    if (STATE === "loading") { main.setAttribute("aria-busy", "true"); main.insertAdjacentHTML("beforeend", '<p class="sr" role="status">' + T("common.loading") + "</p>" + (o.skeleton || '<div class="sk" style="height:120px"></div><div class="sk" style="height:56px"></div><div class="sk" style="height:220px"></div><div class="sk" style="height:56px"></div>')); return null; }
    if (STATE === "error") { main.insertAdjacentHTML("beforeend", errorBlock()); return null; }
    return main;
  }
  function errorBlock() {
    return '<div class="empty" role="alert">' + ART.whistle + '<h2 class="disp caps">' + T("common.error.h") + "</h2><p>" + T("e.load") + '</p><button class="btn go" onclick="location.reload()">' + T("common.retry") + "</button></div>";
  }
  function put(main, html) { main.insertAdjacentHTML("beforeend", html); $$(".rise", main).forEach(function (g) { $$(":scope > *", g).forEach(function (c, i) { c.style.setProperty("--i", i); }); }); $$(".rows, .flips", main).forEach(function (g) { var n = 0; $$(g.classList.contains("flips") ? ".mk" : ":scope > *", g).forEach(function (c) { c.style.setProperty("--i", n++); }); }); }

  /* small drawings, all original */
  var ART = {
    whistle: '<svg class="art" viewBox="0 0 120 90" fill="none" aria-hidden="true"><circle cx="46" cy="52" r="24" stroke="currentColor" stroke-width="5"/><path d="M52 29h54v16H69" stroke="currentColor" stroke-width="5"/><circle cx="46" cy="52" r="7" fill="currentColor"/><path d="M18 14l8 10M34 6l3 13M6 30l12 5" stroke="currentColor" stroke-width="5"/></svg>',
    board: '<svg class="art" viewBox="0 0 120 90" fill="none" aria-hidden="true"><rect x="8" y="12" width="104" height="52" stroke="currentColor" stroke-width="5"/><path d="M60 12v52M26 28h16v20H26zM78 28h16v20H78zM30 64v16M90 64v16" stroke="currentColor" stroke-width="5"/></svg>',
    pitch: '<svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true"><path d="M0 120h400M200 0v240" stroke="#364157" stroke-width="2"/><circle cx="200" cy="120" r="54" stroke="#364157" stroke-width="2"/><path d="M-10 60h60v120h-60M410 60h-60v120h60" stroke="#364157" stroke-width="2"/></svg>'
  };
  function qr(seed) { /* a stand in pattern, drawn from the address so it stays stable: the real app renders a true QR code */
    var n = 25, s = 0, out = "", i, x, y; for (i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    function eye(ex, ey) { return x >= ex && x < ex + 7 && y >= ey && y < ey + 7; }
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      var e = eye(0, 0) ? [0, 0] : eye(n - 7, 0) ? [n - 7, 0] : eye(0, n - 7) ? [0, n - 7] : null, on;
      if (e) { var dx = x - e[0], dy = y - e[1]; on = dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx > 1 && dx < 5 && dy > 1 && dy < 5); } else on = rnd() > .52;
      if (on) out += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="-2 -2 29 29" width="176" height="176" role="img" aria-label="' + T("dp.qr") + '" style="background:var(--kit)"><g fill="currentColor">' + out + "</g></svg>";
  }

  window.App = { t: T, lang: L, M: M, state: STATE, rm: RM, esc: esc, fmt: fmt, $: $, $$: $$, ic: IC, art: ART, q: q, time: time, date: date, krw: krw, pk: pk, face: face,
    fd: fdHtml, fdSet: fdSet, hms: hms, clock: clock, roll: roll, langSwitch: langSwitch, sheet: sheet, closeSheet: closeSheet, toast: toast, shell: shell, put: put, error: errorBlock, qr: qr, qs: qs };
})();
