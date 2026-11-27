import re
def patch(p, reps):
    s=open(p,encoding='utf8').read()
    for a,b in reps:
        assert a in s,(p,a[:70]); s=s.replace(a,b)
    open(p,'w',encoding='utf8').write(s)
patch('screens/login.js',[('''C.dateline("<span>" + t("d.next.at") + "</span>").replace('class="dateline"', 'class="dateline dateline--cover"')''','''C.dateline("<span>" + t("d.next.at") + "</span>")''')])
patch('screens/home.js',[
 ('''/* Home, card view: the front page.''','''/* Home, card view: the deck of five collectible cards.'''),
 ('''<div class="qcard" data-pos="0"><div class="qcard-top">' + C.skel("64px", "12px") + C.skel("72px", "12px") + '</div><div class="qimg"></div><div class="qcard-body">' + C.skel("92%", "24px") + C.skel("60%", "24px") +
      C.skel("100%", "40px") + '<div class="choices">' + C.skel("100%", "54px") + C.skel("100%", "54px") + '</div></div></div></div>''',
  '''<div class="qcard" data-pos="0"><div class="qcard-in"><div class="qart" data-bg="well"></div><div class="qcard-body">' + C.skel("92%", "26px") + C.skel("60%", "26px") +
      C.skel("100%", "44px") + '<div class="choices">' + C.skel("100%", "60px") + C.skel("100%", "60px") + '</div></div></div></div></div>'''),
 ('''C.empty({ icon: "clock", title: t("h.empty.h")''','''C.empty({ jam: "sleep", title: t("h.empty.h")'''),
 ('''C.empty({ icon: "refresh", title: t("h.closed")''','''C.empty({ jam: "", title: t("h.closed")'''),
 ('''function endRing(id) { return '<div class="end-mark" aria-hidden="true">' + C.icon("check", 30) + '</div>''','''function endRing(id) { return '<div class="end-mark" aria-hidden="true">' + C.jam("cheer", 92) + '</div>'''),
 ('''var nudge = [], nudgeT = [], STEP = "steps(1, end)", PR = "rotate(-7deg) scale(0.86)", PL = "rotate(7deg) scale(0.86)";''','''var nudge = [], nudgeT = [], STEP = "steps(1, end)", PR = "rotate(-10deg) scale(0.9)", PL = "rotate(10deg) scale(0.9)";'''),
 ('''{ transform: "translateX(34px) rotate(2.6deg)", offset: 0.24 }, { transform: "translateX(34px) rotate(2.6deg)", offset: 0.4 }, { transform: "translateX(-34px) rotate(-2.6deg)", offset: 0.68 }, { transform: "translateX(-34px) rotate(-2.6deg)", offset: 0.82 }''',
  '''{ transform: "translateX(38px) rotate(4deg)", offset: 0.24 }, { transform: "translateX(38px) rotate(4deg)", offset: 0.4 }, { transform: "translateX(-38px) rotate(-4deg)", offset: 0.68 }, { transform: "translateX(-38px) rotate(-4deg)", offset: 0.82 }'''),
])
patch('screens/home-list.js',[('''C.empty({ icon: "clock", title: t("h.empty.h")''','''C.empty({ jam: "sleep", title: t("h.empty.h")''')])
patch('screens/results.js',[('''C.empty({ icon: "list", title: t("r.empty.h")''','''C.empty({ jam: "", title: t("r.empty.h")''')])

