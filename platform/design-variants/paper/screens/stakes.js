/* Staking, my stakes: the total leads, then one entry per stake under a rule: what is locked, how far along it is, what it has earned, and its action. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$;
  var DAY = 86400000, YEAR = 365 * 86400;
  var stakes = M.stakes.slice();
  var hold = /^hold/.test(S), kaia = M.user.kaia, noKaia = false, HQ = hold ? "?state=hold" : "";
  if (S === "claimable" || hold) stakes.unshift(M.stakeBig);
  if (S === "unlocking") stakes[0] = { id: "u", amount: 1000, days: 90, rate: 13, start: new Date(Date.now() - 90 * DAY + 6000) };
  function calc(s) {
    var el = Math.min((Date.now() - s.start) / 1000, s.days * 86400), per = s.amount * s.rate / 100 / YEAR;
    return { interest: per * el, per: per, cap: per * s.days * 86400, day: Math.min(s.days, Math.floor(el / 86400) + 1), unlocked: el >= s.days * 86400, unlock: new Date(+s.start + s.days * DAY), pct: Math.min(100, el / (s.days * 864)) };
  }
  var total = stakes.reduce(function (a, s) { return a + s.amount; }, 0);
  var sofar = stakes.reduce(function (a, s) { return a + calc(s).interest; }, 0), perAll = stakes.reduce(function (a, s) { var c = calc(s); return a + (c.unlocked ? 0 : c.per); }, 0);
  var claimable = stakes.reduce(function (a, s) { var c = calc(s); return a + (c.unlocked || c.interest >= M.minClaim ? c.interest : 0); }, 0);
  function fix4(n) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
  function dg(s) { return String(s).replace(/\d/g, '<i class="dg">$&</i>'); }

  function head() { return '<div class="ph-top"><h1>' + t("s.title") + "</h1></div>"; }
  function sw() { return '<nav class="mtabs" id="sw" aria-label="' + App.esc(t("s.switch")) + '"><a href="staking.html' + HQ + '">' + t("s.new") + '</a><a href="stakes.html' + (hold ? "?state=" + S : "") + '" aria-current="page">' + t("s.tab.mine") + '<span class="mtabs-n">' + (S === "empty" ? 0 : stakes.length) + "</span></a></nav>"; }
  function out(s) { return Math.round((s.amount + calc(s).interest) * 1e4) / 1e4; }
  var feeLine = hold ? '<p class="hold-why" data-fee-line>' + C.icon("info", 16) + "<span>" + t("hold.fee.line") + " (" + t("x.fee.v", { f: M.fee }) + ")</span></p>" : "";
  function card(s) {
    var c = calc(s), actions;
    if (c.unlocked) actions = '<div class="mstake-acts" data-actions>' + C.btn(t("m.withdraw", { a: F.dec(out(s), 4) }), { kind: "primary", block: true, attrs: 'data-wd="' + s.id + '"', disabled: App.offline || noKaia }) + '<p class="tiny muted center">' + t("m.withint", { p: F.dec(s.amount), i: F.dec(c.interest, 4) }) + "</p>" + feeLine + "</div>";
    else if (c.interest >= M.minClaim) actions = '<div class="mstake-acts" data-actions>' + C.btn(t("m.claim", { i: F.dec(c.interest, 2) }), { block: true, attrs: 'data-claim="' + s.id + '"', disabled: App.offline || noKaia }) + feeLine + "</div>";
    else actions = '<p class="mstake-gap" data-actions>' + t("m.claim.gap", { g: F.dec(M.minClaim - c.interest, 2) }) + "</p>";
    return '<article class="msec mstake" data-stake="' + s.id + '"><div class="mstake-top"><div class="mhero"><p class="fig">' + F.dec(s.amount) + '<small>CT</small></p><p class="small muted">' + t("m.card.period", { d: s.days, r: s.rate }) + "</p></div>" +
      '<span data-status>' + (c.unlocked ? C.tag(t("m.unlocked"), "ink") : C.tag(t("m.locked"), "", "lock")) + "</span></div>" +
      '<div class="stack-8"><div class="mbar' + (c.unlocked ? " is-full" : "") + '" role="img" aria-label="' + t("m.day", { x: c.day, d: s.days }) + '"><i style="width:' + c.pct.toFixed(1) + '%"></i></div>' +
      '<div class="mbar-meta"><span>' + t("m.started", { date: F.date(s.start) }) + "</span><b>" + t("m.day", { x: c.day, d: s.days }) + "</b><span>" + t("m.unlocks", { date: F.date(c.unlock) }) + "</span></div></div>" +
      C.rows([[t("m.interest"), '<span data-tick="' + c.interest + "|" + (c.unlocked ? 0 : c.per) + "|" + c.cap + '">' + dg(fix4(c.interest)) + "</span> CT" + (App.offline ? "<small>" + t("m.paused") + "</small>" : ""), true]]) +
      actions + "</article>";
  }
  function body() {
    if (S === "error") return sw() + C.error();
    if (S === "empty") return sw() + C.empty({ icon: "lock", title: t("m.empty.h"), body: t("m.empty.b"), action: C.btn(t("m.empty.btn"), { kind: "primary", href: "staking.html" }) });
    if (S === "loading") return sw() + '<section class="msec" aria-busy="true">' + C.skel("90px") + C.skel("170px", "44px") + C.skel("70%", "22px") + "</section>" + [1, 2].map(function () { return '<article class="msec" aria-busy="true">' + C.skel("120px", "30px") + C.skel("100%", "10px") + C.skel("100%") + C.skel("100%", "44px") + "</article>"; }).join("") + '<p class="sr-only" role="status">' + t("common.loading") + "</p>";
    return sw() +
      (hold ? C.hold(t("hold.stakes")) : "") +
      '<section class="msec" id="total"><div class="mhero"><h2 class="lbl">' + t("m.staked") + '</h2><p class="fig fig--xl">' + F.dec(total) + "<small>CT</small></p></div>" +
      '<div class="stats"><div class="stat"><b><span data-tick="' + sofar + "|" + perAll + '">' + dg(fix4(sofar)) + "</span></b><span>" + t("m.sofar") + ' (CT)</span></div><div class="stat"><b>' + fix4(claimable) + "</b><span>" + t("m.claimable") + " (CT)</span></div></div>" +
      (hold ? C.rows([[t("x.kaia"), F.kaia(kaia)], [t("x.fee"), t("x.fee.v", { f: M.fee })]]) : "") + "</section>" +
      stakes.map(card).join("") +
      C.help(t("m.closed.q", { n: M.stakesClosed.length }), M.stakesClosed.map(function (s) { return '<div class="mclosed"><div class="row-between"><span>' + F.ct(s.amount) + ", " + t("m.card.period", { d: s.days, r: s.rate }) + "</span>" + C.tag(t("m.closed"), "line") + '</div><p class="tiny muted">' + t("m.paidout", { a: F.dec(s.paid, 2) }) + "</p></div>"; }).join(""));
  }
  function find(id) { return stakes.filter(function (s) { return s.id === id; })[0]; }
  App.mount({ tab: "stake", docTitle: t("s.title"), live: C.stamp(6), head: head(), body: body(), badges: { home: "dot", results: 2 }, after: function () {
    document.addEventListener("click", function (e) {
      var c = e.target.closest("[data-claim]"), w = e.target.closest("[data-wd]");
      function rv(title, amount) { return hold ? { title: title, rows: [[t("x.amount"), amount], [t("x.fee"), t("x.fee.v", { f: M.fee })], [t("x.kaia"), F.kaia(kaia)]], note: t("hold.fee.line") + ". " + t("hold.fee.rv"), confirm: t("tx.confirm") } : null; }
      if (c) { var s = find(c.getAttribute("data-claim")), i = F.dec(calc(s).interest, 2); App.tx.run({ label: t("m.chip.claim", { i: i }), review: rv(t("m.claim", { i: i }), F.ct(calc(s).interest)), success: { title: t("m.ok.claim", { i: i }) } }); }
      if (w) { var s2 = find(w.getAttribute("data-wd")), a = F.dec(out(s2), 4); App.tx.run({ label: t("m.chip.wd", { a: a }), review: rv(t("m.withdraw", { a: a }), F.ct(out(s2))), success: { title: t("m.ok.wd", { a: a }) }, onDone: function () { var el = $('[data-stake="' + s2.id + '"]'); if (el) el.remove(); } }); }
    });
    if (S === "unlocking") setTimeout(function () {
      var s = stakes[0], el = $('[data-stake="u"]'); if (!el) return;
      el.outerHTML = card(s); App.enhance(document.body); App.live(t("m.unlocked"));
    }, 6500);
  } });
})();
