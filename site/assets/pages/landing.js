// Landing page (direction B): language selector, live window chip, price pill, swap track demo, timeline state,
// contract facts, scroll reveal and pausing of off screen loops. Loads after system.js, i18n/shell.js,
// i18n/landing.js and price.js.
(function () {
  var c = CJ.config, f = CJ.fmt;
  var EXAMPLE = 10000; // the track example: swap 10,000 old CT
  function $(id) { return document.getElementById(id); }
  function set(id, text) { var el = $(id); if (el) el.textContent = text; }

  // ---------- language selector: same store as the other pages (CJ.setLang keeps it, cj:lang tells everyone) ----------
  var sel = $("lang-select");
  if (sel) {
    sel.value = CJ.lang();
    sel.addEventListener("change", function () {
      CJ.setLang(sel.value);
      // A ?lang= in the address would win over the saved choice on reload, so keep it in step.
      if (CJ.params.has("lang") && window.history && history.replaceState) {
        var u = new URL(location.href); u.searchParams.set("lang", sel.value); history.replaceState(null, "", u);
      }
    });
  }

  // ---------- price pill (hidden until the pool exists; ?price=demo shows a labelled sample) ----------
  if (CJ.price && CJ.price.mount) CJ.price.mount($("hero-price"));

  // ---------- swap track demo ----------
  var track = $("track"), play = $("play"), on = false;
  function paintTrack() {
    var got = on ? EXAMPLE : EXAMPLE * c.instantPercent / 100;
    set("tk-ex", CJ.t("how.track.ex", { n: f.amount(EXAMPLE, 0) }));
    set("tk-now", f.amount(got, 0));
    set("tk-all", f.amount(EXAMPLE, 0));
    set("tk-live", CJ.t("how.track.aria", { got: f.amount(got, 0), all: f.amount(EXAMPLE, 0) }));
  }
  if (play && track) play.addEventListener("click", function () {
    on = !on;
    track.classList.toggle("go", on);
    play.setAttribute("aria-pressed", on ? "true" : "false");
    paintTrack();
  });

  function paint() {
    if (sel) sel.value = CJ.lang();
    document.documentElement.lang = CJ.lang();

    // Live chip: the same window state and whole days left as the swap app and the status page.
    var ws = CJ.windowState(), n = CJ.now(), live;
    if (ws === "open") {
      var left = Math.max(0, CJ.daysLeft());
      live = CJ.t(left === 1 ? "hero.live.open.one" : "hero.live.open", { n: f.amount(left, 0) });
    } else if (ws === "upcoming") {
      var until = Math.ceil((c.windowStart - n) / CJ.DAY);
      live = CJ.t(until === 1 ? "hero.live.soon.one" : "hero.live.soon", { date: f.date(c.windowStart), n: f.amount(until, 0) });
    } else {
      live = CJ.t("hero.live.closed");
    }
    set("live-text", live);
    var chip = $("live"); if (chip) chip.classList.toggle("is-stale", ws !== "open");

    paintTrack();

    // Timeline: dates, done / now / later per event, and how far into the year we are.
    set("tl-open", f.date(c.windowStart));
    set("tl-close", f.date(c.windowEnd));
    var states = ws === "upcoming" ? ["later", "later", "later", "later"] : ws === "open" ? ["done", "now", "later", "later"] : ["done", "done", "done", "now"];
    document.querySelectorAll("#tl-list .tl-item").forEach(function (li, i) {
      var st = states[i] || "later";
      li.classList.remove("is-done", "is-now", "is-later"); li.classList.add("is-" + st);
      var tag = li.querySelector(".tl-state"); if (tag) tag.textContent = CJ.t("tl." + st);
    });
    var prog = $("tl-progress"), total = Math.round((c.windowEnd - c.windowStart) / CJ.DAY);
    if (prog) {
      prog.hidden = ws === "upcoming";
      var day = ws === "open" ? Math.min(total, Math.floor((n - c.windowStart) / CJ.DAY) + 1) : total;
      var fill = $("tl-fill"); if (fill) fill.style.width = (day / total * 100).toFixed(2) + "%";
      set("tl-day", CJ.t("tl.day", { d: f.amount(day, 0), t: f.amount(total, 0) }));
    }

    // Contract facts: the exact supply, never rounded.
    var sup = $("ct-supply");
    if (sup) sup.innerHTML = CJ.t("ct.supply.v", { n: '<span class="num-full">' + c.newToken.supplyText + "</span>" });

    // The concept row scrolls sideways on phones: give it a name so keyboard users know what they reached.
    var cards = $("cards");
    if (cards) {
      if (mq.matches) { cards.setAttribute("tabindex", "0"); cards.setAttribute("aria-label", CJ.t("fu.row")); }
      else { cards.removeAttribute("tabindex"); cards.removeAttribute("aria-label"); }
    }
  }
  var mq = window.matchMedia("(max-width: 899px)");
  if (mq.addEventListener) mq.addEventListener("change", paint); else if (mq.addListener) mq.addListener(paint);
  document.addEventListener("cj:lang", paint);
  document.addEventListener("cj:window", paint);
  if (CJ.menu) CJ.menu.init({ host: document.querySelector(".nav .end"), header: document.querySelector("header.nav"), root: "", current: "home" }); // live window dates read from the swap contract (system.js)
  paint();
  CJ.ready();

  // ---------- scroll reveal ----------
  var rvs = [].slice.call(document.querySelectorAll(".rv"));
  function revealAll() { rvs.forEach(function (e) { e.classList.add("in"); }); }
  // Captures and audits call this so nothing is hidden in a full page shot.
  CJ.motion = CJ.motion || {}; CJ.motion.revealAll = revealAll;
  var root = document.documentElement;
  if (!root.classList.contains("rv-on") || !("IntersectionObserver" in window)) revealAll();
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    rvs.forEach(function (e) { io.observe(e); });
  }

  // ---------- pause loops off screen ----------
  // The hero (ping, stickers, badge, arrows), the ticker and the spinning mark only animate while they are in view.
  if ("IntersectionObserver" in window) {
    var loops = [document.querySelector(".hero"), document.querySelector(".mq-clip"), document.querySelector(".future")].filter(Boolean);
    var lo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("is-off", !e.isIntersecting); });
    });
    loops.forEach(function (el) { lo.observe(el); });
  }
})();
