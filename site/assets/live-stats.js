// Live swap figures for the status page and the admin monitor. Load after system.js, network.js and ethers, before the
// page's i18n file. Reads only public data: the swap contract's counters and its Migrated and Claimed events on CJ.net.rpc,
// both token supplies, and the gas server's public GET endpoints. No keys, nothing is signed or sent.
//
// CJ.liveStats.load({ gas, health }) resolves to the same shape as CJ.sample.state(), so the pages render it unchanged:
//   { now, lots, wallets, walletList, tot (with tot.u in micro CT), gas, holders: null, chain, supply, supplyText, health }
// Lots and totals carry both sides of the 0.4 rate: amount and tot.swapped in old CT; newAmount, instant, locked and
// tot.credit in new CT. Migrated(user, lotId, oldAmount, newAmount, instantAmount, lockedAmount, unlockAt) has both.
// Events are scanned from CJ.net.deployBlock in block ranges (the public node may refuse a large range, so a refused
// range is halved and retried), cached in sessionStorage and read incrementally on every refresh. Counters are read at
// the same block as the last scanned event, so the sums of the events and the contract counters always agree.
(function () {
  var CJ = window.CJ, net = CJ && CJ.net;
  if (!CJ || !net) return;
  var DAY = 86400000, HOUR = 3600000, LOCK_S = 7 * 86400;
  var on = !!CJ.live;
  var C = CJ.config;

  // ---------- point the shared config at the active network (addresses rows, explorer links, window) ----------
  if (on) {
    C.explorer = net.explorer;
    C.chainId = net.chainId;
    C.oldToken.address = net.oldToken;
    C.newToken.address = net.newToken;
    C.swapContract.address = net.swap;
    if (document.body) { try { CJ.renderAddrs(); } catch (e) {} fixLinks(); }
  }
  // The shared address rows link every address as a token; the swap contract is an account page on the explorer.
  function fixLinks(root) {
    (root || document).querySelectorAll('[data-addr="swap"] a[href*="/token/"]').forEach(function (a) {
      a.setAttribute("href", a.getAttribute("href").replace("/token/", "/address/"));
    });
  }
  document.addEventListener("cj:lang", function () { if (on) fixLinks(); });
  document.addEventListener("DOMContentLoaded", function () { if (on) fixLinks(); });

  // ---------- clock: the real time when live (the mock clock in system.js stays for design review) ----------
  function now() { return on ? Date.now() : CJ.now(); }
  function loc() { return { en: "en-US", ko: "ko-KR", ja: "ja-JP" }[CJ.lang()] || "en-US"; }
  function rel(ts) {
    var diff = ts - now(), abs = Math.abs(diff), rtf = new Intl.RelativeTimeFormat(loc(), { numeric: "auto" });
    if (Math.round(abs / 1000) < 60) return rtf.format(Math.round(diff / 1000), "second");
    if (Math.round(abs / 60000) < 60) return rtf.format(Math.round(diff / 60000), "minute");
    if (Math.round(abs / HOUR) < 24) return rtf.format(Math.round(diff / HOUR), "hour");
    return rtf.format(Math.round(diff / DAY), "day");
  }
  function windowState(n) {
    n = n == null ? now() : n;
    if (n < C.windowStart) return "upcoming";
    if (n >= C.windowEnd) return "closed";
    return "open";
  }
  function daysLeft(n) { return Math.max(0, Math.floor((C.windowEnd - (n == null ? now() : n)) / DAY)); }

  // ---------- chain access ----------
  var SWAP_ABI = [
    "function totalMigrated() view returns (uint256)", "function totalInstant() view returns (uint256)",
    "function totalOwed() view returns (uint256)", "function totalClaimed() view returns (uint256)",
    "function availableReserve() view returns (uint256)",
    "function WINDOW_START() view returns (uint256)", "function WINDOW_END() view returns (uint256)",
    // newAmount = oldAmount * 2 / 5 rounded down (rate 0.4); instantAmount + lockedAmount = newAmount
    "event Migrated(address indexed user, uint256 indexed lotId, uint256 oldAmount, uint256 newAmount, uint256 instantAmount, uint256 lockedAmount, uint256 unlockAt)",
    "event Claimed(address indexed user, uint256 indexed lotId, uint256 amount, address indexed caller)"
  ];
  var ERC20_ABI = ["function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)"];
  // The first Kairos rehearsal contracts swapped 1:1 and emitted Migrated without newAmount: still read, as newAmount = oldAmount.
  var LEGACY_ABI = ["event Migrated(address indexed user, uint256 indexed lotId, uint256 oldAmount, uint256 instantAmount, uint256 lockedAmount, uint256 unlockAt)"];
  var provider = null, swap, oldT, newT, iface, legacy, topics;
  function setup() {
    if (provider) return;
    var E = window.ethers;
    if (!E) throw new Error("ethers did not load");
    provider = new E.JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: E.Network.from(net.chainId), batchMaxCount: 20 });
    swap = new E.Contract(net.swap, SWAP_ABI, provider);
    oldT = new E.Contract(net.oldToken, ERC20_ABI, provider);
    newT = new E.Contract(net.newToken, ERC20_ABI, provider);
    iface = swap.interface;
    legacy = new E.Interface(LEGACY_ABI);
    topics = [iface.getEvent("Migrated").topicHash, legacy.getEvent("Migrated").topicHash, iface.getEvent("Claimed").topicHash];
  }
  // wei (bigint) to micro CT (a safe integer: the whole supply is about 4.1e15 micro CT, under 2^53)
  function micro(wei) { return Number(BigInt(wei) / 1000000000000n); }

  // ---------- event cache (sessionStorage) ----------
  var KEY = "cj.live.v2." + net.chainId + "." + String(net.swap).toLowerCase();
  function emptyCache() { return { scanned: net.deployBlock - 1, mig: [], clm: [], ts: {} }; }
  function readCache() {
    try { var c = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (c && c.mig && c.clm && typeof c.scanned === "number") return c; } catch (e) {}
    return emptyCache();
  }
  function writeCache(c) { try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
  var cache = readCache();

  // Scan [from, to] with up to 3 requests in flight. A refused range is split in half; ranges grow again after successes.
  var MIN_SPAN = 500, MAX_SPAN = 200000, span = 50000;
  function scan(from, to) {
    var queue = [], out = [], cursor = from, fails = 0;
    function next() {
      if (queue.length) return queue.shift();
      if (cursor > to) return null;
      var a = cursor, b = Math.min(to, a + span - 1); cursor = b + 1; return [a, b];
    }
    function worker() {
      var r = next();
      if (!r) return Promise.resolve();
      return provider.send("eth_getLogs", [{ address: net.swap, fromBlock: "0x" + r[0].toString(16), toBlock: "0x" + r[1].toString(16), topics: [topics] }])
        .then(function (logs) { out = out.concat(logs); if (span < MAX_SPAN) span = Math.min(MAX_SPAN, span * 2); return worker(); },
          function (err) {
            var size = r[1] - r[0] + 1;
            if (size > MIN_SPAN) {
              var mid = r[0] + Math.floor(size / 2);
              span = Math.max(MIN_SPAN, Math.floor(size / 2));
              queue.unshift([mid, r[1]]); queue.unshift([r[0], mid - 1]);
            } else if (++fails > 4) throw err;
            else queue.unshift(r);
            return worker();
          });
    }
    return Promise.all([worker(), worker(), worker()]).then(function () { return out; });
  }
  function addLogs(logs) {
    var seen = {};
    cache.mig.forEach(function (m) { seen[m.tx + ":" + m.li] = 1; });
    cache.clm.forEach(function (m) { seen[m.tx + ":" + m.li] = 1; });
    logs.forEach(function (raw) {
      var li = parseInt(raw.logIndex, 16), b = parseInt(raw.blockNumber, 16), tx = String(raw.transactionHash).toLowerCase();
      if (seen[tx + ":" + li]) return;
      var ev = null, v1 = false, lg = { topics: raw.topics, data: raw.data };
      try { ev = iface.parseLog(lg); } catch (e) {}
      if (!ev) { try { ev = legacy.parseLog(lg); v1 = true; } catch (e) {} }
      if (!ev) return;
      var a = ev.args;
      if (ev.name === "Migrated" && v1) cache.mig.push({ b: b, li: li, tx: tx, user: String(a[0]).toLowerCase(), lot: Number(a[1]), old: a[2].toString(), nw: a[2].toString(), inst: a[3].toString(), lock: a[4].toString(), unlock: Number(a[5]) });
      else if (ev.name === "Migrated") cache.mig.push({ b: b, li: li, tx: tx, user: String(a[0]).toLowerCase(), lot: Number(a[1]), old: a[2].toString(), nw: a[3].toString(), inst: a[4].toString(), lock: a[5].toString(), unlock: Number(a[6]) });
      else if (ev.name === "Claimed") cache.clm.push({ b: b, li: li, tx: tx, user: String(a[0]).toLowerCase(), lot: Number(a[1]), amt: a[2].toString(), caller: String(a[3]).toLowerCase() });
      seen[tx + ":" + li] = 1;
    });
    var ord = function (x, y) { return x.b - y.b || x.li - y.li; };
    cache.mig.sort(ord); cache.clm.sort(ord);
  }
  // Block times for Claimed events (Migrated carries unlockAt, so its time is unlockAt minus the 7 day lock).
  function blockTimes() {
    var need = {};
    cache.clm.forEach(function (c) { if (cache.ts[c.b] == null) need[c.b] = 1; });
    var list = Object.keys(need);
    return Promise.all(list.map(function (b) {
      return provider.send("eth_getBlockByNumber", ["0x" + (+b).toString(16), false]).then(function (blk) { if (blk) cache.ts[b] = parseInt(blk.timestamp, 16); });
    }));
  }

  // ---------- gas server (public GET endpoints) ----------
  function getJson(path) {
    var ctl = window.AbortController ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : 0;
    return fetch(net.gasApi + path, { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function f(s) { var v = parseFloat(s); return isFinite(v) ? v : 0; }
  // The admin page's gas shape (see gasWallet in system.js), plus what only the server knows.
  function gasShape(g) {
    if (!g || g.balanceKaia == null) return null;
    var tt = g.today || {}, tl = g.total || {};
    return {
      balance: f(g.balanceKaia), rate: f(g.averageDailySpendKaia),
      runway: g.runwayDays == null ? Infinity : +g.runwayDays,
      txToday: (tt.sponsoredTx || 0) + (tt.keeperTx || 0), kaiaToday: f(tt.spentKaia), releasesToday: tt.keeperLotsReleased || 0,
      tx: (tl.sponsoredTx || 0) + (tl.keeperTx || 0), kaia: f(tl.spentKaia),
      address: g.address, floor: f(g.floorKaia), budget: f(g.dailyBudgetKaia), budgetLeft: f(g.budgetLeftTodayKaia),
      active: !!g.sponsorshipActive, since: g.countersSince ? Date.parse(g.countersSince) : null, chainId: g.chainId
    };
  }

  // ---------- build the page state ----------
  function supplyText(wei) {
    var s = window.ethers.formatUnits(wei, 18), p = s.split("."), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return p[1] && p[1] !== "0" ? i + "." + p[1] : i;
  }
  function build(chain, gas, health) {
    var n = now(), lots = [], wallets = {}, perWallet = {}, byKey = {};
    var U = { swapped: 0, credit: 0, instant: 0, locked: 0, releasing: 0, released: 0, overdue: 0 };
    var tot = { nLocked: 0, nReleasing: 0, nReleased: 0, byKeeper: 0, byHolder: 0, nOverdue: 0 };
    var claims = {};
    cache.clm.forEach(function (c) { claims[c.user + ":" + c.lot] = c; });
    cache.mig.forEach(function (m, i) {
      var c = claims[m.user + ":" + m.lot], swappedAt = (m.unlock - LOCK_S) * 1000, unlockAt = m.unlock * 1000;
      perWallet[m.user] = (perWallet[m.user] || 0) + 1;
      var l = {
        id: i + 1, n: m.lot + 1, lotId: m.lot, wallet: m.user, kind: null,
        amount: micro(m.old) / 1e6, newAmount: micro(m.nw) / 1e6, instant: micro(m.inst) / 1e6, locked: micro(m.lock) / 1e6,
        swappedAt: swappedAt, unlockAt: unlockAt,
        releasedAt: c ? (cache.ts[c.b] != null ? cache.ts[c.b] * 1000 : Math.max(unlockAt, n)) : null,
        // the caller of Claimed: the owner itself is a holder claim, anyone else (the keeper) released it for the owner
        releasedBy: c ? (c.caller === m.user ? "holder" : "keeper") : null,
        releasedCaller: c ? c.caller : null,
        txSwap: m.tx, txRelease: c ? c.tx : null
      };
      l.status = c ? "released" : (n >= unlockAt ? "releasing" : "locked");
      l.overdue = l.status === "releasing" && n - unlockAt > HOUR;
      lots.push(l); byKey[m.user + ":" + m.lot] = l;
      var w = wallets[l.wallet] || (wallets[l.wallet] = { addr: l.wallet, total: 0, credit: 0, lots: [], instant: 0, locked: 0, releasing: 0, released: 0, u: { total: 0, credit: 0, instant: 0, locked: 0, releasing: 0, released: 0 } });
      var ul = micro(m.lock);
      w.u.total += micro(m.old); w.u.credit += micro(m.inst) + ul; w.u.instant += micro(m.inst); w.u[l.status] += ul; w.lots.push(l);
      tot["n" + l.status.charAt(0).toUpperCase() + l.status.slice(1)]++;
      if (l.releasedBy === "keeper") tot.byKeeper++; else if (l.releasedBy === "holder") tot.byHolder++;
      if (l.status === "releasing") U.releasing += ul;
      if (l.overdue) { U.overdue += ul; tot.nOverdue++; }
    });
    // Headline sums come from the contract counters (read at the scanned block), the split of the owed part from the events.
    // totalMigrated counts old CT received; totalInstant, totalOwed and totalClaimed count new CT.
    U.swapped = micro(chain.totalMigrated); U.instant = micro(chain.totalInstant); U.released = micro(chain.totalClaimed);
    U.locked = Math.max(0, micro(chain.totalOwed) - U.releasing);
    U.credit = U.instant + micro(chain.totalOwed) + U.released;
    Object.keys(U).forEach(function (k) { tot[k] = U[k] / 1e6; });
    tot.u = U;
    var walletList = Object.keys(wallets).map(function (k) {
      var w = wallets[k]; ["total", "credit", "instant", "locked", "releasing", "released"].forEach(function (x) { w[x] = w.u[x] / 1e6; }); return w;
    });
    return {
      live: true, now: n, lots: lots, wallets: wallets, walletList: walletList, tot: tot, holders: null,
      gas: gas, health: health || null,
      supply: micro(chain.newSupply) / 1e6, supplyText: supplyText(chain.newSupply),
      chain: {
        block: chain.block, totalMigrated: U.swapped / 1e6, totalInstant: U.instant / 1e6, totalOwed: micro(chain.totalOwed) / 1e6,
        totalClaimed: U.released / 1e6, availableReserve: micro(chain.availableReserve) / 1e6,
        newSupply: micro(chain.newSupply) / 1e6, oldSupply: micro(chain.oldSupply) / 1e6, oldSupplyText: supplyText(chain.oldSupply),
        oldHeld: micro(chain.oldHeld) / 1e6, windowStart: C.windowStart, windowEnd: C.windowEnd
      }
    };
  }

  var inflight = null, last = null;
  function load(opts) {
    opts = opts || {};
    if (inflight) return inflight;
    var gasP = opts.gas ? getJson("/api/gas-wallet").then(gasShape, function () { return null; }) : Promise.resolve(null);
    var healthP = opts.health ? getJson("/api/health").catch(function () { return null; }) : Promise.resolve(null);
    var p = Promise.resolve().then(function () {
      setup();
      return provider.getBlockNumber();
    }).then(function (latest) {
      // a few blocks behind the head: a load balanced public node may not have the newest header on every backend yet
      var to = Math.max(net.deployBlock, latest - 3), tag = { blockTag: to };
      if (cache.scanned < net.deployBlock - 1) cache = emptyCache();
      var scanP = to > cache.scanned ? scan(cache.scanned + 1, to).then(function (logs) { addLogs(logs); cache.scanned = to; }) : Promise.resolve();
      var reads = Promise.all([
        swap.totalMigrated(tag), swap.totalInstant(tag), swap.totalOwed(tag), swap.totalClaimed(tag), swap.availableReserve(tag),
        swap.WINDOW_START(), swap.WINDOW_END(), newT.totalSupply(tag), oldT.totalSupply(tag), oldT.balanceOf(net.swap, tag)
      ]);
      return Promise.all([reads, scanP]).then(function (r) {
        var v = r[0];
        return blockTimes().then(function () {
          writeCache(cache);
          C.windowStart = Number(v[5]) * 1000; C.windowEnd = Number(v[6]) * 1000;
          return { block: to, totalMigrated: v[0], totalInstant: v[1], totalOwed: v[2], totalClaimed: v[3], availableReserve: v[4], newSupply: v[7], oldSupply: v[8], oldHeld: v[9] };
        });
      });
    }).then(function (chain) {
      return Promise.all([gasP, healthP]).then(function (g) {
        last = build(chain, g[0], g[1]);
        api.state = last; api.lastRead = Date.now();
        return last;
      });
    });
    inflight = p.then(function (s) { inflight = null; return s; }, function (e) { inflight = null; throw e; });
    return inflight;
  }

  // ---------- one lot's swap track on the real clock (the same markup as CJ.track in system.js) ----------
  function track(el, lot, opts) {
    opts = opts || {};
    var t = CJ.t, F = CJ.fmt, I = CJ.icon, days = C.lockDays || 7, html = "", n = now();
    var status = lot.releasedAt ? "released" : n >= lot.unlockAt ? "releasing" : "locked";
    var done = status !== "locked", elapsed = Math.max(0, Math.min(days, (n - lot.swappedAt) / DAY));
    for (var i = 0; i < days; i++) {
      var cls = "track-day";
      if (done || elapsed >= i + 1) cls += " is-full"; else if (elapsed > i) cls += " is-today";
      var part = !done && elapsed > i && elapsed < i + 1 ? ' style="--part:' + (elapsed - i).toFixed(3) + '"' : "";
      html += '<span class="' + cls + '"' + part + "></span>";
    }
    var by = lot.releasedBy === "holder" ? "track.by_holder" : "track.by_keeper";
    var leftCap = t("track.swapped", { date: F.lotTime(lot.swappedAt) });
    var rightCap = status === "locked" ? t("track.unlocks", { date: F.date(lot.unlockAt) }) : status === "releasing" ? t("track.sending") : t("track.released", { date: F.date(lot.releasedAt) });
    var mid = status === "locked" ? t("track.left_days", { rel: rel(lot.unlockAt) }) : status === "releasing" ? t("track.mid_ready") : t(by);
    var a = F.amount(lot.amount), ai = F.amount(lot.instant), al = F.amount(lot.locked);
    el.className = "track" + (opts.large ? " track-lg" : "") + (status === "releasing" ? " is-ready" : "") + (status === "released" ? " is-released" : "");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", t("track.aria", { amount: a, instant: ai, locked: al, right: rightCap, mid: mid }));
    el.innerHTML =
      '<div class="track-end"><span class="track-cap">' + leftCap + '</span><span class="track-amt"><span class="num">' + a + '</span> <span class="track-unit">' + t("unit.old") + "</span></span></div>" +
      '<div class="track-end r"><span class="track-cap">' + rightCap + '</span><span class="track-amt"><span class="num">' + al + '</span> <span class="track-unit">' + t("unit.new") + "</span></span></div>" +
      '<div class="track-rail"><span class="track-now"></span>' + html + "</div>" +
      '<div class="track-foot"><span class="track-end track-instant"><span class="track-cap">' + t("track.now_done") + '</span><span class="track-amt"><span class="num">' + ai + '</span> <span class="track-unit">' + t("unit.new") + "</span></span></span>" +
      '<span class="track-mid">' + I(status === "released" ? "check" : done ? "unlock" : "lock", 14) + "<span>" + mid + "</span></span></div>";
  }

  var api = {
    on: on, net: net, now: now, rel: rel, windowState: windowState, daysLeft: daysLeft,
    load: load, track: track, fixLinks: fixLinks, state: null, lastRead: 0,
    reset: function () { cache = emptyCache(); writeCache(cache); }
  };
  CJ.liveStats = api;
})();
