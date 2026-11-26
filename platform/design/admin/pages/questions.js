/* AD3 Questions. States: scheduled | edit | short | noimage | regen | swap | cancel | void | emptyqueue | loading | error. Also ?day=1127 and ?q=Q-1127-2. */
(function () {
  "use strict";
  var X = Admin, D = AD, n = X.n, tag = X.tag, ic = X.ic, esc = X.esc, qs = new URLSearchParams(location.search);
  var BY = { scheduled: ["1127", "Q-1127-1"], edit: ["1127", "Q-1127-1"], swap: ["1127", "Q-1127-4"], cancel: ["1127", "Q-1127-4"], "short": ["1128", null], noimage: ["1129", "Q-1129-3"], regen: ["1129", "Q-1129-3"], "void": ["1126", "Q-1126-2"] }[X.state] || ["1126", "Q-1126-1"];
  var day = qs.get("day") || BY[0], selId = qs.get("q") || (qs.get("day") ? null : BY[1]);
  var rows = D.questions.filter(function (x) { return x.day === day; });
  if (qs.get("day") && !selId && rows.length) selId = rows[0].id;
  var sel = selId ? D.q(selId) : null, dayInfo = D.days.filter(function (d) { return d.id === day; })[0];
  var LIM = { en: { title: 70, c: 12, rule: 60 }, ko: { title: 40, c: 8, rule: 40 }, ja: { title: 40, c: 8, rule: 40 } }, LNAME = { en: "English", ko: "Korean", ja: "Japanese" };
  function len(s) { return [...s].length; }
  function url(d, q) { return "?day=" + d + (q ? "&q=" + q : ""); }

  function cal() {
    return '<nav class="cal" aria-label="Schedule, next 14 days">' + D.days.map(function (d) {
      var k = d.far ? "far" : d.n < 5 || d.img < d.n ? "warn" : "", pips = "";
      for (var i = 0; i < 5; i++) pips += '<i data-s="' + (i >= d.n ? "none" : i >= d.img ? "noimg" : "") + '"></i>';
      var m = d.far ? (d.n ? "Drafting" : "Not yet") : d.n < 5 ? (5 - d.n) + " missing" : d.img + " images";
      return '<a href="' + (D.dayLong[d.id] ? url(d.id) : "#") + '"' + (d.id === day ? ' aria-current="true"' : "") + (k ? ' data-k="' + k + '"' : "") + ' aria-label="' + d.d + ": " + d.n + " of 5 questions, " + d.img + ' with an image"><span class="d">' + (d.tag ? "<b>" + d.tag + "</b>" : d.d) + '</span><span class="n">' + d.n + '<small>/5</small></span><span class="m">' + m + '</span><span class="pips" aria-hidden="true">' + pips + "</span></a>";
    }).join("") + "</nav>" +
      '<p class="hint" style="margin-top:8px">Each bar is one of the day\'s 5 slots: filled, filled without an image (striped), or empty. The drafter runs daily at 18:00 KST and keeps the next 7 days full; later days are not expected to be filled yet. A day is written on chain at 08:30 KST and goes live at 09:00.</p>';
  }

  function dayTable() {
    var live = dayInfo.state === "Live", list = rows.slice();
    if (day === "1128") list.push({ empty: true, slot: 5 });
    var t = X.table({
      caption: "Questions on " + D.dayLong[day], rows: list, loading: X.is("loading"), error: X.is("error"), what: "The schedule", cls: "tight",
      selected: function (r) { return sel && r.id === sel.id; },
      cols: [
        { h: "Slot", w: "44px", cell: function (r) { return '<span class="nb"' + (r.empty ? ' data-k="off"' : "") + ">" + r.slot + "</span>"; } },
        { h: "Question", cell: function (r) { return r.empty ? '<span class="t1" style="color:var(--warn)">Empty slot</span><span class="t2">The drafter fills it at 18:00 today. You can also take one from the AI queue below.</span>' : '<div class="qcell">' + X.thumb(r.img) + '<div><a class="t1" href="' + url(day, r.id) + '" style="color:inherit">' + esc(r.en.title) + '</a><span class="t2">' + r.id + " · " + r.cat + "</span></div></div>"; } },
        { h: "Choices", cell: function (r) { return r.empty ? "" : '<span class="pk" data-d="l">' + esc(r.en.left) + '</span><br><span class="pk" data-d="r">' + esc(r.en.right) + "</span>"; } },
        { h: "Closes", cell: function (r) { return r.empty ? "" : '<span class="nowrap">' + r.closes + "</span>" + (r.closesIn ? '<span class="t2">in ' + X.cd(r.closesIn) + "</span>" : ""); } },
        { h: "Answer due", cell: function (r) { return r.empty ? "" : '<span class="nowrap">' + r.due + "</span>"; } },
        { h: "Image", cell: function (r) { return r.empty ? "" : tag(r.imgState); } },
        { h: "By", cell: function (r) { return r.empty ? "" : r.source; } },
        { h: "State", cell: function (r) { return r.empty ? tag("Missing", "warn") : tag(r.state); } },
        { h: "", sr: "Actions", cell: function (r) { return '<div class="row-acts">' + (r.empty ? X.btn("Fill from queue", { small: 1, act: "jump", write: 1 }) : live ? X.btn("Void", { link: 1, danger: 1, act: "void", arg: r.id, write: 1 }) : X.btn("Swap", { link: 1, act: "swap", arg: r.id, write: 1 }) + X.btn("Cancel", { link: 1, danger: 1, act: "cancelq", arg: r.id, write: 1 })) + "</div>"; } }
      ]
    });
    var note = live ? "Written on chain at 08:30 KST. A live question cannot be edited: you can replace its image or void it." : rows.length < 5 ? "Goes on chain " + dayInfo.d + " at 08:30 KST. If a slot is still empty then, the day is published with " + rows.length + " questions and nobody can earn the 100 P for finishing all 5." : "Goes on chain " + dayInfo.d + " at 08:30 KST. Until then every text, time and image can be changed. Nothing needs approval.";
    return '<section class="sec"><div class="sec-head"><h2>' + D.dayLong[day] + "</h2>" + tag(dayInfo.state) + (rows.length < 5 ? tag(rows.length + " of 5", "warn") : "") + '<span class="sec-note">' + note + "</span></div>" +
      (day === "1128" && !X.is("loading", "error") ? X.note("warn", "<b>Saturday has 4 of 5 questions.</b> The drafter threw out its fifth draft (a duplicate of Friday's gold question) and will try again at 18:00 KST today. D-2232 in the queue fits Saturday only.", X.btn("Schedule D-2232 into slot 5", { small: 1, act: "sched", arg: "D-2232", write: 1 })) + '<div style="height:12px"></div>' : "") + t + "</section>";
  }

  /* the front card as the app draws it, at 360 or 430 wide, scaled down */
  function card(q, lang) {
    var t = q[lang], long = lang === "en" ? t.title.length > 44 : t.title.length > 22;
    return '<article class="qcard" lang="' + lang + '" aria-label="Card preview">' +
      (q.img && !X.is("regen") ? '<div class="qimg"><img src="' + q.img + '" alt=""></div>' : '<div class="qimg qimg--fallback"><span class="qimg-tile">' + ic("spark", 64) + "</span></div>") +
      '<div class="qcard-top"><span class="qchip">' + q.cat + '</span><span class="qchip">' + q.slot + "/5</span></div>" +
      '<div class="qcard-body"><h5' + (long ? ' class="is-long"' : "") + ">" + esc(t.title) + '</h5><div class="qcard-meta"><span>' + esc(t.rule) + "</span><span>" + esc(t.settle) + '</span></div><div class="choices"><span class="choice">' + esc(t.left) + '</span><span class="choice" data-d="r">' + esc(t.right) + "</span></div></div></article>";
  }
  function imageBlock(q) {
    var live = q.state === "Live", regen = X.is("regen"), rejected = q.imgState === "Rejected by check";
    var longest = ["en", "ko", "ja"].sort(function (a, b) { return len(q[b].title) / LIM[b].title - len(q[a].title) / LIM[a].title; })[0];
    return '<div class="crop"><div class="acts" style="gap:8px"><div class="seg" role="group" aria-label="Preview language" data-pick="lang">' + ["en", "ko", "ja"].map(function (l) { return '<button type="button" value="' + l + '" aria-pressed="' + (l === longest) + '">' + l.toUpperCase() + "</button>"; }).join("") + '</div><div class="seg" role="group" aria-label="Preview width" data-pick="w"><button type="button" value="360" aria-pressed="true">360</button><button type="button" value="430" aria-pressed="false">430</button></div></div>' +
      '<div class="crop-stage" id="stage" data-w="360">' + card(q, longest) + "</div>" +
      '<p class="hint">The card as players see it, 4:5. Opens on ' + LNAME[longest] + ", the longest title for its limit.</p>" +
      '<div class="crop-row">' + (q.img && !regen ? '<div class="crop-src"><img src="' + q.img + '" alt="Generated image, uncropped"><span class="safe"></span><span class="text"></span></div>' : '<div class="crop-src none">' + (regen ? '<span class="spin" style="margin:auto"></span>Generating, about 40 s' : "No image in use") + "</div>") +
      '<div class="stack" style="gap:6px"><span>' + tag(regen ? "Generating" : q.imgState, regen ? "sky" : undefined) + '</span><p class="hint">Source image. The subject has to sit above the dashed line; the striped area is under the text.</p><div class="qcell">' + X.thumb(regen ? null : q.img, 1) + '<span class="hint">List thumbnail</span></div></div></div>' +
      (rejected && !regen ? X.note("down", "<b>Rejected by the check.</b> " + q.imgWhy + " The card shows the category illustration until a new image passes.") : "") +
      '<div class="acts">' + X.btn(regen ? "Generating" : "Generate again", { small: 1, act: "regen", write: 1, disabled: regen, icon: "refresh" }) + X.btn("Use category illustration", { link: 1, act: "toast", arg: "The category illustration is used for " + q.id + ".", write: 1 }) + X.btn("Upload image", { link: 1, act: "toast", arg: "Upload: 4:5, at least 800 by 1000 pixels. It passes the same check.", write: 1 }) + "</div>" +
      '<p class="hint">' + (live ? "The image is not part of the content hash, so it can still be replaced while the question is live. " : "") + "Prompts never name real people, teams, logos or trademarks.</p></div>";
  }
  function langCol(q, l, editable) {
    var t = q[l], L = LIM[l], over = X.is("edit") && l === "ko";
    var title = over ? "오늘 닛케이 225 지수는 과연 4만 선을 넘겨서 장을 마감할 수 있을까요?" : t.title;
    function f(id, label, val, max, rowsN) {
      var c = len(val), left = max - c, cid = id + "-" + l;
      var cnt = '<span class="cnt"' + (left < 0 ? " data-over" : "") + ' data-count="' + cid + '">' + (editable ? (left < 0 ? -left + " over" : left + " left") : c + "/" + max) + "</span>";
      if (!editable) return '<div class="fl"><span class="lab">' + label + cnt + '</span><p class="ro" lang="' + l + '">' + esc(val) + "</p></div>";
      return '<div class="fl"><label for="' + cid + '">' + label + cnt + "</label>" + (rowsN ? '<textarea class="inp" rows="' + rowsN + '"' : '<input class="inp"') + ' id="' + cid + '" lang="' + l + '" data-max="' + max + '"' + (left < 0 ? ' aria-invalid="true" aria-describedby="' + cid + '-e"' : "") + (rowsN ? ">" + esc(val) + "</textarea>" : ' value="' + esc(val) + '">') +
        (left < 0 ? '<p class="err" id="' + cid + '-e">' + ic("warn") + "The question is too long for the card in " + LNAME[l] + ".</p>" : "") + "</div>";
    }
    return '<div><h4>' + LNAME[l] + (l === "en" ? ' <span class="hint" style="font-weight:400">source</span>' : ' <span class="hint" style="font-weight:400">written natively</span>') + "</h4>" +
      f("title", "Question", title, L.title, 3) + '<div class="cols cols-2" style="gap:12px">' + f("left", '<span class="pk" data-d="l">Left</span>', t.left, L.c) + f("right", '<span class="pk" data-d="r">Right</span>', t.right, L.c) + "</div>" + f("rule", "Answer rule", t.rule, L.rule, 2) + f("settle", "Settle time phrase", t.settle, 24) + "</div>";
  }
  function editor(q) {
    var live = q.state === "Live", editable = !live && X.canWrite, bad = X.is("edit");
    var checks = [
      ["ok", "Can be decided from a public source", q.src[0].replace(/^https:\/\/(www\.)?/, "").split("/")[0]],
      ["ok", "Closes before the outcome can be known", "Closes " + q.closes + ", answer due " + q.due],
      ["ok", "Answer due within 24 hours after the set closes", ""],
      [bad ? "fail" : "ok", bad ? "Text does not fit the card in Korean" : "Text fits the card in all three languages", bad ? "Question 2 over" : ""],
      ["ok", "Not a repeat of the last 7 days", ""],
      [q.imgState === "Rejected by check" ? "fail" : "ok", q.imgState === "Rejected by check" ? "Image rejected: lettering that reads as a film title" : "Image: no real people, logos, trademarks or lettering", q.imgState === "Rejected by check" ? "Fallback in use" : ""]
    ];
    var head = '<div class="sec-head"><h2>' + q.id + "</h2>" + tag(q.state) + tag(q.source === "AI" ? "Drafted by AI" : "Written by hand", "line") + '<span class="sec-note">Slot ' + q.slot + " of " + D.dayLong[q.day] + '</span><span class="sec-end">' +
      (live ? X.btn("Void this question", { link: 1, danger: 1, act: "void", arg: q.id, write: 1 }) : X.btn("Cancel question", { link: 1, danger: 1, act: "cancelq", arg: q.id, write: 1 }) + X.btn("Swap with a draft", { act: "swap", arg: q.id, write: 1 }) + X.btn("Save changes", { primary: 1, act: "toast", arg: "Saved " + q.id + ". The three language texts and times are stored.", write: 1, disabled: bad })) + "</span></div>";
    var meta = '<div class="cols cols-2 split" style="margin-top:24px"><div>' + X.kv([
      ["Category", editable ? '<select class="inp" style="width:180px" aria-label="Category">' + ["Crypto", "Markets", "Weather", "Sports", "Culture"].map(function (c) { return "<option" + (c === q.cat ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select>" : q.cat],
      ["Closes", editable ? '<input class="inp" style="width:180px" aria-label="Closes at, KST" value="' + q.closes + '"><span class="hint" style="display:block;margin-top:4px">KST. Default is the set close, 09:00 next day.</span>' : q.closes + " KST" + (q.closesIn ? ' <span class="dim">in ' + X.cd(q.closesIn) + "</span>" : "")],
      ["Answer due", editable ? '<input class="inp" style="width:180px" aria-label="Answer due, KST" value="' + q.due + '"><span class="hint" style="display:block;margin-top:4px">KST. At most 24 hours after the set closes.</span>' : q.due + " KST"],
      ["Resolve rule", editable ? '<textarea class="inp" rows="3" aria-label="Resolve rule">' + esc(q.resolve) + "</textarea>" : esc(q.resolve)],
      ["Source", q.src.map(function (s) { return editable ? '<input class="inp" aria-label="Source URL" value="' + esc(s) + '">' : '<a href="' + esc(s) + '" target="_blank" rel="noopener">' + esc(s) + "</a>"; }).join("")]
    ]) + '</div><div><div class="sec-head" style="min-height:0"><h3 class="sub" style="margin:0">AI checks</h3><span class="sec-end">Confidence <b class="num-d" style="font-size:16px;margin-left:6px">' + q.conf.toFixed(2) + '</b></span></div><ul class="chk">' + checks.map(function (c) { return '<li data-s="' + c[0] + '">' + ic(c[0] === "ok" ? "ok" : "no") + "<span>" + c[1] + '</span><span class="v">' + c[2] + "</span></li>"; }).join("") + "</ul>" +
      '<p class="hint" style="margin-top:8px">Confidence is the drafter\'s own estimate that the answer can be set from the source without a person. Below 0.90 the question is listed in Answers for a look after it resolves.</p></div></div>';
    return '<section class="sec" id="editor">' + head + (live ? X.note("", "<b>Live questions cannot be edited.</b> The texts, times and rule are fixed by the content hash on chain. If the question is wrong, void it: it pays no hit points and a pick on it still counts toward the 5.") + '<div style="height:16px"></div>' : "") +
      '<div class="editor">' + imageBlock(q) + '<div><div class="langs">' + ["en", "ko", "ja"].map(function (l) { return langCol(q, l, editable); }).join("") + "</div>" + meta + "</div></div></section>";
  }

  function queue() {
    var list = X.is("emptyqueue") ? [] : D.queue;
    return '<section class="sec" id="queue"><div class="sec-head"><h2>AI queue</h2><span class="nb">' + list.length + '</span><span class="sec-note">Drafts that are written and checked but not on a day yet. Nothing here needs approval: scheduling is automatic.</span><span class="sec-end">' + X.btn("Add question", { act: "toast", arg: "A blank question form opens here.", write: 1 }) + X.btn("Assign 5 per day", { act: "assign", write: 1 }) + "</span></div>" +
      X.table({
        caption: "AI queue", rows: list, cls: "tight", sort: [5, "desc"],
        empty: X.empty("The queue is empty", "Every draft is on a day. The drafter writes new ones at 18:00 KST. If a day is short before then, add a question by hand.", X.btn("Add question", { act: "toast", arg: "A blank question form opens here.", write: 1 }) + X.btn("Run the drafter now", { link: 1, act: "toast", arg: "Question drafter started.", write: 1 })),
        cols: [
          { h: "Draft", val: function (r) { return r.title; }, cell: function (r) { return '<div class="qcell">' + X.thumb(r.img) + '<div><span class="t1">' + esc(r.title) + '</span><span class="t2">' + r.id + " · " + r.cat + " · " + esc(r.l) + " / " + esc(r.r) + "</span></div></div>"; } },
          { h: "Answer rule and source", cell: function (r) { return esc(r.rule) + '<span class="t2">' + r.src + "</span>"; } },
          { h: "Fits", cell: function (r) { return r.fits; } },
          { h: "Image", cell: function (r) { return tag(r.imgState); } },
          { h: "Confidence", num: 1, val: function (r) { return r.conf; }, cell: function (r) { return r.conf.toFixed(2) + (r.conf < 0.9 ? " " + tag("Low", "warn") : ""); } },
          { h: "Drafted", val: function (r) { return r.id; }, cell: function (r) { return r.drafted; } },
          { h: "", cell: function (r) { return '<div class="row-acts">' + X.btn("Schedule", { small: 1, act: "sched", arg: r.id, write: 1 }) + X.btn("Edit", { link: 1, act: "toast", arg: "The editor opens on " + r.id + ".", write: 1 }) + X.btn("Discard", { link: 1, danger: 1, act: "discard", arg: r.id, write: 1 }) + "</div>"; } }
        ]
      }) + "</section>";
  }

  function swapSheet(id) {
    var q = D.q(id);
    X.sheet({ title: "Swap " + id + " with a draft", wide: 1, body: "<p>" + esc(q.en.title) + " goes back to the queue. The draft you pick takes slot " + q.slot + " of " + D.dayLong[q.day] + ".</p>" +
      '<div role="radiogroup" aria-label="Draft to schedule">' + D.queue.slice(0, 4).map(function (d, i) { return '<label class="qcell" style="padding:8px 0;border-bottom:var(--hair);cursor:pointer"><input type="radio" name="swap"' + (i === 0 ? " checked autofocus" : "") + ">" + X.thumb(d.img) + '<span><span class="t1" style="font-weight:700;display:block">' + esc(d.title) + '</span><span class="dim" style="font-size:12.5px">' + d.id + " · " + d.cat + " · fits: " + d.fits + " · confidence " + d.conf.toFixed(2) + "</span></span></label>"; }).join("") + "</div>",
      action: '<button type="button" class="btn btn-primary" data-confirm="Swapped. ' + id + ' is back in the queue.">Swap</button>' });
  }
  function cancelSheet(id) {
    var q = D.q(id);
    X.confirm({ title: "Cancel " + id + "?", body: "<p>" + esc(q.en.title) + "</p><p>The question is removed from " + D.dayLong[q.day] + " and discarded. Slot " + q.slot + " becomes empty: the drafter fills it at 18:00 KST, or you schedule a draft now.</p>", placeholder: "Why is this question removed?", action: "Cancel the question", cancel: "Keep it", done: id + " cancelled. Slot " + q.slot + " is empty." });
  }
  function voidSheet(id) {
    var q = D.q(id), p = q.picks ? q.picks[0] + q.picks[1] : 0;
    X.confirm({ title: "Void " + id + " while it is live?", body: "<p>" + esc(q.en.title) + "</p>" + X.kv([["Picks so far", n(p) + " players"], ["Hit points", "None will be paid on this question"], ["The day's 100 P", "A pick on it still counts toward the 5"], ["Players see", "Cancelled, in Results"]]) + X.note("warn", "<b>This cannot be undone.</b> A voided question stays in the set until it closes and cannot be reopened."),
      placeholder: "What is wrong with the question?", signer: "Sent with the operator key through the worker. No owner signature.", action: "Void the question", cancel: "Keep it live", done: id + " voided. It pays no hit points." });
  }
  X.acts.swap = swapSheet; X.acts.cancelq = cancelSheet; X.acts["void"] = voidSheet;
  X.acts.toast = function (m) { X.toast(m); };
  X.acts.regen = function () { X.go("regen"); };
  X.acts.jump = function () { document.getElementById("queue").scrollIntoView({ behavior: "smooth" }); };
  X.acts.sched = function (id) { X.toast(id + " scheduled into Sat 28 Nov, slot 5."); };
  X.acts.discard = function (id) { X.confirm({ title: "Discard draft " + id + "?", reason: false, body: "<p>The draft and its image are deleted. The drafter may write a similar question again on another day.</p>", action: "Discard the draft", cancel: "Keep it", done: id + " discarded." }); };
  X.acts.assign = function () { X.confirm({ title: "Assign 5 per day?", reason: false, body: "<p>Fills every empty slot of the next 7 days from the queue, oldest draft first, keeping each draft on a day it fits. Right now that is 1 slot: Sat 28 Nov, slot 5, with D-2232.</p>", action: "Assign", done: "1 slot filled: D-2232 into Sat 28 Nov, slot 5." }); };
  X.acts.lang = function (l) { var st = document.getElementById("stage"); st.innerHTML = card(sel, l); };
  X.acts.w = function (w) { document.getElementById("stage").dataset.w = w; };

  X.mount({
    page: "questions", title: "Questions", sub: "Drafted, illustrated and scheduled by AI. You correct, swap, cancel or void.", states: ["scheduled", "edit", "short", "noimage", "regen", "swap", "cancel", "void", "emptyqueue", "loading", "error"],
    render: function () {
      return '<section class="sec" style="padding-bottom:20px"><div class="sec-head"><h2>Schedule</h2><span class="sec-note">5 questions a day. 7 of the next 7 days are drafted, 2 need attention.</span><span class="sec-end"><label class="search"><span class="sr">Search questions</span>' + ic("search") + '<input class="inp" type="search" placeholder="Search id, text or source"></label></span></div>' + cal() + "</section>" +
        dayTable() + (X.is("loading", "error") ? "" : (sel ? editor(sel) : "") + queue());
    },
    after: function () {
      if (X.is("swap")) swapSheet(selId); if (X.is("cancel")) cancelSheet(selId); if (X.is("void")) voidSheet(selId);
    }
  });
})();
