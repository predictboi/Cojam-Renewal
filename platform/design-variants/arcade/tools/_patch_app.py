import re,io
p='assets/app.js'; s=open(p,encoding='utf8').read()
def rep(a,b,cnt=1):
    global s
    assert a in s, a[:60]
    s=s.replace(a,b,cnt)
def resub(pat,b):
    global s
    n=len(re.findall(pat,s,flags=re.S)); assert n==1,(pat[:50],n)
    s=re.sub(pat,lambda m:b,s,flags=re.S)

resub(r'/\* Cojam Daily Prediction, variant "Daily Paper".*?\*/', '''/* Cojam Daily Prediction, variant "Pocket Arcade": behaviour and the shared app shell.
   Screens call App.mount({...}) with HTML built from the C.* helpers, so every screen uses the same header, dock, buttons, cards, sheets and toasts.
   The behaviour (deck, undo, sheets, transactions, countdowns, QR) is carried over from platform/design/assets/components.js;
   the builders, the illustrations, the mascot and the shell are drawn new for this concept. Mock only: nothing here talks to a chain or a server. */''')
rep('stroke-width="2" stroke-linecap','stroke-width="2.4" stroke-linecap')
rep('stroke="var(--paper)"','stroke="var(--card)"',4)

# day5 comment, pick, rstamp comments
rep('/* the day in five numbered boxes, like the squares of a puzzle page: empty, hatched while a pick is being saved, inked when it is in.','/* the day as a sticker sheet of five numbered slots: an empty well, a sticker half pressed while a pick is being saved, a full sticker when it is in.')
rep("/* a made pick, wherever it is shown, carries the ink of its answer (persimmon left, teal right) as a small printed block */","/* a made pick, wherever it is shown, carries the colour of its answer (coral left, mint right) as a small token with the side it was thrown to */")
rep("""C.pick = function (dir, text) { return '<span class="pk pk--' + dir + '"><i aria-hidden="true"></i>' + text + "</span>"; };""",
"""C.pick = function (dir, text) { return '<span class="pk pk--' + dir + '"><i aria-hidden="true">' + ic(dir === "l" ? "left" : "right", 12) + "</i>" + text + "</span>"; };""")
rep("/* a result as a rubber stamp: hit (blue, the reward), miss (hollow ink), corr (blue outline) */","/* a result as a sticker: hit (yellow, the reward), miss (a peeled off outline), corr (blue, corrected) */")

# logo
resub(r"/\* the nameplate:.*?C\.logo = function \(big\) \{.*?\};", """/* the wordmark: the Cojam mark and the name. It is a logo, so it is the same in every language. */
  C.logo = function (big) { return '<span class="plate' + (big ? " plate--big" : "") + '" translate="no"><img src="assets/cojam-mark.svg" alt="" width="' + (big ? 44 : 32) + '" height="' + (big ? 44 : 32) + '"><span>Cojam</span></span>'; };""")

