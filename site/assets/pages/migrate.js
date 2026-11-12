// Swap app (/migrate/). Mock only: every wait is a timer, every transaction a fake hash.
// States are reachable by use and by ?state=<name> (see setState at the bottom).
(function () {
  var C = CJ.config, L = CJ.ledger, t = CJ.t, F = CJ.fmt, I = CJ.icon, DAY = CJ.DAY;
  var GAS = { approve: 0.004, swap: 0.012, claim: 0.006 };
  var BIG = 1000000, WALLET_MS = 1500, CHAIN_MS = 3000;
  var DOCS = (document.body.dataset.root || "../") + "docs/";

  function $(id) { return document.getElementById(id); }
  var panel = $("mg-panel"), hist = $("mg-hist"), live = $("mg-live"), menu = $("mg-menu");
  var kbd = $("mg-kbd"), wbtn = $("cj-wallet");

  var ui = freshUi();
  function freshUi() {
    return { phase: "form", text: null, amount: 0, error: null, errKind: null, wait: null, frozen: false, closed: false,
      lotId: null, claimIds: null, mode: null, reviewed: false, partialOff: false, loading: false, walletKey: "kaia", view: null, payOwn: false };
  }
  var timer = null, lastView = null, lastLive = "";

  // ---------- helpers ----------
  function A(v) { return F.amount(v, 6); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function led() { return L.get(); }
  function lots(status) { return led().lots.filter(function (l) { return !status || L.lotStatus(l) === status; }); }
  function sum(arr) { return arr.reduce(function (a, l) { return a + l.amount; }, 0); }
  function sumL(arr) { return arr.reduce(function (a, l) { return a + l.locked; }, 0); }
  function sp(v) { return CJ.split(v); }
  // month and day, short enough to sit beside the amount at 390 px; the full date is in the help and on the track
  function md(ts) { return new Intl.DateTimeFormat({ en: "en-US", ko: "ko-KR", ja: "ja-JP" }[CJ.lang()], { month: "short", day: "numeric", timeZone: "UTC" }).format(ts); }
  function ids(arr) { return arr.map(function (l) { return l.id; }).join(","); }
  function byId(id) { return led().lots.filter(function (l) { return l.id === id; })[0]; }
  function isClosed() { return ui.closed || CJ.windowState() === "closed"; }
  function plain(v) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(v); }
  function gas(v) { return F.amount(v, 3); }
  function walletName() { return t("ch." + (led().wallet.app || ui.walletKey || "kaia")); }
  function num(s) { return '<span class="num">' + s + "</span>"; }
  function dur(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, o = [];
    if (d) o.push(t("dur.d", { n: d }));
    if (d || h) o.push(t("dur.h", { n: h }));
    if (d || h || m) o.push(t("dur.min", { n: m }));
    if (!d) o.push(t("dur.s", { n: x }));
    return o.join(" ");
  }
  function unlockAt() { return CJ.now() + C.lockDays * DAY; }
  // Fee delegation: Kaia Wallet and WalletConnect wallets sign fee delegated transactions and Cojam's fee payer pays the fee.
  // MetaMask cannot sign them, so MetaMask users (or anyone who chose to pay after a fee payer error) pay in KAIA.
  // "web3" is an unknown injected wallet: treated like MetaMask, since only Kaia aware wallets sign fee delegated transactions.
  function kind() { var w = led().wallet; return w.kind || w.app || ui.walletKey || "kaia"; }
  function selfPay() { var k = kind(); return k === "mm" || k === "web3"; }
  function sponsored() { return !selfPay() && !ui.payOwn; }
  function feeRow(need) {
    var r = sponsored()
      ? row(t("gas.k") + help("help.sponsor"), num(t("f.gas.free")), null, t("f.gas.free.sub"))
      : row(t("gas.k") + help("help.gas"), num(t("f.gas.v", { amount: gas(need) })), null, t("f.gas.have", { amount: gas(led().wallet.kaia) }));
    return r.replace('<div class="mg-row">', '<div class="mg-row" id="mg-feerow">');
  }
  function gasNeed(amt) { return led().allowance >= amt && amt > 0 ? GAS.swap : GAS.approve + GAS.swap; }
  function txLink(hash, label) {
    return '<a class="mg-tx" href="' + C.explorer + "/tx/" + hash + '" target="_blank" rel="noopener"><span>' + label + '</span> <span class="mg-hash">' + F.addr(hash) + "</span>" + I("ext", 14) + "</a>";
  }
  function help(key) {
    return '<details class="help"><summary aria-label="' + esc(t("help.label")) + '">' + I("help", 18) + '</summary><div class="help-pop">' + t(key) + "</div></details>";
  }
  // A sentence with a help toggle kept beside it, so the toggle never wraps onto a line of its own.
  function withHelp(text, key, cls) { return '<div class="mg-hh' + (cls ? " " + cls : "") + '"><span>' + text + "</span>" + help(key) + "</div>"; }
  function row(k, v, id, sub) {
    return '<div class="mg-row"><dt>' + k + "</dt><dd" + (id ? ' id="' + id + '"' : "") + ">" + v + (sub ? '<span class="mg-sub">' + sub + "</span>" : "") + "</dd></div>";
  }
  function head(title, opts) {
    opts = opts || {};
    return '<div class="mg-vhead">' +
      (opts.back ? '<button type="button" class="btn btn-ghost mg-back" data-act="back">' + I("chevron", 18) + "<span>" + t("back") + "</span></button>" : "") +
      (opts.badge ? '<span class="mg-badge">' + I(opts.badge, 22) + "</span>" : "") +
      '<h2 id="mg-h" tabindex="-1">' + title + "</h2></div>";
  }
  function note(kind, msg, fix, id) {
    var ic = kind === "error" || kind === "warn" ? "warn" : "info";
    return '<div class="note note-' + kind + ' mg-note"' + (id ? ' id="' + id + '"' : "") + ">" + I(ic, 18) + '<div class="note-body">' + (/^<(p|div)/.test(msg) ? msg : "<p>" + msg + "</p>") + (fix ? '<div class="note-action mg-fixes">' + fix + "</div>" : "") + "</div></div>";
  }
  function primary(label, act, extra) { return '<button type="button" class="btn btn-primary btn-lg btn-block" data-act="' + act + '"' + (extra || "") + ">" + label + "</button>"; }
  // The primary action, or the rejected note with Try again in its place.
  function cta(label, act, extra) {
    if (ui.error === "rejected") return note("error", t("er.rejected"), '<button type="button" class="btn btn-primary" data-act="' + act + '"' + (extra || "") + ">" + t("er.retry") + "</button>");
    if (ui.error === "sponsor") return sponsorNote(act, extra);
    return primary(label, act, extra);
  }
  // The fee payer could not pay (busy, or this wallet reached its limit): retry, or pay the fee in KAIA yourself.
  function sponsorNote(act, extra) {
    return note("error", withHelp(t("er.sponsor"), "help.sponsor"),
      '<button type="button" class="btn btn-primary" data-retry data-act="' + act + '"' + (extra || "").replace(" disabled", "") + ">" + I("refresh", 18) + "<span>" + t("er.retry") + "</span></button>" +
      '<button type="button" class="btn" data-act="pay-own">' + t("er.sponsor.own") + "</button>");
  }
  function steps(cur) {
    return '<ol class="steps mg-steps" aria-label="' + esc(t("st.aria")) + '"><li' + (cur === 1 ? ' aria-current="step"' : ' class="is-done"') + ">" + t("st.approve") + "</li><li" + (cur === 2 ? ' aria-current="step"' : "") + ">" + t("st.swap") + "</li></ol>";
  }
  function summary(amt) {
    return '<dl class="mg-rows">' +
      row(t("sum.send"), num(t("sum.send.v", { amount: A(amt) }))) +
      splitRows(amt) +
      feeRow(ui.phase === "swap" ? GAS.swap : GAS.approve + GAS.swap) +
      "</dl>";
  }

  // "You get now: X new CT (10%)" and "On <date>: Y new CT (90%)", shared by the form, approve and swap views.
  function splitRows(amt, ids) {
    var p = sp(amt);
    return row(t("f.now") + help("help.split"), num(t("f.now.v", { amount: A(p.instant) })), ids ? "mg-now" : null) +
      row(t("f.later", { date: md(unlockAt()) }) + help("help.lock"), num(t("f.later.v", { amount: A(p.locked) })), ids ? "mg-later" : null, t("f.later.sub"));
  }

  // ---------- views ----------
  var V = {};
  V.disconnected = function () {
    return head(t("dc.title")) + '<p class="mg-lead">' + t("dc.body") + "</p>" +
      '<dl class="mg-rows">' +
      row(t("rate.k") + help("help.rate"), num(t("rate.v"))) +
      row(t("lock.k") + help("help.lock"), t("lock.v", { days: C.lockDays })) +
      row(t("window.k"), t("window.v", { date: F.date(C.windowEnd) })) +
      row(t("gas.k") + help("help.sponsor"), t("gas.v")) +
      "</dl>" +
      '<h3 class="mg-h3">' + t("dc.addrs") + '</h3><div class="mg-addrs"><div class="addr" data-addr="old"></div><div class="addr" data-addr="new"></div><div class="addr" data-addr="swap"></div></div>' +
      '<div class="mg-actions">' + cta(CJ.wallet.ctaLabel(), "connect") + "</div>";
  };
  V["wrong-network"] = function () {
    return head(t("wn.title")) + '<p class="mg-lead">' + t("wn.body", { id: C.chainId }) + "</p>" +
      '<div class="mg-actions">' + cta(t("wn.cta"), "network") + "</div>";
  };
  V.empty = function () {
    var done = led().lots.length > 0;
    var link = function (href, k) {
      return '<li><a class="mg-link" href="' + href + '"><span><span class="mg-link-t">' + t(k) + '</span><span class="mg-link-s">' + t(k + ".sub") + "</span></span>" + I("chevron", 18) + "</a></li>";
    };
    return head(t(done ? "em.done.title" : "em.title")) + '<p class="mg-lead">' + t(done ? "em.done.body" : "em.body") + "</p>" +
      (done ? "" : '<ul class="mg-links">' + link(DOCS + "#exchange", "em.exchange") + link(DOCS + "#pool", "em.pool") + link(DOCS + "#special", "em.faq") + "</ul>") +
      '<div class="mg-actions"><button type="button" class="btn btn-block" data-act="switch-wallet">' + I("wallet", 18) + "<span>" + t("em.switch") + "</span></button></div>";
  };
  V.form = function () {
    var Ld = led(), rpc = ui.error === "rpc", ready = lots("releasing");
    if (ui.text == null) ui.text = plain(Ld.oldCT);
    var bal = rpc ? (ui.loading ? '<span class="skel"></span>' : t("f.balance.unknown")) : t("f.balance", { amount: A(Ld.oldCT) });
    var h = head(t("f.title"));
    if (ready.length && !isClosed()) h += note("info", t("f.claimnote", { amount: A(sumL(ready)) }), '<button type="button" class="btn" data-act="to-claim">' + t("f.claimnote.btn") + "</button>");
    h += '<form id="mg-form" novalidate><div class="field">' +
      '<div class="field-label"><label for="mg-amt">' + t("f.label") + '</label><span id="mg-bal" class="num">' + bal + "</span></div>" +
      '<div class="field-box" id="mg-box"><input id="mg-amt" name="amount" type="text" inputmode="decimal" enterkeyhint="go" autocomplete="off" autocorrect="off" spellcheck="false" aria-describedby="mg-msg" value="' + esc(rpc ? "" : ui.text) + '"' + (rpc ? " disabled" : "") + ">" +
      '<span class="field-unit">' + t("unit.old") + "</span>" +
      '<button type="button" class="btn mg-max" data-act="max" aria-label="' + esc(t("f.max.aria")) + '"' + (rpc ? " disabled" : "") + ">" + t("f.max") + "</button></div>" +
      '<div class="field-msg" id="mg-msg" aria-live="polite"></div></div>';
    if (rpc) {
      h += note("error", t("er.rpc"), '<button type="button" class="btn btn-primary" data-act="retry"' + (ui.loading ? " disabled" : "") + ">" + I("refresh", 18) + "<span>" + t("er.rpc.fix") + "</span></button>");
      return h + "</form>";
    }
    h += '<dl class="mg-rows">' +
      splitRows(0, true) +
      row(t("rate.k") + help("help.rate"), num(t("rate.v"))) +
      feeRow(0) +
      "</dl>" +
      '<div id="mg-gas-err"></div>';
    if (Ld.contract.reserveEmpty) h += note("error", withHelp(t("er.reserve"), "help.reserve"), '<a class="btn" href="' + DOCS + '#contact">' + t("er.reserve.fix") + "</a>");
    h += '<div class="mg-actions"><button type="submit" class="btn btn-primary btn-lg btn-block" id="mg-go" data-primary></button></div>' +
      '<p class="mg-hint small muted" id="mg-hint"></p></form>';
    return h;
  };
  V.review = function () {
    return head(t("rv.title"), { back: true }) + '<p class="mg-lead">' + t("rv.body", { amount: A(ui.amount), instant: A(sp(ui.amount).instant), locked: A(sp(ui.amount).locked), days: C.lockDays }) + "</p>" +
      '<div class="mg-trackbox"><div data-track-demo="' + ui.amount + '"></div></div>' +
      '<label class="mg-check mg-check-lg"><input type="checkbox" id="mg-rv-check"> <span>' + t("rv.check") + "</span></label>" +
      '<div class="mg-actions">' + primary(t("rv.cta", { amount: A(ui.amount) }), "review-ok", ' id="mg-rv-go" disabled') + "</div>";
  };
  V.approve = function () {
    return head(t("ap.title"), { back: true }) + steps(1) +
      withHelp(t("ap.why", { amount: A(ui.amount) }), "help.approve", "mg-lead") +
      summary(ui.amount) + gasError(GAS.approve + GAS.swap) +
      '<div class="mg-actions">' + cta(t("ap.cta", { amount: A(ui.amount) }), "approve", gasShort(GAS.approve + GAS.swap) ? " disabled" : "") + "</div>";
  };
  V.swap = function () {
    var res = led().contract.reserveEmpty;
    return head(t("sw.title"), { back: true }) + steps(2) +
      '<p class="mg-lead">' + t("sw.body", { amount: A(ui.amount), instant: A(sp(ui.amount).instant), locked: A(sp(ui.amount).locked), date: F.date(unlockAt()) }) + "</p>" +
      summary(ui.amount) + gasError(GAS.swap) +
      (res ? note("error", withHelp(t("er.reserve"), "help.reserve"), '<a class="btn" href="' + DOCS + '#contact">' + t("er.reserve.fix") + "</a>") : "") +
      '<div class="mg-actions">' + cta(t("sw.cta", { amount: A(ui.amount) }), "swap", res || gasShort(GAS.swap) ? " disabled" : "") + "</div>";
  };
  V.partial = function () {
    var a = led().allowance;
    return head(t("f.title")) + steps(2) +
      note("warn", t("er.partial", { amount: A(a) }),
        '<button type="button" class="btn btn-primary" data-act="resume">' + t("er.partial.fix") + '</button><button type="button" class="btn btn-ghost" data-act="start-over">' + t("er.partial.over") + "</button>");
  };
  V.wallet = function () {
    var w = ui.wait || {}, k = w.kind || "approve";
    var line = t("wa." + k, { amount: A(w.amount || 0), wallet: t("ch." + ui.walletKey) });
    return head(t("wa.title")) +
      '<div class="mg-wait"><span class="spin" aria-hidden="true"></span><p>' + line + "</p></div>" +
      '<p class="small muted">' + t("wa.hint") + "</p>" +
      '<div class="mg-actions"><button type="button" class="btn btn-block" data-act="cancel">' + t("wa.cancel") + "</button></div>";
  };
  V.pending = function () {
    var w = ui.wait || {};
    return head(t("pe.title." + w.kind, { amount: A(w.amount || 0) })) +
      '<div class="mg-wait"><span class="spin" aria-hidden="true"></span><p>' + t("pe.body") + "</p></div>" +
      '<dl class="mg-rows">' + row(t("pe.elapsed"), '<span class="num" data-elapsed></span>') + row(t("pe.tx"), txLink(w.tx, "Kaiascan")) + "</dl>" +
      note("info", t("pe.safe"));
  };
  V.locked = function () {
    var lot = byId(ui.lotId);
    if (!lot) { ui.phase = "form"; return V[computeView()](); }
    return head(t("ok.title"), { badge: "lock" }) +
      '<p class="mg-lead">' + t("ok.body", { instant: A(lot.instant), locked: A(lot.locked), date: F.date(lot.unlockAt) }) + "</p>" +
      '<div class="mg-trackbox"><div data-track="' + lot.id + '" data-large></div>' +
      '<p class="mg-count small" data-count="' + lot.unlockAt + '">' + I("clock", 16) + "<span></span></p></div>" +
      '<p class="small">' + txLink(lot.txSwap, t("h.tx.swap")) + "</p>" +
      '<div class="mg-actions mg-actions-row">' + primary(t("ok.done"), "done") +
      '<button type="button" class="btn btn-ghost btn-lg" data-act="add">' + I("plus", 18) + "<span>" + t("ok.add") + "</span></button></div>";
  };
  V.claim = function () {
    var ready = lots("releasing"), amt = sumL(ready), many = ready.length > 1, Ld = led();
    var h = head(t("cl.title"), { badge: "unlock" }) +
      '<p class="mg-lead">' + (many ? t("cl.body.many", { count: ready.length }) : t("cl.body.one")) + "</p>";
    h += many ? '<dl class="mg-rows">' + ready.map(function (l) { return row(t("track.swapped", { date: F.date(l.swappedAt) }), num(t("h.v", { amount: A(l.locked) }))); }).join("") + "</dl>"
      : '<div class="mg-trackbox"><div data-track="' + ready[0].id + '" data-large></div></div>';
    h += '<dl class="mg-rows">' + feeRow(GAS.claim) + "</dl>";
    h += gasError(GAS.claim);
    h += '<div class="mg-actions">' + cta(t(many ? "cl.cta.all" : "cl.cta", { amount: A(amt) }), "claim", ' data-ids="' + ids(ready) + '"' + (gasShort(GAS.claim) ? " disabled" : ""));
    if (Ld.oldCT > 0 && !isClosed()) h += '<button type="button" class="btn btn-block" data-act="to-swap">' + t("cl.swapmore") + "</button>";
    return h + "</div>";
  };
  V.claimed = function () {
    var got = (ui.claimIds || []).map(byId).filter(function (l) { return l && l.releasedAt; });
    if (!got.length) { ui.phase = "form"; return V[computeView()](); }
    var you = got[0].releasedBy === "you";
    return head(t("cd.title"), { badge: "check" }) +
      '<p class="mg-lead">' + t(you ? "cd.body.you" : "cd.body.keeper", { amount: A(sumL(got)), date: F.date(got[0].releasedAt) }) + "</p>" +
      '<div class="mg-trackbox"><div data-track-claimed data-large></div></div>' +
      '<p class="small">' + txLink(got[0].txRelease, t("h.tx.release")) + "</p>" +
      '<div class="mg-actions mg-actions-row">' + primary(t("cd.done"), "done") +
      '<button type="button" class="btn btn-ghost btn-lg" data-act="add">' + I("plus", 18) + "<span>" + t("ok.add") + "</span></button></div>";
  };
  V.closed = function () {
    var ready = lots("releasing"), amt = sumL(ready);
    var fix = ready.length
      ? '<button type="button" class="btn btn-primary" data-act="claim" data-ids="' + ids(ready) + '">' + t(ready.length > 1 ? "cl.cta.all" : "cl.cta", { amount: A(amt) }) + "</button>"
      : '<button type="button" class="btn" data-act="see-hist">' + t("er.closed.fix") + "</button>";
    return head(t("f.title")) + '<p class="mg-lead muted">' + t("f.balance", { amount: A(led().oldCT) }) + "</p>" +
      note("warn", t("er.closed", { date: F.date(C.windowEnd) }), ui.error === "rejected" || ui.error === "sponsor" ? "" : fix) +
      ((ui.error === "rejected" || ui.error === "sponsor") && ready.length ? cta("", "claim", ' data-ids="' + ids(ready) + '"') : "");
  };

  function gasShort(need) { return !sponsored() && led().wallet.kaia < need; }
  function gasError(need) {
    if (!gasShort(need)) return "";
    var mm = selfPay();
    return note("error", t(mm ? "er.nogas" : "er.nogas.own", { need: gas(need), have: gas(led().wallet.kaia) }),
      (mm ? '<button type="button" class="btn" data-act="switch-wallet">' + t("er.nogas.kaia") + "</button>" : "") +
      '<a class="btn" href="' + DOCS + '#gas">' + t("er.nogas.fix") + "</a>");
  }

  function computeView() {
    var Ld = led(), ph = ui.phase;
    if (ph === "wallet") return "wallet";
    if (ph === "pending") return "pending";
    if (!Ld.wallet.connected) return "disconnected";
    if (Ld.wallet.network !== "kaia") return "wrong-network";
    if (ph === "success") return "locked";
    if (ph === "claimed") return "claimed";
    if (ph === "review" || ph === "approve" || ph === "swap") return ph;
    if (ui.error === "rpc") return "form";
    if (isClosed()) return "closed";
    if (lots("releasing").length && ui.mode !== "swap") return "claim";
    if (Ld.oldCT <= 0) return "empty";
    if (Ld.allowance > 0 && !ui.partialOff) return "partial";
    return "form";
  }

  // ---------- form ----------
  function formState() {
    var bal = led().oldCT, r = CJ.parseAmount(ui.text);
    if (r.empty) return { ok: false };
    if (!r.ok) return { ok: false, msg: t(r.reason) };
    if (r.value > bal + 1e-9) return { ok: false, over: true, msg: t("f.over", { amount: A(bal) }) };
    return { ok: true, value: r.value };
  }
  function updateForm() {
    var box = $("mg-box"), go = $("mg-go"); if (!box || !go) return;
    var s = formState(), Ld = led(), msg = $("mg-msg"), input = $("mg-amt");
    var v = s.ok ? s.value : 0, need = gasNeed(v);
    box.classList.toggle("is-error", !!s.msg);
    input.setAttribute("aria-invalid", s.msg ? "true" : "false");
    msg.className = "field-msg" + (s.msg ? " is-error" : "");
    msg.innerHTML = s.msg ? '<span class="mg-msg-t">' + I("warn", 16) + "<span>" + esc(s.msg) + "</span></span>" + (s.over ? '<button type="button" class="btn mg-fix" data-act="max">' + t("f.usemax") + "</button>" : "") : "";
    var p = sp(v);
    $("mg-now").innerHTML = num(t("f.now.v", { amount: A(p.instant) }));
    $("mg-later").firstChild.innerHTML = t("f.later.v", { amount: A(p.locked) });
    var fr = $("mg-feerow"), nf = feeRow(need);
    if (fr && fr.outerHTML !== nf) { if (!fr.querySelector("details[open]")) fr.outerHTML = nf; }
    var short = gasShort(need);
    $("mg-gas-err").innerHTML = short ? gasError(need) : "";
    go.disabled = !s.ok || short || Ld.contract.reserveEmpty;
    go.textContent = s.ok ? t("f.cta", { amount: A(v) }) : t("f.cta.empty");
    $("mg-hint").textContent = s.ok && Ld.allowance >= v ? t("f.hint.approved") : t("f.hint");
  }
  function submitForm() {
    var s = formState(), Ld = led();
    if (!s.ok || Ld.contract.reserveEmpty || gasShort(gasNeed(s.value))) return;
    ui.amount = s.value; ui.error = null;
    if (ui.amount > BIG && !ui.reviewed) ui.phase = "review";
    else ui.phase = Ld.allowance >= ui.amount ? "swap" : "approve";
    render(true);
  }

  // ---------- flows ----------
  function startWallet(kind, amt, ok) {
    ui.wait = { kind: kind, amount: amt, prev: ui.phase === "wallet" && ui.wait ? ui.wait.prev : ui.phase };
    ui.phase = "wallet"; ui.error = null;
    render(true);
    clearTimeout(timer);
    if (ui.frozen) return;
    timer = setTimeout(function () {
      var rj = $("pr-reject");
      if (rj && rj.checked) {
        rj.checked = false;
        ui.phase = ui.wait.prev; ui.error = "rejected"; ui.errKind = kind; ui.wait = null;
        render(true); return;
      }
      if ((kind === "approve" || kind === "swap" || kind === "claim") && sponsored() && led().contract.sponsorDown) {
        ui.phase = ui.wait.prev; ui.error = "sponsor"; ui.errKind = kind; ui.wait = null;
        if (kind === "claim") ui.mode = null;
        render(true); return;
      }
      ok();
    }, WALLET_MS);
  }
  function chain(done) {
    ui.phase = "pending"; ui.wait.tx = CJ.fakeTx(); ui.wait.started = Date.now();
    render(true);
    clearTimeout(timer);
    timer = setTimeout(function () { var tx = ui.wait.tx; done(tx); }, CHAIN_MS);
  }
  function cancelWallet() {
    if (ui.phase !== "wallet") return;
    clearTimeout(timer);
    ui.phase = ui.wait ? ui.wait.prev : "form"; ui.wait = null; ui.frozen = false;
    render(true);
    CJ.toast(t("toast.cancelled"));
  }
  // Only a self paid transaction costs the wallet KAIA; a fee delegated one is paid by Cojam's fee payer.
  function spendGas(x) { if (sponsored()) return; var Ld = led(); Ld.wallet.kaia = Math.max(0, +(Ld.wallet.kaia - x).toFixed(4)); }
  function doConnect(key) {
    ui.walletKey = key;
    startWallet("connect", 0, function () {
      led().wallet.app = led().wallet.kind = key; L.connect();
      ui.phase = "form"; ui.wait = null; ui.text = null;
      render(true); CJ.toast(t("toast.connected"));
    });
  }
  function doNetwork() {
    startWallet("network", 0, function () { ui.phase = "form"; ui.wait = null; L.setNetwork("kaia"); render(true); });
  }
  function doApprove() {
    var amt = ui.amount;
    startWallet("approve", amt, function () {
      chain(function () {
        spendGas(GAS.approve); L.approve(amt);
        ui.phase = "swap"; ui.wait = null; ui.partialOff = true;
        render(true); CJ.toast(t("toast.approved", { amount: A(amt) }));
      });
    });
  }
  function doSwap() {
    var amt = ui.amount;
    startWallet("swap", amt, function () {
      chain(function (tx) {
        spendGas(GAS.swap);
        var lot = L.swap(amt); lot.txSwap = tx; L.save();
        ui.lotId = lot.id; ui.phase = "success"; ui.wait = null; ui.text = null; ui.reviewed = false; ui.mode = null;
        render(true); CJ.toast(t("toast.swapped", { amount: A(lot.instant) }));
      });
    });
  }
  function doClaim(idList) {
    var list = idList.map(byId).filter(function (l) { return l && L.lotStatus(l) === "releasing"; });
    if (!list.length) return;
    var amt = sumL(list);
    ui.claimIds = list.map(function (l) { return l.id; });
    startWallet("claim", amt, function () {
      chain(function (tx) {
        // A lot the keeper released while the wallet was open is simply skipped: it is already in the wallet.
        ui.claimIds.forEach(function (id) { var lot = L.claim(id); if (lot) lot.txRelease = tx; });
        spendGas(GAS.claim); // one transaction for the whole batch
        ui.phase = "claimed"; ui.wait = null; ui.mode = null;
        L.save(); render(true); CJ.toast(t("toast.claimed", { amount: A(amt) }));
      });
    });
  }
  function done() { ui.phase = "form"; ui.text = null; ui.mode = null; ui.error = null; ui.reviewed = false; ui.frozen = false; ui.payOwn = false; render(true); }
  function back() {
    var p = ui.phase;
    if (p === "wallet") return cancelWallet();
    if (p === "review" || p === "approve" || p === "swap") { ui.phase = "form"; ui.error = null; ui.reviewed = false; if (p === "swap") ui.partialOff = true; return render(true); }
    if (p === "success" || p === "claimed") return done();
    if (ui.view === "form" && ui.mode === "swap" && lots("releasing").length) { ui.mode = null; render(true); }
  }

  // ---------- render ----------
  function render(focus) {
    var active = document.activeElement, typing = active && active.id === "mg-amt";
    var sel = typing ? [active.selectionStart, active.selectionEnd] : null;
    var v = computeView(); ui.view = v;
    panel.innerHTML = '<div class="mg-view' + (v !== lastView ? " is-enter" : "") + '" data-view="' + v + '">' + V[ui.view = computeView()]() + "</div>";
    lastView = v;
    panel.querySelectorAll("[data-track]").forEach(function (el) { var lot = byId(el.getAttribute("data-track")); if (lot) CJ.track(el, lot, { large: el.hasAttribute("data-large") }); });
    panel.querySelectorAll("[data-track-demo]").forEach(function (el) { CJ.track(el, null, { large: true, amount: +el.getAttribute("data-track-demo") }); });
    var ct = panel.querySelector("[data-track-claimed]");
    if (ct) {
      var got = (ui.claimIds || []).map(byId).filter(Boolean);
      CJ.track(ct, {
        amount: sum(got), instant: got.reduce(function (a, l) { return a + l.instant; }, 0), locked: sumL(got),
        swappedAt: Math.min.apply(null, got.map(function (l) { return l.swappedAt; })),
        unlockAt: Math.max.apply(null, got.map(function (l) { return l.unlockAt; })), releasedAt: got[0].releasedAt, releasedBy: got[0].releasedBy
      }, { large: true });
    }
    CJ.renderAddrs(panel);
    stickyBar();
    updateForm();
    renderHist();
    paintWindow();
    tick();
    if (typing && $("mg-amt")) { var i = $("mg-amt"); i.focus(); try { i.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    else if (focus) { var h = $("mg-h"); if (h) h.focus(); }
    announce();
  }
  // Mobile: the single primary action sticks to the bottom of the screen while its view is in view (CSS, under 600 px),
  // and gets a top rule only while it is actually stuck. Views with two actions or an error note in place keep it inline.
  var stuckIO = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var bar = e.target.previousElementSibling;
      if (bar) bar.classList.toggle("is-stuck", !e.isIntersecting && e.boundingClientRect.top > (window.innerHeight || 0) - 1);
    });
  }) : null;
  function stickyBar() {
    if (stuckIO) stuckIO.disconnect();
    panel.querySelectorAll(".mg-actions").forEach(function (a) {
      if (a.classList.contains("mg-actions-row") || !a.querySelector(":scope > .btn-primary.btn-lg")) return;
      a.classList.add("mg-sticky");
      var s = document.createElement("div"); s.className = "mg-sticky-end"; s.setAttribute("aria-hidden", "true");
      a.after(s); if (stuckIO) stuckIO.observe(s);
    });
  }
  // Amount field on a phone: keep it in view above the keyboard, and let the sticky bar step aside while typing.
  var coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  function keepFieldInView() {
    var box = $("mg-box"); if (!box || document.activeElement !== $("mg-amt")) return;
    var vv = window.visualViewport, r = box.getBoundingClientRect(), top = vv ? vv.offsetTop : 0, h = vv ? vv.height : window.innerHeight;
    if (r.top < top + 72 || r.bottom > top + h - 16) window.scrollBy({ top: r.top - top - Math.max(72, (h - r.height) / 3), behavior: "smooth" });
  }
  panel.addEventListener("focusin", function (e) {
    if (e.target.id !== "mg-amt") return;
    panel.classList.add("is-typing");
    if (coarse) setTimeout(keepFieldInView, 320);
  });
  panel.addEventListener("focusout", function (e) { if (e.target.id === "mg-amt") panel.classList.remove("is-typing"); });
  if (window.visualViewport) visualViewport.addEventListener("resize", function () { if (coarse) keepFieldInView(); });

  function announce() {
    var h = $("mg-h"), n = panel.querySelector(".note-error .note-body > p, .note-warn .note-body > p, .note-error .mg-hh > span");
    var s = (h ? h.textContent : "") + (n ? ". " + n.textContent : "");
    if (s && s !== lastLive) { lastLive = s; live.textContent = s; }
  }
  function paintWindow() {
    var w = $("mg-window");
    w.innerHTML = I(isClosed() ? "warn" : "clock", 16) + "<span>" + (isClosed() ? t("win.closed", { date: F.date(C.windowEnd) }) : t("win.open", { date: F.date(C.windowEnd), rel: F.rel(C.windowEnd) })) + "</span>";
    w.classList.toggle("is-closed", isClosed());
  }
  function example() {
    return '<div class="mg-example"><span class="tag">' + t("h.example") + '</span><div id="mg-ex-track"></div></div>';
  }
  function renderHist() {
    var Ld = led(), all = Ld.lots, busy = ui.phase === "wallet" || ui.phase === "pending";
    var pendingSwap = ui.phase === "pending" && ui.wait && ui.wait.kind === "swap";
    var h = '<div class="mg-hist-head"><h2 id="mg-hist-h" tabindex="-1">' + t("h.title") + "</h2>";
    if (Ld.wallet.connected && all.length) h += '<span class="small muted">' + (all.length === 1 ? t("h.count.one") : t("h.count", { n: all.length })) + "</span>";
    h += "</div>";
    if (!Ld.wallet.connected) {
      hist.innerHTML = h + '<p class="small muted mg-hist-lead">' + t("h.dc") + "</p>" + example();
    } else {
      if (all.length) {
        var tot = L.totals(), cells = [["h.wallet", Ld.newCT], ["h.locked", tot.locked], ["h.releasing", tot.releasing], ["h.released", tot.released]];
        h += '<dl class="mg-totals">' +
          cells.map(function (c) { return '<div><dt>' + t(c[0]) + "</dt><dd>" + num(t("h.v", { amount: A(c[1]) })) + "</dd></div>"; }).join("") + "</dl>";
      }
      if (!all.length && !pendingSwap) {
        h += '<p class="small muted mg-hist-lead">' + t("h.empty") + "</p>" + example();
      } else {
        h += '<ul class="mg-lots">';
        if (pendingSwap) {
          h += '<li class="mg-lot mg-lot-pending"><div class="mg-lot-top"><span class="tag"><span class="spin mg-spin-sm" aria-hidden="true"></span>' + t("h.pending") + "</span></div>" +
            '<p class="small muted">' + t("h.pending.sub", { amount: A(ui.wait.amount) }) + "</p></li>";
        }
        all.forEach(function (lot) {
          var st = L.lotStatus(lot);
          var tag = st === "locked" ? '<span class="tag">' + I("lock", 14) + t("tag.locked", { date: F.date(lot.unlockAt) }) + "</span>"
            : st === "releasing" ? '<span class="tag tag-sky">' + I("unlock", 14) + t("tag.releasing") + "</span>"
            : '<span class="tag">' + I("check", 14) + t(lot.releasedBy === "you" ? "tag.you" : "tag.keeper") + "</span>";
          h += '<li class="mg-lot" data-status="' + st + '"><div class="mg-lot-top">' + tag +
            (st === "released" && lot.txRelease ? txLink(lot.txRelease, t("h.tx.release")) : txLink(lot.txSwap, t("h.tx.swap"))) + "</div>" +
            '<div data-hist-track="' + lot.id + '"></div>' +
            (st === "releasing" && !busy ? '<div class="mg-lot-act"><button type="button" class="btn" data-act="claim" data-ids="' + lot.id + '">' + t("h.claim", { amount: A(lot.locked) }) + "</button></div>" : "") +
            "</li>";
        });
        h += "</ul>";
      }
      hist.innerHTML = h;
    }
    hist.querySelectorAll("[data-hist-track]").forEach(function (el) { CJ.track(el, byId(el.getAttribute("data-hist-track"))); });
    var ex = $("mg-ex-track"); if (ex) CJ.track(ex, null, { amount: 10000, demoDays: 3.4 });
  }
  function tick() {
    panel.querySelectorAll("[data-elapsed]").forEach(function (el) { if (ui.wait && ui.wait.started) el.textContent = dur(Date.now() - ui.wait.started); });
    panel.querySelectorAll("[data-count]").forEach(function (el) {
      var u = +el.getAttribute("data-count");
      el.lastChild.textContent = t("ok.left", { time: dur(u - CJ.now()) });
    });
  }
  setInterval(tick, 1000);
  setInterval(function () { if (document.activeElement && document.activeElement.id === "mg-amt") return; if (ui.phase === "form") render(false); else renderHist(); }, 60000);

  // ---------- events ----------
  function onAct(e) {
    var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    var a = b.getAttribute("data-act"), idList = (b.getAttribute("data-ids") || "").split(",").filter(Boolean);
    ui.frozen = false;
    if (b.hasAttribute("data-retry")) led().contract.sponsorDown = false; // mock: the fee payer answers on retry
    switch (a) {
      case "pay-own": ui.payOwn = true; ui.error = null; render(true); break;
      case "connect": ui.error = null; openChooser(b); break;
      case "network": doNetwork(); break;
      case "max": ui.text = plain(led().oldCT); var i = $("mg-amt"); if (i) { i.value = ui.text; updateForm(); i.focus(); } break;
      case "back": back(); break;
      case "review-ok": ui.reviewed = true; ui.phase = led().allowance >= ui.amount ? "swap" : "approve"; render(true); break;
      case "approve": doApprove(); break;
      case "swap": doSwap(); break;
      case "cancel": cancelWallet(); break;
      case "done": done(); break;
      case "add": CJ.toast(t("ok.add.toast")); break;
      case "claim": ui.error = null; doClaim(idList); break;
      case "to-swap": ui.mode = "swap"; ui.text = null; render(true); break;
      case "to-claim": ui.mode = null; render(true); break;
      case "retry":
        ui.loading = true; render(false);
        setTimeout(function () { ui.loading = false; ui.error = null; ui.text = null; render(true); }, 1000); break;
      case "resume": ui.amount = led().allowance; ui.partialOff = true; ui.phase = "swap"; render(true); break;
      case "start-over": ui.partialOff = true; render(true); break;
      case "switch-wallet": L.disconnect(); ui = Object.assign(freshUi(), { walletKey: ui.walletKey }); render(false); openChooser(b, true); break;
      case "see-hist": $("mg-hist-h").focus(); break;
    }
  }
  panel.addEventListener("click", onAct);
  hist.addEventListener("click", onAct);
  panel.addEventListener("submit", function (e) { e.preventDefault(); submitForm(); });
  panel.addEventListener("input", function (e) {
    if (e.target.id === "mg-amt") { ui.text = e.target.value; updateForm(); }
    if (e.target.id === "mg-rv-check") $("mg-rv-go").disabled = !e.target.checked;
  });
  panel.addEventListener("change", function (e) { if (e.target.id === "mg-rv-check") $("mg-rv-go").disabled = !e.target.checked; });

  // Wallet chooser: CJ.wallet (assets/wallet.js) picks by environment. In a wallet's own browser it connects in one
  // tap; in a mobile browser it offers "Open in Kaia Wallet", "Open in MetaMask" and WalletConnect; on desktop the
  // detected extensions, install links and a WalletConnect code. force: show the sheet even in a wallet browser.
  function openChooser(from, force) { closeMenu(); CJ.wallet.open({ from: from, force: force, onPick: doConnect }); }

  // shortcut sheet
  var opener = null;
  function paintSheets() { document.querySelectorAll(".mg-sheet [data-close]").forEach(function (b) { b.innerHTML = I("x", 20); }); }
  function openSheet(d, from) { opener = from || document.activeElement; if (!d.open) d.showModal(); }
  kbd.addEventListener("click", function (e) { if (e.target === kbd || e.target.closest("[data-close]")) kbd.close(); });
  kbd.addEventListener("close", function () { if (opener && document.contains(opener)) opener.focus(); });
  $("mg-kbd-open").addEventListener("click", function (e) { openSheet(kbd, e.currentTarget); });

  // header wallet button: chooser when disconnected, small menu when connected
  function paintMenu() {
    var Ld = led();
    menu.innerHTML = '<p class="mg-menu-app small muted">' + t("menu.app", { wallet: walletName() }) + "</p>" +
      '<p class="mg-menu-addr">' + Ld.wallet.address + "</p>" +
      '<button type="button" role="menuitem" class="btn btn-ghost mg-menu-item" data-m="copy">' + I("copy", 18) + "<span>" + t("menu.copy") + "</span></button>" +
      '<button type="button" role="menuitem" class="btn btn-ghost mg-menu-item" data-m="disconnect">' + I("x", 18) + "<span>" + t("menu.disconnect") + "</span></button>";
  }
  function openMenu() {
    paintMenu();
    var r = wbtn.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 8) + "px";
    menu.style.right = Math.max(16, Math.round(document.documentElement.clientWidth - r.right)) + "px";
    menu.hidden = false; wbtn.setAttribute("aria-expanded", "true");
    menu.querySelector("button").focus();
  }
  function closeMenu(refocus) {
    if (menu.hidden) return;
    menu.hidden = true; if (wbtn) wbtn.setAttribute("aria-expanded", "false");
    if (refocus && wbtn) wbtn.focus();
  }
  if (wbtn) {
    wbtn.setAttribute("aria-haspopup", "true"); wbtn.setAttribute("aria-expanded", "false"); wbtn.setAttribute("aria-controls", "mg-menu");
    wbtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!led().wallet.connected) openChooser(wbtn); else if (menu.hidden) openMenu(); else closeMenu(true);
    });
  }
  menu.setAttribute("aria-label", t("menu.label"));
  menu.addEventListener("click", function (e) {
    var b = e.target.closest("[data-m]"); if (!b) return;
    if (b.getAttribute("data-m") === "copy") { CJ.copy(led().wallet.address); closeMenu(true); return; }
    closeMenu(true);
    clearTimeout(timer);
    var keep = ui.walletKey;
    L.disconnect(); ui = Object.assign(freshUi(), { walletKey: keep }); render(false);
    CJ.toast(t("toast.disconnected"), { label: t("toast.undo"), run: function () { L.connect(); render(false); } });
  });
  menu.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    var items = [].slice.call(menu.querySelectorAll("[role=menuitem]")), i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); e.preventDefault();
  });
  document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
  window.addEventListener("scroll", function () { closeMenu(); }, { passive: true });

  // keyboard: Esc back or cancel, Enter submits, ? lists shortcuts
  window.addEventListener("keydown", function (e) {
    if (document.querySelector("dialog[open]")) return;
    var tag = (e.target.tagName || "").toLowerCase(), typing = tag === "input" || tag === "textarea" || tag === "select";
    if (e.key === "Escape") {
      if (!menu.hidden) { closeMenu(true); return; }
      if (document.querySelector("details[open]")) return; // the shared handler closes help popovers first
      back(); return;
    }
    if (e.key === "?" && !typing) { e.preventDefault(); openSheet(kbd); return; }
    if (e.key === "Enter" && !typing && (e.target === document.body || e.target.id === "mg-h" || e.target === panel)) {
      var p = panel.querySelector(".btn-primary:not([disabled])");
      if (p) { e.preventDefault(); p.click(); }
    }
  }, true);

  // prototype controls (hidden in ?state captures)
  var proto = $("mg-proto");
  if (!CJ.state) proto.hidden = false;
  proto.addEventListener("click", function (e) {
    var b = e.target.closest("[data-proto]"); if (!b) return;
    var Ld = led(), k = b.getAttribute("data-proto");
    if (k === "rpc") { ui.error = "rpc"; ui.phase = "form"; render(true); }
    if (k === "gas") { Ld.wallet.kaia = 0.001; L.save(); }
    if (k === "reserve") { Ld.contract.reserveEmpty = !Ld.contract.reserveEmpty; L.save(); }
    if (k === "closed") { ui.closed = !ui.closed; render(true); }
    if (k === "network") { L.setNetwork("ethereum"); }
    if (k === "sponsor") { Ld.contract.sponsorDown = !Ld.contract.sponsorDown; L.save(); }
    if (k === "reset") { clearTimeout(timer); L.reset(); ui = freshUi(); render(true); }
  });

  document.addEventListener("cj:ledger", function () { render(false); });
  document.addEventListener("cj:lang", function () { paintSheets(); menu.setAttribute("aria-label", t("menu.label")); if (!menu.hidden) paintMenu(); lastLive = ""; render(false); });

  // ---------- ?state= presets for captures and review ----------
  function setState(name) {
    if (name === "claimable") name = "releasing"; // older capture names
    if (name === "claimed") name = "released";
    L.reset();
    var Ld = L.get(), n = CJ.now(), seq = 0;
    // rel: {by: "you" | "keeper", daysAgo}. Without it, the mock keeper releases the lot lazily once it is due.
    function mk(amount, daysAgo, rel) {
      var s = n - daysAgo * DAY, p = CJ.split(amount);
      return { id: "S" + (seq++) + Math.round(s).toString(36), amount: amount, instant: p.instant, locked: p.locked, swappedAt: s, unlockAt: s + C.lockDays * DAY,
        releasedAt: rel ? n - rel.daysAgo * DAY : null, releasedBy: rel ? rel.by : null, txSwap: CJ.fakeTx(), txRelease: rel ? CJ.fakeTx() : null };
    }
    function credit() { Ld.newCT = Ld.lots.reduce(function (a, l) { return a + l.instant + (l.releasedAt ? l.locked : 0); }, 0); }
    ui = freshUi(); ui.frozen = true;
    // With ?env=inapp-metamask the presets use that wallet; otherwise Kaia Wallet.
    Ld.wallet.connected = name !== "disconnected"; Ld.wallet.app = Ld.wallet.kind = CJ.wallet.env().kind || "kaia";
    switch (name) {
      case "wrong-network": Ld.wallet.network = "ethereum"; break;
      case "empty": Ld.oldCT = 0; break;
      case "review": Ld.oldCT = 2500000; ui.amount = 2500000; ui.text = "2,500,000"; ui.phase = "review"; break;
      case "approve": ui.amount = 125000; ui.phase = "approve"; break;
      case "wallet": ui.amount = 125000; ui.phase = "wallet"; ui.wait = { kind: "approve", amount: 125000, prev: "approve" }; break;
      case "pending": ui.amount = 125000; Ld.allowance = 125000; ui.phase = "pending"; ui.wait = { kind: "swap", amount: 125000, prev: "swap", tx: CJ.fakeTx(), started: Date.now() - 12000 }; break;
      case "locked": Ld.oldCT = 0; var lk = mk(125000, 0); Ld.lots = [lk]; ui.lotId = lk.id; ui.phase = "success"; break;
      // unlocked a few minutes ago, the keeper has not sent them yet
      case "releasing": Ld.oldCT = 0; Ld.lots = [mk(25000, 2), mk(20000, 7.006), mk(80000, 7.012)]; break;
      case "released": Ld.oldCT = 0; var cd = mk(125000, 9, { by: "keeper", daysAgo: 1.98 }); Ld.lots = [cd]; ui.claimIds = [cd.id]; ui.phase = "claimed"; break;
      case "rejected": ui.amount = 125000; ui.phase = "approve"; ui.error = "rejected"; ui.errKind = "approve"; break;
      case "no-gas": Ld.wallet.app = Ld.wallet.kind = "mm"; Ld.wallet.kaia = 0.001; break;
      case "sponsor": ui.amount = 125000; ui.phase = "approve"; ui.error = "sponsor"; Ld.contract.sponsorDown = true; break;
      case "closed": ui.closed = true; Ld.oldCT = 25000; Ld.lots = [mk(100000, 7.01)]; break;
      case "reserve": Ld.contract.reserveEmpty = true; break;
      case "rpc": ui.error = "rpc"; break;
      case "partial": Ld.allowance = 125000; break;
      case "history": Ld.oldCT = 40000; Ld.lots = [mk(15000, 1), mk(30000, 4), mk(20000, 7.008), mk(10000, 10, { by: "you", daysAgo: 2.9 }), mk(20000, 15)]; ui.mode = "swap"; break;
    }
    credit();
    L.save();
  }
  var STATES = ["disconnected", "wrong-network", "empty", "ready", "review", "approve", "wallet", "pending", "locked", "releasing", "released", "claimable", "claimed",
    "rejected", "no-gas", "sponsor", "closed", "reserve", "rpc", "partial", "history"];
  window.CJMigrate = { states: STATES, setState: function (s) { setState(s); render(false); }, ui: function () { return ui; } };

  paintSheets();
  if (CJ.state && STATES.indexOf(CJ.state) > -1) setState(CJ.state);
  render(false);
})();
