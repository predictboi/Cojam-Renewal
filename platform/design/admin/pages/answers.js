/* AD4 Answers. States: correct | after | sign | compensate | compensated | void | late | rerun | waiting | corrected | empty | loading | error. Also ?q=Q-1125-5. */
(function () {
  "use strict";
  var X = Admin, D = AD, n = X.n, tag = X.tag, ic = X.ic, esc = X.esc, qs = new URLSearchParams(location.search);
  var BY = { after: "Q-1125-4", sign: "Q-1125-4", compensate: "Q-1125-4", compensated: "Q-1125-4", late: "Q-1124-1", rerun: "Q-1124-1", waiting: "Q-1125-3", corrected: "Q-1124-2" }[X.state] || "Q-1125-1";
  var selId = qs.get("q") || BY, sel = D.answers.filter(function (a) { return a.id === selId; })[0];
  var done = X.is("compensated"), tab = X.is("empty") ? "near" : qs.get("tab") || "all";
  if (done) { sel = Object.assign({}, sel, { state: "Corrected", ai: "r", hits: 1844, corrected: { from: "l", by: "ops@cojam.app", at: "Today 14:41", why: sel.fix.note, inside: false } }); }
  function ans(a, d) { return a.state === "Cancelled" && !d ? '<span class="dim">Voided</span>' : d ? '<span class="pk" data-d="' + d + '">' + esc(a[d]) + "</span>" : '<span class="dim">Not set</span>'; }
  function list() { return D.answers.map(function (a) { return a.id === sel.id ? sel : a; }); }

  function table() {
    var all = list(), counts = { all: all.length, waiting: 0, set: 0, corrected: 0, late: 0, near: 0 };
    all.forEach(function (a) { var t = a.state === "Corrected" ? "corrected" : a.tab; if (counts[t] != null && t !== "all") counts[t]++; });
    var rows = tab === "all" ? all : all.filter(function (a) { return (a.state === "Corrected" ? "corrected" : a.tab) === tab; });
    var seg = '<div class="seg" role="group" aria-label="Filter answers">' + [["all", "All"], ["waiting", "Waiting"], ["set", "Set"], ["corrected", "Corrected"], ["late", "Late"], ["near", "Near deadline"]].map(function (t) { return '<a href="?tab=' + t[0] + '" aria-current="' + (t[0] === tab ? "page" : "false") + '">' + t[1] + ' <span class="c">' + counts[t[0]] + "</span></a>"; }).join("") + "</div>";
    return '<section class="sec"><div class="sec-head">' + seg + '<span class="sec-note">The last 2 sets.</span><span class="sec-end"><label class="search" style="width:240px"><span class="sr">Search answers</span>' + ic("search") + '<input class="inp" type="search" placeholder="Search id or text"></label></span></div>' +
      X.table({
        caption: "Answers", rows: rows, loading: X.is("loading"), error: X.is("error"), what: "The answer list", cls: "tight", sort: [4, "desc"],
        selected: function (r) { return r.id === sel.id; },
        empty: X.empty("No answer is near its deadline", "A question is cancelled 48 hours after its set closes if it still has no answer. Anything with less than 8 hours left shows here. The closest now is Q-1124-1, with 18 hours left.", X.link("Show all answers", "?tab=all")),
        cols: [
          { h: "Question", val: function (r) { return r.id; }, cell: function (r) { return '<a class="t1" style="color:inherit" href="?q=' + r.id + '">' + esc(r.title) + '</a><span class="t2">' + r.id + " · set of " + r.set + " · closed " + r.closed + "</span>"; } },
          { h: "AI answer", cell: function (r) { return ans(r, r.ai) + (r.corrected ? '<span class="t2">was ' + esc(r[r.corrected.from]) + "</span>" : ""); } },
          { h: "Confidence", num: 1, val: function (r) { return r.conf || 0; }, cell: function (r) { return r.conf ? r.conf.toFixed(2) + (r.conf < 0.9 && r.state !== "Corrected" ? " " + tag("Low", "warn") : "") : ""; } },
          { h: "Set at", cell: function (r) { return r.setAt || (r.late ? '<span style="color:var(--warn);font-weight:700">' + r.late + "</span>" : (r.due ? '<span class="dim">Due ' + r.due + "</span>" : "")); } },
          { h: "Correction window", val: function (r) { return r.winIn ? 1e6 : 0; }, cell: function (r) { return r.winIn ? "<b>Ends in " + X.cd(r.winIn) + '</b><span class="t2">Nobody is paid yet</span>' : r.winEnds ? '<span class="dim">Ended ' + r.winEnds + "</span>" : ""; } },
          { h: "Hits", num: 1, val: function (r) { return r.hits; }, cell: function (r) { return r.hits ? n(r.hits) + '<span class="t2">' + (r.paid ? "paid" : "pending") + "</span>" : ""; } },
          { h: "Deadline", cell: function (r) { return r.state === "Waiting" || r.state === "Late" ? r.deadline + (r.deadlineIn ? '<span class="t2">in ' + X.cd(r.deadlineIn) + "</span>" : "") : '<span class="dim">' + r.deadline + "</span>"; } },
          { h: "State", cell: function (r) { return tag(r.state) + (r.flag && r.state !== "Corrected" ? " " + tag("Check", "warn") : ""); } }
        ]
      }) + "</section>";
  }

  function evidence(a) {
    var p = a.picks, pc = p[0] / (p[0] + p[1]) * 100;
    var ev = a.ev.length ? '<table class="tbl tight vtop"><caption class="sr">Evidence</caption><thead><tr><th scope="col">Source</th><th scope="col">Quoted text</th><th scope="col">Captured value</th><th scope="col">Fetched</th></tr></thead><tbody>' + a.ev.map(function (e) { return '<tr><td><a href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.src) + '</a></td><td><span class="mono">' + esc(e.quote) + '</span></td><td><b>' + esc(e.value) + '</b></td><td class="nowrap">' + e.at + "</td></tr>"; }).join("") + "</tbody></table>" :
      '<p class="dim">' + (a.err ? "No evidence was accepted. " + esc(a.err) : a.state === "Cancelled" ? "No answer: the question was voided." : "The AI has not run yet. It runs at the due time and fetches the source then.") + "</p>";
    return '<h3 class="sub">Evidence</h3>' + ev + '<h3 class="sub">Record</h3>' + X.kv([
      ["Answer rule", esc(a.rule)],
      ["AI answer", ans(a, a.ai) + (a.conf ? ' <span class="dim">confidence ' + a.conf.toFixed(2) + (a.ev.length > 1 ? ", " + a.ev.length + " sources agree" : ", 1 source") + "</span>" : "")],
      ["Set on chain", a.tx ? a.setAt + " KST by the operator key " + X.tx(a.tx) : "Not yet"],
      ["Picks", '<div class="splitcell" style="max-width:320px"><span><span class="pk" data-d="l">' + esc(a.l) + " " + n(p[0]) + '</span><span class="pk" data-d="r">' + n(p[1]) + " " + esc(a.r) + '</span></span><div class="splitbar" role="img" aria-label="' + n(p[0]) + " picked " + a.l + ", " + n(p[1]) + " picked " + a.r + '"><i style="width:' + pc + '%"></i><u></u></div></div>'],
      ["Hits", a.hits ? n(a.hits) + " × 50 P = " + n(a.hits * 50) + " P, " + (a.paid ? "paid " + a.winEnds + " KST" : "pays " + a.winEnds + " KST when the window ends") : "None"],
      ["Deadline", a.deadline + " KST (set close plus 48 hours)"]
    ]);
  }

  function impact(a) {
    var f = a.fix, right = f.right, wrong = right === "l" ? "r" : "l", pay = f.players * 50, inv = f.invited * 5;
    return '<table class="tbl tight"><caption class="sr">What the correction pays</caption><thead><tr><th scope="col">Who</th><th scope="col" class="num">Players</th><th scope="col" class="num">Points</th></tr></thead><tbody>' +
      "<tr><td><b>Picked " + esc(a[right]) + '</b><span class="t2">Get the hit they were owed, +50 P each</span></td><td class="num">' + n(f.players) + '</td><td class="num">+' + n(pay) + " P</td></tr>" +
      '<tr><td><b>Their inviters</b><span class="t2">10% on top, for the ' + n(f.invited) + ' of those players who were invited</span></td><td class="num">214</td><td class="num">+' + n(inv) + " P</td></tr>" +
      "<tr><td><b>Picked " + esc(a[wrong]) + '</b><span class="t2">Were paid on the wrong answer. They keep their points: no balance is ever lowered</span></td><td class="num">' + n(f.wrongPaid) + '</td><td class="num">0 P</td></tr>' +
      '</tbody><tfoot><tr><td>New points to mint</td><td class="num">' + n(f.players + 214) + '</td><td class="num">+' + n(pay + inv) + " P</td></tr></tfoot></table>" +
      '<p class="hint" style="margin-top:8px">The 50 P count as hit points in week 48, so the weekly ranking moves: 6 of the current top 10 picked ' + esc(a[right]) + ". Worth " + n((pay + inv) / 1000, 2) + " CT at 1,000 P = 1 CT.</p>";
  }

  function tool(a) {
    var st = a.state;
    if (X.is("compensate")) return '<h3 class="sub">Compensation is running</h3><ol class="steps"><li data-s="done"><span class="nb" data-k="ink">' + ic("check", 14) + '</span><div><p class="t1">Corrected answer signed by the owner wallet</p><p class="t2">Today 14:38 KST ' + X.tx(D.TX("fix-1125-4")) + '</p></div></li><li data-s="now"><span class="nb">2</span><div><p class="t1">Operator pays the compensation</p><p class="t2">Batch 13 of 21. 612 of 1,041 players paid, 30,600 P and 1,090 P invite bonus so far.</p>' + X.meter(612, 1041, { left: "612 of 1,041", right: "about 40 s left" }) + '</div><span class="spin"></span></li><li data-s="wait"><span class="nb" data-k="off">3</span><div><p class="t1">Players see Corrected in Results</p><p class="t2">With the date, and a toast: +50P paid.</p></div></li></ol><p class="hint">You can leave this page. The batches continue on the worker and every transaction is written to the log below. If a batch fails, nothing in it is paid and a Retry button appears here.</p>';
    if (st === "Corrected") { var c = a.corrected; return '<h3 class="sub">Correction record</h3>' + X.note("up", "<b>Corrected " + (c.inside ? "inside the window" : "after the window, with compensation") + ".</b> " + (c.inside ? "Nobody had been paid, so the pending hits simply changed." : "1,041 players were paid +50 P each (52,050 P) and their inviters 1,860 P. The 803 players paid for No kept their points.")) + '<div style="height:12px"></div>' + X.kv([["From", ans(a, c.from)], ["To", ans(a, a.ai)], ["By", c.by + ", " + c.at + " KST"], ["Signed with", c.inside ? "Operator key" : "Owner wallet (answer), operator key (compensation)"], ["Reason", esc(c.why)]]); }
    if (st === "Cancelled") return '<h3 class="sub">Voided</h3>' + X.kv([["By", a.voided.by + ", " + a.voided.at + " KST"], ["Reason", esc(a.voided.why)], ["Effect", "No hit points. Picks on it counted toward the day's 5."]]);
    if (st === "Waiting") return '<h3 class="sub">Waiting for the answer</h3><div class="fig"><span class="fig-l">The AI runs in</span><span class="fig-v">' + X.cd(a.dueIn) + '</span><span class="fig-s">Due ' + a.due + " KST. Nothing to do until then.</span></div>" + '<div class="acts" style="margin-top:16px">' + X.btn("Void this question", { link: 1, danger: 1, act: "void", write: 1 }) + "</div>";
    if (st === "Late") return '<h3 class="sub">The answer is late</h3>' + (X.is("rerun") ? X.note("sky", "<b>The AI is running again.</b> Fetching indexes.nikkei.co.jp, attempt 5. This usually takes under a minute.", '<span class="spin"></span>') : X.note("warn", "<b>" + a.late + ".</b> " + esc(a.err))) +
      '<div class="fig" style="margin-top:16px"><span class="fig-l">Cancelled automatically in</span><span class="fig-v">' + X.cd(a.deadlineIn) + '</span><span class="fig-s">At ' + a.deadline + " KST, 48 hours after the set closed. Players then see Cancelled and no hit points are paid.</span></div>" +
      '<div class="acts" style="margin-top:16px">' + X.btn(X.is("rerun") ? "Running" : "Run AI again", { primary: 1, act: "rerun", write: 1, disabled: X.is("rerun") }) + X.btn("Set the answer by hand", { act: "correct", write: 1 }) + X.btn("Void this question", { link: 1, danger: 1, act: "void", write: 1 }) + "</div>" +
      '<p class="hint" style="margin-top:8px">Setting by hand uses the operator key and starts the normal 6 hour correction window.</p>';
    if (a.winIn) return '<h3 class="sub">Correction window is open</h3><div class="fig"><span class="fig-l">Hit points are paid in</span><span class="fig-v l">' + X.cd(a.winIn) + '</span><span class="fig-s">At ' + a.winEnds + " KST. Until then nobody is paid, so a correction only changes the pending hits.</span></div>" +
      '<div class="acts" style="margin-top:16px">' + X.btn("Correct this answer", { act: "correct", write: 1 }) + X.btn("Void this question", { link: 1, danger: 1, act: "void", write: 1 }) + "</div>" +
      '<p class="hint" style="margin-top:8px">Inside the window the operator key replaces the answer. No owner signature, no compensation.</p>';
    /* after the window: corrected outcome plus compensation */
    if (!a.fix) return '<h3 class="sub">Paid</h3><p class="dim">The window ended ' + a.winEnds + " KST and " + n(a.hits) + ' hits were paid. If the answer turns out wrong, set a corrected outcome: the players who were right are paid, nobody loses points.</p><div class="acts" style="margin-top:12px">' + X.btn("Set a corrected outcome", { act: "toast", arg: "Choose the right answer, give a reason, and the impact table opens here.", write: 1 }) + "</div>";
    return '<h3 class="sub">Set a corrected outcome and compensate</h3>' + X.note("warn", "<b>The window ended " + a.winEnds + " KST and " + n(a.hits) + " hits were paid for " + esc(a[a.ai]) + ".</b> A correction now pays the players who were right. It takes nothing back.") +
      '<div class="stack" style="margin-top:16px;gap:16px"><fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;font-size:13px;padding:0;margin-bottom:6px">The right answer</legend><div class="seg" role="radiogroup"><button type="button" role="radio" aria-checked="false" aria-pressed="false">' + ans(a, "l") + '</button><button type="button" role="radio" aria-checked="true" aria-pressed="true">' + ans(a, "r") + "</button></div></fieldset>" +
      '<div class="fl"><label for="fixwhy">Reason <span class="cnt">Required, shown in the audit log</span></label><textarea class="inp" id="fixwhy" rows="2">' + esc(a.fix.note) + "</textarea></div>" + impact(a) +
      '<div class="acts">' + X.btn("Review and sign", { primary: 1, act: "sign", write: 1 }) + X.btn("Void instead", { link: 1, danger: 1, act: "void", write: 1 }) + "</div></div>";
  }

  function detail(a) {
    return '<section class="sec"><div class="sec-head"><h2>' + a.id + "</h2>" + tag(a.state) + (a.flag && a.state !== "Corrected" ? tag("Low confidence", "warn") : "") + '<span class="sec-note">' + esc(a.title) + '</span></div><div class="cols cols-7-5 split"><div>' + evidence(a) + "</div><div>" + tool(a) + "</div></div></section>";
  }

  function correctSheet() {
    var a = sel, other = a.ai === "l" ? "r" : "l";
    X.confirm({ title: (a.ai ? "Correct " : "Set ") + a.id + (a.ai ? " inside the window?" : " by hand?"), body: "<p>" + esc(a.title) + "</p>" + X.kv(a.ai ? [["AI answer", ans(a, a.ai)], ["Corrected to", ans(a, other)], ["Pending hits", n(a.picks[a.ai === "l" ? 0 : 1]) + " change to " + n(a.picks[other === "l" ? 0 : 1])], ["Paid so far", "Nobody. The window ends in " + X.dur(a.winIn || 0)]] : [["Answer", '<div class="seg" role="radiogroup"><button type="button" role="radio" aria-pressed="true">' + ans(a, "l") + '</button><button type="button" role="radio" aria-pressed="false">' + ans(a, "r") + "</button></div>"], ["Then", "The 6 hour correction window starts now"]]),
      placeholder: "Which source shows the right answer?", reasonErr: "Give a reason for the correction.", signer: "Sent with the operator key through the worker. No owner signature.", action: a.ai ? "Apply correction" : "Set the answer", done: a.id + (a.ai ? " corrected to " + a[other] + ". Pending hits changed." : " set. The correction window is open.") });
  }
  function signSheet() {
    var a = sel;
    X.sheet({ title: "Correct " + a.id + " and pay compensation", wide: 1, body: "<p>" + esc(a.title) + "</p>" + X.kv([["Was", ans(a, a.ai)], ["Corrected to", ans(a, a.fix.right)], ["Reason", esc(a.fix.note)]]) + impact(a) +
      '<ol class="steps"><li data-s="now"><span class="nb">1</span><div><p class="t1">Connect the owner wallet and sign the corrected answer</p><p class="t2">After the window only the owner can change an answer: ' + X.addr(D.owner, { full: 1, link: false }) + '. It signs in this browser and pays the network fee.</p></div></li><li data-s="wait"><span class="nb" data-k="off">2</span><div><p class="t1">The operator pays the compensation</p><p class="t2">21 batches of 50 players, sent by the worker with the operator key. The invite bonus is paid in the same transactions.</p></div></li></ol>',
      cancel: "Back", action: '<button type="button" class="btn btn-primary" data-act="go" data-arg="compensate">Connect the owner wallet</button>' });
  }
  function voidSheet() {
    var a = sel;
    X.confirm({ title: "Void " + a.id + "?", body: "<p>" + esc(a.title) + "</p>" + X.kv([["Hit points", a.paid ? n(a.hits) + " hits already paid stay with the players" : "None will be paid"], ["Players see", "Cancelled, in Results"], ["The day's 100 P", "Not affected"]]) + X.note("warn", "<b>This cannot be undone.</b> Use it when the question itself was broken, not when the AI read the source wrong: for that, correct the answer."),
      placeholder: "What made the question impossible to settle?", signer: "Sent with the operator key. No owner signature.", action: "Void the question", cancel: "Keep it", done: a.id + " voided." });
  }
  X.acts.correct = correctSheet; X.acts.sign = signSheet; X.acts["void"] = voidSheet;
  X.acts.go = function (s) { X.go(s); };
  X.acts.rerun = function () { X.go("rerun"); };
  X.acts.toast = function (m) { X.toast(m); };

  X.mount({
    page: "answers", title: "Answers", sub: "Set by AI. Hit points are paid 6 hours after an answer is set.", states: ["correct", "after", "sign", "compensate", "compensated", "void", "late", "rerun", "waiting", "corrected", "empty", "loading", "error"],
    render: function () {
      var log = D.answerAudit;
      if (done) log = [{ t: "Thu 14:41:52", who: "Compensation", lv: "info", msg: "Q-1125-4: paid 1,041 players 52,050 P and 214 inviters 1,860 P in 21 batches.", tx: D.TX("comp-1125-4") }, { t: "Thu 14:38:20", who: "Owner wallet", lv: "info", msg: "Corrected Q-1125-4 from No to Yes after the window. Built by ops@cojam.app. Reason: " + sel.fix.note, tx: D.TX("fix-1125-4") }].concat(log);
      return table() + (X.is("loading", "error", "empty") ? "" : detail(sel) + '<section class="sec"><div class="sec-head"><h2>Audit log</h2><span class="sec-note">Every answer set, correction, void and payment, with who did it</span></div>' + X.log(log) + "</section>");
    },
    after: function () { if (X.is("correct")) correctSheet(); if (X.is("sign")) signSheet(); if (X.is("void")) voidSheet(); }
  });
})();
