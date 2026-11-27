/* First run: three posters, one idea each. ?step=1|2|3, ?state=code shows the invite code field. */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state;
  var step = Math.min(3, Math.max(1, +A.qs.get("step") || 1));
  var art = [
    '<div class="ob-art f-y"><div class="mini"><div class="mini-row">' + A.pick("l", t("no")) + A.pick("r", t("yes")) + '</div></div><div class="card-art" aria-hidden="true" style="width:46cqw;height:46cqw"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg></div><div class="card-num" aria-hidden="true">5</div></div>',
    '<div class="ob-art f-k on-k"><div class="mini"><span class="chip chip-y" style="min-height:34px;font-size:var(--t-body)">+50P ' + t("o.2.c") + '</span></div><div class="card-num" aria-hidden="true" style="color:var(--yellow);font-size:66cqh">100</div></div>',
    '<div class="ob-art f-w"><div class="mini"><span class="chip chip-k" style="min-height:34px;font-size:var(--t-body)">1,000P = 1 CT</span></div><div class="card-art" aria-hidden="true" style="width:56cqw;height:56cqw"><svg viewBox="0 0 100 100"><path d="M50 4 100 92H0z"/></svg></div><div class="card-num" aria-hidden="true">10</div></div>'
  ][step - 1];
  var codeBox = "";
  if (step === 1) {
    if (st === "code" || st === "codeok" || st === "codebad") codeBox = '<label class="field' + (st === "codebad" ? " is-err" : "") + '" style="margin-top:14px"><span class="field-l"><span>' + t("o.code.q") + "</span><span>" + t("o.code.opt") + '</span></span><span class="field-box"><input class="is-text" style="font-family:var(--f-display);font-weight:800;letter-spacing:0.06em" maxlength="8" autocapitalize="characters" placeholder="' + t("o.code.ph") + '" value="' + (st === "codeok" ? "DALGONA4" : st === "codebad" ? "DALG0NA" : "") + '"><button type="button" class="field-act">' + t(st === "codeok" ? "o.code.change" : "o.code.apply") + '</button></span><p class="field-msg">' + (st === "codeok" ? t("o.code.ok", { name: "dalgona", w: M.invite.welcome }) : st === "codebad" ? t("o.code.unknown") : t("o.code.help")) + "</p></label>";
    else codeBox = '<a class="lnk" href="first-run.html?state=code">' + t("o.code.q") + "</a>";
  }
  var next = step < 3 ? "first-run.html?step=" + (step + 1) : "home.html";
  var body = '<div class="ob">' + art + '<div class="ob-body"><div class="ob-step" role="img" aria-label="' + t("o.step", { n: step }) + '">' + [1, 2, 3].map(function (n) { return '<i class="' + (n <= step ? "on" : "") + '"></i>'; }).join("") + '</div><h1 class="d">' + t("o." + step + ".h") + "</h1><p>" + t("o." + step + ".b") + "</p>" + codeBox + "</div>" +
    '<div class="ob-foot">' + (step === 1 ? A.langSwitch() : "") + '<a class="btn btn-p" href="' + next + '"><span>' + t(step < 3 ? "o.next" : "o.start") + "</span>" + A.ICON.go + "</a>" + (step < 3 ? '<a class="lnk" style="justify-self:start" href="home.html">' + t("o.skip") + "</a>" : '<p class="sub">' + t("o.3.wait") + "</p>") + "</div></div>";
  A.shell({ bare: true, body: body });
})();
