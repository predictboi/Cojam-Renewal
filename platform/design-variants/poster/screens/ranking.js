/* Weekly ranking: a typographic chart. Rank numerals carry the hierarchy, a bar under each name carries the points. */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state;
  var last = st === "lastweek", hold = st === "hold", none = st === "norank";
  function head() {
    return '<div class="ph" style="padding-bottom:12px"><h1 class="ph-t d">' + t("tab.rank") + '</h1><p class="ph-s">' + t("k.sub") + "</p></div>" +
      '<div class="pad"><div class="seg" role="group" aria-label="' + t("k.week") + '"><a href="ranking.html"' + (last ? "" : ' aria-current="page"') + ">" + t("r.week") + '</a><a href="ranking.html?state=lastweek"' + (last ? ' aria-current="page"' : "") + ">" + t("k.lastweek") + "</a></div></div>";
  }
  if (st === "loading") return A.shell({ tab: "rank", body: head() + A.skeleton() });
  if (st === "error") return A.shell({ tab: "rank", body: head() + A.errBlock() });
  var s = M.untilWeekEnd(), max = M.ranking[0].pts;
  function rk(r, i, me) {
    var gap = me ? "" : "";
    return '<li class="rk' + (r.rank <= 3 ? " is-" + r.rank : "") + (r.me ? " is-me on-k" : "") + '" style="--i:' + i + '"><div class="rk-n" aria-label="' + t("k.rank.sr", { n: r.rank }) + '"><span>' + r.rank + "</span></div>" +
      '<div class="rk-who"><p class="rk-name">' + esc(r.name) + (r.me ? " (" + t("k.you") + ")" : "") + '</p><div class="rk-bar" style="width:' + Math.round(r.pts / max * 100) + '%"></div><span class="rk-pts">' + A.fmt(r.pts) + "P</span></div>" +
      (r.prize !== undefined ? '<div class="rk-prize">' + (hold && r.me ? t("hold.rank.row") : A.fmt(r.prize, 2) + "<small>CT</small>") + "</div>"
        : '<div class="rk-gap">' + (r.me ? "" : r.pts > M.me.pts ? t("k.gap.up", { n: r.pts - M.me.pts }) : r.pts < M.me.pts ? t("k.gap.down", { n: M.me.pts - r.pts }) : t("k.gap.same")) + "</div>") + "</li>";
  }
  var body = head() + (hold ? A.holdNote("hold.rank") : "") +
    (last ? '<div class="pad" style="padding-top:12px"><p class="note note-y"><b>' + t("k.final.h") + "</b>" + t("k.last", { rank: t("k.rankth", { n: 8 }), amount: "38.52" }) + " " + t("k.sent") + "</p></div>" : "") +
    '<section class="sec is-bare" style="padding-top:18px;padding-bottom:6px"><div class="pool"><div><span class="fig-l">' + t("k.pool") + '</span><span class="fig-v is-hero" style="font-size:4rem"><span data-roll="' + M.pool.ct + '"></span><small>CT</small></span></div>' +
      '<div style="text-align:right">' + (last ? '<span class="fig-l">' + t("k.sent") + "</span>" : '<span class="fig-l">' + t("k.ends") + '</span><span class="fig-v is-mid">' + t("k.dh", { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600) }) + '</span><span class="fig-n">' + t("k.endat") + "</span>") + "</div></div>" +
      '<details class="disc" style="margin-top:14px"><summary>' + t("k.split.q") + '</summary><div class="disc-b"><p>' + t("k.pool.line", { n: A.fmt(M.pool.players) }) + '</p><div class="split" role="img" aria-label="' + t("k.split.share") + '">' + M.pool.split.map(function (p, i) { return "<div>" + (i + 1) + "<b>" + p + "%</b></div>"; }).join("") + "</div><p>" + t("k.split.note") + "</p><p>" + t("k.tie") + " " + t("k.tie.note") + "</p></div></details></section>" +
    '<div class="pad sec-hd" style="margin-top:8px"><h2 class="sec-h hh">' + (last ? t("k.final.h") : t("k.top")) + '</h2><span class="live">' + (last ? t("k.final.time") : t("common.updated", { n: 7 })) + "</span></div>" +
    '<ol class="chart is-reveal" id="chart">' + M.ranking.map(function (r, i) { return rk(r, i); }).join("") + "</ol>" +
    (none ? "" : '<section class="sec is-bare" style="padding-top:22px"><div class="sec-hd"><h2 class="sec-h hh">' + t("k.around") + '</h2><span class="live">' + t("k.around.sub", { a: 25, b: 29 }) + '</span></div><ol class="chart" style="margin:0;border-top-width:var(--rule)">' + M.around.map(function (r, i) { return rk(r, i, true); }).join("") + "</ol></section>");
  var pin = none ? '<div style="padding:10px var(--m)"><p class="sub" style="margin-bottom:8px">' + t("k.none") + '</p><a class="btn btn-p" href="home.html"><span>' + t("k.play") + "</span>" + A.ICON.go + "</a></div>"
    : '<a class="pin-me on-k" href="#chart" aria-label="' + t("k.you") + '"><b>' + M.me.rank + '</b><span class="who">' + esc(M.user.name) + "<small>" + (hold ? t("hold.rank.pin") : t("k.gap", { gap: M.me.gap })) + '</small></span><span class="pts">' + A.fmt(M.me.pts) + "P</span></a>";
  A.shell({ tab: "rank", body: body, pin: pin, pinCls: "is-flush" });
})();
