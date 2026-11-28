/* AD2 Reward settings. States: none | editing | invalid | review | connect | wrongwallet | signing | proposed | failed | ready | cancel | loading | error */
(function () {
  "use strict";
  var X = Admin, D = AD, n = X.n, tag = X.tag, ic = X.ic, esc = X.esc;
  var hasPending = !X.is("none", "editing", "invalid", "review", "connect", "wrongwallet", "signing", "failed"), ready = X.is("ready");
  /* the edits shown in the editing states: two contract values (48 hour delay), one server setting (at once), one staking rate (new stakes) */
  var EDIT = X.is("editing", "invalid", "review", "connect", "wrongwallet", "signing", "failed") ? { capuser: "30", ref: "12", invday: "20", "rate-90-0": "11.50" } : {};
  if (X.is("invalid")) EDIT = { capuser: "30", minconv: "1,500", reviewat: "85" };
  var BAD = X.is("invalid") ? { minconv: 1, reviewat: 1 } : {};
  var pend = {}; if (hasPending) D.pending.items.forEach(function (i) { pend[i.key] = i; });
  var EFFECT = { "Prediction contract": "48 hours after the proposal", "Staking contract": "At once, for new stakes only", Server: "At once" };

  function banner() {
    var p = D.pending;
    var diff = '<table class="tbl tight diff" style="max-width:720px"><caption class="sr">Pending change</caption><thead><tr><th scope="col">Parameter</th><th scope="col" class="num">Now</th><th scope="col" class="num">After</th><th scope="col">Stored in</th></tr></thead><tbody>' +
      p.items.map(function (i) { return "<tr><td><b>" + i.name + '</b></td><td class="num"><del>' + i.from + '</del></td><td class="num"><ins>' + i.to + "</ins></td><td>Prediction contract</td></tr>"; }).join("") + "</tbody></table>";
    return '<section class="banner"' + (ready ? ' data-k="ready"' : "") + ' aria-labelledby="pend-h"><div class="stack"><h2 id="pend-h">' + (ready ? "The pending change can be applied now" : "A change is announced on chain and waiting out its 48 hours") + "</h2>" + diff +
      "<p>Proposed " + p.proposed + " by the owner wallet " + X.addr(p.by) + " in " + X.tx(p.tx) + ". " + (ready ? "The 48 hours ended Fri 27 Nov, 16:10 KST. It does not apply by itself: the owner wallet signs once more." : "Players keep the current values until the owner applies it. No other contract value can be proposed while this one is waiting.") + "</p></div>" +
      '<div class="banner-side"><span class="dim">' + (ready ? "Waiting for the owner since" : "Can be applied in") + '</span><span class="cd">' + (ready ? "Fri 16:10" : X.cd(p.in)) + '</span><span class="dim">' + (ready ? "" : p.applies) + "</span>" +
      '<div class="acts end">' + X.btn("Cancel the change", { link: 1, danger: 1, act: "cancel", write: 1 }) + (ready ? X.btn("Apply with the owner wallet", { primary: 1, act: "apply", write: 1 }) : "") + "</div></div></section>";
  }

  function input(key, o) {
    var v = EDIT[key], p = pend[key];
    if (p) return '<span class="to">' + ic("clock") + p.to.replace(/ .*/, "") + '</span> <span class="unit">pending, input locked</span>';
    return '<label class="sr" for="p-' + key + '">New value for ' + o.name + '</label><input class="inp num' + (v ? " changed" : "") + '" id="p-' + key + '" data-param="' + key + '" inputmode="decimal" autocomplete="off" placeholder="No change" value="' + (v || "") + '"' + (BAD[key] ? ' aria-invalid="true" aria-describedby="e-' + key + '"' : "") + (X.canWrite ? "" : " disabled") + '><span class="unit">' + o.unit.replace(/ \(.*/, "") + "</span>" +
      (BAD[key] ? '<p class="err" id="e-' + key + '">' + ic("warn") + o.err + "</p>" : "");
  }
  function group(g) {
    return '<h3 class="sub">' + g.group + '</h3><table class="tbl ptbl fix"><caption class="sr">' + g.group + '</caption><colgroup><col style="width:31%"><col style="width:13%"><col style="width:20%"><col style="width:17%"><col style="width:19%"></colgroup>' +
      '<thead><tr><th scope="col">Parameter</th><th scope="col">Current</th><th scope="col">New value</th><th scope="col">Bounds</th><th scope="col">Stored in, takes effect</th></tr></thead><tbody>' +
      g.rows.map(function (r) {
        var store = r.store || g.store;
        return "<tr" + (pend[r.key] ? ' class="pending"' : "") + '><td><span class="t1">' + r.name + "</span>" + (r.help ? '<span class="t2">' + r.help + "</span>" : "") + '</td><td><span class="cur">' + r.cur + "<small>" + r.unit.replace(/ \(Wed.*/, "") + "</small></span></td><td>" + input(r.key, r) + '</td><td class="dim">' + r.bounds + '</td><td><span class="t1" style="font-weight:600">' + store + '</span><span class="t2">' + EFFECT[store] + "</span></td></tr>";
      }).join("") + "</tbody></table>";
  }
  function split() {
    return '<h3 class="sub">Top 10 split of the weekly pool</h3><div class="cols cols-7-5"><div><div class="splitrow" role="group" aria-label="Share of the pool per rank, in percent">' + D.split.map(function (p, i) { return "<label>Rank " + (i + 1) + '<input class="inp" inputmode="numeric" value="' + p + '"' + (X.canWrite ? "" : " disabled") + ' data-split></label>'; }).join("") +
      '</div><p class="hint" style="margin-top:8px" id="split-sum"><b style="color:var(--ink)">Sum 100%.</b> Ten whole percentages that add up to exactly 100, and a lower rank never gets more than a higher one. Prediction contract, 48 hours after the owner proposes it.</p></div>' +
      '<p class="hint">With this week\'s pool of ' + n(D.week.pool) + " CT: rank 1 gets " + n(D.rank[0].prize, 2) + " CT, rank 10 gets " + n(D.rank[9].prize, 2) + " CT. Prizes are never split: equal points rank by who got there first.</p></div>";
  }
  function staking() {
    var s = D.stakingRates;
    return '<h3 class="sub">Staking rates, yearly percent</h3><div class="cols cols-7-5"><div><table class="tbl rates"><caption class="sr">Staking rate by lock period and amount tier</caption><thead><tr><th scope="col">Lock period</th>' + s.tiers.map(function (t, i) { return '<th scope="col">Tier ' + (i + 1) + '<br><span style="font-weight:400">' + t + "</span></th>"; }).join("") + "</tr></thead><tbody>" +
      s.periods.map(function (p) { return '<tr><th scope="row" style="border-bottom:var(--hair);font-size:13.5px;color:var(--ink);font-weight:700;padding:8px 0;vertical-align:middle">' + p[0] + " days</th>" + p[1].map(function (r, i) { var k = "rate-" + p[0] + "-" + i, v = EDIT[k]; return '<td><label class="sr" for="' + k + '">' + p[0] + " days, tier " + (i + 1) + '</label><input class="inp num' + (v ? " changed" : "") + '" id="' + k + '" inputmode="decimal" value="' + (v || r.toFixed(2)) + '"' + (X.canWrite ? "" : " disabled") + '><span class="unit">%</span></td>'; }).join("") + "</tr>"; }).join("") +
      '</tbody></table><p class="hint" style="margin-top:8px">0 to 50, two decimals. Staking contract: a new rate applies to stakes opened after the owner signs. An open stake keeps the rate it started with until it ends.</p></div><div>' +
      '<table class="tbl ptbl"><caption class="sr">Staking limits</caption><thead><tr><th scope="col">Limit</th><th scope="col">Current</th><th scope="col">New value</th></tr></thead><tbody>' + D.stakingParams.map(function (r) { return '<tr><td><span class="t1">' + r.name + '</span><span class="t2">' + r.bounds + '</span></td><td><span class="cur">' + r.cur + "<small>" + r.unit + "</small></span></td><td>" + input(r.key, r) + "</td></tr>"; }).join("") + "</tbody></table></div></div>";
  }
  function treasury() {
    return '<h3 class="sub">Treasury and owner</h3>' + X.kv([
      ["Owner of both contracts", X.addr(D.owner, { full: 1 }) + ' <span class="dim">The master wallet. It signs every change on this page in the browser; the server never holds its key.</span>'],
      ["Treasury (receives withdrawn reserves)", X.addr(D.owner, { full: 1 }) + ' <span class="dim">Same wallet. Changing it is an owner proposal with the 48 hour delay.</span>'],
      ["Prediction contract", X.addr(D.contracts.prediction, { full: 1 })], ["Staking contract", X.addr(D.contracts.staking, { full: 1 })]
    ]);
  }
  function changes() {
    var out = [];
    D.params.forEach(function (g) { g.rows.forEach(function (r) { if (EDIT[r.key]) out.push({ name: r.name, from: r.cur + " " + r.unit.replace(/ \(.*/, ""), to: EDIT[r.key] + " " + r.unit.replace(/ \(.*/, ""), store: r.store || g.store }); }); });
    if (EDIT["rate-90-0"]) out.push({ name: "Staking rate, 90 days, tier 1", from: "12.00 %", to: "11.50 %", store: "Staking contract" });
    return out;
  }
  function savebar() {
    var c = changes(), bad = Object.keys(BAD).length;
    if (!c.length) return "";
    return '<div class="savebar" role="region" aria-label="Unsaved changes"><p>' + (bad ? '<span class="err">' + ic("warn") + bad + " values are outside their bounds. Fix them to continue.</span>" : c.length + " changes, not saved yet: " + c.map(function (x) { return x.name; }).join(", ") + ".") + '</p><div class="acts">' + X.btn("Discard", { link: 1, act: "discard" }) + X.btn("Review changes", { primary: 1, act: "review", disabled: !!bad }) + "</div></div>";
  }

  function reviewSheet() {
    var c = changes(), st = X.state, eff = { "Prediction contract": "Sat 28 Nov, 14:32 KST, then the owner applies", "Staking contract": "At once, new stakes only", Server: "At once" };
    var chainN = c.filter(function (x) { return x.store !== "Server"; }).length;
    var diff = '<table class="tbl tight diff"><caption class="sr">Changes to save</caption><thead><tr><th scope="col">Parameter</th><th scope="col" class="num">Now</th><th scope="col" class="num">New</th><th scope="col">Effective from</th></tr></thead><tbody>' +
      c.map(function (x) { return "<tr><td><b>" + x.name + '</b><span class="t2">' + x.store + '</span></td><td class="num"><del>' + x.from + '</del></td><td class="num"><ins>' + x.to + "</ins></td><td>" + eff[x.store] + "</td></tr>"; }).join("") + "</tbody></table>";
    function step(i, t1, t2, s, end) { return '<li data-s="' + s + '"><span class="nb" data-k="' + (s === "done" ? "ink" : s === "now" ? "" : "off") + '">' + (s === "done" ? ic("check", 14) : i) + '</span><div><p class="t1">' + t1 + '</p><p class="t2">' + t2 + "</p></div>" + (end || "") + "</li>"; }
    var s1 = st === "review" || st === "failed" ? "now" : st === "connect" || st === "wrongwallet" ? "now" : "done", s2 = st === "signing" ? "now" : "wait";
    var connectUI = st === "connect" ? '<div class="acts">' + X.btn("Kaia Wallet", { act: "wallet" }) + X.btn("MetaMask", { act: "wallet" }) + "</div>" : "";
    var steps = '<ol class="steps">' +
      step(1, "Connect the owner wallet", st === "signing" ? "Connected: " + X.addr(D.owner, { link: false }) : "It must be the master wallet " + X.addr(D.owner, { full: 1, link: false }) + ". It is connected in this browser for this one signature.", s1) +
      (connectUI ? '<li style="padding-top:0;border-top:0"><span></span>' + connectUI + "</li>" : "") +
      (st === "wrongwallet" ? '<li style="padding-top:0;border-top:0"><span></span><p class="err" role="alert">' + ic("warn") + "The connected wallet is " + X.short(D.A("someone-else")) + ", not the owner. Switch to the owner account in the wallet, then connect again.</p></li>" : "") +
      step(2, "Sign the proposal", st === "signing" ? "Confirm in the wallet. " + chainN + " values in 2 transactions (prediction contract, staking contract). The owner pays the network fee." : chainN + " values on chain in 2 transactions. The server setting is saved with your admin session and needs no wallet.", s2, st === "signing" ? '<span class="spin" aria-label="Waiting for the wallet"></span>' : "") +
      step(3, "Wait 48 hours", "The prediction contract announces the change on chain. Anyone can read it. You can cancel it during this time.", "wait") +
      step(4, "Apply", "After 48 hours the owner wallet signs once more and the new values are live.", "wait") + "</ol>";
    var action = st === "review" || st === "failed" ? X.btn("Connect the owner wallet", { primary: 1, act: "go", arg: "connect" }) : st === "wrongwallet" ? X.btn("Connect again", { primary: 1, act: "go", arg: "connect" }) : st === "signing" ? '<button type="button" class="btn btn-primary is-busy" disabled><span class="spin"></span>Waiting for the wallet</button>' : "";
    X.sheet({ title: "Review " + c.length + " changes", wide: 1, sticky: st === "signing", cancel: st === "signing" ? "Cancel signing" : "Back to editing",
      body: (st === "failed" ? X.note("down", "<b>Not saved: the wallet rejected the request.</b> Nothing changed.") : "") + diff + steps, action: action });
  }

  X.acts.review = function () { X.go("review"); };
  X.acts.go = function (s) { X.go(s); };
  X.acts.wallet = function () { X.go("signing"); };
  X.acts.discard = function () { X.go("none"); };
  X.acts.apply = function () {
    X.confirm({ title: "Apply the pending change?", reason: false, body: "<p>Completion points go from 100 P to 120 P and Points per hit from 50 P to 40 P for every answer set after the transaction confirms. Hits already waiting in a correction window are paid at the old value.</p>", signer: "Signed and paid by the owner wallet " + X.short(D.owner) + ", connected in this browser.", action: "Connect the owner wallet", done: "Waiting for the owner wallet." });
  };
  X.acts.cancel = cancelSheet;
  function cancelSheet() {
    X.confirm({ title: "Cancel the pending change?", body: "<p>Completion points stay at 100 P and Points per hit at 50 P. The announcement is withdrawn on chain. To change them later you propose again and wait another 48 hours.</p>", placeholder: "Why is the change withdrawn?", signer: "Signed and paid by the owner wallet " + X.short(D.owner) + ". The next step connects it.", danger: 1, action: "Cancel the change", cancel: "Keep it", done: "Connect the owner wallet to withdraw the change." });
  }

  X.mount({
    page: "rewards", title: "Reward settings", sub: "Changes on chain are signed by the owner wallet and wait 48 hours", states: ["none", "editing", "invalid", "review", "connect", "wrongwallet", "signing", "failed", "proposed", "ready", "cancel", "loading", "error"],
    render: function () {
      if (X.is("loading")) return '<section class="sec"><div class="sec-head"><h2>Prediction and conversion</h2></div>' + X.table({ loading: 1, cols: [{ h: "Parameter" }, { h: "Current" }, { h: "New value" }, { h: "Bounds" }, { h: "Stored in, takes effect" }] }) + "</section>";
      if (X.is("error")) return '<section class="sec">' + X.errorBlock("The current values") + '<p class="hint">The form stays closed until the values are read from the contracts, so that nothing is proposed against a stale number.</p></section>';
      return (X.is("proposed") ? X.note("up", "<b>Proposed.</b> 2 values are announced on chain and can be applied Sat 28 Nov, 14:32 KST. The staking rate applies to new stakes from now. The server setting is saved.") + '<div style="height:16px"></div>' : "") +
        (hasPending ? banner() : "") +
        '<section class="sec"><div class="sec-head"><h2>Prediction and conversion</h2><span class="sec-note">Type a new value to add it to the proposal. Empty means no change.</span></div>' + D.params.map(group).join("") + split() + "</section>" +
        '<section class="sec"><div class="sec-head"><h2>Staking</h2><span class="sec-note">' + n(D.staking.total) + " CT staked in " + D.staking.stakes + " open stakes</span></div>" + staking() + "</section>" +
        '<section class="sec"><div class="sec-head"><h2>Wallets and contracts</h2></div>' + treasury() + "</section>" + savebar();
    },
    after: function () {
      if (X.is("review", "connect", "wrongwallet", "signing", "failed")) reviewSheet();
      if (X.is("cancel")) cancelSheet();
      document.addEventListener("input", function (e) {
        if (e.target.matches("[data-split]")) { var s = 0; document.querySelectorAll("[data-split]").forEach(function (i) { s += +i.value || 0; }); document.getElementById("split-sum").firstChild.innerHTML = s === 100 ? "Sum 100%." : '<span style="color:var(--down)">The split must add up to 100%. Now ' + s + "%.</span>"; }
        if (e.target.matches("[data-param]")) e.target.classList.toggle("changed", !!e.target.value);
      });
    }
  });
})();
