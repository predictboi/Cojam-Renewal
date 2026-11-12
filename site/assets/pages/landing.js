// Landing page behaviour: hero track, how it works icons, timeline dates, contract facts, concept preview figures.
(function () {
  var c = CJ.config, f = CJ.fmt;
  function set(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
  function ct(n, dp) { return CJ.t("fu.ct", { n: f.amount(n, dp) }); }

  function paint() {
    var w = document.getElementById("hero-window");
    if (w) w.innerHTML = CJ.t("hero.window", { start: '<span class="num">' + f.date(c.windowStart) + "</span>", end: '<span class="num">' + f.date(c.windowEnd) + "</span>" });
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
})();
