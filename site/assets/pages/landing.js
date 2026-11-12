// Landing page behaviour: hero track, how it works track and icons, timeline dates, contract facts, concept preview figures.
(function () {
  var c = CJ.config, f = CJ.fmt;
  function set(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
  function ct(n, dp) { return CJ.t("fu.ct", { n: f.amount(n, dp) }); }

  function paint() {
    var w = document.getElementById("hero-window");
    if (w) w.textContent = CJ.t("hero.window", { start: f.date(c.windowStart), end: f.date(c.windowEnd) });
    var tr = document.getElementById("hero-track");
    if (tr) CJ.track(tr, null, { large: true, amountText: f.amount(125000), demoDays: 3.4 });

    // How it works: the same track, shown full so each stop lines up with a step.
    var ht = document.getElementById("how-track");
    if (ht) CJ.track(ht, null, { amountText: f.amount(12500), demoDays: 7 });
    [["how-ico-1", "swap"], ["how-ico-2", "lock"], ["how-ico-3", "unlock"]].forEach(function (p) {
      var el = document.getElementById(p[0]); if (el) el.innerHTML = CJ.icon(p[1], 20);
    });
    document.querySelectorAll(".how .help > summary").forEach(function (s) { if (!s.firstChild) s.innerHTML = CJ.icon("help", 18); });

    // Timeline
    set("tl-open", f.date(c.windowStart));
    set("tl-close", f.date(c.windowEnd));

    // Contract facts
    set("ct-supply", CJ.t("ct.supply.value", { n: f.amount(c.newToken.supply, 3) }));

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
