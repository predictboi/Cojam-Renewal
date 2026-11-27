/* Convert points to CT: one field, what you get, the rules, one action. */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state, fmt = A.fmt, u = M.user;
  var pts = st === "short" ? 650 : u.points, wait = st === "wait", hold = st === "hold", capLeft = 50;
  var top = "";
  if (st === "short") top = '<p class="note note-y"><b>' + t("c.short.h") + "</b>" + t("c.short.b", { p: fmt(pts), g: fmt(1000 - pts) }) + "</p>";
  if (wait) top = '<p class="note note-y"><b>' + t("c.wait.h", { date: A.date(u.firstConvert) }) + "</b>" + t("c.wait.b", { date: A.date(u.firstConvert) }) + " " + t("c.wait.left", { d: 3, h: 9 }) + "</p>";
  if (hold) top = '<p class="note note-k"><b>' + t("hold.t") + "</b>" + t("hold.convert") + "</p>";
  if (st === "paused") top = '<p class="note note-k">' + t("c.paused") + "</p>";
  var blocked = !!top;
  var body = (top ? '<div class="pad" style="padding-top:16px">' + top + "</div>" : "") +
    '<section class="sec is-bare" style="padding-top:18px;padding-bottom:6px"><label class="field" id="f"><span class="field-l"><span>' + t("c.amount") + "</span><span>" + t("c.avail") + " <b>" + fmt(pts) + 'P</b></span></span>' +
      '<span class="field-box"><input id="p" inputmode="numeric" autocomplete="off" value="' + (st === "ok" || blocked ? "" : pts >= 1000 ? 1000 : "") + '" aria-describedby="msg"' + (blocked ? " disabled" : "") + '><span class="unit">P</span><button type="button" class="field-act" id="max"' + (blocked ? " disabled" : "") + ">" + t("s.max") + '</button></span><p class="field-msg" id="msg" role="status"></p></label>' +
      '<div class="get"><span class="fig-l" style="margin:0">' + t("c.get") + '</span><span class="fig-v is-hero"><span id="get">0</span><small>CT</small></span></div></section>' +
    '<section class="sec"><dl><div class="kv"><dt>' + t("c.rate") + '</dt><dd>1,000P = 1 CT</dd></div><div class="kv"><dt>' + t("c.minimum") + '</dt><dd>1,000P</dd></div><div class="kv"><dt>' + t("c.capleft") + "</dt><dd>" + t("c.capof", { n: capLeft }) + '</dd></div><div class="kv"><dt>' + t("c.fee") + "</dt><dd>" + t("c.fee.v") + "</dd></div></dl>" +
      (st === "ok" ? '<p class="note note-y" style="margin-top:10px"><b>' + t("c.ok.h", { p: "1,000", n: 1 }) + "</b>" + t("c.ok.left") + ": " + fmt(pts - 1000) + "P. " + t("c.ok.ct") + ": " + fmt(u.ct + 1) + " CT.</p>" : "") + "</section>";
  var pin = '<button type="button" class="btn btn-p" id="go"><span></span>' + A.ICON.go + '</button><p class="sub">' + t("c.rank") + "</p>";
  A.shell({ back: "wallet.html", title: t("c.title"), body: body, pin: pin });
  var $ = function (i) { return document.getElementById(i); }, inp = $("p"), last = 0;
  function paint() {
    var raw = inp.value.replace(/,/g, "").trim(), a = Number(raw), err = "", fix = null;
    if (raw !== "" && !isNaN(a)) {
      if (a > pts) { err = t("c.e.bal", { p: fmt(pts) }); fix = Math.floor(pts / 1000) * 1000; }
      else if (a < 1000) err = t("c.e.min");
      else if (a % 1000) { fix = Math.floor(a / 1000) * 1000; err = t("c.e.step", { f: fmt(fix) }); }
    }
    var ok = !blocked && raw !== "" && !isNaN(a) && !err, ct = ok ? a / 1000 : 0;
    $("f").classList.toggle("is-err", !!err);
    $("msg").innerHTML = err ? esc(err) + (fix ? ' <button type="button" class="lnk" data-fix="' + fix + '">' + t("c.fix", { f: fmt(fix) }) + "</button>" : "") : t("c.step");
    if (ct !== last) { A.roll($("get"), ct, 0, last, 320); last = ct; }
    var go = $("go"); go.disabled = !ok; go.querySelector("span").textContent = hold ? t("hold.convert.btn") : ok ? t("c.btn", { p: fmt(a), n: ct }) : t("c.btn.empty");
  }
  inp.addEventListener("input", paint);
  document.addEventListener("click", function (e) {
    var f = e.target.closest("[data-fix]"); if (f) { inp.value = f.getAttribute("data-fix"); paint(); return; }
    if (e.target.closest("#max")) { inp.value = Math.min(Math.floor(pts / 1000) * 1000, capLeft * 1000); paint(); return; }
    if (e.target.closest("#go")) { var a = Number(inp.value); A.toast(t("c.ok.h", { p: fmt(a), n: a / 1000 })); }
  });
  paint();
})();
