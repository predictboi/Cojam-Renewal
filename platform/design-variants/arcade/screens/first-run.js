/* First run: three pages. Each has a figure on a fresh sheet (built from the product's own pieces: the card, the five boxes, the two figures),
   a headline in the slab and one sentence. The optional invite code and the language sit on the first page. */
(function () {
  var t = App.t, S = App.state, M = MOCK, $ = App.$, I = CJ_I18N;
  var n = +S >= 1 && +S <= 3 ? +S : 1;
  var from = new URLSearchParams(location.search).get("from"), exit = from === "profile" ? "profile.html" : "home.html?state=fresh";
  function art(i) {
    if (i === 1) return '<div class="art-fig"><div class="art-cards" aria-hidden="true"><i></i><i><span class="art-img"></span><span class="art-ch"><b></b><b></b></span></i></div>' + C.day5(["done", "done", "pend", "", ""], { label: " " }) + "</div>";
    if (i === 2) return '<div class="art-fig"><div class="two"><div><p class="fig">+100P</p><p class="small muted">' + t("o.2.a") + '</p></div><div><p class="fig">+50P</p><p class="small muted">' + t("o.2.c") + "</p></div></div>" + C.day5(["done", "done", "done", "done", "done"], { label: " " }) + "</div>";
    return '<div class="art-swap" aria-hidden="true"><span class="art-coin">1,000P</span>' + C.icon("right", 28) + '<span class="art-coin">1 CT</span></div>';
  }
  function panel(i) {
    return '<li class="onb"' + (i === n ? "" : " hidden") + ' data-panel="' + i + '"><div class="onb-art">' + art(i) + '</div><div class="stack-12"><h1 tabindex="-1">' + t("o." + i + ".h") + '</h1><p class="auth-lede">' + t("o." + i + ".b") + "</p></div></li>";
  }
  var V = M.invite, PRESET = { "code-valid": V.code, "code-unknown": "KAIA999" }, codeOpen = /^code/.test(S), codeOk = "";
  function codeBox() {
    return '<div class="onb-code" id="codebox"' + (n === 1 && from !== "profile" ? "" : " hidden") + '><button type="button" class="onb-code-open" id="code-open"' + (codeOpen ? " hidden" : "") + ">" + t("o.code.q") + C.icon("down", 18) + "</button>" +
      '<div class="onb-code" id="code-form"' + (codeOpen ? "" : " hidden") + '><div class="onb-code-top"><label for="code">' + t("o.code.q") + "<small>" + t("o.code.opt") + '</small></label><button type="button" class="onb-code-skip" id="code-skip">' + t("o.code.skip") + "</button></div>" +
      '<div class="field-box field-box--text"><input id="code" name="invite-code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="8" placeholder="' + App.esc(t("o.code.ph")) + '" value="' + (PRESET[S] || "") + '" aria-describedby="code-msg">' +
      '<button type="button" class="field-max" id="code-apply">' + t("o.code.apply") + '</button></div><div class="onb-code-msg" id="code-msg" aria-live="polite"></div></div></div>';
  }
  var raw = '<div class="auth auth--onb"><div class="gate-bar"><div class="dots" role="img" aria-label="' + t("o.step", { n: n }) + '" id="dots">' + [1, 2, 3].map(function (i) { return "<i" + (i === n ? ' class="is-on"' : "") + "></i>"; }).join("") + "</div>" +
    '<a class="linkish" href="' + exit + '">' + t("o.skip") + '</a></div><div class="onb-wrap"><ol id="panels">' + [1, 2, 3].map(panel).join("") + "</ol>" +
    '<div class="onb-foot">' + codeBox() + '<div id="langrow"' + (n === 1 ? "" : " hidden") + ">" + C.seg(I.langs.map(function (l) { return { label: I.names[l], value: l, on: l === App.lang }; }), { name: "lang", label: t("lang.label") }) + "</div>" +
    C.btn(t(n === 3 ? "o.start" : "o.next"), { kind: "primary", block: true, id: "next", iconEnd: "right" }) +
    '<p class="row setup-line" id="setup-line" role="status"><span class="spin"></span><span>' + t("a.setup.h") + "</span></p></div></div></div>";
  App.mount({ bare: true, docTitle: t("o.1.h"), raw: raw, after: function () {
    var ready = from === "profile", waiting = false, line = $("#setup-line");
    function setReady() { ready = true; line.innerHTML = C.icon("check", 16) + "<span>" + t("o.3.wait") + "</span>"; if (waiting) location.href = exit; }
    if (ready) line.hidden = true; else setTimeout(setReady, 3200);
    function leave() { if (ready) { location.href = exit; return; } waiting = true; var b = $("#next"); b.classList.add("is-loading"); b.innerHTML = '<span class="spin"></span><span>' + t("a.setup.h") + "</span>"; }
    function go(i) {
      if (i < 1) return; if (i > 3) { leave(); return; }
      n = i; App.$$("[data-panel]").forEach(function (p) { p.hidden = +p.getAttribute("data-panel") !== n; });
      App.$$("#dots i").forEach(function (d, k) { d.classList.toggle("is-on", k === n - 1); }); $("#dots").setAttribute("aria-label", t("o.step", { n: n }));
      $("#langrow").hidden = n !== 1; $("#codebox").hidden = n !== 1 || from === "profile"; $("#next span").textContent = t(n === 3 ? "o.start" : "o.next");
      var h = $('[data-panel="' + n + '"] h1'); if (h) h.focus({ preventScroll: true });
    }
    var inp = $("#code"), box = inp.closest(".field-box"), msg = $("#code-msg"), apply = $("#code-apply"), form = $("#code-form"), opener = $("#code-open"), checking = false;
    function norm(v) { return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }
    function say(kind, html) { msg.className = "onb-code-msg" + (kind ? " is-" + kind : ""); msg.innerHTML = html; }
    function idle() { codeOk = ""; inp.readOnly = false; box.classList.remove("is-ok", "is-error"); inp.removeAttribute("aria-invalid"); apply.textContent = t("o.code.apply"); apply.disabled = !inp.value; say("help", t("o.code.help")); }
    function fail(key) { box.classList.add("is-error"); inp.setAttribute("aria-invalid", "true"); apply.disabled = false;
      say("error", C.icon("warn", 16) + "<div><span>" + t(key) + '</span><button type="button" class="linkish" id="code-without">' + t("o.code.without") + '</button><small class="onb-code-later">' + t("o.code.later") + "</small></div>"); }
    function settle(v, then) {
      checking = false;
      if (v.length < 6) return fail("o.code.short");
      if (v === V.self) return fail("o.code.own");
      if (!V.known[v]) return fail("o.code.unknown");
      codeOk = v; inp.readOnly = true; box.classList.remove("is-error"); box.classList.add("is-ok"); inp.removeAttribute("aria-invalid"); apply.disabled = false; apply.textContent = t("o.code.change");
      say("ok", C.icon("check", 16) + "<span>" + t("o.code.ok", { name: '<b translate="no">' + App.esc(V.known[v]) + "</b>", w: V.welcome }) + "</span>");
      if (then) then();
    }
    function check(then, now) {
      var v = norm(inp.value); inp.value = v; if (!v || checking) return;
      if (now) return settle(v, then);
      checking = true; apply.disabled = true; box.classList.remove("is-error"); say("", '<span class="spin"></span><span>' + t("o.code.checking") + "</span>");
      setTimeout(function () { settle(v, then); }, 500);
    }
    function closeCode() { inp.value = ""; idle(); form.hidden = true; opener.hidden = false; }
    opener.addEventListener("click", function () { opener.hidden = true; form.hidden = false; idle(); inp.focus(); });
    $("#code-skip").addEventListener("click", function () { closeCode(); opener.focus(); });
    inp.addEventListener("input", function () { var v = norm(inp.value); if (v !== inp.value) inp.value = v; idle(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); check(); } });
    apply.addEventListener("click", function () { if (codeOk) { idle(); inp.focus(); inp.select(); } else check(); });
    msg.addEventListener("click", function (e) { if (e.target.closest("#code-without")) { closeCode(); go(n + 1); } });
    idle(); if (PRESET[S]) check(null, true);
    $("#next").addEventListener("click", function () {
      if (n === 1 && !form.hidden && inp.value && !codeOk) { if (box.classList.contains("is-error")) inp.focus(); else check(function () { go(2); }); return; }
      go(n + 1);
    });
    document.addEventListener("seg", function (e) { if (e.detail.name === "lang") { var u = new URL(location.href); u.searchParams.set("state", n); history.replaceState(null, "", u); I.setLang(e.detail.value); } });
    var x0 = null, pn = $("#panels");
    pn.addEventListener("pointerdown", function (e) { x0 = e.clientX; });
    pn.addEventListener("pointerup", function (e) { if (x0 === null) return; var d = e.clientX - x0; x0 = null; if (d < -60) $("#next").click(); else if (d > 60) go(n - 1); });
    document.addEventListener("keydown", function (e) { if (e.target && e.target.tagName === "INPUT") return; if (e.key === "ArrowRight") go(n + 1); if (e.key === "ArrowLeft") go(n - 1); });
  } });
})();
