/* Invite friends: the offer is the headline ("10%" in the slab), worked once as two figures divided by a rule; then the code, the link, the action. */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$, esc = App.esc, V = M.invite;
  var from = new URLSearchParams(location.search).get("from"), back = from === "wallet" ? "wallet.html" : "profile.html";
  var day = 350, cut = Math.round(day * V.rate / 100);
  function hero() {
    return '<section class="sec inv-hero"><h1><span class="inv-pct" aria-hidden="true">' + V.rate + '<small>%</small></span><span class="inv-line">' + t("inv.hero.line", { r: V.rate }) + "</span></h1>" +
      '<p class="inv-sub">' + t("inv.hero.sub") + "</p>" +
      '<div class="inv-ex" role="img" aria-label="' + esc(t("inv.ex.sr", { a: day, b: cut })) + '"><div><span>' + t("inv.ex.friend") + "</span><b>+" + F.pts(day) + "</b></div>" + C.icon("right", 20) + "<div><span>" + t("inv.ex.you") + "</span><b>+" + F.pts(cut) + "</b></div></div></section>";
  }
  function codeSec() {
    if (S === "hold") return '<section class="sec inv-code" aria-labelledby="code-h"><h2 class="lbl" id="code-h">' + t("inv.code.h") + "</h2>" + C.hold(t("hold.invite")) + "</section>";
    return '<section class="sec inv-code" aria-labelledby="code-h"><h2 class="lbl" id="code-h">' + t("inv.code.h") + "</h2>" + C.code(V.code, { id: "code", done: S === "copied" }) +
      '<p class="inv-link" translate="no">' + V.linkShort + "</p>" +
      (App.offline ? '<p class="hold-why" id="inv-off">' + C.icon("offline", 16) + "<span>" + t("inv.offline") + "</span></p>" : "") +
      '<div class="inv-acts">' + C.btn(t("inv.share"), { kind: "primary", block: true, icon: "share", id: "share" }) +
      C.btn(t("inv.copylink"), { block: true, icon: "copy", id: "copylink", attrs: 'data-copy="' + V.link + '" data-done="' + esc(t("inv.linkcopied")) + '"' }) + "</div></section>";
  }
  function how() {
    var w = "<b>+" + V.welcome + "P</b>", r = "<b>" + V.rate + "%</b>";
    return '<section class="sec" aria-labelledby="how-h"><h2 id="how-h">' + t("inv.how.h") + '</h2><ol class="inv-steps"><li><span>' + t("inv.how.1") + "</span></li><li><span>" +
      t("inv.how.2", { w: "\u0001" }).replace("+\u0001P", w) + "</span></li><li><span>" + t("inv.how.3", { r: "\u0001" }).replace("\u0001%", r) + "</span></li></ol></section>";
  }
  function friend(f) {
    return '<li class="inv-friend"><span translate="no">' + esc(f.name) + "</span>" + C.tag(t("inv.st." + f.st), f.st === "first" ? "ink" : "") +
      "<b" + (f.pts ? "" : ' class="is-zero"') + ">" + (f.pts ? "+" + F.pts(f.pts) : "0P") + "</b></li>";
  }
  function results() {
    if (S === "loading") return '<section class="sec" aria-busy="true">' + C.skel("120px", "20px") + '<div class="tri">' + [1, 2, 3].map(function () { return '<div class="tri-c">' + C.skel("64px", "24px") + C.skel("72px", "12px") + "</div>"; }).join("") + "</div>" +
      [1, 2, 3].map(function () { return '<div class="inv-friend">' + C.skel("110px", "16px") + C.skel("70px", "22px") + C.skel("56px", "16px") + "</div>"; }).join("") + '<p class="sr-only" role="status">' + t("common.loading") + "</p></section>";
    if (S === "error") return '<section class="sec" aria-labelledby="res-h"><h2 id="res-h">' + t("inv.res.h") + "</h2>" + C.note("error", t("inv.error"), C.btn(t("common.retry"), { sm: true, icon: "refresh", attrs: "data-reload" })) + "</section>";
    if (S === "empty") return '<section class="sec" aria-labelledby="res-h"><h2 id="res-h">' + t("inv.res.h") + '</h2><p class="inv-none">' + t("inv.empty") + "</p></section>";
    return '<section class="sec" aria-labelledby="res-h"><h2 id="res-h">' + t("inv.res.h") + "</h2>" + (App.offline ? '<p class="hold-why" id="inv-stale">' + C.icon("info", 16) + "<span>" + t("inv.stale") + "</span></p>" : "") +
      (S === "hold" ? '<p class="hold-why" id="inv-hold">' + C.icon("info", 16) + "<span>" + t("hold.invite.bonus") + "</span></p>" : "") + '<div class="tri">' +
      '<div class="tri-c"><p class="tri-fig">' + V.joined + '</p><p class="tri-sub">' + t("inv.res.joined") + '</p></div><div class="tri-c"><p class="tri-fig">' + F.pts(V.week) + '</p><p class="tri-sub">' + t("inv.res.week") + '</p></div><div class="tri-c"><p class="tri-fig">' + F.pts(V.total) + '</p><p class="tri-sub">' + t("inv.res.total") + "</p></div></div>" +
      '<h3 class="inv-sub-h">' + t("inv.friends.h") + '</h3><ul class="list">' + V.friends.map(friend).join("") + "</ul></section>";
  }
  function rules() {
    return '<section class="sec" aria-labelledby="rules-h"><h2 id="rules-h">' + t("inv.rules.h") + '</h2><ul class="inv-rules">' + [1, 2, 3, 4].map(function (i) { return "<li>" + t("inv.rule." + i) + "</li>"; }).join("") + "</ul></section>";
  }
  App.mount({ tab: "", back: back, title: t("inv.title"), body: hero() + codeSec() + (S === "hold" ? "" : how()) + results() + rules(), pts: S === "loading" ? "loading" : "", badges: { home: "dot", results: 2 }, after: function () {
    var share = $("#share"); if (!share) return;
    var lab = $("span", share), busy = false;
    function flash(text) { if (busy) return; busy = true; var old = lab.textContent; lab.textContent = text; share.classList.add("is-done"); App.live(text); setTimeout(function () { lab.textContent = old; share.classList.remove("is-done"); busy = false; }, 2000); }
    share.addEventListener("click", function () {
      var data = { title: "Cojam", text: t("inv.share.text", { code: V.code, w: V.welcome }), url: V.link };
      if (navigator.share && !App.offline) { navigator.share(data).then(function () { App.toast(t("inv.shared")); }).catch(function () {}); return; }
      try { if (navigator.clipboard) navigator.clipboard.writeText(V.link).catch(function () {}); } catch (e) {}
      flash(t("inv.linkcopied"));
    });
  } });
})();
