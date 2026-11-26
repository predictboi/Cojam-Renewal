/* AD6 System. States: failing | maintenance | maint | adddomain | domainerror | disabledomain | addadmin | loading | error. ?role=owner unlocks the admin allow list. */
(function () {
  "use strict";
  var X = Admin, D = AD, n = X.n, tag = X.tag, ic = X.ic, esc = X.esc, fig = X.fig;
  var failing = X.is("failing"), maintOn = X.is("maintenance"), owner = X.role === "owner";

  function wallets() {
    var R = {}; D.reserves.forEach(function (r) { R[r.id] = r; });
    var rows = [
      { r: R.fee, addr: D.wallets.fee, key: "Hot key, held by the relayer service only", fix: "Send KAIA from the treasury to this address." },
      { r: R.op, addr: D.wallets.op, key: "Hot key, held by the worker only", fix: "Send KAIA from the treasury to this address." },
      { r: R.pred, addr: D.wallets.pred, key: "Contract. Funded by plain transfers from the owner", fix: "Next airdrop Wed 2 Dec: about 1,284 CT." },
      { r: R.stake, addr: D.wallets.stake, key: "Contract. Also holds 962,400 CT principal and 21,460 CT reserved interest", fix: "New stakes show Full for now when it reaches 0." }
    ];
    return '<section class="sec"><div class="sec-head"><h2>Wallets and reserves</h2><span class="sec-note">Runway is the balance divided by the average outflow of the last 7 days. An alert opens on the dashboard below the floor.</span></div>' +
      X.table({ caption: "Wallets and reserves", rows: rows, loading: X.is("loading"), error: X.is("error"), what: "Wallet balances", sort: [4, "asc"],
        cols: [
          { h: "Wallet", cell: function (w) { return '<span class="t1">' + w.r.name + '</span><span class="t2">' + w.key + "</span>"; } },
          { h: "Address", cell: function (w) { return X.addr(w.addr, { full: 1 }); } },
          { h: "Balance", num: 1, val: function (w) { return w.r.bal; }, cell: function (w) { return '<span class="num-d" style="font-size:16px">' + n(w.r.bal, w.r.unit === "KAIA" ? 1 : 0) + "</span> " + w.r.unit; } },
          { h: "Outflow a day", num: 1, cell: function (w) { return n(w.r.perDay, w.r.unit === "KAIA" ? 1 : 0) + " " + w.r.unit; } },
          { h: "Runway", num: 1, val: function (w) { return w.r.runway; }, cell: function (w) { return '<span class="num-d" style="font-size:16px">' + w.r.runway + "</span> days"; } },
          { h: "Floor", num: 1, cell: function (w) { return '<label class="sr" for="fl-' + w.r.id + '">Alert floor for ' + w.r.name + '</label><input class="inp num" id="fl-' + w.r.id + '" style="width:92px" inputmode="decimal" value="' + n(w.r.floor) + '"' + (X.canWrite ? "" : " disabled") + '> <span class="dim">' + w.r.unit + "</span>"; } },
          { h: "State", cell: function (w) { return (w.r.k === "down" ? tag("Below floor", "down") : w.r.k === "warn" ? tag("Under 30 days", "warn") : tag("Healthy", "up")) + '<span class="t2" style="margin-top:3px">' + w.fix + "</span>"; } }
        ] }) +
      (X.is("loading", "error") ? "" : '<div style="height:12px"></div>' + X.kv([["Owner and treasury", X.addr(D.owner, { full: 1 }) + ' <span class="dim">The master wallet. It owns both contracts, funds the reserves and can withdraw what is not owed. Its key is never on a server.</span>']])) + "</section>";
  }

  function jobs() {
    var rows = D.jobs.map(function (j) { return failing && j.name === "Answer setter" ? Object.assign({}, j, { s: "Failing", result: "6 runs failed: the AI provider answers 529 (overloaded)", took: "30s timeout", last: "Today 14:30" }) : j; });
    return '<section class="sec"><div class="sec-head"><h2>Jobs</h2>' + (failing ? tag("1 failing", "down") : tag("1 slow", "warn")) + '<span class="sec-note">Everything the platform does by itself. Run now starts one extra run; it never skips the next scheduled one.</span></div>' +
      (failing ? X.note("down", "<b>Answer setter has failed for 30 minutes.</b> 2 answers are past their due time. Hit points wait; nothing is paid on a missing answer. Questions still without an answer 48 hours after their set closed are cancelled.", X.link("Open Answers", "answers.html?state=late")) + '<div style="height:12px"></div>' : "") +
      X.table({ caption: "Jobs", rows: rows, cls: "tight", loading: X.is("loading"),
        cols: [
          { h: "Job", val: function (j) { return j.name; }, cell: function (j) { return '<span class="t1">' + j.name + '</span><span class="t2">' + j.what + "</span>"; } },
          { h: "Schedule", cell: function (j) { return j.every; } },
          { h: "Last run", cell: function (j) { return j.last + '<span class="t2">took ' + j.took + "</span>"; } },
          { h: "Result", cell: function (j) { return j.s === "Healthy" ? j.result : '<b style="color:var(--' + (j.s === "Failing" ? "down" : "warn") + ')">' + j.result + "</b>"; } },
          { h: "Next run", cell: function (j) { return j.next; } },
          { h: "State", val: function (j) { return { Failing: 0, Slow: 1, Healthy: 2, Off: 3 }[j.s]; }, cell: function (j) { return tag(j.s); } },
          { h: "", cell: function (j) { return '<div class="row-acts">' + (j.next === "Running" ? '<span class="dim">Always on</span>' : X.btn("Run now", { small: 1, act: "run", arg: j.name, write: 1 })) + "</div>"; } }
        ] }) + "</section>";
  }

  function relayer() {
    var s = D.sponsor, total = s.actions.reduce(function (a, x) { return a + x[1]; }, 0);
    return '<section class="sec"><div class="sec-head"><h2>Relayer and chain</h2><span class="sec-note">Sponsored transactions in the last hour</span></div><div class="cols cols-3 split"><div>' +
      '<div class="figs" style="margin-bottom:16px">' + fig("Sponsored", n(total), "last hour", "s") + fig("Median confirm", s.median, "send to receipt", "s") + fig("Play keys set", s.keysToday, "today", "s") + "</div>" +
      '<table class="tbl tight"><caption class="sr">Sponsored by action</caption><thead><tr><th scope="col">Action</th><th scope="col" class="num">Last hour</th></tr></thead><tbody>' + s.actions.map(function (a) { return "<tr><td>" + a[0] + '</td><td class="num">' + n(a[1]) + "</td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div><h3 class="sub">Refusals by code</h3><table class="tbl tight"><caption class="sr">Refusals</caption><thead><tr><th scope="col">Code</th><th scope="col" class="num">Last hour</th></tr></thead><tbody>' + s.refusals.map(function (a) { return '<tr><td><span class="mono">' + a[0] + '</span><span class="t2">' + a[2] + '</span></td><td class="num">' + a[1] + "</td></tr>"; }).join("") + '</tbody></table><p class="hint" style="margin-top:8px">Last error: ' + s.lastErr + ".</p></div>" +
      '<div><h3 class="sub">Chain</h3>' + X.kv(D.chain.rpc.map(function (r) { return [r[0], tag(r[1]) + " " + r[2], 1]; }).concat([["Block height", D.chain.height, 1], ["Lag behind the network", D.chain.lag, 1]])) +
      '<h3 class="sub">Images, last 7 days</h3>' + X.kv([["Generated", D.images.generated, 1], ["Rejected by the check", D.images.rejected, 1], ["Fallbacks in use", D.images.fallback, 1], ["Cost", D.images.cost + ' <span class="dim">' + D.images.per + "</span>", 1], ["Model", '<span class="dim">' + D.images.model + "</span>", 1]]) + "</div></div></section>";
  }

  function domains() {
    var form = X.is("adddomain", "domainerror"), bad = X.is("domainerror");
    var add = form ? '<form class="cols" style="grid-template-columns:1fr 1fr 1.2fr auto;gap:12px;align-items:start;margin-top:16px;padding-top:16px;border-top:var(--hair)" onsubmit="return false"><div class="fl"><label for="dm">Domain</label><input class="inp" id="dm" value="' + (bad ? "naver.com" : "proton.me") + '"' + (bad ? ' aria-invalid="true" aria-describedby="dm-e"' : "") + ">" + (bad ? '<p class="err" id="dm-e">' + ic("warn") + "This domain is already listed.</p>" : '<p class="hint">Like example.com. 22 sign ups were refused from it this week.</p>') + '</div><div class="fl"><label for="dn">Name shown at login</label><input class="inp" id="dn" value="' + (bad ? "Naver" : "Proton Mail") + '"></div><div class="fl"><label for="dr">Normalisation</label><select class="inp" id="dr"><option>+tags removed</option><option>Gmail: dots and +tags removed</option><option>None</option></select><p class="hint">One normalised address is one player.</p></div><div class="acts" style="padding-top:22px">' + X.btn("Add provider", { act: "adddomain", write: 1, disabled: bad }) + '<a class="link" href="?">Cancel</a></div></form>' : "";
    return '<section class="sec"><div class="sec-head"><h2>Email domain allow list</h2><span class="nb">' + D.domains.length + '</span><span class="sec-note">Sign up is limited to these providers. Switching one off stops new sign ups only: its players keep playing.</span><span class="sec-end">' + (form ? "" : '<a class="btn" href="?state=adddomain">Add provider</a>') + "</span></div>" +
      '<div class="cols cols-8-4 split"><div>' + X.table({ caption: "Email providers", rows: D.domains, cls: "tight", sort: [3, "desc"],
        cols: [
          { h: "Domain", val: function (d) { return d.d; }, cell: function (d) { return "<b>" + d.d + "</b>"; } },
          { h: "Name at login", cell: function (d) { return d.name; } },
          { h: "Normalisation", cell: function (d) { return d.rule; } },
          { h: "Sign ups, 7 days", num: 1, val: function (d) { return d.up; }, cell: function (d) { return n(d.up); } },
          { h: "Refused, 7 days", num: 1, val: function (d) { return d.no; }, cell: function (d) { return d.no; } },
          { h: "Sign up", cell: function (d) { return '<button type="button" class="sw" role="switch" aria-checked="true" aria-label="New sign ups from ' + d.d + '" data-act="domain" data-arg="' + d.d + '"' + (X.canWrite ? "" : " disabled") + "><i></i>On</button>"; } }
        ],
        foot: '<tfoot><tr><td colspan="3">All providers</td><td class="num">' + n(D.domains.reduce(function (a, d) { return a + d.up; }, 0)) + '</td><td class="num">' + D.domains.reduce(function (a, d) { return a + d.no; }, 0) + "</td><td></td></tr></tfoot>" }) + "</div>" +
      '<div><h3 class="sub">Refused for the provider, 7 days</h3>' + X.kv(D.refusedDomains.top.map(function (t) { return [t[0], t[1], 1]; }).concat([["Other domains", D.refusedDomains.total - D.refusedDomains.top.reduce(function (a, t) { return a + t[1]; }, 0), 1], ["<b style=\"color:var(--ink)\">Total</b>", D.refusedDomains.total, 1]])) + '<p class="hint" style="margin-top:8px">The Refused column on the left counts addresses that were already linked after normalisation (same mailbox, different spelling).</p></div></div>' + add + "</section>";
  }

  function admins() {
    var form = X.is("addadmin");
    return '<div><div class="sec-head"><h2>Admin allow list</h2><span class="nb">' + D.admins.length + '</span><span class="sec-end">' + X.btn("Add admin", { act: "addadmin", disabled: !owner, title: owner ? "" : "Only the Owner role can change this list" }) + "</span></div>" +
      X.table({ caption: "Admins", rows: D.admins, cls: "tight",
        cols: [{ h: "Email", cell: function (a) { return "<b>" + a.email + "</b>" + (a.email === D.me.email && !owner ? ' <span class="dim">you</span>' : ""); } }, { h: "Role", cell: function (a) { return tag(a.role); } }, { h: "Last sign in", cell: function (a) { return a.last; } },
          { h: "", cell: function (a) { return '<div class="row-acts">' + X.btn("Remove", { link: 1, danger: 1, act: "rmadmin", arg: a.email, disabled: !owner || a.role === "Owner" }) + "</div>"; } }] }) +
      (form ? '<form class="cols" style="grid-template-columns:1fr 150px auto;gap:12px;align-items:end;margin-top:12px" onsubmit="return false"><div class="fl"><label for="am">Email</label><input class="inp" id="am" type="email" value="mina@cojam.app"></div><div class="fl"><label for="ar">Role</label><select class="inp" id="ar"><option>Viewer</option><option selected>Operator</option><option>Owner</option></select></div>' + X.btn("Add", { act: "addadmin2" }) + "</form>" : "") +
      '<p class="hint" style="margin-top:8px">Viewer reads. Operator can also block, unblock, correct inside the window, void, edit questions and the allow lists. Owner can also change this list. ' + (owner ? "" : "You are an Operator: this list is read only for you.") + "</p></div>";
  }
  function app() {
    return '<div><div class="sec-head"><h2>App</h2>' + (maintOn ? tag("Maintenance on", "warn") : "") + "</div>" +
      (maintOn ? X.note("warn", "<b>Maintenance mode is on since 14:20 KST.</b> Every app screen shows the maintenance page. The install page and this admin still work. Picks already held on phones are sent when it ends.") + '<div style="height:12px"></div>' : "") +
      X.kv([["Running version", D.app.version + ' <span class="dim">service worker deployed Tue 24 Nov</span>'],
        ["Minimum version", '<label class="sr" for="minv">Minimum version</label><input class="inp" id="minv" style="width:110px" value="' + D.app.min + '"' + (X.canWrite ? "" : " disabled") + '> <span class="hint">Older apps see Update required.</span>'],
        ["Maintenance mode", '<button type="button" class="sw" role="switch" aria-checked="' + maintOn + '" data-act="maint"' + (X.canWrite ? "" : " disabled") + "><i></i>" + (maintOn ? "On" : "Off") + "</button>"],
        ["Message to players", '<label class="sr" for="mmsg">Maintenance message</label><textarea class="inp" id="mmsg" rows="2"' + (X.canWrite ? "" : " disabled") + ">" + D.app.msg + "</textarea>"],
        ["Expected end", '<label class="sr" for="mend">Expected end</label><input class="inp" id="mend" style="width:180px" value="' + D.app.end + '"' + (X.canWrite ? "" : " disabled") + ">"]]) + "</div>";
  }

  X.acts.run = function (name) { X.confirm({ title: "Run " + name + " now?", reason: false, body: "<p>Starts one extra run. The next scheduled run still happens. The result shows in the Jobs table and in the log.</p>", action: "Run now", done: name + " started." }); };
  X.acts.domain = function (d) { X.confirm({ title: "Stop new sign ups from " + d + "?", body: "<p>New players with a " + d + " address see “We cannot use this email provider yet”. Players who already signed up with it keep playing, converting and withdrawing.</p>", placeholder: "Why is this provider switched off?", action: "Switch off " + d, cancel: "Keep it on", done: d + " is off for new sign ups." }); };
  X.acts.adddomain = function () { X.confirm({ title: "Add proton.me to the allow list?", body: "<p>New players can sign up with a proton.me address at once. Addresses are stored lower case with +tags removed, and one normalised address is one player.</p>", placeholder: "Why is this provider added?", action: "Add proton.me", done: "proton.me added. Sign ups are open." }); };
  X.acts.addadmin = function () { X.go("addadmin"); };
  X.acts.addadmin2 = function () { X.toast("mina@cojam.app added as Operator."); };
  X.acts.rmadmin = function (m) { X.confirm({ title: "Remove " + m + " from the admin?", reason: false, body: "<p>Their session ends at once and they can no longer sign in.</p>", danger: 1, action: "Remove", done: m + " removed." }); };
  function maintSheet() {
    X.confirm({ title: maintOn ? "End maintenance mode?" : "Turn on maintenance mode?", reason: maintOn ? false : undefined, body: maintOn ? "<p>The app opens again for everyone. Held picks are sent if their question is still open.</p>" : "<p>Every player sees the maintenance page at once, with the message and expected end below the switch. About 1,926 players have played today and 138 have picks left. The install page and this admin keep working. Answers, settling and the airdrop keep running.</p>", placeholder: "What is being fixed?", action: maintOn ? "End maintenance" : "Turn on maintenance", cancel: maintOn ? "Keep it on" : "Cancel", next: maintOn ? "" : "maintenance", done: "Maintenance mode is off." });
  }
  X.acts.maint = maintSheet;

  X.mount({
    page: "system", title: "System", sub: "Wallets, jobs, relayer, allow lists and the app switch", states: ["failing", "maintenance", "maint", "adddomain", "domainerror", "disabledomain", "addadmin", "loading", "error"],
    render: function () {
      if (X.is("loading", "error")) return wallets() + (X.is("loading") ? jobs() : "");
      return wallets() + jobs() + relayer() + domains() + '<section class="sec"><div class="cols cols-2 split">' + admins() + app() + "</div></section>" +
        '<section class="sec" id="log"><div class="sec-head"><h2>Log</h2><span class="sec-note">All events. Every change that writes on chain shows its signer and transaction.</span></div>' + X.log(failing ? [{ t: "14:30:31", lv: "error", who: "Answer setter", msg: "Run failed: AI provider returned 529 (overloaded) after 30 s. 6th failure in a row.", json: '{ "job": "answer-setter", "attempt": 6, "status": 529, "due": ["Q-1124-1", "Q-1126-2"] }' }].concat(D.log) : D.log) + "</section>";
    },
    after: function () { if (X.is("maint")) maintSheet(); if (X.is("disabledomain")) X.acts.domain("hotmail.com"); }
  });
})();
