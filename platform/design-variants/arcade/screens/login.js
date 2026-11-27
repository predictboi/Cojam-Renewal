/* Log in: the cover of the paper. Nameplate and language on the top line, the headline in the slab, the form on a fresh sheet under a heavy rule,
   then three facts between hairlines. Steps: email, code, setting up. */
(function () {
  var t = App.t, S = App.state, M = MOCK, $ = App.$;
  var CODE = ["code", "verifying", "wrong", "short", "expired"], SETUP = ["setup", "returning", "walletfail", "refused"];
  var email = { bademail: "minji@naver", unsupported: "minji@proton.me", typo: "minji@gmial.com", empty: "", "": "", offline: "" }[S];
  if (email === undefined) email = M.user.email;
  var step = CODE.indexOf(S) >= 0 ? "code" : SETUP.indexOf(S) >= 0 ? "setup" : "email";
  var off = S === "offline", providers = '<span translate="no">' + M.providerNames + "</span>";
  function dist(a, b) {
    var d = [], i, j; for (i = 0; i <= a.length; i++) d[i] = [i]; for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function suggest(domain) {
    var best = null, bd = 3;
    M.emailProviders.forEach(function (p) { var d = dist(domain, p); if (domain.split(".")[0] === p.split(".")[0]) d = Math.min(d, 1); if (d > 0 && d < bd) { bd = d; best = p; } });
    return best;
  }
  function emailErr(v) {
    if (!v) return { text: t("a.email.empty") };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { text: t("a.email.bad") };
    var dom = v.split("@")[1].toLowerCase();
    if (M.emailProviders.indexOf(dom) < 0) { var sg = suggest(dom); return sg ? { typo: sg, fixed: (v.split("@")[0] + "@" + sg).toLowerCase() } : { note: true }; }
    return null;
  }
  function terms() { return '<p class="fine">' + t("a.fine", { terms: '<a href="#terms">' + t("a.terms") + "</a>", privacy: '<a href="#privacy">' + t("a.privacy") + "</a>" }) + "</p>"; }
  function emailView() {
    var sending = S === "sending", err = S === "empty" || S === "bademail" || S === "unsupported" || S === "typo" ? emailErr(email) : null;
    var msg = err && err.text ? err.text : off ? t("a.offline") : "";
    var bad = !!err && !err.typo;
    return '<form class="stack" id="f-email" novalidate><div class="field"><div class="field-label"><label for="email"><b>' + t("a.email.label") + '</b></label></div>' +
      '<div class="field-box field-box--text' + (bad ? " is-error" : "") + (off ? " is-off" : "") + '">' + C.icon("mail", 20) + '<input id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="you@gmail.com" value="' + App.esc(email) + '" aria-describedby="email-msg email-cap"' + (bad ? ' aria-invalid="true"' : "") + (off || sending ? " disabled" : "") + "></div>" +
      '<div id="email-fb" aria-live="polite">' +
      (msg ? '<div class="field-msg' + (bad ? " is-error" : "") + '" id="email-msg"><span>' + msg + "</span></div>" : "") +
      (err && err.typo ? '<div class="typo" id="typo"><span>' + t("a.email.typo", { domain: '<b translate="no">' + err.typo + "</b>" }) + "</span>" + C.btn(t("a.email.typo.fix", { email: '<span translate="no">' + App.esc(err.fixed) + "</span>" }), { sm: true, wrap: true, attrs: 'data-fix-email="' + App.esc(err.fixed) + '"' }) + "</div>" : "") +
      (err && err.note ? '<div class="note note-warn" role="alert" id="prov-note">' + C.icon("warn", 18) + '<div class="note-body"><b>' + t("a.email.unsupported") + "</b><span>" + t("a.email.supported", { list: providers }) + "</span></div></div>" : "") + "</div>" +
      (err && err.note ? "" : '<p class="field-cap" id="email-cap">' + t("a.email.cap", { list: providers }) + "</p>") + "</div>" +
      '<button type="submit" id="send" class="btn btn-primary btn-block' + (sending ? " is-loading" : "") + '"' + (off || (err && err.note) ? " disabled" : "") + ">" + (sending ? '<span class="spin"></span>' : "") + "<span>" + t(sending ? "a.email.sending" : "a.email.btn") + "</span></button></form>" +
      C.help(t("a.help.q"), "<p>" + t("a.help.a") + "</p>") + terms();
  }
  var code0 = S === "short" ? "418" : "";
  function codeView() {
    var err = S === "wrong" ? t("a.code.wrong") : S === "short" ? t("a.code.short") : S === "expired" ? t("a.code.expired") : "", busy = S === "verifying";
    return '<form class="stack" id="f-code" novalidate><div class="stack-8"><h2>' + t("a.code.h") + '</h2><p class="muted small">' + t("a.code.body", { email: '<b translate="no">' + App.esc(email) + "</b>" }) + "</p></div>" +
      '<div class="field"><div class="field-box field-box--code' + (err && S !== "short" ? " is-error" : "") + '"><input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="______" value="' + (S === "wrong" ? "418205" : S === "short" ? code0 : busy ? "418250" : "") + '" aria-label="' + App.esc(t("a.code.label")) + '" aria-describedby="code-msg"' + (err && S !== "short" ? ' aria-invalid="true"' : "") + (busy ? " disabled" : "") + "></div>" +
      '<div class="field-msg' + (err && S !== "short" ? " is-error" : "") + '" id="code-msg" aria-live="polite">' + (err ? "<span>" + err + "</span>" : "") + "</div></div>" +
      '<button type="submit" class="btn btn-primary btn-block' + (busy ? " is-loading" : "") + '"' + (S === "expired" ? " disabled" : "") + ">" + (busy ? '<span class="spin"></span>' : "") + "<span>" + t(busy ? "a.code.verifying" : "a.code.btn") + "</span></button></form>" +
      '<div class="stack-8"><p class="small muted" id="resend-in"' + (S === "expired" || resendLeft() <= 0 ? " hidden" : "") + ">" + t("a.code.resendin", { s: '<b id="resend-s">' + resendLeft() + "</b>" }) + '</p><div class="row-between"><button type="button" class="linkish" id="resend"' + (S === "expired" || resendLeft() <= 0 ? "" : " disabled") + ">" + t("a.code.resend") + '</button><button type="button" class="linkish" id="change">' + t("a.code.change") + "</button></div>" +
      '<p class="small muted">' + t("a.code.tip") + "</p></div>";
  }
  function setupView() {
    var out = C.btn(t("p.logout"), { block: true, id: "change" }), retry = C.btn(t("common.retry"), { kind: "primary", block: true, id: "retry" });
    if (S === "refused") return '<div class="setup"><div class="sheet-ic is-bad">' + C.icon("warn", 28) + "</div><h2>" + t("a.refused.h") + '</h2><p class="muted" role="alert">' + t("a.setup.refused", { list: providers }) + "</p></div>" + out;
    if (S === "walletfail") return '<div class="setup"><div class="sheet-ic is-bad">' + C.icon("x", 28) + '</div><h2 role="alert">' + t("a.setup.fail") + "</h2></div>" + retry;
    var back = S === "returning", done = back ? 2 : 0;
    return '<div class="stack-8" role="status"><h2>' + t("a.setup.h") + '</h2><p class="muted small">' + t(back ? "a.setup.body2" : "a.setup.body") + "</p></div>" +
      '<ol class="txsteps" id="setup-steps" data-done="' + done + '">' + ["a.setup.s1", "a.setup.s2", "a.setup.s3"].map(function (k, i) {
        var st = i < done ? "done" : i === done ? "now" : "wait";
        return '<li class="is-' + st + '"><span class="n">' + (st === "done" ? C.icon("check", 16) : i + 1) + "</span><span>" + t(k) + '</span><span class="st">' + (st === "now" ? '<span class="spin"></span>' : "") + "</span></li>";
      }).join("") + "</ol>";
  }
  function view() { return step === "email" ? emailView() : step === "code" ? codeView() : setupView(); }
  function headline() { return step === "email" ? t("a.h1") : step === "code" ? t("a.code.h1") : t("a.setup.h1"); }
  var facts = '<ul class="facts" id="facts"><li>' + C.icon("bolt", 18) + t("a.fact.1") + "</li><li>" + C.icon("shield", 18) + t("a.fact.2") + "</li><li>" + C.icon("swap", 18) + t("a.fact.3") + "</li></ul>";
  var raw = '<div class="auth"><div class="gate-bar">' + C.logo(true) + C.lang() + '</div>' + C.dateline("<span>" + t("d.next.at") + "</span>") +
    '<div class="auth-main"><div class="stack-12"><h1 id="h1">' + headline() + '</h1><p class="auth-lede" id="lede"' + (step === "email" ? "" : " hidden") + ">" + t("a.lede") + '</p></div><section class="panel" id="panel">' + view() + "</section>" + facts + "</div></div>";

  function runSetup() {
    var ol = $("#setup-steps"); if (!ol) return;
    var lis = App.$$("li", ol), i = +ol.getAttribute("data-done");
    (function next() {
      if (i > 0) { lis[i - 1].className = "is-done"; lis[i - 1].querySelector(".n").innerHTML = C.icon("check", 16); lis[i - 1].querySelector(".st").innerHTML = ""; }
      if (i === lis.length) { setTimeout(function () { location.href = S === "returning" ? "home.html" : "first-run.html"; }, 500); return; }
      lis[i].className = "is-now"; lis[i].querySelector(".st").innerHTML = '<span class="spin"></span>'; i++; setTimeout(next, 1000);
    })();
  }
  function paint(keepFocus) {
    $("#panel").innerHTML = view(); $("#h1").textContent = headline(); $("#lede").hidden = step !== "email"; $("#facts").hidden = step === "setup";
    document.title = headline() + " | Cojam Daily";
    bind(); var f = $("#panel input:not([disabled])"); if (f && keepFocus !== false) { f.focus(); try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {} }
  }
  function send() { S = "sending"; paint(); setTimeout(function () { step = "code"; S = "code"; countdown(); paint(); }, 900); }
  function bind() {
    var fe = $("#f-email"), fc = $("#f-code");
    if (fe) {
      var em = $("#email");
      fe.addEventListener("submit", function (e) {
        e.preventDefault(); email = em.value.trim(); var err = emailErr(email);
        if (err) { S = err.typo ? "typo" : err.note ? "unsupported" : email ? "bademail" : "empty"; paint(); return; }
        send();
      });
      em.addEventListener("input", function () {
        if (S === "") return; S = ""; email = em.value;
        var fb = $("#email-fb"); if (fb) fb.innerHTML = ""; em.removeAttribute("aria-invalid"); em.closest(".field-box").classList.remove("is-error");
        var sb = $("#send"); if (sb && !off) sb.disabled = false;
      });
      fe.addEventListener("click", function (e) { var fx = e.target.closest("[data-fix-email]"); if (!fx) return; e.preventDefault(); email = fx.getAttribute("data-fix-email"); send(); });
    }
    if (fc) {
      var code = $("#code");
      var submit = function () { S = "verifying"; paint(); setTimeout(function () { step = "setup"; S = "setup"; paint(); runSetup(); }, 900); };
      code.addEventListener("input", function () {
        code.value = code.value.replace(/\D/g, "").slice(0, 6);
        if (S === "short" || S === "wrong") { S = "code"; var m = $("#code-msg"); m.innerHTML = ""; m.className = "field-msg"; code.closest(".field-box").classList.remove("is-error"); }
        if (code.value.length === 6) submit();
      });
      fc.addEventListener("submit", function (e) { e.preventDefault(); if (code.value.length < 6) { code0 = code.value; S = "short"; paint(); return; } submit(); });
    }
    var ch = $("#change"); if (ch) ch.addEventListener("click", function () { step = "email"; S = ""; paint(); });
    var rs = $("#resend"); if (rs) rs.addEventListener("click", function () { S = "code"; countdown(); paint(); });
    var rt = $("#retry"); if (rt) rt.addEventListener("click", function () { S = "setup"; paint(); runSetup(); });
  }
  var cdT, resendAt = 0;
  function resendLeft() { return resendAt ? Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)) : 60; }
  function countdown() {
    clearInterval(cdT); resendAt = Date.now() + 60000;
    cdT = setInterval(function () {
      var el = $("#resend-in"), n = $("#resend-s"), rs = $("#resend"), s = resendLeft();
      if (step !== "code") { clearInterval(cdT); return; }
      if (s <= 0) { clearInterval(cdT); if (el) el.hidden = true; if (rs) rs.disabled = false; } else if (n) n.textContent = s;
    }, 250);
  }
  App.mount({ bare: true, docTitle: headline(), raw: raw, after: function () {
    $("#facts").hidden = step === "setup";
    bind(); if (step === "code" && S !== "expired") countdown(); if (S === "setup" || S === "returning") runSetup();
  } });
})();
