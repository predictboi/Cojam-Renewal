// Status page: public swap dashboard. Live (CJ.live): every figure is read from the swap contract and its events on
// CJ.net through CJ.liveStats (live-stats.js), refreshed every 15 seconds. Mock (?mock=1, a ?state= preset, or no
// deployed swap): CJ.sample (system.js), the same seeded set the admin monitor reads. Both give the same shape.
// Sums are taken in micro CT integers and rounded once, so the parts always add up.
// ?state=loading keeps the skeleton; ?state=error shows "Could not reach Kaia" with Retry. Live, a failed read shows the same.
(function () {
  var C = CJ.config, DAY = CJ.DAY, SUPPLY = C.newToken.supply, SUPPLY_TEXT = C.newToken.supplyText;
  var LS = CJ.live && CJ.liveStats ? CJ.liveStats : null, LIVE = !!CJ.live, LIVE_S = null;
  // The real clock when live; the mock clock (CJ.now, ?days=) for design review.
  function rel(ts) { return LS ? LS.rel(ts) : F.rel(ts); }
  function winState() { return LS ? LS.windowState() : CJ.windowState(); }
  // UTC midnight of the day the window opened: daily buckets are UTC days (the live window opens at the deploy second).
  function day0() { return Math.floor(C.windowStart / DAY) * DAY; }
  var $ = function (id) { return document.getElementById(id); };
  var t = CJ.t, F = CJ.fmt, I = CJ.icon;
  var VIEW_KEY = "cj.status.view";
  var REFRESH = 15000, STALE_MIN = 14;
  var mode = CJ.state === "loading" ? "loading" : CJ.state === "error" ? "error" : "live";
  function loc() { return { en: "en-US", ko: "ko-KR", ja: "ja-JP" }[CJ.lang()] || "en-US"; }
  function cmp(n) { return new Intl.NumberFormat(loc(), { notation: "compact", maximumFractionDigits: 1 }).format(n); }
  function whole(n) { return F.amount(n, 0); }
  // A share that rounds to zero but is not zero reads "<0.1%", never "0%" (the first live swaps are tiny next to the supply).
  function pctMin(x, dp) { var min = Math.pow(10, -(dp + 2)); return x > 0 && x < min / 2 ? "<" + F.pct(min, dp) : F.pct(x, dp); }
  // Activity amounts: whole CT from 1,000 up, two fixed decimals below, the same rule everywhere on the page.
  function amtR(n) { return n >= 1000 ? whole(n) : new Intl.NumberFormat(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); }
  // Days left to swap: whole days rounded down, the same figure as the swap app, the landing and the admin monitor.
  function daysLeft(now) { return LS ? LS.daysLeft() : CJ.daysLeft ? CJ.daysLeft() : Math.max(0, Math.floor((C.windowEnd - now) / DAY)); }
  function shortDate(ts) { return new Intl.DateTimeFormat(loc(), { month: "short", day: "numeric", timeZone: "UTC" }).format(ts); }
  function hm(ts) { return new Intl.DateTimeFormat(loc(), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(ts); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- model: everything the page shows, from the shared sample ----------
  function model() {
    var S = LIVE ? LIVE_S : CJ.sample.state(), U = S.tot.u, n = S.now, supply = S.supply || SUPPLY;
    // headline parts, in whole new CT: instant + locked (still locked or being sent) + released = swapped (the new CT the
    // swaps gave, at the 0.4 rate). swappedOld: the old CT swapped in. Shares of supply are of the new supply.
    // The parts sum exactly to the credited total (totalCredited live), rounded once to whole CT.
    var W = CJ.sample.wholeParts([U.instant, U.locked + U.releasing, U.released], U.credit != null ? Math.round(U.credit / 1e6) : null);
    var swapped = W[0] + W[1] + W[2], reserve = Math.round(supply - swapped), swappedOld = Math.round(U.swapped / 1e6);
    // the aggregate track: tick 1 = swapped in the last 24 hours, tick 7 = unlocks in the next 24 hours
    var ticksU = [0, 0, 0, 0, 0, 0, 0];
    S.lots.forEach(function (l) {
      if (l.status !== "locked") return;
      var i = Math.min(6, Math.max(0, Math.floor((n - l.swappedAt) / DAY)));
      ticksU[i] += Math.round(l.locked * 1e6);
    });
    // the locked figure split exactly into its 7 lock days and the part already unlocked and being sent
    var lockParts = CJ.sample.wholeParts(ticksU.concat([U.releasing]), W[1]);
    // per day volume since the window opened, today counted so far
    var days = [], byDay = {};
    S.lots.forEach(function (l) {
      var d = Math.floor((l.swappedAt - day0()) / DAY), b = byDay[d] || (byDay[d] = { u: 0, w: {} });
      b.u += Math.round(l.amount * 1e6); b.w[l.wallet] = 1;
    });
    var today = Math.floor((Math.min(n, C.windowEnd) - day0()) / DAY);
    for (var d = 0; d <= today; d++) {
      var b = byDay[d] || { u: 0, w: {} };
      days.push({ d: d, start: day0() + d * DAY, vol: b.u / 1e6, holders: Object.keys(b.w).length, partial: d === today && n < C.windowEnd });
    }
    // recent activity: swaps and releases, newest first
    var events = [];
    S.lots.forEach(function (l) {
      events.push({ type: "swap", at: l.swappedAt, lot: l, amount: l.amount, tx: l.txSwap });
      if (l.releasedAt) events.push({ type: "release", at: l.releasedAt, lot: l, amount: l.locked, tx: l.txRelease });
    });
    events.sort(function (a, b) { return b.at - a.at; });
    var shares = CJ.sample.shares([W[0] + W[2], W[1], Math.max(0, reserve)], 1);
    return {
      now: n, swapped: swapped, swappedOld: swappedOld, instant: W[0], locked: W[1], released: W[2], reserve: reserve,
      ticks: lockParts.slice(0, 7), sending: lockParts[7], holders: S.walletList.length, oldHolders: S.holders,
      days: days, events: events.slice(0, 8), gas: S.gas, shares: shares,
      supply: supply, supplyText: S.supplyText || SUPPLY_TEXT, chain: S.chain || null
    };
  }

  // ---------- head, live stamp, error ----------
  var lastRead = 0, M = null;
  function paintHead() {
    if (LIVE && !M) { $("st-window").innerHTML = mode === "loading" ? sk("22em") : ""; return; } // the window is read from the chain
    var closed = winState() === "closed";
    $("st-window").textContent = t(closed ? "status.window.closed" : "status.window.open", { start: F.date(C.windowStart), end: F.date(C.windowEnd) });
  }
  function paintLive() {
    var el = $("st-live-text"), dot = $("st-live-dot");
    dot.classList.toggle("is-stale", mode !== "live");
    if (mode === "loading") { el.textContent = t("status.live.loading"); return; }
    if (mode === "error") { el.textContent = lastRead ? t("status.live.stale", { time: hm(lastRead) + " UTC" }) : t("status.live.none"); return; }
    el.textContent = t("status.live.updated", { rel: LS ? LS.rel(lastRead) : F.rel(CJ.now() - (Date.now() - lastRead)) });
  }
  function tick() { var dot = $("st-live-dot"); dot.classList.remove("is-tick"); void dot.offsetWidth; dot.classList.add("is-tick"); }
  function paintError() {
    var box = $("st-error");
    box.hidden = mode !== "error";
    if (mode === "error") $("st-error-text").textContent = lastRead ? t("status.error.body", { time: hm(lastRead) + " UTC" }) : t("status.error.body_none");
  }
  // Live: the sample note becomes the network stamp while on the testnet; a mainnet read needs no note.
  function paintNote() {
    var box = document.querySelector(".st-sample");
    if (!box || !LIVE) return;
    box.hidden = !CJ.net.testnet;
    var title = box.querySelector('[data-i18n="status.sample.title"], [data-live="title"]'), body = box.querySelector('[data-i18n="status.sample.body"], [data-live="body"]');
    if (title) { title.removeAttribute("data-i18n"); title.setAttribute("data-live", "title"); title.textContent = t("status.net.title"); }
    if (body) { body.removeAttribute("data-i18n"); body.setAttribute("data-live", "body"); body.textContent = t("status.net.body"); }
  }

  // ---------- skeleton (first read, retry, ?state=loading) ----------
  function sk(w, h) { return '<span class="skel" style="width:' + w + (h ? ";height:" + h : "") + '"></span>'; }
  function paintSkeleton() {
    $("st-top").setAttribute("aria-busy", "true");
    $("st-swapped").innerHTML = sk("5.5em");
    $("st-swapped-sub").innerHTML = sk("16em");
    $("st-fees").innerHTML = sk("20em");
    $("st-bar").innerHTML = '<span class="skel st-skel-bar"></span>';
    $("st-legend").innerHTML = [1, 2, 3].map(function () { return "<li>" + sk("9em") + '<span class="st-legend-val">' + sk("8em") + "</span></li>"; }).join("");
    var f = ""; for (var i = 0; i < 6; i++) f += '<div class="st-fig"><dt class="st-label">' + sk("8em") + '</dt><dd class="st-fig-value">' + sk("6em") + '</dd><dd class="st-fig-sub">' + sk("10em") + "</dd></div>";
    $("st-figs").innerHTML = f;
    $("st-chart-svg").innerHTML = '<span class="skel st-skel-block"></span>';
    var tr = $("st-track"); tr.className = "track track-lg track-agg st-track-skel"; tr.removeAttribute("aria-label");
    tr.innerHTML = '<span class="skel st-skel-block st-skel-track"></span>';
    $("st-cal").innerHTML = [1, 2, 3].map(function () { return '<li class="st-cal-row">' + sk("7em") + '<span class="st-cal-amt">' + sk("5em") + "</span></li>"; }).join("");
    $("st-cal-total").innerHTML = sk("14em");
    $("st-recent-body").innerHTML = '<div class="panel st-skel-list">' + [1, 2, 3, 4].map(function () { return "<p>" + sk("100%") + "</p>"; }).join("") + "</div>";
    recentKey = "";
  }

  // ---------- figures and the supply split ----------
  // Term help: the same shared popover as the swap app, so "keeper", "being sent" and "reserve" are explained where they appear.
  function help(key) {
    return '<details class="help"><summary aria-label="' + esc(t("status.help.label")) + '">' + I("help", 18) + '</summary><div class="help-pop">' + t(key) + "</div></details>";
  }
  function fig(label, value, unit, sub, count, key) {
    var c = count != null ? ' data-count="' + count + '" data-count-key="st-' + key + '"' : "";
    return '<div class="st-fig"><dt class="st-label">' + label + "</dt>" +
      '<dd class="st-fig-value"><span class="num"' + c + ">" + value + "</span>" + (unit ? ' <span class="st-unit">' + unit + "</span>" : "") + "</dd>" +
      '<dd class="st-fig-sub small muted">' + sub + "</dd></div>";
  }
  function paintFigures() {
    var m = M, ct = t("unit.ct");
    $("st-top").setAttribute("aria-busy", "false");
    $("st-swapped").innerHTML = '<span data-count="' + m.swapped + '" data-count-key="st-swapped">' + whole(m.swapped) + "</span>";
    $("st-swapped-sub").textContent = t("status.fig.swapped_sub", { pct: pctMin(m.swapped / m.supply, 1), supply: m.supplyText + " " + ct, old: whole(m.swappedOld) });
    // Live fees come from the gas server, whose counters restart on each deploy: say since when. Hidden when it is unreachable.
    var fees = $("st-fees");
    fees.hidden = !m.gas;
    fees.textContent = !m.gas ? "" : LIVE ? t("status.fees_live", { kaia: F.amount(m.gas.kaia, 2), n: whole(m.gas.tx), date: F.date(m.gas.since || m.now) })
      : t("status.fees", { kaia: F.amount(m.gas.kaia, 2), n: whole(m.gas.tx) });
    var left = daysLeft(m.now), closed = winState() === "closed";
    $("st-figs").innerHTML =
      fig(t("status.fig.instant") + help("status.help.instant"), whole(m.instant), ct, t("status.fig.instant_sub"), m.instant, "instant") +
      fig(t("status.fig.locked") + help("status.help.locked"), whole(m.locked), ct, m.sending ? t("status.fig.locked_sub_sending", { n: whole(m.sending) }) : t("status.fig.locked_sub"), m.locked, "locked") +
      fig(t("status.fig.released") + help("status.help.released"), whole(m.released), ct, t("status.fig.released_sub"), m.released, "released") +
      // The chain has no holder count for old CT, so live shows the unique wallets without a share of holders.
      fig(t("status.fig.holders"), t(m.holders === 1 ? "status.fig.holders_value_one" : "status.fig.holders_value", { n: whole(m.holders) }), "", m.oldHolders ? t("status.fig.holders_sub", { pct: F.pct(m.holders / m.oldHolders, 1), n: whole(m.oldHolders) }) : t("status.fig.holders_sub_live")) +
      fig(t("status.fig.reserve") + help("status.help.reserve"), whole(m.reserve), ct, m.chain ? t("status.fig.reserve_sub_live", { n: whole(m.chain.availableReserve) }) : t("status.fig.reserve_sub"), m.reserve, "reserve") +
      (closed
        ? fig(t("status.fig.time"), t("status.fig.time_closed"), "", t("status.fig.time_closed_sub", { date: F.date(C.windowEnd) }))
        : fig(t("status.fig.time"), t(left === 1 ? "status.fig.time_value_one" : "status.fig.time_value", { n: whole(left) }), "", t("status.fig.time_sub", { date: F.date(C.windowEnd) })));

    // supply split: in holders' wallets (the 10% plus released 90%), locked 90%, not swapped yet. Shares add up to 100%.
    var parts = [
      { key: "wallets", v: m.instant + m.released, cls: "is-claimed", share: m.shares[0] },
      { key: "locked", v: m.locked, cls: "is-held", share: m.shares[1] },
      { key: "reserve", v: m.reserve, cls: "is-reserve", share: m.shares[2] }
    ];
    // largest remainder shares can round a real part to 0%: show it as "<0.1%"
    var spct = function (p) { return p.share === 0 && p.v > 0 ? pctMin(1e-9, 1) : F.pct(p.share, 1); };
    var bar = $("st-bar"), total = parts[0].v + parts[1].v + parts[2].v || 1;
    bar.innerHTML = parts.map(function (p) {
      return '<span class="st-seg-part ' + p.cls + '" style="flex-grow:' + (p.v / total).toFixed(6) + '"><span class="st-seg-label">' + spct(p) + "</span></span>";
    }).join("");
    var item = function (p) { return t("status.split.item", { amount: whole(p.v), pct: spct(p) }); };
    bar.setAttribute("aria-label", t("status.split.aria", { a: item(parts[0]), b: item(parts[1]), c: item(parts[2]) }));
    // a label that does not fit its block is dropped: the legend and the aria label carry it
    bar.querySelectorAll(".st-seg-part").forEach(function (seg) {
      var lab = seg.firstChild; lab.hidden = false;
      if (lab.scrollWidth + 16 > seg.clientWidth) lab.hidden = true;
    });
    $("st-legend").innerHTML = parts.map(function (p) {
      return '<li><span class="st-key ' + p.cls + '" aria-hidden="true"></span><span class="st-legend-name">' + t("status.split." + p.key) +
        '</span><span class="st-legend-val num">' + item(p) + "</span></li>";
    }).join("");
  }

  // ---------- the swap track in aggregate, and what unlocks next ----------
  function paintTrack() {
    var m = M, el = $("st-track");
    var mid = t("status.track.mid", { n: whole(m.released) }) + (m.sending ? t("status.track.mid_sending", { n: whole(m.sending) }) : "");
    var dayList = m.ticks.map(function (v, i) { return t("status.track.aria_day", { d: i + 1, n: whole(v) }); }).join(", ");
    CJ.trackAggregate(el, {
      swapped: whole(m.swappedOld), instant: whole(m.instant), locked: whole(m.locked), days: m.ticks,
      labels: {
        left: t("status.track.left"), right: t("status.track.right"), now: t("status.track.now"), mid: mid,
        axisStart: t("status.track.day1"), axisEnd: t("status.track.day7"),
        aria: t("status.track.aria", { swapped: whole(m.swappedOld), instant: whole(m.instant), locked: whole(m.locked), days: dayList, released: whole(m.released) })
      }
    });
    // Readable levels: one large day would leave the others as empty boxes on a linear scale, so the height grows with the
    // square root and every day with CT gets at least a fifth of the tick. Order is kept; the exact CT is printed under
    // each tick when there is room, and in the list beside it.
    var max = Math.max.apply(null, m.ticks), days = el.querySelectorAll(".track-day");
    m.ticks.forEach(function (v, i) { if (days[i]) days[i].style.setProperty("--lv", v > 0 && max > 0 ? (0.2 + 0.8 * Math.sqrt(v / max)).toFixed(3) : "0"); });
    var vals = '<div class="st-tick-vals" aria-hidden="true"><span></span>' + m.ticks.map(function (v) { return '<span class="num">' + (v ? cmp(v) : "0") + "</span>"; }).join("") + "</div>";
    var axis = el.querySelector(".track-axis"); if (axis) axis.insertAdjacentHTML("beforebegin", vals);
    // The list reads the same way as the track: day 1 (newest) to day 7 (unlocks within 24 hours).
    var rows = "";
    for (var k = 0; k < 7; k++) {
      var label = k === 6 ? t("status.unlock.next24") : t("status.unlock.in_days", { a: 6 - k, b: 7 - k });
      rows += '<li class="st-cal-row' + (k === 6 ? " is-next" : "") + '"><span class="st-cal-date small"><span class="st-cal-d">' + t("status.unlock.day", { d: k + 1 }) + "</span> " + label + '</span><span class="st-cal-amt small"><span class="num">' + whole(m.ticks[k]) + '</span> <span class="muted">' + t("unit.ct") + "</span></span></li>";
    }
    $("st-cal").innerHTML = rows;
    $("st-cal-total").textContent = m.sending ? t("status.unlock.total_sending", { amount: whole(m.locked), n: whole(m.sending) }) : t("status.unlock.total", { amount: whole(m.locked) });
  }

  // ---------- daily chart (inline SVG, single series, hover and keyboard readout) ----------
  var active = -1;
  function niceMax(v, ticks) {
    if (v <= 0) return ticks;
    var raw = v / ticks, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    var steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10], step = 10;
    for (var i = 0; i < steps.length; i++) if (n <= steps[i]) { step = steps[i]; break; }
    return step * p * ticks;
  }
  function dayLabel(day) { return day.partial ? t("status.daily.today") : shortDate(day.start); }
  function dayLong(day) { return day.partial ? t("status.daily.today_long", { date: F.date(day.start) }) : F.date(day.start); }
  function paintChart() {
    var m = M, host = $("st-chart-svg"), W = Math.max(280, host.clientWidth || 600);
    var mobile = W < 560, H = mobile ? 200 : 240;
    var pad = { l: 48, r: 8, t: 22, b: 28 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    var n = m.days.length, maxV = 0, peak = 0;
    m.days.forEach(function (d, i) { if (d.vol > maxV) { maxV = d.vol; peak = i; } });
    var ticks = 4, top = niceMax(maxV * 1.06, ticks);
    var band = pw / n, bw = Math.min(24, Math.max(4, band * 0.62));
    var y = function (v) { return pad.t + ph - (v / top) * ph; };
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true" focusable="false">';
    for (var i = 0; i <= ticks; i++) {
      var tv = top * i / ticks, ty = Math.round(y(tv)) + 0.5;
      svg += '<line class="st-grid-line" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + ty + '" y2="' + ty + '"/>';
      svg += '<text class="st-axis" x="' + (pad.l - 8) + '" y="' + (ty + 4) + '" text-anchor="end">' + cmp(tv) + "</text>";
    }
    var every = Math.max(1, Math.ceil(n / Math.floor(pw / (mobile ? 52 : 60))));
    m.days.forEach(function (d, i) {
      var cx = pad.l + band * (i + 0.5), x = cx - bw / 2, yt = y(d.vol), h = pad.t + ph - yt, r = Math.min(4, h, bw / 2);
      var path = "M" + x + " " + (pad.t + ph) + "V" + (yt + r) + "Q" + x + " " + yt + " " + (x + r) + " " + yt + "H" + (x + bw - r) + "Q" + (x + bw) + " " + yt + " " + (x + bw) + " " + (yt + r) + "V" + (pad.t + ph) + "Z";
      svg += '<path class="st-col' + (i === active ? " is-active" : "") + (active > -1 && i !== active ? " is-dim" : "") + '" d="' + path + '"/>';
      var last = i === n - 1;
      if ((i % every === 0 && n - 1 - i >= every * 0.6) || last) svg += '<text class="st-axis" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + dayLabel(d) + "</text>";
      if (i === peak && maxV > 0) {
        var nearLeft = band * (i + 0.5) < 28, nearRight = band * (n - i - 0.5) < 28;
        svg += '<text class="st-peak" x="' + (nearLeft ? x : nearRight ? x + bw : cx) + '" y="' + (yt - 7) + '" text-anchor="' + (nearLeft ? "start" : nearRight ? "end" : "middle") + '">' + cmp(d.vol) + "</text>";
      }
    });
    svg += '<line class="st-base" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + (pad.t + ph + 0.5) + '" y2="' + (pad.t + ph + 0.5) + '"/></svg>';
    host.innerHTML = svg;
    host._geo = { pad: pad, band: band, n: n, y: y, W: W };
    $("st-daily-sub").textContent = t("status.daily.sub", { date: F.date(C.windowStart) });
    $("st-daily-rows").innerHTML = m.days.slice().reverse().map(function (d) {
      return "<tr><td>" + dayLong(d) + '</td><td class="r num">' + whole(d.vol) + " " + t("unit.old") + '</td><td class="r num">' + whole(d.holders) + "</td></tr>";
    }).join("");
    if (active > -1) showTip(active, false);
  }
  function showTip(i, announce) {
    var g = $("st-chart-svg")._geo, d = M && M.days[i], tip = $("st-tip");
    if (!g || !d) return;
    tip.innerHTML = '<strong class="num"></strong><span></span><span class="muted"></span>';
    tip.children[0].textContent = t("status.daily.tip", { amount: whole(d.vol) });
    tip.children[1].textContent = dayLong(d);
    tip.children[2].textContent = t("status.daily.tip_holders", { n: whole(d.holders) });
    tip.hidden = false;
    var cx = g.pad.l + g.band * (i + 0.5), tw = tip.offsetWidth;
    var left = Math.max(0, Math.min(g.W - tw, cx - tw / 2));
    tip.style.transform = "translate(" + Math.round(left) + "px," + Math.round(Math.max(0, g.y(d.vol) - tip.offsetHeight - 12)) + "px)";
    if (announce) $("st-chart-live").textContent = t("status.daily.read", { date: dayLong(d), amount: whole(d.vol), n: whole(d.holders) });
  }
  function setActive(i, announce) {
    if (i === active) return;
    active = i;
    $("st-chart-svg").querySelectorAll(".st-col").forEach(function (p, k) {
      p.classList.toggle("is-active", k === i); p.classList.toggle("is-dim", i > -1 && k !== i);
    });
    if (i < 0) { $("st-tip").hidden = true; return; }
    showTip(i, announce);
  }
  function bindChart() {
    var chart = $("st-chart"), host = $("st-chart-svg");
    host.addEventListener("pointermove", function (e) {
      var g = host._geo; if (!g || !M) return;
      var x = e.clientX - host.getBoundingClientRect().left - g.pad.l;
      setActive(Math.max(0, Math.min(g.n - 1, Math.floor(x / g.band))), false);
    });
    host.addEventListener("pointerleave", function () { if (document.activeElement !== chart) setActive(-1); });
    chart.addEventListener("keydown", function (e) {
      if (!M) return;
      var n = M.days.length, i = active;
      if (e.key === "ArrowRight") i = i < 0 ? 0 : Math.min(n - 1, i + 1);
      else if (e.key === "ArrowLeft") i = i < 0 ? n - 1 : Math.max(0, i - 1);
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = n - 1;
      else if (e.key === "Escape") { setActive(-1); return; }
      else return;
      e.preventDefault(); setActive(i, true);
    });
    chart.addEventListener("focus", function () { if (active < 0 && M) setActive(M.days.length - 1, true); });
    chart.addEventListener("blur", function () { setActive(-1); });
  }

  // ---------- recent activity (table or cards) ----------
  function readView() {
    try { var v = localStorage.getItem(VIEW_KEY); if (v === "table" || v === "cards") return v; } catch (e) {}
    return window.matchMedia("(max-width: 719px)").matches ? "cards" : "table";
  }
  var view = readView();
  function txLink(r) {
    return '<a class="btn btn-ghost btn-sm st-tx" href="' + C.explorer + "/tx/" + r.tx + '" target="_blank" rel="noopener" aria-label="' +
      esc(t("status.tx.aria", { hash: F.addr(r.tx) })) + '"><span class="st-hash">' + F.addr(r.tx) + "</span>" + I("ext", 16) + "</a>";
  }
  // One vocabulary and one tag style per status, the same as the swap app and the admin monitor.
  function statusTag(r, when) {
    var l = r.lot, s = l.status;
    var tag = s === "locked" ? '<span class="tag tag-locked">' + I("lock", 14) + t("status.tag.locked") + "</span>"
      : s === "releasing" ? '<span class="tag tag-sending">' + I("unlock", 14) + t("status.tag.sending") + "</span>"
      : '<span class="tag tag-released">' + I("check", 14) + t("status.tag.released") + "</span>";
    var note = s === "locked" ? t("status.st.later", { date: shortDate(l.unlockAt) })
      : s === "releasing" ? t("status.st.lock_ended")
      : t(l.releasedBy === "holder" ? "status.st.by_holder" : "status.st.by_keeper");
    if (when) note = t("status.st.when", { note: note, time: when });
    return tag + ' <span class="st-later small muted">' + note + "</span>";
  }
  function unitFor(r) { return r.type === "release" ? t("unit.new") : t("unit.old"); }
  function timeEl(r) { return '<time datetime="' + new Date(r.at).toISOString() + '" title="' + esc(F.dateTime(r.at)) + '">' + rel(r.at) + "</time>"; }
  var recentKey = "", allCards = false, PHONE_CARDS = 5;
  var phone = window.matchMedia("(max-width: 719px)");
  function paintRecent(soft) {
    var rows = M.events, body = $("st-recent-body");
    // Phones: the 5 newest cards, and a button for the rest.
    var cut = view === "cards" && phone.matches && !allCards && rows.length > PHONE_CARDS;
    var key = view + CJ.lang() + cut + rows.map(function (r) { return r.tx + r.lot.status; }).join("");
    document.querySelectorAll(".st-view .seg-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === view)); });
    // a refresh with the same rows only updates the relative times, so focus and scroll stay put
    if (soft && key === recentKey) {
      body.querySelectorAll("time[datetime]").forEach(function (el) { el.textContent = rel(Date.parse(el.getAttribute("datetime"))); });
      return;
    }
    recentKey = key;
    if (!rows.length) { body.innerHTML = '<div class="panel"><p class="muted">' + t("status.recent.empty") + "</p></div>"; return; }
    if (view === "table") {
      body.innerHTML = '<div class="panel panel-flush"><div class="st-scroll"><table class="table st-recent-table"><thead><tr>' +
        '<th scope="col">' + t("status.col.wallet") + "</th>" +
        '<th scope="col">' + t("status.col.action") + "</th>" +
        '<th scope="col" class="r">' + t("status.col.amount") + "</th>" +
        '<th scope="col">' + t("status.col.status") + "</th>" +
        '<th scope="col">' + t("status.col.time") + "</th>" +
        '<th scope="col" class="r">' + t("status.col.tx") + "</th></tr></thead><tbody>" +
        rows.map(function (r) {
          return '<tr><td><span class="st-hash">' + F.addr(r.lot.wallet) + "</span></td>" +
            "<td>" + t("status.act." + r.type) + "</td>" +
            '<td class="r"><span class="num">' + amtR(r.amount) + '</span> <span class="muted">' + unitFor(r) + "</span></td>" +
            "<td>" + statusTag(r) + "</td>" +
            '<td class="muted">' + timeEl(r) + "</td>" +
            '<td class="r">' + txLink(r) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    } else {
      var shown = cut ? rows.slice(0, PHONE_CARDS) : rows;
      body.innerHTML = '<ul class="st-cards">' + shown.map(function (r, i) {
        var rel = r.type === "release";
        return '<li class="panel st-card"' + (i === PHONE_CARDS ? ' tabindex="-1" id="st-card-more"' : "") + ">" +
          '<p class="st-card-amt"><span class="num">' + amtR(r.amount) + '</span> <span class="st-unit">' + unitFor(r) + "</span></p>" +
          (rel ? "" : '<p class="small muted">' + t("status.act." + r.type) + " " + timeEl(r) + "</p>") +
          '<div class="st-card-row">' + statusTag(r, rel ? timeEl(r) : null) + "</div>" +
          '<div class="st-card-foot"><span class="st-hash small">' + F.addr(r.lot.wallet) + "</span>" + txLink(r) + "</div></li>";
      }).join("") + "</ul>" +
        (cut ? '<button type="button" class="btn btn-block st-more" id="st-more">' + t("status.recent.more", { n: rows.length }) + "</button>" : "");
    }
  }
  $("st-recent-body").addEventListener("click", function (e) {
    if (!e.target.closest("#st-more")) return;
    allCards = true; paintRecent();
    var c = $("st-card-more"); if (c) c.focus();
  });
  if (phone.addEventListener) phone.addEventListener("change", function () { if (M && mode !== "loading") paintRecent(); });
  document.querySelectorAll(".st-view .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      view = b.dataset.view;
      try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
      if (M) paintRecent();
    });
  });

  // ---------- read and paint ----------
  function read() { M = model(); lastRead = Date.now() - (mode === "error" ? STALE_MIN * 60000 : 3000); }
  // Live read: resolves once the chain answered. A failure keeps the last figures and shows the error with Retry.
  var reading = false;
  function readLive() {
    if (reading) return Promise.resolve();
    reading = true;
    return LS.load({ gas: true }).then(function (s) {
      reading = false; LIVE_S = s; M = model(); lastRead = LS.lastRead; mode = "live";
    }, function () { reading = false; mode = "error"; });
  }
  function paintContracts() {
    var m = M, note = t("status.contracts.note", { supply: m ? m.supplyText : SUPPLY_TEXT });
    if (m && m.chain) note += " " + t("status.contracts.read", { old: m.chain.oldSupplyText, held: whole(m.chain.oldHeld) });
    if (LIVE && CJ.net.testnet) note += " " + t("status.contracts.testnet");
    $("st-contracts-note").textContent = note;
    if (LS) LS.fixLinks();
  }
  function paintAll() {
    paintHead(); paintError(); paintLive(); paintNote();
    if (mode === "loading" || !M) { paintSkeleton(); paintContracts(); return; }
    paintFigures(); paintTrack(); paintChart(); paintRecent();
    paintContracts();
  }
  $("st-sample-icon").outerHTML = I("info", 18);
  $("st-error-icon").outerHTML = I("warn", 18);
  $("st-retry-icon").outerHTML = I("refresh", 16);
  $("st-retry").addEventListener("click", function () {
    var btn = this; btn.disabled = true;
    mode = "loading"; paintAll();
    var done = function () { paintAll(); if (mode === "live") tick(); btn.disabled = false; $("st-hero-label").focus(); };
    if (LS) { lastTry = Date.now(); readLive().then(done); }
    else setTimeout(function () { mode = "live"; read(); done(); }, 700);
  });
  bindChart();
  var lastTry = Date.now();
  if (LIVE && !LS) mode = "error"; // live, but the chain helper or ethers did not load
  if (LS) { mode = "loading"; paintAll(); CJ.ready(); readLive().then(function () { paintAll(); if (mode === "live") tick(); }); }
  else {
    if (mode !== "loading") read();
    paintAll();
    CJ.ready();
  }

  // The live stamp ticks every second. The read runs every 15 seconds while live; after a failed live read it is retried
  // every 30 seconds in the background, and the Retry button reads at once.
  setInterval(function () {
    var since = Date.now() - lastTry;
    if (LS && !reading && ((mode === "live" && since >= REFRESH) || (mode === "error" && since >= 2 * REFRESH))) {
      var was = mode; lastTry = Date.now();
      readLive().then(function () {
        if (mode === "live" && was === "live") { paintFigures(); paintTrack(); paintChart(); paintRecent(true); paintContracts(); tick(); }
        else paintAll();
      });
    } else if (!LS && mode === "live" && Date.now() - lastRead >= REFRESH) {
      read(); paintFigures(); paintTrack(); paintChart(); paintRecent(true); tick();
    }
    paintLive();
  }, 1000);
  var rw = 0, rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var w = $("st-chart-svg").clientWidth; if (w !== rw && M && mode !== "loading") { rw = w; paintChart(); paintFigures(); } }, 120);
  });
  document.addEventListener("cj:lang", function () { recentKey = ""; paintAll(); });
})();