# art + mascot + qcard
resub(r"var CAT_ICON = .*?/\* the view switch on the home head", r'''/* ---------- illustration: one bold picture per category, drawn from four flat shapes or fewer ----------
     Blue, yellow, white and ink only: coral and mint are never used here, because they only ever mean the left and the right answer.
     Every picture keeps its subject inside the middle square of a 320 x 200 field, so the same drawing crops to a square thumb. */
  var D = 'font-family="var(--font-display)" text-anchor="middle"';
  function coin(cx, cy, r, face, side, glyph, ink) {
    return '<circle cx="' + cx + '" cy="' + (cy + 9) + '" r="' + r + '" fill="var(' + side + ')"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(' + face + ')"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 11) + '" fill="none" stroke="var(' + side + ')" stroke-width="4"/>' +
      '<text x="' + cx + '" y="' + (cy + r * 0.36) + '" font-size="' + Math.round(r * 1.05) + '" fill="var(' + (ink || "--ink") + ')" ' + D + ">" + glyph + "</text>";
  }
  function spark(x, y, s, c) { return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10z" fill="var(' + (c || "--white") + ')"/>'; }
  var ART = {
    crypto: { bg: "accent-tint", d: coin(160, 96, 62, "--sun", "--sun-deep", "B") + spark(66, 52, 1.5) + spark(262, 142, 1.1) + spark(250, 40, 0.8, "--accent") },
    kaia: { bg: "accent-tint", d: coin(140, 104, 56, "--white", "--edge-deep", "K", "--accent") +
      '<path d="M216 150V74" stroke="var(--accent-deep)" stroke-width="22" stroke-linecap="round" transform="translate(0 7)"/><path d="M190 96l26-28 26 28" fill="none" stroke="var(--accent-deep)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 7)"/>' +
      '<path d="M216 150V74" stroke="var(--sun)" stroke-width="22" stroke-linecap="round"/><path d="M190 96l26-28 26 28" fill="none" stroke="var(--sun)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>' + spark(74, 44, 1.2) },
    markets: { bg: "sun-tint", d: '<g transform="translate(0 8)" fill="var(--accent-deep)"><rect x="88" y="112" width="40" height="52" rx="12"/><rect x="140" y="84" width="40" height="80" rx="12"/><rect x="192" y="48" width="40" height="116" rx="12"/></g>' +
      '<g fill="var(--accent)"><rect x="88" y="112" width="40" height="52" rx="12"/><rect x="140" y="84" width="40" height="80" rx="12"/><rect x="192" y="48" width="40" height="116" rx="12"/></g>' +
      '<path d="M84 84l42-30 32 14 44-38" fill="none" stroke="var(--ink)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="204" cy="29" r="11" fill="var(--sun)" stroke="var(--ink)" stroke-width="7"/>' + spark(262, 96, 1.1) },
    weather: { bg: "sky", d: '<g stroke="var(--sun)" stroke-width="13" stroke-linecap="round"><path d="M190 18v14M246 42l-10 10M134 42l10 10M262 96h-14"/></g><circle cx="190" cy="96" r="44" fill="var(--sun)"/>' +
      '<path d="M96 168a30 30 0 0 1 4-60 42 42 0 0 1 78 10 26 26 0 0 1 2 50z" fill="var(--edge-deep)" transform="translate(0 8)"/><path d="M96 168a30 30 0 0 1 4-60 42 42 0 0 1 78 10 26 26 0 0 1 2 50z" fill="var(--white)"/>' },
    sports: { bg: "accent", d: '<circle cx="160" cy="109" r="62" fill="var(--accent-deep)"/><circle cx="160" cy="100" r="62" fill="var(--white)"/>' +
      '<g fill="var(--ink)"><path d="M160 76l23 17-9 27h-28l-9-27z"/><path d="M160 38l20 8-20 14-20-14zM222 92l-3 22-22-13 5-20zM98 92l3 22 22-13-5-20zM196 150l-19 11-3-22 16-9zM124 150l19 11 3-22-16-9z"/></g>' + spark(62, 48, 1.4, "--sun") + spark(264, 150, 1, "--sun") },
    culture: { bg: "sun", d: '<g transform="translate(0 8)" fill="var(--sun-deep)"><rect x="92" y="84" width="136" height="84" rx="16"/></g><rect x="92" y="84" width="136" height="84" rx="16" fill="var(--ink)"/>' +
      '<g transform="rotate(-12 96 80)"><rect x="90" y="48" width="140" height="30" rx="10" fill="var(--ink)"/><path d="M108 48h18l-12 30H96zM148 48h18l-12 30h-18zM188 48h18l-12 30h-18z" fill="var(--white)"/></g>' +
      '<path d="M146 108v38l34-19z" fill="var(--white)"/>' }
  };
  App.artKey = function (q) { return q.id === "q5" ? "kaia" : ART[q.cat] ? q.cat : "crypto"; };
  C.art = function (q) {
    var a = ART[App.artKey(q)];
    return '<svg class="art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + a.d + "</svg>";
  };
  C.artBg = function (q) { return ART[App.artKey(q)].bg; };
  /* ---------- the mascot: Jam, a small blue blob that lives in the capsules. Used sparingly: sign in, empty states, the reward.
     moods: "" (smile), "cheer" (arms up, mouth open), "sleep" (eyes shut) */
  C.jam = function (mood, size) {
    size = size || 96;
    var eyes = mood === "sleep" ? '<path d="M35 55q7 6 14 0M63 55q7 6 14 0" fill="none" stroke="var(--white)" stroke-width="5" stroke-linecap="round"/>' :
      '<ellipse cx="42" cy="52" rx="9" ry="11" fill="var(--white)"/><ellipse cx="70" cy="52" rx="9" ry="11" fill="var(--white)"/><circle cx="44" cy="54" r="4.5" fill="var(--ink)"/><circle cx="72" cy="54" r="4.5" fill="var(--ink)"/>';
    var mouth = mood === "cheer" ? '<path d="M47 71h18a9 9 0 0 1-18 0z" fill="var(--ink)"/>' : mood === "sleep" ? '<circle cx="56" cy="74" r="3.5" fill="var(--ink)"/>' : '<path d="M48 71q8 8 16 0" fill="none" stroke="var(--ink)" stroke-width="4.5" stroke-linecap="round"/>';
    var arms = mood === "cheer" ? '<path d="M18 52L6 30M94 52l12-22" stroke="var(--accent)" stroke-width="11" stroke-linecap="round"/>' : "";
    return '<svg class="jam' + (mood ? " jam--" + mood : "") + '" viewBox="0 0 112 112" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' + arms +
      '<path d="M38 100v6M74 100v6" stroke="var(--accent-deep)" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M56 16c26 0 42 18 42 46 0 26-14 40-42 40S14 88 14 62c0-28 16-46 42-46z" fill="var(--accent)"/>' +
      '<path d="M30 38q8-12 22-13" fill="none" stroke="var(--accent-tint)" stroke-width="5" stroke-linecap="round" opacity=".55"/>' + eyes + mouth + "</svg>";
  };
  /* the question card: a collectible card. The picture on its flat ground with the number and the category, the question, how it is answered,
     and the two answers as two chunky keys. The two stickers (one per answer) wait above the picture and are slapped on by a pick. */
  C.qcard = function (id, o) {
    o = o || {};
    var q = App.q(id);
    var long = /[　-鿿가-힯]/.test(q.title) ? q.title.length > 22 : q.title.length > 44;
    function choice(d) {
      return '<button type="button" class="choice" data-dir="' + d + '"' + (o.disabled ? ' aria-disabled="true"' : "") + (o.static ? ' tabindex="-1"' : "") + ' aria-label="' + esc(t("h.pick.aria", { choice: q[d], q: q.title })) + '">' +
        '<span class="choice-in">' + (d === "l" ? ic("left", 20) : "") + "<span>" + esc(q[d]) + "</span>" + (d === "r" ? ic("right", 20) : "") + "</span></button>";
    }
    function sticker(d) { return '<span class="qstamp qstamp--' + d + '" aria-hidden="true"><span class="qstamp-in">' + ic(d === "l" ? "left" : "right", 18) + "<b>" + esc(q[d]) + "</b></span></span>"; }
    return '<article class="qcard" data-q="' + q.n + '" data-id="' + id + '" data-pos="' + (o.pos || 0) + '" role="group" aria-label="' + esc(t("h.qn.sr", { n: q.n }) + ": " + q.title) + '">' +
      '<div class="qcard-in"><div class="qart' + (o.noimg ? " qart--none" : "") + '" data-bg="' + (o.noimg ? "well" : C.artBg(q)) + '">' + (o.noimg ? "" : C.art(q)) +
      '<span class="qno" aria-hidden="true"><b>' + q.n + "</b>/5</span><span class=\"qkick\">" + t("cat." + q.cat) + "</span></div>" +
      '<span class="qtint" aria-hidden="true"></span>' + sticker("l") + sticker("r") +
      '<div class="qcard-body"><h2' + (long ? ' class="is-long"' : "") + ">" + esc(q.title) + "</h2>" +
      (o.failed ? '<p class="qcard-note">' + ic("warn", 16) + t("h.notsaved") + "</p>" : "") +
      (o.static ? '<div class="qmeta">' : '<button type="button" class="qmeta" data-ai-info="' + id + '" aria-haspopup="dialog">') + '<span class="qmeta-t"><span>' + t("h.answer", { rule: esc(q.rule) }) + "</span><span>" + t("h.ai", { time: q.settle }) + "</span></span>" + (o.static ? "</div>" : ic("info", 18) + "</button>") +
      '<div class="choices">' + choice("l") + choice("r") + "</div>" +
      (o.final ? '<p class="qcard-final">' + t("h.final") + "</p>" : "") +
      "</div></div></article>";
  };
  /* the view switch on the home head''')
