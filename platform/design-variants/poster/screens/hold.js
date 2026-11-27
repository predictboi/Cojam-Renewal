/* Account on hold: what still works, what is paused, who to write to. */
(function () {
  "use strict";
  var A = window.App, t = A.t;
  var body = '<div class="cover cover-k on-k"><span class="cover-g" aria-hidden="true" style="color:var(--ink-2)" data-g="II"></span><h1 class="d is-long">' + t("sys.blocked.h") + "</h1><p>" + t("sys.blocked.b") + "</p></div>" +
    '<section class="sec is-bare"><h2 class="sec-h hh" style="margin-bottom:4px">' + t("sys.blocked.works.h") + '</h2><ul class="bul">' + [1, 2, 3, 4].map(function (n) { return "<li>" + t("sys.blocked.works." + n) + "</li>"; }).join("") + '</ul><p class="note" style="margin-top:10px">' + t("sys.blocked.fee") + "</p></section>" +
    '<section class="sec"><h2 class="sec-h hh" style="margin-bottom:4px">' + t("sys.blocked.stops.h") + '</h2><ul class="bul is-off">' + [1, 2, 3, 4, 5].map(function (n) { return "<li>" + t("sys.blocked.stops." + n) + "</li>"; }).join("") + "</ul></section>" +
    '<section class="sec"><p style="margin-bottom:12px">' + t("sys.blocked.note") + '</p><a class="btn btn-p" href="wallet.html?state=hold"><span>' + t("sys.blocked.btn") + "</span>" + A.ICON.go + '</a><button type="button" class="btn btn-s" style="margin-top:8px" data-copy="support@cojam.app"><span>' + t("sys.blocked.contact") + '</span><span class="sub" style="color:inherit">support@cojam.app</span></button></section>';
  A.shell({ back: "home.html?state=hold", title: t("hold.t"), body: body });
})();
