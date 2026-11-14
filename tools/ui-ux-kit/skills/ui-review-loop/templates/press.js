// Press feedback that a quick tap can still see (held at least 90 ms), a ripple from the touch point on .btn-primary,
// and scroll reveal that arms only after the first scroll so captures and never scrolled pages show everything.
// window.revealAll() shows every armed reveal at once (captures, print).
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SEL = ".btn, .chip, .card-link";
  document.addEventListener("touchstart", function () {}, { passive: true }); // enables :active on iOS
  document.addEventListener("pointerdown", function (e) {
    var el = e.target.closest && e.target.closest(SEL); if (!el || el.disabled) return;
    var t0 = Date.now(); el.classList.add("is-pressed");
    if (!reduce && el.classList.contains("btn-primary")) {
      var r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement("span");
      s.className = "ripple"; s.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
      el.appendChild(s); setTimeout(function () { s.remove(); }, 600);
    }
    function up() { setTimeout(function () { el.classList.remove("is-pressed"); }, Math.max(0, 90 - (Date.now() - t0)));
      removeEventListener("pointerup", up); removeEventListener("pointercancel", up); }
    addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
  // reveal: [data-reveal] sections fade and rise 8 px when they scroll in; armed only on the first scroll, below the fold
  var items = [].slice.call(document.querySelectorAll("[data-reveal]"));
  window.revealAll = function () { items.forEach(function (el) { el.classList.add("in"); }); };
  if (reduce || !("IntersectionObserver" in window)) return;
  addEventListener("scroll", function arm() {
    removeEventListener("scroll", arm);
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("armed"); io.observe(el); } });
  }, { passive: true });
})();
/* CSS for reveal:
   [data-reveal].armed { opacity: 0; transform: translateY(8px); transition: opacity var(--dur-reveal) var(--ease-out), transform var(--dur-reveal) var(--ease-out); }
   [data-reveal].armed.in { opacity: 1; transform: none; } */
