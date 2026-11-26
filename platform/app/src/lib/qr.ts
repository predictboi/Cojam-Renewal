// @ts-nocheck
// QR code: byte mode, error correction Q, versions 1 to 6 (verbatim port of App.qrMatrix in the design).
export const qrMatrix = function (text, forceMask) {
    var bytes = []; for (var i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 255);
    var SPEC = [null, [13, [[1, 13]]], [22, [[1, 22]]], [18, [[2, 17]]], [26, [[2, 24]]], [18, [[2, 15], [2, 16]]], [24, [[4, 19]]]];
    var ver = 0, cap = 0;
    for (var v = 1; v <= 6; v++) { cap = SPEC[v][1].reduce(function (s, g) { return s + g[0] * g[1]; }, 0); if (bytes.length + 2 <= cap) { ver = v; break; } }
    if (!ver) return null;
    var ecLen = SPEC[ver][0], groups = SPEC[ver][1], size = 17 + 4 * ver;
    /* bit stream */
    var bits = [];
    function put(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1); }
    put(4, 4); put(bytes.length, 8); bytes.forEach(function (b) { put(b, 8); });
    for (var z = 0; z < 4 && bits.length < cap * 8; z++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var data = []; for (i = 0; i < bits.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; data.push(x); }
    for (var pad = 0; data.length < cap; pad++) data.push(pad % 2 ? 0x11 : 0xEC);
    /* Reed Solomon over GF(256) */
    var EXP = [], LOG = [], e = 1;
    for (i = 0; i < 255; i++) { EXP[i] = e; LOG[e] = i; e <<= 1; if (e & 256) e ^= 0x11d; }
    function mul(a, b) { return a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0; }
    var gen = [1];
    for (i = 0; i < ecLen; i++) { var ng = []; for (j = 0; j <= gen.length; j++) ng[j] = (j < gen.length ? mul(gen[j], EXP[i]) : 0) ^ (j > 0 ? gen[j - 1] : 0); gen = ng; }
    gen.reverse(); /* highest degree first, monic */
    function rs(block) {
      var rem = []; for (var k = 0; k < ecLen; k++) rem.push(0);
      block.forEach(function (b) { var f = b ^ rem.shift(); rem.push(0); for (var k = 0; k < ecLen; k++) rem[k] ^= mul(gen[k + 1], f); });
      return rem;
    }
    var blocks = [], ecs = [], pos = 0;
    groups.forEach(function (g) { for (var n = 0; n < g[0]; n++) { var bl = data.slice(pos, pos + g[1]); pos += g[1]; blocks.push(bl); ecs.push(rs(bl)); } });
    var out = [], maxLen = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (i = 0; i < maxLen; i++) blocks.forEach(function (b) { if (i < b.length) out.push(b[i]); });
    for (i = 0; i < ecLen; i++) ecs.forEach(function (b) { out.push(b[i]); });
    /* matrix and function patterns */
    var m = [], fn = [];
    for (i = 0; i < size; i++) { m.push(new Array(size).fill(0)); fn.push(new Array(size).fill(0)); }
    function set(xx, yy, val) { m[yy][xx] = val ? 1 : 0; fn[yy][xx] = 1; }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue; var d = Math.max(Math.abs(dx), Math.abs(dy)); set(xx, yy, d !== 2 && d !== 4); } }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (ver >= 2) { var c = size - 7; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    function format(mask) {
      var d = (3 << 3) | mask, rem = d; for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((d << 10) | rem) ^ 0x5412, bit = function (n) { return (f >>> n) & 1; };
      for (k = 0; k <= 5; k++) set(8, k, bit(k));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (k = 9; k < 15; k++) set(14 - k, 8, bit(k));
      for (k = 0; k < 8; k++) set(size - 1 - k, 8, bit(k));
      for (k = 8; k < 15; k++) set(8, size - 15 + k, bit(k));
      set(8, size - 8, 1);
    }
    format(0);
    /* data placement */
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var xx = right - j, up = ((right + 1) & 2) === 0, yy = up ? size - 1 - vert : vert;
        if (!fn[yy][xx] && bi < out.length * 8) { m[yy][xx] = (out[bi >>> 3] >>> (7 - (bi & 7))) & 1; bi++; }
      }
    }
    var MASKS = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x, y) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
    ];
    function apply(mask) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] ^= 1; }
    function penalty() {
      var p = 0, dark = 0, x, y, run, col;
      for (y = 0; y < size; y++) { run = 1; for (x = 1; x < size; x++) { if (m[y][x] === m[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (x = 0; x < size; x++) { run = 1; for (y = 1; y < size; y++) { if (m[y][x] === m[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { col = m[y][x]; if (col === m[y][x + 1] && col === m[y + 1][x] && col === m[y + 1][x + 1]) p += 3; }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) dark += m[y][x];
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    if (forceMask !== undefined) best = forceMask;
    else for (var k = 0; k < 8; k++) { apply(k); format(k); var pp = penalty(); if (pp < bestP) { bestP = pp; best = k; } apply(k); }
    apply(best); format(best);
    return m;
  };
  export const qrSvg = function (text) {
    var m = qrMatrix(text); if (!m) return "";
    var n = m.length, d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += "M" + x + " " + y + "h1v1h-1z";
    return '<svg viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" aria-hidden="true"><path fill="var(--ink)" d="' + d + '"/></svg>';
  };
