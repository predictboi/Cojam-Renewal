// Cojam live chain module: wallet connection, reads and writes against the contracts named in CJ.net (assets/network.js).
// Exposes CJ.chain. It fills the same ledger shape the mock uses (CJ.ledger.setLive, then a cj:ledger event), so the swap
// app and the header button read live data without knowing where it came from. The status page may read CJ.chain.read*.
//
// Load order on /migrate/: system.js, network.js, i18n/shell.js and shell.js at the top; at the end of <body>
// vendor/ethers-6.17.0.umd.min.js, this file, then wallet.js, i18n/migrate.js and pages/migrate.js.
// Does nothing when CJ.live is false (?mock=1, a ?state= preset, or a network without a deployed swap).
//
// Wallet paths (docs/FEE-DELEGATION.md sections 1 and 2):
// - Kaia Wallet (window.klaytn, or an EIP-6963 provider whose rdns or name says Kaia). Approve, migrate and claim are signed
//   as TxTypeFeeDelegatedSmartContractExecution (0x31) with klay_signTransaction through @kaiachain/ethers-ext
//   (vendor/kaia-ethers-ext.v6.bundle.js, loaded on first use only), then POSTed as {rawTransaction} to
//   <gasApi>/api/fee-delegate. The server checks it, co-signs as fee payer and broadcasts; it answers {txHash, action}
//   or {error: {code, message, txHash?}}. The holder needs no KAIA.
// - Kaia Wallet paying its own fee (the holder chose "Pay the fee myself" after a fee payer error): a plain
//   TxTypeSmartContractExecution (0x30) sent by the wallet with klay_sendTransaction.
// - MetaMask and any other EIP-1193 wallet: eth_sendTransaction, paid in KAIA. MetaMask cannot sign 0x31.
// - WalletConnect: not wired yet (needs a WalletConnect project ID); the chooser shows it as coming soon.
//
// Testing: ?gasapi=http://localhost:PORT points the fee payer calls at a local server, only on a localhost origin.
(function () {
  var CJ = window.CJ;
  if (!CJ || !CJ.net || !CJ.live || !window.ethers) {
    if (CJ && CJ.ledger && CJ.ledger.setMode) CJ.ledger.setMode(false);
    return;
  }
  var E = window.ethers, net = CJ.net, C = CJ.config;
  var params = new URLSearchParams(location.search);
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var GAS_API = (LOCAL && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(params.get("gasapi") || "") ? params.get("gasapi") : net.gasApi).replace(/\/$/, "");
  var ROOT = (document.body && document.body.dataset.root) || "../";
  var LAST_KEY = "cj.wallet.last";
  // Server caps (server/.env.example): gas limit 120,000 for approve and 600,000 for swap calls, gas price 50 gkei.
  var CAP = { approve: 120000n, swap: 600000n, gasPrice: 50000000000n };
  // Typical gas per step, for the self paid fee estimate shown before signing (docs/FEE-DELEGATION.md section 4).
  var TYPICAL = { approve: 62000, swap: 240000, claim: 110000 };

  // ---------- point the shared config at the live network ----------
  C.chainId = net.chainId;
  C.chainName = net.name;
  C.explorer = net.explorer;
  C.oldToken.address = net.oldToken;
  C.newToken.address = net.newToken;
  C.swapContract.address = net.swap;
  if (CJ.ledger.setMode) CJ.ledger.setMode(true);

  var ERC20 = new E.Interface([
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
    "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)"
  ]);
  var SWAP = new E.Interface([
    "function migrate(uint256 amount) returns (uint256 lotId)",
    "function claim(uint256 maxLots) returns (uint256 amount)",
    "function lotCount(address user) view returns (uint256)",
    // amount: the lot's locked 90%, in new CT
    "function lotOf(address user, uint256 lotId) view returns (uint256 amount, uint256 unlockAt, bool claimed)",
    "function nextClaimIndex(address user) view returns (uint256)",
    "function availableReserve() view returns (uint256)",
    // exact result for oldAmount arriving: credit = oldAmount * 2 / 5, instant = credit * 10 / 100, locked = the rest
    "function previewSwap(uint256 oldAmount) view returns (uint256 credit, uint256 instant, uint256 locked)",
    "function WINDOW_START() view returns (uint256)",
    "function WINDOW_END() view returns (uint256)",
    "function LOCK_PERIOD() view returns (uint256)",
    // newAmount = oldAmount * 2 / 5 rounded down; instantAmount + lockedAmount = newAmount (10% now, 90% locked)
    "event Migrated(address indexed user, uint256 indexed lotId, uint256 oldAmount, uint256 newAmount, uint256 instantAmount, uint256 lockedAmount, uint256 unlockAt)",
    "event Claimed(address indexed user, uint256 indexed lotId, uint256 amount, address indexed caller)",
    "error ZeroAmount()", "error AmountTooSmall()", "error WindowClosed()", "error InsufficientReserve(uint256 available, uint256 needed)",
    "error NothingReceived()", "error ReceivedMoreThanSent()", "error NothingToClaim()", "error NotMaster()"
  ]);
  var rp = new E.JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true, batchMaxCount: 20 });
  var oldC = new E.Contract(net.oldToken, ERC20, rp), newC = new E.Contract(net.newToken, ERC20, rp), swapC = new E.Contract(net.swap, SWAP, rp);
  // The first Kairos rehearsal contracts swapped 1:1 and emitted Migrated without newAmount: still read, as newAmount = oldAmount.
  var LEGACY = new E.Interface(["event Migrated(address indexed user, uint256 indexed lotId, uint256 oldAmount, uint256 instantAmount, uint256 lockedAmount, uint256 unlockAt)"]);
  var T_MIGRATED = SWAP.getEvent("Migrated").topicHash, T_MIGRATED_V1 = LEGACY.getEvent("Migrated").topicHash, T_CLAIMED = SWAP.getEvent("Claimed").topicHash;

  function num(wei) { return Number(E.formatUnits(wei, 18)); }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function err(kind, code, extra) { var e = new Error(code || kind); e.cj = kind; e.code = code || kind; if (extra) Object.assign(e, extra); return e; }

  // ---------- providers: EIP-6963 discovery plus the injected globals ----------
  var found = {}; // kind -> {provider, info}
  function kindOf(info, p) {
    var s = ((info && info.rdns) || "") + " " + ((info && info.name) || "");
    if (/kaia|kaikas|klutch/i.test(s) || (p && p.isKaikas)) return "kaia";
    if (/^io\.metamask/i.test((info && info.rdns) || "") || (p && p.isMetaMask && !p.isKaikas && !(info && info.rdns))) return "mm";
    return "web3";
  }
  window.addEventListener("eip6963:announceProvider", function (e) {
    var d = e.detail; if (!d || !d.provider) return;
    var k = kindOf(d.info, d.provider);
    if (!found[k]) found[k] = { provider: d.provider, info: d.info || {} };
  });
  try { window.dispatchEvent(new Event("eip6963:requestProvider")); } catch (e) {}
  function providerFor(kind) {
    var eth = window.ethereum;
    if (kind === "kaia") return window.klaytn || window.kaia || (found.kaia && found.kaia.provider) || null;
    if (kind === "mm") {
      if (found.mm) return found.mm.provider;
      if (eth && eth.providers && eth.providers.length) { var m = eth.providers.filter(function (p) { return p.isMetaMask && !p.isKaikas; })[0]; if (m) return m; }
      return eth && eth.isMetaMask && !eth.isKaikas ? eth : null;
    }
    return (found.web3 && found.web3.provider) || eth || null;
  }
  // Kinds this browser offers, for the chooser (wallet.js).
  function available() {
    var out = [], eth = window.ethereum;
    if (providerFor("kaia")) out.push("kaia");
    if (providerFor("mm")) out.push("mm");
    if (found.web3 || (eth && !eth.isMetaMask && !eth.isKaikas && eth !== window.klaytn)) out.push("web3");
    return out;
  }
  function req(p, method, prm) {
    if (p.request) return p.request({ method: method, params: prm || [] });
    return new Promise(function (res, rej) {
      p.sendAsync({ jsonrpc: "2.0", id: Date.now(), method: method, params: prm || [] }, function (e, r) { if (e || (r && r.error)) rej(e || r.error); else res(r && r.result); });
    });
  }

  // ---------- errors ----------
  function msgOf(e) {
    var parts = [];
    for (var x = e, i = 0; x && i < 5; i++, x = x.error || x.info && x.info.error || x.cause) parts.push(String(x.message || x.reason || x.shortMessage || ""));
    return parts.join(" | ");
  }
  function codeOf(e) {
    for (var x = e, i = 0; x && i < 5; i++, x = x.error || x.info && x.info.error || x.cause) if (x.code != null && x.code !== "UNKNOWN_ERROR") return x.code;
    return null;
  }
  function isRejected(e) {
    var c = codeOf(e);
    return c === 4001 || c === "ACTION_REJECTED" || /user (rejected|denied|cancel)|rejected by (the )?user|denied (transaction|request)|request rejected|user cancel/i.test(msgOf(e));
  }
  // Revert data, wherever the wallet or node put it.
  function revertData(e) {
    for (var x = e, i = 0; x && i < 6; i++, x = x.error || x.info && x.info.error || x.cause) {
      var d = x.data;
      if (d && typeof d === "object" && typeof d.data === "string") d = d.data;
      if (typeof d === "string" && /^0x[0-9a-f]{8}/i.test(d)) return d;
    }
    return null;
  }
  function decodeRevert(e) {
    var d = revertData(e); if (!d) return null;
    try { return SWAP.parseError(d).name; } catch (x) {}
    try { return ERC20.parseError(d).name; } catch (x) {}
    return "unknown";
  }
  function revertKind(name) {
    return name === "InsufficientReserve" ? "reserve" : name === "WindowClosed" ? "closed" : name === "NothingToClaim" ? "nothing"
      : name === "AmountTooSmall" ? "small" : "failed";
  }
  // One word for the page: rejected | sponsor | reserve | closed | nothing | small | network | nogas | rpc | failed | noprovider | switch
  function classify(e) {
    if (!e) return "failed";
    if (e.cj) return e.cj;
    if (isRejected(e)) return "rejected";
    var m = msgOf(e);
    if (/insufficient funds|insufficient balance for (gas|transfer)|not enough (kaia|klay|balance)/i.test(m)) return "nogas";
    var r = decodeRevert(e); if (r) return revertKind(r);
    var c = codeOf(e);
    if (c === "NETWORK_ERROR" || c === "TIMEOUT" || c === "SERVER_ERROR" || /failed to fetch|network ?error|timeout/i.test(m)) return "rpc";
    return "failed";
  }

  // ---------- state ----------
  var S = { kind: null, p: null, address: null, chainId: null, off: null };
  var info = null; // contract constants
  var gasPriceWei = 27500000000n;

  function contractInfo() {
    if (info) return Promise.resolve(info);
    return Promise.all([swapC.WINDOW_START(), swapC.WINDOW_END(), swapC.LOCK_PERIOD()]).then(function (r) {
      info = { start: Number(r[0]) * 1000, end: Number(r[1]) * 1000, lock: Number(r[2]) };
      C.windowStart = info.start; C.windowEnd = info.end; C.lockDays = Math.round(info.lock / 86400) || C.lockDays;
      return info;
    });
  }

  // ---------- history from chain events (cached per address: tx hashes never change) ----------
  function evKey(a) { return "cj.live.ev2." + net.chainId + "." + net.swap.toLowerCase() + "." + a.toLowerCase(); }
  function userTopic(a) { return E.zeroPadValue(a.toLowerCase(), 32); }
  function logs(from, to, topic0, user, lotId) {
    var topics = [topic0 === T_MIGRATED ? [T_MIGRATED, T_MIGRATED_V1] : topic0, userTopic(user)]; if (lotId != null) topics.push(E.toBeHex(lotId, 32));
    return rp.getLogs({ address: net.swap, fromBlock: from, toBlock: to, topics: topics });
  }
  function eat(cache, list) {
    var blocks = {};
    list.forEach(function (l) {
      var ev = null, v1 = false;
      try { ev = SWAP.parseLog(l); } catch (e) {}
      if (!ev) { try { ev = LEGACY.parseLog(l); v1 = true; } catch (e) {} }
      if (!ev) return;
      var id = String(ev.args.lotId);
      if (ev.name === "Migrated") {
        var a = ev.args;
        cache.m[id] = { tx: l.transactionHash, old: a.oldAmount.toString(), nw: (v1 ? a.oldAmount : a.newAmount).toString(), inst: a.instantAmount.toString() };
      }
      else { cache.c[id] = { tx: l.transactionHash, by: ev.args.caller.toLowerCase() === ev.args.user.toLowerCase() ? "you" : "keeper", block: l.blockNumber }; blocks[l.blockNumber] = 1; }
    });
    return Promise.all(Object.keys(blocks).map(function (b) {
      return rp.getBlock(Number(b)).then(function (blk) {
        Object.keys(cache.c).forEach(function (k) { if (cache.c[k].block === Number(b) && blk) cache.c[k].at = Number(blk.timestamp) * 1000; });
      }, function () {});
    }));
  }
  // One query from the last scanned block to the latest for this wallet's Migrated and Claimed events. If the node refuses
  // the range, fall back to narrow searches around each lot's known time (Kaia makes one block a second).
  function history(addr, lotsRaw, latest) {
    var cache = load(evKey(addr)) || { m: {}, c: {}, scanned: net.deployBlock - 1 };
    var from = Math.max(net.deployBlock, (cache.scanned || 0) + 1);
    var need = lotsRaw.some(function (l) { return !cache.m[l.id] || (l.claimed && !cache.c[l.id]); });
    if (!need || from > latest.number) return Promise.resolve(cache);
    return rp.getLogs({ address: net.swap, fromBlock: from, toBlock: latest.number, topics: [[T_MIGRATED, T_MIGRATED_V1, T_CLAIMED], userTopic(addr)] })
      .then(function (list) { return eat(cache, list).then(function () { cache.scanned = latest.number; }); }, function () { return narrow(addr, cache, lotsRaw, latest); })
      .then(function () { store(evKey(addr), cache); return cache; }, function () { return cache; });
  }
  function narrow(addr, cache, lotsRaw, latest) {
    var lt = Number(latest.timestamp);
    function blockAt(sec) { return Math.max(net.deployBlock, Math.min(latest.number, latest.number - (lt - sec))); }
    return Promise.all(lotsRaw.map(function (l) {
      var jobs = [];
      if (!cache.m[l.id]) { var b = blockAt(l.unlockSec - info.lock); jobs.push(logs(b - 600, Math.min(latest.number, b + 600), T_MIGRATED, addr, l.id).then(function (x) { return eat(cache, x); })); }
      if (l.claimed && !cache.c[l.id]) {
        var u = blockAt(l.unlockSec), tries = 0;
        var step = function (s) {
          if (s > latest.number || tries++ > 12) return null;
          return logs(s, Math.min(latest.number, s + 4999), T_CLAIMED, addr, l.id).then(function (x) { return x.length ? eat(cache, x) : step(s + 5000); });
        };
        jobs.push(step(u));
      }
      return Promise.all(jobs).catch(function () {});
    }));
  }

  // ---------- reads ----------
  function fresh() {
    return {
      live: true, loaded: false,
      wallet: { connected: false, address: "", network: "kaia", chainId: null, kaia: 0, kind: null, app: null },
      oldCT: 0, newCT: 0, allowance: 0, wei: { old: "0", "new": "0", allowance: "0", kaia: "0" },
      lots: [], contract: { paused: false, reserveEmpty: false, sponsorDown: false, reserve: 0, reserveNeed: null },
      gas: null
    };
  }
  function base() {
    var L = fresh(), cur = CJ.ledger.get();
    L.wallet.connected = !!S.address; L.wallet.address = S.address || "";
    L.wallet.kind = L.wallet.app = S.kind; L.wallet.chainId = S.chainId;
    L.wallet.network = S.chainId == null || S.chainId === net.chainId ? "kaia" : "other";
    if (cur && cur.live && cur.wallet.address && S.address && cur.wallet.address.toLowerCase() === S.address.toLowerCase()) {
      // keep what was read last until the new read lands
      ["oldCT", "newCT", "allowance", "wei", "lots", "gas", "loaded"].forEach(function (k) { L[k] = cur[k]; });
      L.wallet.kaia = cur.wallet.kaia; L.contract = Object.assign({}, cur.contract);
    }
    return L;
  }
  function publish(L) { CJ.ledger.setLive(L); }

  // Read everything the swap page shows for addr.
  function readWallet(addr) {
    return Promise.all([
      contractInfo(), oldC.balanceOf(addr), oldC.allowance(addr, net.swap), newC.balanceOf(addr), rp.getBalance(addr),
      swapC.lotCount(addr), swapC.nextClaimIndex(addr), swapC.availableReserve(), rp.getBlock("latest"), rp.send("eth_gasPrice", [])
    ]).then(function (r) {
      var count = Number(r[5]), next = Number(r[6]), latest = r[8], ids = [];
      for (var i = 0; i < count; i++) ids.push(i);
      return Promise.all(ids.map(function (i) { return swapC.lotOf(addr, i); })).then(function (raw) {
        var lotsRaw = raw.map(function (x, i) { return { id: String(i), locked: x[0], unlockSec: Number(x[1]), claimed: x[2] || i < next }; });
        return history(addr, lotsRaw, latest).then(function (ev) {
          return { old: r[1], allowance: r[2], nw: r[3], kaia: r[4], reserve: r[7], gasPrice: BigInt(r[9]), lots: lotsRaw, ev: ev, next: next };
        });
      });
    });
  }
  function toLots(d) {
    return d.lots.map(function (l) {
      var m = d.ev.m[l.id], c = d.ev.c[l.id];
      // lotOf gives the locked new CT. Without the event, rebuild the split from it (locked = credit - floor(credit / 10))
      // and the old CT from the rate (credit = floor(old * 2 / 5), so this is the smallest old amount that gives it).
      var inst = m ? BigInt(m.inst) : (l.locked * 10n + 8n) / 9n - l.locked;
      var credit = m && m.nw ? BigInt(m.nw) : inst + l.locked;
      var old = m ? BigInt(m.old) : (credit * BigInt(C.ratioDen) + BigInt(C.ratioNum) - 1n) / BigInt(C.ratioNum);
      var unlockAt = l.unlockSec * 1000;
      return {
        id: l.id, amount: num(old), newAmount: num(credit), instant: num(inst), locked: num(l.locked),
        swappedAt: unlockAt - info.lock * 1000, unlockAt: unlockAt,
        releasedAt: l.claimed ? (c && c.at ? c.at : unlockAt) : null, releasedBy: l.claimed ? (c ? c.by : "keeper") : null,
        txSwap: m ? m.tx : null, txRelease: l.claimed && c ? c.tx : null
      };
    }).reverse();
  }

  var busy = null, again = false;
  // refresh(opts): read the chain for the connected wallet and publish. opts.until(ledger) retries a few times while it
  // returns false (a node one block behind right after a receipt). Resolves to the ledger; rejects only on read errors.
  function refresh(opts) {
    opts = opts || {};
    if (!S.address) { var L0 = base(); L0.loaded = true; publish(L0); return Promise.resolve(L0); }
    if (busy && !opts.until) { again = true; return busy; }
    var addr = S.address, tries = 0;
    var run = function () {
      return readWallet(addr).then(function (d) {
        if (!S.address || S.address !== addr) return CJ.ledger.get();
        var L = base(), cur = CJ.ledger.get();
        L.loaded = true;
        L.wei = { old: d.old.toString(), "new": d.nw.toString(), allowance: d.allowance.toString(), kaia: d.kaia.toString() };
        L.oldCT = num(d.old); L.newCT = num(d.nw); L.allowance = num(d.allowance); L.wallet.kaia = num(d.kaia);
        L.lots = toLots(d);
        var need = cur && cur.contract && cur.contract.reserveNeed ? BigInt(cur.contract.reserveNeed) : null;
        L.contract.reserve = num(d.reserve);
        L.contract.reserveEmpty = d.reserve === 0n || (need != null && d.reserve < need);
        L.contract.reserveNeed = L.contract.reserveEmpty && need != null ? need.toString() : null;
        gasPriceWei = d.gasPrice;
        var gp = num(d.gasPrice);
        L.gas = { approve: TYPICAL.approve * gp, swap: TYPICAL.swap * gp, claim: TYPICAL.claim * gp };
        if (opts.until && !opts.until(L) && ++tries < 6) return new Promise(function (r) { setTimeout(r, 1500); }).then(run);
        publish(L);
        return L;
      });
    };
    var p = run();
    if (!opts.until) {
      busy = p.then(function (L) { busy = null; if (again) { again = false; refresh(); } return L; }, function (e) { busy = null; again = false; throw e; });
      return busy;
    }
    return p;
  }

  // ---------- connection ----------
  function detach() {
    if (S.off) { try { S.off(); } catch (e) {} }
    S.off = null;
  }
  function attach(p) {
    detach();
    var onAcc = function (a) {
      a = Array.isArray(a) ? a : [];
      if (!a.length) { disconnect(); fire("accounts", null); return; }
      var next = E.getAddress(a[0]);
      if (S.address && next.toLowerCase() === S.address.toLowerCase()) return;
      S.address = next; publish(base()); fire("accounts", next); refresh().catch(function () { fire("readerror"); });
    };
    var onChain = function (c) {
      var id = typeof c === "string" && /^0x/i.test(c) ? parseInt(c, 16) : Number(c);
      if (!id || id === S.chainId) return;
      S.chainId = id; publish(base()); fire("chain", id);
      if (id === net.chainId) refresh().catch(function () { fire("readerror"); });
    };
    if (p.on) {
      p.on("accountsChanged", onAcc); p.on("chainChanged", onChain); p.on("networkChanged", onChain);
      S.off = function () {
        var rm = p.removeListener || p.off; if (!rm) return;
        rm.call(p, "accountsChanged", onAcc); rm.call(p, "chainChanged", onChain); rm.call(p, "networkChanged", onChain);
      };
    }
  }
  function chainIdOf(p) {
    return req(p, "eth_chainId").then(function (c) { return parseInt(c, 16) || Number(c); }, function () {
      return req(p, "klay_chainID").then(function (c) { return parseInt(c, 16) || Number(c); }, function () { return Number(p.networkVersion || p.chainId) || null; });
    });
  }
  function accounts(p, kind, silent) {
    if (silent) {
      return req(p, "eth_accounts").then(null, function () { return kind === "kaia" ? req(p, "klay_accounts") : []; })
        .then(function (a) { return a && a.length ? a : (kind === "kaia" && p.selectedAddress ? [p.selectedAddress] : []); }, function () { return []; });
    }
    return req(p, "eth_requestAccounts").then(null, function (e) {
      if (isRejected(e) || kind !== "kaia") throw e;
      return req(p, "klay_requestAccounts").then(null, function (e2) { if (isRejected(e2) || !p.enable) throw e2; return p.enable(); });
    });
  }
  // connect(kind, {silent}): asks the wallet for its account (silent: only if this site is already authorised), reads the
  // chain id and the balances, and remembers the wallet for the next visit. Resolves {address, chainId, readError} or null
  // when silent and not authorised.
  function connect(kind, opts) {
    opts = opts || {};
    var p = providerFor(kind);
    if (!p) return opts.silent ? Promise.resolve(null) : Promise.reject(err("noprovider"));
    return accounts(p, kind, opts.silent).then(function (a) {
      if (!a || !a.length) { if (opts.silent) return null; throw err("failed", "NO_ACCOUNT"); }
      return chainIdOf(p).then(function (id) {
        S.kind = kind; S.p = p; S.address = E.getAddress(a[0]); S.chainId = id;
        attach(p); store(LAST_KEY, kind);
        publish(base());
        if (id !== net.chainId) return { address: S.address, chainId: id };
        return refresh().then(function () { return { address: S.address, chainId: id }; }, function (e) { return { address: S.address, chainId: id, readError: e }; });
      });
    });
  }
  function restore() {
    var kind = load(LAST_KEY);
    if (!kind || !providerFor(kind)) return Promise.resolve(null);
    return connect(kind, { silent: true }).catch(function () { return null; });
  }
  function disconnect() {
    detach();
    S.kind = S.p = S.address = S.chainId = null;
    store(LAST_KEY, null);
    var L = fresh(); L.loaded = true; publish(L);
  }
  function remembered() { return load(LAST_KEY); }

  // Switch the wallet to CJ.net: wallet_switchEthereumChain, then the Kaia names, then add the chain and switch.
  function switchNetwork() {
    var p = S.p; if (!p) return Promise.reject(err("noprovider"));
    var add = [{ chainId: net.chainHex, chainName: net.name, rpcUrls: [net.rpc], nativeCurrency: net.nativeCurrency, blockExplorerUrls: [net.explorer] }];
    var sw = [{ chainId: net.chainHex }];
    function check() {
      return chainIdOf(p).then(function (id) {
        if (id !== S.chainId) { S.chainId = id; publish(base()); }
        if (id !== net.chainId) throw err("switch");
        return refresh().catch(function () {});
      });
    }
    function tryAll(list) {
      var i = 0, last = null;
      var next = function () {
        if (i >= list.length) return Promise.reject(last || err("switch"));
        var m = list[i++];
        return req(p, m[0], m[1]).then(function () { return true; }, function (e) { if (isRejected(e)) throw e; last = e; return next(); });
      };
      return next();
    }
    return tryAll([["wallet_switchEthereumChain", sw], ["wallet_switchKlaytnChain", sw]])
      .then(null, function (e) {
        if (isRejected(e)) throw e;
        return tryAll([["wallet_addEthereumChain", add], ["wallet_addKlaytnChain", add]]).then(function () {
          return tryAll([["wallet_switchEthereumChain", sw], ["wallet_switchKlaytnChain", sw]]).catch(function () {});
        });
      })
      .then(check, function (e) { if (isRejected(e)) throw e; return check(); });
  }

  // ---------- writes ----------
  var kaiaExt = null;
  function loadExt() {
    if (window.ethers_ext) return Promise.resolve(window.ethers_ext);
    if (kaiaExt) return kaiaExt;
    kaiaExt = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = ROOT + "assets/vendor/kaia-ethers-ext.v6.bundle.js"; s.async = true;
      s.onload = function () { if (window.ethers_ext) res(window.ethers_ext); else rej(err("failed", "EXT_MISSING")); };
      s.onerror = function () { kaiaExt = null; rej(err("rpc", "EXT_LOAD")); };
      document.head.appendChild(s);
    });
    return kaiaExt;
  }
  function call(action, args) {
    if (action === "approve") return { to: net.oldToken, data: ERC20.encodeFunctionData("approve", [net.swap, args.amount]), cap: CAP.approve };
    if (action === "migrate") return { to: net.swap, data: SWAP.encodeFunctionData("migrate", [args.amount]), cap: CAP.swap };
    if (action === "claim") return { to: net.swap, data: SWAP.encodeFunctionData("claim", [args.maxLots]), cap: CAP.swap };
    throw err("failed", "UNKNOWN_ACTION");
  }
  // Ask the gas server to co-sign and send. Every error code of docs/FEE-DELEGATION.md section 3 lands on a page word.
  function sponsor(raw, action, args, from) {
    return fetch(GAS_API + "/api/fee-delegate", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rawTransaction: raw })
    }).then(function (r) {
      return r.json().then(null, function () { return {}; }).then(function (b) {
        if (r.ok && b && b.txHash) return b.txHash;
        var e = (b && b.error) || {}, code = e.code || "HTTP_" + r.status;
        if (code === "BROADCAST_UNCERTAIN" && e.txHash) return e.txHash; // sent, the node did not confirm: follow the hash
        if (code === "CHAIN_ID_MISMATCH") throw err("network", code);
        if (code === "SIMULATION_FAILED" || code === "BROADCAST_REJECTED" || code === "GAS_LIMIT_TOO_LOW") {
          // The call would revert: ask the node why, from the holder's address.
          var c = call(action, args);
          return rp.estimateGas({ from: from, to: c.to, data: c.data }).then(function () { throw err("sponsor", code); }, function (x) {
            var n = decodeRevert(x); throw err(n ? revertKind(n) : "sponsor", code, { revert: n });
          });
        }
        throw err("sponsor", code, { status: r.status });
      });
    }, function () { throw err("sponsor", "UNREACHABLE"); });
  }
  function waitReceipt(hash) {
    var t0 = Date.now(), n = 0;
    return new Promise(function (res, rej) {
      (function poll() {
        rp.getTransactionReceipt(hash).then(function (r) { if (r) res(r); else next(); }, next);
        function next() {
          if (Date.now() - t0 > 5 * 60000) { rej(err("failed", "RECEIPT_TIMEOUT", { hash: hash })); return; }
          setTimeout(poll, Math.min(4000, 1000 + 250 * n++));
        }
      })();
    });
  }
  // write(action, args, opts): action approve {amount: bigint} | migrate {amount} | claim {maxLots}.
  // opts.sponsored: Kaia fee delegation through the gas API; otherwise the wallet sends and pays.
  // opts.onHash(hash) fires once the transaction is on its way. Resolves {hash, receipt, lotId}.
  function write(action, args, opts) {
    opts = opts || {};
    var p = S.p, from = S.address;
    if (!p || !from) return Promise.reject(err("noprovider"));
    var c = call(action, args);
    return chainIdOf(p).then(function (id) {
      if (id !== S.chainId) { S.chainId = id; publish(base()); }
      if (id !== net.chainId) throw err("network");
      // Simulate first: a revert costs nothing here and tells the page exactly why (reserve, window, already released).
      return rp.estimateGas({ from: from, to: c.to, data: c.data }).then(null, function (e) {
        if (classify(e) === "rpc") throw err("rpc", "ESTIMATE_RPC");
        var n = decodeRevert(e); throw err(n ? revertKind(n) : "failed", "SIMULATION", { revert: n });
      });
    }).then(function (est) {
      var gas = est * 13n / 10n + 15000n;
      if (opts.sponsored) {
        if (gas > c.cap) gas = c.cap;
        if (gasPriceWei > CAP.gasPrice) throw err("sponsor", "GAS_PRICE_TOO_HIGH");
        if (S.kind !== "kaia") throw err("sponsor", "WALLET_CANNOT_SIGN");
        return loadExt().then(function (X) {
          var kp = new X.Web3Provider(p);
          return kp.getSigner(from).then(function (signer) {
            return signer.signTransaction({ type: X.TxType.FeeDelegatedSmartContractExecution, from: from, to: c.to, data: c.data, value: 0, gasLimit: gas, gasPrice: gasPriceWei });
          });
        }).then(function (raw) {
          if (typeof raw !== "string" || !/^0x31/i.test(raw)) throw err("sponsor", "WALLET_CANNOT_SIGN");
          if (opts.onSigned) opts.onSigned();
          return sponsor(raw, action, args, from);
        });
      }
      if (S.kind === "kaia") {
        return loadExt().then(function (X) {
          var kp = new X.Web3Provider(p);
          return kp.getSigner(from).then(function (signer) {
            return signer.sendUncheckedTransaction({ type: X.TxType.SmartContractExecution, from: from, to: c.to, data: c.data, value: 0, gasLimit: gas });
          });
        });
      }
      return req(p, "eth_sendTransaction", [{ from: from, to: c.to, data: c.data, value: "0x0", gas: E.toQuantity(gas) }]);
    }).then(function (hash) {
      if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) throw err("failed", "NO_HASH");
      if (opts.onHash) opts.onHash(hash);
      return waitReceipt(hash).then(function (rc) {
        if (rc.status === 0) {
          // Replay the call to learn why (the reserve may have been used up between the check and the block).
          return rp.estimateGas({ from: from, to: c.to, data: c.data }).then(function () { throw err("failed", "REVERTED", { hash: hash }); }, function (x) {
            var n = decodeRevert(x); throw err(n ? revertKind(n) : "failed", "REVERTED", { hash: hash });
          });
        }
        var lotId = null;
        rc.logs.forEach(function (l) {
          if (l.address.toLowerCase() !== net.swap.toLowerCase()) return;
          try { var ev = SWAP.parseLog(l); if (ev && ev.name === "Migrated") lotId = String(ev.args.lotId); } catch (e) {}
        });
        return { hash: hash, receipt: rc, lotId: lotId };
      });
    });
  }

  // Show new CT in the wallet's token list.
  function watchAsset() {
    if (!S.p) return Promise.reject(err("noprovider"));
    return req(S.p, "wallet_watchAsset", { type: "ERC20", options: { address: net.newToken, symbol: "CT", decimals: 18 } });
  }

  // The contract's own preview of a swap of oldWei base units: {credit, instant, locked} as BigInt. The page computes the
  // same thing locally (CJ.split with the wei amount); this is for checks against the deployed contract.
  function previewSwap(oldWei) {
    return swapC.previewSwap(oldWei).then(function (r) { return { credit: r[0], instant: r[1], locked: r[2] }; });
  }

  // Exact amount helpers: the page keeps numbers for display and these for the transaction.
  function toWei(text) {
    var s = String(text == null ? "" : text).trim().replace(/\s*(old\s*)?ct$/i, "").replace(/,/g, "").replace(/\s/g, "");
    try { return E.parseUnits(s, 18); } catch (e) { return null; }
  }

  // ---------- events to the page ----------
  var subs = [];
  function on(fn) { subs.push(fn); }
  function fire(type, v) { subs.forEach(function (f) { try { f(type, v); } catch (e) {} }); }

  // Keep the page current: every 30 s while connected and visible, and when the tab comes back.
  setInterval(function () { if (S.address && S.chainId === net.chainId && !document.hidden) refresh().catch(function () {}); }, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && S.address && S.chainId === net.chainId) refresh().catch(function () {}); });

  CJ.chain = {
    net: net, gasApi: GAS_API, provider: rp, interfaces: { erc20: ERC20, swap: SWAP },
    available: available, providerFor: providerFor, remembered: remembered,
    connect: connect, restore: restore, disconnect: disconnect, switchNetwork: switchNetwork,
    refresh: refresh, contractInfo: contractInfo, readWallet: readWallet,
    write: write, watchAsset: watchAsset, previewSwap: previewSwap, classify: classify, toWei: toWei, on: on,
    state: function () { return { kind: S.kind, address: S.address, chainId: S.chainId }; }
  };
})();
