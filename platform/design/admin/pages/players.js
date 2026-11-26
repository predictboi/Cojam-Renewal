/* AD7 Players. States: detail | block | blockerror | clear | blocked | unblock | unblockfail | invites | search | noresult | empty | loading | error */
(function () {
  "use strict";
  var X = Admin, D = AD, n = X.n, tag = X.tag, ic = X.ic, esc = X.esc, fig = X.fig;
  var tab = X.is("blocked", "unblock", "unblockfail") ? "blocked" : X.is("invites") ? "invites" : X.is("search", "noresult") ? "search" : "review";
  var focus = D.review[3];   /* the account used by the detail, block and clear states */
  function score(s) { return '<span class="score"' + (s >= 80 ? ' data-k="down"' : "") + ' title="Review from 50, blocked at 80">' + s + '<i style="--p:' + s + '%"></i></span>'; }
  function who(p) { return (p.name ? '<span class="t1">' + esc(p.name) + "</span>" : "") + X.addr(p.addr) + (p.email ? '<span class="t2">' + p.email + (p.cluster ? " " + tag("Cluster " + p.cluster, "warn") : "") + "</span>" : ""); }
  function rules(p) { return '<ul class="rules">' + p.rules.map(function (r) { return "<li><b>" + r.k + '</b><span class="dim">' + r.t + "</span></li>"; }).join("") + "</ul>"; }

  function tabs() {
    function a(id, label, cnt, st) { return '<a href="?' + (st ? "state=" + st : "") + '"' + (tab === id ? ' aria-current="page"' : "") + ">" + label + (cnt != null ? ' <span class="nb">' + cnt + "</span>" : "") + "</a>"; }
    return '<nav class="tabs" aria-label="Player lists">' + a("review", "Review list", X.is("empty") ? 0 : D.abuse.review) + a("blocked", "Blocked", D.abuse.blocked, "blocked") + a("invites", "Invites", null, "invites") +
      '<form class="end" role="search" action="" method="get"><input type="hidden" name="state" value="search"><label class="search"><span class="sr">Search players</span>' + ic("search") + '<input class="inp" type="search" name="q" placeholder="Address, masked email match or invite code" value="' + (X.is("search") ? "LUCKY88D" : X.is("noresult") ? "0x9999" : "") + '"></label></form></nav>';
  }

  function review() {
    var rows = X.is("empty") ? [] : D.review;
    return '<section><div class="sec-head"><h2>Waiting for review</h2><span class="sec-note">Risk score 50 to 79. At 80 the risk check blocks by itself. Clear marks an account as looked at: the same rule does not flag it again for 30 days.</span></div>' +
      (rows.length ? X.note("warn", "<b>13 of these 14 accounts belong to 2 flagged clusters.</b> Cluster A: luckyday88 and 11 friends who joined within 9 minutes today, 3 already blocked. Cluster B: 4 look alike addresses that only convert.", X.link("Flagged clusters", "?state=invites")) + '<div style="height:12px"></div>' : "") +
      X.table({ caption: "Accounts waiting for review", rows: rows, loading: X.is("loading"), error: X.is("error"), what: "The review list", cls: "vtop", sort: [2, "desc"],
        selected: function (p) { return X.is("detail", "block", "blockerror", "clear") && p === focus; },
        empty: X.empty("Nothing to review", "No account has a risk score between 50 and 79. The risk check runs every hour and at every sign up; the next run is at 15:00 KST.", X.link("See blocked accounts", "?state=blocked")),
        cols: [
          { h: "Account", val: function (p) { return p.addr; }, cell: function (p) { return who(p); } },
          { h: "Joined", cell: function (p) { return '<span class="nowrap">' + p.joined + "</span>"; } },
          { h: "Score", val: function (p) { return p.score; }, cell: function (p) { return score(p.score); } },
          { h: "Rules that fired", w: "44%", cell: function (p) { return rules(p); } },
          { h: "Inviter", cell: function (p) { return p.inviter ? esc(p.inviter) : '<span class="dim">None</span>'; } },
          { h: "Play", num: 1, val: function (p) { return p.points; }, cell: function (p) { return p.days + (p.days === 1 ? " day" : " days") + '<span class="t2 nowrap">' + n(p.points) + " P" + (p.friends ? ", " + p.friends + " friends" : "") + "</span>"; } },
          { h: "", cell: function (p, i) { return '<div class="row-acts">' + X.btn("Open", { link: 1, act: "detail", arg: i }) + X.btn("Clear", { small: 1, act: "clear", arg: i, write: 1 }) + X.btn("Block", { small: 1, act: "block", arg: i, write: 1 }) + "</div>"; } }
        ],
        after: rows.length ? '<div class="tbl-foot"><span>14 of 14 accounts</span><span>Block and Clear are sent with the operator key. Every action needs a note and is written to the audit log.</span></div>' : "" }) + "</section>";
  }

  function blocked() {
    return '<section><div class="sec-head"><h2>Blocked accounts</h2><span class="sec-note">Frozen on chain: no predicting, no conversion, no airdrop, no sponsored gas. Points are never debited. Staking interest and principal can still be withdrawn at the player\'s own fee.</span></div>' +
      (X.is("unblockfail") ? X.note("down", "<b>Unblock failed: the operator wallet could not pay the network fee.</b> Nothing changed. " + X.short(D.blocked[4].addr) + " is still blocked.", X.btn("Try again", { link: 1, act: "unblock", arg: 4 })) + '<div style="height:12px"></div>' : "") +
      X.table({ caption: "Blocked accounts", rows: D.blocked, cls: "vtop", sort: [1, "desc"],
        cols: [
          { h: "Account", val: function (p) { return p.addr; }, cell: function (p) { return X.addr(p.addr, { full: 1 }); } },
          { h: "Blocked", val: function (p) { return D.blocked.length - D.blocked.indexOf(p); }, cell: function (p) { return '<span class="nowrap">' + p.at + '</span><span class="t2">by ' + p.by + "</span>"; } },
          { h: "Reason", cell: function (p) { return esc(p.why); } },
          { h: "Score", val: function (p) { return p.score; }, cell: function (p) { return score(p.score); } },
          { h: "Points", num: 1, val: function (p) { return p.points; }, cell: function (p) { return n(p.points) + " P"; } },
          { h: "CT", num: 1, val: function (p) { return p.ct; }, cell: function (p) { return n(p.ct, p.ct % 1 ? 1 : 0) + " CT"; } },
          { h: "Inviter, friends", cell: function (p) { return (p.inviter ? esc(p.inviter) : '<span class="dim">No inviter</span>') + '<span class="t2">' + p.friends + " friends</span>"; } },
          { h: "", cell: function (p, i) { return '<div class="row-acts">' + X.btn("Open", { link: 1, act: "toast", arg: "The player detail opens here." }) + X.btn("Unblock", { small: 1, act: "unblock", arg: D.blocked.indexOf(p), write: 1 }) + "</div>"; } }
        ],
        after: '<div class="tbl-foot"><span>1 to 10 of ' + D.abuse.blocked + " · " + D.abuse.blockedWeek + " blocked this week, " + D.abuse.blockedHour + ' in the last hour</span><span class="acts"><button type="button" class="link" disabled>Previous</button><button type="button" class="link" data-act="toast" data-arg="Rows 11 to 20 load here.">Next 10</button></span></div>' }) + "</section>";
  }

  function invites() {
    var i = D.invites;
    return '<section><div class="figs" style="margin-bottom:24px">' + fig("Links today", i.today, "of " + D.users.newToday + " new players") + fig("Links this week", i.week, "of " + D.users.newWeek + " new players") + fig("New players invited", X.pct(i.shareWeek), "this week") + fig("Invite bonus today", n(i.bonusToday) + "<small>P</small>", n(i.bonusWeek) + " P this week") + fig("Welcome bonuses", i.welcomeToday, i.welcomeWeek + " this week, 100 P each") + "</div></section>" +
      '<section class="sec"><div class="sec-head"><h2>Flagged clusters</h2><span class="nb">' + D.clusters.length + '</span><span class="sec-note">Groups of accounts that share a network, a device, a sign up burst or an answer pattern</span></div>' +
      X.table({ caption: "Flagged clusters", rows: D.clusters, cls: "vtop",
        cols: [{ h: "Cluster", cell: function (c) { return tag("Cluster " + c.id, "warn"); } }, { h: "Inviter", cell: function (c) { return c.addr ? '<span class="t1">' + c.inviter + "</span>" + X.addr(c.addr) : '<span class="dim">' + c.inviter + "</span>"; } }, { h: "Accounts", num: 1, cell: function (c) { return c.size; } }, { h: "Blocked", num: 1, cell: function (c) { return c.blocked; } }, { h: "In review", num: 1, cell: function (c) { return c.review; } }, { h: "Shared signals", cell: function (c) { return c.signals; } }, { h: "First seen", cell: function (c) { return c.first; } },
          { h: "", cell: function (c) { return '<div class="row-acts">' + X.link("Open in review list", "?") + "</div>"; } }] }) + "</section>" +
      '<section class="sec"><div class="sec-head"><h2>Top inviters</h2><span class="sec-note">The inviter earns 10% on top of every point a friend earns. A blocked friend pays no bonus.</span></div>' +
      X.table({ caption: "Top inviters", rows: D.inviters, sort: [1, "desc"], cls: "tight",
        cols: [
          { h: "Inviter", val: function (p) { return p.name.toLowerCase(); }, cell: function (p) { return '<span class="t1">' + esc(p.name) + "</span>" + X.addr(p.addr); } },
          { h: "Friends joined", num: 1, val: function (p) { return p.joined; }, cell: function (p) { return p.joined; } },
          { h: "First day done", num: 1, val: function (p) { return p.first; }, cell: function (p) { return p.first + ' <span class="dim">' + Math.round(p.first / p.joined * 100) + "%</span>"; } },
          { h: "Active after 7 days", num: 1, val: function (p) { return p.active7 == null ? -1 : p.active7; }, cell: function (p) { return p.active7 == null ? '<span class="dim">Too new</span>' : p.active7 + "%"; } },
          { h: "Bonus, lifetime", num: 1, val: function (p) { return p.life; }, cell: function (p) { return n(p.life) + " P"; } },
          { h: "Bonus, this week", num: 1, val: function (p) { return p.week; }, cell: function (p) { return n(p.week) + " P"; } },
          { h: "Risk score", val: function (p) { return p.score; }, cell: function (p) { return score(p.score); } },
          { h: "Flags", cell: function (p) { return p.flag ? tag(p.flag, "warn") : ""; } }
        ] }) + "</section>";
  }

  function search() {
    if (X.is("noresult")) return '<section><div class="sec-head"><h2>Search</h2></div>' + X.empty("No player matches “0x9999”", "Search takes a full or partial address, a full email address (it is hashed and matched, never shown) or an invite code. Check for a typo, or paste the whole address.", '<a class="link" href="?">Back to the review list</a>') + "</section>";
    var p = D.review[0];
    return '<section><div class="sec-head"><h2>1 player matches the invite code LUCKY88D</h2></div>' + X.table({ caption: "Search results", rows: [p], cls: "vtop",
      cols: [{ h: "Account", cell: who }, { h: "Joined", cell: function (p) { return p.joined; } }, { h: "State", cell: function () { return tag("Review", "warn"); } }, { h: "Score", cell: function (p) { return score(p.score); } }, { h: "Friends", num: 1, cell: function (p) { return p.friends; } }, { h: "Points", num: 1, cell: function (p) { return n(p.points) + " P"; } },
        { h: "", cell: function () { return '<div class="row-acts">' + X.btn("Open", { link: 1, act: "detail", arg: 0 }) + "</div>"; } }] }) + "</section>";
  }

  function drawer(p) {
    var cl = D.clusterAfull;
    function on(c, k) { return c.st === "Blocked" || (c.rules || []).some(function (r) { return r.k === k; }) ? '<span class="on"><span class="sr">yes</span></span>' : '<span class="no"><span class="sr">no</span></span>'; }
    var mx = '<table class="tbl tight mx"><caption class="sr">Accounts linked to this one, by signal</caption><thead><tr><th scope="col">Account</th><th scope="col">Score</th><th scope="col">Burst</th><th scope="col">Network</th><th scope="col">Device</th><th scope="col">Answers</th><th scope="col">State</th></tr></thead><tbody>' +
      cl.map(function (c) { return "<tr" + (c.addr === p.addr ? ' aria-selected="true"' : "") + "><td>" + X.addr(c.addr) + (c.addr === p.addr ? " <b>this account</b>" : "") + "</td><td>" + c.score + "</td><td>" + on(c, "Sign up burst") + "</td><td>" + on(c, "Shared network") + "</td><td>" + on(c, "Shared device") + "</td><td>" + on(c, "Identical answers") + "</td><td>" + tag(c.st) + "</td></tr>"; }).join("") + "</tbody></table>";
    return '<div class="drawer-head"><div><h2 id="sheet-h">Player ' + X.short(p.addr) + '</h2><p class="dim">' + p.email + " · joined " + p.joined + ' KST</p></div><span class="acts" style="margin-left:auto">' + tag("Review", "warn") + X.btn("Clear", { small: 1, act: "clear", arg: 3, write: 1 }) + X.btn("Block", { small: 1, act: "block", arg: 3, write: 1 }) + '<button type="button" class="x" data-close aria-label="Close player detail" autofocus>' + ic("x") + "</button></span></div>" +
      "<section><h3>Profile</h3>" + X.kv([["Wallet", X.addr(p.addr, { full: 1 })], ["Email", p.email + ' <span class="dim">masked. Gmail, dots and +tags removed</span>'], ["Signed up", p.joined + " KST, registered on chain 13:54"], ["Play key", "Set today 13:54, this device only"], ["Days played", p.days + " (today, all 5 answered)"], ["Invited by", "luckyday88 " + X.addr(p.inviterAddr) + " with code LUCKY88D"], ["Friends", "None"]]) + "</section>" +
      '<section><h3>Risk</h3><div class="cols cols-2" style="gap:20px"><div class="fig"><span class="fig-l">Score now</span><span class="fig-v">' + p.score + '</span><span class="fig-s">Review from 50, blocked at 80</span></div><ol class="stack" style="gap:6px;font-size:13px"><li><b>14:00</b> hourly check: 74. Shared network, identical answers and shared device added.</li><li><b>13:53</b> at sign up: 41. Sign up burst under one inviter.</li></ol></div><div style="height:12px"></div>' + rules(p) + "</section>" +
      "<section><h3>Cluster A: 11 accounts linked by signals</h3>" + mx + '<p class="hint" style="margin-top:8px">Burst: joined within 9 minutes under one inviter. Network: same network at sign up. Device: same device fingerprint. Answers: the same 5 answers within 4 seconds.</p></section>' +
      "<section><h3>Points</h3>" + X.kv([["Completion", "100 P", 1], ["Hits", "0 P", 1], ["Compensation", "0 P", 1], ["Invite bonus", "0 P", 1], ["Welcome", "100 P", 1], ["<b style=\"color:var(--ink)\">Balance</b>", "<b>200 P</b>", 1]]) + "</section>" +
      "<section><h3>Conversions and gas</h3>" + X.kv([["Conversions", "None. First conversion opens Thu 3 Dec (7 day wait)"], ["CT balance", "0 CT"], ["Staked", "0 CT"], ["Sponsored transactions", "6 today: 1 play key setup, 5 predictions"], ["Freeze history", "Never blocked"]]) + "</section>";
  }

  function blockSheet(i) {
    var p = D.review[i == null ? 3 : i], pre = p.rules.map(function (r) { return r.k + ": " + r.t; }).join(". ") + ".";
    X.confirm({ title: "Block " + X.short(p.addr) + "?", wide: 1, body: "<p>The account is frozen on chain. It can no longer predict, convert, receive an airdrop or get sponsored gas. Its " + n(p.points) + " P stay as they are, and it can still withdraw staked CT at its own fee. The player sees the Account on hold screen with help@cojam.app.</p>" + X.kv([["Account", X.addr(p.addr, { full: 1, link: false })], ["Score", p.score + " (below the automatic block at 80)"], ["Inviter", p.inviter ? p.inviter + ". No invite bonus is paid on this friend while blocked" : "None"]]),
      reasonLabel: "Note", prefill: X.is("blockerror") ? "" : pre, placeholder: "Which evidence did you check?", signer: "Sent with the operator key through the worker. No owner signature.", action: "Block account", cancel: "Cancel", done: X.short(p.addr) + " blocked." });
    if (X.is("blockerror")) document.querySelector("[data-confirm]").click();
  }
  function clearSheet(i) {
    var p = D.review[i == null ? 3 : i];
    X.confirm({ title: "Clear " + X.short(p.addr) + "?", body: "<p>The account leaves the review list and keeps playing. The rules that fired (" + p.rules.map(function (r) { return r.k.toLowerCase(); }).join(", ") + ") do not flag it again for 30 days. A new rule or a score of 80 still acts.</p>", reasonLabel: "Note", placeholder: "Why is this account fine?", action: "Clear account", done: X.short(p.addr) + " cleared for 30 days." });
  }
  function unblockSheet(i) {
    var p = D.blocked[i == null ? 4 : i];
    X.confirm({ title: "Unblock " + X.short(p.addr) + "?", wide: 1, body: "<p>The account can predict, convert and receive prizes again. Points earned before stay as they are.</p>" + X.kv([["Account", X.addr(p.addr, { full: 1, link: false })], ["Blocked", p.at + " KST by " + p.by], ["Reason then", esc(p.why)], ["Balance", n(p.points) + " P, " + p.ct + " CT"]]), reasonLabel: "Note", placeholder: "What changed, or what was the check wrong about?", signer: "Sent with the operator key through the worker. No owner signature.", action: "Unblock account", cancel: "Keep blocked", done: X.short(p.addr) + " unblocked." });
  }
  X.acts.block = blockSheet; X.acts.clear = clearSheet; X.acts.unblock = unblockSheet;
  X.acts.detail = function (i) { X.sheet({ drawer: 1, body: drawer(focus) }); };
  X.acts.toast = function (m) { X.toast(m); };

  X.mount({
    page: "players", title: "Players", sub: "Abuse review, blocked accounts and invites", states: ["detail", "block", "blockerror", "clear", "blocked", "unblock", "unblockfail", "invites", "search", "noresult", "empty", "loading", "error"],
    render: function () { return tabs() + (tab === "blocked" ? blocked() : tab === "invites" ? invites() : tab === "search" ? search() : review()); },
    after: function () { if (X.is("detail")) X.acts.detail(); if (X.is("block", "blockerror")) blockSheet(); if (X.is("clear")) clearSheet(); if (X.is("unblock")) unblockSheet(); }
  });
})();
