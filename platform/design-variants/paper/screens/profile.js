/* Profile: a sub page. The name is the headline, then rank, this week and points as three figures divided by column rules,
   then sections between rules. Log out is the text button at the end (it still asks first). */
(function () {
  var t = App.t, F = App.fmt, S = App.state, M = MOCK, $ = App.$, I = CJ_I18N;
  var view = App.store.get("view", "card");
  function linkRow(label, href, ext) { return '<a class="rowlink" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + "><span>" + label + "</span>" + C.icon(ext ? "ext" : "chev", 18) + "</a>"; }
  var me = M.around && M.around[2] ? M.around[2] : null;
  /* invite code: once, within 24 hours of signing up. In profile the player's own code is V.code. */
  var V = M.invite, CODE_PRESET = { "code-valid": "DALGONA4", "code-unknown": "KAIA999", "code-own": V.code, "code-offline": "DALGONA4" }, codeState = /^code-/.test(S) ? (S === "code-linked" ? "linked" : "open") : "", inviter = "dalgona";
  function codeRow() {
    if (codeState === "linked") return '<div class="prow" id="code-row">' + C.icon("check", 20) + '<p class="grow"><b>' + t("p.code.by", { name: '<span translate="no">' + App.esc(inviter) + "</span>" }) + "</b></p></div>";
    if (codeState !== "open") return "";
    var h = Math.ceil(24 - (Date.now() - M.user.signedUp) / 3600000);
    return '<button type="button" class="rowlink" id="code-row"><span><b>' + t("p.code") + "</b></span>" + C.tag(h + "h", "", "clock") + C.icon("chev", 18) + "</button>";
  }
  function ident() {
    var nm = M.user.name || F.short(M.user.address);
    return '<section class="sec pid" aria-label="' + App.esc(t("p.title")) + '"><p class="pid-name" id="pid-name" translate="no">' + App.esc(nm) + '</p><div class="stats stats--3">' +
      '<div class="stat"><b>' + (me && S !== "unranked" && S !== "hold" ? me.rank : "&ndash;") + "</b><span>" + (me && S !== "unranked" ? t("p.rank") : t("p.norank")) + "</span></div>" +
      '<div class="stat"><b>' + F.pts(me ? me.pts : 0) + "</b><span>" + t("r.week") + "</span></div>" +
      '<div class="stat"><b>' + F.pts(M.user.points) + "</b><span>" + t("p.pts") + "</span></div></div>" +
      '<a class="inv-row" id="to-invite" href="invite.html"><span class="inv-row-t"><b>' + t("inv.entry") + '</b></span><span class="inv-row-go inv-row-go--text">' + t("inv.entry.n", { n: M.invite.joined }) + C.icon("chev", 16) + "</span></a></section>";
  }
  function device() {
    if (S === "notset") return '<div class="row">' + C.icon("phone", 20) + '<p class="grow">' + t("p.device.notset") + "</p></div>" + C.btn(t("p.device.setup"), { block: true, href: "login.html?state=returning" });
    if (S === "otherdevice") return '<div class="row">' + C.icon("phone", 20) + '<p class="grow">' + t("p.device.other") + "</p></div>" + C.btn(t("h.other.btn"), { block: true, href: "login.html?state=returning" });
    return '<div class="row">' + C.icon("check", 20) + '<p class="grow"><b>' + t("pp.i.device") + "</b></p>" + C.q("device", t("pp.i.device")) + "</div>";
  }
  function body() {
    var a = M.user.address;
    return ident() +
      '<section class="sec"><h2>' + t("p.account") + '</h2><div class="list">' +
      (S === "hold" ? '<a class="rowlink" id="hold-row" href="system.html?state=blocked"><span><b>' + t("hold.t") + "</b></span>" + C.tag(t("hold.tag"), "", "pause") + C.icon("chev", 18) + "</a>" : "") +
      '<div class="prow">' + C.icon("mail", 20) + '<p class="grow"><b translate="no">' + M.user.email + "</b></p></div>" +
      '<div id="code-slot">' + codeRow() + "</div>" +
      '<div class="prow-addr"><p class="lbl">' + t("pp.addr") + "</p>" + C.addr(a) + "</div>" +
      linkRow("Kaiascan", "https://kaiascan.io/address/" + a, true) +
      '<div class="prow-dev stack-8">' + device() + "</div></div></section>" +
      '<section class="sec"><div class="field"><div class="field-label"><label for="name"><b>' + t("p.name") + "</b></label>" + C.q("name", t("p.name")) + '</div><div class="field-box field-box--text' + (S === "nameerror" || S === "nameword" ? " is-error" : "") + '"><input id="name" name="nickname" type="text" autocomplete="nickname" spellcheck="false" maxlength="24" value="' + (S === "nameerror" ? "cojam_admin" : S === "nameword" ? "f**k" : M.user.name) + '" aria-describedby="name-msg"><button type="button" class="field-max" id="save" disabled>' + t("p.name.save.short") + '</button></div>' +
      '<div class="field-msg" id="name-msg" aria-live="polite"></div></div></section>' +
      '<section class="sec"><h2>' + t("p.prefs") + '</h2><div class="stack-8"><p class="small" id="l-lang">' + t("lang.label") + "</p>" +
      C.seg(I.langs.map(function (l) { return { label: I.names[l], value: l, on: l === App.lang }; }), { name: "lang", label: t("lang.label") }) + "</div>" +
      '<div class="stack-8"><p class="small">' + t("p.view") + "</p>" + C.seg([{ label: t("h.view.card"), value: "card", on: view !== "term" }, { label: t("h.view.term"), value: "term", on: view === "term" }], { name: "view", label: t("p.view") }) + "</div></section>" +
      '<section class="sec"><div class="list"><button type="button" class="rowlink" id="help-row"><span><b>' + t("pp.help") + "</b></span>" + C.icon("chev", 18) + "</button></div>" +
      '<div class="pfoot">' + C.btn(t("p.logout"), { kind: "danger", id: "logout" }) +
      '<button type="button" class="linkish muted-link" id="upd" aria-label="' + App.esc(t("p.update")) + '">' + t("p.version", { v: M.version }) + "</button></div></section>";
  }
  function helpSheet() {
    App.sheet.open("<h2>" + t("p.help") + '</h2><div class="list">' + linkRow(t("p.how"), "first-run.html?from=profile") +
      '<details class="help help--row"><summary>' + t("p.answers.q") + C.icon("down", 18) + '</summary><div class="help-body">' + t("p.answers.a") + "</div></details>" +
      linkRow(t("p.swap"), "https://cojam.app/migrate/", true) + linkRow(t("p.site"), "https://cojam.app", true) + '</div><div class="sheet-acts">' + C.btn(t("common.close"), { block: true, attrs: "data-sheet-close" }) + "</div>");
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
    /* the line under the field appears only when there is something to fix; what the name is for is behind "?" */
    function check() { var e = validate(name.value); name.closest(".field-box").classList.toggle("is-error", !!e); name.setAttribute("aria-invalid", e ? "true" : "false"); msg.className = "field-msg" + (e ? " is-error" : ""); msg.textContent = e ? t(e) : ""; return !e; }
    function sync() { var ok = check(); save.disabled = !ok || name.value === (M.user.name || ""); }
    name.addEventListener("input", sync); sync();
    name.addEventListener("keydown", function (e) { if (e.key === "Enter" && !save.disabled) save.click(); });
    save.addEventListener("click", function () { if (check()) { M.user.name = name.value; $("#pid-name").textContent = name.value || F.short(M.user.address); App.toast(t("p.name.saved")); save.disabled = true; } else name.focus(); });
    document.addEventListener("seg", function (e) { if (e.detail.name === "lang") App.setLang(e.detail.value); if (e.detail.name === "view") App.store.set("view", e.detail.value); });
    function logout() { App.sheet.open("<h2>" + t("p.logout.h") + '</h2><p class="sheet-lead">' + t("p.logout.b") + '</p><div class="sheet-acts">' + C.btn(t("p.logout"), { block: true, href: "login.html" }) + C.btn(t("common.cancel"), { kind: "ghost", block: true, attrs: "data-sheet-close" }) + "</div>"); }
    $("#logout").addEventListener("click", logout);
    $("#upd").addEventListener("click", function () { App.toast(t("p.uptodate")); });
    $("#help-row").addEventListener("click", helpSheet);
    if (S === "help") helpSheet();
    /* ---- invite code: the first run field in a sheet. Apply checks the code; only a code that passed shows "Link this code", and linking is final */
    function codeSheet(preset) {
      App.sheet.open("<h2>" + t("p.code.h") + '</h2><p class="sheet-lead">' + t("p.code.lead") + '</p><div class="onb-code">' +
        '<div class="field-box field-box--text"><input id="code" name="invite-code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="8" placeholder="' + App.esc(t("o.code.ph")) + '" value="' + (preset || "") + '" aria-label="' + App.esc(t("p.code.label")) + '" aria-describedby="code-msg">' +
        '<button type="button" class="field-max" id="code-apply">' + t("o.code.apply") + '</button></div><div class="onb-code-msg" id="code-msg" aria-live="polite"></div></div>' +
        '<div class="sheet-acts">' + C.btn(t("p.code.link"), { kind: "primary", block: true, id: "code-link", attrs: "hidden" }) + C.btn(t("common.cancel"), { kind: "ghost", block: true, attrs: "data-sheet-close" }) + "</div>");
      var inp = $("#code"), box = inp.closest(".field-box"), cmsg = $("#code-msg"), apply = $("#code-apply"), link = $("#code-link"), okCode = "", checking = false;
      function norm(v) { return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }
      function say(kind, html) { cmsg.className = "onb-code-msg" + (kind ? " is-" + kind : ""); cmsg.innerHTML = html; }
      function idle() { okCode = ""; inp.readOnly = false; box.classList.remove("is-ok", "is-error"); inp.removeAttribute("aria-invalid"); apply.textContent = t("o.code.apply"); apply.disabled = !inp.value; link.hidden = true; say("", ""); }
      function fail(key) { box.classList.add("is-error"); inp.setAttribute("aria-invalid", "true"); apply.disabled = false; say("error", C.icon("warn", 16) + "<span>" + t(key) + "</span>"); }
      function settle(v) {
        checking = false;
        if (v.length < 6) return fail("o.code.short");
        if (v === V.code) return fail("o.code.own");
        if (!V.known[v]) return fail("o.code.unknown");
        okCode = v; inp.readOnly = true; box.classList.remove("is-error"); box.classList.add("is-ok"); inp.removeAttribute("aria-invalid"); apply.disabled = false; apply.textContent = t("o.code.change"); link.hidden = false;
        say("ok", C.icon("check", 16) + "<span>" + t("p.code.ok", { name: '<b translate="no">' + App.esc(V.known[v]) + "</b>" }) + "</span>");
      }
      function check(now) {
        var v = norm(inp.value); inp.value = v; if (!v || checking) return;
        if (S === "code-offline" || App.offline) return fail("o.code.offline");
        if (now) return settle(v);
        checking = true; apply.disabled = true; box.classList.remove("is-error"); say("", '<span class="spin"></span><span>' + t("o.code.checking") + "</span>");
        setTimeout(function () { settle(v); }, 500);
      }
      inp.addEventListener("input", function () { var v = norm(inp.value); if (v !== inp.value) inp.value = v; idle(); });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); check(); } });
      apply.addEventListener("click", function () { if (okCode) { idle(); inp.focus(); inp.select(); } else check(); });
      link.addEventListener("click", function () { if (!okCode) return; inviter = V.known[okCode]; codeState = "linked"; App.sheet.close(); $("#code-slot").innerHTML = codeRow(); App.toast(t("p.code.done", { name: inviter })); });
      idle(); if (preset) check(true);
    }
    document.addEventListener("click", function (e) { if (e.target.closest("button#code-row")) codeSheet(); });
    if (codeState === "open" && S !== "code-open") codeSheet(CODE_PRESET[S]);
    if (S === "logout") logout();
    if (S === "saved") App.toast(t("p.name.saved"));
    if (S === "update") App.toast(t("toast.update"), { btn: t("toast.reload"), fn: function () { location.reload(); } });
    if (S === "session") App.sheet.open('<div class="sheet-state"><div class="sheet-ic">' + C.icon("lock", 28) + "</div><h2>" + t("p.session.h") + '</h2><p class="sheet-lead">' + t("p.session.b") + '</p></div><div class="sheet-acts">' + C.btn(t("p.session.btn"), { kind: "primary", block: true, href: "login.html" }) + "</div>", { closable: false });
  } });
})();
