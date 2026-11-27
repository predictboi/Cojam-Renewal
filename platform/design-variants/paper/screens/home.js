/* Home, card view: the front page. Each pick can be undone for 3 seconds (the bar under the deck), then it is sent.
   The behaviour is the one of platform/design/home-cards.html; the page is drawn new. */
(function () {
  var t = App.t, S = App.state, M = MOCK, $ = App.$;
  var UNDO_MS = 3000;
  var sess = App.sess, live = S === "" || S === "fresh";   /* only the plain screen carries real progress; every other state is a fixed preset */
  function dropFresh() { try { var u = new URL(location.href); u.searchParams.delete("state"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {} }
  window.addEventListener("pageshow", function (e) { if (e.persisted) location.reload(); });
  if (S === "fresh") { sess.resetDay(); S = ""; dropFresh(); }
  var leftSaved = live ? sess.takeLeft() : 0;
  var fin = live && sess.picked() === 5;
  var answered = { partial: [1, 2], syncing: [1, 2, 3], slow: [1, 2], failed: [1, 3], offline: [1, 2], reconnect: [1], reconnectfail: [1] }[S] || [];
  if (live) answered = M.set.map(function (id, i) { return sess.data.picks[id] ? i + 1 : 0; }).filter(Boolean);
  var sending = S === "syncing" ? [2, 3] : S === "slow" ? [2] : [];
  var Q = M.set.map(App.q);
  var segs = Q.map(function (q) { return sending.indexOf(q.n) >= 0 ? "pend" : answered.indexOf(q.n) >= 0 ? "done" : (S === "failed" && q.n === 2 ? "fail" : ""); });
  var count = answered.length;
  App.store.set("view", "card");

  /* the head: the page title with the view switch, then the count and the five boxes. The time left is on the dateline. */
  function head() {
    return '<div class="ph-top"><h1>' + t("h.title") + "</h1>" + C.viewSwitch("card", S) + "</div>" +
      /* progress is shown once, as the five boxes (the card carries its own number); the count is kept for screen readers */
      '<div class="ph-line"><span class="sr-only"><span id="cnt">' + (S === "loading" ? "0" : count) + "</span>/5</span>" + C.day5(S === "loading" ? ["", "", "", "", ""] : segs, { id: "day5" }) + "</div>";
  }
  function liveCell() { if (fin) return C.count("d.next", M.untilNextSet());   /* the day is done: what counts now is the next set */
    return S === "empty" || S === "closed" || S === "hold" || S === "otherdevice" ? "" : S === "loading" ? C.skel("96px", "12px") : C.closes(M.untilNextSet()); }
  /* the wait before the day is sent is a printer's rule that is used up from the right: the same fuse as under the pick bar */
  function endRing(id) { return '<div class="end-mark" aria-hidden="true">' + C.icon("check", 30) + '</div><span class="fuse fuse--end" aria-hidden="true"' + (id ? ' id="' + id + '"' : "") + "></span>"; }
  function body() {
    if (S === "loading") return '<div class="deck" aria-busy="true"><div class="qcard" data-pos="0"><div class="qcard-top">' + C.skel("64px", "12px") + C.skel("72px", "12px") + '</div><div class="qimg"></div><div class="qcard-body">' + C.skel("92%", "24px") + C.skel("60%", "24px") +
      C.skel("100%", "40px") + '<div class="choices">' + C.skel("100%", "54px") + C.skel("100%", "54px") + '</div></div></div></div><p class="sr-only" role="status">' + t("common.loading") + "</p>";
    if (S === "empty") return C.empty({ icon: "clock", title: t("h.empty.h"), body: t("h.empty.b", { time: t("time.kst9") }), extra: '<p class="fig" data-dg data-cd="' + M.untilNextSet() + '"></p>' });
    if (S === "closed") return C.empty({ icon: "refresh", title: t("h.closed"), action: C.btn(t("h.closed.btn"), { kind: "primary", href: "home.html" }) });
    if (S === "error") return C.error();
    if (S === "otherdevice") return C.otherDevice();
    /* account on hold: no deck and no answer buttons, so nothing on the screen is dead */
    if (S === "hold") return C.empty({ icon: "pause", title: t("hold.home.h"), body: t("hold.home.b"), action: C.btn(t("hold.home.btn"), { href: "system.html?state=blocked", iconEnd: "right", id: "hold-more" }) });
    if (fin) return '<div class="deck is-empty home-fin"><div class="deck-end">' + endRing() + "<h2>" + t("h.end.h") + "</h2><p>" + t("h.fin.b") + "</p>" + C.btn(t("h.fin.btn"), { kind: "primary", href: sess.data.paid ? "done.html" : "done.html?state=moment", iconEnd: "right" }) + "</div></div>";
    var cards = Q.filter(function (q) { return answered.indexOf(q.n) < 0; });
    if (S === "failed") cards.sort(function (a, b) { return (a.n === 2 ? -1 : 0) - (b.n === 2 ? -1 : 0); });
    return C.playBanner(S) +
      '<div class="deck" id="deck"><div class="deck-end" id="deck-end" aria-hidden="true">' + endRing("end-run") + "<h2>" + t("h.end.h") + '</h2><p id="end-p"></p><div id="end-act"></div></div>' +
      cards.map(function (q) { return C.qcard(q.id, { failed: S === "failed" && q.n === 2, disabled: App.offline, noimg: S === "noimage" && q.n === 1, final: true }); }).join("") + "</div>";
  }
  /* the pick bar (the hint, then the pick with Undo and its fuse) is pinned directly above the tab bar, outside the scrolling area: Undo is on screen at every size */
  var hasDeck = !fin && ["loading", "empty", "closed", "error", "otherdevice", "hold"].indexOf(S) < 0;

  App.mount({ tab: "home", cls: "is-home" + (App.offline ? " is-offline" : ""), docTitle: t("h.title"), live: liveCell(), head: head(), body: body(), pin: hasDeck ? '<div class="pin pickbar" id="pickbar"></div>' : "", badges: { home: 5 - count && S !== "hold" ? "dot" : 0, results: 2 }, after: function () {
    var deckEl = $("#deck"); if (!deckEl) return;
    var day5 = $("#day5"), cnt = $("#cnt"), bar = $("#pickbar");
    if (S === "failed") { App.toast(t("h.toast.fail", { n: 2 }), { btn: t("common.retry") }); }
    if (leftSaved) App.toast(leftSaved > 1 ? t("h.left.savedn", { n: leftSaved }) : t("h.left.saved"));

    var held = [], shown = null, fade, leaving = false;
    function label(p) { return t("h.sync", { n: p.n, choice: C.pick(p.dir, App.esc(App.q(p.id)[p.dir])) }); }
    function seg(n, cls) { day5.children[n - 1].className = cls; }
    var canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
    function rest() {
      if (App.offline) return "";
      var left = 5 - count;
      if (count === 0) return '<span class="pickbar-hint is-swipe">' + C.icon("left", 14) + "<span>" + t(canHover ? "h.hint.keys" : "h.hint.touch") + "</span>" + C.icon("right", 14) + "</span>";
      return left ? '<span class="pickbar-hint"><span>' + t("h.left", { n: left }) + "</span></span>" : "";
    }
    var endEl = $("#deck-end"), endP = $("#end-p"), endRun = $("#end-run"), endAct = $("#end-act"), endT, endFor = null;
    /* the button exists only while there is a wait to end, so the home screen carries no blue at rest */
    function finishBtn(on) { if (on === !!endAct.firstChild) return; endAct.innerHTML = on ? C.btn(t("h.end.now"), { kind: "primary", id: "finish" }) : ""; }
    function endPanel() {
      var p = held[held.length - 1], on = count === 5 && !!deck && !deck.live().length;
      endEl.setAttribute("aria-hidden", on ? "false" : "true");
      clearInterval(endT);
      if (!on) { endFor = null; finishBtn(false); return; }
      if (!p) { endP.textContent = t("h.end.b"); endRun.innerHTML = ""; finishBtn(false); endFor = null; return; }
      finishBtn(true);
      if (endFor !== p) { endFor = p; endRun.innerHTML = '<i style="--gone:-' + (Date.now() - p.t0) + 'ms"></i>'; }   /* a new rule for the newest pick, already used up by the time that has passed */
      function tick() { endP.innerHTML = t("h.end.in", { n: "<b>" + Math.max(1, Math.ceil((UNDO_MS - (Date.now() - p.t0)) / 1000)) + "</b>" }); }
      tick(); endT = setInterval(tick, 100);
    }
    function render() {
      endPanel();
      clearTimeout(fade);
      var p = held[held.length - 1];
      if (p) {
        /* the Undo of the same pick stays in place, so a finger already on Undo never loses its tap */
        if (bar._held === p && $("#undo", bar)) return;
        bar._held = p;
        var gone = Date.now() - p.t0, wasOnUndo = document.activeElement && document.activeElement.id === "undo";
        /* the 3 seconds are a rule across the top of the bar, used up from the right; when it is gone the pick goes to press */
        bar.innerHTML = '<span class="fuse" aria-hidden="true"><i style="--gone:-' + gone + 'ms"></i></span>' +
          '<span class="pickbar-msg" id="pick-msg">' + C.icon("check", 16) + "<span>" + label(p) + "</span></span>" +
          '<button type="button" class="undo" id="undo" aria-label="' + App.esc(t("h.undo.aria", { n: p.n, choice: App.q(p.id)[p.dir] })) + '">' + C.icon("undo", 18) + "<span>" + t("h.undo") + '</span><kbd aria-hidden="true">Z</kbd></button>';
        /* after a pick made with the keyboard or a screen reader (the focus was in the card or on Undo), Undo is where the focus goes next */
        if (p.focusUndo || wasOnUndo) { p.focusUndo = false; var ub = $("#undo", bar); if (ub) ub.focus({ preventScroll: true }); }
        return;
      }
      bar._held = null;
      if (shown && shown.state === "saving") { bar.innerHTML = '<span class="pickbar-msg is-quiet" role="status"><span class="spin"></span><span>' + t("common.saving") + " " + label(shown) + "</span></span>"; return; }
      if (shown && shown.state === "saved") {
        bar.innerHTML = '<span class="pickbar-msg is-quiet" role="status">' + C.icon("check", 16) + "<span>" + t("h.saved") + " " + label(shown) + "</span></span>";
        fade = setTimeout(function () { var m = $(".pickbar-msg", bar); if (m) m.classList.add("is-out"); fade = setTimeout(function () { if (!held.length && shown && shown.state === "saved") { shown = null; render(); } }, 400); }, 1200);
        return;
      }
      bar.innerHTML = rest();
    }
    function finishDay(now) { if (count === 5 && !held.length && !leaving) { leaving = true; setTimeout(function () { location.href = "done.html?state=moment"; }, now || App.reduce ? 0 : 500); } }
    function finishNow() { held.slice().forEach(function (p) { clearTimeout(p.timer); held.splice(held.indexOf(p), 1); p.state = "saving"; shown = p; }); render(); finishDay(true); }
    window.addEventListener("pagehide", function () { if (live && held.length && !leaving) sess.leave(held.length); });
    function send(p) {
      held.splice(held.indexOf(p), 1);
      p.state = "saving"; shown = p; render();
      if (!held.length) App.live(t("pp.final"));   /* the window has closed: the announcement no longer offers Undo */
      setTimeout(function () { p.state = "saved"; seg(p.n, "is-done"); if (shown === p) render(); }, 900 + Math.random() * 500);
      finishDay();
    }
    var deck = App.deck(deckEl, {
      disabled: function () { return App.offline; },
      onBlocked: function () { App.toast(t("h.offline"), { key: "offline" }); },
      onCommit: function (n, dir, remaining, card) {
        var ae = document.activeElement, p = { n: n, id: card.getAttribute("data-id"), dir: dir, card: card, t0: Date.now(), state: "held", focusUndo: !!ae && (ae.id === "undo" || card.contains(ae) || keyPick) };
        keyPick = false;
        held.forEach(resume);   /* an earlier pick whose fuse was waiting on a focused Undo runs on: only the newest pick can be held */
        p.timer = setTimeout(function () { send(p); }, UNDO_MS);
        held.push(p);
        if (live) { sess.data.picks[p.id] = dir; sess.save(); }
        stopNudge();
        seg(n, "is-pend"); count++; cnt.textContent = count;
        render();
        App.live(t("pp.live.picked", { choice: App.q(p.id)[dir] }));   /* short enough to be heard inside the 3 seconds */
        /* the fifth pick: the day done page opens at once (the throw is still on screen for a moment). Its Undo stays open there for what is left of the 3 seconds. */
        if (count === 5 && !leaving) { leaving = true; setTimeout(function () { location.href = "done.html?state=moment&undo=" + Math.max(0, UNDO_MS - (Date.now() - p.t0)) + "&q=" + p.id; }, App.reduce ? 0 : 320); }
      }
    });
    /* The fuse waits while Undo has keyboard focus (a screen reader or keyboard user is on it), never on hover or touch. It runs on when the focus leaves.
       The rule itself stays: once the fuse is out the pick is sent and is final. */
    var keyPick = false;
    function pause(p) { if (!p || p.paused || p.state !== "held") return; p.paused = true; clearTimeout(p.timer); p.left = Math.max(300, UNDO_MS - (Date.now() - p.t0)); var f = $(".fuse i", bar); if (f) f.style.animationPlayState = "paused"; }
    function resume(p) { if (!p || !p.paused) return; p.paused = false; p.t0 = Date.now() - (UNDO_MS - p.left); p.timer = setTimeout(function () { send(p); }, p.left); var f = $(".fuse i", bar); if (f) f.style.animationPlayState = ""; }
    bar.addEventListener("focusin", function (e) { var u = e.target.closest && e.target.closest("#undo"); if (u && u.matches(":focus-visible")) pause(held[held.length - 1]); });
    bar.addEventListener("focusout", function (e) { if (e.target.closest && e.target.closest("#undo")) setTimeout(function () { if (!document.activeElement || document.activeElement.id !== "undo") held.forEach(resume); }, 0); });
    document.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft" || e.key === "ArrowRight") keyPick = true; }, true);
    function undo() {
      var p = held.pop(); if (!p) return;
      clearTimeout(p.timer);
      if (live) { delete sess.data.picks[p.id]; sess.save(); }
      seg(p.n, ""); count--; cnt.textContent = count;
      deck.restore(p.card, p.dir);
      render();
      App.live(t("h.undone", { n: p.n }));
    }
    bar.addEventListener("click", function (e) { if (e.target.closest("#undo")) undo(); });
    endAct.addEventListener("click", function (e) { if (e.target.closest("#finish")) finishNow(); });
    document.addEventListener("keydown", function (e) {
      if ((e.key !== "z" && e.key !== "Z" && e.key !== "Backspace") || e.repeat || e.altKey || e.ctrlKey || e.metaKey || !held.length || $("#sheet-root.is-open")) return;
      var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      e.preventDefault(); undo();
    });
    /* the very first card a player ever sees leans right, then left, once: it teaches the throw. Never under reduced motion, never again. */
    var nudge = [], nudgeT = [], STEP = "steps(1, end)", PR = "rotate(-7deg) scale(0.86)", PL = "rotate(7deg) scale(0.86)";
    function stopNudge() { nudge.forEach(function (a) { try { a.cancel(); } catch (e) {} }); nudge = []; nudgeT.forEach(clearTimeout); nudgeT = []; App.$$(".choice.is-hot", deckEl).forEach(function (b) { b.classList.remove("is-hot"); }); deckEl.removeAttribute("data-nudge"); }
    if (live && count === 0 && !App.reduce && !App.offline && App.store.get("nudged", "") !== "1") {
      setTimeout(function () {
        var card = $('.qcard[data-pos="0"]', deckEl); if (!card || count || card.classList.contains("is-drag") || !card.animate) return;
        App.store.set("nudged", "1"); deckEl.setAttribute("data-nudge", "1");
        var o = { duration: 1500, easing: "cubic-bezier(0.45, 0, 0.25, 1)" };
        nudge = [card.animate([{ transform: "none" }, { transform: "translateX(34px) rotate(2.6deg)", offset: 0.24 }, { transform: "translateX(34px) rotate(2.6deg)", offset: 0.4 }, { transform: "translateX(-34px) rotate(-2.6deg)", offset: 0.68 }, { transform: "translateX(-34px) rotate(-2.6deg)", offset: 0.82 }, { transform: "none" }], o),
          /* each lean shows the answer of that side as a proof stamp at full strength (ink on the sheet, no faint text). It steps in and out, never half visible,
             and the answer button on that side lights for the same moment. */
          $(".qstamp--r", card).animate([{ opacity: 0, transform: PR, easing: STEP }, { opacity: 1, transform: PR, offset: 0.12, easing: STEP }, { opacity: 0, transform: PR, offset: 0.46, easing: STEP }, { opacity: 0, transform: PR }], { duration: 1500 }),
          $(".qstamp--l", card).animate([{ opacity: 0, transform: PL, easing: STEP }, { opacity: 1, transform: PL, offset: 0.58, easing: STEP }, { opacity: 0, transform: PL, offset: 0.9, easing: STEP }, { opacity: 0, transform: PL }], { duration: 1500 })];
        var cr = $('.choice[data-dir="r"]', card), cl = $('.choice[data-dir="l"]', card);
        nudgeT = [setTimeout(function () { cr.classList.add("is-hot"); }, 180), setTimeout(function () { cr.classList.remove("is-hot"); }, 690), setTimeout(function () { cl.classList.add("is-hot"); }, 870), setTimeout(function () { cl.classList.remove("is-hot"); }, 1350)];
        nudge[0].onfinish = stopNudge;
      }, 700);
    }
    deckEl.addEventListener("pointerdown", stopNudge, true);
    document.addEventListener("keydown", stopNudge, true);
    render();
    deckEl.focus({ preventScroll: true });

    document.addEventListener("click", function (e) {
      if (!e.target.closest("[data-retry-now]")) return;
      setTimeout(function () { seg(2, "is-done"); var b = $(".banner"); if (b) b.remove(); }, 900);
    });
    if (sending.length) { shown = { n: sending[sending.length - 1], id: "q" + sending[sending.length - 1], dir: "r", state: "saving" }; render(); }
    if (S !== "slow") sending.forEach(function (n, i) { setTimeout(function () { seg(n, "is-done"); if (shown && shown.n === n) { shown.state = "saved"; render(); } }, 2600 + i * 1400); });
  } });
})();