# ---------- done: the capsule ----------
s=open('screens/done.js',encoding='utf8').read()
a=s.index('/* Day done'); b=s.index('(function () {')
s='''/* Day done: the capsule machine. While the last pick is saved a closed capsule drops in and wobbles; when the points are paid it pops open:
   the lid flies off, Jam jumps out, the "+100P" coin sticker is slapped on, a few flat bits burst, the fifth sticker lands on the sheet,
   the live chip turns from "Closes in" to "Next set in" and the points in the header count up. About 2.2 seconds, and a tap skips to the settled page.
   The settled page is the same layout with nothing moving. */
'''+s[b:]
a=s.index('  /* the headline as letters'); b=s.index('  function pickRow')
s=s[:a]+'''  var BITS = [["sun", -112, -58, 40], ["accent", 118, -70, -60], ["pick-l", -86, 44, 90], ["pick-r", 96, 52, -30], ["sun", 30, -96, 120], ["accent", -34, -92, -90], ["pick-r", -132, 6, 60], ["pick-l", 136, -8, -120]];
  function hero() {
    var segs = phase === "saving" ? ["done", "done", "done", "done", "pend"] : ["done", "done", "done", "done", "done"];
    return '<section class="done-hero' + (moment ? " is-moment" : "") + (phase === "saving" ? " is-saving" : "") + '" id="hero">' +
      '<div class="cap-stage" aria-hidden="true"><div class="cap-drop"><div class="cap" id="cap">' +
      '<span class="cap-jam">' + C.jam("cheer", 108) + '</span><span class="cap-bot"></span><span class="cap-top"><i></i></span></div></div>' +
      BITS.map(function (b, i) { return '<i class="bit bit--' + (i % 3) + '" style="--c:var(--' + b[0] + ");--x:" + b[1] + "px;--y:" + b[2] + "px;--r:" + b[3] + 'deg"></i>'; }).join("") +
      '<p class="cap-coin' + (phase === "saving" ? " is-wait" : "") + '" id="done-fig"><span>+100<small>P</small></span></p>' +
      '<span class="seal" id="seal">' + C.rstamp("hit", C.icon("check", 14) + t("ar.paid")) + "</span>" +
      (wel ? '<p class="done-wel" id="done-wel"><b>+' + W + "P</b><span>" + t("d.wel.tag") + "</span></p>" : "") + "</div>" +
      "<h1>" + t("d.h1") + "</h1>" +
      '<div aria-live="polite" id="reward-wrap">' + status(phase) + "</div>" +
      '<div class="ph-line ph-line--sheet"><span class="ph-count">5<small>/5</small></span>' + C.day5(segs, { id: "day5", label: "5/5", size: "lg" }) + "</div>" +
      (moment ? '<p class="done-skip" aria-hidden="true">' + t("ar.skip") + "</p>" : "") + "</section>";
  }
'''+s[b:]
s=s.replace('''      '<section class="sec sec-rule"><div class="sh"><h2>' + t("d.picks")''','''      '<section class="sec box"><div class="sh"><h2>' + t("d.picks")''')
s=s.replace('''/* the dateline: while the last pick is saved it still reads "Closes in" (this edition is on the press); once paid it turns to the next set */''','''/* the live chip: while the last pick is saved it still reads "Closes in"; once paid it turns to the next set */''')
s=s.replace('''hero.classList.remove("is-saving"); hero.classList.add("is-paid");   /* the band inks in, the reels run, the stamp lands (CSS, each with its own delay) */''','''hero.classList.remove("is-saving"); hero.classList.add("is-paid");   /* the capsule pops, Jam jumps, the coin sticker lands (CSS, each with its own delay) */''')
s=s.replace('''/* the dateline turns to the next set as the stamp lands */
      at(760,''','''/* the live chip turns to the next set as the coin sticker lands */
      at(700,''')
s=s.replace('at(1500, settle);','at(1400, settle);').replace('at(900, pay);','at(850, pay);')
assert 'at(850, pay)' in s and 'at(1400, settle)' in s and 'sec box' in s
open('screens/done.js','w',encoding='utf8').write(s)

