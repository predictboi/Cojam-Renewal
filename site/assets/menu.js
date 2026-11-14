// Phone menu: a hamburger next to the Connect button opens a panel with the page links and the language choice.
// Shared by the landing (its own header) and the app pages (shell.js header). Desktop keeps the inline nav.
//   CJ.menu.init({ host: <element the button goes into>, header: <header element>, root: "../", current: "swap" })
(function () {
  var CJ = window.CJ; if (!CJ) return;
  var LANGS = [["en", "EN"], ["ko", "한국어"], ["ja", "日本語"]];
  var PAGES = [["swap", "migrate/", "nav.swap"], ["status", "status/", "nav.status"], ["docs", "docs/", "nav.docs"]];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function init(o) {
    if (!o || !o.host || document.getElementById("cj-menu")) return;
    var root = o.root || "", header = o.header || o.host.closest("header");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "cj-burger"; btn.id = "cj-burger";
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "cj-menu");
    btn.innerHTML = '<span class="cj-burger-lines" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only"></span>';
    o.host.appendChild(btn);
    var panel = document.createElement("div");
    panel.id = "cj-menu"; panel.className = "cj-menu"; panel.hidden = true;
    document.body.appendChild(panel);

    function paint() {
      btn.querySelector(".sr-only").textContent = CJ.t(btn.getAttribute("aria-expanded") === "true" ? "nav.menu.close" : "nav.menu");
      var cur = CJ.lang();
      panel.innerHTML =
        '<nav class="cj-menu-links" aria-label="' + esc(CJ.t("nav.main")) + '">' +
          '<a href="' + root + '"' + (o.current === "home" ? ' aria-current="page"' : "") + "><span>" + esc(CJ.t("nav.homeShort")) + "</span></a>" +
          PAGES.map(function (p) {
            return '<a href="' + root + p[1] + '"' + (o.current === p[0] ? ' aria-current="page"' : "") + "><span>" + esc(CJ.t(p[2])) + "</span></a>";
          }).join("") +
        "</nav>" +
        '<p class="cj-menu-k">' + esc(CJ.t("nav.lang")) + "</p>" +
        '<div class="cj-menu-lang" role="group" aria-label="' + esc(CJ.t("nav.lang")) + '">' +
          LANGS.map(function (l) { return '<button type="button" data-lang="' + l[0] + '" aria-pressed="' + (l[0] === cur) + '" lang="' + l[0] + '">' + l[1] + "</button>"; }).join("") +
        "</div>";
    }
    function place() { var r = header ? header.getBoundingClientRect() : { bottom: 64 }; panel.style.top = Math.max(8, Math.round(r.bottom) + 8) + "px"; }
    function open() { place(); panel.hidden = false; btn.setAttribute("aria-expanded", "true"); document.documentElement.classList.add("cj-menu-open"); paint(); var a = panel.querySelector("a,button"); if (a) a.focus({ preventScroll: true }); }
    function close(focus) { if (panel.hidden) return; panel.hidden = true; btn.setAttribute("aria-expanded", "false"); document.documentElement.classList.remove("cj-menu-open"); paint(); if (focus) btn.focus(); }
    btn.addEventListener("click", function (e) { e.stopPropagation(); panel.hidden ? open() : close(true); });
    panel.addEventListener("click", function (e) {
      var l = e.target.closest("[data-lang]");
      if (l) {
        CJ.setLang(l.getAttribute("data-lang"));
        document.querySelectorAll("select#cj-lang-select, select#lang-select").forEach(function (s) { s.value = CJ.lang(); });
        close(true); return;
      }
      if (e.target.closest("a")) close(false);
    });
    document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(true); });
    window.addEventListener("resize", function () { if (!panel.hidden) place(); });
    window.addEventListener("scroll", function () { if (!panel.hidden) place(); }, { passive: true });
    document.addEventListener("cj:lang", paint);
    paint();
  }
  CJ.menu = { init: init };
})();
