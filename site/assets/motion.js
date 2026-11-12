// Cojam motion layer. Load after system.js on every page: <script src="assets/motion.js"></script>
// CSS owns timing (tokens.css, motion section of base.css). This file adds only what CSS cannot do, and every part
// is progressive: without it the page is complete and static. Under prefers-reduced-motion: reduce nothing moves.
//
// Automatic, no wiring needed:
//   Press      .is-pressed on buttons, chips, segments, tabs and link cards from pointerdown, held at least 90 ms so a
//              quick tap still shows; iOS :active enabled.
//   Ripple     .btn-primary gets a radial ripple from the touch point (clipped to the button, never delays the action).
//   Tilt       [data-tilt] cards follow a fine pointer with a 2 degree tilt and a sky sheen. Off on touch.
//   Track      CJ.track() and CJ.trackAggregate() are wrapped: the first time a track scrolls into view the 10% block pops,
//              then the day ticks fill in order. A re-render of the same track (same id or data-* attributes) never replays.
//   Count up   any element with data-count="<exact number>" counts up from 0 the first time it is seen. Its text must
//              already be the exact, formatted final value; that text is restored at the end. Optional data-dp
//              (decimals while counting) and data-count-key (a stable key so re-renders do not replay).
//   Reveal     [data-reveal] on a section container: one fade and 8 px rise when it scrolls in. data-reveal=".a, .b"
//              staggers those children by 50 ms. Arms on the first scroll, and only sections below the fold then,
//              so nothing flashes and a page that is never scrolled (captures, audits) shows everything.
//
// API:
//   CJ.motion.reduced()              -> true when the visitor asks for reduced motion.
//   CJ.countUp(el, target, opts)     -> count el up to target once. opts: {decimals, key, format(v) -> string}.
//   CJ.celebrate(el, opts)           -> Promise, resolves when done (about 1.2 s). A success moment centred on el
//                                       (or the viewport when el is null): a sky check pops in, a ring and ten sparks
//                                       fly out once. Fixed overlay, aria-hidden, no layout change, no emoji. Announce
//                                       the success in your own live region. opts: {size: 56} (px of the check).
//                                       Reduced motion: a still check for 0.9 s.
//                                       Swap app: CJ.celebrate(document.querySelector(".mg-view .track")) on confirm.
//   CJ.motion.revealAll()            -> show every armed reveal and track fill now (print, captures, audits).
//   CJ.motion.playTrack(el)          -> replay the fill on a track (demo and QA).
//   ?motion=off                      -> skip the JS layer (reveal, count up, track fill, tilt, ripple) for audits.
(function () {
  var CJ = window.CJ;
  if (!CJ) return;
  var root = document.documentElement;
  var mqReduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var mqFine = window.matchMedia ? matchMedia("(hover: hover) and (pointer: fine)") : { matches: false };
  var off = CJ.params && CJ.params.get("motion") === "off";
  var hasIO = "IntersectionObserver" in window;
  function reduced() { return off || mqReduce.matches; }
  root.classList.add("cj-motion");

  // ---------- press ----------
  var PRESS = ".btn, .chip, .seg-btn, .pg-num, .icon-btn, .w-open, .sort-btn, .cj-nav a, .cj-nav-mobile a, .cj-brand, .cj-foot-nav a, .help > summary, .press";
  var MIN_HOLD = 90, pressed = null, downAt = 0;
  document.addEventListener("touchstart", function () {}, { passive: true }); // lets iOS Safari apply :active
  document.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 || !e.target.closest) return;
    var el = e.target.closest(PRESS);
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    clear(0);
    pressed = el; downAt = performance.now();
    el.classList.add("is-pressed");
    if (el.classList.contains("btn-primary") && !reduced()) ripple(el, e);
  }, { passive: true });
  function clear(minHold) {
    var el = pressed; if (!el) return; pressed = null;
    var wait = Math.max(0, minHold - (performance.now() - downAt));
    if (wait) setTimeout(function () { el.classList.remove("is-pressed"); }, wait); else el.classList.remove("is-pressed");
  }
  ["pointerup", "pointercancel", "dragstart"].forEach(function (t) { document.addEventListener(t, function () { clear(MIN_HOLD); }, { passive: true }); });
  window.addEventListener("blur", function () { clear(0); });

  function ripple(el, e) {
    var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!(x >= 0 && y >= 0 && x <= r.width && y <= r.height)) { x = r.width / 2; y = r.height / 2; }
    var d = 2 * Math.sqrt(Math.pow(Math.max(x, r.width - x), 2) + Math.pow(Math.max(y, r.height - y), 2));
    var s = document.createElement("span");
    s.className = "ripple"; s.setAttribute("aria-hidden", "true");
    s.style.left = x + "px"; s.style.top = y + "px"; s.style.width = d + "px"; s.style.height = d + "px";
    el.appendChild(s);
    var done = function () { if (s.parentNode) s.parentNode.removeChild(s); };
    s.addEventListener("animationend", done);
    setTimeout(done, 900);
  }

  // ---------- tilt and sheen (fine pointers only) ----------
  function bindTilt(card) {
    if (card.__cjTilt) return; card.__cjTilt = true;
    card.classList.add("tilt");
    var clip = document.createElement("span"), sheen = document.createElement("span");
    clip.className = "sheen-clip"; clip.setAttribute("aria-hidden", "true"); sheen.className = "sheen";
    clip.appendChild(sheen); card.appendChild(clip);
    var raf = 0, px = 0, py = 0, rect = null;
    card.addEventListener("pointerenter", function () { rect = null; });
    card.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || reduced() || !mqFine.matches) return;
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    function apply() {
      raf = 0;
      if (!rect) { var t = card.style.transform; card.style.transform = "none"; rect = card.getBoundingClientRect(); card.style.transform = t; }
      var lx = px - rect.left, ly = py - rect.top, nx = lx / rect.width - 0.5, ny = ly / rect.height - 0.5;
      card.classList.add("is-tilting");
      card.style.transform = "perspective(900px) rotateX(" + (-ny * 4).toFixed(2) + "deg) rotateY(" + (nx * 4).toFixed(2) + "deg) translateY(-2px)";
      sheen.style.transform = "translate(" + lx.toFixed(1) + "px," + ly.toFixed(1) + "px)";
    }
    card.addEventListener("pointerleave", function () {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      card.classList.remove("is-tilting"); card.style.transform = "";
    });
  }

  // ---------- swap track fill ----------
  var playedKeys = {}, playedEls = typeof WeakSet === "function" ? new WeakSet() : null;
  function trackKey(el) {
    if (el.id) return "#" + el.id;
    var parts = [];
    for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (a.name.indexOf("data-") === 0) parts.push(a.name + "=" + a.value); }
    return parts.length ? parts.join("&") : null;
  }
  function hasPlayed(el) { var k = trackKey(el); return k ? !!playedKeys[k] : !!(playedEls && playedEls.has(el)); }
  function markPlayed(el) { var k = trackKey(el); if (k) playedKeys[k] = true; else if (playedEls) playedEls.add(el); }
  var trackIO = hasIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { trackIO.unobserve(en.target); playTrack(en.target); } });
  }, { threshold: 0.35 }) : null;
  function armTrack(el) {
    if (!el || !trackIO || reduced() || hasPlayed(el)) return;
    el.classList.add("is-armed");
    trackIO.observe(el);
  }
  function playTrack(el) {
    markPlayed(el);
    el.classList.remove("is-armed", "is-filling");
    void el.offsetWidth; // restart when replayed
    el.classList.add("is-filling");
    clearTimeout(el.__cjFill);
    el.__cjFill = setTimeout(function () { el.classList.remove("is-filling"); }, 1000);
  }
  ["track", "trackAggregate"].forEach(function (name) {
    var orig = CJ[name]; if (typeof orig !== "function") return;
    CJ[name] = function (el) { var r = orig.apply(this, arguments); armTrack(el); return r; };
  });

  // ---------- count up ----------
  var counted = {}, COUNT_MS = 400;
  var countIO = hasIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { countIO.unobserve(en.target); runCount(en.target); } });
  }, { threshold: 0.6 }) : null;
  function countUp(el, target, opts) {
    opts = opts || {};
    if (!el) return;
    var key = opts.key || el.getAttribute("data-count-key") || (el.id ? "#" + el.id : null);
    if (key) { if (counted[key]) return; counted[key] = true; }
    else if (el.__cjCounted) return;
    el.__cjCounted = true;
    target = +target;
    if (reduced() || !countIO || !isFinite(target) || target <= 0) return;
    var dp = opts.decimals != null ? opts.decimals : (+el.getAttribute("data-dp") || 0);
    el.__cjCount = { target: target, text: el.textContent, fmt: opts.format || function (v) { return CJ.fmt.amount(v, dp); } };
    countIO.observe(el);
  }
  function runCount(el) {
    var c = el.__cjCount; if (!c || !el.isConnected) return;
    el.__cjCount = null;
    if (el.textContent !== c.text) return; // the page changed it meanwhile: leave the page's value
    // Hold the final width so the count never moves anything around it.
    var w = el.getBoundingClientRect().width, last = c.fmt(0), t0 = performance.now();
    el.style.display = "inline-block"; el.style.minWidth = w + "px";
    el.textContent = last;
    function frame(ts) {
      if (el.textContent !== last) return done(false);
      var p = Math.min(1, (ts - t0) / COUNT_MS), e = 1 - Math.pow(1 - p, 3);
      if (p < 1) { last = c.fmt(c.target * e); el.textContent = last; requestAnimationFrame(frame); }
      else done(true);
    }
    function done(restore) { if (restore) el.textContent = c.text; el.style.display = ""; el.style.minWidth = ""; }
    requestAnimationFrame(frame);
  }
  function scanCounts(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.hasAttribute("data-count")) countUp(node, node.getAttribute("data-count"));
    var list = node.querySelectorAll("[data-count]");
    for (var i = 0; i < list.length; i++) countUp(list[i], list[i].getAttribute("data-count"));
  }

  // ---------- reveal ----------
  var revealIO = hasIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { revealIO.unobserve(en.target); reveal(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }) : null;
  // Arms on the first scroll (or at once when the page loads already scrolled), and only sections still below the fold
  // then. A page that never scrolls (print, captures, audits, a reader who stays on the first screen) never hides anything.
  function initReveal() {
    if (!revealIO || reduced()) return;
    if ((window.scrollY || root.scrollTop) > 0) { armReveal(); return; }
    window.addEventListener("scroll", function once() { window.removeEventListener("scroll", once); armReveal(); }, { passive: true });
  }
  function armReveal() {
    document.querySelectorAll("[data-reveal]").forEach(function (sec) {
      if (sec.__cjRv) return;
      var sel = sec.getAttribute("data-reveal"), items = sel ? [].slice.call(sec.querySelectorAll(sel)) : [];
      if (!items.length) items = [sec];
      if (sec.getBoundingClientRect().top < window.innerHeight * 0.94) return; // on screen at load: leave it as it is
      sec.__cjRv = items;
      items.forEach(function (it) { it.classList.add("rv-wait"); });
      revealIO.observe(sec);
    });
  }
  function reveal(sec) {
    var items = sec.__cjRv; if (!items) return; sec.__cjRv = null;
    items.forEach(function (it, i) {
      it.style.animationDelay = Math.min(i, 8) * 50 + "ms";
      it.classList.remove("rv-wait"); it.classList.add("rv-in");
      var end = function (ev) {
        if (ev && ev.target !== it) return;
        it.classList.remove("rv-in"); it.style.animationDelay = ""; it.removeEventListener("animationend", end);
      };
      it.addEventListener("animationend", end);
      setTimeout(end, 1200);
    });
  }
  function revealAll() {
    document.querySelectorAll("[data-reveal]").forEach(function (sec) { if (sec.__cjRv) { if (revealIO) revealIO.unobserve(sec); reveal(sec); } });
    document.querySelectorAll(".rv-wait").forEach(function (el) { el.classList.remove("rv-wait"); });
    // Tracks waiting below the fold show their fill at once (no replay later).
    document.querySelectorAll(".track.is-armed").forEach(function (el) { if (trackIO) trackIO.unobserve(el); markPlayed(el); el.classList.remove("is-armed"); });
  }
  window.addEventListener("beforeprint", revealAll);

  // ---------- celebrate ----------
  function celebrate(el, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      var x = r ? r.left + r.width / 2 : window.innerWidth / 2, y = r ? r.top + r.height / 2 : window.innerHeight / 2;
      var still = reduced(), size = opts.size || 56;
      var host = document.createElement("div");
      host.className = "cj-cele"; host.setAttribute("aria-hidden", "true");
      host.style.left = Math.round(x) + "px"; host.style.top = Math.round(y) + "px";
      var html = "";
      if (!still) {
        html += '<span class="cj-cele-ring"></span>';
        for (var i = 0; i < 10; i++) html += '<span class="cj-cele-spark" style="--a:' + (i * 36 + 18) + 'deg"></span>';
      }
      html += '<span class="cj-cele-check' + (still ? " is-still" : "") + '">' + CJ.icon("check", Math.round(size / 2)) + "</span>";
      host.innerHTML = html;
      if (size !== 56) [].forEach.call(host.querySelectorAll(".cj-cele-check, .cj-cele-ring"), function (n) {
        n.style.width = n.style.height = size + "px"; n.style.left = n.style.top = -size / 2 + "px";
      });
      document.body.appendChild(host);
      setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); resolve(); }, still ? 900 : 1250);
    });
  }

  // ---------- start ----------
  function start() {
    if (!off) {
      document.querySelectorAll("[data-tilt]").forEach(bindTilt);
      scanCounts(document.body);
      initReveal();
      if (window.MutationObserver) new MutationObserver(function (list) {
        list.forEach(function (m) { for (var i = 0; i < m.addedNodes.length; i++) scanCounts(m.addedNodes[i]); });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
  // Page scripts load after this file, so start once the document is parsed and they have painted.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  CJ.countUp = countUp;
  CJ.celebrate = celebrate;
  CJ.motion = { reduced: reduced, countUp: countUp, celebrate: celebrate, revealAll: revealAll, playTrack: playTrack };
})();
