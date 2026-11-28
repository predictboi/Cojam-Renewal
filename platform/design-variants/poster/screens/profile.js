/* Profile: the initial as a poster letter, then account, name, preferences, help. */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state, fmt = A.fmt, u = M.user, hold = st === "hold";
  var view = "card"; try { view = localStorage.getItem("cjp.poster.view") || "card"; } catch (e) {}
  var body =
    '<div class="who-hd"><div class="who-av" aria-hidden="true">' + esc(u.name.charAt(0)) + '</div><div><h1 class="d">' + esc(u.name) + "</h1>" + (hold ? '<span class="chip chip-k" style="margin-top:8px">' + t("hold.tag") + "</span>" : "") + "</div></div>" +
    '<div class="trio" style="margin:0 var(--m);border-top:var(--rule) solid var(--ink)"><div><span class="fig-l">' + t("p.rank") + '</span><span class="fig-v">' + M.me.rank + '</span><span class="fig-n">' + t("px.rank.of", { n: fmt(M.pool.players) }) + '</span></div><div><span class="fig-l">' + t("r.week") + '</span><span class="fig-v">' + fmt(M.week.pts) + '<small>P</small></span></div><div><span class="fig-l">' + t("p.pts") + '</span><span class="fig-v">' + fmt(u.points) + "<small>P</small></span></div></div>" +
    (hold ? '<div class="pad" style="padding-bottom:12px"><a class="note note-k on-k" style="display:block" href="hold.html"><b>' + t("hold.t") + "</b>" + t("hold.profile.sub") + "</a></div>" : "") +
    '<section class="sec" style="padding-bottom:8px"><a class="row" href="invite.html"><span class="row-m"><span class="row-t">' + t("inv.entry") + '</span><br><span class="row-s">' + t("inv.entry.sub", { r: M.invite.rate }) + '</span></span><span class="row-e is-text">' + t("inv.entry.n", { n: M.invite.joined }) + "</span>" + A.ICON.go + "</a></section>" +
    '<section class="sec"><h2 class="sec-h hh" style="margin-bottom:6px">' + t("p.account") + '</h2><dl><div class="kv"><dt>' + t("a.email.label") + "</dt><dd>" + esc(u.email) + '</dd></div><div class="kv"><dt>' + t("p.device") + "</dt><dd>" + t("p.device.ready") + '</dd></div><div class="kv"><dt>' + t("p.code") + "</dt><dd>" + t("p.code.by", { name: "dalgona" }) + "</dd></div></dl>" +
      '<p class="lab" style="margin-top:10px">' + t("p.wallet") + '</p><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><button type="button" class="addr-chip" data-copy="' + u.address + '" aria-label="' + t("w.copy") + '">' + A.short(u.address) + A.ICON.copy + '</button><a class="lnk" href="#">' + t("w.scan") + "</a></div></section>" +
    '<section class="sec"><label class="field" id="nf"><span class="field-l"><span>' + t("p.name") + '</span></span><span class="field-box"><input class="is-text" id="name" value="' + esc(u.name) + '" maxlength="24" autocomplete="off"><button type="button" class="field-act" id="save">' + t("p.name.save.short") + '</button></span><p class="field-msg" id="nmsg" role="status">' + t("p.name.help") + "</p></label></section>" +
    '<section class="sec"><h2 class="sec-h hh" style="margin-bottom:10px">' + t("p.prefs") + '</h2><p class="lab" style="margin-bottom:6px">' + t("lang.label") + "</p>" + A.langSwitch() +
      '<p class="lab" style="margin:14px 0 6px">' + t("p.view") + '</p><div class="seg" role="group" aria-label="' + t("p.view") + '" id="view"><button type="button" data-v="card" aria-pressed="' + (view === "card") + '">' + t("h.view.card") + '</button><button type="button" data-v="list" aria-pressed="' + (view === "list") + '">' + t("h.view.term") + "</button></div></section>" +
    '<section class="sec" style="padding-bottom:8px"><h2 class="sec-h hh" style="margin-bottom:4px">' + t("p.help") + '</h2><details class="disc" style="border-top:0"><summary>' + t("p.answers.q") + '</summary><div class="disc-b"><p>' + t("p.answers.a") + '</p></div></details><details class="disc"><summary>' + t("a.help.q") + '</summary><div class="disc-b"><p>' + t("a.help.a") + "</p></div></details>" +
      '<div class="rows" style="border-top:1px solid var(--hair)"><a class="row" href="#"><span class="row-t">' + t("p.swap") + "</span>" + A.ICON.go + '</a><a class="row" href="#"><span class="row-t">' + t("p.site") + "</span>" + A.ICON.go + "</a></div></section>" +
    '<section class="sec"><button type="button" class="btn btn-s" id="out"><span>' + t("p.logout") + '</span></button><p class="sub" style="margin-top:10px">' + t("p.version", { v: M.version }) + ". " + t("p.uptodate") + "</p></section>";
  A.shell({ back: "home.html", title: t("p.title"), body: body, me: true });
  var $ = function (i) { return document.getElementById(i); };
  $("save").addEventListener("click", function () {
    var v = $("name").value.trim(), err = v && (v.length < 2 || v.length > 20) ? t("p.name.e.len") : v && !/^[\w .぀-ヿ一-鿿가-힯]+$/.test(v) ? t("p.name.e.chars") : "";
    $("nf").classList.toggle("is-err", !!err); $("nmsg").textContent = err || t("p.name.help"); if (!err) A.toast(t("p.name.saved"));
  });
  $("view").addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (!b) return; this.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); try { localStorage.setItem("cjp.poster.view", b.getAttribute("data-v")); } catch (er) {} });
  $("out").addEventListener("click", function () { A.sheet(t("p.logout.h"), '<p style="margin-bottom:14px">' + t("p.logout.b") + '</p><a class="btn btn-p" href="login.html"><span>' + t("p.logout") + '</span></a><button type="button" class="btn btn-s" data-close><span>' + t("common.cancel") + "</span></button>"); });
  if (st === "logout") $("out").click();
})();
