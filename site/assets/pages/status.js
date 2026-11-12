// Status page: public swap dashboard. Every figure is seeded mock data, deterministic for a given mock time.
(function () {
  var C = CJ.config, DAY = CJ.DAY, SUPPLY = C.newToken.supply, SUPPLY_TEXT = C.newToken.supplyText, LOCK = C.lockDays * DAY;
  var NOW_SHARE = C.instantPercent / 100, KEEP = C.keeperDelayMin * 60000; // 10% paid at once; keeper sends the 90% shortly after unlock
  var $ = function (id) { return document.getElementById(id); };
  var t = CJ.t, F = CJ.fmt;
  var VIEW_KEY = "cj.status.view";
  var REFRESH = 15000;
  // The shared mock clock starts the prototype at midnight UTC, which would leave "today" empty.
  // The shared mock clock already sits at mid afternoon UTC (system.js).
  var SHIFT = 0;
  function now() { return CJ.now() + SHIFT; }
  function rel(ts) { return F.rel(ts - SHIFT); }
  function cmp(n) { return new Intl.NumberFormat({ en: "en-US", ko: "ko-KR", ja: "ja-JP" }[CJ.lang()], { notation: "compact", maximumFractionDigits: 1 }).format(n); }

  // ---------- seeded hash (unsigned 32 bit, >>> for every shift) ----------
  function mix(n) {
    n = (n ^ 0x9e3779b9) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35) >>> 0;
    return (n ^ (n >>> 16)) >>> 0;
  }
  function rnd(a, b) { return mix((mix(a >>> 0) ^ Math.imul(b | 0, 0x27d4eb2f)) >>> 0) / 4294967296; }
  function hex(seed, len) {
    var s = "", i = 0;
    while (s.length < len) { s += ("00000000" + mix((seed + Math.imul(i, 0x632be5ab)) >>> 0).toString(16)).slice(-8); i++; }
    return "0x" + s.slice(0, len);
  }

  // ---------- mock model ----------
  // Day d of the window swaps vol(d) old CT, spread evenly over that day; it unlocks evenly 7 days later.
  function dayVol(d) { return Math.round((92e6 * Math.exp(-d / 5) + 13e6) * (0.82 + 0.36 * rnd(d, 1))); }
  function dayHolders(d) { return Math.round(dayVol(d) / 255000 * (0.85 + 0.3 * rnd(d, 2))); }
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

  function model() {
    var nowReal = now(), nowCap = Math.min(nowReal, C.windowEnd);
    var today = Math.floor((nowCap - C.windowStart) / DAY);
    var days = [], swapped = 0, locked = 0, holders = 0;
    var todayStart = Math.floor(nowReal / DAY) * DAY, buckets = [0, 0, 0, 0, 0, 0, 0, 0];
    for (var d = 0; d <= today; d++) {
      var s = C.windowStart + d * DAY, e = Math.min(s + DAY, nowCap), span = e - s;
      if (span <= 0) continue;
      var frac = span / DAY, vol = dayVol(d) * frac, h = Math.round(dayHolders(d) * frac);
      days.push({ d: d, start: s, vol: vol, holders: h, partial: frac < 1 });
      swapped += vol; holders += h;
      // the 90% of this day's swaps unlocks 7 days later and the keeper sends it shortly after
      var u0 = s + LOCK, u1 = e + LOCK, part = vol * (1 - NOW_SHARE);
      locked += part * overlap(nowReal, Infinity, u0 + KEEP, u1 + KEEP) / span;
      for (var k = 0; k < 8; k++) buckets[k] += part * overlap(Math.max(nowReal, todayStart + k * DAY), todayStart + (k + 1) * DAY, u0, u1) / span;
    }
    var instant = swapped * NOW_SHARE, released = Math.max(0, swapped - instant - locked);
    // Fee delegation (sample): about 78% of requests come from Kaia Wallet or WalletConnect, whose approve and swap Cojam pays;
    // every keeper release is paid by Cojam too.
    var requests = holders * 1.25, releases = requests * (released / Math.max(1, swapped * (1 - NOW_SHARE)));
    var feeTx = requests * 2 * 0.78 + releases * 0.9, feeKaia = requests * 0.78 * 0.016 + releases * 0.9 * 0.006;
    return {
      now: nowReal, days: days, swapped: swapped, instant: instant, locked: locked, released: released,
      holders: holders, reserve: SUPPLY - swapped, buckets: buckets, todayStart: todayStart, feeTx: feeTx, feeKaia: feeKaia
    };
  }

  // Recent activity: one possible event per 5 minute slot, anchored to absolute time so it is stable.
  var SLOT = 300000;
  function recent(n) {
    var tNow = now(), out = [], slot = Math.floor(tNow / SLOT), guard = 0;
    while (out.length < n && guard++ < 400) {
      var r = rnd(slot, 3);
      if (r < 0.62) {
        var at = slot * SLOT + Math.floor(rnd(slot, 4) * SLOT);
        if (at <= tNow && at >= C.windowStart) {
          var u = rnd(slot, 5);
          var amt = Math.round(Math.pow(10, 2.2 + 4.4 * Math.pow(u, 1.5)) * (rnd(slot, 6) < 0.4 ? 100 : 1)) / (rnd(slot, 6) < 0.4 ? 100 : 1);
          var release = rnd(slot, 7) < 0.32 && at - LOCK > C.windowStart, sp = CJ.split(amt);
          out.push({
            at: at, amount: release ? sp.locked : amt, instant: sp.instant, type: release ? "release" : "swap",
            by: rnd(slot, 8) < 0.84 ? "keeper" : "holder",
            wallet: hex(mix(slot) ^ 0x51ed27, 40), tx: hex(mix(slot ^ 0x7a3c11), 64),
            unlockAt: at + LOCK
          });
        }
      }
      slot--;
    }
    return out;
  }

  // ---------- render: head and figures ----------
  var lastRefresh = 0, M = null;

  function paintHead() {
    var closed = CJ.windowState() === "closed";
    $("st-window").textContent = t(closed ? "status.window.closed" : "status.window.open", { start: F.date(C.windowStart), end: F.date(C.windowEnd) });
  }
  function paintLive() { $("st-live-text").textContent = t("status.live.updated", { rel: rel(lastRefresh) }); }

  function whole(n) { return F.amount(Math.round(n), 0); }

  function fig(label, value, unit, sub, cls) {
    return '<div class="st-fig' + (cls ? " " + cls : "") + '"><dt class="st-label">' + label + "</dt>" +
      '<dd class="st-fig-value"><span class="num">' + value + "</span>" + (unit ? ' <span class="st-unit">' + unit + "</span>" : "") + "</dd>" +
      '<dd class="st-fig-sub small muted">' + sub + "</dd></div>";
  }

  function paintFigures() {
    var m = M, ct = t("unit.ct");
    $("st-swapped").textContent = whole(m.swapped);
    $("st-swapped-sub").textContent = t("status.fig.swapped_sub", { pct: F.pct(m.swapped / SUPPLY, 1), supply: SUPPLY_TEXT + "\u00a0" + t("unit.ct") });
    $("st-fees").textContent = t("status.fees", { kaia: whole(m.feeKaia), n: whole(m.feeTx) });

    var left = Math.max(0, Math.ceil((C.windowEnd - m.now) / DAY)), closed = CJ.windowState() === "closed";
    $("st-figs").innerHTML =
      fig(t("status.fig.instant"), whole(m.instant), ct, t("status.fig.instant_sub")) +
      fig(t("status.fig.locked"), whole(m.locked), ct, t("status.fig.locked_sub")) +
      fig(t("status.fig.released"), whole(m.released), ct, t("status.fig.released_sub")) +
      fig(t("status.fig.holders"), t("status.fig.holders_value", { n: F.amount(m.holders, 0) }), "", t("status.fig.holders_sub", { pct: F.pct(m.holders / 22500, 1) })) +
      fig(t("status.fig.reserve"), whole(m.reserve), ct, t("status.fig.reserve_sub")) +
      (closed
        ? fig(t("status.fig.time"), t("status.fig.time_closed"), "", t("status.fig.time_closed_sub", { date: F.date(C.windowEnd) }))
        : fig(t("status.fig.time"), t("status.fig.time_value", { n: F.amount(left, 0) }), "", t("status.fig.time_sub", { date: F.date(C.windowEnd) })));

    // supply split: in holders' wallets (the 10% plus released 90%), locked 90%, not swapped yet
    var parts = [
      { key: "wallets", v: m.instant + m.released, cls: "is-claimed" },
      { key: "locked", v: m.locked, cls: "is-held" },
      { key: "reserve", v: m.reserve, cls: "is-reserve" }
    ];
    var bar = $("st-bar");
    bar.innerHTML = parts.map(function (p) {
      return '<span class="st-seg-part ' + p.cls + '" style="flex-grow:' + (p.v / SUPPLY).toFixed(6) + '"><span class="st-seg-label">' + F.pct(p.v / SUPPLY, 1) + "</span></span>";
    }).join("");
    bar.setAttribute("aria-label", t("status.split.aria", {
      a: t("status.split.item", { amount: whole(parts[0].v), pct: F.pct(parts[0].v / SUPPLY, 1) }),
      b: t("status.split.item", { amount: whole(parts[1].v), pct: F.pct(parts[1].v / SUPPLY, 1) }),
      c: t("status.split.item", { amount: whole(parts[2].v), pct: F.pct(parts[2].v / SUPPLY, 1) })
    }));
    // a label that does not fit its block is dropped: the legend and the aria label carry it
    bar.querySelectorAll(".st-seg-part").forEach(function (seg) {
      var lab = seg.firstChild; lab.hidden = false;
      if (lab.scrollWidth + 16 > seg.clientWidth) lab.hidden = true;
    });
    $("st-legend").innerHTML = parts.map(function (p) {
      return '<li><span class="st-key ' + p.cls + '" aria-hidden="true"></span><span class="st-legend-name">' + t("status.split." + p.key) +
        '</span><span class="st-legend-val num">' + t("status.split.item", { amount: whole(p.v), pct: F.pct(p.v / SUPPLY, 1) }) + "</span></li>";
    }).join("");
  }

  // ---------- render: unlock calendar (the swap track in aggregate) ----------
  function paintCalendar() {
    var m = M, max = Math.max.apply(null, m.buckets) || 1, html = "";
    m.buckets.forEach(function (v, k) {
      var day = m.todayStart + k * DAY, label = k === 0 ? t("status.unlock.today") : shortDate(day);
      var level = v > 0 ? Math.max(0.02, v / max) : 0;
      html += '<li class="st-cal-row"><span class="st-cal-date small">' + label + "</span>" +
        '<span class="st-cal-cell" aria-hidden="true"><span class="st-cal-fill" style="transform:scaleX(' + level.toFixed(3) + ')"></span></span>' +
        '<span class="st-cal-amt small"><span class="num">' + cmp(v) + '</span> <span class="muted">' + t("unit.ct") + "</span></span></li>";
    });
    $("st-cal").innerHTML = html;
    $("st-cal-total").textContent = t("status.unlock.total", { amount: whole(m.locked) });
  }

  function shortDate(ts) { return new Intl.DateTimeFormat({ en: "en-US", ko: "ko-KR", ja: "ja-JP" }[CJ.lang()], { month: "short", day: "numeric", timeZone: "UTC" }).format(ts); }

  // ---------- render: daily chart (inline SVG, single series, hover and keyboard readout) ----------
  var active = -1;
  // the top of the axis is 4 clean steps: 0, 40M, 80M, 120M, 160M
  function niceMax(v, ticks) {
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
      if (i === peak) {
        var nearLeft = band * (i + 0.5) < 28, nearRight = band * (n - i - 0.5) < 28;
        svg += '<text class="st-peak" x="' + (nearLeft ? x : nearRight ? x + bw : cx) + '" y="' + (yt - 7) + '" text-anchor="' + (nearLeft ? "start" : nearRight ? "end" : "middle") + '">' + cmp(d.vol) + "</text>";
      }
    });
    svg += '<line class="st-base" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + (pad.t + ph + 0.5) + '" y2="' + (pad.t + ph + 0.5) + '"/>';
    svg += "</svg>";
    host.innerHTML = svg;
    host._geo = { pad: pad, band: band, n: n, y: y, W: W };
    $("st-daily-sub").textContent = t("status.daily.sub", { date: F.date(C.windowStart) });
    $("st-daily-rows").innerHTML = m.days.slice().reverse().map(function (d) {
      return "<tr><td>" + dayLong(d) + '</td><td class="r num">' + whole(d.vol) + " " + t("unit.ct") + '</td><td class="r num">' + F.amount(d.holders, 0) + "</td></tr>";
    }).join("");
    if (active > -1) showTip(active, false);
  }

  function showTip(i, announce) {
    var g = $("st-chart-svg")._geo, d = M.days[i], tip = $("st-tip");
    if (!g || !d) return;
    tip.innerHTML = '<strong class="num"></strong><span></span><span class="muted"></span>';
    tip.children[0].textContent = t("status.daily.tip", { amount: whole(d.vol) });
    tip.children[1].textContent = dayLong(d);
    tip.children[2].textContent = t("status.daily.tip_holders", { n: F.amount(d.holders, 0) });
    tip.hidden = false;
    var cx = g.pad.l + g.band * (i + 0.5), tw = tip.offsetWidth;
    var left = Math.max(0, Math.min(g.W - tw, cx - tw / 2));
    tip.style.transform = "translate(" + Math.round(left) + "px," + Math.round(Math.max(0, g.y(d.vol) - tip.offsetHeight - 12)) + "px)";
    if (announce) $("st-chart-live").textContent = t("status.daily.read", { date: dayLong(d), amount: whole(d.vol), n: F.amount(d.holders, 0) });
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
      var g = host._geo; if (!g) return;
      var x = e.clientX - host.getBoundingClientRect().left - g.pad.l;
      setActive(Math.max(0, Math.min(g.n - 1, Math.floor(x / g.band))), false);
    });
    host.addEventListener("pointerleave", function () { if (document.activeElement !== chart) setActive(-1); });
    chart.addEventListener("keydown", function (e) {
      var n = M.days.length, i = active;
      if (e.key === "ArrowRight") i = i < 0 ? 0 : Math.min(n - 1, i + 1);
      else if (e.key === "ArrowLeft") i = i < 0 ? n - 1 : Math.max(0, i - 1);
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = n - 1;
      else if (e.key === "Escape") { setActive(-1); return; }
      else return;
      e.preventDefault(); setActive(i, true);
    });
    chart.addEventListener("focus", function () { if (active < 0) setActive(M.days.length - 1, true); });
    chart.addEventListener("blur", function () { setActive(-1); });
  }

  // ---------- render: recent activity (table or cards) ----------
  function readView() {
    try { var v = localStorage.getItem(VIEW_KEY); if (v === "table" || v === "cards") return v; } catch (e) {}
    return window.matchMedia("(max-width: 719px)").matches ? "cards" : "table";
  }
  var view = readView();

  function txLink(r) {
    return '<a class="btn btn-ghost btn-sm st-tx" href="' + C.explorer + "/tx/" + r.tx + '" target="_blank" rel="noopener" aria-label="' +
      t("status.tx.aria", { hash: F.addr(r.tx) }) + '"><span class="st-hash">' + F.addr(r.tx) + "</span>" + CJ.icon("ext", 16) + "</a>";
  }
  // Swapped: the 10% paid at once and the date of the 90%. Released: who sent it.
  function statusTag(r) {
    return r.type === "release"
      ? '<span class="tag">' + CJ.icon("check", 14) + t(r.by === "keeper" ? "status.st.keeper" : "status.st.holder") + "</span>"
      : '<span class="tag tag-sky">' + t("status.st.instant", { amount: F.amount(r.instant) }) + "</span>" +
        ' <span class="st-later small muted">' + t("status.st.later", { date: shortDate(r.unlockAt) }) + "</span>";
  }
  function unitFor(r) { return r.type === "release" ? t("unit.new") : t("unit.old"); }

  var recentKey = "";
  function paintRecent(soft) {
    var rows = recent(8), body = $("st-recent-body"), key = view + rows.map(function (r) { return r.tx; }).join("");
    // a refresh with the same rows only updates the relative times, so focus and scroll stay put
    if (soft && key === recentKey) {
      body.querySelectorAll("time[datetime]").forEach(function (el) { el.textContent = rel(Date.parse(el.getAttribute("datetime"))); });
      return;
    }
    recentKey = key;
    document.querySelectorAll(".st-seg-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === view)); });
    if (view === "table") {
      body.innerHTML = '<div class="panel panel-flush"><div class="st-scroll"><table class="table st-recent-table"><thead><tr>' +
        '<th scope="col">' + t("status.col.wallet") + "</th>" +
        '<th scope="col">' + t("status.col.action") + "</th>" +
        '<th scope="col" class="r">' + t("status.col.amount") + "</th>" +
        '<th scope="col">' + t("status.col.status") + "</th>" +
        '<th scope="col">' + t("status.col.time") + "</th>" +
        '<th scope="col" class="r">' + t("status.col.tx") + "</th></tr></thead><tbody>" +
        rows.map(function (r) {
          return '<tr><td><span class="st-hash">' + F.addr(r.wallet) + "</span></td>" +
            "<td>" + t("status.act." + r.type) + "</td>" +
            '<td class="r"><span class="num">' + F.amount(r.amount) + '</span> <span class="muted">' + unitFor(r) + "</span></td>" +
            "<td>" + statusTag(r) + "</td>" +
            '<td class="muted"><time datetime="' + new Date(r.at).toISOString() + '" title="' + F.dateTime(r.at) + '">' + rel(r.at) + "</time></td>" +
            '<td class="r">' + txLink(r) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    } else {
      body.innerHTML = '<ul class="st-cards">' + rows.map(function (r) {
        return '<li class="panel st-card">' +
          '<p class="st-card-amt"><span class="num">' + F.amount(r.amount) + '</span> <span class="st-unit">' + unitFor(r) + "</span></p>" +
          '<div class="st-card-row"><p class="small muted">' + t("status.act." + r.type) + ' <time datetime="' + new Date(r.at).toISOString() + '" title="' + F.dateTime(r.at) + '">' + rel(r.at) + "</time></p>" + statusTag(r) + "</div>" +
          '<div class="st-card-foot"><span class="st-hash small">' + F.addr(r.wallet) + "</span>" + txLink(r) + "</div></li>";
      }).join("") + "</ul>";
    }
  }
  document.querySelectorAll(".st-seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      view = b.dataset.view;
      try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
      paintRecent();
    });
  });

  // ---------- everything ----------
  function paintAll() {
    M = model();
    paintHead(); paintFigures(); paintCalendar(); paintChart(); paintRecent(); paintLive();
    $("st-contracts-note").textContent = t("status.contracts.note", { supply: SUPPLY_TEXT });
  }

  $("st-sample-icon").outerHTML = CJ.icon("info", 18);
  lastRefresh = now() - 3000;
  bindChart();
  paintAll();

  // live stamp ticks every second; the mock "refetch" runs every 15 seconds
  setInterval(function () {
    if (now() - lastRefresh >= REFRESH) {
      lastRefresh = now();
      M = model(); paintFigures(); paintCalendar(); paintChart(); paintRecent(true);
    }
    paintLive();
  }, 1000);

  var rw = 0, rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var w = $("st-chart-svg").clientWidth; if (w !== rw) { rw = w; paintChart(); paintFigures(); } }, 120);
  });
  document.addEventListener("cj:lang", paintAll);
})();
