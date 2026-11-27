/* Profile: a sub page. The name is the headline, then rank, this week and points as three figures divided by column rules,
   then sections between rules. Log out is the text button at the end (it still asks first). */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$, I = CJ_I18N;
  var view = App.store.get("view", "card");
  function linkRow(label, href, ext) { return '<a class="rowlink" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + "><span>" + label + "</span>" + C.icon(ext ? "ext" : "chev", 18) + "</a>"; }
  var me = M.around && M.around[2] ? M.around[2] : null;
  function ident() {
    var nm = M.user.name || F.short(M.user.address);
    return '<section class="sec pid" aria-label="' + App.esc(t("p.title")) + '"><p class="pid-name" id="pid-name" translate="no">' + App.esc(nm) + '</p><div class="stats stats--3">' +
      '<div class="stat"><b>' + (me && S !== "unranked" && S !== "hold" ? me.rank : "&ndash;") + "</b><span>" + (me && S !== "unranked" ? t("p.rank") : t("p.norank")) + "</span></div>" +
      '<div class="stat"><b>' + F.pts(me ? me.pts : 0) + "</b><span>" + t("r.week") + "</span></div>" +
      '<div class="stat"><b>' + F.pts(M.user.points) + "</b><span>" + t("p.pts") + "</span></div></div>" +
      '<a class="inv-row" id="to-invite" href="invite.html"><span class="inv-row-t"><b>' + t("inv.entry") + "</b><small>" + t("inv.entry.sub", { r: M.invite.rate }) + '</small></span><span class="inv-row-go"><span class="sr-only">' + t("inv.entry.n", { n: M.invite.joined }) + '</span><span aria-hidden="true">' + M.invite.joined + "</span>" + C.icon("chev", 16) + "</span></a></section>";
  }
  function body() {
    var a = M.user.address;
    return ident() +
      '<section class="sec"><h2>' + t("p.account") + '</h2><div class="list">' +
      (S === "hold" ? '<a class="rowlink" id="hold-row" href="hold.html"><span><b>' + t("hold.t") + "</b><small>" + t("hold.profile.sub") + "</small></span>" + C.tag(t("hold.tag"), "", "pause") + C.icon("chev", 18) + "</a>" : "") +
      '<div class="prow">' + C.icon("mail", 20) + '<p class="grow">' + t("p.login", { email: '<b translate="no">' + M.user.email + "</b>" }) + "</p></div>" +
      '<div class="prow-addr"><p class="lbl">' + t("w.addr") + "</p>" + C.addr(a) + "</div>" +
      linkRow(t("w.scan"), "https://kaiascan.io/address/" + a, true) +
      '<div class="prow-dev"><div class="row">' + C.icon("check", 20) + '<p class="grow"><b>' + t("p.device.ready") + '</b><br><span class="tiny muted">' + t("p.device.until", { date: F.dateLong(M.ahead(30)) }) + "</span></p></div></div></div></section>" +
      '<section class="sec"><div class="field"><div class="field-label"><label for="name"><b>' + t("p.name") + '</b></label></div><div class="field-box field-box--text' + (S === "nameerror" ? " is-error" : "") + '"><input id="name" name="nickname" type="text" autocomplete="nickname" spellcheck="false" maxlength="24" value="' + (S === "nameerror" ? "cojam_admin" : M.user.name) + '" aria-describedby="name-msg"><button type="button" class="field-max" id="save" disabled>' + t("p.name.save.short") + '</button></div>' +
      '<div class="field-msg" id="name-msg" aria-live="polite"></div></div></section>' +
      '<section class="sec"><h2>' + t("p.prefs") + '</h2><div class="stack-8"><p class="small" id="l-lang">' + t("lang.label") + "</p>" +
      C.seg(I.langs.map(function (l) { return { label: I.names[l], value: l, on: l === App.lang }; }), { name: "lang", label: t("lang.label") }) + "</div>" +
      '<div class="stack-8"><p class="small">' + t("p.view") + "</p>" + C.seg([{ label: t("h.view.card"), value: "card", on: view !== "term" }, { label: t("h.view.term"), value: "term", on: view === "term" }], { name: "view", label: t("p.view") }) + "</div></section>" +
      '<section class="sec"><h2>' + t("p.help") + '</h2><div class="list">' + linkRow(t("p.how"), "first-run.html?from=profile") +
      '<details class="help help--row"><summary>' + t("p.answers.q") + C.icon("down", 18) + '</summary><div class="help-body">' + t("p.answers.a") + "</div></details>" +
      linkRow(t("p.swap"), "https://cojam.app/migrate/", true) + linkRow(t("p.site"), "https://cojam.app", true) + "</div>" +
      '<div class="pfoot">' + C.btn(t("p.logout"), { kind: "danger", id: "logout" }) +
      '<div class="row-between small muted"><span>' + t("p.version", { v: M.version }) + '</span><button type="button" class="linkish" id="upd">' + t("p.update") + "</button></div></div></section>";
  }
  function validate(v) {
    if (v === "") return "";
    if (/\*|fuck|shit/i.test(v)) return "p.name.e.word";
    if (v.length < 2 || v.length > 20 || v !== v.trim()) return "p.name.e.len";
    if (!/^[\p{L}\p{N} _.]+$/u.test(v)) return "p.name.e.chars";
    if (/^0x[0-9a-f]+$/i.test(v) || /cojam|admin/i.test(v)) return "p.name.e.staff";
    return "";
  }
  App.mount({ tab: "", me: true, back: "wallet.html", title: t("p.title"), body: body(), badges: { home: "dot", results: 2 }, after: function () {
    var name = $("#name"), msg = $("#name-msg"), save = $("#save");
    function check() { var e = validate(name.value); name.closest(".field-box").classList.toggle("is-error", !!e); name.setAttribute("aria-invalid", e ? "true" : "false"); msg.className = "field-msg" + (e ? " is-error" : ""); msg.textContent = e ? t(e) : t("p.name.help"); return !e; }
    function sync() { var ok = check(); save.disabled = !ok || name.value === (M.user.name || ""); }
    name.addEventListener("input", sync); sync();
    name.addEventListener("keydown", function (e) { if (e.key === "Enter" && !save.disabled) save.click(); });
    save.addEventListener("click", function () { if (check()) { M.user.name = name.value; $("#pid-name").textContent = name.value || F.short(M.user.address); App.toast(t("p.name.saved")); save.disabled = true; } else name.focus(); });
    document.addEventListener("seg", function (e) { if (e.detail.name === "lang") I.setLang(e.detail.value); if (e.detail.name === "view") App.store.set("view", e.detail.value); });
    function logout() { App.sheet.open("<h2>" + t("p.logout.h") + '</h2><p class="sheet-lead">' + t("p.logout.b") + '</p><div class="sheet-acts">' + C.btn(t("p.logout"), { block: true, href: "login.html" }) + C.btn(t("common.cancel"), { kind: "ghost", block: true, attrs: "data-sheet-close" }) + "</div>"); }
    $("#logout").addEventListener("click", logout);
    $("#upd").addEventListener("click", function () { App.toast(t("p.uptodate")); });
    if (S === "logout") logout();
  } });
})();
