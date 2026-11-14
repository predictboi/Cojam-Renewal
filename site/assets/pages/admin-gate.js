// Admin gate and reserve withdraw. The page stays hidden until the master wallet connects AND signs a sign in message
// (checked against CJ.net.master). The sign in lasts for this browser tab. Everything the page shows is public chain
// data; what this protects is the view. The withdraw itself is protected by the contract: only MASTER can call it.
(function () {
  var CJ = window.CJ, t = CJ.t, F = CJ.fmt, I = CJ.icon, net = CJ.net;
  var E = window.ethers, KEY = "cj.adminOk";
  var body = document.body, gate = document.getElementById("adm-gate"), wd = document.getElementById("adm-wd");
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ok() { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } }
  function setOk(a) { try { if (a) sessionStorage.setItem(KEY, a.toLowerCase()); else sessionStorage.removeItem(KEY); } catch (e) {} }
  var busy = false, msg = "", msgKind = "";

  function signedIn() {
    var st = CJ.chain && CJ.chain.state();
    return !!(st && st.address && CJ.chain.isMaster(st.address) && ok() === st.address.toLowerCase());
  }
  function lock(on) {
    body.classList.toggle("adm-locked", on);
    gate.hidden = !on; wd.hidden = on;
    if (!on) paintWithdraw();
    paintGate();
  }
  function paintGate() {
    var st = CJ.chain ? CJ.chain.state() : {}, a = st.address;
    var wrong = a && !CJ.chain.isMaster(a);
    var action = !a ? '<button type="button" class="btn btn-primary btn-lg" data-g="connect">' + I("wallet", 18) + "<span>" + t("gate.cta") + "</span></button>"
      : wrong ? '<button type="button" class="btn btn-lg" data-g="switch">' + t("gate.switch") + "</button>"
      : '<button type="button" class="btn btn-primary btn-lg" data-g="sign"' + (busy ? " disabled" : "") + ">" + t(busy ? "gate.signing" : "gate.sign") + "</button>";
    gate.innerHTML = '<h2 class="adm-gate-h">' + I("lock", 22) + "<span>" + t("gate.title") + "</span></h2>" +
      '<p class="muted">' + t("gate.body") + "</p>" +
      (wrong ? '<p class="note note-error adm-gate-msg">' + t("gate.notmaster", { addr: esc(a) }) + "</p>" : "") +
      (msg ? '<p class="note note-' + msgKind + ' adm-gate-msg">' + esc(msg) + "</p>" : "") +
      '<div class="adm-gate-act">' + action + "</div>" +
      '<p class="small muted">' + t("gate.note") + "</p>";
  }
  function connect() {
    CJ.wallet.open({ from: gate.querySelector("[data-g]"), force: true, onPick: function (kind) {
      msg = ""; CJ.chain.connect(kind).then(function () { paintGate(); if (CJ.chain.isMaster(CJ.chain.state().address)) sign(); },
        function (e) { msg = t(CJ.chain.classify(e) === "rejected" ? "gate.rejected" : "gate.failed"); msgKind = "error"; paintGate(); });
    } });
  }
  function sign() {
    if (busy) return; busy = true; msg = ""; paintGate();
    CJ.chain.signIn().then(function (r) { busy = false; setOk(r.address); lock(false); },
      function (e) { busy = false; msg = t(CJ.chain.classify(e) === "rejected" ? "gate.rejected" : "gate.failed"); msgKind = "error"; paintGate(); });
  }
  gate.addEventListener("click", function (e) {
    var b = e.target.closest("[data-g]"); if (!b) return;
    var g = b.getAttribute("data-g");
    if (g === "connect") connect();
    if (g === "sign") sign();
    if (g === "switch") { CJ.chain.disconnect(); setOk(null); connect(); }
  });

  // ---------- withdraw ----------
  var info = null, wdBusy = false, wdMsg = "", wdKind = "", lastTx = null;
  function fmtWei(v) { return F.amount(Number(E.formatUnits(v, 18)), 6); }
  function load() { return CJ.chain.adminInfo().then(function (r) { info = r; paintWithdraw(); }, function () { info = null; paintWithdraw(); }); }
  function paintWithdraw() {
    var a = CJ.chain.state().address || "";
    var row = function (k, v, strong) { return '<div class="adm-wd-row"><dt>' + k + '</dt><dd class="num' + (strong ? " adm-wd-big" : "") + '">' + v + "</dd></div>"; };
    var input = $("adm-wd-amt"), keep = input ? input.value : "";
    wd.innerHTML = '<div class="adm-wd-head"><h2>' + t("wd.title") + '</h2><button type="button" class="btn btn-ghost btn-sm" data-w="logout">' + t("gate.logout") + "</button></div>" +
      '<p class="muted small">' + t("wd.body", { addr: esc(net.master) }) + "</p>" +
      '<dl class="adm-wd-rows">' +
        row(t("wd.avail"), info ? fmtWei(info.available) + " " + t("unit.new") : "–", true) +
        row(t("wd.owed"), info ? fmtWei(info.owed) + " " + t("unit.new") : "–") +
        row(t("wd.held"), info ? fmtWei(info.held) + " " + t("unit.new") : "–") +
        row(t("wd.oldheld"), info ? fmtWei(info.oldHeld) + " " + t("unit.old") : "–") +
      "</dl>" +
      '<div class="field"><div class="field-label"><label for="adm-wd-amt">' + t("wd.amount") + '</label></div>' +
      '<div class="field-box"><input id="adm-wd-amt" type="text" inputmode="decimal" autocomplete="off" value="' + esc(keep) + '"' + (wdBusy ? " disabled" : "") + '><span class="field-unit">' + t("unit.new") + "</span>" +
      '<button type="button" class="btn mg-max" data-w="max"' + (wdBusy || !info ? " disabled" : "") + ">" + t("wd.max") + "</button></div></div>" +
      (wdMsg ? '<p class="note note-' + wdKind + '">' + wdMsg + "</p>" : "") +
      '<div class="adm-wd-act"><button type="button" class="btn btn-primary btn-lg btn-block" data-w="go" id="adm-wd-go"' + (wdBusy ? " disabled" : "") + ">" + t(wdBusy ? "wd.pending" : "wd.cta") + "</button></div>";
  }
  function amountWei() {
    var v = ($("adm-wd-amt") || {}).value || "";
    var r = CJ.parseAmount(v); if (!r.ok) return null;
    try { return E.parseUnits(String(v).replace(/[^\d.]/g, ""), 18); } catch (e) { return null; }
  }
  wd.addEventListener("click", function (e) {
    var b = e.target.closest("[data-w]"); if (!b || b.disabled) return;
    var w = b.getAttribute("data-w");
    if (w === "logout") { setOk(null); CJ.chain.disconnect(); lock(true); return; }
    if (w === "max" && info) { $("adm-wd-amt").value = E.formatUnits(info.available, 18); return; }
    if (w === "go") {
      var amt = amountWei();
      if (!amt || amt <= 0n) { wdMsg = t("wd.err.amount"); wdKind = "error"; paintWithdraw(); return; }
      if (info && amt > info.available) { wdMsg = t("wd.err.over", { amount: fmtWei(info.available) }); wdKind = "error"; paintWithdraw(); return; }
      if (!window.confirm(t("wd.confirm", { amount: fmtWei(amt), addr: net.master }))) return;
      wdBusy = true; wdMsg = ""; paintWithdraw();
      CJ.chain.write("withdraw", { amount: amt }, { sponsored: false, onHash: function (h) { lastTx = h; } }).then(function (rc) {
        wdBusy = false; var h = (rc && (rc.hash || rc.transactionHash)) || lastTx;
        wdMsg = t("wd.done", { amount: fmtWei(amt) }) + (h ? ' <a href="' + net.explorer + "/tx/" + h + '" target="_blank" rel="noopener">' + t("wd.tx") + "</a>" : "");
        wdKind = "info"; $("adm-wd-amt").value = ""; load();
      }, function (er) {
        wdBusy = false; var k = CJ.chain.classify(er);
        wdMsg = k === "network" ? t("wd.err.network") : k === "rejected" ? t("wd.err.rejected") : t("wd.err.failed", { why: esc(er && (er.revert || er.code || er.message) || "") });
        wdKind = "error"; paintWithdraw();
        if (k === "network") CJ.chain.switchNetwork().catch(function () {});
      });
    }
  });

  // ---------- start ----------
  lock(true);
  document.addEventListener("cj:lang", function () { paintGate(); if (!wd.hidden) paintWithdraw(); });
  document.addEventListener("cj:master", function () { if (!signedIn()) { if (!body.classList.contains("adm-locked")) lock(true); else paintGate(); } });
  CJ.chain.restore().then(function () { if (signedIn()) { lock(false); load(); } else paintGate(); });
  setInterval(function () { if (!wd.hidden && !wdBusy) load(); }, 30000);
  wd.hidden || load();
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !wd.hidden) load(); });
  // first load after unlock
  var mo = new MutationObserver(function () { if (!wd.hidden && !info) load(); }); mo.observe(wd, { attributes: true, attributeFilter: ["hidden"] });
})();
