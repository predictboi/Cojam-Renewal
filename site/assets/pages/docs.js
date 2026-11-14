// Docs page: dynamic lines (window dates, supply), the lock example track, and the table of contents.
(function () {
  var C = CJ.config, F = CJ.fmt, t = CJ.t;
  var $ = function (id) { return document.getElementById(id); };

  function paint() {
    $("dc-window").textContent = t("docs.lock.window", { start: F.date(C.windowStart), end: F.date(C.windowEnd) });
    $("dc-supply").textContent = t("docs.c.supply", { supply: C.newToken.supplyText });
    CJ.track($("dc-track"), null, { amount: 12500, demoDays: 3.4 });
  }
  document.addEventListener("cj:lang", paint);
  paint();
  CJ.ready();

  // Row icons (fixed size boxes in the markup, so filling them moves nothing).
  document.querySelectorAll("[data-ico]").forEach(function (el) { el.innerHTML = CJ.icon(el.getAttribute("data-ico"), 20); });

  // Special cases: open on wide screens, one tap each on phones (the inline script under the list closes them before
  // first paint). A link to a case opens it.
  var cases = [].slice.call(document.querySelectorAll(".dc-case"));
  var narrow = window.matchMedia("(max-width: 599px)");
  function syncCases() {
    cases.forEach(function (d) {
      var sm = d.querySelector("summary");
      if (narrow.matches) sm.removeAttribute("tabindex"); else { d.open = true; sm.setAttribute("tabindex", "-1"); }
    });
  }
  cases.forEach(function (d) { d.querySelector("summary").addEventListener("click", function (e) { if (!narrow.matches) e.preventDefault(); }); });
  syncCases();
  if (narrow.addEventListener) narrow.addEventListener("change", syncCases);
  function openTarget() { var d = location.hash && document.getElementById(location.hash.slice(1)); if (d && d.classList.contains("dc-case")) d.open = true; }
  window.addEventListener("hashchange", openTarget);

  // Mobile jump list closes after a choice.
  var jump = document.querySelector(".dc-jump");
  if (jump) jump.addEventListener("click", function (e) { if (e.target.closest("a")) jump.removeAttribute("open"); });

  // Desktop table of contents: mark the section being read as the current one.
  var links = [].slice.call(document.querySelectorAll(".dc-toc a[data-toc]"));
  var secs = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
  function mark(id) {
    links.forEach(function (a) {
      if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
  }
  function spy() {
    var line = 140, cur = secs[0];
    secs.forEach(function (s) { if (s.getBoundingClientRect().top - line <= 0) cur = s; });
    // at the very bottom the last section is current even if short
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = secs[secs.length - 1];
    if (cur) mark(cur.id);
  }
  var raf = 0;
  window.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; spy(); }); }, { passive: true });
  window.addEventListener("hashchange", spy);
  spy();

  // Fix links from the swap app open this page at an anchor (#gas, #exchange, #pool, #special). The browser
  // jumps before fonts, the lock track and late layout settle, so land on the target again once they have.
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) {
    var settle = function () { requestAnimationFrame(function () { target.scrollIntoView({ block: "start", behavior: "auto" }); spy(); }); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(settle, 120); });
    window.addEventListener("load", function () { setTimeout(settle, 120); });
  }
})();
