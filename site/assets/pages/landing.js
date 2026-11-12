// Landing page behaviour.
(function () {
  function paint() {
    var c = CJ.config;
    var w = document.getElementById("hero-window");
    if (w) w.textContent = CJ.t("hero.window", { start: CJ.fmt.date(c.windowStart), end: CJ.fmt.date(c.windowEnd) });
    var tr = document.getElementById("hero-track");
    if (tr) CJ.track(tr, null, { large: true, amountText: CJ.fmt.amount(125000), demoDays: 3.4 });
  }
  document.addEventListener("cj:lang", paint);
  paint();
})();
