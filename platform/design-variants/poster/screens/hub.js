/* Hub: every screen and state of the Poster variant. */
(function () {
  "use strict";
  var A = window.App, t = A.t, n = 0;
  var G = [
    ["px.hub.start", [["login.html", "a.h1", [["code", "code"], ["wrong", "wrong code"], ["bad", "bad email"], ["sending", "sending"], ["offline", "offline"]]],
      ["first-run.html", "o.1.h", [["&step=2", "step 2", 1], ["&step=3", "step 3", 1], ["code", "invite code"], ["codeok", "code ok"], ["codebad", "code not found"]]]]],
    ["px.hub.play", [["home.html", "h.title", [["partial", "partial"], ["loading", "loading"], ["empty", "empty"], ["error", "error"], ["offline", "offline"], ["hold", "on hold"]]],
      ["home-list.html", "h.view.term", [["partial", "partial"], ["offline", "offline"]]],
      ["done.html", "d.h1", [["&moment=1", "reward moment", 1], ["saving", "saving"]]],
      ["results.html", "r.title", [["empty", "empty"], ["loading", "loading"], ["error", "error"]]],
      ["ranking.html", "k.title", [["lastweek", "last week"], ["norank", "no rank"], ["hold", "on hold"], ["loading", "loading"]]]]],
    ["px.hub.money", [["staking.html", "s.new", [["review", "review sheet"], ["errmin", "under minimum"], ["errbal", "over balance"], ["hold", "on hold"]]],
      ["stakes.html", "s.tab.mine", [["empty", "empty"], ["hold", "on hold"]]],
      ["wallet.html", "w.title", [["deposit", "deposit sheet"], ["withdraw", "withdraw sheet"], ["offline", "offline"], ["rpc", "chain slow"], ["loading", "loading"], ["error", "error"], ["hold", "on hold"]]],
      ["convert.html", "c.title", [["short", "too few points"], ["wait", "7 day wait"], ["ok", "converted"], ["paused", "paused"], ["hold", "on hold"]]]]],
    ["px.hub.me", [["profile.html", "p.title", [["logout", "log out sheet"], ["hold", "on hold"]]], ["invite.html", "inv.title", [["empty", "no friends yet"], ["hold", "on hold"]]], ["hold.html", "sys.blocked.h", []]]]
  ];
  var html = '<div class="hub"><div class="hub-hd"><div class="cover-mark" style="margin:0"><img src="assets/cojam-mark.svg" alt=""><span>Cojam Daily</span></div><h1 class="d">' + t("px.hub.h") + '</h1><p class="sub" style="max-width:34ch">' + t("px.hub.s") + "</p>" + A.langSwitch() + "</div>" +
    G.map(function (g) {
      return '<section class="hub-g"><h2 class="hh">' + t(g[0]) + "</h2>" + g[1].map(function (p) {
        n++;
        return '<a class="hub-l" href="' + p[0] + '"><b>' + A.pad(n) + "</b><span>" + t(p[1]) + "<small>" + p[0] + "</small></span></a>" +
          (p[2].length ? '<p class="hub-st">' + p[2].map(function (s) { return '<a class="lnk" href="' + p[0] + (s[2] ? "?" + s[0].slice(1) : "?state=" + s[0]) + '">' + s[1] + "</a>"; }).join("") + "</p>" : "");
      }).join("") + "</section>";
    }).join("") + '<p class="sub" style="padding-top:14px;border-top:var(--rule) solid var(--ink)">CONCEPT.md, MOTION.md, REVIEW.md, captures/</p></div>';
  A.shell({ bare: true, body: html });
})();