# ---------- ranking: the podium ----------
s=open('screens/ranking.js',encoding='utf8').read()
a=s.index('  function list(w) {'); b=s.index('  function pin(w) {')
s=s[:a]+'''  /* ranks 1 to 3 stand on a league podium (second, first, third from left to right; the list order for a screen reader stays 1, 2, 3) */
  function pod(r) {
    var ini = /^0x/.test(r.name) ? "0x" : Array.from(r.name)[0].toUpperCase();
    return '<li class="pod' + (r.me ? " is-me" : "") + '" data-rank="' + r.rank + '"><span class="pod-top"><span class="pod-av" aria-hidden="true">' + App.esc(ini) + '</span><span class="pod-name">' + name(r) + (r.me ? C.tag(t("k.you"), "ink") : "") + '</span><span class="pod-pts">' + F.pts(r.pts) + "</span></span>" +
      '<span class="pod-clip"><span class="pod-block"><span class="pod-rank">' + rankNo(r.rank) + '</span><span class="pod-prize"><span data-prize="' + r.prize + '">' + prize(r.prize) + "</span><small>CT</small></span></span></span></li>";
  }
  function list(w) {
    var colsHead = '<p class="cols" aria-hidden="true"><span>' + t("ar.rank.col") + "</span><span>" + t("ar.player.col") + "</span><span>" + t("ar.pts.col") + "</span><span>" + t("k.col.prize") + "</span></p>";
    if (S === "loading") return '<div class="podium podium--skel" aria-busy="true">' + C.skel("100%", "150px") + "</div>" + '<ul class="klist" id="top10" aria-busy="true">' + [1, 2, 3, 4, 5].map(function () { return '<li class="krow">' + C.skel("20px", "20px") + C.skel("120px", "14px") + C.skel("48px", "12px") + C.skel("64px", "14px") + "</li>"; }).join("") + "</ul>";
    var rows = rowsFor(w), voids = "";
    for (var i = rows.length + 1; i <= 10; i++) voids += '<li class="krow is-void"><span class="krow-rank" aria-hidden="true">' + i + '</span><p class="krow-name">' + t("k.void") + "</p></li>";
    return '<ol class="podium" id="podium" aria-label="' + App.esc(t("ar.podium")) + '">' + rows.slice(0, 3).map(pod).join("") + "</ol>" +
      '<div class="ktable">' + colsHead + '<ol class="klist" id="top10" start="4">' + rows.slice(3).map(row).join("") + voids + "</ol></div>";
  }
'''+s[b:]
for a,b in [
 ('''App.$$("#top10 .krow--lead [data-prize]")''','''App.$$("#podium [data-prize]")'''),
 ('''setTimeout(function () { App.countTo(el, 0, to, prize, null, 560); }, 120 + i * 90); }); }''','''setTimeout(function () { App.countTo(el, 0, to, prize, null, 620); }, [520, 360, 680][i] || 400); }); }'''),
 ('''return note + pool(w) + '<section class="sec sec-rule"><div class="sh"><h2>' + t("k.top") + "</h2>" + (S === "loading" || w === "last" ? "" : C.stamp(12)) + "</div>" +
      '<div class="ktable">' + list(w) + '</div><p class="tie-line">\'''','''return note + pool(w) + '<section class="sec"><div class="sh"><h2>' + t("k.top") + "</h2>" + (S === "loading" || w === "last" ? "" : C.stamp(12)) + "</div>" +
      list(w) + '<p class="tie-line">\''''),
 ('''<section class="sec sec-rule" id="around" tabindex="-1">''','''<section class="sec" id="around" tabindex="-1">'''),
 ('''<ol class="klist klist--gap" aria-label="' + App.esc(t("k.col.gap")) + '">' + rows.map(row).join("") + "</ol></section>";''','''<div class="ktable"><ol class="klist klist--gap" aria-label="' + App.esc(t("k.col.gap")) + '">' + rows.map(row).join("") + "</ol></div></section>";'''),
 ('''/* Weekly ranking: the league table. The pool and the time left lead; ranks 1 to 3 are set larger, the leader largest, in one table with ranks 4 to 10.
   The player's own rank is pinned above the tab bar in ink. */''','''/* Weekly ranking: the league. The prize pool leads; ranks 1 to 3 stand on a podium, ranks 4 to 10 follow in one table.
   The player's own rank is pinned above the dock. */'''),
]:
    assert a in s,a[:60]; s=s.replace(a,b)
open('screens/ranking.js','w',encoding='utf8').write(s)
