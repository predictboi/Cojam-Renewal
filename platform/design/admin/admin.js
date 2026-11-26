/* Cojam admin: shell and shared pieces for the static design (header band, side navigation, tables, dialogs, log viewer).
   Every page calls Admin.mount({ page, title, sub, states, render }). `?state=name` picks a state, `?env=kairos` the test network,
   `?role=viewer|operator|owner` the signed in role. */
(function () {
  "use strict";
  var D = window.AD, qs = new URLSearchParams(location.search);
  var X = window.Admin = { state: qs.get("state") || "", env: qs.get("env") === "kairos" ? "kairos" : "kaia", role: (qs.get("role") || "operator").toLowerCase() };
  X.is = function () { return [].indexOf.call(arguments, X.state) > -1; };
  X.canWrite = X.role !== "viewer";

  /* ---------- formatting ---------- */
  var esc = X.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var n = X.n = function (v, dp) { return Number(v).toLocaleString("en-US", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); };
  X.pct = function (v, dp) { return (v * 100).toFixed(dp == null ? 1 : dp) + "%"; };
  X.short = function (a) { return a.slice(0, 6) + "…" + a.slice(-4); };
  X.dur = function (s) {
    s = Math.max(0, Math.round(s)); var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    function p(x) { return String(x).padStart(2, "0"); }
    return d ? d + "d " + p(h) + "h " + p(m) + "m" : h ? h + "h " + p(m) + "m " + p(ss) + "s" : m + "m " + p(ss) + "s";
  };
  X.cd = function (sec) { return '<span data-cd="' + sec + '">' + X.dur(sec) + "</span>"; };

  /* ---------- icons: one stroke weight ---------- */
  var P = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    cards: '<rect x="4" y="7" width="13" height="14" rx="2.5"/><path d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v11"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    podium: '<path d="M9 21V9h6v12M3 21v-7h6M15 21v-9h6v9M2 21h20"/>',
    pulse: '<path d="M2 12h4l3-8 4 16 3-8h6"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
    warn: '<path d="M12 3.5l9.5 16.5h-19L12 3.5zM12 10v4.5M12 17.5v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    no: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M4 17l5-5 4 4 3-3 4.5 4.5"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5v9A2.5 2.5 0 0 0 6.5 19H20V8H6.5A2.5 2.5 0 0 1 4 7.5zM16 13.5h.5"/>',
    spark: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    down: '<path d="M6 9l6 6 6-6"/>'
  };
  var ic = X.ic = function (name, size) { size = size || 16; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || "") + "</svg>"; };
  var SORT = '<svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden="true"><path class="up" d="M4 0l4 5H0z"/><path class="dn" d="M4 12L0 7h8z"/></svg>';

  /* ---------- small pieces ---------- */
  var STATE_KIND = { Live: "ink", Draft: "line", Scheduled: "", Closed: "line", "Answer set": "up", Corrected: "sky", Cancelled: "down", Waiting: "line", Late: "warn", Drafting: "line",
    Healthy: "up", Slow: "warn", Failing: "down", Off: "line", Blocked: "down", Review: "warn", Cleared: "up",
    Generated: "line", Replaced: "line", Fallback: "warn", "Rejected by check": "down", Sent: "up", Failed: "down", Ready: "ink", Sending: "sky", "Not due": "line", "Waiting for late answers": "warn",
    Owner: "ink", Operator: "", Viewer: "line", info: "line", warn: "warn", error: "down" };
  X.tag = function (label, kind) { if (kind == null) kind = STATE_KIND[label] || ""; return '<span class="tag"' + (kind ? ' data-k="' + kind + '"' : "") + ">" + esc(label) + "</span>"; };
  X.addr = function (a, o) {
    o = o || {}; var shown = o.full ? '<span class="a-full">' + a + '</span><span class="a-short">' + X.short(a) + "</span>" : X.short(a);
    return '<span class="addr" title="' + a + '">' + (o.link === false ? shown : '<a href="https://kaiascan.io/' + (a.length > 42 ? "tx" : "address") + "/" + a + '" target="_blank" rel="noopener">' + shown + "</a>") +
      '<button type="button" data-copy="' + a + '" aria-label="Copy ' + (a.length > 42 ? "transaction hash" : "address") + " " + a + '">' + ic("copy", 14) + "</button></span>";
  };
  X.tx = function (h) { return X.addr(h); };
  X.fig = function (label, value, sub, cls) { return '<div class="fig"><span class="fig-l">' + label + '</span><span class="fig-v ' + (cls || "") + '">' + value + "</span>" + (sub ? '<span class="fig-s">' + sub + "</span>" : "") + "</div>"; };
  X.meter = function (used, cap, o) {
    o = o || {}; var p = Math.min(100, used / cap * 100);
    return '<div class="meter"' + (o.k ? ' data-k="' + o.k + '"' : "") + '><div class="meter-bar" role="img" aria-label="' + esc(o.aria || (p.toFixed(1) + "% used")) + '"><i style="width:' + p + '%"></i>' + (o.mark != null ? '<u style="left:' + o.mark + '%"></u>' : "") + "</div>" +
      '<div class="meter-cap"><span>' + (o.left || "") + "</span><span>" + (o.right || "") + "</span></div></div>";
  };
  X.note = function (kind, html, end) { return '<div class="note"' + (kind ? ' data-k="' + kind + '"' : "") + ">" + ic(kind === "up" ? "ok" : kind === "warn" || kind === "down" ? "warn" : "info") + "<div>" + html + "</div>" + (end ? '<span class="end">' + end + "</span>" : "") + "</div>"; };
  X.empty = function (title, body, acts) { return '<div class="empty"><h3>' + title + "</h3><p>" + body + "</p>" + (acts ? '<div class="acts">' + acts + "</div>" : "") + "</div>"; };
  X.errorBlock = function (what) { return '<div class="empty" role="alert"><h3>' + (what || "This list") + ' did not load.</h3><p>The admin API did not answer in 10 seconds. Nothing was changed. The figures below this point may be out of date.</p><div class="acts"><button type="button" class="btn" data-reload>' + ic("refresh") + "Try again</button></div></div>"; };
  X.thumb = function (img, sq) { return img ? '<span class="thumb' + (sq ? " sq" : "") + '"><img src="' + img + '" alt="" loading="lazy"></span>' : '<span class="thumb none' + (sq ? " sq" : "") + '" title="No image: the category illustration is used">' + ic("image") + "</span>"; };
  X.kv = function (rows) { return '<dl class="kv">' + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd" + (r[2] ? ' class="r"' : "") + ">" + r[1] + "</dd>"; }).join("") + "</dl>"; };
  X.link = function (label, href) { return '<a class="link" href="' + href + '">' + label + ic("right", 14) + "</a>"; };
  X.btn = function (label, o) {
    o = o || {}; var dis = o.disabled || (o.write && !X.canWrite);
    return "<button type=\"button\" class=\"" + (o.link ? "link" + (o.danger ? " danger" : "") : "btn" + (o.primary ? " btn-primary" : "") + (o.small ? " btn-s" : "")) + '"' + (o.act ? ' data-act="' + o.act + '"' : "") + (o.arg != null ? ' data-arg="' + esc(o.arg) + '"' : "") +
      (dis ? " disabled" : "") + (o.write && !X.canWrite ? ' title="Your role is Viewer: read only"' : o.title ? ' title="' + esc(o.title) + '"' : "") + ">" + (o.icon ? ic(o.icon) : "") + label + "</button>";
  };

  /* ---------- table: cols [{ h, num, sort, w, cell(row) , val(row) }] ---------- */
  var tid = 0;
  X.table = function (o) {
    var id = "t" + (++tid), cols = o.cols, rows = o.rows || [], sorted = o.sort;   /* sort: [colIndex, "asc"|"desc"] */
    var head = "<thead><tr>" + cols.map(function (c, i) {
      var s = sorted && sorted[0] === i ? (sorted[1] === "asc" ? "ascending" : "descending") : (c.val ? "none" : null);
      return '<th scope="col"' + (c.num ? ' class="num"' : "") + (c.w ? ' style="width:' + c.w + '"' : "") + (s ? ' aria-sort="' + s + '"' : "") + ">" + (c.val ? '<button type="button" class="th-sort" data-sort="' + i + '">' + c.h + SORT + "</button>" : c.h || '<span class="sr">' + (c.sr || "Actions") + "</span>") + "</th>";
    }).join("") + "</tr></thead>";
    function body(list) {
      return list.map(function (r, ri) {
        return "<tr" + (o.selected && o.selected(r) ? ' aria-selected="true"' : "") + (o.rowClass ? ' class="' + (o.rowClass(r) || "") + '"' : "") + (o.rowAttr ? " " + o.rowAttr(r) : "") + ">" + cols.map(function (c) { return "<td" + (c.num ? ' class="num"' : c.cls ? ' class="' + c.cls + '"' : "") + ">" + c.cell(r, ri) + "</td>"; }).join("") + "</tr>";
      }).join("");
    }
    var html;
    if (o.loading) html = '<table class="tbl ' + (o.cls || "") + '" aria-busy="true">' + head + "<tbody>" + [0, 1, 2, 3, 4].map(function (i) { return "<tr>" + cols.map(function (c, j) { return '<td><span class="skel" style="width:' + (40 + (i * 13 + j * 29) % 50) + '%"></span></td>'; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
    else if (o.error) html = X.errorBlock(o.what);
    else if (!rows.length) html = '<table class="tbl ' + (o.cls || "") + '">' + head + "</table>" + (o.empty || X.empty("Nothing here", "There are no rows to show."));
    else html = '<table class="tbl ' + (o.cls || "") + '" id="' + id + '">' + (o.caption ? '<caption class="sr">' + o.caption + "</caption>" : "") + head + "<tbody>" + body(rows) + "</tbody>" + (o.foot || "") + "</table>";
    X._tables[id] = { o: o, body: body };
    return '<div class="tbl-wrap">' + html + "</div>" + (o.after || "");
  };
  X._tables = {};
  function sortTable(btn) {
    var table = btn.closest("table"), t = X._tables[table.id]; if (!t) return;
    var i = +btn.dataset.sort, th = btn.closest("th"), dir = th.getAttribute("aria-sort") === "descending" ? "asc" : "desc", c = t.o.cols[i];
    if (th.getAttribute("aria-sort") === "none" && !c.num) dir = "asc";
    var rows = t.o.rows.slice().sort(function (a, b) { var x = c.val(a), y = c.val(b); return (x > y ? 1 : x < y ? -1 : 0) * (dir === "asc" ? 1 : -1); });
    table.querySelectorAll("th[aria-sort]").forEach(function (h) { h.setAttribute("aria-sort", "none"); });
    th.setAttribute("aria-sort", dir === "asc" ? "ascending" : "descending");
    table.tBodies[0].innerHTML = t.body(rows);
    X.live("Sorted by " + c.h.replace(/<[^>]+>/g, "") + ", " + (dir === "asc" ? "ascending" : "descending"));
  }

  /* ---------- log viewer ---------- */
  X.log = function (rows, o) {
    o = o || {};
    return (o.tools === false ? "" : '<div class="log-tools"><div class="seg" role="group" aria-label="Level"><button type="button" aria-pressed="true" data-lv="">All</button><button type="button" aria-pressed="false" data-lv="warn">Warnings</button><button type="button" aria-pressed="false" data-lv="error">Errors</button></div>' +
      '<label class="search"><span class="sr">Search the log</span>' + ic("search") + '<input class="inp" type="search" placeholder="Search job, question id or address" data-logq></label><span class="dim" style="margin-left:auto">Times in KST. Newest first.</span></div>') +
      '<ol class="log">' + rows.map(function (r, i) {
        return '<li data-lv="' + r.lv + '"><time>' + r.t + "</time>" + X.tag(r.lv === "info" ? "Info" : r.lv === "warn" ? "Warning" : "Error", STATE_KIND[r.lv]) + '<span class="who">' + esc(r.who) + "</span><p>" + esc(r.msg) + (r.tx ? " " + X.tx(r.tx) : "") + "</p>" +
          (r.json ? '<button type="button" class="link" aria-expanded="false" data-json>Details</button><pre hidden>' + esc(r.json) + "</pre>" : "<span></span>") + "</li>";
      }).join("") + "</ol>";
  };

  /* ---------- dialog (confirmation sheet) and drawer ---------- */
  var opener = null;
  X.sheet = function (o) {
    X.closeSheet(); opener = document.activeElement;
    var el = document.createElement("div"); el.className = "scrim" + (o.drawer ? " side-r" : ""); el.id = "sheet";
    el.innerHTML = o.drawer ? '<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="sheet-h" tabindex="-1">' + o.body + "</aside>" :
      '<div class="dlg' + (o.wide ? " wide" : "") + '" role="' + (o.alert ? "alertdialog" : "dialog") + '" aria-modal="true" aria-labelledby="sheet-h" tabindex="-1"><h2 id="sheet-h">' + o.title + "</h2>" + o.body +
      '<div class="dlg-foot">' + (o.cancel === false ? "" : '<button type="button" class="link" data-close>' + (o.cancel || "Cancel") + "</button>") + (o.action || "") + "</div></div>";
    document.body.appendChild(el); document.documentElement.style.overflow = "hidden";
    var box = el.firstElementChild, f = box.querySelector("[autofocus]") || box; f.focus();
    el.addEventListener("mousedown", function (e) { if (e.target === el && !o.sticky) X.closeSheet(); });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !o.sticky) { X.closeSheet(); return; }
      if (e.key !== "Tab") return;
      var items = box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex="0"]'); if (!items.length) return;
      var a = items[0], z = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === box)) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    return el;
  };
  X.closeSheet = function () { var el = document.getElementById("sheet"); if (!el) return; el.remove(); document.documentElement.style.overflow = ""; if (opener && opener.focus) opener.focus(); };
  /* a confirmation that needs a written reason: the action stays off until the note is long enough */
  X.confirm = function (o) {
    return X.sheet({ title: o.title, alert: true, wide: o.wide, body: (o.body || "") +
      (o.reason === false ? "" : '<div class="fl"><label for="why">' + (o.reasonLabel || "Reason") + ' <span class="cnt">Required, written to the audit log</span></label><textarea class="inp" id="why" rows="3" data-why autofocus placeholder="' + esc(o.placeholder || "What did you check, and why is this right?") + '">' + esc(o.prefill || "") + '</textarea><p class="err" hidden data-why-err>' + ic("warn") + (o.reasonErr || "Give a reason.") + "</p></div>") +
      (o.signer ? '<p class="hint">' + o.signer + "</p>" : ""),
      action: '<button type="button" class="btn btn-primary" data-confirm="' + esc(o.done || "Done.") + '"' + (o.next ? ' data-next="' + o.next + '"' : "") + ">" + o.action + "</button>" });
  };
  X.toast = function (msg) {
    var box = document.querySelector(".toasts"); var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; box.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  };
  X.live = function (msg) { var l = document.getElementById("live"); if (l) l.textContent = msg; };
  X.go = function (state) { var u = new URLSearchParams(location.search); if (state) u.set("state", state); else u.delete("state"); location.search = u.toString(); };
  X.href = function (page, state) { var u = new URLSearchParams(); if (state) u.set("state", state); if (X.env === "kairos") u.set("env", "kairos"); if (X.role !== "operator") u.set("role", X.role); var s = u.toString(); return page + (s ? "?" + s : ""); };

  /* ---------- shell ---------- */
  var NAV = [["index", "Dashboard", "dash"], ["rewards", "Reward settings", "sliders"], ["questions", "Questions", "cards"], ["answers", "Answers", "check"], ["ranking", "Ranking and airdrop", "podium"], ["system", "System", "pulse"], ["players", "Players", "people"]];
  X.status = function () {
    if (X.page === "system" && X.is("failing")) return ["down", "1 job failing"];
    if (X.page === "system" && X.is("maintenance")) return ["warn", "Maintenance mode is on"];
    if (X.page === "index" && X.is("calm")) return ["ok", "All systems normal"];
    return ["warn", "2 warnings"];
  };
  X.mount = function (o) {
    X.page = o.page; document.title = o.title + " · Cojam admin";
    var st = X.status(), calm = st[0] === "ok";
    var counts = { questions: calm ? null : ["2", "warn", "2 days need attention"], answers: calm ? null : ["2", "warn", "1 late, 1 flagged"], players: calm ? null : [String(D.abuse.review), "", D.abuse.review + " waiting for review"], system: calm ? null : ["1", "down", "Fee payer below its floor"], rewards: ["1", "", "1 pending change"] };
    var role = X.role.charAt(0).toUpperCase() + X.role.slice(1), mail = X.role === "owner" ? "founder@cojam.app" : X.role === "viewer" ? "cs@cojam.app" : D.me.email;
    document.body.innerHTML =
      '<a class="sr" href="#page">Skip to content</a>' +
      '<header class="top"><a class="top-logo" href="' + X.href("index.html") + '"><span class="chip-logo"><img src="../assets/cojam-mark.svg" alt="">Cojam</span><span class="top-name">Admin</span></a>' +
      '<div class="top-end"><a class="top-status" href="' + X.href("system.html") + '"><span class="dot" data-s="' + st[0] + '"></span>' + st[1] + "</a>" +
      '<span class="env" data-env="' + X.env + '" title="' + (X.env === "kairos" ? "Kairos test network, chain id 1001" : "Kaia mainnet, chain id 8217") + '">' + (X.env === "kairos" ? "Kairos test" : "Mainnet") + "</span>" +
      '<span class="top-who"><b>' + mail + "</b><span>" + role + ' role</span></span><a class="top-out" href="signin.html">Sign out</a></div></header>' +
      '<nav class="side" aria-label="Admin screens"><ul class="nav">' + NAV.map(function (x) {
        var c = counts[x[0]];
        return '<li><a href="' + X.href(x[0] + ".html") + '"' + (x[0] === o.page ? ' aria-current="page"' : "") + ">" + ic(x[2], 18) + "<span>" + x[1] + "</span>" + (c ? '<span class="cnt"' + (c[1] ? ' data-k="' + c[1] + '"' : "") + ' title="' + c[2] + '">' + c[0] + '<span class="sr"> ' + c[2] + "</span></span>" : "") + "</a></li>";
      }).join("") + '</ul><div class="side-foot"><span>' + D.now.day + "<br>Day 4 of week " + D.now.week + '</span><span>Session ends after 30 minutes without activity.</span><a href="hub.html">All screens and states</a><a href="mailto:help@cojam.app">help@cojam.app</a></div></nav>' +
      '<main class="main" id="page" tabindex="-1"><div class="wrap"><div class="ph"><h1>' + o.title + "</h1>" + (o.sub ? '<p class="ph-sub">' + o.sub + "</p>" : "") +
      '<div class="ph-end"><span class="stamp"' + (X.is("error") ? ' data-s="stale"' : "") + "><i></i>" + (X.is("loading") ? "Loading" : X.is("error") ? "Last updated 14:21:40 KST" : "Updated " + D.now.time + " KST") + '</span><button type="button" class="btn btn-s" data-reload>' + ic("refresh", 14) + "Refresh</button></div></div>" +
      (X.role === "viewer" ? X.note("", "<b>Read only.</b> You are signed in with the Viewer role. Actions that change something are switched off.") + '<div style="height:16px"></div>' : "") +
      '<div id="view"></div>' +
      (o.states ? '<p class="states"><span>Design review, states of this screen:</span>' + [["", "default"]].concat(o.states.map(function (s) { return [s, s]; })).map(function (s) { return '<a href="?state=' + s[0] + '"' + (s[0] === X.state ? ' aria-current="true"' : "") + ">" + s[1] + "</a>"; }).join("") + "</p>" : "") +
      '</div></main><div class="phone"><h1>Open the admin on a computer</h1><p>The Cojam admin is built for a wide screen. Open admin.cojam.app on a laptop or desktop, at least 1024 pixels wide.</p><p>Is something urgent? Write to <a href="mailto:help@cojam.app">help@cojam.app</a>.</p></div>' +
      '<div class="toasts" role="status" aria-live="polite"></div><div class="sr" id="live" aria-live="polite"></div>';
    var view = document.getElementById("view");
    view.innerHTML = o.render(view) || view.innerHTML;
    if (o.after) o.after(view);
    X.tick();
  };

  /* countdowns: every [data-cd] counts down from the mock moment */
  X.tick = function () {
    if (X._t) return;
    X._t = setInterval(function () { document.querySelectorAll("[data-cd]").forEach(function (el) { var s = Math.max(0, +el.dataset.cd - 1); el.dataset.cd = s; el.textContent = X.dur(s); }); }, 1000);
  };

  /* ---------- shared behaviour ---------- */
  X.acts = {};
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-copy], [data-sort], [data-json], [data-close], [data-reload], [data-confirm], [data-act], [data-lv], [role=switch], .seg[data-pick] > button");
    if (!t) return;
    if (t.dataset.copy) { if (navigator.clipboard) navigator.clipboard.writeText(t.dataset.copy).catch(function () {}); X.toast("Copied " + X.short(t.dataset.copy)); }
    else if (t.dataset.sort != null) sortTable(t);
    else if (t.hasAttribute("data-json")) { var pre = t.nextElementSibling, open = t.getAttribute("aria-expanded") === "true"; t.setAttribute("aria-expanded", String(!open)); pre.hidden = open; t.textContent = open ? "Details" : "Hide details"; }
    else if (t.hasAttribute("data-close")) { if (X.state && t.closest("#sheet") && X.sheetFromState) X.go(""); else X.closeSheet(); }
    else if (t.hasAttribute("data-reload")) location.reload();
    else if (t.dataset.confirm != null) {
      var why = document.querySelector("[data-why]");
      if (why && why.value.trim().length < 8) { var er = document.querySelector("[data-why-err]"); er.hidden = false; why.setAttribute("aria-invalid", "true"); why.setAttribute("aria-describedby", "why-err"); er.id = "why-err"; why.focus(); return; }
      var next = t.dataset.next, msg = t.dataset.confirm;
      if (next) X.go(next); else { X.closeSheet(); X.toast(msg); }
    }
    else if (t.dataset.lv != null) { t.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); }); var ol = t.closest(".log-tools").nextElementSibling; ol.querySelectorAll("li").forEach(function (li) { li.hidden = !!t.dataset.lv && li.dataset.lv !== t.dataset.lv && !(t.dataset.lv === "warn" && li.dataset.lv === "error" && false); }); }
    else if (t.getAttribute("role") === "switch" && !t.dataset.act) t.setAttribute("aria-checked", String(t.getAttribute("aria-checked") !== "true"));
    else if (t.parentNode.dataset && t.parentNode.dataset.pick != null && !t.dataset.act) { t.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); }); if (X.acts[t.parentNode.dataset.pick]) X.acts[t.parentNode.dataset.pick](t.value, t); }
    else if (t.dataset.act && X.acts[t.dataset.act]) X.acts[t.dataset.act](t.dataset.arg, t);
  });
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.matches("[data-logq]")) { var v = t.value.toLowerCase(); t.closest(".log-tools").nextElementSibling.querySelectorAll("li").forEach(function (li) { li.hidden = v && li.textContent.toLowerCase().indexOf(v) < 0; }); }
    if (t.matches("[data-max]")) { var c = document.querySelector('[data-count="' + t.id + '"]'); if (c) { var left = +t.dataset.max - [...t.value].length; c.textContent = left < 0 ? -left + " over" : left + " left"; if (left < 0) { c.setAttribute("data-over", ""); t.setAttribute("aria-invalid", "true"); } else { c.removeAttribute("data-over"); t.removeAttribute("aria-invalid"); } } }
    if (t.matches("[data-why]") && t.value.trim().length >= 8) { t.removeAttribute("aria-invalid"); var er = document.querySelector("[data-why-err]"); if (er) er.hidden = true; }
  });
})();