rep("""/* the view switch on the home head: two words, the current one underlined in ink */""","""/* the view switch on the home head: a two position slider key */""")
resub(r"C\.thumb = function \(q\) \{.*?\};", """C.thumb = function (q) { if (typeof q === "string") q = App.q(q); return '<span class="thumb" data-bg="' + C.artBg(q) + '" aria-hidden="true">' + C.art(q) + "</span>"; };""")
resub(r"/\* the dateline: the date.*?C\.dateline = function \(liveHtml\) \{.*?\n  \};", """/* the live chip under the header: the one live fact of the screen (time until the set closes, time until the week ends) */
  C.dateline = function (liveHtml) {
    return liveHtml ? '<div class="livebar"><span class="livechip">' + ic("clock", 16) + '<span class="livechip-t">' + liveHtml + "</span></span></div>" : "";
  };""")
# tabbar: no On icons
rep('ic(tb.id === current ? tb.icon + "On" : tb.icon, 22)','ic(tb.icon, 24)')
rep("""'<nav class="tb" aria-label="' + esc(t("nav.tabs")) + '">' + TABS.map(""","""'<nav class="tb" aria-label="' + esc(t("nav.tabs")) + '"><div class="tb-in">' + TABS.map(""")
rep("""t("tab." + tb.id) + "</span></a>";
    }).join("") + "</nav>";""","""t("tab." + tb.id) + "</span></a>";
    }).join("") + "</div></nav>";""")
