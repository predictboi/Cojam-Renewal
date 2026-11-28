/* Home: the deck of five posters (card view) and the numbered list (list view). */
(function () {
  "use strict";
  var A = window.App, t = A.t, M = A.M, esc = A.esc, st = A.state;
  var list = document.body.getAttribute("data-page") === "home-list";
  var FIELD = ["f-y", "f-k", "f-w", "f-y", "f-k"];
  var FORM = {
    q1: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg>',
    q2: '<svg viewBox="0 0 100 100"><path d="M0 18h100v24H0zM0 58h62v24H0z"/></svg>',
    q3: '<svg viewBox="0 0 100 100"><path d="M0 70a50 50 0 0 1 100 0z"/></svg>',
    q4: '<svg viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 0a50 50 0 1 0 0 100A50 50 0 0 0 50 0zm0 26a24 24 0 1 1 0 48 24 24 0 0 1 0-48z"/></svg>',
    q5: '<svg viewBox="0 0 100 100"><path d="M50 4 100 92H0z"/></svg>'
  };
  var UNDO_MS = 3000, ARM = 0.35;
  var set = M.set.map(A.q), made = {}, ptr = 0, held = [], lastCommit = 0, finTimer = null, finN = 3;
  if (st === "partial") { made = { q1: "r", q2: "l" }; ptr = 2; }

  function seg() {
    return '<div class="seg is-inline" role="group" aria-label="' + t("h.view.label") + '"><a href="home.html' + (st ? "?state=" + st : "") + '"' + (list ? "" : ' aria-current="page"') + ">" + t("h.view.card") + '</a><a href="home-list.html' + (st ? "?state=" + st : "") + '"' + (list ? ' aria-current="page"' : "") + ">" + t("h.view.term") + "</a></div>";
  }
  function band() {
    return '<div class="band"><div class="band-1"><h1 class="band-t d">' + t("h.title") + "</h1>" + seg() + "</div>" +
      '<div class="prog" role="img" id="prog" aria-label="' + t("h.prog.sr", { n: ptr }) + '">' + set.map(function (q, i) {
        return '<div class="prog-t" data-i="' + i + '"><span>' + (i + 1) + '</span><i></i></div>';
      }).join("") + "</div>" +
      '<div class="band-2"><span id="left"></span><span>' + t("h.closes") + ' <b data-cd></b></span></div></div>';
  }
  function ansWordCls(s) { var n = s.length * (/[　-鿿가-힯]/.test(s) ? 1.7 : 1); return n <= 3.5 ? "" : n <= 6.5 ? "is-m" : "is-s"; }
  function card(q, i) {
    return '<article class="card ' + FIELD[i] + '" data-id="' + q.id + '" data-i="' + i + '" aria-label="' + t("h.qn.sr", { n: i + 1 }) + '">' +
      '<div class="card-top"><span class="num">' + t("h.qn", { n: i + 1 }) + "</span><span>" + t("cat." + q.cat) + "</span></div>" +
      '<h2 class="card-q hh">' + esc(q.title) + "</h2>" +
      '<p class="card-meta">' + t("h.answer", { rule: esc(q.rule) }) + "<br>" + t("h.ai", { time: esc(q.settle) }) + "</p>" +
      '<div class="card-art" aria-hidden="true">' + FORM[q.id] + '</div><div class="card-num" aria-hidden="true">' + (i + 1) + "</div>" +
      '<div class="card-ans card-ans-l" aria-hidden="true">' + A.ICON.triL + '<b class="' + ansWordCls(q.left) + '">' + esc(q.left) + "</b></div>" +
      '<div class="card-ans card-ans-r" aria-hidden="true">' + A.ICON.triR + '<b class="' + ansWordCls(q.right) + '">' + esc(q.right) + "</b></div></article>";
  }
  function answers(q, off) {
    var d = off ? ' aria-disabled="true"' : "";
    return '<button type="button" class="choice choice-l" data-c="l"' + d + ' aria-label="' + esc(t("h.pick.aria", { choice: q.left, q: q.title })) + '">' + A.ICON.triL + "<span>" + esc(q.left) + "</span></button>" +
      '<button type="button" class="choice choice-r" data-c="r"' + d + ' aria-label="' + esc(t("h.pick.aria", { choice: q.right, q: q.title })) + '"><span>' + esc(q.right) + "</span>" + A.ICON.triR + "</button>";
  }

  /* ---------- states that replace the deck ---------- */
  var special = null;
  if (st === "hold") special = A.stateBlock("II", t("hold.home.h"), t("hold.home.b"), '<a class="btn btn-p" href="hold.html"><span>' + t("hold.home.btn") + "</span>" + A.ICON.go + "</a>");
  if (st === "error") special = A.errBlock();
  if (st === "empty") special = A.stateBlock("0", t("h.empty.h"), t("h.empty.b", { time: t("time.kst9") }), '<p class="d" style="font-size:var(--t-d2);color:var(--ink);margin-top:14px" data-cd></p>');
  if (st === "loading") special = '<div class="deck" aria-busy="true"><span class="sr">' + t("common.loading") + '</span><div class="card sk" style="background:var(--mute)"></div></div><div class="ans"><div class="sk" style="height:60px"></div><div class="sk" style="height:60px"></div></div><div class="pickbar"></div>';

  var body;
  if (special) body = band() + special;
  else if (list) body = band() + '<ol class="qlist" id="qlist"></ol><p class="sr" aria-live="polite" id="live"></p>';
  else body = band() + '<div class="deck" id="deck">' + set.map(card).join("") + "</div>" +
    '<div class="ans" id="ans"></div><div class="pickbar" id="bar"></div><p class="sr" aria-live="polite" id="live"></p>';

  A.shell({ tab: "home", fixed: !list && st !== "hold" && st !== "error" && st !== "empty", body: body,
    pin: list && !special ? '<div class="pickbar" id="bar" style="margin:0;height:44px"></div>' : "", pinCls: "" });
  if (special) { progress(); return; }

  var deck = document.getElementById("deck"), ans = document.getElementById("ans"), bar = document.getElementById("bar"), live = document.getElementById("live");
  var offline = st === "offline";

  function progress() {
    document.querySelectorAll(".prog-t").forEach(function (el, i) {
      var q = set[i], c = made[q.id];
      el.classList.toggle("is-now", i === ptr && !special);
      el.classList.toggle("is-l", c === "l"); el.classList.toggle("is-r", c === "r");
      var inner = el.querySelector("i");
      if (c) { inner.innerHTML = c === "l" ? A.ICON.triL + "<span>" + (i + 1) + "</span>" : "<span>" + (i + 1) + "</span>" + A.ICON.triR; requestAnimationFrame(function () { el.classList.add("is-set"); }); }
      else el.classList.remove("is-set");
    });
    var p = document.getElementById("prog"); if (p) p.setAttribute("aria-label", t("h.prog.sr", { n: ptr }));
    var l = document.getElementById("left"); if (l) l.textContent = st === "empty" || st === "hold" || st === "error" ? "" : t("h.left", { n: 5 - ptr });
  }
  function hint() { return matchMedia("(pointer: coarse)").matches ? t("h.hint.touch") : t("h.hint.keys"); }
  function renderBar() {
    var h = held[held.length - 1];
    if (h) {
      var q = set[h.i], word = h.c === "l" ? q.left : q.right, left = Math.max(0, UNDO_MS - (Date.now() - h.at));
      bar.innerHTML = '<span class="said"><span class="num">' + (h.i + 1) + "</span>" + A.pick(h.c, word) + "</span>" +
        '<button type="button" class="undo" id="undo" aria-label="' + esc(t("h.undo.aria", { n: h.i + 1, choice: word })) + '">' + t("h.undo") + '<i style="animation-duration:' + UNDO_MS + "ms;animation-delay:-" + (UNDO_MS - left) + 'ms"></i></button>';
    } else bar.innerHTML = "<span>" + (ptr > 0 && ptr < 5 ? t("h.left.saved") : ptr >= 5 ? t("h.end.b") : hint()) + "</span>";
  }
  function hold(i, c) {
    var h = { i: i, c: c, at: Date.now() };
    h.timer = setTimeout(function () { held.splice(held.indexOf(h), 1); renderBar(); }, UNDO_MS);
    held.push(h);
  }
  function startFin() {
    finN = 3; clearInterval(finTimer);
    finTimer = setInterval(function () { finN--; if (finN <= 0) return finish(); paintFin(true); }, 1000);
    paintFin(false);
  }
  function stopFin() { clearInterval(finTimer); finTimer = null; var f = document.getElementById("fin"); if (f) f.remove(); }
  function finish() { clearInterval(finTimer); A.savePicks(made); location.href = "done.html?moment=1"; }

  /* ================= list view ================= */
  if (list) {
    var ql = document.getElementById("qlist");
    var paintList = function () {
      ql.innerHTML = set.map(function (q, i) {
        var c = made[q.id], open = i === ptr;
        return '<li class="qrow' + (open ? " is-open" : "") + (c ? " is-done" : "") + '"><span class="qrow-n" aria-hidden="true">' + A.pad(i + 1) + '</span><div><h2 class="qrow-q">' + esc(q.title) + "</h2>" +
          '<p class="qrow-s">' + (c ? A.pick(c, c === "l" ? q.left : q.right) : "<span>" + t("cat." + q.cat) + "</span>") + (open ? "<span>" + t("h.answer", { rule: esc(q.rule) }) + "</span>" : "") + "</p></div>" +
          (open ? '<div class="ans">' + answers(q, offline) + "</div>" : "") + "</li>";
      }).join("") + (ptr >= 5 ? '<li class="qrow" id="fin" style="display:block"><h2 class="hh" style="font-size:var(--t-h1)">' + t("h.end.h") + '</h2><p class="row-s" id="fin-t" style="margin:4px 0 12px">' + t("h.end.in", { n: finN }) + '</p><button type="button" class="btn btn-p" id="fin-now"><span>' + t("h.end.now") + "</span>" + A.ICON.go + "</button></li>" : "");
      progress(); renderBar();
    };
    window.paintFin = null;
    var paintFin = function () { var e = document.getElementById("fin-t"); if (e) e.textContent = t("h.end.in", { n: finN }); };
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".choice");
      if (b) {
        if (offline) return A.toast(t("h.offline"));
        var q = set[ptr], c = b.getAttribute("data-c"); made[q.id] = c; hold(ptr, c); ptr++;
        live.textContent = t("h.live.picked", { choice: c === "l" ? q.left : q.right, k: 5 - ptr });
        paintList(); if (ptr >= 5) startFin(); return;
      }
      if (e.target.closest("#undo")) { var h = held.pop(); clearTimeout(h.timer); delete made[set[h.i].id]; ptr = h.i; clearInterval(finTimer); live.textContent = t("h.undone", { n: h.i + 1 }); paintList(); return; }
      if (e.target.closest("#fin-now")) finish();
    });
    paintList(); return;
  }

  /* ================= card view ================= */
  var cards = [].slice.call(deck.querySelectorAll(".card"));
  function layout() {
    cards.forEach(function (c, i) {
      c.setAttribute("data-pos", i < ptr ? "out" : i - ptr); c.style.zIndex = 10 - Math.max(0, i - ptr);
      c.style.visibility = i < ptr ? "hidden" : ""; c.setAttribute("aria-hidden", i === ptr ? "false" : "true");
    });
    ans.innerHTML = ptr < 5 ? answers(set[ptr], offline) : "";
    ans.style.visibility = ptr < 5 ? "" : "hidden";
    progress(); renderBar();
  }
  function paintFin(tick) {
    var f = document.getElementById("fin");
    if (!f) {
      deck.insertAdjacentHTML("beforeend", '<div class="fin" id="fin" style="z-index:5"><span class="fin-n" id="fin-n" aria-hidden="true"></span><h2 class="d">' + t("h.end.h") + '</h2><p id="fin-t"></p><button type="button" class="btn btn-p" id="fin-now"><span>' + t("h.end.now") + "</span>" + A.ICON.go + "</button></div>");
      f = document.getElementById("fin");
    }
    var n = document.getElementById("fin-n"); n.textContent = finN; document.getElementById("fin-t").textContent = t("h.end.in", { n: finN });
    if (tick) { n.classList.remove("tick"); void n.offsetWidth; n.classList.add("tick"); }
  }
  /* cover: 0 hides both sheets, 0..1 slides the sheet of side c that far across the card */
  function sheet(card, c, cover) {
    var l = card.querySelector(".card-ans-l"), r = card.querySelector(".card-ans-r");
    l.style.visibility = c === "l" && cover > 0 ? "visible" : "hidden"; r.style.visibility = c === "r" && cover > 0 ? "visible" : "hidden";
    l.style.transform = "translate3d(" + (c === "l" ? (1 - cover) * 101 : 101) + "%,0,0)";
    r.style.transform = "translate3d(" + (c === "r" ? -(1 - cover) * 101 : -101) + "%,0,0)";
  }
  function hot(c) { ans.querySelectorAll(".choice").forEach(function (b) { b.classList.toggle("is-hot", b.getAttribute("data-c") === c); }); }

  function commit(c, from) {
    if (ptr >= 5) return;
    if (offline) { A.toast(t("h.offline")); return; }
    var i = ptr, q = set[i], el = cards[i], w = deck.offsetWidth, dir = c === "l" ? -1 : 1;
    lastCommit = Date.now();
    made[q.id] = c; sheet(el, c, 1); el.classList.remove("is-drag");
    var start = from || "translate3d(0,0,0) rotate(0deg)", end = "translate3d(" + dir * w * 1.35 + "px," + (from ? 30 : 10) + "px,0) rotate(" + dir * 14 + "deg)";
    el.style.transform = "";
    var an = A.reduce ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }) : el.animate([{ transform: start }, { transform: end }], { duration: from ? 240 : 380, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    el._an = an; el.style.zIndex = 20;
    an.onfinish = function () { if (el._an !== an) return; el._an = null; if (made[q.id]) { el.style.visibility = "hidden"; sheet(el, c, 0); } };
    ptr++; hold(i, c);
    cards.forEach(function (cd, k) { if (k > i) { cd.setAttribute("data-pos", k - ptr); cd.style.zIndex = 10 - (k - ptr); cd.setAttribute("aria-hidden", k === ptr ? "false" : "true"); } });
    ans.innerHTML = ptr < 5 ? answers(set[ptr], offline) : ""; ans.style.visibility = ptr < 5 ? "" : "hidden";
    progress(); renderBar();
    if (navigator.vibrate) try { navigator.vibrate(5); } catch (e) {}
    live.textContent = t("h.live.picked", { choice: c === "l" ? q.left : q.right, k: 5 - ptr });
    if (ptr >= 5) startFin();
  }
  function undo() {
    var h = held.pop(); if (!h) return;
    clearTimeout(h.timer); stopFin();
    var el = cards[h.i], w = deck.offsetWidth, dir = h.c === "l" ? -1 : 1;
    delete made[set[h.i].id]; ptr = h.i;
    if (el._an) { el._an.cancel(); el._an = null; }
    el.style.visibility = ""; sheet(el, h.c, 0);
    layout(); el.style.zIndex = 20;
    if (!A.reduce) el.animate([{ transform: "translate3d(" + dir * w * 1.2 + "px,10px,0) rotate(" + dir * 12 + "deg)" }, { transform: "translate3d(0,0,0) rotate(0deg)" }], { duration: 360, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    live.textContent = t("h.undone", { n: h.i + 1 });
  }

  /* drag: follows the finger, decides on release */
  var g = null;
  deck.addEventListener("pointerdown", function (e) {
    if (ptr >= 5 || e.target.closest("#fin") || (e.pointerType === "mouse" && e.button !== 0)) return;
    var el = cards[ptr]; if (!el.contains(e.target)) return;
    g = { el: el, x: e.clientX, y: e.clientY, dx: 0, dy: 0, lock: null, w: deck.offsetWidth, pts: [{ x: e.clientX, t: e.timeStamp }], armed: null, id: e.pointerId };
  });
  deck.addEventListener("pointermove", function (e) {
    if (!g || e.pointerId !== g.id) return;
    g.dx = e.clientX - g.x; g.dy = e.clientY - g.y;
    if (!g.lock) {
      if (Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10) return;
      g.lock = Math.abs(g.dx) >= Math.abs(g.dy) ? "x" : "y";
      if (g.lock === "y") { g = null; return; }
      g.el.classList.add("is-drag"); try { g.el.setPointerCapture(e.pointerId); } catch (er) {}
    }
    g.pts.push({ x: e.clientX, t: e.timeStamp }); while (g.pts.length > 2 && e.timeStamp - g.pts[0].t > 100) g.pts.shift();
    var p = g.dx / g.w, c = g.dx < 0 ? "l" : "r", armed = Math.abs(p) >= ARM ? c : null;
    g.tf = "translate3d(" + g.dx + "px," + g.dy * 0.18 + "px,0) rotate(" + Math.max(-8, Math.min(8, p * 14)) + "deg)";
    g.el.style.transform = g.tf;
    sheet(g.el, c, armed ? 1 : Math.min(0.4, Math.abs(p) / ARM * 0.4) + 0.02);
    if (armed !== g.armed) { g.armed = armed; hot(armed); if (armed && navigator.vibrate) try { navigator.vibrate(5); } catch (er) {} }
  });
  function release(e) {
    if (!g || e.pointerId !== g.id) return; var s = g; g = null; hot(null);
    if (s.lock !== "x") return;
    var a = s.pts[0], b = s.pts[s.pts.length - 1], v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0, ad = Math.abs(s.dx), same = v * s.dx > 0;
    var fling = same && ((ad >= 96 && Math.abs(v) >= 0.5) || (ad >= 56 && Math.abs(v) >= 1.1));
    if (e.type !== "pointercancel" && (s.armed || fling)) commit(s.dx < 0 ? "l" : "r", s.tf);
    else { s.el.classList.remove("is-drag"); s.el.style.transform = ""; sheet(s.el, s.dx < 0 ? "l" : "r", 0.001); setTimeout(function () { if (!g) sheet(s.el, "l", 0); }, 170); }
  }
  deck.addEventListener("pointerup", release); deck.addEventListener("pointercancel", release);

  document.addEventListener("click", function (e) {
    var b = e.target.closest(".choice");
    if (b) { if (Date.now() - lastCommit < 400) return; commit(b.getAttribute("data-c")); return; }
    if (e.target.closest("#undo")) return undo();
    if (e.target.closest("#fin-now")) finish();
  });
  document.addEventListener("keydown", function (e) {
    if (e.repeat || e.target.closest("input, a, .bsheet")) return;
    if (e.key === "ArrowLeft") commit("l"); else if (e.key === "ArrowRight") commit("r");
    else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") undo();
  });
  window.addEventListener("pagehide", function () { if (Object.keys(made).length === 5) A.savePicks(made); });
  layout();
  window.__deck = { commit: commit, undo: undo, state: function () { return { ptr: ptr, made: made, held: held.length }; } };
})();
