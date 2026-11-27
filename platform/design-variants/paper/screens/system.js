/* System screens, each a full page under the nameplate: maintenance, update required, offline, not found, and the full explanation of an account on hold.
   States (as platform/design/system.html): maintenance (default), update, offline, notfound, blocked. hold.html is the same script with blocked as its default,
   so the hold notice on every screen can link to either. */
(function () {
  var t = App.t, F = App.fmt, $ = App.$;
  var S = App.state || (/hold\.html/.test(location.pathname) ? "blocked" : "maintenance");
  var v = {
    maintenance: { icon: "tool", h: "sys.maint.h", b: "sys.maint.b", btn: "sys.maint.btn", extra: '<div class="sys-box"><p class="small">' + t("sys.maint.msg") + '</p><p class="sys-fee">' + t("sys.maint.eta", { time: F.date(new Date(Date.now() + 40 * 60000), true) }) + "</p></div>", foot: t("sys.maint.auto") },
    update: { icon: "download", h: "sys.update.h", b: "sys.update.b", btn: "sys.update.btn" },
    offline: { icon: "offline", h: "sys.off.h", b: "sys.off.b", btn: "common.retry" },
    blocked: { h: "sys.blocked.h" },
    notfound: { icon: "search", h: "sys.404.h", b: "sys.404.b", btn: "sys.404.btn", href: "home.html" }
  }[S] || { icon: "search", h: "sys.404.h", b: "sys.404.b", btn: "sys.404.btn", href: "home.html" };
  var MAIL = "help@cojam.app";
  function li(icon, keys) { return "<ul>" + keys.map(function (k) { return "<li>" + C.icon(icon, 18) + "<span>" + t(k) + "</span></li>"; }).join("") + "</ul>"; }
  var top = '<header class="gate-bar">' + (S === "blocked" || S === "notfound" ? '<a class="mast-back" href="' + (S === "blocked" ? "wallet.html?state=hold" : "home.html") + '" aria-label="' + App.esc(t("hd.back")) + '">' + C.icon("back", 22) + "</a>" : "") + '<a class="mast-home" href="' + (S === "blocked" ? "wallet.html?state=hold" : "home.html") + '" aria-label="' + App.esc(t("hd.home")) + '">' + C.logo() + "</a>" + (S === "blocked" ? C.tag(t("hold.tag"), "ink", "pause") : "") + '</header><div class="oxford" aria-hidden="true"></div>';
  /* account on hold. Calm and complete: what it means, what still works (with the fee the player now pays), what is paused, and how to reach us.
     The address is a mail link and also a copy chip, so it can be carried to another app. */
  var hold = '<div class="sys"><h1>' + t("sys.blocked.h") + "</h1><p>" + t("sys.blocked.b") + "</p>" +
    '<section class="sys-box" aria-labelledby="works-h"><h2 id="works-h">' + t("sys.blocked.works.h") + "</h2>" + li("check", [1, 2, 3, 4].map(function (i) { return "sys.blocked.works." + i; })) + '<p class="sys-fee">' + t("sys.blocked.fee") + "</p></section>" +
    '<section class="sys-box" aria-labelledby="stops-h"><h2 id="stops-h">' + t("sys.blocked.stops.h") + "</h2>" + li("x", [1, 2, 3, 4, 5].map(function (i) { return "sys.blocked.stops." + i; })) + "</section>" +
    '<section class="sys-box"><p class="small">' + t("sys.blocked.note") + '</p><div class="sys-contact">' + C.btn(t("sys.blocked.contact"), { href: "mailto:" + MAIL, icon: "mail", block: true, id: "contact" }) +
    '<button type="button" class="addr-chip addr-chip--text" id="mail-copy" data-copy="' + MAIL + '" data-done="' + App.esc(t("w.copy.done")) + '" aria-label="' + App.esc(t("sys.blocked.mail") + ": " + MAIL) + '"><span class="addr-chip-v" translate="no">' + MAIL + "</span>" + C.icon("copy", 16) + "</button></div>" +
    '<a class="sys-link" href="wallet.html?state=hold">' + t("sys.blocked.btn") + "</a></section></div>";
  var plain = '<div class="sys sys--center">' + C.notice(v.icon) + "<h1>" + t(v.h) + "</h1><p>" + (v.b ? t(v.b) : "") + "</p>" + (v.extra || "") +
    C.btn(t(v.btn || "common.retry"), { kind: "primary", href: v.href, id: "act" }) + (v.foot ? '<p class="sys-fee">' + v.foot + "</p>" : "") + "</div>";
  App.mount({ bare: true, docTitle: t(v.h), raw: '<div class="auth">' + top + (S === "blocked" ? hold : plain) + "</div>", after: function () {
    var b = $("#act"); if (b && b.tagName === "BUTTON") b.addEventListener("click", function () { b.classList.add("is-loading"); b.innerHTML = '<span class="spin"></span><span>' + t("common.loading") + "</span>"; setTimeout(function () { location.reload(); }, 900); });
  } });
})();
