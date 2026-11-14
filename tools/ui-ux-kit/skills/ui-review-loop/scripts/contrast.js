// node scripts/contrast.js "#FFFFFF/#124CC4" "#0B1530/#D6FF3D" ...
// WCAG contrast ratio for each foreground/background pair. Body text needs 4.5, large text (24 px, or 18.66 px bold) and UI parts need 3.
const L = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); };
const pairs = process.argv.slice(2);
if (!pairs.length) { console.log('usage: node contrast.js "#fg/#bg" ...'); process.exit(1); }
for (const p of pairs) {
  const [fg, bg] = p.split('/'); const x = L(fg), y = L(bg);
  const r = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  console.log(`${fg} on ${bg}  ${r.toFixed(2)}:1  ${r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'large text and UI only' : 'FAIL'}`);
}
