// Landing page behaviour: hero track, how it works icons, timeline dates, contract facts, concept preview figures.
(function () {
  var c = CJ.config, f = CJ.fmt;
  function set(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
  function ct(n, dp) { return CJ.t("fu.ct", { n: f.amount(n, dp) }); }

  function paint() {
    // Live window state, worked out the same way as the swap app and the status page (whole days, rounded down).
    var ws = CJ.windowState(), n = CJ.now(), live, sub, dates = { start: f.date(c.windowStart), end: f.date(c.windowEnd) };
    // a date never breaks across lines (Japanese and Korean would split it anywhere)
    var nb = function (d) { return '<span class="hero-date">' + d + "</span>"; }, datesHtml = { start: nb(dates.start), end: nb(dates.end) };
    if (ws === "open") {
      var left = CJ.daysLeft ? CJ.daysLeft() : Math.floor((c.windowEnd - n) / CJ.DAY);
      live = CJ.t(left === 1 ? "hero.live.open.one" : "hero.live.open", { n: f.amount(left, 0) });
      sub = CJ.t("hero.window", datesHtml);
    } else if (ws === "upcoming") {
      var until = Math.ceil((c.windowStart - n) / CJ.DAY);
      live = CJ.t(until === 1 ? "hero.live.soon.one" : "hero.live.soon", { date: dates.start, n: f.amount(until, 0) });
      sub = CJ.t("hero.window", datesHtml);
    } else {
      live = CJ.t("hero.live.closed");
      sub = CJ.t("hero.window.closed", datesHtml);
    }
    set("hero-live", live);
    var hw = document.getElementById("hero-window"); if (hw) hw.innerHTML = sub;
    var dot = document.getElementById("hero-dot"); if (dot) dot.classList.toggle("is-stale", ws !== "open");
    var tr = document.getElementById("hero-track");
    if (tr) CJ.track(tr, null, { large: true, amount: 125000, demoDays: 3.4 });

    // How it works: the steps carry the icons; the hero card holds the one track on this page.
    [["how-ico-1", "swap"], ["how-ico-2", "wallet"], ["how-ico-3", "lock"], ["how-ico-4", "unlock"]].forEach(function (p) {
      var el = document.getElementById(p[0]); if (el) el.innerHTML = CJ.icon(p[1], 20);
    });
    var fee = document.getElementById("how-fee-ico"); if (fee) fee.innerHTML = CJ.icon("wallet", 18);
    document.querySelectorAll(".how .help > summary").forEach(function (s) { if (!s.firstChild) s.innerHTML = CJ.icon("help", 18); });
    // Keep each help toggle on the line of the last word before it, so it never drops onto a line of its own.
    // The sentence span keeps its data-i18n key (a language switch rewrites it in full); the last word moves into a nowrap tail.
    document.querySelectorAll(".how-body").forEach(function (body) {
      var span = body.querySelector("[data-i18n]"), help = body.querySelector(".help"); if (!span || !help) return;
      var text = CJ.t(span.getAttribute("data-i18n")), m = /\s(\S+)\s*$/.exec(text);
      var cut = m && CJ.lang() !== "ja" ? m.index + 1 : Math.max(0, text.length - 3); // Japanese has no spaces: keep the last 3 characters
      var tail = body.querySelector(".how-tail");
      if (!tail) {
        // drop the markup whitespace around the toggle: in Japanese it would show as a space inside the sentence
        [].slice.call(body.childNodes).forEach(function (n) { if (n.nodeType === 3 && !n.textContent.trim()) body.removeChild(n); });
        tail = document.createElement("span"); tail.className = "how-tail"; body.appendChild(tail);
      }
      span.textContent = text.slice(0, cut);
      tail.textContent = text.slice(cut);
      tail.appendChild(help);
    });

    document.querySelectorAll(".faq-item > summary").forEach(function (s) { if (!s.querySelector("svg")) s.insertAdjacentHTML("beforeend", CJ.icon("chevron", 18)); });

    // Timeline
    set("tl-open", f.date(c.windowStart));
    set("tl-close", f.date(c.windowEnd));
    // Each event is done, now or later, from the live window state; the key above the list says what the dots mean.
    var states = ws === "upcoming" ? ["later", "later", "later", "later"] : ws === "open" ? ["done", "now", "later", "later"] : ["done", "done", "done", "now"];
    document.querySelectorAll("#tl-list .tl-item").forEach(function (li, i) {
      var st = states[i] || "later";
      li.classList.remove("is-done", "is-now", "is-later"); li.classList.add("is-" + st);
      var tag = li.querySelector(".tl-state"); if (!tag) return;
      tag.className = "tl-state" + (st === "now" ? " tag tag-sky" : "");
      tag.textContent = CJ.t("tl." + st);
    });

    // Contract facts
    // Exact supply as text; motion.js counts up to it the first time it is seen and ends on this exact text.
    var sup = document.getElementById("ct-supply");
    if (sup) sup.innerHTML = CJ.t("ct.supply.value", { n: '<span class="num" data-count="' + c.newToken.supply + '" data-count-key="ct-supply">' + c.newToken.supplyText + "</span>" });

    // Concept previews: illustrative numbers only.
    set("m1-yes", f.pct(0.62, 0)); set("m1-no", f.pct(0.38, 0));
    set("m1-stake", ct(500)); set("m1-pay", ct(806));
    set("m2-price", ct(0.62)); set("m2-chg", "+" + f.amount(0.14));
    set("m2-pos", CJ.t("fu.m2.shares", { n: f.amount(1000), p: f.amount(0.48) }));
    set("m2-pnl", "+" + ct(140));
    set("m3-coll", CJ.t("fu.m3.shares", { n: f.amount(1000) }));
    set("m3-val", ct(620)); set("m3-borrow", ct(250));
    set("m3-ltv", f.pct(250 / 620, 0)); set("m3-min", f.pct(0, 0)); set("m3-max", CJ.t("fu.m3.max", { p: f.pct(0.6, 0) }));
    set("m4-margin", ct(500)); set("m4-size", ct(1500));
    set("m4-entry", ct(0.62)); set("m4-liq", ct(0.43));
  }
  document.addEventListener("cj:lang", paint);
  paint();

  // Phones: the concept previews sit in one snapping row; the dots under it show which card is in view.
  var row = document.getElementById("mocks"), dots = document.getElementById("mocks-dots");
  if (row && dots) {
    var cards = [].slice.call(row.querySelectorAll(".mock"));
    dots.innerHTML = cards.map(function () { return "<span></span>"; }).join("");
    var mark = function () {
      var r = row.getBoundingClientRect(), best = 0, bestD = Infinity;
      cards.forEach(function (cd, i) { var d = Math.abs(cd.getBoundingClientRect().left - r.left - parseFloat(getComputedStyle(row).paddingLeft || 0)); if (d < bestD) { bestD = d; best = i; } });
      [].forEach.call(dots.children, function (d, i) { d.classList.toggle("is-on", i === best); });
    };
    // A row that scrolls can be reached and scrolled by keyboard; on wider screens it is a plain grid.
    var mq = window.matchMedia("(max-width: 599px)");
    var sync = function () {
      if (mq.matches) { row.setAttribute("tabindex", "0"); row.setAttribute("role", "region"); row.setAttribute("aria-label", CJ.t("fu.row")); }
      else { row.removeAttribute("tabindex"); row.removeAttribute("role"); row.removeAttribute("aria-label"); }
      mark();
    };
    var raf = 0;
    row.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; mark(); }); }, { passive: true });
    if (mq.addEventListener) mq.addEventListener("change", sync); else if (mq.addListener) mq.addListener(sync);
    document.addEventListener("cj:lang", sync);
    sync();
  }
})();
