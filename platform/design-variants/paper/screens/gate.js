/* The install Gate: what a visitor sees in a browser tab before the app is on the home screen. In the paper language it is the newsstand copy:
   the nameplate, a headline, today's lead story as an example, and one framed notice that says how to get the paper on this device.
   States (the same names as platform/design/gate.html): android, accepted, dismissed, android-manual, ios, ios-other, inapp, inapp-ios, desktop, generic, installed,
   invited, invited-noname, invited-ios-other, invited-inapp, invited-inapp-ios. With no state: desktop on a wide screen with a mouse, android otherwise. */
(function () {
  var t = App.t, S = App.state, M = MOCK, $ = App.$;
  var wide = matchMedia("(min-width: 900px) and (pointer: fine)").matches;
  var v = S || (wide ? "desktop" : "android");
  /* reached from an invite link: the invite block leads the notice, and every "Copy link" copies the invite link (with its code), never the plain app address */
  var inv = /^invited/.test(v), base = inv ? v.replace(/^invited-?/, "") : v, noName = base === "noname";
  if (noName) base = "";
  var manual = [[t("g.manual.1"), "more"], [t("g.manual.2"), "addhome"], [t("g.manual.3"), "phone"]];
  var ios = [[t("g.ios.1"), "share"], [t("g.ios.2"), "addhome"], [t("g.ios.3"), "phone"]];
  var copy = C.btn(t("g.copy"), { block: true, icon: "copy", id: "copylink", attrs: 'data-copy="' + (inv ? M.invite.link : M.appUrl) + '" data-toast="' + App.esc(t(inv ? "g.inv.copied" : "g.copied")) + '"' });
  function invBlock() {
    return '<div class="gate-inv"><h2>' + (noName ? t("g.inv.h.anon") : t("g.inv.h", { name: '<b translate="no">' + App.esc(M.invite.by) + "</b>" })) + "</h2>" + C.code(M.invite.code, { id: "inv-code", label: t("g.inv.code") }) +
      "<p>" + t("g.inv.b") + '</p><p class="gate-inv-get">' + t("g.inv.get", { w: M.invite.welcome }) + "</p></div>";
  }
  function panel() {
    if (inv && base) return invBlock() + variant(base).replace("<h2>", "<h3>").replace("</h2>", "</h3>");
    if (inv) return invBlock() + "<h3>" + t("g.manual.h") + "</h3>" + C.steps(wide ? manual : ios);
    return variant(v);
  }
  function variant(v) {
    switch (v) {
      case "android": return "<h2>" + t("g.install.h") + '</h2><p class="muted">' + t("g.install.b") + "</p>" + C.btn(t("g.android.btn"), { kind: "primary", block: true, icon: "download", id: "install" });
      case "accepted": return C.note("ok", t("g.android.accepted"));
      case "dismissed": return "<h2>" + t("g.install.h") + "</h2>" + C.btn(t("g.android.btn"), { kind: "primary", block: true, icon: "download", id: "install" }) + '<p class="small muted">' + t("g.android.or") + "</p>" + C.steps(manual);
      case "android-manual": return "<h2>" + t("g.manual.h") + "</h2>" + C.steps(manual);
      case "ios": return "<h2>" + t("g.manual.h") + "</h2>" + C.steps(ios);
      case "ios-other": return "<h2>" + t("g.manual.h") + "</h2>" + C.steps([[t("g.iosother.1"), "share"], ios[1], ios[2]]) + C.note("", t("g.iosother.note")) + copy;
      case "inapp": return "<h2>" + t("g.inapp.h") + '</h2><p class="muted">' + t("g.inapp.body", { app: "KakaoTalk" }) + "</p>" + C.btn(t("g.inapp.btn"), { kind: "primary", block: true, iconEnd: "ext", id: "openext" }) + '<div class="stack-8" id="inapp-more" hidden><p class="small muted">' + t("g.inapp.or") + "</p>" + C.steps([[t("g.inapp.1"), "dots"], [t("g.inapp.2"), "ext"]]) + "</div>" + copy;
      case "inapp-ios": return "<h2>" + t("g.inapp.h") + '</h2><p class="muted">' + t("g.inapp.body", { app: "Instagram" }) + "</p>" + C.steps([[t("g.inapp.1"), "dots"], [t("g.inapp.2"), "ext"]]) + copy;
      case "desktop": return "<h2>" + t("g.desk.h") + '</h2><p class="muted">' + t("g.desk.body") + '</p><div class="gate-qr">' + C.qr(M.qrUrl, t("g.qr.alt")) + '<p class="mono" translate="no">app.cojam.app</p></div>' + copy;
      case "generic": return "<h2>" + t("g.desk.h") + '</h2><div class="gate-qr">' + C.qr(M.qrUrl, t("g.qr.alt")) + "</div>" + C.help(t("g.gen.ios"), C.steps(ios)) + C.help(t("g.gen.android"), C.steps(manual));
      case "installed": return C.note("ok", t("g.installed"));
    }
    return "";
  }
  /* today's lead story as the example; it cannot be played here */
  var demo = '<div class="gate-demo" aria-hidden="true"><span class="gate-demo-tag">' + t("g.example") + "</span>" + C.qcard(M.set[0], { static: true }) + "</div>";
  /* the headline of the reference is "Predict daily. <em>Earn CT.</em>": one voice here, the second sentence on its own line, no italic word */
  var h1 = t("g.h1").replace(/<em>(.*?)<\/em>/, '<span class="gate-h1-2">$1</span>');
  var raw = '<div class="auth gate"><p class="gate-top" role="note">' + C.icon("shield", 16) + "<span>" + t("g.top") + "</span></p>" +
    '<header class="gate-bar">' + C.logo(true) + C.lang() + '</header><div class="oxford" aria-hidden="true"></div>' + C.dateline("<span>" + t("d.next.at") + "</span>").replace('class="dateline"', 'class="dateline dateline--cover"') +
    '<div class="gate-cols"><div class="gate-col"><div class="stack-12"><h1>' + h1 + '</h1><p class="auth-lede">' + t("g.lede") + "</p></div>" +
    (inv ? "" : demo) + "</div>" +
    '<div class="gate-col"><section class="panel" aria-live="polite" id="panel">' + panel() + "</section>" + (inv ? demo : "") +
    '<ul class="facts"><li>' + C.icon("bolt", 18) + t("g.fact.1") + "</li><li>" + C.icon("mail", 18) + t("g.fact.2") + "</li><li>" + C.icon("shield", 18) + t("g.fact.3") + "</li></ul>" +
    '<section class="gate-swap"><h2>' + t("g.swap.h") + "</h2><p>" + t("g.swap.body") + "</p>" + C.btn(t("g.swap.btn"), { href: "https://cojam.app/migrate/", ext: true, iconEnd: "ext" }) + "</section></div></div>" +
    '<footer class="gate-foot"><a href="https://cojam.app">' + t("hd.home") + "</a><span>© 2026 Cojam</span></footer></div>" +
    (v === "ios" ? '<p class="ios-point" aria-hidden="true"><span>' + t("g.ios.point") + "</span>" + C.icon("down", 20) + "</p>" : "");
  App.mount({ bare: true, cls: "is-gate", docTitle: "Cojam", raw: raw, after: function () {
    var q = $(".gate-demo .qcard"); if (q) q.setAttribute("inert", "");
    var ins = $("#install"); if (ins) ins.addEventListener("click", function () { $("#panel").innerHTML = C.note("ok", t("g.android.accepted")); setTimeout(function () { $("#panel").innerHTML = C.note("ok", t("g.installed")); }, 2200); });
    var oe = $("#openext"); if (oe) oe.addEventListener("click", function () { setTimeout(function () { $("#inapp-more").hidden = false; }, 1500); });
  } });
})();
