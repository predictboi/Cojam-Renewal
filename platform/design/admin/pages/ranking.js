/* AD5 Ranking and airdrop. States: last | ready | waiting | sending | failed | lowreserve | capped | empty | loading | error */
(function () {
  "use strict";
  var X = Admin, D = AD, n = X.n, tag = X.tag, ic = X.ic, esc = X.esc, fig = X.fig;
  var lastWeek = X.is("last", "ready", "waiting", "sending", "failed", "lowreserve"), capped = X.is("capped"), empty = X.is("empty");
  var air = { last: "Sent", ready: "Ready", waiting: "Waiting for late answers", sending: "Sending", failed: "Failed", lowreserve: "Ready" }[X.state] || "Not due";
  function rankBlock(r) { return '<span class="nb" data-k="' + (r === 1 ? "ink" : r === 2 ? "brand" : r === 3 ? "sky" : "") + '">' + r + "</span>"; }

  function selector() {
    return '<div class="sec-head" style="margin-bottom:16px"><div class="seg" role="group" aria-label="Week"><a href="?" aria-current="' + (lastWeek ? "false" : "page") + '">This week <span class="c">48</span></a><a href="?state=last" aria-current="' + (lastWeek ? "page" : "false") + '">Last week <span class="c">47</span></a></div>' +
      '<label class="sr" for="wk">Earlier weeks</label><select class="inp" id="wk" style="width:220px"><option>Earlier weeks</option><option>Week 46, 9 to 16 Nov: 978 CT sent</option><option>Week 45, 2 to 9 Nov: 702 CT sent</option></select>' +
      '<span class="sec-note">' + (lastWeek ? "Week 47, " + D.last.range + ". Closed. Late answers could add points until Wed 25 Nov, 21:00 KST." : "Week 48, " + D.now.weekRange + ". Ends in " + X.cd(D.now.weekEndsIn) + ".") + '</span><span class="sec-end">' + X.btn("Download CSV", { act: "csv" }) + "</span></div>";
  }

  function pool() {
    var w = lastWeek ? { qualified: D.last.qualified, pool: D.last.pool } : capped ? { qualified: 11460, pool: 10000 } : empty ? { qualified: 0, pool: 0 } : D.week;
    var played = lastWeek ? 2512 : capped ? 19840 : empty ? 0 : D.users.activeWeek, not = played - w.qualified;
    var reasons = lastWeek ? [998, 352, 31] : capped ? [6210, 2098, 72] : empty ? [0, 0, 0] : [1102, 318, 36];
    return '<section class="sec"><div class="sec-head"><h2>Pool</h2>' + (capped ? tag("At the cap", "warn") : "") + '<span class="sec-note">1 CT per qualified player, capped at 10,000 CT. Qualified: played 3 or more days this week, account older than 7 days, not blocked.</span></div>' +
      '<div class="cols cols-2 split"><div class="figs">' + fig("Qualified players", n(w.qualified), "of " + n(played) + " who played") + fig("Pool per player", "1<small>CT</small>", "Server setting") + fig(lastWeek ? "Pool, final" : "Pool so far", n(w.pool) + "<small>CT</small>", capped ? "<b>" + n(w.qualified - 10000) + " CT</b> cut by the cap" : lastWeek ? "Fixed when the week closed" : "Grows until Mon 09:00 KST") + "</div>" +
      '<div class="stack">' + X.meter(w.pool, 10000, { k: capped ? "warn" : "", left: "<b>Weekly pool cap:</b> " + n(w.pool) + " of 10,000 CT", right: X.pct(w.pool / 10000) + " used", aria: X.pct(w.pool / 10000) + " of the weekly pool cap used" }) +
      '<p class="hint">' + (empty ? "Nobody has played 3 days yet. The first players can qualify on Wednesday." : n(not) + " players who played are not in the pool: " + n(reasons[0]) + " played fewer than 3 days, " + n(reasons[1]) + " have an account younger than 7 days, " + reasons[2] + " are blocked." + (capped ? " The cap is a contract value: raising it is an owner proposal in Reward settings." : "")) + "</p></div></div></section>";
  }

  function standings() {
    var rows = lastWeek ? D.last.rows : D.rank.concat(D.rankNext), prizes = D.split10(capped ? 10000 : null);
    if (capped) rows = rows.map(function (r, i) { return Object.assign({}, r, { prize: i < 10 ? prizes[i] : undefined }); });
    if (empty) rows = [];
    var sent = air === "Sent";
    var cols = [
      { h: "Rank", w: "52px", val: function (r) { return r.rank; }, cell: function (r) { return r.rank <= 10 ? rankBlock(r.rank) : '<span class="nb" data-k="off">' + r.rank + "</span>"; } },
      { h: "Player", val: function (r) { return r.name.toLowerCase(); }, cell: function (r) { return '<span class="t1">' + esc(r.name) + "</span>"; } },
      { h: "Address", cell: function (r) { return X.addr(r.addr, { full: 1 }); } },
      { h: "Weekly points", num: 1, val: function (r) { return r.pts; }, cell: function (r) { return n(r.pts) + " P" + (r.hits != null ? '<span class="t2">' + r.days + " days, " + r.hits + " hits</span>" : ""); } },
      { h: "Share", num: 1, cell: function (r) { return r.rank <= 10 ? D.split[r.rank - 1] + "%" : ""; } },
      { h: "Prize", num: 1, val: function (r) { return r.prize || 0; }, cell: function (r) { return r.prize ? '<span class="num-d" style="font-size:15px">' + n(r.prize, 2) + "</span> CT" : '<span class="dim">Outside the top 10</span>'; } }
    ];
    if (lastWeek) cols.push({ h: "Payout", cell: function (r) { return sent ? tag("Sent", "up") : air === "Sending" ? (r.rank <= 4 ? tag("Sent", "up") : tag("Sending", "sky")) : air === "Failed" ? tag("Not sent", "down") : tag("Waiting", "line"); } });
    else cols.push({ h: "Order note", cell: function (r) { return r.tie ? '<span class="dim">' + r.tie + "</span>" : ""; } });
    cols.push({ h: "", cell: function (r) { return '<div class="row-acts">' + X.btn("Reset name", { link: 1, act: "reset", arg: r.name, write: 1, disabled: /^0x/.test(r.name) }) + "</div>"; } });
    var skipped = lastWeek ? X.note("", "<b>1 blocked winner skipped.</b> " + X.addr(D.last.skipped.addr) + " finished with " + n(D.last.skipped.pts) + " P and would have ranked " + D.last.skipped.wouldBe + ". " + D.last.skipped.why + ". Ranks 6 to 10 moved up one place and the 11th player took rank 10.", X.link("Open in Players", "players.html?state=blocked")) + '<div style="height:12px"></div>' : "";
    return '<section class="sec"><div class="sec-head"><h2>' + (lastWeek ? "Final standings" : "Standings") + '</h2><span class="sec-note">' + (lastWeek ? "Prediction points only. Invite bonus and welcome points are not counted." : "Prediction points only (100 P per finished day, 50 P per hit). Same points: whoever got there first ranks higher, then by address. Prizes are never split.") + "</span></div>" + skipped +
      X.table({ caption: "Weekly standings", rows: rows, cols: cols, sort: [0, "asc"], loading: X.is("loading"), error: X.is("error"), what: "The standings", cls: "tight",
        empty: X.empty("No standings yet", "Week 49 started at 09:00 KST and no hit points have been paid in it. The list fills as the first answers settle, about 6 hours after they are set."),
        foot: empty || X.is("loading", "error") ? "" : "<tfoot><tr><td colspan=\"5\">Top 10 prizes</td><td class=\"num\">" + n(capped ? 10000 : lastWeek ? D.last.pool : D.week.pool, 2) + ' CT</td><td colspan="2"></td></tr></tfoot>',
        after: lastWeek || empty || X.is("loading", "error") ? "" : '<div class="tbl-foot"><span>Ranks 1 to 12 of ' + n(D.week.playersRanked) + ". 12 of this week's 35 questions are settled, so the order still changes several times a day.</span>" + X.btn("Show ranks 13 to 50", { link: 1, act: "more" }) + "</div>" }) + "</section>";
  }

  function airdrop() {
    var L = D.last, need = L.pool, low = X.is("lowreserve"), reserve = low ? 640 : 25931;
    if (!lastWeek) return '<section class="sec"><div class="sec-head"><h2>Airdrop</h2>' + tag("Not due") + '</div><div class="cols cols-2 split"><div>' + X.kv([["Sends", "Wed 2 Dec, 21:00 KST (12:00 UTC), by itself"], ["Waits for", "Every answer of week 48: 35 questions, 12 settled so far"], ["Needs", "About " + n(capped ? 10000 : D.week.pool) + " CT from the prediction reserve, which holds " + n(D.reserves[0].bal) + " CT"], ["Last week", 'Week 47 sent, 1,131 CT <a class="link" href="?state=last">Open week 47</a>']]) + '</div><p class="hint">The airdrop needs no approval. This screen is for watching the checks, and for sending again by hand if a send fails. Blocked winners are skipped and the next rank moves up.</p></div></section>';
    var checks = [
      [air === "Waiting for late answers" ? "wait" : "ok", "Every answer of week 47 is in", air === "Waiting for late answers" ? "34 of 35. Q-1122-3 is late" : "34 set, 1 cancelled"],
      ["ok", "Order matches the contract's rule", "Points, then first to reach them, then address"],
      ["ok", "Blocked winners skipped", "1 skipped: " + X.short(L.skipped.addr) + ", ranks moved up"],
      [low ? "fail" : "ok", "The reward reserve has " + n(reserve) + " CT, this airdrop needs " + n(need) + " CT", low ? "Short by " + n(need - reserve) + " CT" : "Enough"],
      [air === "Failed" ? "fail" : "ok", "Operator wallet can pay the fee", air === "Failed" ? "0.4 KAIA, needs about 1.2 KAIA" : "96.3 KAIA"]
    ];
    var head = { Sent: X.note("up", "<b>Week 47 airdrop sent.</b> 10 payouts, " + n(need) + " CT, " + L.sentAt + " in " + X.tx(L.tx) + ", block " + L.block + "."),
      Ready: low ? X.note("down", "<b>The airdrop cannot be sent: the reserve is short by " + n(need - reserve) + " CT.</b> Payouts are paused, nothing is debited and players see a paused note. It sends by itself once the owner funds the prediction reserve.", X.link("Open System", "system.html")) : X.note("sky", "<b>Ready.</b> Every check passed. It sends by itself at " + L.due + ". You can also send it now."),
      "Waiting for late answers": X.note("warn", "<b>Waiting for 1 late answer.</b> Q-1122-3 can still add 50 P to players of week 47. The airdrop sends when it is set or cancelled, at the latest " + L.due + ".", X.link("Open Answers", "answers.html?state=late")),
      Sending: X.note("sky", "<b>Sending.</b> 4 of 10 payouts confirmed. Do not close the reserve or change the operator key while this runs.", '<span class="spin"></span>'),
      Failed: X.note("down", "<b>Airdrop failed: the operator wallet could not pay the network fee.</b> Nothing was sent and no prize was debited. Top up the operator wallet, then retry.", X.link("Open System", "system.html")) }[air];
    var act = air === "Ready" ? X.btn("Run airdrop now", { primary: 1, act: "run", write: 1, disabled: low }) : air === "Failed" ? X.btn("Retry airdrop", { primary: 1, act: "retry", write: 1 }) : air === "Sending" ? '<button type="button" class="btn btn-primary is-busy" disabled><span class="spin"></span>Sending 5 of 10</button>' : "";
    return '<section class="sec"><div class="sec-head"><h2>Airdrop, week 47</h2>' + tag(air) + '<span class="sec-note">Automatic on Wednesday 21:00 KST (12:00 UTC), after every answer of the week is in.</span></div>' + head +
      '<div class="cols cols-2 split" style="margin-top:16px"><div><h3 class="sub">Checks before sending</h3><ul class="chk">' + checks.map(function (c) { return '<li data-s="' + c[0] + '">' + ic(c[0] === "ok" ? "ok" : c[0] === "wait" ? "clock" : "no") + "<span>" + c[1] + '</span><span class="v">' + c[2] + "</span></li>"; }).join("") + "</ul></div><div>" +
      X.kv([["Pays", n(need, 2) + " CT to 10 addresses in 1 transaction"], ["From", "Prediction reserve " + X.addr(D.contracts.prediction)], ["Sent by", "Operator key, through the worker. No owner signature"], ["Due", L.due]]) + (act ? '<div class="acts" style="margin-top:16px">' + act + "</div>" : "") + "</div></div></section>";
  }

  X.acts.csv = function () { X.toast("cojam-week-" + (lastWeek ? 47 : 48) + "-ranking.csv downloaded."); };
  X.acts.more = function () { X.toast("Ranks 13 to 50 load here."); };
  X.acts.reset = function (name) { X.confirm({ title: "Reset the display name “" + name + "”?", body: "<p>The player sees their short address until they save a new name. Points, rank and prizes do not change.</p>", placeholder: "What is wrong with the name?", action: "Reset the name", done: "Name reset. The short address is shown." }); };
  function runSheet(retry) {
    X.confirm({ title: (retry ? "Retry" : "Run") + " the week 47 airdrop now?", reason: false, body: X.kv([["Pays", "1,131.00 CT to 10 addresses"], ["Rank 1", "kaia_whale, 339.30 CT"], ["Skipped", "1 blocked winner"], ["Reserve after", "24,800 CT"]]) + '<p class="hint">Sent once: the contract refuses a second airdrop for the same week.</p>', signer: "Sent with the operator key through the worker. No owner signature.", action: retry ? "Retry airdrop" : "Run airdrop now", next: "sending" });
  }
  X.acts.run = function () { runSheet(false); }; X.acts.retry = function () { runSheet(true); };

  X.mount({
    page: "ranking", title: "Ranking and airdrop", sub: "Weeks run Monday 09:00 KST to Monday 09:00 KST", states: ["last", "ready", "waiting", "sending", "failed", "lowreserve", "capped", "empty", "loading", "error"],
    render: function () { return selector() + (X.is("loading", "error") ? standings() : pool() + standings() + airdrop()); }
  });
})();
