/* Account on hold, the full explanation: what it means, what still works (with the fee the player now pays), what is paused, and how to reach us.
   Every screen links here from its hold notice (C.hold). */
(function () {
  var t = App.t, $ = App.$;
  var MAIL = "help@cojam.app";
  function li(icon, keys) { return "<ul>" + keys.map(function (k) { return "<li>" + C.icon(icon, 18) + "<span>" + t(k) + "</span></li>"; }).join("") + "</ul>"; }
  var raw = '<div class="auth"><div class="gate-bar"><a class="mast-home" href="wallet.html?state=hold" aria-label="' + App.esc(t("hd.home")) + '">' + C.logo() + "</a>" + C.tag(t("hold.tag"), "ink", "pause") + '</div>' +
    '<div class="sys"><h1>' + t("sys.blocked.h") + "</h1><p>" + t("sys.blocked.b") + "</p>" +
    '<section class="sys-box" aria-labelledby="works-h"><h2 id="works-h">' + t("sys.blocked.works.h") + "</h2>" + li("check", [1, 2, 3, 4].map(function (i) { return "sys.blocked.works." + i; })) + '<p class="sys-fee">' + t("sys.blocked.fee") + "</p></section>" +
    '<section class="sys-box" aria-labelledby="stops-h"><h2 id="stops-h">' + t("sys.blocked.stops.h") + "</h2>" + li("x", [1, 2, 3, 4, 5].map(function (i) { return "sys.blocked.stops." + i; })) + "</section>" +
    '<section class="sys-box"><p class="small">' + t("sys.blocked.note") + '</p><div class="sys-contact">' + C.btn(t("sys.blocked.contact"), { href: "mailto:" + MAIL, icon: "mail", block: true, id: "contact" }) +
    '<button type="button" class="addr-chip addr-chip--text" id="mail-copy" data-copy="' + MAIL + '" data-done="' + App.esc(t("w.copy.done")) + '" aria-label="' + App.esc(t("sys.blocked.mail") + ": " + MAIL) + '"><span class="addr-chip-v" translate="no">' + MAIL + "</span>" + C.icon("copy", 16) + "</button></div>" +
    '<a class="sys-link" href="wallet.html?state=hold">' + t("sys.blocked.btn") + "</a></section></div></div>";
  App.mount({ bare: true, docTitle: t("sys.blocked.h"), raw: raw });
})();
