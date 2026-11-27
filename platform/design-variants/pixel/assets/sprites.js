/* Pixel art for the Pixel concept. Every picture is a small text grid: one character is one pixel, the letter names a palette ink.
   PXA.svg(name, px) returns an inline SVG made of crisp rectangles (one path per colour), so it scales on the 4 px grid without blur.
   "#" is currentColor (icons), "." is empty. */
(function () {
  "use strict";
  var INK = { k: "--c-ink", N: "--c-night", d: "--c-deep", b: "--c-blue", s: "--c-sky", p: "--c-pale", a: "--c-paper", g: "--c-shade", w: "--c-white", u: "--c-muted", y: "--c-yellow", o: "--c-ember", r: "--c-rust", m: "--c-mint", n: "--c-pine", e: "--c-red" };

  var A = {};

  /* ---------- category pictures, 16 x 16 ---------- */
  A.crypto = [
    ".....kkkkkk.....",
    "...kkyyyyyykk...",
    "..kyywwyyyyyyk..",
    ".kyywyyyyyyyyrk.",
    ".kyyyykkkkyyyrk.",
    "kyyyykkyykkyyyrk",
    "kyyyykkyyyyyyyrk",
    "kyyyykkyyyyyyyrk",
    "kyyyykkyyyyyyyrk",
    "kyyyykkyyyyyyyrk",
    "kyyyykkyykkyyyrk",
    ".kyyyykkkkyyyrk.",
    ".kyyyyyyyyyyrrk.",
    "..kyyyyyyyyrrk..",
    "...kkrrrrrrkk...",
    ".....kkkkkk....."];
  A.markets = [
    "................",
    "............kk..",
    "............kk..",
    "...........kkkk.",
    "...........kmmk.",
    "......kk...kmmk.",
    "......kk...kmmk.",
    ".....kkkk..kmmk.",
    ".kk..kook..kmmk.",
    ".kk..kook..kkkk.",
    "kkkk.kook...kk..",
    "kmmk.kook...kk..",
    "kmmk.kkkk.......",
    "kkkk..kk........",
    ".kk...kk........",
    ".kk............."];
  A.weather = [
    "................",
    ".....k....k.....",
    "..k...kkkk...k..",
    "....kkyyyykk....",
    "...kyyyyyyyyk...",
    "...kyywyyyyyk...",
    ".k.kyyyyykkkkk..",
    "...kyyyykwwwwwk.",
    "...kyykkwwwwwwwk",
    "..kkkkwwwwwwwwwk",
    ".kwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwggk",
    ".kwwwwwwwwwgggk.",
    "..kkkkkkkkkkkk..",
    "................"];
  A.sports = [
    ".....kkkkkk.....",
    "...kkwwwwwwkk...",
    "..kwwwwkkwwwwk..",
    ".kwwwwkkkkwwwwk.",
    ".kkwwwkkkkwwwkk.",
    "kkkwwwwkkwwwwkkk",
    "kkwwwwwwwwwwwwkk",
    "kwwwwwwwwwwwwwwk",
    "kwwwkkwwwwkkwwwk",
    "kwwkkkkwwkkkkwgk",
    "kwwkkkkwwkkkkggk",
    ".kwwkkwwwwkkggk.",
    ".kwwwwwwwwwgggk.",
    "..kwwwwkkgggk...",
    "...kkwwkkggkk...",
    ".....kkkkkk....."];
  A.culture = [
    "................",
    "..kkkkkkkkkkkk..",
    ".kwwkkwwkkwwkkk.",
    ".kwkkwwkkwwkkwk.",
    ".kkkkkkkkkkkkkk.",
    "kkkkkkkkkkkkkkkk",
    "kooooooooooooook",
    "kowwwwwwwooooook",
    "kooooooooooooook",
    "kowwwwwooykkyook",
    "koooooooykyykyok",
    "kowwwwooykyykyok",
    "kooooooooykkyook",
    "krrrrrrrrrrrrrrk",
    "kkkkkkkkkkkkkkkk",
    "................"];

  /* ---------- Jam, the mascot, 16 x 16: one body, the face rows change per mood ---------- */
  function jam(eyes, mouth, arms) {
    var top = arms === "up" ?
      ["y...kkkkkkkk...y", "..kkbbbbbbbbkk.."] :
      ["....kkkkkkkk....", "..kkbbbbbbbbkk.."];
    var side = [".kbbssbbbbbbbbk.", ".kbbsbbbbbbbbbk."];
    return top.concat(side, eyes, [
      "kbbbbbbbbbbbbbbk"], mouth, [
      "kbbbbbbbbbbbbbbk",
      "kdbbbbbbbbbbbbdk",
      ".kddbbbbbbbbddk.",
      ".kkddddddddddkk.",
      "..kkk.kkkk.kkk..",
      "..kkk......kkk.."]);
  }
  var EYES = {
    open:  ["kbbwwwbbbbwwwbbk", "kbbwkkbbbbwkkbbk", "kbbwkkbbbbwkkbbk"],
    blink: ["kbbbbbbbbbbbbbbk", "kbbkkkbbbbkkkbbk", "kbbbbbbbbbbbbbbk"],
    happy: ["kbbbbbbbbbbbbbbk", "kbbbkkbbbbkkbbbk", "kbbkbbkbbkbbkbbk"],
    dizzy: ["kbbkbkbbbbkbkbbk", "kbbbkbbbbbbkbbbk", "kbbkbkbbbbkbkbbk"]
  };
  var MOUTH = { flat: ["kbbbbbbkkbbbbbbk"], smile: ["kbbbbbkwwkbbbbbk"], oh: ["kbbbbbkkkkbbbbbk"], wavy: ["kbbbbkbkkbkbbbbk"] };
  A.jam = jam(EYES.open, MOUTH.flat);
  A.jamBlink = jam(EYES.blink, MOUTH.flat);
  A.jamCheer = jam(EYES.happy, MOUTH.smile, "up");
  A.jamCheer2 = jam(EYES.open, MOUTH.smile);
  A.jamSleep = jam(EYES.blink, MOUTH.oh);
  A.jamDizzy = jam(EYES.dizzy, MOUTH.wavy);

  /* ---------- small objects ---------- */
  A.coin = [
    "..kkkk..",
    ".kywyyk.",
    "kywkkyrk",
    "kykyyyrk",
    "kykyyyrk",
    "kyykkyrk",
    ".kyyyrk.",
    "..kkkk.."];
  A.coinSide = [
    "...kk...",
    "..kyrk..",
    "..kyrk..",
    "..kyrk..",
    "..kyrk..",
    "..kyrk..",
    "..kyrk..",
    "...kk..."];
  A.coinHalf = [
    "..kkkk..",
    "..kywk..",
    ".kyyyrk.",
    ".kykyrk.",
    ".kykyrk.",
    ".kyyyrk.",
    "..kyrk..",
    "..kkkk.."];
  A.trophy = [
    "..kkkkkkkk..",
    "kkkyyyyyykkk",
    "k.kywyyyrk.k",
    "k.kywyyyrk.k",
    ".kkyyyyyrkk.",
    "..kyyyyyrk..",
    "...kyyyrk...",
    "....kyrk....",
    "....kyrk....",
    "...kkyrkk...",
    "..kyyyyyrk..",
    "..kkkkkkkk.."];
  A.lock = [
    "...kkkkkk...",
    "..kk....kk..",
    "..kk....kk..",
    "..kk....kk..",
    ".kkkkkkkkkk.",
    ".kyyyyyyyrk.",
    ".kyyykkyyrk.",
    ".kyyykkyyrk.",
    ".kyyyykyyrk.",
    ".kyyyyyyyrk.",
    ".krrrrrrrrk.",
    ".kkkkkkkkkk."];
  A.crown = [
    "k...kk...k",
    "kk.kyyk.kk",
    "kykyyyykyk",
    "kyyywyyyrk",
    "kyyyyyyyrk",
    "kkkkkkkkkk"];

  /* ---------- icons, 12 x 12, one colour (currentColor) ---------- */
  var I = {
    home: [
      ".....##.....",
      "....####....",
      "...######...",
      "..########..",
      ".##########.",
      "############",
      ".##......##.",
      ".##......##.",
      ".##..##..##.",
      ".##..##..##.",
      ".##..##..##.",
      ".##########."],
    results: [
      "............",
      ".##########.",
      ".#........#.",
      ".#.##...#.#.",
      ".#.....#..#.",
      ".#.#..#...#.",
      ".#..##....#.",
      ".#........#.",
      ".#.######.#.",
      ".#........#.",
      ".##########.",
      "............"],
    rank: [
      "............",
      ".##########.",
      "#.########.#",
      "#.########.#",
      "#.########.#",
      ".##.####.##.",
      "....####....",
      ".....##.....",
      ".....##.....",
      "....####....",
      "..########..",
      "............"],
    stake: [
      "............",
      "...######...",
      "..##....##..",
      "..##....##..",
      "..##....##..",
      ".##########.",
      ".##########.",
      ".####..####.",
      ".####..####.",
      ".#####.####.",
      ".##########.",
      "............"],
    wallet: [
      "............",
      ".#########..",
      "###########.",
      "##.........#",
      "############",
      "##......####",
      "##......#..#",
      "##......#..#",
      "##......####",
      "############",
      ".##########.",
      "............"],
    back: [
      "............",
      ".....##.....",
      "....##......",
      "...##.......",
      "..##........",
      ".##########.",
      ".##########.",
      "..##........",
      "...##.......",
      "....##......",
      ".....##.....",
      "............"],
    left: [
      "............",
      ".......##...",
      "......###...",
      ".....####...",
      "....#####...",
      "...######...",
      "...######...",
      "....#####...",
      ".....####...",
      "......###...",
      ".......##...",
      "............"],
    right: [
      "............",
      "...##.......",
      "...###......",
      "...####.....",
      "...#####....",
      "...######...",
      "...######...",
      "...#####....",
      "...####.....",
      "...###......",
      "...##.......",
      "............"],
    chev: [
      "............",
      "....##......",
      ".....##.....",
      "......##....",
      ".......##...",
      "........##..",
      "........##..",
      ".......##...",
      "......##....",
      ".....##.....",
      "....##......",
      "............"],
    down: [
      "............",
      "............",
      "............",
      ".##......##.",
      "..##....##..",
      "...##..##...",
      "....####....",
      ".....##.....",
      "............",
      "............",
      "............",
      "............"],
    info: [
      "...######...",
      "..#......#..",
      ".#...##...#.",
      "#....##....#",
      "#..........#",
      "#...###....#",
      "#....##....#",
      "#....##....#",
      "#....##....#",
      ".#..####..#.",
      "..#......#..",
      "...######..."],
    check: [
      "............",
      "............",
      "..........##",
      ".........##.",
      "........##..",
      "##.....##...",
      ".##...##....",
      "..##.##.....",
      "...###......",
      "....#.......",
      "............",
      "............"],
    cross: [
      "............",
      ".##......##.",
      "..##....##..",
      "...##..##...",
      "....####....",
      ".....##.....",
      ".....##.....",
      "....####....",
      "...##..##...",
      "..##....##..",
      ".##......##.",
      "............"],
    clock: [
      "...######...",
      "..#......#..",
      ".#...##...#.",
      "#....##....#",
      "#....##....#",
      "#....####..#",
      "#....####..#",
      "#..........#",
      "#..........#",
      ".#........#.",
      "..#......#..",
      "...######..."],
    copy: [
      "............",
      "...########.",
      "...#......#.",
      ".######...#.",
      ".#....#...#.",
      ".#....#...#.",
      ".#....#...#.",
      ".#....#####.",
      ".#....#.....",
      ".#....#.....",
      ".######.....",
      "............"],
    user: [
      "............",
      "....####....",
      "...######...",
      "...######...",
      "...######...",
      "....####....",
      "............",
      "..########..",
      ".##########.",
      ".##########.",
      ".##########.",
      "............"],
    undo: [
      "............",
      "...##.......",
      "..##........",
      ".#########..",
      ".##########.",
      "..##.....##.",
      "...##....##.",
      ".........##.",
      "........###.",
      "...#######..",
      "...######...",
      "............"],
    plus: [
      "............",
      "............",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      "..########..",
      "..########..",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      "............",
      "............"],
    minus: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "..########..",
      "..########..",
      "............",
      "............",
      "............",
      "............",
      "............"],
    warn: [
      ".....##.....",
      "....####....",
      "....#..#....",
      "...##..##...",
      "...#.##.#...",
      "..##.##.##..",
      "..#..##..#..",
      ".##......##.",
      ".#...##...#.",
      "##........##",
      "############",
      "............"],
    share: [
      "............",
      ".....##.....",
      "....####....",
      "...######...",
      ".....##.....",
      ".....##.....",
      ".#...##...#.",
      ".#...##...#.",
      ".#........#.",
      ".#........#.",
      ".##########.",
      "............"],
    cards: [
      "............",
      "...########.",
      "...#......#.",
      ".########.#.",
      ".#......#.#.",
      ".#......#.#.",
      ".#......#.#.",
      ".#......###.",
      ".#......#...",
      ".#......#...",
      ".########...",
      "............"],
    list: [
      "............",
      "............",
      ".##.#######.",
      ".##.#######.",
      "............",
      ".##.#######.",
      ".##.#######.",
      "............",
      ".##.#######.",
      ".##.#######.",
      "............",
      "............"],
    wifi: [
      "............",
      "..########..",
      ".##......##.",
      "##........##",
      "....####....",
      "...##..##...",
      "..##....##..",
      "............",
      ".....##.....",
      ".....##.....",
      "............",
      "............"],
    heart: [
      "............",
      "..##....##..",
      ".####..####.",
      "############",
      "############",
      "############",
      ".##########.",
      "..########..",
      "...######...",
      "....####....",
      ".....##.....",
      "............"]
  };

  function build(rows, px, cls, label) {
    var hgt = rows.length, wid = rows[0].length, by = {};
    for (var y = 0; y < hgt; y++) {
      var row = rows[y], x = 0;
      while (x < wid) {
        var c = row[x];
        if (c === "." || c === undefined) { x++; continue; }
        var x0 = x; while (x < wid && row[x] === c) x++;
        (by[c] = by[c] || []).push("M" + x0 + " " + y + "h" + (x - x0) + "v1h-" + (x - x0) + "z");
      }
    }
    var paths = Object.keys(by).map(function (c) {
      return '<path fill="' + (c === "#" ? "currentColor" : "var(" + INK[c] + ")") + '" d="' + by[c].join("") + '"/>';
    }).join("");
    return '<svg class="pxa ' + (cls || "") + '" width="' + wid * px + '" height="' + hgt * px + '" viewBox="0 0 ' + wid + " " + hgt + '" shape-rendering="crispEdges" ' +
      (label ? 'role="img" aria-label="' + label + '"' : 'aria-hidden="true"') + ">" + paths + "</svg>";
  }

  window.PXA = {
    art: A, icons: I,
    svg: function (name, px, cls, label) { var r = A[name]; return r ? build(r, px || 4, cls, label) : ""; },
    icon: function (name, px, cls) { var r = I[name]; return r ? build(r, px || 2, "ico " + (cls || "")) : ""; },
    /* frames laid on top of each other; CSS shows one at a time with steps() */
    frames: function (names, px, cls) {
      return '<span class="spr ' + (cls || "") + '" aria-hidden="true" style="--n:' + names.length + '">' + names.map(function (n, i) { return '<span class="spr-f" style="--i:' + i + '">' + build(A[n], px) + "</span>"; }).join("") + "</span>";
    },
    check: function () {
      var bad = [];
      [A, I].forEach(function (set) { Object.keys(set).forEach(function (k) { var w = set[k][0].length; set[k].forEach(function (r, i) { if (r.length !== w) bad.push(k + " row " + i + " is " + r.length + ", not " + w); }); }); });
      return bad;
    }
  };
})();
