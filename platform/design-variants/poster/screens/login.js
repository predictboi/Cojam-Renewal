/* Log in: the headline is the cover. States: (email), code, bad, sending, offline. */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state;
  var code = st === "code" || st === "wrong";
  var cover = '<div class="cover"><span class="cover-g" aria-hidden="true" data-g="5"></span><div class="cover-mark"><img src="assets/cojam-mark.svg" alt=""><span>Cojam</span></div><h1 class="d' + (code && A.lang === "en" ? "" : "") + '">' + t(code ? "a.code.h1" : "a.h1") + "</h1><p>" + (code ? t("a.code.body", { email: esc(M.user.email) }) : t("a.lede")) + "</p></div>";
  var form;
  if (code) form = '<label class="field' + (st === "wrong" ? " is-err" : "") + '"><span class="field-l"><span>' + t("a.code.label") + '</span></span><span class="field-box"><input class="code-in" inputmode="numeric" maxlength="6" autocomplete="one-time-code" value="' + (st === "wrong" ? "481920" : "") + '" placeholder="000000" aria-describedby="msg"></span><p class="field-msg" id="msg">' + t(st === "wrong" ? "a.code.wrong" : "a.code.tip") + "</p></label>" +
    '<a class="btn btn-p" style="margin-top:14px" href="first-run.html"><span>' + t("a.code.btn") + "</span>" + A.ICON.go + '</a><p class="sub" style="margin-top:10px">' + t("a.code.resendin", { s: 42 }) + '</p><a class="lnk" href="login.html">' + t("a.code.change") + "</a>";
  else form = '<label class="field' + (st === "bad" ? " is-err" : "") + '"><span class="field-l"><span>' + t("a.email.label") + '</span></span><span class="field-box"><input class="is-text" type="email" inputmode="email" autocomplete="email" placeholder="name@gmail.com" value="' + (st === "bad" ? "minji@naver" : st === "sending" ? M.user.email : "") + '" aria-describedby="msg"></span><p class="field-msg" id="msg">' + (st === "bad" ? t("a.email.bad") : st === "offline" ? t("a.offline") : t("a.email.cap", { list: M.providerNames })) + "</p></label>" +
    (st === "sending" ? '<button type="button" class="btn btn-p is-busy" style="margin-top:14px"><span>' + t("a.email.sending") + '</span><span class="busy"></span></button>' : '<a class="btn btn-p" style="margin-top:14px" href="login.html?state=code"' + (st === "offline" ? ' aria-disabled="true"' : "") + "><span>" + t("a.email.btn") + "</span>" + A.ICON.go + "</a>") +
    '<details class="disc" style="margin-top:14px"><summary>' + t("a.help.q") + '</summary><div class="disc-b"><p>' + t("a.help.a") + "</p></div></details>";
  var body = cover + '<section class="sec is-bare" style="padding-top:18px">' + form + "</section>" +
    (code ? "" : '<section class="sec"><ol class="facts">' + [1, 2, 3].map(function (n) { return "<li><b>" + n + "</b><span>" + t("a.fact." + n) + "</span></li>"; }).join("") + "</ol></section>") +
    '<section class="sec"><p class="lab" style="margin-bottom:6px">' + t("lang.label") + "</p>" + A.langSwitch() + '<p class="fine" style="margin-top:8px">' + t("a.fine", { terms: '<a class="lnk" href="#">' + t("a.terms") + "</a>", privacy: '<a class="lnk" href="#">' + t("a.privacy") + "</a>" }) + "</p></section>";
  A.shell({ bare: true, body: body });
})();
