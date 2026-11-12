// Admin swap monitor. Read only. Mock: CJ.sample (system.js) stands in for the swap contract's
// Migrated(user, lotId, ...) and Claimed(user, lotId, amount, caller) events, the same seeded set the status page reads.
// Claimed's caller tells a keeper release from a holder claim.
// Fee delegation: the same Cojam gas wallet pays approve, swap and claim for fee delegated wallets, and every keeper release.
(function () {
  var DAY = CJ.DAY, HOUR = 3600000, C = CJ.config, F = CJ.fmt, I = CJ.icon;
  var t = function (k, v) { return CJ.t(k, v); };
  var $ = function (id) { return document.getElementById(id); };
  var SUPPLY = C.newToken.supply, HOLDERS = C.oldHolders;
  // 25 rows per page on a table, 10 cards per page under 760 px (the stacked layout in admin.css), so a phone page stays short.
  var mqCards = window.matchMedia ? matchMedia("(max-width: 759px)") : { matches: false };
  var PER_PAGE = mqCards.matches ? 10 : 25, BIG_KEY = "cj.admin.bigThreshold";
  var SEARCH_ICO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
  var DL_ICO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 20h14"/></svg>';
  var SORT_ICO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path class="up" d="M8 10l4-4 4 4"/><path class="dn" d="M8 14l4 4 4-4"/></svg>';

  // ---------- derived state (shared sample, see CJ.sample in system.js) ----------
  var D, lastRead;
  function derive() { D = CJ.sample.state(); lastRead = Date.now(); }

  // ---------- formatting ----------
  function loc() { return { en: "en-US", ko: "ko-KR", ja: "ja-JP" }[CJ.lang()] || "en-US"; }
  // Amount columns: always 2 decimals, so decimal points line up in a right aligned column.
  function amt(n) { return new Intl.NumberFormat(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); }
  function amt0(n) { return F.amount(n, 0); }
  function pl(key, n) { return t(key + (n === 1 ? ".one" : ".other"), { n: amt0(n) }); }
  function dOnly(ts) { return new Intl.DateTimeFormat(loc(), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(ts); }
  function dShort(ts) { return new Intl.DateTimeFormat(loc(), { month: "short", day: "numeric", timeZone: "UTC" }).format(ts); }
  function tOnly(ts) { return new Intl.DateTimeFormat(loc(), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(ts); }
  function dt(ts) { return dOnly(ts) + ", " + tOnly(ts) + " UTC"; }
  function iso(ts) { return ts ? new Date(ts).toISOString() : ""; }
  function dur(ms) {
    var d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.max(1, Math.ceil((ms % HOUR) / 60000));
    if (d >= 1) return h ? t("pair", { a: pl("n.day", d), b: pl("n.hour", h) }) : pl("n.day", d);
    if (h >= 1) return m && m < 60 ? t("pair", { a: pl("n.hour", h), b: pl("n.min", m) }) : pl("n.hour", h);
    return pl("n.min", m);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // One status vocabulary and one style per status across pages: Locked, Being sent, Released (tags in base.css).
  function statusTag(s) {
    var ico = s === "locked" ? "lock" : s === "releasing" ? "unlock" : "check";
    var cls = s === "locked" ? "tag-locked" : s === "releasing" ? "tag-sending" : "tag-released";
    return '<span class="tag ' + cls + '">' + I(ico, 14) + "<span>" + t("st." + s) + "</span></span>";
  }
  function byLine(l) { return l.releasedBy ? '<span class="by small muted">' + t(l.releasedBy === "keeper" ? "by.keeper" : "by.holder") + "</span>" : ""; }
  function leftText(l) {
    if (l.status === "released") return t("left.released", { date: dShort(l.releasedAt) });
    if (l.status === "releasing") return t(l.overdue ? "left.overdue" : "left.releasing", { time: dur(D.now - l.unlockAt) });
    return dur(l.unlockAt - D.now);
  }
  function walletBtn(addr, cls) {
    return '<button type="button" class="w-open ' + (cls || "") + '" data-wallet="' + addr + '" aria-label="' + esc(t("row.open", { addr: addr })) + '">' + F.addr(addr) + "</button>";
  }
  function walletTools(addr) {
    return '<button type="button" class="icon-btn" data-copy="' + addr + '" aria-label="' + esc(t("row.copy")) + '" title="' + esc(t("row.copy")) + '">' + I("copy", 16) + "</button>" +
      '<a class="icon-btn" href="' + C.explorer + "/address/" + addr + '" target="_blank" rel="noopener" aria-label="' + esc(t("row.explorer")) + '" title="' + esc(t("row.explorer")) + '">' + I("ext", 16) + "</a>";
  }
  function txLink(hash, key) {
    return '<a class="icon-btn" href="' + C.explorer + "/tx/" + hash + '" target="_blank" rel="noopener" aria-label="' + esc(t(key || "row.tx")) + '" title="' + esc(t(key || "row.tx")) + '">' + I("ext", 16) + "</a>";
  }

  // ---------- live stamp ----------
  function paintStamp() {
    var s = Math.max(0, Math.floor((Date.now() - lastRead) / 1000));
    $("adm-stamp-text").textContent = s < 60 ? t("stamp.s", { n: s }) : t("stamp.m", { n: Math.floor(s / 60) });
    $("adm-stamp").title = t("stamp.title", { time: dt(D.now) });
  }

  // ---------- KPIs ----------
  // count: the exact number behind value, so motion.js can count up to it the first time the tile is seen.
  function kpi(label, value, unit, sub, extra, count, key) {
    var c = count != null && isFinite(count) ? ' data-count="' + count + '" data-count-key="adm-' + key + '"' : "";
    return '<div class="kpi' + (extra ? " " + extra : "") + '"><dt>' + label + "</dt><dd>" +
      '<span class="kpi-v"><span class="num"' + c + ">" + value + "</span>" + (unit ? ' <span class="kpi-u">' + unit + "</span>" : "") + "</span>" +
      '<span class="kpi-sub">' + sub + "</span></dd></div>";
  }
  function renderKpis() {
    var T = D.tot, ct = t("unit.ct_plain"), nW = D.walletList.length, ws = CJ.windowState(), win;
    if (ws === "open") {
      // whole days rounded down, from the shared helper, so swap, status, landing and this tile agree
      var left = CJ.daysLeft ? CJ.daysLeft() : Math.floor((C.windowEnd - D.now) / DAY);
      win = kpi(t("kpi.window"), amt0(left), t(left === 1 ? "n.day.one" : "n.day.other", { n: "" }).trim(), t("kpi.window_sub", { date: dOnly(C.windowEnd), start: dOnly(C.windowStart) }));
    } else if (ws === "closed") win = kpi(t("kpi.window"), t("kpi.window_closed"), "", t("kpi.window_closed_sub", { date: dOnly(C.windowEnd) }));
    else win = kpi(t("kpi.window"), t("kpi.window_upcoming"), "", t("kpi.window_sub", { date: dOnly(C.windowEnd), start: dOnly(C.windowStart) }));
    var od = T.nOverdue > 0;
    // whole CT parts that add up: instant + locked + released = swapped, exactly as on the status page
    var U = T.u, W = CJ.sample.wholeParts([U.instant, U.locked + U.releasing, U.released]), sw = W[0] + W[1] + W[2];
    var reserve = Math.round(SUPPLY - sw);
    // Urgency first: overdue releases lead the grid while there are any; otherwise the tile closes it.
    var overdue = kpi(t("kpi.overdue"), amt0(T.overdue), ct, od ? t("kpi.overdue_sub", { n: pl("n.req", T.nOverdue) }) : t("kpi.overdue_none"), od ? "is-warn" : "");
    $("kpi-grid").innerHTML = (od ? overdue : "") +
      kpi(t("kpi.swapped"), amt0(sw), ct, t("kpi.swapped_sub", { pct: F.pct(sw / SUPPLY, 2), supply: C.newToken.supplyText, n: amt0(D.lots.length) }), "", sw, "swapped") +
      kpi(t("kpi.wallets"), amt0(nW), t("unit.wallets"), t("kpi.wallets_sub", { n: amt0(HOLDERS), pct: F.pct(nW / HOLDERS, 1) }), "", nW, "wallets") +
      kpi(t("kpi.reserve"), amt0(reserve), ct, t("kpi.reserve_sub", { pct: F.pct(reserve / SUPPLY, 2) }), "", reserve, "reserve") +
      win +
      kpi(t("kpi.instant"), amt0(W[0]), ct, t("kpi.instant_sub", { n: amt0(D.lots.length) }), "", W[0], "instant") +
      kpi(t("kpi.locked"), amt0(W[1]), ct, t("kpi.locked_sub", { n: amt0(T.nLocked), m: amt0(T.nReleasing) }), "", W[1], "locked") +
      kpi(t("kpi.released"), amt0(W[2]), ct, t("kpi.released_sub", { k: amt0(T.byKeeper), h: amt0(T.byHolder) }), "", W[2], "released") +
      (od ? "" : overdue);
    renderGas();
  }

  // ---------- gas wallet ----------
  function renderGas() {
    var g = D.gas, low = g.runway < 7, k = t("unit.kaia");
    var runway = kpi(t("gas.runway"), isFinite(g.runway) ? amt0(Math.floor(g.runway)) : "∞", t(Math.floor(g.runway) === 1 ? "n.day.one" : "n.day.other", { n: "" }).trim(),
        t(low ? "gas.runway_low" : "gas.runway_sub", { rate: F.amount(g.rate, 3) }), low ? "is-warn" : "");
    // A short runway is the gas wallet's alarm: it leads the grid.
    $("gas-grid").innerHTML = (low ? runway : "") +
      kpi(t("gas.balance"), F.amount(g.balance, 2), k, t("gas.balance_sub")) + (low ? "" : runway) +
      kpi(t("gas.today"), amt0(g.txToday), t("unit.tx"), t("gas.spent", { kaia: F.amount(g.kaiaToday, 3) })) +
      kpi(t("gas.total"), amt0(g.tx), t("unit.tx"), t("gas.spent", { kaia: F.amount(g.kaia, 3) }));
    $("gas-note").textContent = t("gas.note", { n: pl("n.release", g.releasesToday) });
    // The fee payer's limits come from configuration (CJ.config.sponsor mirrors the server defaults), never from sample data.
    var L = C.sponsor, lim = function (k, v) { return "<div><dt>" + t(k) + '</dt><dd class="num">' + v + "</dd></div>"; };
    $("gas-limits").innerHTML =
      lim("gas.lim.wallet", t("gas.lim.wallet_v", { n: amt0(L.walletTxPerDay) })) +
      lim("gas.lim.budget", t("gas.lim.kaia_v", { n: amt0(L.dailyBudgetKaia) })) +
      lim("gas.lim.floor", t("gas.lim.kaia_v", { n: amt0(L.balanceFloorKaia) })) +
      lim("gas.lim.min", t("gas.lim.min_v", { n: amt0(L.minOldCt) }));
    paintNotesToggles();
  }

  // Phones: KPI tiles show label and figure only; one toggle per panel shows the notes under them (alerts always show theirs).
  function paintNotesToggles() {
    document.querySelectorAll(".kpi-more").forEach(function (b) {
      var on = b.getAttribute("aria-expanded") === "true";
      b.querySelector("span").textContent = t(on ? "kpi.notes_hide" : "kpi.notes_show");
    });
  }
  ["kpi-grid", "gas-grid"].forEach(function (id) {
    var grid = $(id), b = document.createElement("button");
    b.type = "button"; b.className = "kpi-more"; b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", id);
    b.innerHTML = "<span></span>" + I("chevron", 16);
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(on)); grid.classList.toggle("show-notes", on); paintNotesToggles();
    });
    grid.parentNode.insertBefore(b, grid.nextSibling);
  });

  // Phones: "Top wallets" and "Large swap watch" sit under the long request list, so each opens on request.
  // Wide screens hide the toggle and always show the body (admin.css).
  document.querySelectorAll(".adm-coll-btn").forEach(function (b) {
    b.insertAdjacentHTML("beforeend", I("chevron", 16));
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(on)); b.closest(".adm-coll").classList.toggle("is-open", on);
      b.firstChild.textContent = t(on ? b.dataset.hide : b.dataset.show);
    });
  });
  document.addEventListener("cj:lang", function () {
    document.querySelectorAll(".adm-coll-btn").forEach(function (b) { b.firstChild.textContent = t(b.getAttribute("aria-expanded") === "true" ? b.dataset.hide : b.dataset.show); });
  });

  // ---------- bar chart (inline SVG, one series, keyboard and pointer readout) ----------
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    var step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return step * p;
  }
  function tick(v) { return v >= 10000 ? F.compact(v) : amt0(v); }
  function barChart(host, data, opts) {
    var W = Math.max(280, host.clientWidth || 600), H = opts.height || 200;
    var padL = 48, padR = 8, padT = 22, padB = 28, iw = W - padL - padR, ih = H - padT - padB;
    var max = 0; data.forEach(function (d) { if (d.v > max) max = d.v; });
    var top = niceMax(max), band = iw / data.length, bw = Math.min(24, Math.max(4, band - 6));
    var y = function (v) { return padT + ih - (v / top) * ih; };
    var every = Math.max(1, Math.ceil(52 / band));
    var s = '<svg class="bars" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">';
    [0, top / 2, top].forEach(function (v) {
      var yy = Math.round(y(v)) + 0.5;
      s += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/>';
      s += '<text class="axis" x="' + (padL - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + tick(v) + "</text>";
    });
    var maxI = -1; data.forEach(function (d, i) { if (d.v === max && max > 0 && maxI < 0) maxI = i; });
    data.forEach(function (d, i) {
      var cx = padL + band * i + band / 2, x0 = cx - bw / 2;
      s += '<rect class="band" data-i="' + i + '" x="' + (padL + band * i) + '" y="' + padT + '" width="' + band + '" height="' + ih + '"/>';
      if (d.v > 0) {
        var h = Math.max(2, (d.v / top) * ih), yb = padT + ih, yt = yb - h, r = Math.min(4, h / 2, bw / 2);
        s += '<path class="bar' + (d.partial ? " is-partial" : "") + '" d="M' + x0 + " " + yb + "V" + (yt + r) + "Q" + x0 + " " + yt + " " + (x0 + r) + " " + yt + "H" + (x0 + bw - r) + "Q" + (x0 + bw) + " " + yt + " " + (x0 + bw) + " " + (yt + r) + "V" + yb + 'Z"/>';
        if (i === maxI) s += '<text class="val" x="' + cx + '" y="' + (yt - 6) + '" text-anchor="middle">' + tick(d.v) + "</text>";
      }
      if (i % every === 0 || i === data.length - 1 && (data.length - 1) % every > every / 2) s += '<text class="axis" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + "</text>";
    });
    s += '<line class="base" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih + 0.5) + '" y2="' + (padT + ih + 0.5) + '"/></svg>';
    host.innerHTML = s + '<div class="tip" hidden></div><p class="sr-only" aria-live="polite"></p>';
    host.setAttribute("tabindex", "0");
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", opts.label);
    var svg = host.querySelector("svg"), tip = host.querySelector(".tip"), live = host.querySelector("[aria-live]"), active = -1;
    function show(i, announce) {
      active = i;
      host.querySelectorAll(".band").forEach(function (b, j) { b.classList.toggle("is-on", j === i); });
      if (i < 0) { tip.hidden = true; return; }
      var d = data[i];
      tip.innerHTML = '<strong class="num">' + esc(d.tip1) + "</strong><span>" + esc(d.tip2) + "</span>";
      tip.hidden = false;
      var cx = padL + band * i + band / 2, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(W - tw, cx - tw / 2)) + "px";
      if (announce) live.textContent = d.tip2 + ": " + d.tip1;
    }
    svg.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width) - padL;
      var i = Math.floor(x / band); show(i >= 0 && i < data.length ? i : -1);
    });
    svg.addEventListener("pointerleave", function () { if (document.activeElement !== host) show(-1); });
    host.onkeydown = function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault(); show(Math.max(0, Math.min(data.length - 1, (active < 0 ? 0 : active + (e.key === "ArrowRight" ? 1 : -1)))), true);
      } else if (e.key === "Home") { e.preventDefault(); show(0, true); }
      else if (e.key === "End") { e.preventDefault(); show(data.length - 1, true); }
    };
    host.onfocus = function () { if (active < 0) show(0, false); };
    host.onblur = function () { show(-1); };
  }
  function tableView(cols, rows) {
    return '<table class="table tv"><thead><tr>' + cols.map(function (c, i) { return "<th" + (i ? ' class="r"' : "") + ' scope="col">' + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return i ? '<td class="r num">' + c + "</td>" : '<th scope="row">' + esc(c) + "</th>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
  }

  // ---------- unlock schedule ----------
  function renderUnlock() {
    var n = D.now, today = Math.floor(n / DAY) * DAY, days = [];
    // 7 days: the lock is 7 days, so nothing unlocks after that.
    for (var i = 0; i < C.lockDays + 1; i++) days.push({ start: today + i * DAY, v: 0, c: 0 });
    var soonAmt = 0, soonN = 0, total = 0;
    D.lots.forEach(function (l) {
      if (l.status !== "locked") return;
      var i = Math.floor((l.unlockAt - today) / DAY);
      if (i >= 0 && i < days.length) { days[i].v += l.locked; days[i].c++; total += l.locked; }
      if (l.unlockAt - n <= DAY) { soonAmt += l.locked; soonN++; }
    });
    var soon = $("unl-soon");
    soon.className = "adm-soon" + (soonN ? " is-on" : "");
    soon.innerHTML = I("clock", 18) + "<span>" + (soonN ? t("unl.soon", { amount: '<strong class="num">' + amt0(soonAmt) + "</strong>", req: pl("n.req", soonN) }) : t("unl.soon_none")) + "</span>";
    var data = days.map(function (d, i) {
      return { v: d.v, label: dShort(d.start), tip1: amt0(d.v) + " CT", tip2: dOnly(d.start) + (i === 0 ? ", " + t("unl.today") : "") + ", " + pl("n.req", d.c) };
    });
    barChart($("unl-chart"), data, { label: t("unl.chart") });
    var lastUnlock = 0; D.lots.forEach(function (l) { if (l.status === "locked" && l.unlockAt > lastUnlock) lastUnlock = l.unlockAt; });
    $("unl-foot").textContent = t("unl.foot", { date: dOnly(lastUnlock || n), amount: amt0(total) });
    $("unl-table").innerHTML = tableView([t("unl.col.day"), t("unl.col.amount"), t("unl.col.count")], days.map(function (d) { return [dOnly(d.start), amt0(d.v), amt0(d.c)]; }));
  }

  // ---------- daily requests ----------
  var measure = "ct";
  function renderDaily() {
    var n = D.now, today = Math.floor(n / DAY) * DAY, startDay = Math.max(C.windowStart, today - 29 * DAY);
    var len = Math.round((today - startDay) / DAY) + 1, days = [];
    for (var i = 0; i < len; i++) days.push({ start: startDay + i * DAY, v: 0, c: 0 });
    D.lots.forEach(function (l) { var i = Math.floor((l.swappedAt - startDay) / DAY); if (i >= 0 && i < len) { days[i].v += l.amount; days[i].c++; } });
    $("day-sub").textContent = len >= 30 ? t("day.sub30") : t("day.subshort", { date: dOnly(C.windowStart), n: len });
    document.querySelectorAll("#day-measure .seg-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.measure === measure)); });
    var key = measure === "ct" ? "v" : "c", tot = 0, best = days[0];
    days.forEach(function (d) { tot += d[key]; if (d[key] > best[key]) best = d; });
    $("day-sum").textContent = measure === "ct" ? t("day.sum_ct", { amount: amt0(tot), day: dShort(best.start), max: amt0(best.v) }) : t("day.sum_count", { n: amt0(tot), day: dShort(best.start), max: amt0(best.c) });
    var data = days.map(function (d, i) {
      var last = i === len - 1;
      return { v: d[key], partial: last, label: dShort(d.start), tip1: measure === "ct" ? amt0(d.v) + " CT" : pl("n.req", d.c), tip2: dOnly(d.start) + (last ? ", " + t("day.so_far") : "") + (measure === "ct" ? ", " + pl("n.req", d.c) : ", " + amt0(d.v) + " CT") };
    });
    barChart($("day-chart"), data, { label: t(measure === "ct" ? "day.chart_ct" : "day.chart_count") });
    $("day-foot").textContent = t("day.foot", { time: tOnly(n) + " UTC" });
    $("day-table").innerHTML = tableView([t("day.col.day"), t("day.col.ct"), t("day.col.count")], days.map(function (d) { return [dOnly(d.start), amt0(d.v), amt0(d.c)]; }));
  }

  // ---------- swap requests table ----------
  var S = { q: "", status: "all", amt: 0, range: "all", key: "requested", dir: "desc", page: 1 };
  var STATUS_ORDER = { locked: 0, releasing: 1, released: 2 };
  var COLS = [
    { k: "wallet", label: "col.wallet", dir: "asc", v: function (l) { return l.wallet; } },
    { k: "amount", label: "col.amount", r: true, dir: "desc", v: function (l) { return l.amount; } },
    { k: "instant", label: "col.instant", r: true, dir: "desc", v: function (l) { return l.instant; } },
    { k: "locked", label: "col.locked", r: true, dir: "desc", v: function (l) { return l.locked; } },
    { k: "requested", label: "col.requested", dir: "desc", v: function (l) { return l.swappedAt; } },
    { k: "unlocks", label: "col.unlocks", dir: "asc", v: function (l) { return l.unlockAt; } },
    { k: "left", label: "col.left", dir: "asc", v: function (l) { return l.status === "locked" ? l.unlockAt - D.now : l.status === "releasing" ? l.unlockAt - D.now : 1e15 + l.releasedAt; } },
    { k: "status", label: "col.status", dir: "asc", v: function (l) { return STATUS_ORDER[l.status] * 1e14 + l.unlockAt; } },
    { k: "tx", label: "col.tx", nosort: true }
  ];
  function filtered() {
    var q = S.q.trim().toLowerCase(), since = S.range === "all" ? -Infinity : D.now - (+S.range) * DAY;
    var rows = D.lots.filter(function (l) {
      if (S.status !== "all" && l.status !== S.status) return false;
      if (l.amount < S.amt) return false;
      if (l.swappedAt < since) return false;
      if (q && l.wallet.indexOf(q) < 0 && l.txSwap.indexOf(q) < 0 && (!l.txRelease || l.txRelease.indexOf(q) < 0)) return false;
      return true;
    });
    var col = COLS.filter(function (c) { return c.k === S.key; })[0], m = S.dir === "asc" ? 1 : -1;
    rows.sort(function (a, b) { var x = col.v(a), y = col.v(b); return (x < y ? -1 : x > y ? 1 : b.id - a.id) * m; });
    return rows;
  }
  function renderHead() {
    $("lots-head").innerHTML = COLS.map(function (c) {
      var cls = (c.r ? "r " : "") + "c-" + c.k;
      if (c.nosort) return '<th scope="col" class="' + cls + '">' + t(c.label) + "</th>";
      var on = S.key === c.k, sort = on ? (S.dir === "asc" ? "ascending" : "descending") : "none";
      return '<th scope="col" class="' + cls + '" aria-sort="' + sort + '"><button type="button" class="sort-btn' + (on ? " is-on is-" + S.dir : "") + '" data-sort="' + c.k + '">' +
        "<span>" + esc(t(c.label)).replace(/\s?\((CT|UTC)\)$/, "<br>($1)") + "</span>" + SORT_ICO + "</button></th>";
    }).join("");
  }
  var SORT_OPTS = ["requested.desc", "requested.asc", "amount.desc", "amount.asc", "locked.desc", "unlocks.asc", "unlocks.desc", "left.asc", "status.asc", "status.desc", "wallet.asc"];
  function renderSortSelect() {
    var cur = S.key + "." + S.dir, sel = $("lots-sort");
    var opts = SORT_OPTS.indexOf(cur) < 0 ? SORT_OPTS.concat([cur]) : SORT_OPTS;
    sel.innerHTML = opts.map(function (o) {
      var label = SORT_OPTS.indexOf(o) > -1 ? t("sort." + o) : t("sort.by", { col: t(COLS.filter(function (c) { return c.k === S.key; })[0].label) });
      return '<option value="' + o + '"' + (o === cur ? " selected" : "") + ">" + esc(label) + "</option>";
    }).join("");
  }
  function cell(col, html, cls) { return '<td class="' + (cls || "") + '" data-label="' + esc(t(col)) + '">' + html + "</td>"; }
  function renderTable() {
    var rows = filtered(), total = rows.length, pages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (S.page > pages) S.page = pages;
    var from = (S.page - 1) * PER_PAGE, slice = rows.slice(from, from + PER_PAGE), sum = 0;
    rows.forEach(function (l) { sum += l.amount; });
    renderHead(); renderSortSelect();
    ["f-status", "f-amt", "f-range"].forEach(function (id) {
      var cur = String(id === "f-status" ? S.status : id === "f-amt" ? S.amt : S.range);
      document.querySelectorAll("#" + id + " .seg-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === cur)); });
    });
    $("lots-export-label").textContent = !total ? t("lots.export_none") : total === D.lots.length ? t(total === 1 ? "lots.export_all.one" : "lots.export_all.other", { n: amt0(total) })
      : t(total === 1 ? "lots.export_some.one" : "lots.export_some.other", { n: amt0(total) });
    $("lots-export").disabled = !total;
    $("lots-count").innerHTML = '<span class="num">' + t("lots.count", { n: amt0(total), total: amt0(D.lots.length), amount: amt0(sum) }) + "</span>" +
      (total ? ' <span class="muted">' + t("lots.count_page", { from: amt0(from + 1), to: amt0(from + slice.length) }) + "</span>" : "");
    if (!total) {
      $("lots-body").innerHTML = '<tr class="empty"><td colspan="' + COLS.length + '"><div class="lots-empty"><p>' + t("lots.empty") + '</p><button type="button" class="btn" id="lots-clear">' + t("lots.clear") + "</button></div></td></tr>";
    } else {
      $("lots-body").innerHTML = slice.map(function (l) {
        return '<tr class="row-' + l.status + ' row-open" data-row-wallet="' + l.wallet + '">' +
          cell("col.wallet", '<div class="w-cell">' + walletBtn(l.wallet) + '<span class="w-tools">' + walletTools(l.wallet) + "</span></div>", "c-wallet") +
          cell("col.amount", '<span class="num amt">' + amt(l.amount) + '</span><span class="amt-u"> ' + t("unit.ct_plain") + "</span>", "r c-amount") +
          cell("col.instant", '<span class="num">' + amt(l.instant) + "</span>", "r c-instant") +
          cell("col.locked", '<span class="num">' + amt(l.locked) + "</span>", "r c-locked") +
          cell("col.requested", '<span class="dt"><span class="num">' + dOnly(l.swappedAt) + '</span><span class="num muted">' + tOnly(l.swappedAt) + "</span></span>", "c-requested") +
          cell("col.unlocks", '<span class="dt"><span class="num">' + dOnly(l.unlockAt) + '</span><span class="num muted">' + tOnly(l.unlockAt) + "</span></span>", "c-unlocks") +
          cell("col.left", '<span class="num left-' + l.status + ((l.status === "locked" && l.unlockAt - D.now <= DAY) || l.overdue ? " is-soon" : "") + '">' +
            (l.status === "locked" ? '<span class="left-d">' + leftText(l) + '</span><span class="left-m">' + t("left.locked_m", { time: leftText(l) }) + "</span>" : leftText(l)) + "</span>", "c-left") +
          cell("col.status", '<span class="st-cell">' + statusTag(l.status) + byLine(l) + "</span>", "c-status") +
          cell("col.tx", txLink(l.txSwap), "c-tx") + "</tr>";
      }).join("");
    }
    renderPager(pages);
  }
  function renderPager(pages) {
    var p = S.page, list = [];
    for (var i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - p) <= 1) list.push(i); else if (list[list.length - 1] !== "…") list.push("…");
    $("lots-pager").innerHTML =
      '<button type="button" class="btn pg-btn" data-pg="' + (p - 1) + '"' + (p <= 1 ? " disabled" : "") + ">" + '<span class="pg-flip">' + I("chevron", 16) + "</span><span>" + t("pg.prev") + "</span></button>" +
      '<span class="pg-nums">' + list.map(function (i) {
        return i === "…" ? '<span class="pg-gap" aria-hidden="true">…</span>' :
          '<button type="button" class="pg-num" data-pg="' + i + '"' + (i === p ? ' aria-current="page"' : "") + ' aria-label="' + esc(t("pg.page", { n: i })) + '">' + i + "</button>";
      }).join("") + "</span>" +
      '<span class="pg-of small muted">' + t("pg.of", { n: p, total: pages }) + "</span>" +
      '<button type="button" class="btn pg-btn" data-pg="' + (p + 1) + '"' + (p >= pages ? " disabled" : "") + "><span>" + t("pg.next") + "</span>" + I("chevron", 16) + "</button>";
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCsv() {
    var rows = filtered();
    var head = ["lot_id", "wallet", "wallet_lot", "swapped_old_ct", "instant_new_ct", "locked_new_ct", "requested_at_utc", "unlocks_at_utc", "status", "overdue",
      "released_at_utc", "released_by", "fee_paid_by", "swap_tx", "release_tx"];
    var lines = [head.join(",")].concat(rows.map(function (l) {
      return [l.id, l.wallet, l.n, l.amount, l.instant, l.locked, iso(l.swappedAt), iso(l.unlockAt), l.status, l.overdue ? "yes" : "no",
        iso(l.releasedAt), l.releasedBy || "", l.kind === "mm" ? "holder" : "cojam", l.txSwap, l.txRelease || ""].map(csvCell).join(",");
    }));
    var blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"), d = new Date(D.now).toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
    a.href = URL.createObjectURL(blob); a.download = "cojam-swap-requests-" + d + "Z.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    CJ.toast(t("lots.exported", { n: amt0(rows.length) }));
  }

  // ---------- top wallets ----------
  function renderTop() {
    var list = D.walletList.slice().sort(function (a, b) { return b.total - a.total; }).slice(0, 10), sw = D.tot.swapped || 1, topSum = 0;
    list.forEach(function (w) { topSum += w.total; });
    $("top-sub").textContent = t("top.sub", { pct: F.pct(topSum / sw, 1) });
    var maxShare = list.length ? list[0].total / sw : 1;
    $("top-table").innerHTML = '<thead><tr><th scope="col" class="r c-rank">' + t("top.col.rank") + '</th><th scope="col">' + t("top.col.wallet") + '</th><th scope="col" class="r">' + t("top.col.amount") +
      '</th><th scope="col" class="c-share">' + t("top.col.share") + '</th><th scope="col" class="r c-lots">' + t("top.col.lots") + "</th></tr></thead><tbody>" +
      list.map(function (w, i) {
        var share = w.total / sw;
        // .top-u shows the unit beside the figure only in the stacked phone layout, where the column header is hidden.
        return '<tr><td class="r num muted c-rank">' + (i + 1) + '</td><td class="c-wallet">' + walletBtn(w.addr) + '</td><td class="r num c-amt">' + amt0(w.total) +
          ' <span class="top-u">' + t("unit.ct_plain") + "</span></td>" +
          '<td class="c-share"><span class="share"><span class="share-bar" aria-hidden="true"><span style="width:' + (share / maxShare * 100).toFixed(1) + '%"></span></span><span class="num">' + F.pct(share, 1) + "</span></span></td>" +
          '<td class="r num c-lots">' + w.lots.length + "</td></tr>";
      }).join("") + "</tbody>";
  }

  // ---------- large swap watch ----------
  var threshold = 10000000;
  try { var saved = parseFloat(localStorage.getItem(BIG_KEY)); if (saved > 0) threshold = saved; } catch (e) {}
  function renderBig() {
    var inp = $("big-input");
    if (document.activeElement !== inp) inp.value = amt0(threshold);
    var rows = D.lots.filter(function (l) { return l.amount >= threshold; }).sort(function (a, b) { return b.swappedAt - a.swappedAt; }), tot = 0;
    rows.forEach(function (l) { tot += l.amount; });
    $("big-sum").innerHTML = rows.length ? t("big.sum", { n: pl("n.req", rows.length), amount: amt0(threshold), total: amt0(tot) }) : t("big.sum_none", { amount: amt0(threshold) });
    var shown = rows.slice(0, 8);
    $("big-list").innerHTML = shown.map(function (l) {
      return '<li class="big-item lift-row"><span class="big-ico">' + I("swap", 16) + '</span>' +
        '<div class="big-main"><span class="big-amt"><span class="num">' + amt0(l.amount) + '</span> <span class="kpi-u">CT</span></span>' +
        '<span class="big-meta small muted"><span class="num">' + dt(l.swappedAt) + "</span></span></div>" +
        '<div class="big-side">' + walletBtn(l.wallet) + statusTag(l.status) + "</div></li>";
    }).join("") + (rows.length > shown.length ? '<li class="big-more small muted">' + t("big.more", { n: amt0(rows.length - shown.length) }) + "</li>" : "");
  }
  function setThreshold(raw) {
    var p = CJ.parseAmount(raw), msg = $("big-msg"), box = $("big-input").parentNode;
    if (!p.ok) { msg.textContent = t("big.bad"); msg.classList.add("is-error"); box.classList.add("is-error"); $("big-input").setAttribute("aria-invalid", "true"); return; }
    msg.textContent = ""; msg.classList.remove("is-error"); box.classList.remove("is-error"); $("big-input").removeAttribute("aria-invalid");
    threshold = p.value;
    try { localStorage.setItem(BIG_KEY, String(threshold)); } catch (e) {}
    renderBig();
  }

  // ---------- wallet sheet ----------
  var sheet = $("sheet"), opener = null, sheetWallet = null;
  function renderSheet() {
    var w = D.wallets[sheetWallet]; if (!w) return;
    var first = w.lots[0].swappedAt, lots = w.lots.slice().sort(function (a, b) { return b.swappedAt - a.swappedAt; });
    var stat = function (k, v, unit) { return '<div class="ss"><dt>' + t(k) + '</dt><dd><span class="num">' + v + "</span>" + (unit ? ' <span class="kpi-u">' + unit + "</span>" : "") + "</dd></div>"; };
    $("sheet-body").innerHTML =
      '<div class="sheet-addr"><span class="sheet-addr-v">' + w.addr + '</span><span class="w-tools">' + walletTools(w.addr) + "</span></div>" +
      '<dl class="sheet-stats">' +
        stat("sheet.total", amt(w.total), "CT") + stat("sheet.lots", w.lots.length) +
        stat("sheet.instant", amt(w.instant), "CT") + stat("sheet.locked", amt(w.locked + w.releasing), "CT") +
        stat("sheet.released", amt(w.released), "CT") + stat("sheet.share", F.pct(w.total / (D.tot.swapped || 1), 2)) +
        stat("sheet.first", dt(first)) +
      "</dl>" +
      '<h3 class="sheet-h3">' + t("sheet.lots_h") + "</h3>" +
      '<ol class="sheet-lots">' + lots.map(function (l) {
        return '<li class="sheet-lot"><div class="sheet-lot-head"><span class="sheet-lot-n">' + t("sheet.lot", { n: l.n }) + "</span>" + statusTag(l.status) + "</div>" +
          '<div class="sheet-track" data-lot="' + l.id + '"></div>' +
          '<div class="sheet-lot-meta small"><span class="muted num">' + t("sheet.requested", { time: dt(l.swappedAt) }) + "</span>" +
          '<span class="sheet-txs"><span class="sheet-tx">' + t("sheet.swap_tx") + txLink(l.txSwap) + "</span>" +
          (l.txRelease ? '<span class="sheet-tx">' + t("sheet.release_tx") + txLink(l.txRelease, "row.release_tx") + "</span>" : "") + "</span></div></li>";
      }).join("") + "</ol>";
    lots.forEach(function (l) { CJ.track($("sheet-body").querySelector('[data-lot="' + l.id + '"]'), l); });
  }
  function openSheet(addr, from) {
    sheetWallet = addr; opener = from || document.activeElement;
    renderSheet();
    if (!sheet.open) { if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", ""); }
    sheet.querySelector(".sheet-body").scrollTop = 0;
    $("sheet-close").focus();
  }
  function closeSheet() { if (sheet.open) { if (sheet.close) sheet.close(); else { sheet.removeAttribute("open"); onClosed(); } } }
  function onClosed() {
    sheetWallet = null;
    // Return focus to the control that opened the sheet; if a re-render replaced it, to the same wallet's button.
    var target = opener && document.body.contains(opener) ? opener : (opener && opener.dataset && document.querySelector('[data-wallet="' + opener.dataset.wallet + '"]'));
    if (target) target.focus();
  }
  sheet.addEventListener("close", onClosed);
  sheet.addEventListener("click", function (e) { if (e.target === sheet) closeSheet(); });
  $("sheet-close").addEventListener("click", closeSheet);
  // Keep Tab inside the sheet (showModal makes the page inert; this also covers browsers without it).
  sheet.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var f = [].slice.call(sheet.querySelectorAll("button, a[href], input, [tabindex]:not([tabindex='-1'])")).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
    if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });

  // ---------- render all ----------
  function renderAll() {
    renderKpis(); renderUnlock(); renderDaily(); renderTable(); renderTop(); renderBig(); paintStamp();
    if (sheetWallet) renderSheet();
  }

  // ---------- events ----------
  $("adm-note-ico").outerHTML = I("info", 18);
  $("adm-refresh-ico").outerHTML = I("refresh", 18);
  $("lots-export-ico").outerHTML = DL_ICO;
  $("lots-search-ico").outerHTML = SEARCH_ICO;
  $("sheet-close").innerHTML = I("x", 20);

  document.addEventListener("click", function (e) {
    var w = e.target.closest("[data-wallet]");
    if (w) { openSheet(w.dataset.wallet, w); return; }
    // A click anywhere else on a request row opens its wallet too (links and buttons in the row keep their own action).
    var row = e.target.closest("tr[data-row-wallet]");
    if (row && !e.target.closest("a, button, input, select") && !(window.getSelection && String(window.getSelection()))) {
      openSheet(row.dataset.rowWallet, row.querySelector("[data-wallet]")); return;
    }
    var s = e.target.closest("[data-sort]");
    if (s) {
      var k = s.dataset.sort;
      if (S.key === k) S.dir = S.dir === "asc" ? "desc" : "asc";
      else { S.key = k; S.dir = COLS.filter(function (c) { return c.k === k; })[0].dir; }
      S.page = 1; renderTable();
      var again = document.querySelector('[data-sort="' + k + '"]'); if (again) again.focus();
      return;
    }
    var pg = e.target.closest("[data-pg]");
    if (pg && !pg.disabled) {
      S.page = +pg.dataset.pg; renderTable();
      $("lots-h").scrollIntoView({ block: "start" });
      var cur = document.querySelector('#lots-pager [aria-current="page"]'); if (cur) cur.focus({ preventScroll: true });
      return;
    }
    var seg = e.target.closest("#f-status .seg-btn, #f-amt .seg-btn, #f-range .seg-btn");
    if (seg) {
      var g = seg.parentNode.id;
      if (g === "f-status") S.status = seg.dataset.v; else if (g === "f-amt") S.amt = +seg.dataset.v; else S.range = seg.dataset.v;
      S.page = 1; renderTable(); return;
    }
    var m = e.target.closest("#day-measure .seg-btn");
    if (m) { measure = m.dataset.measure; renderDaily(); return; }
    if (e.target.closest("#lots-clear")) { S.q = ""; $("lots-q").value = ""; S.status = "all"; S.amt = 0; S.range = "all"; S.page = 1; renderTable(); $("lots-q").focus(); }
  });
  var qTimer;
  $("lots-q").addEventListener("input", function () { clearTimeout(qTimer); var v = this.value; qTimer = setTimeout(function () { S.q = v; S.page = 1; renderTable(); }, 120); });
  $("lots-export").addEventListener("click", exportCsv);
  // "/" focuses the search, unless the admin is already typing somewhere.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
    e.preventDefault(); $("lots-q").focus(); $("lots-q").select();
  });
  $("lots-sort").addEventListener("change", function () { var p = this.value.split("."); S.key = p[0]; S.dir = p[1]; S.page = 1; renderTable(); });
  $("big-input").addEventListener("change", function () { setThreshold(this.value); });
  $("big-input").addEventListener("keydown", function (e) { if (e.key === "Enter") setThreshold(this.value); });
  $("big-input").addEventListener("blur", function () { if (!this.getAttribute("aria-invalid")) this.value = amt0(threshold); });
  $("adm-refresh").addEventListener("click", function () {
    derive(); renderAll();
    var dot = document.querySelector("#adm-stamp .live-dot"); if (dot) { dot.classList.remove("is-tick"); void dot.offsetWidth; dot.classList.add("is-tick"); }
    $("adm-status").textContent = t("head.refreshed", { time: dt(D.now) });
  });
  document.addEventListener("cj:lang", renderAll);
  // Crossing the card breakpoint changes the page size; keep the first visible request on screen.
  function onCards() {
    var first = (S.page - 1) * PER_PAGE;
    PER_PAGE = mqCards.matches ? 10 : 25; S.page = Math.floor(first / PER_PAGE) + 1; renderTable();
  }
  if (mqCards.addEventListener) mqCards.addEventListener("change", onCards); else if (mqCards.addListener) mqCards.addListener(onCards);

  var rTimer, lastW = { unl: 0, day: 0 };
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      clearTimeout(rTimer);
      rTimer = setTimeout(function () {
        var a = $("unl-chart").clientWidth, b = $("day-chart").clientWidth;
        if (a !== lastW.unl) { lastW.unl = a; renderUnlock(); }
        if (b !== lastW.day) { lastW.day = b; renderDaily(); }
      }, 120);
    }).observe(document.querySelector(".adm-charts"));
  }

  derive();
  renderAll();
  CJ.ready();
  setInterval(paintStamp, 1000);
})();