rep('<a href="\' + tb.href() + \'"\' + (tb.id === current ? \' aria-current="page"\' : "") + \'><span class="tb-ic">','<a href="\' + tb.href() + \'"\' + (tb.id === current ? \' aria-current="page"\' : "") + \'><span class="tb-key"><span class="tb-ic">')
rep("""badge + "</span><span>" + t("tab." + tb.id) + "</span></a>";""","""badge + '</span><span class="tb-l">' + t("tab." + tb.id) + "</span></span></a>";""")
# header
rep("/* the masthead: the nameplate (or, on a sub page, the back arrow and the page title), the points as a boxed figure, the profile. A thick and thin rule closes it. */","/* the header: the wordmark (or, on a sub page, the back key and the page title), the points as a coin chip, the profile. */")
rep("""'<a class="pts" id="pts" href="wallet.html" aria-label="' + esc(label) + '"><span class="pts-in">' + pill + "</span></a>" +""","""'<a class="pts" id="pts" href="wallet.html" aria-label="' + esc(label) + '"><span class="pts-in"><i class="pcoin" aria-hidden="true">P</i>' + pill + "</span></a>" +""")
rep("""'</div></div><div class="oxford" aria-hidden="true"></div></header>';""","""'</div></div></header>';""")
rep("""'<span id="pts-val">' + F.pts(pts) + "</span>\"""","""'<span id="pts-val">' + F.int(pts) + "</span>\"""") if False else None
rep("ic(\"back\", 22) + '</a>","ic(\"back\", 24) + '</a>")
# empty with mascot
rep("""return '<div class="empty"><div class="empty-ic">' + ic(o.icon || "inbox", 28) + "</div><h2>\"""","""return '<div class="empty">' + (o.jam !== undefined ? '<div class="empty-jam">' + C.jam(o.jam, 104) + "</div>" : '<div class="empty-ic">' + ic(o.icon || "inbox", 28) + "</div>") + "<h2>\"""")
# deck: sticker paint + lean
rep("""        el.style.transform = on && !armed ? "rotate(" + x[1] + "deg) scale(" + (0.8 + Math.min(0.2, a * 0.58)).toFixed(3) + ")" : "";""",
"""        el.style.transform = on && !armed ? "rotate(" + x[1] * 2 + "deg) scale(" + (0.55 + Math.min(0.3, a * 0.86)).toFixed(3) + ")" : "";""")
rep('rotate(" + (k * 7 * (card._low ? -1 : 1)).toFixed(2) + "deg)"','rotate(" + (k * 11 * (card._low ? -1 : 1)).toFixed(2) + "deg)"')
rep('(reduce ? "" : " scale(1.012)");\n      if (!reduce) setLift("translate(" + (dx + 5) + "px," + (dy * 0.18 + 9).toFixed(1) + "px)" + rot);','(reduce ? "" : " scale(1.02)");\n      if (!reduce) setLift("translate(" + (dx * 0.86).toFixed(1) + "px," + (dy * 0.12 + 14).toFixed(1) + "px)" + rot);')
rep('var hold = src === "swipe" || reduce ? 0 : 130;','var hold = src === "swipe" || reduce ? 0 : 170;')
rep('card.style.transition = "transform 130ms cubic-bezier(0.23, 1, 0.32, 1)"; card.style.transform = "translateY(-3px) scale(1.012)";','card.style.transition = "transform 170ms cubic-bezier(0.34, 1.56, 0.64, 1)"; card.style.transform = "translateY(-4px) scale(1.02) rotate(" + sign * 1.5 + "deg)";')
rep('rotate(" + sign * 18 + "deg)"; }','rotate(" + sign * 24 + "deg)"; }')
# qr ink ok. tx done fig
rep("""C.rstamp("hit", t("common.done"))""","""C.rstamp("hit", ic("check", 16) + t("common.done"))""")
open(p,'w',encoding='utf8').write(s)
